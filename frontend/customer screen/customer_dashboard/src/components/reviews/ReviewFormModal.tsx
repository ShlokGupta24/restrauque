import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Send,
  Clock,
  ShieldCheck,
} from 'lucide-react';
import { StarRating } from '../common/StarRating';
import {
  fetchOrderFeedbackEligibility,
  submitOrderFeedback,
  FeedbackEligibilityResult,
  FeedbackSubmissionResult,
} from '../../services/feedbackService';
import { ApiClientError } from '../../services/apiClient';
import './ReviewFormModal.css';

export interface ReviewFormModalProps {
  orderId?: string;
  order?: {
    id?: string;
    orderId?: string;
    orderNumber?: string;
    restaurantName?: string;
    restaurant?: { id: string; name: string } | null;
    tableLabel?: string | null;
    table?: { tableNumber?: string; id?: string } | null;
    items?: any[];
    [key: string]: any;
  } | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (result?: FeedbackSubmissionResult) => void;
}

export const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  orderId: propOrderId,
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  // Resolve target order ID from either explicit prop or order object
  const targetOrderId = propOrderId || order?.id || order?.orderId || '';

  // Eligibility & order state from live backend
  const [eligibility, setEligibility] = useState<FeedbackEligibilityResult | null>(null);
  const [loadingEligibility, setLoadingEligibility] = useState<boolean>(true);
  const [eligibilityError, setEligibilityError] = useState<string | null>(null);

  // Form input state
  const [overallRating, setOverallRating] = useState<number>(5);
  const [overallComment, setOverallComment] = useState<string>('');
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});
  const [dishComments, setDishComments] = useState<Record<string, string>>({});

  // Submission state
  const [submitting, setSubmitting] = useState<boolean>(false);
  const isSubmittingRef = useRef<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedResult, setSubmittedResult] = useState<FeedbackSubmissionResult | null>(null);

  // Load authoritative eligibility on modal open
  useEffect(() => {
    if (!isOpen || !targetOrderId) {
      setEligibility(null);
      setEligibilityError(null);
      setSubmittedResult(null);
      setSubmitError(null);
      return;
    }

    const abortController = new AbortController();
    setLoadingEligibility(true);
    setEligibilityError(null);
    setSubmittedResult(null);
    setSubmitError(null);

    fetchOrderFeedbackEligibility(targetOrderId, abortController.signal)
      .then((data) => {
        setEligibility(data);
        setLoadingEligibility(false);
      })
      .catch((err: any) => {
        if (abortController.signal.aborted) return;
        setLoadingEligibility(false);

        if (err instanceof ApiClientError) {
          if (err.status === 404 || err.status === 403) {
            setEligibilityError(
              'Order not found or inaccessible. You can only view and review orders associated with your account.'
            );
          } else if (err.status === 401) {
            setEligibilityError('Your session has expired. Please sign in to submit feedback.');
          } else {
            setEligibilityError(err.message || 'Unable to check review eligibility.');
          }
        } else {
          setEligibilityError('Unable to load order details. Please check your network connection.');
        }
      });

    return () => {
      abortController.abort();
    };
  }, [isOpen, targetOrderId]);

  if (!isOpen) return null;

  const handleDishRatingChange = (productId: string, rating: number) => {
    setDishRatings((prev) => ({ ...prev, [productId]: rating }));
  };

  const handleDishCommentChange = (productId: string, text: string) => {
    setDishComments((prev) => ({ ...prev, [productId]: text }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (isSubmittingRef.current || submitting) return;

    if (!targetOrderId) {
      setSubmitError('Invalid order identifier.');
      return;
    }

    if (!Number.isInteger(overallRating) || overallRating < 1 || overallRating > 5) {
      setSubmitError('Please select an overall rating between 1 and 5 stars.');
      return;
    }

    // Prepare item feedback if any ordered items exist
    const itemsPayload: Array<{ productId: string; rating: number; comment?: string | null }> = [];
    if (eligibility?.order.items && eligibility.order.items.length > 0) {
      for (const item of eligibility.order.items) {
        const rating = dishRatings[item.productId] ?? overallRating;
        const comment = dishComments[item.productId]?.trim() || null;
        itemsPayload.push({
          productId: item.productId,
          rating,
          comment,
        });
      }
    }

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await submitOrderFeedback(targetOrderId, {
        rating: overallRating,
        comment: overallComment.trim() || null,
        items: itemsPayload.length > 0 ? itemsPayload : undefined,
      });

      setSubmittedResult(result);
      if (onSuccess) {
        onSuccess(result);
      }
    } catch (err: any) {
      if (err instanceof ApiClientError) {
        if (err.status === 409) {
          setSubmitError('Feedback has already been submitted for this order.');
        } else if (err.status === 400) {
          setSubmitError(err.message || 'Please verify your rating and comments.');
        } else if (err.status === 401) {
          setSubmitError('Your session has expired. Please sign in again.');
        } else {
          setSubmitError(err.message || 'Could not submit review. Please try again.');
        }
      } else {
        setSubmitError(err?.message || 'Could not submit review. Please try again.');
      }
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  // Derive venue name and metadata from live eligibility or fallback order props
  const venueName =
    eligibility?.order.restaurantName ||
    order?.restaurantName ||
    order?.restaurant?.name ||
    'Restaurant';

  const orderNum = eligibility?.order.orderNumber || order?.orderNumber || '';
  const tableNum = eligibility?.order.tableNumber || order?.tableLabel || order?.table?.tableNumber || null;

  return (
    <div
      className="review-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className="review-modal-container">
        {/* Header */}
        <div className="review-modal-header">
          <h2 id="review-modal-title" className="review-modal-title">
            {submittedResult
              ? 'Review Submitted!'
              : eligibility?.alreadySubmitted
              ? 'Your Submitted Review'
              : 'Write Order Review'}
          </h2>
          <button
            type="button"
            className="review-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
            disabled={submitting}
          >
            <X size={20} />
          </button>
        </div>

        {/* ================= MODAL BODY ================= */}
        {loadingEligibility ? (
          <div className="review-modal-body" style={{ alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  border: '3px solid var(--border-color)',
                  borderTopColor: 'var(--brand-red)',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }}
              />
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                Checking order review eligibility...
              </span>
            </div>
          </div>
        ) : eligibilityError ? (
          <div className="review-modal-body">
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#991b1b',
              }}
            >
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Unable to load review
                </h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
                  {eligibilityError}
                </p>
              </div>
            </div>
            <div className="review-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : submittedResult ? (
          /* ================= SUCCESS OUTCOME STATE ================= */
          <div className="review-modal-body">
            <div className="review-success-card">
              <div className="review-success-icon-wrap">
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Thank you for your feedback!
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '420px', margin: '4px 0 12px' }}>
                Your review has been verified and recorded for <strong>{venueName}</strong>.
              </p>

              {submittedResult.reward && submittedResult.reward.isRewardEarned && submittedResult.reward.starsAwarded > 0 ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#fef3c7',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    padding: '8px 16px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 600,
                    fontSize: '13.5px',
                  }}
                >
                  <Sparkles size={16} />
                  <span>
                    +{submittedResult.reward.starsAwarded} Points Added to Your {submittedResult.reward.programName || venueName} Wallet (Balance: {submittedResult.reward.newBalance})
                  </span>
                </div>
              ) : (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f3f4f6',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    padding: '6px 14px',
                    borderRadius: 'var(--radius-pill)',
                    fontWeight: 500,
                    fontSize: '13px',
                  }}
                >
                  <CheckCircle2 size={15} className="text-emerald" />
                  <span>Feedback recorded successfully</span>
                </div>
              )}

              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px' }}>
                Strict Policy Enforced: Each completed dining visit allows exactly one verified review.
              </p>
            </div>
            <div className="review-modal-footer">
              <button type="button" className="btn btn-primary-red" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : eligibility?.alreadySubmitted ? (
          /* ================= READ-ONLY EXISTING REVIEW STATE ================= */
          <div className="review-modal-body">
            <div className="review-order-summary-box">
              <div>
                <div className="review-order-venue">{venueName}</div>
                <div className="review-order-meta">
                  {orderNum ? `#${orderNum}` : ''}
                  {tableNum ? ` • Table ${tableNum}` : ''}
                </div>
              </div>
              <span className="badge badge-success">Review Submitted</span>
            </div>

            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <StarRating
                  value={eligibility.existingFeedback?.rating || 5}
                  readonly
                  size={18}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Overall Rating ({eligibility.existingFeedback?.rating || 5}.0 / 5.0)
                </span>
              </div>

              {eligibility.existingFeedback?.comment && (
                <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: 0 }}>
                  &ldquo;{eligibility.existingFeedback.comment}&rdquo;
                </p>
              )}

              {/* Existing item-level feedback if any */}
              {eligibility.existingFeedback?.itemFeedback &&
                eligibility.existingFeedback.itemFeedback.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--text-muted)' }}>
                      Dish-Specific Ratings
                    </div>
                    {eligibility.existingFeedback.itemFeedback.map((item) => (
                      <div
                        key={item.productId}
                        style={{
                          background: 'var(--bg-card)',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-light)',
                          fontSize: '12.5px',
                        }}
                      >
                        {item.rating && <StarRating value={item.rating} readonly size={14} />}
                        {item.comment && (
                          <div style={{ color: 'var(--text-secondary)', marginTop: '4px' }}>
                            {item.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Submitted on{' '}
                {eligibility.existingFeedback?.submittedAt
                  ? new Date(eligibility.existingFeedback.submittedAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })
                  : 'Recent visit'}
              </div>
            </div>

            <div
              style={{
                background: 'var(--bg-app)',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <ShieldCheck size={16} style={{ color: '#059669', flexShrink: 0 }} />
              <span>
                <strong>Policy Notice:</strong> Exactly one review is permitted per completed dining order. Further submissions for this visit are locked.
              </span>
            </div>

            <div className="review-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : !eligibility?.isEligible ? (
          /* ================= INELIGIBLE ORDER STATE ================= */
          <div className="review-modal-body">
            <div className="review-order-summary-box">
              <div>
                <div className="review-order-venue">{venueName}</div>
                <div className="review-order-meta">
                  {orderNum ? `#${orderNum}` : ''}
                  {tableNum ? ` • Table ${tableNum}` : ''}
                </div>
              </div>
              <span className="badge badge-warning">Awaiting Completion</span>
            </div>

            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px',
                color: '#92400e',
              }}
            >
              <Clock size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <h4 style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 600 }}>
                  Feedback Not Yet Available
                </h4>
                <p style={{ margin: 0, fontSize: '13px', lineHeight: 1.4 }}>
                  {eligibility?.reason ||
                    'Feedback can only be submitted once your meal is completed.'}
                </p>
              </div>
            </div>

            <div className="review-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          /* ================= ACTIVE REVIEW FORM STATE ================= */
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <div className="review-modal-body">
              {/* Order Reference Box */}
              <div className="review-order-summary-box">
                <div>
                  <div className="review-order-venue">{venueName}</div>
                  <div className="review-order-meta">
                    {orderNum ? `#${orderNum}` : ''}
                    {tableNum ? ` • Table ${tableNum}` : ''}
                  </div>
                </div>
                {eligibility.potentialReward.isActive && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '12.5px',
                      fontWeight: 600,
                      color: 'var(--brand-red)',
                    }}
                  >
                    <Sparkles size={14} />
                    <span>+{eligibility.potentialReward.baseStars} Pts</span>
                  </div>
                )}
              </div>

              {/* Submit Error banner if any */}
              {submitError && (
                <div
                  style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-md)',
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    color: '#b91c1c',
                    fontSize: '13px',
                  }}
                >
                  <AlertCircle size={16} style={{ flexShrink: 0 }} />
                  <span>{submitError}</span>
                </div>
              )}

              {/* Overall Star Rating */}
              <div className="review-section-block">
                <label className="review-section-label">
                  Overall Experience Rating <span style={{ color: 'var(--brand-red)' }}>*</span>
                </label>
                <StarRating
                  value={overallRating}
                  onChange={setOverallRating}
                  size={28}
                  showLabel={true}
                />
              </div>

              {/* Overall Written Review */}
              <div className="review-section-block">
                <label htmlFor="overall-comment" className="review-section-label">
                  Overall Feedback / Comments
                </label>
                <textarea
                  id="overall-comment"
                  className="review-textarea"
                  placeholder="Share details of your dining visit, food quality, service, or ambience..."
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  maxLength={1000}
                  disabled={submitting}
                />
                <span className="review-rule-note">
                  Strict Rule: Exactly 1 review per completed visit. Max 1,000 characters.
                </span>
              </div>

              {/* Optional Item-Level Comments */}
              {eligibility.order.items && eligibility.order.items.length > 0 && (
                <div className="review-dishes-list">
                  <div className="review-section-label">
                    Rate Ordered Dishes (Optional)
                  </div>
                  <p className="review-rule-note">
                    Dish ratings and comments belong to this order review. They will not create separate duplicate reviews.
                  </p>

                  {eligibility.order.items.map((dish) => (
                    <div key={dish.productId} className="review-dish-item-card">
                      <div className="review-dish-top">
                        <span className="review-dish-name">
                          {dish.productName} {dish.variantName ? `(${dish.variantName})` : ''}
                        </span>
                        <StarRating
                          value={dishRatings[dish.productId] ?? overallRating}
                          onChange={(r) => handleDishRatingChange(dish.productId, r)}
                          size={16}
                        />
                      </div>
                      <input
                        type="text"
                        className="review-dish-input"
                        placeholder={`Thoughts on ${dish.productName}? (e.g. freshness, flavor)`}
                        value={dishComments[dish.productId] || ''}
                        onChange={(e) => handleDishCommentChange(dish.productId, e.target.value)}
                        maxLength={500}
                        disabled={submitting}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="review-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary-red"
                disabled={submitting}
              >
                {submitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Send size={15} />
                    <span>
                      Submit Review
                      {eligibility.potentialReward.isActive
                        ? ` (+${eligibility.potentialReward.baseStars} pts)`
                        : ''}
                    </span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
