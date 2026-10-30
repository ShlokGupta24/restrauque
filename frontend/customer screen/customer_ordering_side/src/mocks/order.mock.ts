import { OrderConfirmationDetails } from '../services/contracts/types';

export const mockDefaultOrder: OrderConfirmationDetails = {
  orderId: 'ord-1042',
  orderNumber: '#NBC1234',
  restaurantName: 'NBC - Engineering College',
  tableLabel: 'Table F18',
  orderedAt: '12 Dec 2024, 1:24 PM',
  status: 'preparing',
  statusLabel: 'Your order has been received and is being prepared.',
  items: [
    { name: 'Iced Latte', quantity: 1, price: 140, variantName: 'Regular' },
    { name: 'Cold Coffee', quantity: 1, price: 130 },
    { name: 'Mocha Frappe', quantity: 1, price: 150 },
  ],
  bill: {
    subtotal: 420,
    discountAmount: 0,
    taxAmount: 21,
    totalAmount: 441,
  },
  paymentMethod: 'Pay at Restaurant (Cash / Card / UPI)',
};

export const mockCompletedOrderForFeedback: OrderConfirmationDetails = {
  orderId: 'ord-1042',
  orderNumber: '#1042',
  restaurantName: 'NBC - Engineering College',
  tableLabel: 'Table F18',
  orderedAt: '12 Dec 2024, 1:24 PM',
  status: 'completed',
  statusLabel: 'Order Completed',
  items: [
    {
      productId: 'prod-mushroom-pasta',
      name: 'Creamy mushroom pasta',
      quantity: 1,
      price: 260,
      variantName: 'Regular · Extra cheese',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80',
    },
    {
      productId: 'prod-avocado-toast',
      name: 'Avocado toast',
      quantity: 1,
      price: 190,
      variantName: 'Sourdough',
      imageUrl: 'https://images.unsplash.com/photo-1588137378633-dea1336ce1e2?auto=format&fit=crop&w=120&q=80',
    },
  ],
  bill: {
    subtotal: 450,
    discountAmount: 0,
    taxAmount: 22.5,
    totalAmount: 472.5,
  },
  paymentMethod: 'Pay at Restaurant',
};
