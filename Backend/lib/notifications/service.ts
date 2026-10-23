import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import {
  OrderNotificationContext,
  NotificationRecordSummary,
  NotificationErrorClassification,
  NotificationRecoveryResult,
  NotificationQueueMetrics,
  InAppNotificationSummary,
} from './types';
import { getActiveSmsNotificationProvider, maskPhoneNumber } from './sms';
import { getActiveEmailNotificationProvider, maskEmailAddress } from './email';

/**
 * In-process lock tracker to serialize concurrent dispatch attempts for identical notification IDs.
 * Used as a fast in-process optimization alongside the database-backed distributed lease.
 */
const inFlightNotificationLocks = new Set<string>();

/**
 * Lease duration for durable database-backed notification locking across multiple AWS instances.
 * If a worker crashes midway through provider communication, the lease automatically expires
 * after this window, making the notification eligible for recovery by another worker.
 */
export const NOTIFICATION_LEASE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Backoff duration before a failed notification with a transient error becomes eligible for retry.
 */
export const NOTIFICATION_TRANSIENT_BACKOFF_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Sentinel timestamp assigned to permanent failures to prevent infinite retry loops in recovery sweeper.
 */
export const PERMANENT_FAILURE_DATE = new Date('2099-01-01T00:00:00.000Z');

/**
 * Atomically acquires a durable lease on a notification record in PostgreSQL.
 * Coordinates across multiple concurrent application instances/workers.
 * Uses `read_at` as the lease expiration timestamp for SMS/Email notifications
 * (which don't have user read receipts, unlike in-app notifications).
 */
export async function claimNotificationLease(
  notificationId: string,
  options?: { allowRetryFailed?: boolean }
): Promise<{ acquired: boolean; leaseUntil: Date }> {
  const now = new Date();
  const leaseUntil = new Date(now.getTime() + NOTIFICATION_LEASE_MS);
  const eligibleStatuses = options?.allowRetryFailed ? ['unread', 'failed'] : ['unread'];

  if (typeof (prisma.notifications as any).updateMany === 'function') {
    const res = await prisma.notifications.updateMany({
      where: {
        id: notificationId,
        channel: { in: ['sms', 'email'] },
        status: { in: eligibleStatuses },
        OR: [
          { read_at: null },
          { read_at: { lt: now } }, // Stale lease expired or backoff elapsed
        ],
      },
      data: {
        status: 'unread',
        read_at: leaseUntil,
      },
    });
    return { acquired: res.count > 0, leaseUntil };
  }

  // Fallback for mock environments
  return { acquired: true, leaseUntil };
}

/**
 * Resolves the public application base URL for customer feedback links.
 */
export function getPublicAppUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (envUrl) {
    return envUrl.replace(/\/+$/, '');
  }
  return 'http://localhost:3000';
}

/**
 * Validates and sanitizes internal redirect URLs to prevent Open Redirect attacks.
 * Rejects external URLs, protocol-relative URLs (//evil.com), backslash tricks, and javascript: URIs.
 */
export function sanitizeRedirectUrl(targetUrl?: string | null, fallbackUrl = '/'): string {
  if (!targetUrl || typeof targetUrl !== 'string') return fallbackUrl;
  const trimmed = targetUrl.trim();
  // Must begin with a single slash, not double slash, and must not contain backslashes or schemes
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.includes('\\') || trimmed.includes('://')) {
    return fallbackUrl;
  }
  return trimmed;
}

/**
 * Builds the secure, canonical customer feedback link for an order.
 * Strictly avoids sensitive tokens, OTPs, or session secrets in the query string.
 */
export function buildFeedbackUrl(orderId: string): string {
  const baseUrl = getPublicAppUrl();
  return `${baseUrl}/feedback/${orderId}`;
}

/**
 * Generates branded SMS notification text for completed orders.
 */
export function buildOrderCompletionSmsMessage(restaurantName: string, feedbackUrl: string): string {
  return `Your order at ${restaurantName} is complete. Share your feedback and earn eligible loyalty stars: ${feedbackUrl}`;
}

/**
 * Generates branded Email notification subject and content for completed orders.
 */
