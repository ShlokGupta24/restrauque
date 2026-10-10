import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, validateUuid } from '@/lib/auth/tenancy';
import { createProductSchema } from '@/lib/validation/menu';
import { formatProduct } from '@/lib/menu/format';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError, ValidationError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const restContext = await requireAuthorizedRestaurant(request);
    const restaurantId = restContext.restaurant.id;

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search')?.trim();
    const categoryId = searchParams.get('categoryId');
    const isActiveParam = searchParams.get('isActive');
    const isAvailableParam = searchParams.get('isAvailable');
    const sortBy = searchParams.get('sortBy') || 'display_order';
    const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.productsWhereInput = {
      restaurant_id: restaurantId,
    };

    if (categoryId) {
      validateUuid(categoryId, 'categoryId');
      where.category_id = categoryId;
    }

    if (isActiveParam !== null && isActiveParam !== undefined && isActiveParam !== '') {
      where.is_active = isActiveParam === 'true';
    }

    if (isAvailableParam !== null && isAvailableParam !== undefined && isAvailableParam !== '') {
      where.is_available = isAvailableParam === 'true';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Determine orderBy
    let orderBy: Prisma.productsOrderByWithRelationInput[];
    switch (sortBy) {
      case 'name':
        orderBy = [{ name: sortOrder }, { id: 'asc' }];
        break;
      case 'price':
        orderBy = [{ price: sortOrder }, { id: 'asc' }];
        break;
      case 'created_at':
        orderBy = [{ created_at: sortOrder }, { id: 'asc' }];
        break;
      case 'display_order':
      default:
        orderBy = [{ display_order: sortOrder }, { name: 'asc' }, { id: 'asc' }];
        break;
    }

    const [productList, total, activeCount, inactiveCount, availableCount, unavailableCount] =
      await Promise.all([
        prisma.products.findMany({
          where,
          include: {
            categories: {
              select: { name: true },
            },
          },
          orderBy,
          skip,
          take: limit,
        }),
        prisma.products.count({ where }),
        prisma.products.count({
          where: { restaurant_id: restaurantId, is_active: true },
        }),
        prisma.products.count({
          where: { restaurant_id: restaurantId, is_active: false },
        }),
        prisma.products.count({
          where: { restaurant_id: restaurantId, is_available: true },
        }),
        prisma.products.count({
          where: { restaurant_id: restaurantId, is_available: false },
        }),
      ]);

    const formatted = productList.map((p) => formatProduct(p));

    return successResponse({
      products: formatted,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
      summary: {
        totalProducts: activeCount + inactiveCount,
        activeProducts: activeCount,
        inactiveProducts: inactiveCount,
        availableProducts: availableCount,
        unavailableProducts: unavailableCount,
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
    const validatedData = createProductSchema.parse(rawBody);

    // Verify category exists and strictly belongs to this restaurant
    const category = await prisma.categories.findFirst({
      where: {
        id: validatedData.categoryId,
        restaurant_id: restaurantId,
      },
    });

    if (!category) {
      throw new ValidationError(
        'The specified category does not exist or does not belong to this restaurant'
      );
    }

    // Check for duplicate product name within this restaurant
    const existing = await prisma.products.findFirst({
      where: {
        restaurant_id: restaurantId,
        name: { equals: validatedData.name, mode: 'insensitive' },
      },
    });

    if (existing) {
      throw new ConflictError(
        `A product named "${validatedData.name}" already exists in this restaurant`
      );
    }

    try {
      const created = await prisma.products.create({
        data: {
          restaurant_id: restaurantId,
          category_id: validatedData.categoryId,
          name: validatedData.name,
          description: validatedData.description ?? null,
          price: new Prisma.Decimal(validatedData.price.toFixed(2)),
          image_url: validatedData.imageUrl ?? null,
          display_order: validatedData.displayOrder ?? 0,
          is_active: validatedData.isActive ?? true,
          is_available: validatedData.isAvailable ?? true,
        },
        include: {
          categories: {
            select: { name: true },
          },
        },
      });

      return successResponse(
        {
          product: formatProduct(created),
        },
        201
      );
    } catch (dbError) {
      if (dbError instanceof Prisma.PrismaClientKnownRequestError && dbError.code === 'P2002') {
        throw new ConflictError(
          `A product named "${validatedData.name}" already exists in this restaurant`
        );
      }
      throw dbError;
    }
  } catch (error) {
    return handleApiError(error);
  }
}
