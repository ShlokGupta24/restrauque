import { NextRequest } from 'next/server';
import { requireCustomer } from '@/lib/auth/guard';
import { validateUuid } from '@/lib/auth/tenancy';
import { createFeedbackSchema } from '@/lib/validation/feedback';
import {
  getOrderFeedbackEligibility,
  submitOrderFeedback,
} from '@/lib/feedback/service';
import { successResponse } from '@/lib/http/response';
import { handleApiError } from '@/lib/http/errors';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // 1. Authenticate customer
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Validate order identifier
    const { orderId } = await params;
    validateUuid(orderId, 'orderId');

    // 3. Check feedback eligibility & load order details
    const result = await getOrderFeedbackEligibility(orderId, customerId);

    return successResponse(result, 200);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    // 1. Authenticate customer
    const authContext = await requireCustomer(request);
    const customerId = authContext.user.id;

    // 2. Validate order identifier
    const { orderId } = await params;
    validateUuid(orderId, 'orderId');

    // 3. Parse and validate feedback payload
    const body = await request.json();
    const validatedInput = createFeedbackSchema.parse(body);

    // 4. Submit feedback and award loyalty reward atomically
    const result = await submitOrderFeedback(customerId, orderId, validatedInput);

    return successResponse(result, 201);
  } catch (error) {
    return handleApiError(error);
  }
}
