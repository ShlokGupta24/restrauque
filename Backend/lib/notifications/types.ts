export type NotificationChannel = 'sms' | 'email' | 'in_app' | 'push';
export type NotificationDeliveryStatus = 'unread' | 'read' | 'sent' | 'failed';

export interface NotificationRecordSummary {
  id: string;
  customerId: string | null;
  restaurantId: string | null;
  notificationType: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  channel: NotificationChannel;
  status: NotificationDeliveryStatus;
  sentAt: string | null;
  createdAt: string;
}

export interface SmsDispatchResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  isSimulated: boolean;
  error?: string;
}

export interface EmailDispatchResult {
  messageId: string;
  status: 'sent' | 'queued' | 'failed';
  isSimulated: boolean;
  error?: string;
}

export interface SmsNotificationProvider {
  readonly name: string;
  sendSms(to: string, message: string): Promise<SmsDispatchResult>;
}

export interface EmailNotificationProvider {
  readonly name: string;
  readonly isConfigured: boolean;
  sendEmail(to: string, subject: string, htmlContent: string, textContent: string): Promise<EmailDispatchResult>;
}

export interface OrderNotificationContext {
  orderId: string;
  orderNumber: string;
  restaurantId: string;
  restaurantName: string;
  customerId: string;
  customerName?: string | null;
  customerPhone: string;
  customerEmail?: string | null;
}

export type NotificationErrorClassification = 'permanent' | 'transient' | 'unknown';

export interface NotificationRecoveryResult {
  scannedCount: number;
  distinctOrdersCount: number;
  processedOrdersCount: number;
  processedCount: number;
  failedOrdersCount: number;
}

export interface NotificationQueueMetrics {
  pendingSmsCount: number;
  pendingEmailCount: number;
  failedSmsCount: number;
  failedEmailCount: number;
  unreadInAppCount: number;
}

export interface InAppNotificationSummary {
  id: string;
  title: string;
  message: string;
  referenceType: string | null;
  referenceId: string | null;
  status: 'unread' | 'read';
  createdAt: string;
}
