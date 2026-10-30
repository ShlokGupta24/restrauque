'use client';

import React, { useState, useEffect } from 'react';
import { THEME } from '@/app/qr/[token]/constants';
import { CustomerUser } from '@/app/qr/[token]/types';
import FeedbackView from '@/app/qr/[token]/components/FeedbackView';
import CustomerAuthModal from '@/app/qr/[token]/components/CustomerAuthModal';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface FeedbackPageClientProps {
  orderId: string;
}

export default function FeedbackPageClient({ orderId }: FeedbackPageClientProps) {
  const [currentUser, setCurrentUser] = useState<CustomerUser | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const isValidUuid = uuidRegex.test(orderId);

  // Check initial authentication state
  useEffect(() => {
    let isCancelled = false;

    async function checkAuth() {
      try {
        const res = await fetch('/api/v1/auth/me');
        if (res.ok) {
          const json = await res.json();
          if (!isCancelled && json.data?.user && json.data.user.role === 'CUSTOMER') {
            setCurrentUser({
              id: json.data.user.id,
              name: json.data.user.name,
              phone: json.data.user.phone,
              role: json.data.user.role,
            });
          }
        }
      } catch {
        // Unauthenticated session
      } finally {
        if (!isCancelled) {
          setCheckingAuth(false);
        }
      }
    }

    checkAuth();

    return () => {
      isCancelled = true;
    };
  }, []);

  // 1. Invalid Order ID Format
  if (!isValidUuid) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.colors.bgPage,
          color: THEME.colors.textMain,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: THEME.typography.fontFamily,
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>⚠️</div>
          <h1
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 10px',
            }}
          >
            Invalid Feedback Link
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            The order reference in this link is invalid or malformed. Please verify the link received in your notification message.
          </p>
        </div>
      </main>
    );
  }

  // 2. Initial Auth Check Loading State
  if (checkingAuth) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.colors.bgPage,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: THEME.typography.fontFamily,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block',
              width: '36px',
              height: '36px',
              border: `3px solid ${THEME.colors.borderSubtle}`,
              borderTopColor: THEME.colors.navyPrimary,
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }}
          />
          <p style={{ marginTop: '16px', fontSize: '14px', color: THEME.colors.textMuted }}>
            Loading dining feedback...
          </p>
        </div>
      </main>
    );
  }

  // 3. Unauthenticated State: Clean login hero card
  if (!currentUser) {
    return (
      <main
        style={{
          minHeight: '100vh',
          backgroundColor: THEME.colors.bgPage,
          color: THEME.colors.textMain,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          fontFamily: THEME.typography.fontFamily,
        }}
      >
        <div
          style={{
            maxWidth: '460px',
            width: '100%',
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.xl,
            padding: '40px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.elevated,
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.navyLight,
              color: THEME.colors.navyPrimary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 20px',
            }}
          >
            ⭐
          </div>

          <h1
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 10px',
            }}
          >
            Order Feedback & Rewards
          </h1>

          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 28px',
            }}
          >
            Log in with your verified mobile number to share your dining experience and claim loyalty stars.
          </p>

          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            style={{
              width: '100%',
              height: '50px',
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
          >
            <span>Verify Mobile Number (OTP)</span>
            <span style={{ fontSize: '16px' }}>→</span>
          </button>
        </div>

        {/* Customer Mobile OTP Verification Modal */}
        <CustomerAuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          onAuthSuccess={(verifiedUser) => {
            setCurrentUser(verifiedUser);
            setIsAuthModalOpen(false);
          }}
        />
      </main>
    );
  }

  // 4. Authenticated: Render FeedbackView
  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: THEME.colors.bgPage,
        paddingBottom: '60px',
        fontFamily: THEME.typography.fontFamily,
      }}
    >
      <header
        style={{
          backgroundColor: THEME.colors.bgCard,
          borderBottom: `1px solid ${THEME.colors.borderSubtle}`,
          padding: '16px 20px',
          marginBottom: '20px',
        }}
      >
        <div
          style={{
            maxWidth: '640px',
            margin: '0 auto',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: '18px', fontWeight: 800, color: THEME.colors.navyPrimary }}>
            Restrauque
          </div>
          <div
            style={{
              fontSize: '12px',
              color: THEME.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>Verified Customer:</span>
            <strong style={{ color: THEME.colors.navyPrimary }}>{currentUser.phone}</strong>
          </div>
        </div>
      </header>

      <FeedbackView
        orderId={orderId}
        restaurant={{ id: '', name: 'Restaurant' }}
        table={{ id: '', tableNumber: '', capacity: 0, status: '' }}
        currentUser={currentUser}
        onRequestAuth={() => setIsAuthModalOpen(true)}
        onBackToMenu={() => {
          if (typeof window !== 'undefined') {
            window.location.href = '/';
          }
        }}
      />
    </main>
  );
}
