import {
  RestaurantPublicInfo,
  Category,
  Product,
  CartItem,
  BillBreakdown,
  OrderConfirmationDetails,
  FeedbackSubmission,
} from './contracts/types';

export interface CustomerDataService {
  resolveQrContext(qrToken: string): Promise<RestaurantPublicInfo>;
  getCategories(): Promise<Category[]>;
  getProducts(categoryId?: string): Promise<Product[]>;
  getProductById(productId: string): Promise<Product | null>;
  calculateBill(items: CartItem[], couponCode?: string): Promise<BillBreakdown>;
  requestOtp(phone: string): Promise<{ success: boolean; message: string; expiresInSeconds?: number }>;
  verifyOtp(phone: string, otpCode: string): Promise<{ success: boolean; user?: { phone: string; name?: string } }>;
  checkAuthSession(): Promise<{ isAuthenticated: boolean; phone?: string; customerName?: string }>;
  logout(): Promise<{ success: boolean }>;
  createOrder(data: {
    items: CartItem[];
    paymentMethod: string;
    notes?: string;
  }): Promise<OrderConfirmationDetails>;
  getOrderStatus(orderId: string): Promise<OrderConfirmationDetails>;
  getCustomerOrders(restaurantId: string): Promise<OrderConfirmationDetails[]>;
  recordCustomerOrder(order: OrderConfirmationDetails, restaurantId: string): void;
  submitFeedback(feedback: FeedbackSubmission): Promise<{ success: boolean; message: string }>;
}
