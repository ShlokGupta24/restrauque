import React from 'react';
import { CustomerLayout } from '../layouts/CustomerLayout';
import { useApp } from '../hooks/useAppContext';
import { RestaurantLandingScreen } from '../features/restaurant/RestaurantLandingScreen';
import { MenuScreen } from '../features/menu/MenuScreen';
import { ProductDetailScreen } from '../features/product-detail/ProductDetailScreen';
import { CartScreen } from '../features/cart/CartScreen';
import { MobileLoginScreen } from '../features/auth/MobileLoginScreen';
import { OtpVerificationScreen } from '../features/auth/OtpVerificationScreen';
import { PaymentOrderSummaryScreen } from '../features/checkout/PaymentOrderSummaryScreen';
import { OrderConfirmationScreen } from '../features/orders/OrderConfirmationScreen';
import { OrderHistoryScreen } from '../features/orders/OrderHistoryScreen';
import { FeedbackScreen } from '../features/feedback/FeedbackScreen';

export const App: React.FC = () => {
  const { currentScreen } = useApp();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'landing':
        return <RestaurantLandingScreen />;
      case 'menu':
        return <MenuScreen />;
      case 'product-detail':
        return <ProductDetailScreen />;
      case 'cart':
        return <CartScreen />;
      case 'auth-login':
        return <MobileLoginScreen />;
      case 'auth-otp':
        return <OtpVerificationScreen />;
      case 'checkout':
        return <PaymentOrderSummaryScreen />;
      case 'order-confirmation':
        return <OrderConfirmationScreen />;
      case 'order-history':
        return <OrderHistoryScreen />;
      case 'feedback':
        return <FeedbackScreen />;
      default:
        return <RestaurantLandingScreen />;
    }
  };

  return <CustomerLayout>{renderScreen()}</CustomerLayout>;
};
