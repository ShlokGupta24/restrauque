import React, { useState, useEffect } from 'react';
import {
  ChevronLeft,
  Star,
  Check,
  Menu,
  AlertCircle,
  RefreshCw,
  Award,
  Clock,
  CheckCircle2,
  UtensilsCrossed,
} from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import {
  fetchOrderFeedbackEligibility,
  submitOrderFeedback,
  isValidUuid,
  FeedbackEligibilityResult,
  FeedbackSubmissionResult,
} from '../../services/feedbackService';
import { ApiClientError } from '../../services/apiClient';
import './FeedbackScreen.css';

/**
 * Screen 09: Customer Feedback & Loyalty Integration
 *
 * Requirements:
 * - Server-authoritative order eligibility and item listing via GET /api/v1/customer/orders/[orderId]/feedback.
 * - Submits typed feedback via POST /api/v1/customer/orders/[orderId]/feedback.
 * - Requires real, authenticated order ID; never falls back to mock fixtures.
 * - Displays server-awarded loyalty stars upon submission confirmation.
 * - Handles already-submitted, ineligible, loading, error, and success states gracefully.
 */
export const FeedbackScreen: React.FC = () => {
  const { activeOrderId, goBack, navigateTo, openNav } = useApp();

  const [eligibility, setEligibility] = useState<FeedbackEligibilityResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // Form inputs
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [itemHoverRatings, setItemHoverRatings] = useState<Record<string, number | null>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState<string>('');

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<FeedbackSubmissionResult | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

  // Load server-authoritative feedback eligibility
  const loadEligibility = React.useCallback(async () => {
    if (!activeOrderId || !isValidUuid(activeOrderId)) {
      setIsLoading(false);
      setEligibility(null);
      setEligibilityError('No valid order selected for feedback.');
      return;
    }

    setIsLoading(true);
    setEligibilityError(null);

    const controller = new AbortController();
    try {
      const res = await fetchOrderFeedbackEligibility(activeOrderId, controller.signal);
      setEligibility(res);
      setEligibilityError(null);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.code === 'ABORTED') return;
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Unable to load order feedback details. Please check your connection.';
      setEligibilityError(msg);
      setEligibility(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeOrderId]);

  useEffect(() => {
    loadEligibility();
  }, [loadEligibility]);

  const handleItemRatingChange = (productId: string, starVal: number) => {
    setItemRatings((prev) => ({ ...prev, [productId]: starVal }));
  };

  const handleItemHover = (productId: string, starVal: number | null) => {
    setItemHoverRatings((prev) => ({ ...prev, [productId]: starVal }));
  };

  const handleItemCommentChange = (productId: string, comment: string) => {
    setItemComments((prev) => ({ ...prev, [productId]: comment }));
  };

  const handleSubmitFeedback = async () => {
    if (!activeOrderId || !isValidUuid(activeOrderId)) {
      setSubmissionError('Cannot submit feedback: missing valid order ID.');
      return;
    }

    if (!rating || rating < 1 || rating > 5) {
      setSubmissionError('Please select an overall rating (1 to 5 stars) for your dining experience.');
      return;
    }

    if (!eligibility || !eligibility.isEligible) {
      setSubmissionError('This order is not currently eligible for feedback.');
      return;
    }

    try {
      setIsSubmitting(true);
      setSubmissionError(null);

      // Map reviewed items only (deduplicating by productId to prevent duplicate reviews in same request)
      const reviewedProductIds = new Set<string>();
      const itemsPayload: { productId: string; rating: number; comment: string | null }[] = [];
      for (const item of eligibility.order.items) {
        if (reviewedProductIds.has(item.productId)) continue;
        const hasRating = itemRatings[item.productId] !== undefined && itemRatings[item.productId] > 0;
        const hasComment = Boolean(itemComments[item.productId]?.trim());
        if (hasRating || hasComment) {
          reviewedProductIds.add(item.productId);
          itemsPayload.push({
            productId: item.productId,
            rating: itemRatings[item.productId] || rating,
            comment: itemComments[item.productId]?.trim() || null,
          });
        }
      }

      const result = await submitOrderFeedback(activeOrderId, {
        rating,
        comment: overallComment.trim() || null,
        items: itemsPayload,
      });

      setSubmissionResult(result);
      setShowSuccessModal(true);

      // Refresh eligibility so UI state immediately reflects persisted feedback
      loadEligibility().catch((e) => console.warn('Could not refresh feedback eligibility:', e));
    } catch (err: unknown) {
      console.error('Failed to submit feedback:', err);
      const msg =
        err instanceof ApiClientError
          ? err.message
          : 'Could not submit feedback. Please check your connection and try again.';
      setSubmissionError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    navigateTo('menu');
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  // Case 1: Missing or invalid order context
  if (!activeOrderId || !isValidUuid(activeOrderId)) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <button className="back-button" onClick={goBack} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="feedback-header-title">Feedback</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div className="feedback-state-container">
          <div className="feedback-state-icon info">
            <UtensilsCrossed size={28} />
          </div>
          <h2 className="feedback-state-title">No Order Selected</h2>
          <p className="feedback-state-desc">
            To leave dining feedback, please open a completed order from your order history.
          </p>
          <div className="feedback-state-actions">
            <button
              className="state-primary-btn"
              onClick={() => navigateTo('order-history')}
              type="button"
            >
              View Order History
            </button>
            <button
              className="state-secondary-btn"
              onClick={() => navigateTo('menu')}
              type="button"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Loading eligibility from server
  if (isLoading) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <button className="back-button" onClick={goBack} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="feedback-header-title">Feedback</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div className="feedback-state-container">
          <div className="feedback-state-icon info">
            <RefreshCw size={28} className="feedback-spinner" />
          </div>
          <h2 className="feedback-state-title">Checking Order Eligibility</h2>
          <p className="feedback-state-desc">
            Verifying your order status with the restaurant...
          </p>
        </div>
      </div>
    );
  }

  // Case 3: Error loading eligibility
  if (eligibilityError || !eligibility) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <button className="back-button" onClick={goBack} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="feedback-header-title">Feedback</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div className="feedback-state-container">
          <div className="feedback-state-icon error">
            <AlertCircle size={28} />
          </div>
          <h2 className="feedback-state-title">Unable to Load Feedback</h2>
          <p className="feedback-state-desc">{eligibilityError || 'Order not found or inaccessible.'}</p>
          <div className="feedback-state-actions">
            <button className="state-primary-btn" onClick={loadEligibility} type="button">
              <RefreshCw size={16} />
              <span>Retry</span>
            </button>
            <button
              className="state-secondary-btn"
              onClick={() => navigateTo('order-history')}
              type="button"
            >
              View Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 4: Feedback already submitted for this order
  if (eligibility.alreadySubmitted) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <button className="back-button" onClick={goBack} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="feedback-header-title">Feedback</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div className="feedback-state-container">
          <div className="feedback-state-icon success">
            <CheckCircle2 size={32} />
          </div>
          <h2 className="feedback-state-title">Feedback Already Submitted</h2>
          <p className="feedback-state-desc">
            You have already shared your dining feedback for Order #{eligibility.order.orderNumber}.
            Thank you for helping us improve!
          </p>

          {eligibility.existingFeedback && (
            <div className="existing-feedback-card">
              <div className="existing-stars-row">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    size={18}
                    fill={(eligibility.existingFeedback?.rating || 0) >= s ? '#F59E0B' : 'none'}
                    stroke="#F59E0B"
                  />
                ))}
                <span style={{ marginLeft: 6, fontWeight: 700, fontSize: 13 }}>
                  {eligibility.existingFeedback.rating} / 5
                </span>
              </div>
              {eligibility.existingFeedback.comment && (
                <p className="existing-comment-text">&ldquo;{eligibility.existingFeedback.comment}&rdquo;</p>
              )}
              <span className="existing-submitted-date">
                Submitted on {new Date(eligibility.existingFeedback.submittedAt).toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="feedback-state-actions">
            <button
              className="state-primary-btn"
              onClick={() => navigateTo('menu')}
              type="button"
            >
              Back to Menu
            </button>
            <button
              className="state-secondary-btn"
              onClick={() => navigateTo('order-history')}
              type="button"
            >
              Order History
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 5: Order exists but is not eligible (e.g. status is preparing/pending)
  if (!eligibility.isEligible) {
    return (
      <div className="feedback-page">
        <header className="feedback-header">
          <button className="back-button" onClick={goBack} aria-label="Go back">
            <ChevronLeft size={24} />
          </button>
          <h1 className="feedback-header-title">Feedback</h1>
          <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
            <Menu size={20} />
          </button>
        </header>

        <div className="feedback-state-container">
          <div className="feedback-state-icon info">
            <Clock size={28} />
          </div>
          <h2 className="feedback-state-title">Order In Progress</h2>
          <p className="feedback-state-desc">
            {eligibility.reason ||
              'Feedback can only be submitted once your meal is marked as completed.'}
          </p>
          <div className="feedback-state-actions">
            <button
              className="state-primary-btn"
              onClick={() => navigateTo('order-confirmation', { orderId: activeOrderId })}
              type="button"
            >
              Track Order Status
            </button>
            <button
              className="state-secondary-btn"
              onClick={() => navigateTo('menu')}
              type="button"
            >
              Back to Menu
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 6: Eligible order — Render full feedback submission form
  return (
    <div className="feedback-page">
      {/* Top Header */}
      <header className="feedback-header">
        <button className="back-button" onClick={goBack} aria-label="Back to order">
          <ChevronLeft size={24} />
        </button>
        <h1 className="feedback-header-title">Your Feedback</h1>
        <button className="back-button hamburger-btn" onClick={openNav} aria-label="Navigation menu">
          <Menu size={20} />
        </button>
      </header>

      {/* Potential Loyalty Reward Banner */}
      {eligibility.potentialReward.isActive && eligibility.potentialReward.baseStars > 0 && (
        <div className="feedback-reward-banner" role="status">
          <Award size={20} />
          <div>
            Earn <strong>+{eligibility.potentialReward.baseStars} loyalty stars</strong> in{' '}
            {eligibility.potentialReward.programName} for sharing your dining experience!
          </div>
        </div>
      )}

      {/* Intro */}
      <section className="feedback-intro">
        <h2 className="feedback-main-title">How was your order?</h2>
        <p className="feedback-main-subtext">
          Your feedback helps {eligibility.order.restaurantName} maintain top-quality service.
        </p>
      </section>

      {/* Server Order Reference Badge */}
      <section className="feedback-order-badge" aria-label="Order Details">
        <span className="badge-order-num">Order #{eligibility.order.orderNumber}</span>
        <span className="badge-order-meta">
          {eligibility.order.restaurantName} ·{' '}
          {eligibility.order.tableNumber ? `Table ${eligibility.order.tableNumber}` : 'Dine-in'}
        </span>
      </section>

      {/* Overall Experience 5-Star Rating */}
      <section className="rating-section" aria-label="Overall Rating">
        <h3 className="rating-section-title">Overall experience</h3>
        <p className="rating-section-prompt">How would you rate the order overall? (Required)</p>
        <div className="star-rating-group" role="radiogroup" aria-label="Rating out of 5 stars">
          {[1, 2, 3, 4, 5].map((starVal) => {
            const isFilled = (hoverRating || rating) >= starVal;
            return (
              <button
                key={starVal}
                type="button"
                role="radio"
                aria-checked={rating === starVal}
                className={`star-btn ${isFilled ? 'filled' : ''}`}
                onMouseEnter={() => setHoverRating(starVal)}
                onMouseLeave={() => setHoverRating(null)}
                onClick={() => {
                  setRating(starVal);
                  setSubmissionError(null);
                }}
                aria-label={`${starVal} star`}
              >
                <Star size={36} strokeWidth={1.5} fill={isFilled ? 'currentColor' : 'none'} />
              </button>
            );
          })}
        </div>
        {(hoverRating || rating) > 0 && (
          <span className="rating-label-text">{ratingLabels[hoverRating || rating]}</span>
        )}
      </section>

      <div className="feedback-divider" />

      {/* Rate Each Item — Populated directly from server-confirmed order items */}
      {eligibility.order.items.length > 0 && (
        <section className="rate-items-section" aria-label="Rate Each Item">
          <div className="rate-items-header">
            <h3 className="rate-items-title">Rate each dish (Optional)</h3>
            <p className="rate-items-desc">Share how each dish was — your detailed feedback means a lot.</p>
          </div>

          {eligibility.order.items.map((item) => {
            const pId = item.productId;
            const currentDishRating = itemRatings[pId] !== undefined ? itemRatings[pId] : 0;
            const currentDishHover = itemHoverRatings[pId] || null;

            return (
              <article key={pId} className="item-review-card">
                <div className="item-review-top">
                  <div className="item-review-thumb">
                    <img
                      src={
                        item.imageUrl ||
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80'
                      }
                      alt={item.productName}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src =
                          'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
                      }}
                    />
                  </div>
                  <div className="item-review-meta">
                    <h4 className="item-review-name">{item.productName}</h4>
                    {item.variantName && (
                      <span className="item-review-variant">{item.variantName}</span>
                    )}
                    <span className="item-review-qty">Qty: {item.quantity}</span>
                  </div>
                </div>

                {/* Per-Dish Star Rating */}
                <div
                  className="item-rating-row"
                  role="radiogroup"
                  aria-label={`Rating for ${item.productName}`}
                >
                  <span className="item-rating-label">Rate dish:</span>
                  <div className="item-stars-group">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isFilled = (currentDishHover || currentDishRating) >= starVal;
                      return (
                        <button
                          key={starVal}
                          type="button"
                          role="radio"
                          aria-checked={currentDishRating === starVal}
                          className={`item-star-btn ${isFilled ? 'filled' : ''}`}
                          onMouseEnter={() => handleItemHover(pId, starVal)}
                          onMouseLeave={() => handleItemHover(pId, null)}
                          onClick={() => handleItemRatingChange(pId, starVal)}
                          aria-label={`${starVal} star for ${item.productName}`}
                        >
                          <Star size={22} strokeWidth={1.5} fill={isFilled ? 'currentColor' : 'none'} />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="item-comment-field">
                  <label htmlFor={`comment-${pId}`} className="item-comment-label">
                    Leave a comment about this dish (max 500 chars)
                  </label>
                  <input
                    id={`comment-${pId}`}
                    type="text"
                    maxLength={500}
                    className="item-comment-input"
                    placeholder="Was it tasty? Any suggestions..."
                    value={itemComments[pId] || ''}
                    onChange={(e) => handleItemCommentChange(pId, e.target.value)}
                  />
                </div>
              </article>
            );
          })}
        </section>
      )}

      {/* General Feedback */}
      <section className="general-feedback-section" aria-label="General Feedback">
        <label htmlFor="overall-note" className="general-label">
          Anything else? (optional, max 1000 chars)
        </label>
        <input
          id="overall-note"
          type="text"
          maxLength={1000}
          className="general-input"
          placeholder="Tell the restaurant anything else..."
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
        />
      </section>

      {/* Sticky Bottom Submit Bar */}
      <div className="feedback-sticky-bar">
        {submissionError && (
          <div className="feedback-error-banner" role="alert">
            <AlertCircle size={16} />
            <span>{submissionError}</span>
          </div>
        )}
        <button
          className="submit-feedback-btn"
          onClick={handleSubmitFeedback}
          disabled={isSubmitting}
          type="button"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>

      {/* Server-Confirmed Success Modal */}
      {showSuccessModal && (
        <div className="feedback-success-overlay" role="dialog" aria-modal="true">
          <div className="feedback-success-modal">
            <div className="success-modal-icon">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="success-modal-title">Thank You!</h3>
            <p className="success-modal-text">
              {submissionResult?.reward && submissionResult.reward.starsAwarded > 0 ? (
                <>
                  Your feedback has been submitted! You earned{' '}
                  <strong>+{submissionResult.reward.starsAwarded} stars</strong> in{' '}
                  {submissionResult.reward.programName}. Your new balance is{' '}
                  <strong>{submissionResult.reward.newBalance} stars</strong>.
                </>
              ) : (
                'Your feedback has been shared with the restaurant team. Thank you for helping us improve!'
              )}
            </p>
            <button className="success-modal-btn" onClick={handleDone} type="button">
              Back to Menu
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
