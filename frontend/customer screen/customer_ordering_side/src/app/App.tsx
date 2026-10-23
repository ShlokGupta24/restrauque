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
import { QrErrorScreen } from '../features/qr/QrErrorScreen';
import { RestrauqueLogo } from '../components/RestrauqueLogo';
import { Loader2 } from 'lucide-react';

export const App: React.FC = () => {
  const { currentScreen, isLoading, qrError, retryQrResolution } = useApp();

  if (isLoading) {
    return (
      <div
        className="customer-shell"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-primary, #0c0e14)',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '16px',
            color: '#fff',
            textAlign: 'center',
          }}
        >
          <RestrauqueLogo size="md" />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'rgba(255,255,255,0.7)',
              fontSize: '0.95rem',
              marginTop: '8px',
            }}
          >
            <Loader2
              size={20}
              style={{
                animation: 'spin 1s linear infinite',
              }}
            />
            <span>Connecting to your table...</span>
          </div>
        </div>
      </div>
    );
  }

  const renderScreen = () => {
    switch (currentScreen) {
      case 'qr-error':
        return <QrErrorScreen errorMessage={qrError} onRetry={retryQrResolution} />;
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
