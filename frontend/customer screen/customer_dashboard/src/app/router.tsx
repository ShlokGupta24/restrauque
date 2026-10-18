import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage';
import { CustomerAccountLayout } from '../components/layout/CustomerAccountLayout';
import { OverviewPage } from '../pages/account/OverviewPage';
import { FeedbackPage } from '../pages/account/FeedbackPage';
import { LoyaltyPointsPage } from '../pages/account/LoyaltyPointsPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { useCustomerAuth } from '../context/CustomerAuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
  const { isAuthenticated } = useCustomerAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
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

      {/* Authenticated Customer Account Routes (EXACTLY 3 Primary Destinations) */}
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

        {/* 2. Feedback */}
        <Route path="feedback" element={<FeedbackPage />} />

        {/* 3. Loyalty Points */}
        <Route path="loyalty" element={<LoyaltyPointsPage />} />

        {/* Legacy route redirects to the 3 canonical sections */}
        <Route path="reviews" element={<Navigate to="/account/feedback" replace />} />
        <Route path="orders" element={<Navigate to="/account/feedback" replace />} />
        <Route path="orders/:orderId" element={<Navigate to="/account/feedback" replace />} />
        <Route path="rewards" element={<Navigate to="/account/loyalty" replace />} />
        <Route path="profile" element={<Navigate to="/account" replace />} />
        <Route path="settings" element={<Navigate to="/account" replace />} />
      </Route>

      {/* Catch-all 404 Not Found */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
};
