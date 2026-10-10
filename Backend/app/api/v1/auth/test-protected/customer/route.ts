import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await requireCustomer(request);

    return successResponse({
      message: 'Access granted to CUSTOMER',
      role: user.role,
      userId: user.id,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
