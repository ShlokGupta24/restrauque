import { describe, it, expect } from 'vitest';
import {
  createPaymentSchema,
  paymentMethodEnum,
} from '@/lib/validation/payment';
import { formatPaymentRecord } from '@/lib/payments/format';
import {
  formatOwnerOrderPaymentSummary,
  formatOwnerOrderPaymentDetail,
} from '@/lib/orders/owner_format';
import { Prisma } from '@prisma/client';

describe('STEP 10B: Owner Payments Validation & Formatting Tests', () => {
  describe('createPaymentSchema', () => {
    it('should accept valid payment input for all supported payment methods', () => {
      for (const method of ['cash', 'upi', 'card', 'other']) {
        const parsed = createPaymentSchema.parse({
          paymentMethod: method,
          amount: 250.5,
          transactionReference: 'REF-12345',
        });
        expect(parsed.paymentMethod).toBe(method);
        expect(parsed.amount).toBe(250.5);
        expect(parsed.transactionReference).toBe('REF-12345');
      }
    });

    it('should accept payment without transactionReference and transform empty string to null', () => {
      const parsedWithout = createPaymentSchema.parse({
        paymentMethod: 'cash',
        amount: 100,
      });
      expect(parsedWithout.transactionReference).toBeNull();

      const parsedEmptyStr = createPaymentSchema.parse({
        paymentMethod: 'cash',
        amount: 100,
        transactionReference: '   ',
      });
      expect(parsedEmptyStr.transactionReference).toBeNull();
    });

    it('should trim transactionReference', () => {
      const parsed = createPaymentSchema.parse({
        paymentMethod: 'upi',
        amount: 500,
        transactionReference: '   UPI-REF-999   ',
      });
      expect(parsed.transactionReference).toBe('UPI-REF-999');
    });

    it('should reject invalid payment methods', () => {
      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'bitcoin',
          amount: 100,
        })
      ).toThrow(/Payment method must be one of: cash, upi, card, other/);

      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'crypto',
          amount: 100,
        })
      ).toThrow();
    });

    it('should reject zero or negative amounts', () => {
      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 0,
        })
      ).toThrow(/Amount must be a positive number/);

      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: -50,
        })
      ).toThrow(/Amount must be a positive number/);
    });

    it('should reject amounts with more than two decimal places', () => {
      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 99.999,
        })
      ).toThrow(/Amount cannot have more than 2 decimal places/);
    });

    it('should reject transactionReference exceeding 150 characters', () => {
      const longRef = 'A'.repeat(151);
      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'upi',
          amount: 100,
          transactionReference: longRef,
        })
      ).toThrow(/Transaction reference cannot exceed 150 characters/);
    });

    it('should reject unexpected server-managed fields via strict schema', () => {
      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 100,
          id: '11111111-1111-1111-1111-111111111111',
        })
      ).toThrow();

      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 100,
          order_id: '11111111-1111-1111-1111-111111111111',
        })
      ).toThrow();

      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 100,
          status: 'paid',
        })
      ).toThrow();

      expect(() =>
        createPaymentSchema.parse({
          paymentMethod: 'cash',
          amount: 100,
          paid_at: new Date().toISOString(),
        })
      ).toThrow();
    });
  });

  describe('formatPaymentRecord', () => {
    it('should format payment record with numbers and 2-decimal strings', () => {
      const rawPayment = {
        id: '11111111-1111-1111-1111-111111111111',
        order_id: '22222222-2222-2222-2222-222222222222',
        amount: new Prisma.Decimal('450.50'),
        payment_method: 'upi',
        status: 'paid',
        transaction_reference: 'UPI/123456',
        paid_at: new Date('2026-10-12T02:00:00.000Z'),
        created_at: new Date('2026-10-12T02:00:00.000Z'),
        updated_at: new Date('2026-10-12T02:00:00.000Z'),
      };

      const formatted = formatPaymentRecord(rawPayment);
      expect(formatted.id).toBe(rawPayment.id);
      expect(formatted.orderId).toBe(rawPayment.order_id);
      expect(formatted.amount).toBe(450.5);
      expect(formatted.amountFormatted).toBe('450.50');
      expect(formatted.paymentMethod).toBe('upi');
      expect(formatted.status).toBe('paid');
      expect(formatted.transactionReference).toBe('UPI/123456');
      expect(formatted.paidAt).toBe('2026-10-12T02:00:00.000Z');
    });
  });

  describe('formatOwnerOrderPaymentSummary & formatOwnerOrderPaymentDetail Priority', () => {
    it('should prioritize paid payment over pending payment when multiple payment rows exist', () => {
      const mockPayments = [
        {
          id: 'pay-pending',
          status: 'pending',
          amount: new Prisma.Decimal('200.00'),
          payment_method: 'upi',
          transaction_reference: null,
          paid_at: null,
        },
        {
          id: 'pay-paid',
          status: 'paid',
          amount: new Prisma.Decimal('200.00'),
          payment_method: 'cash',
          transaction_reference: 'CASH-001',
          paid_at: new Date('2026-10-12T02:05:00.000Z'),
        },
      ];

      const summary = formatOwnerOrderPaymentSummary(mockPayments);
      expect(summary.status).toBe('paid');
      expect(summary.paymentMethod).toBe('cash');
      expect(summary.amount).toBe(200);

      const detail = formatOwnerOrderPaymentDetail(mockPayments);
      expect(detail.id).toBe('pay-paid');
      expect(detail.status).toBe('paid');
      expect(detail.paymentMethod).toBe('cash');
      expect(detail.transactionReference).toBe('CASH-001');
    });

    it('should return not_recorded when payments array is empty', () => {
      const summary = formatOwnerOrderPaymentSummary([]);
      expect(summary.status).toBe('not_recorded');
      expect(summary.paymentMethod).toBeNull();
      expect(summary.amount).toBeNull();

      const detail = formatOwnerOrderPaymentDetail([]);
      expect(detail.status).toBe('not_recorded');
      expect(detail.id).toBeNull();
    });
  });
});
