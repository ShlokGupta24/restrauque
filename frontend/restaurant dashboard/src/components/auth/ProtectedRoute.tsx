import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useRestaurant } from '../../context/RestaurantContext';
import { DashboardAuthScreen } from './DashboardAuthScreen';
import { RestaurantOnboardingScreen } from '../onboarding/RestaurantOnboardingScreen';
import { LogOut, AlertTriangle, RefreshCw } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { user, isAuthenticated, isLoading: isAuthLoading, logout } = useAuth();
  const { hasRestaurant, isLoadingContext, contextError, reloadContext } = useRestaurant();

  // 1. Loading Authentication State
  if (isAuthLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#101112',
          color: '#e5e7eb',
          fontFamily: 'var(--font-family, sans-serif)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'var(--brand-red, #e53935)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>Verifying authenticated session...</span>
      </div>
    );
  }

  // 2. Unauthenticated State
  if (!isAuthenticated || !user) {
    return <DashboardAuthScreen />;
  }

  // 3. Customer Role Access Rejection (Strict Role Boundary)
  if (user.role !== 'RESTAURANT_OWNER') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#101112',
          color: '#e5e7eb',
          fontFamily: 'var(--font-family, sans-serif)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#191a1c',
            border: '1px solid rgba(229, 57, 53, 0.4)',
            borderRadius: '20px',
            padding: '36px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(229, 57, 53, 0.15)',
              color: '#ff6c64',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#ffffff' }}>
            Access Restricted
          </h2>
          <p style={{ fontSize: '13px', color: '#9ca3af', lineHeight: 1.6, margin: '0 0 24px' }}>
            You are signed in with a <strong>{user.role}</strong> account. The Restaurant Dashboard requires a verified <strong>RESTAURANT_OWNER</strong> role.
          </p>
          <button
            type="button"
            onClick={() => logout()}
            style={{
              height: '42px',
              width: '100%',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--brand-red, #e53935)',
              color: '#ffffff',
              fontWeight: 600,
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
            }}
          >
            <LogOut size={16} /> Sign out & switch account
          </button>
        </div>
      </div>
    );
  }

  // 4. Loading Restaurant Context State
  if (isLoadingContext) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#101112',
          color: '#e5e7eb',
          fontFamily: 'var(--font-family, sans-serif)',
          gap: '16px',
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            border: '3px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'var(--brand-red, #e53935)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        <span style={{ fontSize: '13px', color: '#9ca3af' }}>Loading restaurant context...</span>
      </div>
    );
  }

  // 5. Context Error State
  if (contextError) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#101112',
          color: '#e5e7eb',
          fontFamily: 'var(--font-family, sans-serif)',
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '440px',
            backgroundColor: '#191a1c',
            border: '1px solid rgba(229, 57, 53, 0.4)',
            borderRadius: '20px',
            padding: '36px',
          }}
        >
          <div
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              backgroundColor: 'rgba(229, 57, 53, 0.15)',
              color: '#ff6c64',
              display: 'grid',
              placeItems: 'center',
              margin: '0 auto 16px',
            }}
          >
            <AlertTriangle size={24} />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 10px', color: '#ffffff' }}>
            Context Loading Failed
          </h2>
          <p style={{ fontSize: '13px', color: '#ff6c64', lineHeight: 1.6, margin: '0 0 24px' }}>
            {contextError}
          </p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              onClick={() => reloadContext()}
              style={{
                flex: 1,
                height: '42px',
                borderRadius: '10px',
                border: 'none',
                backgroundColor: 'var(--brand-red, #e53935)',
                color: '#ffffff',
                fontWeight: 600,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={16} /> Retry
            </button>
            <button
              type="button"
              onClick={() => logout()}
              style={{
                height: '42px',
                padding: '0 16px',
                borderRadius: '10px',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                backgroundColor: 'transparent',
                color: '#e5e7eb',
                fontWeight: 600,
                fontSize: '13px',
                cursor: 'pointer',
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 6. Owner With No Restaurant (Requires Onboarding)
  if (!hasRestaurant) {
    return <RestaurantOnboardingScreen />;
  }

  // 7. Fully Authorized Owner Context
  return children ? <>{children}</> : <Outlet />;
};
