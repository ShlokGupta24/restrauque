import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { customerDashboardService } from '../../services/CustomerDashboardService';
import { CustomerOrder } from '../../services/types';
import { StarRating } from '../../components/common/StarRating';
import { ReviewFormModal } from '../../components/reviews/ReviewFormModal';
import { DemoNoticeBanner } from '../../components/common/DemoNoticeBanner';
import { useCustomerAuth } from '../../context/CustomerAuthContext';
import './FeedbackPage.css';

export const FeedbackPage: React.FC = () => {
  const { refreshData } = useCustomerAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const restaurantParam = searchParams.get('restaurant');

  // Available restaurants from isolated demo metadata
  const restaurants = customerDashboardService.getAllRestaurants();

  // Selected restaurant state (defaults to URL param or first restaurant)
  const [selectedRestaurantId, setSelectedRestaurantId] = useState<string>(() => {
    if (restaurantParam && restaurants.some((r) => r.id === restaurantParam)) {
      return restaurantParam;
    }
    return restaurants[0]?.id || 'res_nbc';
  });

  // Sync state if URL changes externally
  useEffect(() => {
    if (restaurantParam && restaurants.some((r) => r.id === restaurantParam)) {
      setSelectedRestaurantId(restaurantParam);
    }
  }, [restaurantParam, restaurants]);

  // Active modal order state
  const [activeReviewOrder, setActiveReviewOrder] = useState<CustomerOrder | null>(null);

  // Filter tab state within selected restaurant: 'all' | 'needs-review' | 'reviewed'
  const [statusFilter, setStatusFilter] = useState<'all' | 'needs-review' | 'reviewed'>('all');

  const selectedRestaurant =
    restaurants.find((r) => r.id === selectedRestaurantId) || restaurants[0];

  // Fetch orders strictly for the selected restaurant
  const restaurantOrders = customerDashboardService.getOrdersByRestaurant(selectedRestaurantId);

  // Compute counts for tabs
  const pendingOrders = restaurantOrders.filter((o) => o.reviewStatus === 'eligible');
  const reviewedOrders = restaurantOrders.filter((o) => o.reviewStatus === 'submitted');

  // Filtered orders list
  const filteredOrders = restaurantOrders.filter((order) => {
    if (statusFilter === 'needs-review') return order.reviewStatus === 'eligible';
    if (statusFilter === 'reviewed') return order.reviewStatus === 'submitted';
    return true;
  });

  const handleSelectRestaurant = (id: string) => {
    setSelectedRestaurantId(id);
    setSearchParams({ restaurant: id });
    setStatusFilter('all');
  };

  const handleReviewClick = (order: CustomerOrder) => {
    setActiveReviewOrder(order);
  };

  const handleModalClose = () => {
    setActiveReviewOrder(null);
  };

  const handleReviewSuccess = () => {
    refreshData();
  };

  return (
    <div className="feedback-page-shell">
      <DemoNoticeBanner />

      {/* Header */}
      <header className="feedback-header">
        <h1 className="feedback-title">Dining Feedback</h1>
        <p className="feedback-subtitle">
          Submit your review for completed dining orders to earn +50 loyalty points per visit.
        </p>
      </header>

      {/* ================= HORIZONTALLY SCROLLABLE RESTAURANT SELECTOR ================= */}
      <section className="restaurant-selector-wrapper" aria-label="Restaurant Selector">
        <div className="restaurant-selector-label">Select Restaurant</div>
        <div className="restaurant-selector-scroll" role="tablist">
          {restaurants.map((restaurant) => {
            const isSelected = restaurant.id === selectedRestaurantId;
            const orders = customerDashboardService.getOrdersByRestaurant(restaurant.id);
            const pendingCount = orders.filter((o) => o.reviewStatus === 'eligible').length;

            return (
              <button
                key={restaurant.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`restaurant-tab-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectRestaurant(restaurant.id)}
              >
                <div
                  className="restaurant-tab-avatar"
                  style={{
                    background: restaurant.themeAccentBg,
                    color: restaurant.themeAccentText,
                  }}
                >
                  {restaurant.id === 'res_nbc' ? (
                    <Coffee size={20} />
                  ) : (
                    <UtensilsCrossed size={20} />
                  )}
                </div>

                <div className="restaurant-tab-info">
                  <div className="restaurant-tab-name-row">
                    <span className="restaurant-tab-name">{restaurant.shortName}</span>
                    {isSelected && (
                      <span className="active-dot" title="Active selection" />
                    )}
                  </div>
                  <div className="restaurant-tab-sub">
                    {pendingCount > 0 ? (
                      <span className="pending-badge-text">
                        {pendingCount} {pendingCount === 1 ? 'order to review' : 'orders to review'}
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

      {/* ================= SELECTED RESTAURANT CONTENT ================= */}
      <section
        className="feedback-content-card"
        aria-label={`Feedback for ${selectedRestaurant.name}`}
      >
        {/* Venue Context Header */}
        <div className="feedback-venue-header">
          <div className="venue-header-left">
            <h2 className="venue-title">{selectedRestaurant.name}</h2>
            <p className="venue-meta">
              {selectedRestaurant.tagline} • Strict Rule: 1 review allowed per completed order
            </p>
          </div>

          <div className="venue-reward-badge">
            <Sparkles size={14} />
            <span>Earn +50 pts per review</span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="feedback-filter-tabs" role="tablist">
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            All Orders ({restaurantOrders.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'needs-review' ? 'active' : ''}`}
            onClick={() => setStatusFilter('needs-review')}
          >
            Awaiting Review ({pendingOrders.length})
          </button>
          <button
            type="button"
            className={`filter-pill ${statusFilter === 'reviewed' ? 'active' : ''}`}
            onClick={() => setStatusFilter('reviewed')}
          >
            Reviewed ({reviewedOrders.length})
          </button>
        </div>

        {/* Orders List */}
        <div className="feedback-orders-list">
          {filteredOrders.length === 0 ? (
            <div className="feedback-empty-state">
              <MessageSquare size={36} className="empty-state-icon" />
              <h3 className="empty-state-title">No orders found</h3>
              <p className="empty-state-desc">
                {statusFilter === 'needs-review'
                  ? `You have reviewed all completed visits for ${selectedRestaurant.shortName}. Thank you!`
                  : statusFilter === 'reviewed'
                  ? `No reviews submitted yet for ${selectedRestaurant.shortName}. Complete an order to leave your feedback.`
                  : `No dining history recorded for ${selectedRestaurant.shortName}.`}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const review = customerDashboardService.getReviewByOrderId(order.orderId);
              const isEligible = order.reviewStatus === 'eligible';
              const isSubmitted = order.reviewStatus === 'submitted';
              const isUnavailable = order.reviewStatus === 'unavailable';

              // Short items summary
              const itemsSummary = order.items
                .map((i) => `${i.quantity}× ${i.name}`)
                .join(', ');

              return (
                <div
                  key={order.orderId}
                  className={`feedback-order-card ${isSubmitted ? 'order-reviewed' : ''}`}
                >
                  {/* Top Row: Order Details */}
                  <div className="order-card-header">
                    <div className="order-primary-info">
                      <span className="order-number">{order.orderNumber}</span>
                      <span className="order-date">• {order.orderedAt}</span>
                      {order.tableLabel && (
                        <span className="order-table-tag">{order.tableLabel}</span>
                      )}
                    </div>

                    <div className="order-amount">
                      ₹{order.bill.totalAmount.toFixed(2)}
                    </div>
                  </div>

                  {/* Summary of Ordered Items */}
                  <div className="order-items-summary">
                    <span className="items-label">Ordered:</span> {itemsSummary}
                  </div>

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
                          <span className="bonus-note">
                            Earn <strong>+50 Loyalty Points</strong> to your {selectedRestaurant.shortName} balance
                          </span>
                        </div>

                        <button
                          type="button"
                          className="write-review-btn"
                          onClick={() => handleReviewClick(order)}
                          title="Submit one-time review for this order"
                        >
                          <Sparkles size={15} />
                          <span>Write Review (+50 pts)</span>
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

                          <span className="points-awarded-pill">
                            +{review?.pointsEarned || 50} pts awarded
                          </span>
                        </div>

                        {review && (
                          <div className="submitted-review-preview">
                            <div className="preview-rating-row">
                              <StarRating value={review.overallRating} readonly size={16} />
                              <span className="preview-rating-score">
                                {review.overallRating}.0 / 5.0
                              </span>
                            </div>
                            <p className="preview-comment-text">
                              &ldquo;{review.overallComment}&rdquo;
                            </p>
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
                          <span>In Progress ({order.statusLabel})</span>
                        </div>
                        <p className="ineligible-explanation">
                          Review unavailable — this order is currently being prepared in the kitchen. You can share your feedback once your dining visit is completed.
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

      {/* Review Modal Dialog (for submitting review or viewing in read-only mode) */}
      {activeReviewOrder && (
        <ReviewFormModal
          order={activeReviewOrder}
          isOpen={!!activeReviewOrder}
          onClose={handleModalClose}
          onSuccess={handleReviewSuccess}
        />
      )}
    </div>
  );
};
