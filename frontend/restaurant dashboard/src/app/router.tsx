import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { OverviewPage } from '../features/overview/OverviewPage';
import { OrdersPage } from '../features/orders/OrdersPage';
import { OrderDetailsPage } from '../features/orders/OrderDetailsPage';
import { MenuProductsPage } from '../features/menu/MenuProductsPage';
import { EditProductPage } from '../features/menu/EditProductPage';
import { TablesQrPage } from '../features/tables/TablesQrPage';
import { CouponsPage } from '../features/coupons/CouponsPage';
import { EditCouponPage } from '../features/coupons/EditCouponPage';
import { LoyaltySetupPage } from '../features/loyalty/LoyaltySetupPage';
import { AnalyticsPage } from '../features/analytics/AnalyticsPage';
import { AiInsightsPage } from '../features/insights/AiInsightsPage';
import { FeedbackPage } from '../features/feedback/FeedbackPage';
import { SettingsPage } from '../features/settings/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/dashboard/overview" replace />,
  },
  {
    path: '/dashboard',
    element: <DashboardLayout />,
    children: [
      {
        path: '',
        element: <Navigate to="/dashboard/overview" replace />,
      },
      {
        path: 'overview',
        element: <OverviewPage />,
      },
      {
        path: 'orders',
        element: <OrdersPage />,
      },
      {
        path: 'orders/:orderId',
        element: <OrderDetailsPage />,
      },
      {
        path: 'menu',
        element: <MenuProductsPage />,
      },
      {
        path: 'menu/products/:productId/edit',
        element: <EditProductPage />,
      },
      {
        path: 'menu/products/create',
        element: <EditProductPage />,
      },
      {
        path: 'tables',
        element: <TablesQrPage />,
      },
      {
        path: 'coupons',
        element: <CouponsPage />,
      },
      {
        path: 'coupons/:couponId/edit',
        element: <EditCouponPage />,
      },
      {
        path: 'coupons/create',
        element: <EditCouponPage />,
      },
      {
        path: 'loyalty',
        element: <CouponsPage />,
      },
      {
        path: 'loyalty/setup',
        element: <LoyaltySetupPage />,
      },
      {
        path: 'analytics',
        element: <AnalyticsPage />,
      },
      {
        path: 'ai-insights',
        element: <AiInsightsPage />,
      },
      {
        path: 'feedback',
        element: <FeedbackPage />,
      },
      {
        path: 'settings',
        element: <SettingsPage />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard/overview" replace />,
  },
]);
