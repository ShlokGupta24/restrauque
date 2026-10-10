import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth/guard';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { user } = await authenticateRequest(request);

    return successResponse({
      user,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
