import {
  CustomerProfile,
  CustomerOrder,
  CustomerReview,
  RestaurantLoyaltyWallet,
} from '../services/types';

export interface RestaurantMeta {
  id: string;
  name: string;
  shortName: string;
  slug: string;
  tagline: string;
  cuisine: string;
  themeColor: string;
  themeAccentBg: string;
  themeAccentText: string;
}

export const DEMO_REVIEW_REWARD_POINTS = 50;

export const DEMO_RESTAURANTS: RestaurantMeta[] = [
  {
    id: 'res_nbc',
    name: 'NBC - Engineering College',
    shortName: 'NBC Cafe',
    slug: 'nbc-cafe',
    tagline: 'Artisan Coffee & Quick Bites',
    cuisine: 'Cafe & Continental',
    themeColor: '#174A82',
    themeAccentBg: '#e0f2fe',
    themeAccentText: '#0369a1',
  },
  {
    id: 'res_bhoj',
    name: 'The Bhoj Family Restaurant',
    shortName: 'The Bhoj',
    slug: 'the-bhoj-family-restaurant',
    tagline: 'Authentic Family Dining',
    cuisine: 'North Indian & Chinese',
    themeColor: '#b45309',
    themeAccentBg: '#fef3c7',
    themeAccentText: '#92400e',
  },
];

export const DEMO_CUSTOMER_PROFILE: CustomerProfile = {
  id: 'cust-sharma-987',
  name: 'Aarav Sharma',
  phone: '9876543210',
  email: 'aarav.sharma@example.com',
  memberSince: 'October 2024',
  preferences: {
    dietaryPreference: 'all',
    spiceLevel: 'medium',
    emailReceipts: true,
    smsAlerts: true,
    promotionalOffers: false,
  },
};

export const DEMO_INITIAL_ORDERS: CustomerOrder[] = [
  {
    orderId: 'ord-nbc-1042',
    orderNumber: '#NBC1042',
    restaurantId: 'res_nbc',
    restaurantName: 'NBC - Engineering College',
    restaurantSlug: 'nbc-cafe',
    restaurantThemeColor: '#174A82',
    tableLabel: 'Table F18',
    orderedAt: '12 Dec 2024, 1:24 PM',
    completedAt: '12 Dec 2024, 1:48 PM',
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
    paymentMethod: 'Pay at Restaurant (Cash / UPI)',
    reviewStatus: 'eligible', // Completed & waiting for review
  },
  {
    orderId: 'ord-nbc-1043',
    orderNumber: '#NBC1043',
    restaurantId: 'res_nbc',
    restaurantName: 'NBC - Engineering College',
    restaurantSlug: 'nbc-cafe',
    restaurantThemeColor: '#174A82',
    tableLabel: 'Table F18',
    orderedAt: '18 Oct 2026, 2:10 PM',
    status: 'preparing',
    statusLabel: 'Preparing in Kitchen',
    items: [
      {
        productId: 'prod-iced-latte',
        name: 'Iced Latte',
        quantity: 1,
        price: 140,
        variantName: 'Regular',
      },
      {
        productId: 'prod-cold-coffee',
        name: 'Cold Coffee',
        quantity: 1,
        price: 130,
      },
    ],
    bill: {
      subtotal: 270,
      discountAmount: 0,
      taxAmount: 13.5,
      totalAmount: 283.5,
    },
    paymentMethod: 'Pay at Counter',
    reviewStatus: 'unavailable', // In progress — cannot be reviewed yet
  },
  {
    orderId: 'ord-bhoj-2001',
    orderNumber: '#BHOJ2001',
    restaurantId: 'res_bhoj',
    restaurantName: 'The Bhoj Family Restaurant',
    restaurantSlug: 'the-bhoj-family-restaurant',
    restaurantThemeColor: '#b45309',
    tableLabel: 'Table T04',
    orderedAt: '18 Oct 2026, 1:15 PM',
    completedAt: '18 Oct 2026, 1:52 PM',
    status: 'completed',
    statusLabel: 'Order Completed',
    items: [
      {
        productId: 'prod-bhoj-manchow-soup',
        name: 'Manchow Soup',
        quantity: 2,
        price: 120,
        variantName: 'Family Bowl',
        imageUrl: 'https://images.unsplash.com/photo-1582878826629-29b7ad1cdc43?auto=format&fit=crop&w=200&q=80',
      },
      {
        productId: 'prod-bhoj-paneer-manchurian',
        name: 'Paneer Manchurian',
        quantity: 1,
        price: 249,
        variantName: 'Dry Platter',
        imageUrl: 'https://images.unsplash.com/photo-1585032226651-759b368d7246?auto=format&fit=crop&w=200&q=80',
      },
      {
        productId: 'prod-bhoj-chilli-potato',
        name: 'Chilli Potato',
        quantity: 1,
        price: 149,
        imageUrl: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?auto=format&fit=crop&w=200&q=80',
      },
    ],
    bill: {
      subtotal: 638,
      discountAmount: 0,
      taxAmount: 31.9,
      totalAmount: 669.9,
    },
    paymentMethod: 'UPI (GPay / PhonePe)',
    reviewStatus: 'submitted', // Already reviewed
  },
  {
    orderId: 'ord-bhoj-2002',
    orderNumber: '#BHOJ2002',
    restaurantId: 'res_bhoj',
    restaurantName: 'The Bhoj Family Restaurant',
    restaurantSlug: 'the-bhoj-family-restaurant',
    restaurantThemeColor: '#b45309',
    tableLabel: 'Table T02',
    orderedAt: '15 Oct 2026, 8:30 PM',
    completedAt: '15 Oct 2026, 9:20 PM',
    status: 'completed',
    statusLabel: 'Order Completed',
    items: [
      {
        productId: 'prod-bhoj-pecking-soup',
        name: 'Pecking Soup',
        quantity: 1,
        price: 120,
      },
      {
        productId: 'prod-bhoj-paneer-manchurian',
        name: 'Paneer Manchurian',
        quantity: 1,
        price: 249,
        variantName: 'Gravy',
      },
    ],
    bill: {
      subtotal: 369,
      discountAmount: 0,
      taxAmount: 18.45,
      totalAmount: 387.45,
    },
    paymentMethod: 'Cash',
    reviewStatus: 'eligible', // Completed & waiting for review
  },
];

