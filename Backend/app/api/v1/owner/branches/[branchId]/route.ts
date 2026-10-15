import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import {
  requireAuthorizedRestaurant,
  requireAuthorizedBranch,
  validateUuid,
  formatBranchProfile,
} from '@/lib/auth/tenancy';
import { updateBranchSchema } from '@/lib/validation/restaurant';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    validateUuid(branchId, 'branchId');

    const restContext = await requireAuthorizedRestaurant(request);
    const branchContext = await requireAuthorizedBranch(
      request,
      restContext.restaurant.id,
      branchId,
      { allowInactive: true }
    );

    const fullBranch = await prisma.branches.findUnique({
      where: { id: branchContext.branch.id },
    });

    return successResponse({
      branch: formatBranchProfile(fullBranch || branchContext.branch),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
) {
  try {
    const { branchId } = await params;
    validateUuid(branchId, 'branchId');

    const restContext = await requireAuthorizedRestaurant(request);
    const branchContext = await requireAuthorizedBranch(
      request,
      restContext.restaurant.id,
      branchId,
      { allowInactive: true }
    );

    const rawBody = await request.json();
    const validatedData = updateBranchSchema.parse(rawBody);

    // If updating branch name, check for uniqueness conflicts within this restaurant
    if (validatedData.name && validatedData.name !== branchContext.branch.name) {
      const duplicate = await prisma.branches.findFirst({
        where: {
          restaurant_id: restContext.restaurant.id,
          name: validatedData.name,
          NOT: { id: branchId },
        },
      });

      if (duplicate) {
        throw new ConflictError(
          `A branch with name "${validatedData.name}" already exists in this restaurant`
        );
      }
    }

    const updated = await prisma.branches.update({
      where: { id: branchId },
      data: {
        ...(validatedData.name !== undefined ? { name: validatedData.name } : {}),
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
      branch: formatBranchProfile(updated),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
