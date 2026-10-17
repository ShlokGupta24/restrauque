import { CustomerDataService } from './CustomerDataService';
import { MockDataService } from './mock/MockDataService';

/**
 * Purely standalone frontend data service using local static/stale data.
 * All external database connections and backend fetch calls have been removed.
 */
export const customerDataService: CustomerDataService = new MockDataService();

export * from './CustomerDataService';
export * from './contracts/types';
