import React, { useState, useEffect } from 'react';
import { ChevronLeft, Star, Check, Menu } from 'lucide-react';
import { useApp } from '../../hooks/useAppContext';
import { customerDataService } from '../../services';
import { FeedbackAspectPayload, OrderConfirmationDetails } from '../../services/contracts/types';
import { mockCompletedOrderForFeedback } from '../../mocks/order.mock';
import './FeedbackScreen.css';

/**
 * Screen 09: Post-Completion Customer Feedback
 * - Always shows feedback form (gatekeeper "Order in Progress" screen removed)
 * - Shows actual ordered items (not static mock data)
 * - Loyalty points info driven by restaurant config (to be fetched later)
 */
export const FeedbackScreen: React.FC = () => {
  const { restaurant, activeOrderId, goBack, navigateTo, openNav } = useApp();

  const [order, setOrder] = useState<OrderConfirmationDetails>(mockCompletedOrderForFeedback);
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  useEffect(() => {
    if (activeOrderId) {
      customerDataService
        .getOrderStatus(activeOrderId)
        .then((res) => {
          if (res && res.items && res.items.length > 0) {
            setOrder(res);
          }
        })
        .catch((err) => {
          console.warn('Using fallback order data for feedback:', err);
        });
    }
  }, [activeOrderId]);

  // Per-dish ratings and hover states
  const [itemRatings, setItemRatings] = useState<Record<string, number>>({});
  const [itemHoverRatings, setItemHoverRatings] = useState<Record<string, number | null>>({});
  const [itemComments, setItemComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);

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
    try {
      setLoading(true);

      const aspects: FeedbackAspectPayload[] = [];
      order.items.forEach((item, idx) => {
        const pId = item.productId || `item-${idx}`;
        const comment = itemComments[pId]?.trim();
        const starVal = itemRatings[pId] !== undefined ? itemRatings[pId] : 5;

        if (comment) {
          const sentiment: 'positive' | 'negative' | 'neutral' =
            starVal >= 4 ? 'positive' : starVal <= 2 ? 'negative' : 'neutral';
          aspects.push({
            aspect: 'item_review',
            sentiment,
            aspect_value: comment.slice(0, 100),
          });
        }
      });

      const itemsPayload = order.items.map((item, idx) => {
        const pId = item.productId || `item-${idx}`;
        return {
          productId: pId,
          productName: item.name,
          rating: itemRatings[pId] !== undefined ? itemRatings[pId] : 5,
          comment: itemComments[pId]?.trim() || undefined,
        };
      });

      await customerDataService.submitFeedback({
        orderId: activeOrderId || order.orderId,
        overallRating: rating || 5,
        overallComment: overallComment.trim() || undefined,
        aspects,
        items: itemsPayload,
      });

      setShowSuccessModal(true);
    } catch (err) {
      console.error('Failed to submit feedback:', err);
      alert('Could not submit feedback. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDone = () => {
    setShowSuccessModal(false);
    navigateTo('landing');
  };

  const ratingLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

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

      {/* Intro */}
      <section className="feedback-intro">
        <h2 className="feedback-main-title">How was your order?</h2>
        <p className="feedback-main-subtext">
          Your feedback helps us improve. Every honest review earns you loyalty points!
        </p>
      </section>

      {/* Order Reference Badge */}
      <section className="feedback-order-badge" aria-label="Order Details">
        <span className="badge-order-num">Order {order.orderNumber || `#${order.orderId}`}</span>
        <span className="badge-order-meta">
          {restaurant?.name || order.restaurantName || 'NBC - Engineering College'} ·{' '}
          {restaurant?.tableLabel || order.tableLabel || 'Table F18'}
        </span>
      </section>

      {/* Overall Experience 5-Star Rating */}
      <section className="rating-section" aria-label="Overall Rating">
        <h3 className="rating-section-title">Overall experience</h3>
        <p className="rating-section-prompt">How would you rate the order overall?</p>
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
                onClick={() => setRating(starVal)}
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

      {/* Rate Each Item — shows actual ordered items */}
      <section className="rate-items-section" aria-label="Rate Each Item">
        <div className="rate-items-header">
          <h3 className="rate-items-title">Rate each item</h3>
          <p className="rate-items-desc">Share how each dish was — your detailed feedback means a lot.</p>
        </div>

        {order.items.map((item, idx) => {
          const pId = item.productId || `item-${idx}`;
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
                    alt={item.name}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=200&q=80';
                    }}
                  />
                </div>
                <div className="item-review-meta">
                  <h4 className="item-review-name">{item.name}</h4>
                  {item.variantName && (
                    <span className="item-review-variant">{item.variantName}</span>
                  )}
                  <span className="item-review-qty">Qty: {item.quantity}</span>
                </div>
              </div>

              {/* Per-Dish Star Rating */}
              <div className="item-rating-row" role="radiogroup" aria-label={`Rating for ${item.name}`}>
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
                        aria-label={`${starVal} star for ${item.name}`}
                      >
                        <Star size={22} strokeWidth={1.5} fill={isFilled ? 'currentColor' : 'none'} />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="item-comment-field">
                <label htmlFor={`comment-${pId}`} className="item-comment-label">
                  Leave a comment about this dish
                </label>
                <input
                  id={`comment-${pId}`}
                  type="text"
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

      {/* General Feedback */}
      <section className="general-feedback-section" aria-label="General Feedback">
        <label htmlFor="overall-note" className="general-label">
          Anything else? (optional)
        </label>
        <input
          id="overall-note"
          type="text"
          className="general-input"
          placeholder="Tell the restaurant anything else..."
          value={overallComment}
          onChange={(e) => setOverallComment(e.target.value)}
        />
      </section>

      {/* Sticky Bottom Submit */}
      <div className="feedback-sticky-bar">
        <button
          className="submit-feedback-btn"
          onClick={handleSubmitFeedback}
          disabled={loading}
          type="button"
        >
          {loading ? 'Submitting...' : 'Submit Feedback'}
        </button>
      </div>

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="feedback-success-overlay" role="dialog" aria-modal="true">
          <div className="feedback-success-modal">
            <div className="success-modal-icon">
              <Check size={32} strokeWidth={3} />
            </div>
            <h3 className="success-modal-title">Thank You!</h3>
            <p className="success-modal-text">
              Your feedback has been shared with the restaurant team. Loyalty points have been added to your account!
            </p>
            <button className="success-modal-btn" onClick={handleDone} type="button">
              Back to Restaurant
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
