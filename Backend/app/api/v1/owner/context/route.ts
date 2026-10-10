import { NextRequest } from 'next/server';
import { resolveOwnerContext } from '@/lib/auth/tenancy';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const context = await resolveOwnerContext(request);

    return successResponse({
      owner: context.owner,
      restaurant: context.restaurant,
      branches: context.branches,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
