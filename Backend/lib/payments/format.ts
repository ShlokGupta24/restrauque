import { SafePaymentRecord } from '@/types/payment';

/**
 * Formats a Prisma payment record into a sanitized, typed DTO.
 * Converts Decimal amounts to safe numbers and two-decimal formatted strings.
 */
export function formatPaymentRecord(p: any): SafePaymentRecord {
  const numericAmount = typeof p.amount === 'number' ? p.amount : Number(p.amount);
  return {
    id: p.id,
    orderId: p.order_id,
    amount: numericAmount,
    amountFormatted: numericAmount.toFixed(2),
    paymentMethod: p.payment_method,
    status: p.status,
    transactionReference: p.transaction_reference ?? null,
    paidAt: p.paid_at instanceof Date ? p.paid_at.toISOString() : p.paid_at ?? null,
    createdAt: p.created_at instanceof Date ? p.created_at.toISOString() : p.created_at,
    updatedAt: p.updated_at instanceof Date ? p.updated_at.toISOString() : p.updated_at,
  };
}