export function buildOrderCompletionEmail(
  restaurantName: string,
  orderNumber: string,
  customerName: string | null | undefined,
  feedbackUrl: string
): { subject: string; html: string; text: string } {
  const subject = `Your ${restaurantName} order #${orderNumber} is complete`;
  const greeting = customerName?.trim() ? `Hi ${customerName.trim()},` : 'Hello,';

  const text = `${greeting}\n\nYour order #${orderNumber} at ${restaurantName} is now complete.\n\nWe would love to hear about your dining experience! Share your feedback and earn eligible loyalty rewards at:\n${feedbackUrl}\n\nThank you for dining with us!`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background-color: #fbf9f5;">
      <div style="background-color: #ffffff; border: 1px solid #e8e4dc; border-radius: 16px; padding: 32px 24px; box-shadow: 0 2px 8px rgba(0,0,0,0.04);">
        <h1 style="color: #173f70; font-size: 20px; font-weight: 800; margin-top: 0;">${restaurantName}</h1>
        <p style="font-size: 15px; line-height: 1.5; color: #334155;">${greeting}</p>
        <p style="font-size: 15px; line-height: 1.5; color: #334155;">
          Your order <strong>#${orderNumber}</strong> has been marked as <strong>Completed</strong>. We hope you enjoyed your meal!
        </p>
        <div style="margin: 28px 0; text-align: center;">
          <a href="${feedbackUrl}" style="background-color: #173f70; color: #ffffff; text-decoration: none; font-size: 15px; font-weight: 700; padding: 14px 28px; border-radius: 12px; display: inline-block;">
            Share Feedback & Earn Stars
          </a>
        </div>
        <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
          * Eligible loyalty stars are automatically credited to your restaurant account upon verified feedback submission according to ${restaurantName}'s active reward rules.
        </p>
      </div>
    </div>
  `;

  return { subject, html, text };
}

/**
 * Creates durable notification intent records inside the order completion transaction.
 * Idempotent: checks if notification intent records for this order already exist.
 */
export async function createOrderCompletionNotificationIntent(
  tx: Prisma.TransactionClient,
  context: OrderNotificationContext
): Promise<NotificationRecordSummary[]> {
  const feedbackUrl = buildFeedbackUrl(context.orderId);
  const smsBody = buildOrderCompletionSmsMessage(context.restaurantName, feedbackUrl);
  const emailContent = buildOrderCompletionEmail(
    context.restaurantName,
    context.orderNumber,
    context.customerName,
    feedbackUrl
  );

  const results: NotificationRecordSummary[] = [];

  // 1. SMS Notification Intent
  if (context.customerPhone) {
    const existingSms = await tx.notifications.findFirst({
      where: {
        reference_type: 'order',
        reference_id: context.orderId,
        notification_type: 'order_completed',
        channel: 'sms',
      },
    });

    if (!existingSms) {
      const createdSms = await tx.notifications.create({
        data: {
          customer_id: context.customerId,
          restaurant_id: context.restaurantId,
          notification_type: 'order_completed',
          title: `Order Complete: ${context.restaurantName}`,
          message: smsBody,
          reference_type: 'order',
          reference_id: context.orderId,
          channel: 'sms',
          status: 'unread', // Queued for dispatch
        },
      });

      results.push({
        id: createdSms.id,
        customerId: createdSms.customer_id,
        restaurantId: createdSms.restaurant_id,
        notificationType: createdSms.notification_type,
        title: createdSms.title,
        message: createdSms.message,
        referenceType: createdSms.reference_type,
        referenceId: createdSms.reference_id,
        channel: createdSms.channel as any,
        status: createdSms.status as any,
        sentAt: createdSms.sent_at ? createdSms.sent_at.toISOString() : null,
        createdAt: createdSms.created_at.toISOString(),
      });
    }
  }

  // 2. Email Notification Intent (if customer email is available)
  if (context.customerEmail) {
    const existingEmail = await tx.notifications.findFirst({
      where: {
        reference_type: 'order',
        reference_id: context.orderId,
        notification_type: 'order_completed',
        channel: 'email',
      },
    });

    if (!existingEmail) {
      const createdEmail = await tx.notifications.create({
        data: {
          customer_id: context.customerId,
          restaurant_id: context.restaurantId,
          notification_type: 'order_completed',
          title: emailContent.subject,
          message: emailContent.text,
          reference_type: 'order',
          reference_id: context.orderId,
          channel: 'email',
          status: 'unread', // Queued for dispatch
        },
      });

      results.push({
        id: createdEmail.id,
        customerId: createdEmail.customer_id,
        restaurantId: createdEmail.restaurant_id,
        notificationType: createdEmail.notification_type,
        title: createdEmail.title,
        message: createdEmail.message,
        referenceType: createdEmail.reference_type,
        referenceId: createdEmail.reference_id,
        channel: createdEmail.channel as any,
        status: createdEmail.status as any,
        sentAt: createdEmail.sent_at ? createdEmail.sent_at.toISOString() : null,
        createdAt: createdEmail.created_at.toISOString(),
      });
    }
  }

  return results;
}

/**
 * Dispatches pending order completion notifications.
 * Runs strictly AFTER transaction commit so provider outages never roll back or delay order completion.
 * Hardened with:
 * - In-flight claim lock to avoid dual dispatch under concurrent executions
 * - Pre-send state validation to verify the notification was not already marked 'sent'
 * - Independent status updates per channel
 */
export async function dispatchOrderCompletionNotifications(
  orderId: string,
  options?: { allowRetryFailed?: boolean }
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // 1. Retrieve order and customer details
    const order = await prisma.orders.findUnique({
      where: { id: orderId },
      include: {
        customers: {
          select: { id: true, name: true, phone: true },
        },
        restaurants: {
          select: { id: true, name: true },
        },
      },
    });

    if (!order || order.status !== 'completed' || !order.customers) {
      return { success: true };
    }

    // 2. Fetch queued notifications for this order (strictly SMS and Email channels)
    const targetStatuses = options?.allowRetryFailed ? ['unread', 'failed'] : ['unread'];
    const pendingNotifications = await prisma.notifications.findMany({
      where: {
        reference_type: 'order',
        reference_id: orderId,
        notification_type: 'order_completed',
        channel: { in: ['sms', 'email'] }, // Channel isolation: order completion notifications are SMS/Email only
        status: { in: targetStatuses },
      },
    });

    if (pendingNotifications.length === 0) {
      return { success: true };
    }

    const feedbackUrl = buildFeedbackUrl(orderId);
    const smsProvider = getActiveSmsNotificationProvider();
    const emailProvider = getActiveEmailNotificationProvider();

    for (const notification of pendingNotifications) {
      // In-flight concurrency claiming: skip if another worker in this process is currently dispatching
      if (inFlightNotificationLocks.has(notification.id)) {
        continue;
      }

      inFlightNotificationLocks.add(notification.id);

      try {
        // Durable database-backed lease acquisition across all distributed workers
        const claim = await claimNotificationLease(notification.id, {
          allowRetryFailed: options?.allowRetryFailed,
        });
        if (!claim.acquired) {
          continue; // Active lease held by another worker or already finalized
        }

        // Pre-check: verify notification has not been marked as 'sent' by another thread or process
        const freshNotification = await prisma.notifications.findUnique({
          where: { id: notification.id },
          select: { status: true },
        });

        if (freshNotification?.status === 'sent') {
          continue; // Already successfully dispatched
        }

        if (notification.channel === 'sms' && order.customers.phone) {
          try {
            const smsResult = await smsProvider.sendSms(order.customers.phone, notification.message);

            if (smsResult.status === 'sent' || smsResult.status === 'queued') {
              await prisma.notifications.update({
                where: { id: notification.id },
                data: {
                  status: 'sent',
                  sent_at: new Date(),
                  read_at: null,
                },
              });
              console.log(
                `[COMPLETION_SMS_SUCCESS] Order #${order.order_number} notification dispatched to ${maskPhoneNumber(order.customers.phone)}`
              );
            } else {
              const classification = classifyNotificationError(smsResult.error);
              const nextRetryAt = classification === 'permanent'
                ? PERMANENT_FAILURE_DATE
                : new Date(Date.now() + NOTIFICATION_TRANSIENT_BACKOFF_MS);
              await prisma.notifications.update({
                where: { id: notification.id },
                data: {
                  status: 'failed',
                  read_at: nextRetryAt,
                },
              });
              console.warn(
                `[COMPLETION_SMS_FAILED] [${classification.toUpperCase()}] SMS dispatch failed for order #${order.order_number}: ${smsResult.error || 'Unknown error'}`
              );
            }
          } catch (smsErr: unknown) {
            const errMessage = smsErr instanceof Error ? smsErr.message : 'Unknown error';
            const classification = classifyNotificationError(errMessage);
            const nextRetryAt = classification === 'permanent'
              ? PERMANENT_FAILURE_DATE
              : new Date(Date.now() + NOTIFICATION_TRANSIENT_BACKOFF_MS);
            await prisma.notifications.update({
              where: { id: notification.id },
              data: {
                status: 'failed',
                read_at: nextRetryAt,
              },
            });
            console.error(
              `[COMPLETION_SMS_EXCEPTION] [${classification.toUpperCase()}] Failed to dispatch SMS for order #${order.order_number}:`,
              errMessage
            );
          }
        } else if (notification.channel === 'email') {
          const customerEmail = (order.customers as any).email;
          if (customerEmail) {
            try {
              const emailContent = buildOrderCompletionEmail(
                order.restaurants.name,
                order.order_number,
                order.customers.name,
                feedbackUrl
              );

              const emailResult = await emailProvider.sendEmail(
                customerEmail,
                emailContent.subject,
                emailContent.html,
                emailContent.text
              );

              if (emailResult.status === 'sent') {
                await prisma.notifications.update({
                  where: { id: notification.id },
                  data: {
                    status: 'sent',
                    sent_at: new Date(),
                    read_at: null,
                  },
                });
                console.log(
                  `[COMPLETION_EMAIL_SUCCESS] Order #${order.order_number} email dispatched to ${maskEmailAddress(customerEmail)}`
                );
              } else {
                const classification = classifyNotificationError(emailResult.error);
                const nextRetryAt = classification === 'permanent'
                  ? PERMANENT_FAILURE_DATE
                  : new Date(Date.now() + NOTIFICATION_TRANSIENT_BACKOFF_MS);
                await prisma.notifications.update({
                  where: { id: notification.id },
                  data: {
                    status: 'failed',
                    read_at: nextRetryAt,
                  },
                });
                console.warn(
                  `[COMPLETION_EMAIL_FAILED] [${classification.toUpperCase()}] Email dispatch failed for order #${order.order_number}: ${emailResult.error || 'Unknown error'}`
                );
              }
            } catch (emailErr: unknown) {
              const errMessage = emailErr instanceof Error ? emailErr.message : 'Unknown error';
              const classification = classifyNotificationError(errMessage);
              const nextRetryAt = classification === 'permanent'
                ? PERMANENT_FAILURE_DATE
                : new Date(Date.now() + NOTIFICATION_TRANSIENT_BACKOFF_MS);
              await prisma.notifications.update({
                where: { id: notification.id },
                data: {
                  status: 'failed',
                  read_at: nextRetryAt,
                },
              });
              console.error(
                `[COMPLETION_EMAIL_EXCEPTION] [${classification.toUpperCase()}] Failed to dispatch email for order #${order.order_number}:`,
                errMessage
              );
            }
          }
        }
      } finally {
        inFlightNotificationLocks.delete(notification.id);
      }
    }
    return { success: true };
  } catch (error: unknown) {
    const errMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(
      `[NOTIFICATION_DISPATCH_ORCHESTRATION_ERROR] Failed during notification dispatch for order ${orderId}:`,
      errMessage
    );
    return { success: false, error: errMessage };
  }
}

