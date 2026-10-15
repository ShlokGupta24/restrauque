import { z } from 'zod';

const decimalPrecisionRefine = (val: number | null | undefined) => {
  if (val === null || val === undefined) return true;
  const str = val.toString();
  const parts = str.split('.');
  return parts.length === 1 || parts[1].length <= 2;
};

export const paymentMethodEnum = z.enum(['cash', 'upi', 'card', 'other'], {
  errorMap: () => ({
    message: 'Payment method must be one of: cash, upi, card, other',
  }),
});

export type PaymentMethod = z.infer<typeof paymentMethodEnum>;

export const createPaymentSchema = z
  .object({
    paymentMethod: paymentMethodEnum,
    amount: z
      .number({ required_error: 'Amount is required' })
      .positive('Amount must be a positive number')
      .max(99999999.99, 'Amount exceeds maximum supported limit')
      .refine(decimalPrecisionRefine, {
        message: 'Amount cannot have more than 2 decimal places',
      }),
    transactionReference: z
      .string()
      .trim()
      .max(150, 'Transaction reference cannot exceed 150 characters')
      .nullable()
      .optional()
      .transform((val) => (val === '' ? null : val ?? null)),
  })
  .strict();

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
