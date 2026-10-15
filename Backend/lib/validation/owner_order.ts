import { z } from 'zod';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const orderStatusEnum = z.enum([
  'pending',
  'preparing',
  'served',
  'completed',
  'cancelled',
], {
  errorMap: () => ({
    message: 'Status must be one of: pending, preparing, served, completed, cancelled',
  }),
});

export type OrderStatus = z.infer<typeof orderStatusEnum>;

export const paymentStatusFilterEnum = z.enum([
  'pending',
  'paid',
  'not_recorded',
], {
  errorMap: () => ({
    message: 'Payment status filter must be one of: pending, paid, not_recorded',
  }),
});

export type PaymentStatusFilter = z.infer<typeof paymentStatusFilterEnum>;

export const ownerOrdersQuerySchema = z
  .object({
    page: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 1))
      .pipe(z.number().int().min(1, 'Page must be at least 1')),
    limit: z
      .string()
      .optional()
      .transform((val) => (val ? parseInt(val, 10) : 20))
      .pipe(z.number().int().min(1, 'Limit must be at least 1').max(100, 'Limit cannot exceed 100')),
    branchId: z
      .string()
      .regex(uuidRegex, 'Invalid branchId: must be a valid UUID')
      .optional(),
    status: orderStatusEnum.optional(),
    paymentStatus: paymentStatusFilterEnum.optional(),
    dateFrom: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid dateFrom: must be a valid ISO date or timestamp',
      })
      .optional(),
    dateTo: z
      .string()
      .refine((val) => !val || !isNaN(Date.parse(val)), {
        message: 'Invalid dateTo: must be a valid ISO date or timestamp',
      })
      .optional(),
    search: z
      .string()
      .trim()
      .max(100, 'Search query cannot exceed 100 characters')
      .optional(),
  })
  .strict();

export type OwnerOrdersQueryInput = z.infer<typeof ownerOrdersQuerySchema>;

export const updateOrderStatusSchema = z
  .object({
    status: orderStatusEnum,
    notes: z
      .string()
      .trim()
      .max(500, 'Notes cannot exceed 500 characters')
      .nullable()
      .optional(),
    expectedCurrentStatus: orderStatusEnum.optional(),
  })
  .strict();

export type UpdateOrderStatusInput = z.infer<typeof updateOrderStatusSchema>;

/**
 * Validates whether a requested transition is valid according to the approved state machine.
 *
 * Allowed initial transitions:
 * - pending   -> preparing
 * - pending   -> cancelled
 * - preparing -> served
 * - preparing -> cancelled
 * - served    -> completed
 *
 * Terminal states (completed, cancelled) cannot transition to anything.
 * 'served -> cancelled' is forbidden without separate business authorization.
 */
export const ALLOWED_STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ['preparing', 'cancelled'],
  preparing: ['served', 'cancelled'],
  served: ['completed'],
  completed: [],
  cancelled: [],
};

export function isValidStatusTransition(
  currentStatus: string,
  targetStatus: string
): { isValid: boolean; reason?: string } {
  if (currentStatus === targetStatus) {
    return {
      isValid: false,
      reason: `Order is already in "${currentStatus}" status.`,
    };
  }

  const allowedTargets = ALLOWED_STATUS_TRANSITIONS[currentStatus];
  if (!allowedTargets) {
    return {
      isValid: false,
      reason: `Unknown or unhandled current status: "${currentStatus}".`,
    };
  }

  if (currentStatus === 'completed' || currentStatus === 'cancelled') {
    return {
      isValid: false,
      reason: `Cannot transition from terminal status "${currentStatus}".`,
    };
  }

  if (!allowedTargets.includes(targetStatus)) {
    if (currentStatus === 'served' && targetStatus === 'cancelled') {
      return {
        isValid: false,
        reason: 'Orders in "served" status cannot be cancelled without managerial override.',
      };
    }
    return {
      isValid: false,
      reason: `Invalid transition from "${currentStatus}" to "${targetStatus}". Allowed next statuses: [${allowedTargets.join(', ')}].`,
    };
  }

  return { isValid: true };
}