/**
 * Classifies provider errors into permanent vs transient categories without leaking credentials or customer PII.
 */
export function classifyNotificationError(errorMessage?: string | null): NotificationErrorClassification {
  if (!errorMessage) return 'unknown';
  const msg = errorMessage.toLowerCase();

  // Permanent recipient or configuration errors
  if (
    msg.includes('invalid') ||
    msg.includes('unsubscribed') ||
    msg.includes('blacklist') ||
    msg.includes('not a valid mobile') ||
    msg.includes('geo permission') ||
    msg.includes('21211') || // Twilio: Invalid 'To' phone number
    msg.includes('21614') || // Twilio: To number is not a valid mobile number
    msg.includes('21610') || // Twilio: Attempt to send to unsubscribed recipient
    msg.includes('21408')    // Twilio: Permission to send an SMS not enabled for region
  ) {
    return 'permanent';
  }

  // Transient network, rate limit, or provider-side temporary issues
  if (
    msg.includes('timeout') ||
    msg.includes('etimedout') ||
    msg.includes('econnreset') ||
    msg.includes('too many requests') ||
    msg.includes('rate limit') ||
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('gateway')
  ) {
    return 'transient';
  }

  return 'unknown';
}

/**
 * Sweeper/Recovery function to discover and safely retry undispatched or failed notifications.
 * Can be invoked by scheduled workers or administrative recovery procedures.
 *
 * Coordinates across multiple concurrent application instances/workers using durable database-backed leases.
 */
