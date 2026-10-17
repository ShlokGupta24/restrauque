import { CustomerDataService } from '../CustomerDataService';
import {
  RestaurantPublicInfo,
  Category,
  Product,
  CartItem,
  BillBreakdown,
  OrderConfirmationDetails,
  FeedbackSubmission,
} from '../contracts/types';
import { mockRestaurant } from '../../mocks/restaurant.mock';
import { mockCategories, mockProducts } from '../../mocks/menu.mock';
import { mockDefaultOrder, mockCompletedOrderForFeedback } from '../../mocks/order.mock';

export class MockDataService implements CustomerDataService {
  async resolveQrContext(_qrToken: string): Promise<RestaurantPublicInfo> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    return mockRestaurant;
  }

  async getCategories(): Promise<Category[]> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return mockCategories;
  }

  async getProducts(categoryId?: string): Promise<Product[]> {
    await new Promise((resolve) => setTimeout(resolve, 150));
    if (!categoryId || categoryId === 'cat-all') {
      return mockProducts;
    }
    return mockProducts.filter((p) => p.categoryId === categoryId);
  }

  async getProductById(productId: string): Promise<Product | null> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const product = mockProducts.find((p) => p.id === productId);
    return product || null;
  }

  async calculateBill(items: CartItem[], couponCode?: string): Promise<BillBreakdown> {
    const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    let discountAmount = 0;
    let appliedCoupon: BillBreakdown['appliedCoupon'] = undefined;

    if (couponCode && couponCode.toUpperCase() === 'WELCOME10') {
      discountAmount = Math.round(subtotal * 0.1);
      appliedCoupon = { code: 'WELCOME10', discountValue: discountAmount };
    }

    const taxableAmount = Math.max(0, subtotal - discountAmount);
    // 5% restaurant GST
    const taxAmount = Math.round(taxableAmount * 0.05);
    const totalAmount = taxableAmount + taxAmount;

    return {
      subtotal,
      discountAmount,
      taxAmount,
      totalAmount,
      appliedCoupon,
    };
  }

  async requestOtp(_phone: string): Promise<{ success: boolean; message: string; expiresInSeconds?: number }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: true, message: 'OTP sent successfully', expiresInSeconds: 300 };
  }

  async verifyOtp(phone: string, otpCode: string): Promise<{ success: boolean; user?: { phone: string; name?: string } }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // For development testing, accept any 6 digits
    if (otpCode.length === 6) {
      sessionStorage.setItem('restrauque_mock_auth_phone', phone);
      return { success: true, user: { phone, name: 'Guest Diner' } };
    }
    return { success: false };
  }

  async checkAuthSession(): Promise<{ isAuthenticated: boolean; phone?: string; customerName?: string }> {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const savedPhone = sessionStorage.getItem('restrauque_mock_auth_phone');
    if (savedPhone) {
      return { isAuthenticated: true, phone: savedPhone, customerName: 'Guest Diner' };
    }
    return { isAuthenticated: false };
  }

  async logout(): Promise<{ success: boolean }> {
    sessionStorage.removeItem('restrauque_mock_auth_phone');
    return { success: true };
  }

  private ordersStore: OrderConfirmationDetails[] = [
    {
      ...mockCompletedOrderForFeedback,
      orderId: 'ord-1042',
      orderNumber: '#NBC1042',
      restaurantName: mockRestaurant.name,
      tableLabel: mockRestaurant.tableLabel,
      orderedAt: '12 Dec 2024, 1:24 PM',
      status: 'completed',
      statusLabel: 'Order Completed',
    },
    {
      ...mockDefaultOrder,
      orderId: 'ord-1043',
      orderNumber: '#NBC1043',
      restaurantName: mockRestaurant.name,
      tableLabel: mockRestaurant.tableLabel,
      orderedAt: '12 Dec 2024, 2:15 PM',
      status: 'preparing',
      statusLabel: 'Your order has been received and is being prepared.',
    },
  ];

  recordCustomerOrder(order: OrderConfirmationDetails, restaurantId: string): void {
    const existingIndex = this.ordersStore.findIndex((o) => o.orderId === order.orderId);
    if (existingIndex >= 0) {
      this.ordersStore[existingIndex] = order;
    } else {
      this.ordersStore.unshift(order);
    }
    try {
      const storageKey = `restrauque_orders_${restaurantId}`;
      const raw = sessionStorage.getItem(storageKey);
      const ids: string[] = raw ? JSON.parse(raw) : [];
      if (!ids.includes(order.orderId)) {
        ids.unshift(order.orderId);
        sessionStorage.setItem(storageKey, JSON.stringify(ids));
      }
    } catch {
      // ignore
    }
  }

  async getCustomerOrders(restaurantId: string): Promise<OrderConfirmationDetails[]> {
    await new Promise((resolve) => setTimeout(resolve, 250));
    // Strictly scoped: only orders associated with this restaurant
    return this.ordersStore.filter((ord) => {
      return !restaurantId || restaurantId === mockRestaurant.id || ord.restaurantName === mockRestaurant.name;
    });
  }

  async createOrder(data: {
    items: CartItem[];
    paymentMethod: string;
    notes?: string;
  }): Promise<OrderConfirmationDetails> {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const bill = await this.calculateBill(data.items);
    const newOrder: OrderConfirmationDetails = {
      orderId: 'ord-' + Math.floor(1000 + Math.random() * 9000),
      orderNumber: '#NBC' + Math.floor(1000 + Math.random() * 9000),
      restaurantName: mockRestaurant.name,
      tableLabel: mockRestaurant.tableLabel,
      orderedAt: new Date().toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
      status: 'preparing',
      statusLabel: 'Your order has been received and is being prepared.',
      items: data.items.map((i) => ({
        name: i.productName,
        quantity: i.quantity,
        price: i.unitPrice * i.quantity,
        variantName: i.variant?.name,
      })),
      bill,
      paymentMethod: data.paymentMethod || 'Pay at Restaurant',
    };
    this.recordCustomerOrder(newOrder, mockRestaurant.id);
    return newOrder;
  }

  async getOrderStatus(orderId: string): Promise<OrderConfirmationDetails> {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const found = this.ordersStore.find((o) => o.orderId === orderId);
    if (found) {
      return {
        ...found,
        // strictly adhere to authoritative completed status
        status: String(found.status).toLowerCase() === 'completed' ? 'completed' : found.status,
      };
    }
    return {
      ...mockDefaultOrder,
      orderId,
    };
  }

  async submitFeedback(_feedback: FeedbackSubmission): Promise<{ success: boolean; message: string }> {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { success: true, message: 'Thank you! Your feedback has been submitted.' };
  }
}
