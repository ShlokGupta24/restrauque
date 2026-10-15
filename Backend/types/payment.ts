export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'not_recorded';

export interface SafePaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  amountFormatted: string;
  paymentMethod: string;
  status: string;
  transactionReference: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerOrderPaymentsListResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderTotalAmount: number;
  orderTotalAmountFormatted: string;
  paymentStatus: 'pending' | 'paid' | 'not_recorded';
  payments: SafePaymentRecord[];
}
