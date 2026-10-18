import React, { useState } from 'react';
import { X, CheckCircle2, AlertCircle, Sparkles, Send } from 'lucide-react';
import { CustomerOrder, ItemReviewAspect } from '../../services/types';
import { customerDashboardService } from '../../services/CustomerDashboardService';
import { StarRating } from '../common/StarRating';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './ReviewFormModal.css';

interface ReviewFormModalProps {
  order: CustomerOrder;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewFormModal: React.FC<ReviewFormModalProps> = ({
  order,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { refreshData } = useCustomerAuth();
  const [overallRating, setOverallRating] = useState<number>(5);
  const [overallComment, setOverallComment] = useState<string>('');
  const [dishRatings, setDishRatings] = useState<Record<string, number>>({});
  const [dishComments, setDishComments] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReview, setSubmittedReview] = useState<any | null>(null);

  if (!isOpen) return null;

  // Check if order was already reviewed (Strict 1 review rule)
  const isAlreadySubmitted = order.reviewStatus === 'submitted';
  const existingReview = isAlreadySubmitted
    ? customerDashboardService.getReviewByOrderId(order.orderId)
    : null;

  const handleDishRatingChange = (productId: string, rating: number) => {
    setDishRatings((prev) => ({ ...prev, [productId]: rating }));
  };

  const handleDishCommentChange = (productId: string, text: string) => {
    setDishComments((prev) => ({ ...prev, [productId]: text }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (overallRating < 1) {
      setError('Please select an overall star rating (1–5 stars).');
      return;
    }

    setSubmitting(true);

    try {
      // Assemble item-level aspects into the single parent order review
      const itemAspects: ItemReviewAspect[] = order.items.map((item) => ({
        productId: item.productId,
        productName: item.name,
        rating: dishRatings[item.productId] || overallRating,
        comment: dishComments[item.productId] || '',
      }));

      const result = customerDashboardService.submitOrderReview({
        orderId: order.orderId,
        overallRating,
        overallComment,
        items: itemAspects,
      });

      setSubmittedReview(result);
      refreshData();
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Could not submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

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
            {submittedReview
              ? 'Review Submitted!'
              : isAlreadySubmitted
              ? 'Your Submitted Review'
              : 'Write Order Review'}
          </h2>
          <button
            type="button"
            className="review-modal-close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        {submittedReview ? (
          <div className="review-modal-body">
            <div className="review-success-card">
              <div className="review-success-icon-wrap">
                <CheckCircle2 size={36} />
              </div>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                Thank you for your feedback!
              </h3>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', maxWidth: '400px' }}>
                Your review has been verified and recorded for <strong>{order.restaurantName}</strong>.
              </p>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#fef3c7',
                  border: '1px solid #fde68a',
                  color: '#92400e',
                  padding: '6px 14px',
                  borderRadius: 'var(--radius-pill)',
                  fontWeight: 600,
                  fontSize: '13px',
                }}
              >
                <Sparkles size={14} />
                <span>+50 Loyalty Points Added to Your {order.restaurantName} Wallet</span>
              </div>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                Strict Rule Enforced: This completed order cannot be reviewed again.
              </p>
            </div>
            <div className="review-modal-footer">
              <button type="button" className="btn btn-primary-red" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : isAlreadySubmitted ? (
          <div className="review-modal-body">
            <div className="review-order-summary-box">
              <div>
                <div className="review-order-venue">{order.restaurantName}</div>
                <div className="review-order-meta">
                  {order.orderNumber} • Ordered on {order.orderedAt}
                </div>
              </div>
              <span className="badge badge-success">Review Submitted</span>
            </div>

            <div
              style={{
                background: '#f8fafc',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-md)',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <StarRating value={existingReview?.overallRating || 5} readonly size={18} />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Overall Rating
                </span>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                &ldquo;{existingReview?.overallComment || 'Great experience!'}&rdquo;
              </p>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '10px' }}>
                Submitted on {existingReview?.submittedAt || 'Recent visit'}
              </div>
            </div>

            <div
              style={{
                background: '#f3f4f6',
                borderRadius: 'var(--radius-md)',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>Policy Note:</strong> Customers may submit exactly one overall review per completed order. Further submissions for this order are locked.
            </div>

            <div className="review-modal-footer">
              <button type="button" className="btn btn-outline" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'contents' }}>
            <div className="review-modal-body">
              {/* Order Reference Box */}
              <div className="review-order-summary-box">
                <div>
                  <div className="review-order-venue">{order.restaurantName}</div>
                  <div className="review-order-meta">
                    {order.orderNumber} • {order.tableLabel} • {order.orderedAt}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: 'var(--brand-red)',
                  }}
                >
                  <Sparkles size={13} />
                  <span>Earn 50 Pts</span>
                </div>
              </div>

              {/* Error display if any */}
              {error && (
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
                  <AlertCircle size={16} />
                  <span>{error}</span>
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
                  placeholder="Share details of your visit, food quality, or dining ambience..."
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  maxLength={500}
                />
                <span className="review-rule-note">
                  One review per order. Your review helps restaurant chefs and service staff improve.
                </span>
              </div>

              {/* Optional Item-Level Comments */}
              {order.items && order.items.length > 0 && (
                <div className="review-dishes-list">
                  <div className="review-section-label">
                    Rate Ordered Dishes (Optional)
                  </div>
                  <p className="review-rule-note">
                    Dish ratings and comments belong to this order review. They will not create separate duplicate reviews.
                  </p>

                  {order.items.map((dish) => (
                    <div key={dish.productId} className="review-dish-item-card">
                      <div className="review-dish-top">
                        <span className="review-dish-name">
                          {dish.name} {dish.variantName ? `(${dish.variantName})` : ''}
                        </span>
                        <StarRating
                          value={dishRatings[dish.productId] || overallRating}
                          onChange={(r) => handleDishRatingChange(dish.productId, r)}
                          size={16}
                        />
                      </div>
                      <input
                        type="text"
                        className="review-dish-input"
                        placeholder={`Thoughts on the ${dish.name}? (e.g. flavor, freshness)`}
                        value={dishComments[dish.productId] || ''}
                        onChange={(e) => handleDishCommentChange(dish.productId, e.target.value)}
                        maxLength={150}
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
                    <span>Submit Review (+50 pts)</span>
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
