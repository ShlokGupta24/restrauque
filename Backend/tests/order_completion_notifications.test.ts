import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@/lib/db/prisma';
import {
  buildFeedbackUrl,
  buildOrderCompletionSmsMessage,
  buildOrderCompletionEmail,
  createOrderCompletionNotificationIntent,
  dispatchOrderCompletionNotifications,
  recoverPendingNotifications,
  sanitizeRedirectUrl,
  classifyNotificationError,
  getCustomerInAppNotifications,
  getStaffInAppNotifications,
  getNotificationQueueMetrics,
} from '@/lib/notifications/service';
import {
  setSmsNotificationProviderForTesting,
  maskPhoneNumber,
} from '@/lib/notifications/sms';
import {
  setEmailNotificationProviderForTesting,
  maskEmailAddress,
} from '@/lib/notifications/email';
import { getOrderFeedbackEligibility } from '@/lib/feedback/service';
import { ForbiddenError, NotFoundError } from '@/lib/http/errors';

// Mock Prisma
vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    $queryRaw: vi.fn(),
    notifications: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn(),
    },
    orders: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    order_status_history: {
      create: vi.fn(),
    },
    loyalty_programs: {
      findUnique: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 5 — Order Completion Notifications & Secure Feedback Redirection', () => {
  const mockOrderId = '44444444-4444-4444-8444-444444444444';
  const mockCustomerId = '11111111-1111-4111-8111-111111111111';
  const mockOtherCustomerId = '99999999-9999-4999-8999-999999999999';
  const mockRestaurantId = '22222222-2222-4222-8222-222222222222';
  const mockNotificationSmsId = 'notif-sms-001';
  const mockNotificationEmailId = 'notif-email-001';

  beforeEach(() => {
    vi.clearAllMocks();
    setSmsNotificationProviderForTesting(null);
    setEmailNotificationProviderForTesting(null);
  });

  // ==========================================
  // 1. Feedback Link Architecture & Security
  // ==========================================
  describe('1. Feedback Link Construction & Credential Security', () => {
    it('constructs a clean, canonical feedback URL pointing to /feedback/:orderId', () => {
      const url = buildFeedbackUrl(mockOrderId);
      expect(url).toContain(`/feedback/${mockOrderId}`);
      // Must not contain credentials or query tokens
      expect(url).not.toContain('jwt');
      expect(url).not.toContain('token');
      expect(url).not.toContain('otp');
      expect(url).not.toContain('session');
    });

    it('formats a concise branded SMS message with order feedback link', () => {
      const url = buildFeedbackUrl(mockOrderId);
      const sms = buildOrderCompletionSmsMessage('The Copper Chimney', url);
      expect(sms).toContain('The Copper Chimney');
      expect(sms).toContain('is complete');
      expect(sms).toContain(url);
      expect(sms).not.toContain('undefined');
    });

    it('formats a branded Email message with order number, greeting, and feedback CTA', () => {
      const url = buildFeedbackUrl(mockOrderId);
      const email = buildOrderCompletionEmail(
        'The Copper Chimney',
        'ORD-1024',
        'Rahul Sharma',
        url
      );
      expect(email.subject).toBe('Your The Copper Chimney order #ORD-1024 is complete');
      expect(email.text).toContain('Hi Rahul Sharma,');
      expect(email.text).toContain('ORD-1024');
      expect(email.text).toContain(url);
      expect(email.html).toContain(url);
    });

    it('masks phone numbers and email addresses in logging utilities to protect customer privacy', () => {
      expect(maskPhoneNumber('+919876543210')).toBe('+91*****3210');
      expect(maskPhoneNumber('123')).toBe('***');
      expect(maskEmailAddress('customer@example.com')).toBe('c***r@example.com');
      expect(maskEmailAddress('ab@test.com')).toBe('a***@test.com');
      expect(maskEmailAddress('invalid')).toBe('***');
    });
  });

  // ==========================================
  // 2. Notification Intent Creation & Idempotency
  // ==========================================
  describe('2. Durable Intent Creation & Duplicate Prevention', () => {
    it('creates separate durable SMS and Email notification intents when order completes', async () => {
      (prisma.notifications.findFirst as any).mockResolvedValue(null);
      (prisma.notifications.create as any)
        .mockResolvedValueOnce({
          id: mockNotificationSmsId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          notification_type: 'order_completed',
          title: 'Order Complete: The Copper Chimney',
          message: 'Your order at The Copper Chimney is complete...',
          reference_type: 'order',
          reference_id: mockOrderId,
          channel: 'sms',
          status: 'unread',
          sent_at: null,
          created_at: new Date(),
        })
        .mockResolvedValueOnce({
          id: mockNotificationEmailId,
          customer_id: mockCustomerId,
          restaurant_id: mockRestaurantId,
          notification_type: 'order_completed',
          title: 'Your The Copper Chimney order #ORD-1024 is complete',
          message: 'Your order is complete...',
          reference_type: 'order',
          reference_id: mockOrderId,
          channel: 'email',
          status: 'unread',
          sent_at: null,
          created_at: new Date(),
        });

      const intents = await createOrderCompletionNotificationIntent(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-1024',
        restaurantId: mockRestaurantId,
        restaurantName: 'The Copper Chimney',
        customerId: mockCustomerId,
        customerName: 'Rahul Sharma',
        customerPhone: '+919876543210',
        customerEmail: 'rahul@example.com',
      });

      expect(intents).toHaveLength(2);
      expect(intents[0].channel).toBe('sms');
      expect(intents[0].status).toBe('unread');
      expect(intents[1].channel).toBe('email');
      expect(intents[1].status).toBe('unread');
      expect(prisma.notifications.create).toHaveBeenCalledTimes(2);
    });

    it('prevents duplicate notification creation if intents already exist for the order', async () => {
      // Existing SMS and Email intents found
      (prisma.notifications.findFirst as any)
        .mockResolvedValueOnce({
          id: mockNotificationSmsId,
          channel: 'sms',
        })
        .mockResolvedValueOnce({
          id: mockNotificationEmailId,
          channel: 'email',
        });

      const intents = await createOrderCompletionNotificationIntent(prisma as any, {
        orderId: mockOrderId,
        orderNumber: 'ORD-1024',
        restaurantId: mockRestaurantId,
        restaurantName: 'The Copper Chimney',
        customerId: mockCustomerId,
        customerName: 'Rahul Sharma',
        customerPhone: '+919876543210',
        customerEmail: 'rahul@example.com',
      });

      expect(intents).toHaveLength(0);
      expect(prisma.notifications.create).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // 3. Provider Dispatch & Failure Isolation
  // ==========================================
  describe('3. Asynchronous Dispatch & Provider Isolation', () => {
    it('dispatches SMS via configured provider and marks notification as sent', async () => {
      const mockSendSms = vi.fn().mockResolvedValue({
        messageId: 'SM1234567890',
        status: 'sent',
        isSimulated: true,
      });

      setSmsNotificationProviderForTesting({
        name: 'test_sms_provider',
        sendSms: mockSendSms,
      });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: {
          id: mockCustomerId,
          name: 'Rahul Sharma',
          phone: '+919876543210',
        },
        restaurants: {
          id: mockRestaurantId,
          name: 'The Copper Chimney',
        },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        {
          id: mockNotificationSmsId,
          channel: 'sms',
          status: 'unread',
          message: 'Your order is complete...',
        },
      ]);

      (prisma.notifications.update as any).mockResolvedValue({
        id: mockNotificationSmsId,
        status: 'sent',
      });

      await dispatchOrderCompletionNotifications(mockOrderId);

      expect(mockSendSms).toHaveBeenCalledWith(
        '+919876543210',
        'Your order is complete...'
      );
      expect(prisma.notifications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationSmsId },
          data: expect.objectContaining({ status: 'sent' }),
        })
      );
    });

    it('marks notification as failed if provider rejects delivery, without throwing unhandled error', async () => {
      const mockSendSms = vi.fn().mockResolvedValue({
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: 'Carrier rejected destination phone number',
      });

      setSmsNotificationProviderForTesting({
        name: 'failing_sms_provider',
        sendSms: mockSendSms,
      });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: {
          id: mockCustomerId,
          name: 'Rahul Sharma',
          phone: '+919876543210',
        },
        restaurants: {
          id: mockRestaurantId,
          name: 'The Copper Chimney',
        },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        {
          id: mockNotificationSmsId,
          channel: 'sms',
          status: 'unread',
          message: 'Your order is complete...',
        },
      ]);

      (prisma.notifications.update as any).mockResolvedValue({
        id: mockNotificationSmsId,
        status: 'failed',
      });

      await dispatchOrderCompletionNotifications(mockOrderId);

      expect(prisma.notifications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationSmsId },
          data: expect.objectContaining({ status: 'failed' }),
        })
      );
    });

    it('tracks SMS and Email delivery statuses independently', async () => {
      const mockSendSms = vi.fn().mockResolvedValue({ messageId: 'SM1', status: 'sent', isSimulated: true });
      const mockSendEmail = vi.fn().mockResolvedValue({ messageId: '', status: 'failed', isSimulated: false, error: 'SMTP timeout' });

      setSmsNotificationProviderForTesting({ name: 'sms_prov', sendSms: mockSendSms });
      setEmailNotificationProviderForTesting({ name: 'email_prov', isConfigured: true, sendEmail: mockSendEmail });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: {
          id: mockCustomerId,
          name: 'Rahul Sharma',
          phone: '+919876543210',
          email: 'rahul@example.com',
        },
        restaurants: {
          id: mockRestaurantId,
          name: 'The Copper Chimney',
        },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        { id: mockNotificationSmsId, channel: 'sms', status: 'unread', message: 'SMS text' },
        { id: mockNotificationEmailId, channel: 'email', status: 'unread', message: 'Email text' },
      ]);

      await dispatchOrderCompletionNotifications(mockOrderId);

      expect(prisma.notifications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationSmsId },
          data: expect.objectContaining({ status: 'sent' }),
        })
      );
      expect(prisma.notifications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockNotificationEmailId },
          data: expect.objectContaining({ status: 'failed' }),
        })
      );
    });
  });

  // ==========================================
  // 4. Secure Feedback Authorization & Redirection
  // ==========================================
  describe('4. Secure Feedback Authorization & Redirection', () => {
    it('allows an authenticated customer to access feedback eligibility for their completed order', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-1024',
        status: 'completed',
        completed_at: new Date(),
        restaurants: { id: mockRestaurantId, name: 'The Copper Chimney' },
        restaurant_tables: { id: 'tbl-1', table_number: '12' },
        order_items: [],
        feedback: [],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: 'prog-1',
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        stars_per_visit: 5,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);
      expect(result.isEligible).toBe(true);
      expect(result.order.id).toBe(mockOrderId);
    });

    it('rejects access when customer attempts to open another customer order feedback link', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockOtherCustomerId, // Different customer
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-1024',
        status: 'completed',
      });

      await expect(
        getOrderFeedbackEligibility(mockOrderId, mockCustomerId)
      ).rejects.toThrow(ForbiddenError);
    });

    it('rejects feedback access for incomplete orders opened via direct link', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-1024',
        status: 'served', // Not completed
        restaurants: { id: mockRestaurantId, name: 'The Copper Chimney' },
        restaurant_tables: { id: 'tbl-1', table_number: '12' },
        order_items: [],
        feedback: [],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: 'prog-1',
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        stars_per_visit: 5,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);
      expect(result.isEligible).toBe(false);
      expect(result.reason).toContain('served');
    });

    it('correctly indicates already-submitted feedback state without re-awarding', async () => {
      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        customer_id: mockCustomerId,
        restaurant_id: mockRestaurantId,
        order_number: 'ORD-1024',
        status: 'completed',
        restaurants: { id: mockRestaurantId, name: 'The Copper Chimney' },
        restaurant_tables: null,
        order_items: [],
        feedback: [
          {
            id: 'fb-existing',
            rating: 5,
            comment: 'Loved the butter chicken',
            submitted_at: new Date(),
            feedback_aspects: [],
            feedback_products: [],
          },
        ],
      });

      (prisma.loyalty_programs.findUnique as any).mockResolvedValue({
        id: 'prog-1',
        restaurant_id: mockRestaurantId,
        name: 'Dining Rewards',
        is_active: true,
        stars_per_review: 10,
        stars_per_visit: 5,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await getOrderFeedbackEligibility(mockOrderId, mockCustomerId);
      expect(result.isEligible).toBe(false);
      expect(result.alreadySubmitted).toBe(true);
      expect(result.existingFeedback?.rating).toBe(5);
    });
  });

  // ==========================================
  // 5. Open Redirect Sanitization & URL Defense
  // ==========================================
  describe('5. Redirect Sanitation & Open Redirect Defense', () => {
    it('accepts safe internal relative paths', () => {
      expect(sanitizeRedirectUrl('/feedback/123')).toBe('/feedback/123');
      expect(sanitizeRedirectUrl('/menu')).toBe('/menu');
      expect(sanitizeRedirectUrl('/qr/token?view=cart')).toBe('/qr/token?view=cart');
    });

    it('rejects external absolute URLs and defaults to fallback', () => {
      expect(sanitizeRedirectUrl('https://evil.com/phishing')).toBe('/');
      expect(sanitizeRedirectUrl('http://attacker.com')).toBe('/');
      expect(sanitizeRedirectUrl('ftp://server.com')).toBe('/');
    });

    it('rejects protocol-relative and backslash obfuscations', () => {
      expect(sanitizeRedirectUrl('//evil.com/fake-login')).toBe('/');
      expect(sanitizeRedirectUrl('/\\evil.com')).toBe('/');
      expect(sanitizeRedirectUrl('javascript:alert(1)')).toBe('/');
      expect(sanitizeRedirectUrl(null)).toBe('/');
      expect(sanitizeRedirectUrl(undefined, '/menu')).toBe('/menu');
    });
  });

  // ==========================================
  // 6. Recovery Sweeper & Concurrent Deduplication
  // ==========================================
  describe('6. Recovery Sweeper & Concurrency Deduplication', () => {
    it('recovers and processes pending undispatched notifications for distinct orders', async () => {
      (prisma.notifications.findMany as any).mockResolvedValueOnce([
        { reference_id: 'order-1' },
        { reference_id: 'order-1' }, // Duplicate order in batch (e.g. SMS + email)
        { reference_id: 'order-2' },
      ]);

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: 'order-1',
        order_number: 'ORD-101',
        status: 'completed',
        customers: { id: mockCustomerId, phone: '+919876543210' },
        restaurants: { id: mockRestaurantId, name: 'Bistro' },
      });

      const res = await recoverPendingNotifications({ maxBatchSize: 10 });

      expect(res.scannedCount).toBe(3);
      // Deduplicated into distinct orders: order-1 and order-2
      expect(res.processedCount).toBe(2);
    });

    it('skips dispatching if notification was already transitioned to sent by another thread', async () => {
      const mockSendSms = vi.fn();
      setSmsNotificationProviderForTesting({
        name: 'test_provider',
        sendSms: mockSendSms,
      });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: { id: mockCustomerId, phone: '+919876543210' },
        restaurants: { id: mockRestaurantId, name: 'Bistro' },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        {
          id: 'notif-race-1',
          channel: 'sms',
          status: 'unread',
          message: 'Your order is complete...',
        },
      ]);

      // Fresh check in DB returns already 'sent' (e.g. from concurrent worker)
      (prisma.notifications.findUnique as any).mockResolvedValue({
        status: 'sent',
      });

      await dispatchOrderCompletionNotifications(mockOrderId);

      // Must NOT send SMS again!
      expect(mockSendSms).not.toHaveBeenCalled();
    });

    it('skips dispatching if another worker holds the active database lease', async () => {
      const mockSendSms = vi.fn();
      setSmsNotificationProviderForTesting({
        name: 'test_provider',
        sendSms: mockSendSms,
      });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: { id: mockCustomerId, phone: '+919876543210' },
        restaurants: { id: mockRestaurantId, name: 'Bistro' },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        {
          id: 'notif-leased-by-other-worker',
          channel: 'sms',
          status: 'unread',
          message: 'Your order is complete...',
        },
      ]);

      // Atomic updateMany claim returns count: 0 (leased by another worker)
      (prisma.notifications.updateMany as any).mockResolvedValueOnce({ count: 0 });

      await dispatchOrderCompletionNotifications(mockOrderId);

      // Must NOT send SMS because lease was not acquired!
      expect(mockSendSms).not.toHaveBeenCalled();
    });

    it('quarantines permanent failures with far-future sentinel timestamp to avoid infinite retry loops', async () => {
      const mockSendSms = vi.fn().mockResolvedValue({
        messageId: '',
        status: 'failed',
        isSimulated: false,
        error: '21211: Invalid To phone number', // Permanent error
      });

      setSmsNotificationProviderForTesting({
        name: 'twilio_test',
        sendSms: mockSendSms,
      });

      (prisma.orders.findUnique as any).mockResolvedValue({
        id: mockOrderId,
        order_number: 'ORD-1024',
        status: 'completed',
        customers: { id: mockCustomerId, phone: '+910000000000' },
        restaurants: { id: mockRestaurantId, name: 'Bistro' },
      });

      (prisma.notifications.findMany as any).mockResolvedValue([
        {
          id: 'notif-perm-fail',
          channel: 'sms',
          status: 'unread',
          message: 'Your order is complete...',
        },
      ]);

      (prisma.notifications.findUnique as any).mockResolvedValue({ status: 'unread' });
      (prisma.notifications.updateMany as any).mockResolvedValue({ count: 1 });
      (prisma.notifications.update as any).mockResolvedValue({ id: 'notif-perm-fail', status: 'failed' });

      await dispatchOrderCompletionNotifications(mockOrderId);

      expect(prisma.notifications.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'notif-perm-fail' },
          data: expect.objectContaining({
            status: 'failed',
            read_at: expect.any(Date),
          }),
        })
      );
    });
  });

  // =========================================================================
  // 7. Channel Isolation, AWS Recovery Hardening & Observability (Step 5.2)
  // =========================================================================
  describe('7. Channel Isolation, AWS Recovery Hardening & Observability', () => {
    it('customer in-app notification queries strictly filter channel = in_app', async () => {
      (prisma.notifications.findMany as any).mockResolvedValueOnce([
        {
          id: 'inapp-1',
          customer_id: mockCustomerId,
          channel: 'in_app',
          status: 'unread',
          title: 'Special Offer',
          message: 'Enjoy 10% off your next visit!',
          reference_type: 'coupon',
          reference_id: 'c-1',
          created_at: new Date('2026-10-17T00:00:00Z'),
        },
      ]);

      const notifications = await getCustomerInAppNotifications(mockCustomerId, {
        unreadOnly: true,
        limit: 10,
      });

      expect(prisma.notifications.findMany).toHaveBeenCalledWith({
        where: {
          customer_id: mockCustomerId,
          channel: 'in_app', // Mandatory channel filter prevents SMS/Email leakage
          status: 'unread',
        },
        orderBy: { created_at: 'desc' },
        take: 10,
      });

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toBe('Special Offer');
      expect(notifications[0].status).toBe('unread');
    });

    it('staff in-app notification queries strictly filter channel = in_app and tenant', async () => {
      const mockStaffId = '00000000-0000-0000-0000-000000000099';
      (prisma.notifications.findMany as any).mockResolvedValueOnce([]);

      await getStaffInAppNotifications(mockStaffId, mockRestaurantId, { unreadOnly: false });

      expect(prisma.notifications.findMany).toHaveBeenCalledWith({
        where: {
          staff_id: mockStaffId,
          restaurant_id: mockRestaurantId,
          channel: 'in_app', // Mandatory channel filter
        },
        orderBy: { created_at: 'desc' },
        take: 20,
      });
    });

    it('recovery sweeper strictly filters channels to SMS and Email, excluding in-app records', async () => {
      (prisma.notifications.findMany as any).mockResolvedValueOnce([]);

      await recoverPendingNotifications({ maxBatchSize: 25 });

      expect(prisma.notifications.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            channel: { in: ['sms', 'email'] }, // Channel isolation
            reference_type: 'order',
            notification_type: 'order_completed',
            status: { in: ['unread'] },
          }),
          take: 25,
        })
      );
    });

    it('recovery sweeper clamps batch size within safe bounds [1, 100]', async () => {
      (prisma.notifications.findMany as any).mockResolvedValue([]);

      // Over max (500) clamped to 100
      await recoverPendingNotifications({ maxBatchSize: 500 });
      expect(prisma.notifications.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 100 })
      );

      // Under min (-10) clamped to 1
      await recoverPendingNotifications({ maxBatchSize: -10 });
      expect(prisma.notifications.findMany).toHaveBeenLastCalledWith(
        expect.objectContaining({ take: 1 })
      );
    });

    it('recovery sweeper isolates order failure so one failing order does not block other orders in batch', async () => {
      (prisma.notifications.findMany as any).mockResolvedValueOnce([
        { reference_id: 'order-fail-1' },
        { reference_id: 'order-success-2' },
      ]);

      // Order 1 crashes during dispatch
      (prisma.orders.findUnique as any).mockImplementationOnce(() => {
        throw new Error('Database connection reset during order 1 query');
      });

      // Order 2 succeeds
      (prisma.orders.findUnique as any).mockResolvedValueOnce({
        id: 'order-success-2',
        order_number: 'ORD-200',
        status: 'completed',
        customers: { id: mockCustomerId, phone: '+919876543210' },
        restaurants: { id: mockRestaurantId, name: 'Bistro' },
      });

      const result = await recoverPendingNotifications();

      expect(result.scannedCount).toBe(2);
      expect(result.distinctOrdersCount).toBe(2);
      expect(result.processedOrdersCount).toBe(1);
      expect(result.failedOrdersCount).toBe(1);
    });

    it('classifies provider errors into permanent vs transient categories without leaking credentials or customer data', () => {
      // Permanent errors
      expect(classifyNotificationError('Error 21211: Invalid To phone number')).toBe('permanent');
      expect(classifyNotificationError('To number is not a valid mobile number (21614)')).toBe('permanent');
      expect(classifyNotificationError('Recipient has unsubscribed (21610)')).toBe('permanent');
      expect(classifyNotificationError('Geo permission not enabled for region (21408)')).toBe('permanent');

      // Transient errors
      expect(classifyNotificationError('Connection ETIMEDOUT to api.twilio.com')).toBe('transient');
      expect(classifyNotificationError('HTTP 504 Gateway Timeout from upstream mailer')).toBe('transient');
      expect(classifyNotificationError('HTTP 429 Too Many Requests: Rate limit exceeded')).toBe('transient');
      expect(classifyNotificationError('Internal Server Error 500')).toBe('transient');

      // Unknown errors
      expect(classifyNotificationError('Something unusual happened')).toBe('unknown');
      expect(classifyNotificationError(null)).toBe('unknown');
      expect(classifyNotificationError(undefined)).toBe('unknown');
    });

    it('aggregates non-sensitive backlog counts for monitoring/alerting', async () => {
      (prisma.notifications.count as any)
        .mockResolvedValueOnce(5)  // pending SMS
        .mockResolvedValueOnce(2)  // pending Email
        .mockResolvedValueOnce(1)  // failed SMS
        .mockResolvedValueOnce(0)  // failed Email
        .mockResolvedValueOnce(12); // unread in-app

      const metrics = await getNotificationQueueMetrics();

      expect(metrics).toEqual({
        pendingSmsCount: 5,
        pendingEmailCount: 2,
        failedSmsCount: 1,
        failedEmailCount: 0,
        unreadInAppCount: 12,
      });

      expect(prisma.notifications.count).toHaveBeenCalledTimes(5);
    });
  });
});

