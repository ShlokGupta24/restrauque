export type SubscriptionPlanId = 'operate' | 'intelligence' | 'autonomous';

export type FeatureId =
  | 'overview'
  | 'orders'
  | 'menu_products'
  | 'tables_qr'
  | 'coupons'
  | 'loyalty'
  | 'analytics'
  | 'ai_insights'
  | 'feedback'
  | 'settings';

export interface PlanDefinition {
  id: SubscriptionPlanId;
  name: string;
  tagline: string;
  description: string;
  badge?: string;
  features: FeatureId[];
}

export interface FeatureMetadata {
  id: FeatureId;
  label: string;
  path: string;
  requiredPlan: SubscriptionPlanId;
  hasSparkleBadge?: boolean;
  badgeCount?: number;
  description: string;
}

export const PLAN_DEFINITIONS: Record<SubscriptionPlanId, PlanDefinition> = {
  operate: {
    id: 'operate',
    name: 'Operate',
    tagline: 'Orders, menu, tables, coupons, basic daily operations',
    description: 'Essential operational toolset for day-to-day restaurant management.',
    features: ['overview', 'orders', 'menu_products', 'tables_qr', 'coupons', 'settings'],
  },
  intelligence: {
    id: 'intelligence',
    name: 'Intelligence',
    tagline: 'Operate plus advanced analytics, AI insights and business copilot',
    description: 'Data intelligence, customer sentiment, product metrics, and business recommendations.',
    badge: 'PREVIEW',
    features: [
      'overview',
      'orders',
      'menu_products',
      'tables_qr',
      'coupons',
      'loyalty',
      'analytics',
      'ai_insights',
      'feedback',
      'settings',
    ],
  },
  autonomous: {
    id: 'autonomous',
    name: 'Autonomous',
    tagline: 'Intelligence plus AI agents and controlled actions',
    description: 'Agentic workflows with automated marketing, menu adjustments, and inventory alerts.',
    features: [
      'overview',
      'orders',
      'menu_products',
      'tables_qr',
      'coupons',
      'loyalty',
      'analytics',
      'ai_insights',
      'feedback',
      'settings',
    ],
  },
};

export const FEATURE_REGISTRY: Record<FeatureId, FeatureMetadata> = {
  overview: {
    id: 'overview',
    label: 'Overview',
    path: '/dashboard/overview',
    requiredPlan: 'operate',
    description: 'High-level business snapshot, daily sales, and operational health.',
  },
  orders: {
    id: 'orders',
    label: 'Orders',
    path: '/dashboard/orders',
    requiredPlan: 'operate',
    badgeCount: 7,
    description: 'Live order tracking, fulfillment states, and order details.',
  },
  menu_products: {
    id: 'menu_products',
    label: 'Menu & Products',
    path: '/dashboard/menu',
    requiredPlan: 'operate',
    description: 'Manage menus, items, variants, pricing, and availability.',
  },
  tables_qr: {
    id: 'tables_qr',
    label: 'Tables & QR',
    path: '/dashboard/tables',
    requiredPlan: 'operate',
    description: 'Floor tables management, capacity, and instant QR generation.',
  },
  coupons: {
    id: 'coupons',
    label: 'Coupons & Loyalty',
    path: '/dashboard/coupons',
    requiredPlan: 'operate',
    description: 'Discount campaigns, validity windows, and loyalty programs.',
  },
  loyalty: {
    id: 'loyalty',
    label: 'Loyalty',
    path: '/dashboard/loyalty',
    requiredPlan: 'intelligence',
    description: 'Customer loyalty accounts, point rewards, and tiers.',
  },
  analytics: {
    id: 'analytics',
    label: 'Analytics & Reports',
    path: '/dashboard/analytics',
    requiredPlan: 'intelligence',
    hasSparkleBadge: true,
    description: 'Revenue trends, top performers, and source mix analytics.',
  },
  ai_insights: {
    id: 'ai_insights',
    label: 'AI Insights',
    path: '/dashboard/ai-insights',
    requiredPlan: 'intelligence',
    hasSparkleBadge: true,
    description: 'AI-generated intelligence, anomaly alerts, and recommendations.',
  },
  feedback: {
    id: 'feedback',
    label: 'Feedback',
    path: '/dashboard/feedback',
    requiredPlan: 'intelligence',
    description: 'Guest satisfaction, star ratings, and topic analysis.',
  },
  settings: {
    id: 'settings',
    label: 'Settings',
    path: '/dashboard/settings',
    requiredPlan: 'operate',
    description: 'Restaurant profile, branches, permissions, and subscriptions.',
  },
};
