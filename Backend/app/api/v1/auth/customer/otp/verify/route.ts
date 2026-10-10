import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { verifyOtpSchema } from '@/lib/validation/auth';
import { verifyCustomerOtp } from '@/lib/auth/otp';
import { createCustomerDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { setAuthCookie } from '@/lib/auth/cookies';
import { successResponse } from '@/lib/http/response';
import { handleApiError, AuthenticationError } from '@/lib/http/errors';
import type { SafeUser } from '@/types/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.json();
    const validatedData = verifyOtpSchema.parse(rawBody);

    // Atomically verify OTP challenge in otp_verifications table
    await verifyCustomerOtp(validatedData.phone, validatedData.otp);

    // Locate or create customer record in customers table
    let customer = await prisma.customers.findUnique({
      where: { phone: validatedData.phone },
    });

    if (customer) {
      // Check customer account status
      if (customer.status !== 'active') {
        throw new AuthenticationError('Customer account is suspended or inactive');
      }

      // Update visit timestamp and name if provided
      customer = await prisma.customers.update({
        where: { id: customer.id },
        data: {
          last_visit_at: new Date(),
          ...(validatedData.name && customer.name === 'Customer' ? { name: validatedData.name } : {}),
        },
      });
    } else {
      // Create new customer record
      customer = await prisma.customers.create({
        data: {
          name: validatedData.name || 'Customer',
          phone: validatedData.phone,
          status: 'active',
          first_visit_at: new Date(),
        },
      });
    }

    // Establish secure session in customer_sessions table
    const ipAddress = request.headers.get('x-forwarded-for') || null;
    const userAgent = request.headers.get('user-agent') || null;

    const { sessionId, sessionToken } = await createCustomerDatabaseSession(
      customer.id,
      ipAddress,
      userAgent
    );

    // Issue JWT binding customer ID, session ID, session token, and strict CUSTOMER role
    const token = await createJwtToken({
      userId: customer.id,
      sessionId,
      sessionToken,
      phone: customer.phone,
      email: null,
      role: 'CUSTOMER',
    });

    const safeCustomer: SafeUser = {
      id: customer.id,
      email: null,
      name: customer.name,
      phone: customer.phone,
      role: 'CUSTOMER',
      status: customer.status,
      createdAt: customer.created_at.toISOString(),
      updatedAt: customer.updated_at.toISOString(),
    };

    const response = successResponse({
      user: safeCustomer,
      token,
    });

    // Set secure HTTP-only cookie
    setAuthCookie(response, token);

    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
