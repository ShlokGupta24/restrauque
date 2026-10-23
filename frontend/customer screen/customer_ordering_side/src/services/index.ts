import { CustomerDataService } from './CustomerDataService';
import { MockDataService } from './mock/MockDataService';

/**
 * Purely standalone frontend data service using local static/stale data.
 * All external database connections and backend fetch calls have been removed.
 */
export const customerDataService: CustomerDataService = new MockDataService();

export { isValidUuid } from './orderPreviewService';
export * from './CustomerDataService';
export * from './contracts/types';
export * from './apiClient';
export * from './qrService';
export * from './authService';
export * from './menuService';
export * from './orderPreviewService';
export * from './orderService';
export * from './feedbackService';
export * from './loyaltyService';
