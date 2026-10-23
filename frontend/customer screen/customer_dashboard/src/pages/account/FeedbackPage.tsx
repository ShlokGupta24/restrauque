import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Coffee,
  UtensilsCrossed,
  Sparkles,
  CheckCircle2,
  Clock,
  MessageSquare,
  ChevronRight,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import {
  fetchCustomerFeedbackHistory,
  CustomerFeedbackOrderItem,
  CustomerFeedbackHistoryResponse,
  CustomerFeedbackStatusFilter,
} from '../../services/feedbackService';
import { ApiClientError } from '../../services/apiClient';
import { StarRating } from '../../components/common/StarRating';
import { ReviewFormModal } from '../../components/reviews/ReviewFormModal';
import { LoadingState } from '../../components/common/LoadingState';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './FeedbackPage.css';

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export const FeedbackPage: React.FC = () => {
  const { refreshData } = useCustomerAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const restaurantParam = searchParams.get('restaurant') || searchParams.get('restaurantId') || '';
  const orderIdParam = searchParams.get('orderId') || '';
  const statusParam = searchParams.get('status');

  // Filter tab state: 'all' | 'awaiting_review' | 'reviewed'
  const [statusFilter, setStatusFilter] = useState<CustomerFeedbackStatusFilter>(() => {
    if (statusParam === 'awaiting_review' || statusParam === 'reviewed') {
      return statusParam;
    }
    return 'all';
  });

  // Selected restaurant filter (empty string represents "All Venues")
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(restaurantParam);

  // Live feedback history and meta state
  const [feedbackData, setFeedbackData] = useState<CustomerFeedbackHistoryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Active review modal state
  const [activeReviewOrderId, setActiveReviewOrderId] = useState<string | null>(orderIdParam || null);
  const [activeReviewOrder, setActiveReviewOrder] = useState<CustomerFeedbackOrderItem | null>(null);

  // Abort controller ref for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Sync state if URL query params change externally
  useEffect(() => {
    if (restaurantParam !== selectedRestaurantId) {
      setSelectedRestaurantId(restaurantParam);
    }
  }, [restaurantParam]);

  useEffect(() => {
    if (statusParam && (statusParam === 'all' || statusParam === 'awaiting_review' || statusParam === 'reviewed')) {
      if (statusParam !== statusFilter) {
        setStatusFilter(statusParam as CustomerFeedbackStatusFilter);
      }
    }
  }, [statusParam]);

  useEffect(() => {
    if (orderIdParam) {
      setActiveReviewOrderId(orderIdParam);
    }
  }, [orderIdParam]);

  // Load live feedback history
  const loadFeedbackHistory = useCallback(
    async (showLoadingSpinner: boolean = true) => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      if (showLoadingSpinner) {
        setLoading(true);
      }
      setError(null);

      try {
        const result = await fetchCustomerFeedbackHistory(
          {
            status: statusFilter,
            restaurantId: selectedRestaurantId ? selectedRestaurantId : undefined,
          },
          controller.signal
        );

        setFeedbackData(result);
        setLoading(false);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        setLoading(false);

        if (err instanceof ApiClientError) {
          if (err.status === 401) {
            setError('Your session has expired. Please sign in to view your dining feedback.');
          } else {
            setError(err.message || 'Unable to load dining feedback.');
          }
        } else {
          setError('Unable to reach the server. Please check your internet connection.');
        }
      }
    },
    [statusFilter, selectedRestaurantId]
  );

  useEffect(() => {
    loadFeedbackHistory();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [loadFeedbackHistory]);

  const handleSelectRestaurant = (id: string) => {
    setSelectedRestaurantId(id);
    const newParams = new URLSearchParams(searchParams);
    if (id) {
      newParams.set('restaurant', id);
    } else {
      newParams.delete('restaurant');
      newParams.delete('restaurantId');
    }
    setSearchParams(newParams);
  };

  const handleSelectStatusFilter = (status: CustomerFeedbackStatusFilter) => {
    setStatusFilter(status);
    const newParams = new URLSearchParams(searchParams);
    if (status !== 'all') {
      newParams.set('status', status);
    } else {
      newParams.delete('status');
    }
    setSearchParams(newParams);
  };

  const handleReviewClick = (order: CustomerFeedbackOrderItem) => {
    setActiveReviewOrder(order);
    setActiveReviewOrderId(order.orderId);
  };

  const handleModalClose = () => {
    setActiveReviewOrderId(null);
    setActiveReviewOrder(null);
    // Clean up orderId param from URL if it was opened from link
    if (searchParams.has('orderId')) {
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('orderId');
      setSearchParams(newParams, { replace: true });
    }
  };

  const handleReviewSuccess = () => {
    refreshData();
    loadFeedbackHistory(false);
  };

  // Resolve current venue name for context display
  const currentRestaurantMeta = selectedRestaurantId && feedbackData?.restaurantSummary
    ? feedbackData.restaurantSummary.find((r) => r.restaurantId === selectedRestaurantId)
    : null;

  const currentVenueTitle = currentRestaurantMeta
    ? currentRestaurantMeta.restaurantName
    : 'All Partner Venues';

  // Counts for tabs
  const tabCounts = {
    all: currentRestaurantMeta ? currentRestaurantMeta.totalOrdersCount : (feedbackData?.summary.all ?? 0),
    awaitingReview: currentRestaurantMeta ? currentRestaurantMeta.pendingFeedbackCount : (feedbackData?.summary.awaitingReview ?? 0),
    reviewed: currentRestaurantMeta ? currentRestaurantMeta.reviewedOrdersCount : (feedbackData?.summary.reviewed ?? 0),
  };

  const orders = feedbackData?.orders || [];

  return (
    <div className="feedback-page-shell">
      {/* Header */}
      <header className="feedback-header">
        <h1 className="feedback-title">Dining Feedback</h1>
        <p className="feedback-subtitle">
          Submit verified reviews for your completed dining visits to share feedback with kitchen chefs and earn loyalty rewards.
        </p>
      </header>

      {/* ================= HORIZONTALLY SCROLLABLE RESTAURANT SELECTOR ================= */}
      {feedbackData?.restaurantSummary && feedbackData.restaurantSummary.length > 0 && (
        <section className="restaurant-selector-wrapper" aria-label="Restaurant Selector">
          <div className="restaurant-selector-label">Filter by Restaurant</div>
          <div className="restaurant-selector-scroll" role="tablist">
            {/* All Venues Tab */}
            <button
              type="button"
              role="tab"
              aria-selected={!selectedRestaurantId}
              className={`restaurant-tab-card ${!selectedRestaurantId ? 'selected' : ''}`}
              onClick={() => handleSelectRestaurant('')}
            >
              <div
                className="restaurant-tab-avatar"
                style={{
                  background: 'var(--bg-subtle)',
                  color: 'var(--brand-red)',
                }}
              >
                <UtensilsCrossed size={20} />
              </div>
              <div className="restaurant-tab-info">
                <div className="restaurant-tab-name-row">
                  <span className="restaurant-tab-name">All Restaurants</span>
                  {!selectedRestaurantId && <span className="active-dot" title="Active selection" />}
                </div>
                <div className="restaurant-tab-sub">
                  {(feedbackData.summary.awaitingReview ?? 0) > 0 ? (
                    <span className="pending-badge-text">
                      {feedbackData.summary.awaitingReview} awaiting review
                    </span>
                  ) : (
                    <span className="caught-up-text">All reviewed</span>
                  )}
                </div>
              </div>
            </button>

            {/* Individual Restaurant Tabs */}
            {feedbackData.restaurantSummary.map((restaurant) => {
              const isSelected = restaurant.restaurantId === selectedRestaurantId;

              return (
                <button
                  key={restaurant.restaurantId}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={`restaurant-tab-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => handleSelectRestaurant(restaurant.restaurantId)}
                >
                  <div
                    className="restaurant-tab-avatar"
                    style={{
                      background: 'var(--bg-subtle)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Coffee size={20} />
                  </div>

                  <div className="restaurant-tab-info">
                    <div className="restaurant-tab-name-row">
                      <span className="restaurant-tab-name">{restaurant.restaurantName}</span>
                      {isSelected && <span className="active-dot" title="Active selection" />}
                    </div>
                    <div className="restaurant-tab-sub">
                      {restaurant.pendingFeedbackCount > 0 ? (
                        <span className="pending-badge-text">
                          {restaurant.pendingFeedbackCount}{' '}
                          {restaurant.pendingFeedbackCount === 1 ? 'to review' : 'to review'}
                        </span>
                      ) : (
                        <span className="caught-up-text">All reviewed</span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Recoverable Error Card */}
      {error && !loading && (
        <div className="feedback-error-card" role="alert">
          <div className="feedback-error-icon">
            <AlertCircle size={26} />
          </div>
          <div className="feedback-error-content">
            <h3 className="feedback-error-title">Unable to load feedback history</h3>
            <p className="feedback-error-message">{error}</p>
          </div>
          <button
            type="button"
            className="feedback-retry-btn"
            onClick={() => loadFeedbackHistory(true)}
          >
            <RefreshCw size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* Initial Loading Spinner */}
      {loading && (
        <div className="feedback-loading-wrap">
          <LoadingState message="Loading your feedback history..." />
        </div>
      )}

      {/* ================= SELECTED RESTAURANT CONTENT ================= */}
      {!loading && !error && (
        <section
          className="feedback-content-card"
          aria-label={`Feedback for ${currentVenueTitle}`}
        >
          {/* Venue Context Header */}
          <div className="feedback-venue-header">
            <div className="venue-header-left">
              <h2 className="venue-title">{currentVenueTitle}</h2>
              <p className="venue-meta">
                Strict Rule: Exactly 1 verified review allowed per completed dining order
              </p>
            </div>

            <div className="venue-reward-badge">
              <Sparkles size={14} />
              <span>Earn Loyalty Points per Review</span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="feedback-filter-tabs" role="tablist">
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
              onClick={() => handleSelectStatusFilter('all')}
            >
              All Orders ({tabCounts.all})
            </button>
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'awaiting_review' ? 'active' : ''}`}
              onClick={() => handleSelectStatusFilter('awaiting_review')}
            >
              Awaiting Review ({tabCounts.awaitingReview})
            </button>
            <button
              type="button"
              className={`filter-pill ${statusFilter === 'reviewed' ? 'active' : ''}`}
              onClick={() => handleSelectStatusFilter('reviewed')}
            >
              Reviewed ({tabCounts.reviewed})
            </button>
          </div>

          {/* Orders List */}
          <div className="feedback-orders-list">
            {orders.length === 0 ? (
              <div className="feedback-empty-state">
                <MessageSquare size={36} className="empty-state-icon" />
                <h3 className="empty-state-title">No orders found</h3>
                <p className="empty-state-desc">
                  {statusFilter === 'awaiting_review'
                    ? `You are completely caught up! All completed dining visits have been reviewed.`
                    : statusFilter === 'reviewed'
                    ? `No reviews submitted yet for this view. Share your dining experience to earn rewards.`
                    : `No dining history recorded for the selected venue.`}
                </p>
              </div>
            ) : (
              orders.map((order) => {
                const isSubmitted = order.hasFeedback;
                const isEligible = !isSubmitted && order.eligibility.isEligible;
                const isUnavailable = !isSubmitted && !order.eligibility.isEligible;

                const itemsSummary = order.items
                  .map((i) => `${i.quantity}× ${i.productName}`)
                  .join(', ');

                return (
                  <div
                    key={order.orderId}
                    className={`feedback-order-card ${isSubmitted ? 'order-reviewed' : ''}`}
                  >
                    {/* Top Row: Order Details */}
                    <div className="order-card-header">
                      <div className="order-primary-info">
                        <span className="order-number">#{order.orderNumber}</span>
                        <span className="order-date">• {formatDateTime(order.orderedAt)}</span>
                        {order.restaurant?.name && !selectedRestaurantId && (
                          <span className="order-table-tag">{order.restaurant.name}</span>
                        )}
                        {order.table?.tableNumber && (
                          <span className="order-table-tag">Table {order.table.tableNumber}</span>
                        )}
                      </div>

                      <div className="order-amount">
                        ₹{order.pricing.totalAmountFormatted}
                      </div>
                    </div>

                    {/* Summary of Ordered Items */}
                    {itemsSummary && (
                      <div className="order-items-summary">
                        <span className="items-label">Ordered:</span> {itemsSummary}
                      </div>
                    )}

                    {/* ================= REVIEW STATUS & CONTROLS ================= */}
                    <div className="order-review-status-box">
                      {/* CASE 1: Eligible Order (Needs Review) */}
                      {isEligible && (
                        <div className="review-action-row eligible-row">
                          <div className="eligible-text-meta">
                            <span className="status-indicator-pill eligible">
                              <Clock size={13} />
                              <span>Completed Order • Eligible</span>
                            </span>
                            {order.potentialReward?.isActive && (
                              <span className="bonus-note">
                                Earn <strong>+{order.potentialReward.baseStars} Loyalty Points</strong> to your wallet
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            className="write-review-btn"
                            onClick={() => handleReviewClick(order)}
                            title="Submit verified review for this order"
                          >
                            <Sparkles size={15} />
                            <span>
                              Write Review
                              {order.potentialReward?.isActive
                                ? ` (+${order.potentialReward.baseStars} pts)`
                                : ''}
                            </span>
                          </button>
                        </div>
                      )}

                      {/* CASE 2: Already Reviewed Order */}
                      {isSubmitted && (
                        <div className="reviewed-details-block">
                          <div className="reviewed-top-bar">
                            <div className="reviewed-status-tag">
                              <CheckCircle2 size={15} className="text-emerald" />
                              <span className="reviewed-title">Review Submitted</span>
                              <span className="one-review-badge">
                                <ShieldCheck size={13} />
                                <span>Locked (1 review limit)</span>
                              </span>
                            </div>

                            {order.feedback?.reward?.isAwarded && (
                              <span className="points-awarded-pill">
                                +{order.feedback.reward.starsAwarded} pts awarded
                              </span>
                            )}
                          </div>

                          {order.feedback && (
                            <div className="submitted-review-preview">
                              <div className="preview-rating-row">
                                <StarRating
                                  value={order.feedback.rating || 5}
                                  readonly
                                  size={16}
                                />
                                <span className="preview-rating-score">
                                  {order.feedback.rating || 5}.0 / 5.0
                                </span>
                              </div>
                              {order.feedback.comment && (
                                <p className="preview-comment-text">
                                  &ldquo;{order.feedback.comment}&rdquo;
                                </p>
                              )}
                            </div>
                          )}

                          <div className="reviewed-card-footer">
                            <button
                              type="button"
                              className="view-review-btn"
                              onClick={() => handleReviewClick(order)}
                              title="View your submitted review in read-only mode"
                            >
                              <span>View Review</span>
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* CASE 3: Ineligible / In Progress Order */}
                      {isUnavailable && (
                        <div className="ineligible-row">
                          <div className="ineligible-status-tag">
                            <Clock size={14} className="text-amber" />
                            <span>In Progress ({order.status})</span>
                          </div>
                          <p className="ineligible-explanation">
                            {order.eligibility.reason ||
                              'Review unavailable — this order is not yet marked as completed. You can share your feedback once your dining visit is finished.'}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {/* Review Modal Dialog (for submitting review or viewing in read-only mode) */}
      {activeReviewOrderId && (
        <ReviewFormModal
          orderId={activeReviewOrderId}
          order={activeReviewOrder}
          isOpen={!!activeReviewOrderId}
          onClose={handleModalClose}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
};
