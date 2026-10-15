import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireRestaurantOwner } from '@/lib/auth/guard';
import { updateRestaurantSchema } from '@/lib/validation/restaurant';
import { formatRestaurantProfile, formatBranchProfile } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError, NotFoundError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireRestaurantOwner(request);

    const restaurant = await prisma.restaurants.findFirst({
      where: {
        owner_id: authContext.user.id,
        status: 'active',
      },
      include: {
        branches: {
          where: { status: 'active' },
          orderBy: { created_at: 'asc' },
        },
      },
    });

    if (!restaurant) {
      return successResponse({
        restaurant: null,
        branches: [],
      });
    }

    return successResponse({
      restaurant: formatRestaurantProfile(restaurant),
      branches: restaurant.branches.map(formatBranchProfile),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const authContext = await requireRestaurantOwner(request);

    // Locate active restaurant owned by the caller
    const restaurant = await prisma.restaurants.findFirst({
      where: {
        owner_id: authContext.user.id,
        status: 'active',
      },
    });

    if (!restaurant) {
      throw new NotFoundError('No active restaurant found for this owner account');
    }

    const rawBody = await request.json();
    const validatedData = updateRestaurantSchema.parse(rawBody);

    const updated = await prisma.restaurants.update({
      where: { id: restaurant.id },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
        ...(validatedData.legalName !== undefined ? { legal_name: validatedData.legalName } : {}),
        ...(validatedData.email !== undefined ? { email: validatedData.email || null } : {}),
        ...(validatedData.phone !== undefined ? { phone: validatedData.phone || null } : {}),
        ...(validatedData.address !== undefined ? { address: validatedData.address } : {}),
        ...(validatedData.city !== undefined ? { city: validatedData.city } : {}),
        ...(validatedData.state !== undefined ? { state: validatedData.state } : {}),
        ...(validatedData.country !== undefined ? { country: validatedData.country } : {}),
        ...(validatedData.timezone !== undefined ? { timezone: validatedData.timezone } : {}),
        ...(validatedData.status !== undefined ? { status: validatedData.status } : {}),
        updated_at: new Date(),
      },
    });

    return successResponse({
      restaurant: formatRestaurantProfile(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