export async function recoverPendingNotifications(options?: {
  maxBatchSize?: number;
  retryFailed?: boolean;
}): Promise<NotificationRecoveryResult> {
  const now = new Date();
  const maxBatch = Math.min(Math.max(options?.maxBatchSize || 50, 1), 100);
  const targetStatuses = options?.retryFailed ? ['unread', 'failed'] : ['unread'];

  // Channel isolation: only recover SMS and email completion records, never in_app notifications.
  // Lease & Backoff filtering: only pick records where read_at is null OR read_at < now (stale lease expired).
  const pending = await prisma.notifications.findMany({
    where: {
      reference_type: 'order',
      notification_type: 'order_completed',
      channel: { in: ['sms', 'email'] },
      status: { in: targetStatuses },
      OR: [
        { read_at: null },
        { read_at: { lt: now } },
      ],
    },
    take: maxBatch,
    orderBy: { created_at: 'asc' },
    select: { reference_id: true },
  });

  const distinctOrderIds = Array.from(
    new Set(pending.map((p) => p.reference_id).filter(Boolean) as string[])
  );

  let processedCount = 0;
  let failedCount = 0;

  for (const orderId of distinctOrderIds) {
    try {
      const outcome = await dispatchOrderCompletionNotifications(orderId, {
        allowRetryFailed: options?.retryFailed,
      });
      if (outcome && outcome.success === false) {
        failedCount++;
      } else {
        processedCount++;
      }
    } catch (orderErr: unknown) {
      failedCount++;
      console.error(
        `[RECOVERY_ORDER_DISPATCH_ERROR] Processing failed for order ${orderId}:`,
        orderErr instanceof Error ? orderErr.message : 'Unknown error'
      );
    }
  }

  return {
    scannedCount: pending.length,
    distinctOrdersCount: distinctOrderIds.length,
    processedOrdersCount: processedCount,
    processedCount: processedCount,
    failedOrdersCount: failedCount,
  };
}

