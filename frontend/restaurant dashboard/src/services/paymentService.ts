import { apiClient } from './apiClient';

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'other';
export type PaymentRecordStatus = 'paid' | 'pending' | 'failed';

export interface SafePaymentRecord {
  id: string;
  orderId: string;
  amount: number;
  amountFormatted: string;
  paymentMethod: PaymentMethod;
  status: PaymentRecordStatus;
  transactionReference: string | null;
  paidAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface OrderPaymentsResponse {
  orderId: string;
  orderNumber: string;
  orderStatus: string;
  orderTotalAmount: number;
  orderTotalAmountFormatted: string;
  paymentStatus: 'pending' | 'paid' | 'not_recorded';
  payments: SafePaymentRecord[];
}

export interface RecordPaymentInput {
  paymentMethod: PaymentMethod;
  amount: number;
  transactionReference?: string | null;
}

export interface RecordPaymentResponse {
  payment: SafePaymentRecord;
  isReplay?: boolean;
}

export const paymentService = {
  getOrderPayments: async (orderId: string): Promise<OrderPaymentsResponse> => {
    return apiClient.get<OrderPaymentsResponse>(
      `/api/v1/owner/orders/${encodeURIComponent(orderId)}/payments`
    );
  },

  recordOrderPayment: async (
    orderId: string,
    data: RecordPaymentInput
  ): Promise<RecordPaymentResponse> => {
    return apiClient.post<RecordPaymentResponse>(
      `/api/v1/owner/orders/${encodeURIComponent(orderId)}/payments`,
      data
    );
  },
};
