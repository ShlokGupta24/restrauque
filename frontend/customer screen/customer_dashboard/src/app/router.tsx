import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { CustomerAccountLayout } from '../components/layout/CustomerAccountLayout';
import { OverviewPage } from '../pages/account/OverviewPage';
import { OrdersHistoryPage } from '../pages/account/OrdersHistoryPage';
import { OrderDetailPage } from '../pages/account/OrderDetailPage';
import { FeedbackPage } from '../pages/account/FeedbackPage';
import { LoyaltyPointsPage } from '../pages/account/LoyaltyPointsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { status, isAuthenticated } = useCustomerAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <div
        style={{
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app, #f8f9fa)',
          color: 'var(--text-secondary, #666)',
          fontFamily: 'inherit',
          fontSize: '14px',
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <p>Verifying customer session...</p>
        </div>
      </div>
    );
  }
  if (!isAuthenticated) {
    const fullPath = location.pathname + location.search;
    const redirectParam =
      fullPath && fullPath !== '/account' && fullPath !== '/account/'
        ? `?redirect=${encodeURIComponent(fullPath)}`
        : '';
    return <Navigate to={`/login${redirectParam}`} replace />;
  }
  return children;
};

export const AppRouter: React.FC = () => {
  return (
    <Routes>
      {/* Root redirects to /account */}
      <Route path="/" element={<Navigate to="/account" replace />} />

      {/* Authentication */}
      <Route path="/login" element={<LoginPage />} />

      {/* Authenticated Customer Account Routes */}
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <CustomerAccountLayout />
          </ProtectedRoute>
        }
      >
        {/* 1. Overview */}
        <Route index element={<OverviewPage />} />

        {/* 2. Order History & Details */}
        <Route path="orders" element={<OrdersHistoryPage />} />
        <Route path="orders/:orderId" element={<OrderDetailPage />} />

        {/* 3. Feedback */}
        <Route path="feedback" element={<FeedbackPage />} />

        {/* 4. Loyalty Points */}
        <Route path="loyalty" element={<LoyaltyPointsPage />} />

        {/* Legacy route redirects */}
        <Route path="reviews" element={<Navigate to="/account/feedback" replace />} />
        <Route path="rewards" element={<Navigate to="/account/loyalty" replace />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="settings" element={<Navigate to="/account" replace />} />
      </Route>

      {/* Catch-all 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