/**
 * Retrieves in-app notifications for a customer, strictly enforcing channel = 'in_app'
 * to prevent SMS or Email dispatch records from leaking into the user's notification feed.
 */
export async function getCustomerInAppNotifications(
  customerId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<InAppNotificationSummary[]> {
  const limit = Math.min(Math.max(options?.limit || 20, 1), 50);
  const rows = await prisma.notifications.findMany({
    where: {
      customer_id: customerId,
      channel: 'in_app', // Strict isolation: only in-app notifications
      ...(options?.unreadOnly ? { status: 'unread' } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    referenceType: r.reference_type,
    referenceId: r.reference_id,
    status: (r.status === 'read' ? 'read' : 'unread') as 'unread' | 'read',
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * Retrieves in-app notifications for restaurant staff, strictly enforcing channel = 'in_app'
 * and staff/restaurant tenant scoping.
 */
export async function getStaffInAppNotifications(
  staffId: string,
  restaurantId: string,
  options?: { unreadOnly?: boolean; limit?: number }
): Promise<InAppNotificationSummary[]> {
  const limit = Math.min(Math.max(options?.limit || 20, 1), 50);
  const rows = await prisma.notifications.findMany({
    where: {
      staff_id: staffId,
      restaurant_id: restaurantId,
      channel: 'in_app', // Strict isolation: only in-app notifications
      ...(options?.unreadOnly ? { status: 'unread' } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: limit,
  });

  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    message: r.message,
    referenceType: r.reference_type,
    referenceId: r.reference_id,
    status: (r.status === 'read' ? 'read' : 'unread') as 'unread' | 'read',
    createdAt: r.created_at.toISOString(),
  }));
}

/**
 * Aggregates non-sensitive backlog counts for monitoring/alerting.
 */
export async function getNotificationQueueMetrics(): Promise<NotificationQueueMetrics> {
  const [pendingSms, pendingEmail, failedSms, failedEmail, unreadInApp] = await Promise.all([
    prisma.notifications.count({
      where: { channel: 'sms', status: 'unread' },
    }),
    prisma.notifications.count({
      where: { channel: 'email', status: 'unread' },
    }),
    prisma.notifications.count({
      where: { channel: 'sms', status: 'failed' },
    }),
    prisma.notifications.count({
      where: { channel: 'email', status: 'failed' },
    }),
    prisma.notifications.count({
      where: { channel: 'in_app', status: 'unread' },
    }),
  ]);

  return {
    pendingSmsCount: pendingSms,
    pendingEmailCount: pendingEmail,
    failedSmsCount: failedSms,
    failedEmailCount: failedEmail,
    unreadInAppCount: unreadInApp,
  };
}
