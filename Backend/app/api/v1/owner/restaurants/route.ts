import { NextRequest } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db/prisma';
import { requireRestaurantOwner } from '@/lib/auth/guard';
import { createRestaurantSchema } from '@/lib/validation/restaurant';
import { formatRestaurantProfile, formatBranchProfile } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError, ConflictError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const authContext = await requireRestaurantOwner(request);
    const rawBody = await request.json();
    const validatedData = createRestaurantSchema.parse(rawBody);

    // Advisory lock key derived from owner user ID to serialize concurrent onboarding requests
    const hashBuf = crypto.createHash('sha256').update(authContext.user.id).digest();
    const lockKey = hashBuf.readInt32BE(0);

    return await prisma.$transaction(async (tx) => {
      // 1. Acquire transaction-level advisory lock
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;

      // 2. Enforce single-restaurant invariant: check if owner already has an active restaurant
      const existing = await tx.restaurants.findFirst({
        where: {
          owner_id: authContext.user.id,
          status: 'active',
        },
      });

      if (existing) {
        throw new ConflictError(
          'Owner already has an active restaurant registered. Multiple active restaurants are not permitted for a single owner account.'
        );
      }

      // 3. Create restaurant entity
      const restaurant = await tx.restaurants.create({
        data: {
          owner_id: authContext.user.id,
          name: validatedData.name,
          legal_name: validatedData.legalName || null,
          email: validatedData.email || null,
          phone: validatedData.phone || null,
          address: validatedData.address || null,
          city: validatedData.city || null,
          state: validatedData.state || null,
          country: validatedData.country,
          timezone: validatedData.timezone,
          status: 'active',
        },
      });

      // 4. Atomically create initial branch if provided in the onboarding payload
      const branches: any[] = [];
      if (validatedData.initialBranch) {
        const branch = await tx.branches.create({
          data: {
            restaurant_id: restaurant.id,
            name: validatedData.initialBranch.name,
            phone: validatedData.initialBranch.phone || null,
            address: validatedData.initialBranch.address || null,
            city: validatedData.initialBranch.city || null,
            state: validatedData.initialBranch.state || null,
            country: validatedData.initialBranch.country || restaurant.country,
            timezone: validatedData.initialBranch.timezone || restaurant.timezone,
            status: 'active',
          },
        });
        branches.push(branch);
      }

      return successResponse(
        {
          restaurant: formatRestaurantProfile(restaurant),
          branches: branches.map(formatBranchProfile),
        },
        201
      );
    });
  } catch (error) {
    return handleApiError(error);
  }
}
