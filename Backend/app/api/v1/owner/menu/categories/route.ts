import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { createCategorySchema } from '@/lib/validation/menu';
import { formatCategory } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError, ValidationError } from '@/lib/http/errors';
import { CATALOG_BOUNDS } from '@/lib/validation/menu';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const { searchParams } = new URL(request.url);
    const isActiveParam = searchParams.get('isActive');
    const search = searchParams.get('search')?.trim();
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const where: Prisma.categoriesWhereInput = {
      restaurant_id: restaurantId,
    };

    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.is_active = isActiveParam === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [categoriesList, total, activeCount, inactiveCount] = await Promise.all([
      prisma.categories.findMany({
        where,
        include: {
          _count: {
            select: { products: true },
          },
        },
        orderBy: [{ display_order: 'asc' }, { name: 'asc' }],
        skip,
        take: limit,
      }),
      prisma.categories.count({ where }),
      prisma.categories.count({
        where: { restaurant_id: restaurantId, is_active: true },
      }),
      prisma.categories.count({
        where: { restaurant_id: restaurantId, is_active: false },
      }),
    ]);

    const formatted = categoriesList.map((c) => formatCategory(c));

    return successResponse({
      categories: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalCategories: activeCount + inactiveCount,
        activeCategories: activeCount,
        inactiveCategories: inactiveCount,
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const rawBody = await request.json();
    const validatedData = createCategorySchema.parse(rawBody);

    try {
      const created = await prisma.$transaction(
        async (tx) => {
          // Enforce active category capacity limit with container-level row lock
          if (validatedData.isActive !== false) {
            if (typeof (tx as any).$executeRaw === 'function') {
              await (tx as any).$executeRaw`SELECT id FROM restaurants WHERE id = ${restaurantId}::uuid FOR UPDATE`;
            }

            const activeCategoryCount = await tx.categories.count({
              where: {
                restaurant_id: restaurantId,
                is_active: true,
              },
            });

            if (activeCategoryCount >= CATALOG_BOUNDS.MAX_CATEGORIES) {
              throw new ValidationError(
                `Category limit reached. A restaurant cannot have more than ${CATALOG_BOUNDS.MAX_CATEGORIES} active categories.`
              );
            }
          }

          // Check for duplicate category name within this restaurant
          const existing = await tx.categories.findFirst({
            where: {
              restaurant_id: restaurantId,
              name: { equals: validatedData.name, mode: 'insensitive' },
            },
          });

          if (existing) {
            throw new ConflictError(
              `A category named "${validatedData.name}" already exists in this restaurant`
            );
          }

          return tx.categories.create({
            data: {
              restaurant_id: restaurantId,
              name: validatedData.name,
              description: validatedData.description ?? null,
              display_order: validatedData.displayOrder ?? 0,
              is_active: validatedData.isActive ?? true,
            },
          });
        },
        { isolationLevel: 'ReadCommitted', maxWait: 5000, timeout: 10000 }
      );

      return successResponse(
        {
          category: formatCategory(created, 0),
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A category named "${validatedData.name}" already exists in this restaurant`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
