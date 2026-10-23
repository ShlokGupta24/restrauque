'use client';

import React, { useState, useEffect } from 'react';
import { THEME } from '../constants';
import { RestaurantContext, TableContext, CustomerUser, ConfirmedOrder } from '../types';

interface OrderItemInfo {
  productId: string;
  productName: string;
  variantName: string | null;
  imageUrl: string | null;
  quantity: number;
  addons: string[];
}

interface EligibilityData {
  isEligible: boolean;
  reason: string | null;
  alreadySubmitted: boolean;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    restaurantId: string;
    restaurantName: string;
    tableNumber: string | null;
    completedAt: string | null;
    items: OrderItemInfo[];
  };
  existingFeedback: {
    id: string;
    rating: number | null;
    comment: string | null;
    submittedAt: string;
    itemFeedback: {
      productId: string;
      rating: number | null;
      comment: string | null;
    }[];
  } | null;
  potentialReward: {
    isActive: boolean;
    programName: string;
    baseStars: number;
  };
}

interface FeedbackViewProps {
  orderId: string;
  restaurant: RestaurantContext;
  table: TableContext;
  currentUser: CustomerUser | null;
  onRequestAuth: () => void;
  onBackToMenu: () => void;
  initialOrder?: ConfirmedOrder | null;
}

const RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very Good',
  5: 'Excellent!',
};

