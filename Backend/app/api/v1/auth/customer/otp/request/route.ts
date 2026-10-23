import { NextRequest } from 'next/server';
import { requestOtpSchema } from '@/lib/validation/auth';
import { requestCustomerOtp } from '@/lib/auth/otp';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedData = requestOtpSchema.parse(rawBody);

    const { expiresInSeconds, isSimulated } = await requestCustomerOtp(validatedData.phone);

    return successResponse(
      {
        message: 'OTP verification code requested successfully',
        phone: validatedData.phone,
        expiresInSeconds,
        ...(process.env.NODE_ENV !== 'production' && isSimulated ? { simulated: true } : {}),
      },
      200
    );
  } catch (error) {
    return handleApiError(error);
  }
}