export const DEMO_INITIAL_REVIEWS: CustomerReview[] = [
  {
    reviewId: 'rev-bhoj-2001',
    orderId: 'ord-bhoj-2001',
    orderNumber: '#BHOJ2001',
    restaurantId: 'res_bhoj',
    restaurantName: 'The Bhoj Family Restaurant',
    overallRating: 5,
    overallComment: 'Authentic flavors and generous portions. The Paneer Manchurian was outstanding!',
    items: [
      {
        productId: 'prod-bhoj-manchow-soup',
        productName: 'Manchow Soup',
        rating: 5,
        comment: 'Perfect heat and crispy noodles topping.',
      },
      {
        productId: 'prod-bhoj-paneer-manchurian',
        productName: 'Paneer Manchurian',
        rating: 5,
        comment: 'Super soft paneer with rich gravy.',
      },
    ],
    submittedAt: '18 Oct 2026, 2:05 PM',
    pointsEarned: 50,
  },
];

export const DEMO_INITIAL_LOYALTY_WALLETS: Record<string, RestaurantLoyaltyWallet> = {
  res_nbc: {
    restaurantId: 'res_nbc',
    restaurantName: 'NBC - Engineering College',
    restaurantSlug: 'nbc-cafe',
    tier: 'Gold Diner',
    availablePoints: 320,
    pointsEarned: 480,
    pointsRedeemed: 160,
    expiryDetails: 'Points valid for 12 months from order date',
    availableRewards: [],
    transactions: [
      {
        id: 'txn-nbc-1',
        date: '12 Dec 2024',
        type: 'earn',
        description: 'Dining order points (#NBC1042)',
        points: 47,
        orderNumber: '#NBC1042',
      },
      {
        id: 'txn-nbc-2',
        date: '28 Nov 2024',
        type: 'earn',
        description: 'Welcome bonus on verified phone',
        points: 100,
      },
    ],
  },
  res_bhoj: {
    restaurantId: 'res_bhoj',
    restaurantName: 'The Bhoj Family Restaurant',
    restaurantSlug: 'the-bhoj-family-restaurant',
    tier: 'Silver Diner',
    availablePoints: 230,
    pointsEarned: 290,
    pointsRedeemed: 60,
    expiryDetails: 'Points valid for 12 months from order date',
    availableRewards: [],
    transactions: [
      {
        id: 'txn-bhoj-1',
        date: '18 Oct 2026',
        type: 'earn',
        description: 'Review bonus (+50 pts) for #BHOJ2001',
        points: 50,
        orderNumber: '#BHOJ2001',
      },
      {
        id: 'txn-bhoj-2',
        date: '18 Oct 2026',
        type: 'earn',
        description: 'Dining order points (#BHOJ2001)',
        points: 67,
        orderNumber: '#BHOJ2001',
      },
      {
        id: 'txn-bhoj-3',
        date: '15 Oct 2026',
        type: 'earn',
        description: 'Dining order points (#BHOJ2002)',
        points: 39,
        orderNumber: '#BHOJ2002',
      },
    ],
  },
};
