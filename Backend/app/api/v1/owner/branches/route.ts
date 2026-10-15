import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireAuthorizedRestaurant, formatBranchProfile } from '@/lib/auth/tenancy';
import { createBranchSchema } from '@/lib/validation/restaurant';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await requireAuthorizedRestaurant(request);
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');

    const statusFilter =
      statusParam && statusParam !== 'all'
        ? { status: statusParam }
        : {};

    const branches = await prisma.branches.findMany({
      where: {
        restaurant_id: context.restaurant.id,
        ...statusFilter,
      },
      orderBy: { created_at: 'asc' },
    });

    return successResponse({
      restaurantId: context.restaurant.id,
      branches: branches.map(formatBranchProfile),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireAuthorizedRestaurant(request);
    const rawBody = await request.json();
    const validatedData = createBranchSchema.parse(rawBody);

    // Check duplicate branch name in the authorized restaurant
    const existing = await prisma.branches.findFirst({
      where: {
        restaurant_id: context.restaurant.id,
        name: validatedData.name,
      },
    });

    if (existing) {
      throw new ConflictError(
        `A branch with name "${validatedData.name}" already exists in this restaurant`
      );
    }

    const branch = await prisma.branches.create({
      data: {
        restaurant_id: context.restaurant.id,
        name: validatedData.name,
        phone: validatedData.phone || null,
        address: validatedData.address || null,
        city: validatedData.city || null,
        state: validatedData.state || null,
        country: validatedData.country,
        timezone: validatedData.timezone,
        status: 'active',
      },
    });

    return successResponse(
      {
        branch: formatBranchProfile(branch),
      },
      201
    );
  } catch (error) {
    return handleApiError(error);
  }
}