export default function FeedbackView({
  orderId,
  restaurant,
  table,
  currentUser,
  onRequestAuth,
  onBackToMenu,
  initialOrder,
}: FeedbackViewProps) {
  // Loading & Eligibility State
  const [loading, setLoading] = useState(true);
  const [eligibilityData, setEligibilityData] = useState<EligibilityData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Form State
  const [overallRating, setOverallRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [overallComment, setOverallComment] = useState('');
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});

  // Submission State
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    starsAwarded: number;
    newBalance: number;
    message: string;
  } | null>(null);

  // Fetch Eligibility & Order Info
  useEffect(() => {
    let isCancelled = false;

    async function fetchEligibility() {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const res = await fetch(`/api/v1/customer/orders/${orderId}/feedback`, {
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const json = await res.json();

        if (isCancelled) return;

        if (!res.ok) {
          setLoadError(json.error?.message || 'Failed to check feedback eligibility');
          setLoading(false);
          return;
        }

        setEligibilityData(json.data);

        // Pre-populate item ratings with default 5 stars
        if (json.data?.order?.items) {
          const initialItemRatings: Record<string, number> = {};
          json.data.order.items.forEach((item: OrderItemInfo) => {
            initialItemRatings[item.productId] = 5;
          });
          setItemRatings(initialItemRatings);
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          setLoadError('Network error while checking feedback status');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    fetchEligibility();

    return () => {
      isCancelled = true;
    };
  }, [orderId, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (overallRating < 1 || overallRating > 5) {
      setSubmitError('Please select an overall rating between 1 and 5 stars');
      return;
    }

    setSubmitting(true);

    try {
      // Build items array
      const itemsPayload = Object.entries(itemRatings).map(([productId, rating]) => ({
        productId,
        rating,
        comment: itemComments[productId]?.trim() || null,
      }));

      const res = await fetch(`/api/v1/customer/orders/${orderId}/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rating: overallRating,
          comment: overallComment.trim() || null,
          items: itemsPayload,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setSubmitError(json.error?.message || 'Failed to submit feedback');
        setSubmitting(false);
        return;
      }

      setSubmissionSuccess({
        starsAwarded: json.data?.reward?.starsAwarded ?? 0,
        newBalance: json.data?.reward?.newBalance ?? 0,
        message: json.data?.reward?.description ?? 'Feedback submitted successfully!',
      });
    } catch (err: unknown) {
      setSubmitError('Network error occurred while submitting feedback');
    } finally {
      setSubmitting(false);
    }
  };

  // 1. Auth Required State
  if (!currentUser) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '16px' }}>🔐</div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 10px',
            }}
          >
            Authentication Required
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            Please log in with your phone number to leave feedback and claim your restaurant loyalty rewards.
          </p>
          <button
            type="button"
            onClick={onRequestAuth}
            style={{
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              padding: '14px 28px',
              borderRadius: THEME.radius.md,
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
            }}
          >
            Log In with Mobile OTP
          </button>
        </div>
      </div>
    );
  }

  // 2. Loading State
  if (loading) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '60px 16px', textAlign: 'center' }}>
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
          Checking order feedback eligibility...
        </p>
      </div>
    );
  }

  // 3. Error / Ineligible State
  if (loadError || !eligibilityData) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>⚠️</div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 8px',
            }}
          >
            Feedback Unavailable
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            {loadError || 'This order cannot be reviewed at this time.'}
          </p>
          <button
            type="button"
            onClick={onBackToMenu}
            style={{
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // 4. Already Submitted State
  if (eligibilityData.alreadySubmitted) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '36px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.successBg,
              color: THEME.colors.successGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 16px',
            }}
          >
            ✓
          </div>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 8px',
            }}
          >
            Feedback Already Submitted
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 16px',
            }}
          >
            You have already shared feedback for Order <strong>#{eligibilityData.order.orderNumber}</strong>. Thank you for helping us improve our dining experience!
          </p>
          {eligibilityData.existingFeedback?.rating && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '6px 14px',
                borderRadius: THEME.radius.pill,
                backgroundColor: THEME.colors.bgCardSubtle,
                fontSize: '14px',
                fontWeight: 700,
                color: THEME.colors.accentGold,
                marginBottom: '24px',
              }}
            >
              <span>★</span>
              <span>{eligibilityData.existingFeedback.rating} / 5 Stars Given</span>
            </div>
          )}
          <div>
            <button
              type="button"
              onClick={onBackToMenu}
              style={{
                backgroundColor: THEME.colors.navyPrimary,
                color: '#ffffff',
                border: 'none',
                padding: '12px 28px',
                borderRadius: THEME.radius.md,
                fontSize: '14px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Return to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 5. Ineligible State (e.g. Order not completed yet)
  if (!eligibilityData.isEligible) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '32px 24px',
            textAlign: 'center',
            boxShadow: THEME.shadow.card,
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🍽️</div>
          <h2
            style={{
              fontSize: '18px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 8px',
            }}
          >
            Order In Progress
          </h2>
          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            {eligibilityData.reason ||
              'Feedback opens once your meal is marked as completed by the restaurant staff.'}
          </p>
          <button
            type="button"
            onClick={onBackToMenu}
            style={{
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              padding: '12px 24px',
              borderRadius: THEME.radius.md,
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // 6. Success State after submission
  if (submissionSuccess) {
    return (
      <div style={{ maxWidth: '600px', margin: '0 auto', padding: '32px 16px' }}>
        <div
          style={{
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
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              backgroundColor: THEME.colors.successBg,
              color: THEME.colors.successGreen,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '34px',
              margin: '0 auto 20px',
              border: `2px solid ${THEME.colors.successGreen}`,
            }}
          >
            ✓
          </div>

          <h2
            style={{
              fontSize: '22px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              margin: '0 0 8px',
            }}
          >
            Thank You for Your Feedback!
          </h2>

          <p
            style={{
              fontSize: '14px',
              color: THEME.colors.textMuted,
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            Your review helps {eligibilityData.order.restaurantName} maintain excellent culinary quality and service.
          </p>

          {/* Reward Awarded Card */}
          {submissionSuccess.starsAwarded > 0 && (
            <div
              style={{
                backgroundColor: THEME.colors.bgCardHighlight,
                border: '1px solid #e5d8b8',
                borderRadius: THEME.radius.md,
                padding: '18px 20px',
                marginBottom: '28px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  color: THEME.colors.accentGold,
                  marginBottom: '4px',
                }}
              >
                <span>⭐</span>
                <span>Loyalty Reward Confirmed</span>
              </div>
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                  marginTop: '4px',
                }}
              >
                +{submissionSuccess.starsAwarded} Stars Earned!
              </div>
              <div
                style={{
                  fontSize: '13px',
                  color: THEME.colors.textMuted,
                  marginTop: '6px',
                }}
              >
                New Total Balance:{' '}
                <strong style={{ color: THEME.colors.navyPrimary }}>
                  {submissionSuccess.newBalance} Stars
                </strong>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={onBackToMenu}
            style={{
              width: '100%',
              height: '48px',
              backgroundColor: THEME.colors.navyPrimary,
              color: '#ffffff',
              border: 'none',
              borderRadius: THEME.radius.md,
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
            }}
          >
            ← Return to Restaurant Menu
          </button>
        </div>
      </div>
    );
  }

  // 7. Interactive Feedback Form
  const { order, potentialReward } = eligibilityData;

  return (
    <div
      style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '24px 16px 80px',
        fontFamily: THEME.typography.fontFamily,
      }}
    >
      {/* Header Info Card */}
      <div
        style={{
          backgroundColor: THEME.colors.bgCard,
          border: `1px solid ${THEME.colors.borderSubtle}`,
          borderRadius: THEME.radius.lg,
          padding: '20px',
          marginBottom: '20px',
          boxShadow: THEME.shadow.card,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1
              style={{
                fontSize: '20px',
                fontWeight: 800,
                color: THEME.colors.navyPrimary,
                margin: '0 0 4px',
              }}
            >
              How was your order?
            </h1>
            <p style={{ fontSize: '13px', color: THEME.colors.textMuted, margin: 0 }}>
              Order #{order.orderNumber} • {order.restaurantName}
              {order.tableNumber ? ` • Table ${order.tableNumber}` : ''}
            </p>
          </div>
          {potentialReward.isActive && potentialReward.baseStars > 0 && (
            <div
              style={{
                backgroundColor: THEME.colors.bgCardHighlight,
                border: '1px solid #e5d8b8',
                borderRadius: THEME.radius.sm,
                padding: '6px 10px',
                fontSize: '11px',
                fontWeight: 700,
                color: THEME.colors.accentGold,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>⭐</span>
              <span>Earn +{potentialReward.baseStars} Stars</span>
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Overall Experience Card */}
        <div
          style={{
            backgroundColor: THEME.colors.bgCard,
            border: `1px solid ${THEME.colors.borderSubtle}`,
            borderRadius: THEME.radius.lg,
            padding: '24px 20px',
            marginBottom: '20px',
            boxShadow: THEME.shadow.card,
          }}
        >
          <label
            style={{
              display: 'block',
              fontSize: '15px',
              fontWeight: 800,
              color: THEME.colors.navyPrimary,
              marginBottom: '14px',
              textAlign: 'center',
            }}
          >
            Overall Dining Experience
          </label>

          {/* Interactive Star Control */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '8px',
            }}
          >
            {[1, 2, 3, 4, 5].map((star) => {
              const active = (hoverRating !== null ? hoverRating : overallRating) >= star;
              return (
                <button
                  key={star}
                  type="button"
                  onClick={() => setOverallRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '36px',
                    lineHeight: 1,
                    padding: '6px',
                    color: active ? THEME.colors.accentGold : '#e2e8f0',
                    transition: 'transform 0.1s ease, color 0.1s ease',
                    transform: (hoverRating || overallRating) === star ? 'scale(1.15)' : 'scale(1)',
                  }}
                  aria-label={`${star} star`}
                >
                  ★
                </button>
              );
            })}
          </div>

          <div
            style={{
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 700,
              color: THEME.colors.accentGold,
              minHeight: '20px',
              marginBottom: '18px',
            }}
          >
            {RATING_LABELS[hoverRating !== null ? hoverRating : overallRating]}
          </div>

          {/* Overall Comment Textarea */}
          <div>
            <label
              htmlFor="overall-comment"
              style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: 700,
                color: THEME.colors.textMuted,
                marginBottom: '6px',
              }}
            >
              Overall Comments (Optional)
            </label>
            <textarea
              id="overall-comment"
              rows={3}
              value={overallComment}
              onChange={(e) => setOverallComment(e.target.value)}
              placeholder="Tell us what you loved or how we can improve..."
              maxLength={1000}
              style={{
                width: '100%',
                boxSizing: 'border-box',
                padding: '12px',
                borderRadius: THEME.radius.md,
                border: `1px solid ${THEME.colors.borderSubtle}`,
                fontSize: '14px',
                fontFamily: THEME.typography.fontFamily,
                color: THEME.colors.textMain,
                backgroundColor: THEME.colors.bgCardSubtle,
                resize: 'vertical',
                outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Individual Ordered Item Cards */}
        {order.items.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <h2
                style={{
                  fontSize: '16px',
                  fontWeight: 800,
                  color: THEME.colors.navyPrimary,
                  margin: 0,
                }}
              >
                Rate Your Ordered Dishes
              </h2>
              <span style={{ fontSize: '12px', color: THEME.colors.textMuted }}>
                {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {order.items.map((item) => {
                const currentRating = itemRatings[item.productId] ?? 5;
                const currentComment = itemComments[item.productId] ?? '';

                return (
                  <div
                    key={item.productId}
                    style={{
                      backgroundColor: THEME.colors.bgCard,
                      border: `1px solid ${THEME.colors.borderSubtle}`,
                      borderRadius: THEME.radius.lg,
                      padding: '16px',
                      boxShadow: THEME.shadow.card,
                    }}
                  >
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      {/* Product Image or Fallback */}
                      <div
                        style={{
                          width: '52px',
                          height: '52px',
                          borderRadius: THEME.radius.md,
                          backgroundColor: THEME.colors.bgCardSubtle,
                          flexShrink: 0,
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '22px',
                          border: `1px solid ${THEME.colors.borderSubtle}`,
                        }}
                      >
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.productName}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          '🍲'
                        )}
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: '14px',
                            fontWeight: 800,
                            color: THEME.colors.textMain,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {item.productName}
                        </div>
                        {(item.variantName || item.addons.length > 0) && (
                          <div
                            style={{
                              fontSize: '12px',
                              color: THEME.colors.textMuted,
                              marginTop: '2px',
                            }}
                          >
                            {item.variantName}
                            {item.variantName && item.addons.length > 0 ? ' • ' : ''}
                            {item.addons.join(', ')}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Star Rating for Item */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '12px',
                        paddingTop: '12px',
                        borderTop: `1px solid ${THEME.colors.borderSubtle}`,
                      }}
                    >
                      <span style={{ fontSize: '13px', fontWeight: 600, color: THEME.colors.textMain }}>
                        Dish Rating
                      </span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() =>
                              setItemRatings((prev) => ({
                                ...prev,
                                [item.productId]: star,
                              }))
                            }
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              fontSize: '22px',
                              lineHeight: 1,
                              padding: '2px',
                              color: currentRating >= star ? THEME.colors.accentGold : '#e2e8f0',
                            }}
                            aria-label={`${star} star rating for ${item.productName}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Optional Item Comment */}
                    <div style={{ marginTop: '10px' }}>
                      <input
                        type="text"
                        value={currentComment}
                        onChange={(e) =>
                          setItemComments((prev) => ({
                            ...prev,
                            [item.productId]: e.target.value,
                          }))
                        }
                        placeholder={`Comments on ${item.productName} (optional)...`}
                        maxLength={500}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          padding: '8px 12px',
                          borderRadius: THEME.radius.sm,
                          border: `1px solid ${THEME.colors.borderSubtle}`,
                          fontSize: '13px',
                          fontFamily: THEME.typography.fontFamily,
                          color: THEME.colors.textMain,
                          backgroundColor: THEME.colors.bgCardSubtle,
                          outline: 'none',
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Submit Error Banner */}
        {submitError && (
          <div
            style={{
              backgroundColor: THEME.colors.badgeRedBg,
              border: `1px solid ${THEME.colors.badgeRed}`,
              color: THEME.colors.badgeRed,
              padding: '12px 16px',
              borderRadius: THEME.radius.md,
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{submitError}</span>
          </div>
        )}

        {/* Submit Action Button */}
        <button
          type="submit"
          disabled={submitting}
          style={{
            width: '100%',
            height: '52px',
            backgroundColor: THEME.colors.navyPrimary,
            color: '#ffffff',
            border: 'none',
            borderRadius: THEME.radius.md,
            fontSize: '16px',
            fontWeight: 700,
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.75 : 1,
            boxShadow: '0 4px 14px rgba(23, 63, 112, 0.25)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'background-color 0.15s ease',
          }}
        >
          {submitting ? (
            <>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span>Submitting Feedback...</span>
            </>
          ) : (
            <>
              <span>Submit Feedback & Earn Rewards</span>
              <span style={{ fontSize: '18px' }}>★</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
