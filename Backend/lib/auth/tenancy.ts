import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { requireRestaurantOwner } from '@/lib/auth/guard';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/http/errors';
import type {
  SafeRestaurantSummary,
  SafeBranchSummary,
  OwnerRestaurantContext,
  AuthorizedRestaurantContext,
  AuthorizedBranchContext,
} from '@/types/tenancy';

const uuidSchema = z.string().uuid({ message: 'Identifier must be a valid UUID' });

function validateUuid(id: string, fieldName: string): string {
  const result = uuidSchema.safeParse(id);
  if (!result.success) {
    throw new ValidationError(`Invalid ${fieldName}: must be a valid UUID`);
  }
  return result.data;
}

/**
 * Resolves the primary active restaurant and branches for an authenticated owner.
 * Returns null if no restaurant is currently associated with this owner.
 */
export async function getOwnerRestaurantContext(
  ownerId: string
): Promise<{ restaurant: SafeRestaurantSummary | null; branches: SafeBranchSummary[] }> {
  validateUuid(ownerId, 'ownerId');

  const restaurant = await prisma.restaurants.findFirst({
    where: {
      owner_id: ownerId,
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
    return {
      restaurant: null,
      branches: [],
    };
  }

  const safeRestaurant: SafeRestaurantSummary = {
    id: restaurant.id,
    name: restaurant.name,
    legalName: restaurant.legal_name,
    status: restaurant.status,
    timezone: restaurant.timezone,
    country: restaurant.country,
    createdAt: restaurant.created_at.toISOString(),
    updatedAt: restaurant.updated_at.toISOString(),
  };

  const safeBranches: SafeBranchSummary[] = restaurant.branches.map((b) => ({
    id: b.id,
    restaurantId: b.restaurant_id,
    name: b.name,
    status: b.status,
    timezone: b.timezone,
    country: b.country,
    createdAt: b.created_at.toISOString(),
    updatedAt: b.updated_at.toISOString(),
  }));

  return {
    restaurant: safeRestaurant,
    branches: safeBranches,
  };
}

/**
 * Centralized authorization guard:
 * 1. Authenticates caller and enforces RESTAURANT_OWNER role.
 * 2. Resolves restaurant and branch context directly from persisted database ownership.
 * 3. Never trusts client-supplied owner IDs, roles, or permissions.
 */
export async function resolveOwnerContext(
  request: Request | NextRequest
): Promise<OwnerRestaurantContext> {
  const authContext = await requireRestaurantOwner(request);
  const context = await getOwnerRestaurantContext(authContext.user.id);

  return {
    owner: authContext.user,
    restaurant: context.restaurant,
    branches: context.branches,
  };
}

/**
 * Enforces that the authenticated owner owns the specified restaurant (or their primary restaurant).
 * 1. Validates caller is RESTAURANT_OWNER.
 * 2. Validates requested restaurantId format.
 * 3. Fetches restaurant from database.
 * 4. Strictly checks restaurant.owner_id === authenticatedUser.id.
 * 5. Rejects cross-tenant and non-existent access attempts.
 */
export async function requireAuthorizedRestaurant(
  request: Request | NextRequest,
  restaurantId?: string | null
): Promise<AuthorizedRestaurantContext> {
  const authContext = await requireRestaurantOwner(request);

  let targetRestaurantId: string;

  if (restaurantId) {
    targetRestaurantId = validateUuid(restaurantId, 'restaurantId');
  } else {
    // Resolve primary restaurant for this owner
    const primary = await prisma.restaurants.findFirst({
      where: {
        owner_id: authContext.user.id,
        status: 'active',
      },
      select: { id: true },
    });

    if (!primary) {
      throw new NotFoundError('No active restaurant is associated with this owner account');
    }
    targetRestaurantId = primary.id;
  }

  const restaurant = await prisma.restaurants.findUnique({
    where: { id: targetRestaurantId },
    include: {
      branches: {
        where: { status: 'active' },
        orderBy: { created_at: 'asc' },
      },
    },
  });

  if (!restaurant) {
    throw new NotFoundError('Restaurant not found');
  }

  // Cross-tenant access rejection: authenticated owner must match persisted owner_id
  if (restaurant.owner_id !== authContext.user.id) {
    throw new ForbiddenError(
      'Access forbidden: You do not have ownership or authorization for this restaurant'
    );
  }

  if (restaurant.status !== 'active') {
    throw new ForbiddenError('Restaurant account is suspended or inactive');
  }

  const safeRestaurant: SafeRestaurantSummary = {
    id: restaurant.id,
    name: restaurant.name,
    legalName: restaurant.legal_name,
    status: restaurant.status,
    timezone: restaurant.timezone,
    country: restaurant.country,
    createdAt: restaurant.created_at.toISOString(),
    updatedAt: restaurant.updated_at.toISOString(),
  };

  const safeBranches: SafeBranchSummary[] = restaurant.branches.map((b) => ({
    id: b.id,
    restaurantId: b.restaurant_id,
    name: b.name,
    status: b.status,
    timezone: b.timezone,
    country: b.country,
    createdAt: b.created_at.toISOString(),
    updatedAt: b.updated_at.toISOString(),
  }));

  return {
    owner: authContext.user,
    restaurant: safeRestaurant,
    branches: safeBranches,
  };
}

/**
 * Enforces that:
 * 1. The authenticated caller owns the parent restaurant.
 * 2. The requested branch exists and strictly belongs to the resolved restaurant.
 * 3. Rejects cross-restaurant branch tampering.
 */
export async function requireAuthorizedBranch(
  request: Request | NextRequest,
  restaurantId: string,
  branchId: string
): Promise<AuthorizedBranchContext> {
  const restaurantContext = await requireAuthorizedRestaurant(request, restaurantId);
  const validatedBranchId = validateUuid(branchId, 'branchId');

  const branch = await prisma.branches.findUnique({
    where: { id: validatedBranchId },
  });

  if (!branch) {
    throw new NotFoundError('Branch not found');
  }

  // Validate that requested branch belongs to the resolved parent restaurant
  if (branch.restaurant_id !== restaurantContext.restaurant.id) {
    throw new ForbiddenError(
      'Access forbidden: Requested branch does not belong to the authorized restaurant'
    );
  }

  if (branch.status !== 'active') {
    throw new ForbiddenError('Branch is suspended or inactive');
  }

  const safeBranch: SafeBranchSummary = {
    id: branch.id,
    restaurantId: branch.restaurant_id,
    name: branch.name,
    status: branch.status,
    timezone: branch.timezone,
    country: branch.country,
    createdAt: branch.created_at.toISOString(),
    updatedAt: branch.updated_at.toISOString(),
  };

  return {
    ...restaurantContext,
    branch: safeBranch,
  };
}
