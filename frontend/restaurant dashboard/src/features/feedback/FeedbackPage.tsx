import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  feedbackService,
  OwnerFeedbackResponse,
  OwnerFeedbackItem,
} from '../../services/feedbackService';
import { ApiClientError } from '../../services/apiClient';
import {
  FEEDBACK_SCHEMA_SPECS,
  FeedbackSchemaSpec,
} from '../../services/feedbackData';
import './FeedbackPage.css';

export const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { restaurant, availableBranches } = useRestaurant();

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [feedbackData, setFeedbackData] = useState<OwnerFeedbackResponse | null>(null);
  const [feedbackItems, setFeedbackItems] = useState<OwnerFeedbackItem[]>([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSchemaModal, setActiveSchemaModal] = useState<FeedbackSchemaSpec | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const loadFeedback = useCallback(
    async (cursor?: string, append: boolean = false, signal?: AbortSignal) => {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setError(null);
      }

      try {
        const res = await feedbackService.getFeedback({
          restaurantId: restaurant?.id,
          branchId: selectedBranchId !== 'all' ? selectedBranchId : undefined,
          limit: 10,
          cursor,
          signal,
        });

        if (append) {
          setFeedbackItems((prev) => [...prev, ...res.items]);
          setFeedbackData((prev) =>
            prev
              ? {
                  ...prev,
                  pagination: res.pagination,
                }
              : res
          );
        } else {
          setFeedbackData(res);
          setFeedbackItems(res.items);
          if (res.items.length > 0) {
            setSelectedFeedbackId(res.items[0].id);
          } else {
            setSelectedFeedbackId(null);
          }
        }
      } catch (err: unknown) {
        if (signal?.aborted) return;
        const message =
          err instanceof ApiClientError
            ? err.message
            : err instanceof Error
            ? err.message
            : 'Failed to load restaurant feedback';
        setError(message);
      } finally {
        if (append) {
          setIsLoadingMore(false);
        } else {
          setIsLoading(false);
        }
      }
    },
    [restaurant?.id, selectedBranchId]
  );

  useEffect(() => {
    const controller = new AbortController();
    loadFeedback(undefined, false, controller.signal);
    return () => {
      controller.abort();
    };
  }, [loadFeedback]);

  const handleRefresh = () => {
    loadFeedback();
  };

  const handleLoadMore = () => {
    if (feedbackData?.pagination.hasMore && feedbackData.pagination.nextCursor) {
      loadFeedback(feedbackData.pagination.nextCursor, true);
    }
  };

  const handleBranchChange = (branchId: string) => {
    setSelectedBranchId(branchId);
  };

  const handleCopySpec = (spec: FeedbackSchemaSpec) => {
    const text = `Table: ${spec.table}\nStatus: ${spec.status}\nColumns:\n${spec.columns.join('\n')}\nNotes: ${spec.notes}`;
    navigator.clipboard?.writeText(text);
    setCopiedNotice(spec.table);
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  const selectedItem =
    feedbackItems.find((item) => item.id === selectedFeedbackId) ||
    feedbackItems[0] ||
    null;

  const handleOpenOrder = () => {
    if (selectedItem?.orderId) {
      navigate(`/dashboard/orders/${selectedItem.orderId}`);
    }
  };

  // Summary calculations matching backend source of truth
  const summary = feedbackData?.summary;
  const totalCount = summary?.totalCount ?? 0;
  const averageRating = summary?.averageRating;
  const dist = summary?.ratingDistribution ?? { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const totalRated =
    (dist[1] || 0) + (dist[2] || 0) + (dist[3] || 0) + (dist[4] || 0) + (dist[5] || 0);

  const distributionRows = [5, 4, 3, 2, 1].map((stars) => {
    const count = dist[stars as 1 | 2 | 3 | 4 | 5] || 0;
    const percentage = totalRated > 0 ? Math.round((count / totalRated) * 100) : 0;
    return {
      stars,
      count,
      percentage,
      formatted:
        totalRated > 0
          ? `${count} ${count === 1 ? 'review' : 'reviews'} (${percentage}%)`
          : '0 reviews (0%)',
    };
  });

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'Not available';
    try {
      const d = new Date(isoString);
      return isNaN(d.getTime())
        ? isoString
        : d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="feedback-page">
      {/* Page Title & Subtitle */}
      <div className="feedback-header-section">
        <div className="feedback-title-row">
          <div>
            <h1>Feedback</h1>
            <p className="feedback-subtitle">
              Real-time customer reviews, ratings, and dining feedback for{' '}
              {restaurant?.name || 'your restaurant'}.
            </p>
          </div>

          <div className="feedback-header-actions">
            <button
              type="button"
              className="btn-feedback-demo-toggle"
              id="btn-view-contract-schema"
              onClick={() => setActiveSchemaModal(FEEDBACK_SCHEMA_SPECS[0])}
              title="View REST API and Neon Database Contract"
            >
              <span className="toggle-icon">📋</span>
              Data Contract
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="feedback-filter-bar">
          <div className="filter-left-group">
            <select
              className="feedback-filter-select"
              id="select-feedback-branch"
              value={selectedBranchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              aria-label="Filter by restaurant branch"
            >
              <option value="all">All Branches</option>
              {availableBranches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="feedback-refresh-btn"
              id="btn-feedback-refresh"
              onClick={handleRefresh}
              disabled={isLoading}
              title="Refresh live feedback"
            >
              <span className={`refresh-icon ${isLoading ? 'spinning' : ''}`}>↻</span>
              <span>{isLoading ? 'Updating...' : 'Refresh'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="feedback-error-card" id="feedback-error-card">
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚠️</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 700 }}>
            Unable to load live feedback
          </h3>
          <p>{error}</p>
          <button
            type="button"
            className="btn-feedback-retry"
            id="btn-feedback-retry"
            onClick={handleRefresh}
          >
            Retry Live Connection
          </button>
        </div>
      )}

      {/* Loading State Skeleton (Initial Mount) */}
      {isLoading && !feedbackData && !error && (
        <div className="feedback-loading-card" id="feedback-loading-card">
          <div className="feedback-spinner" />
          <p>Connecting to backend and retrieving verified customer reviews...</p>
        </div>
      )}

      {/* 3 KPI Summary Cards */}
      <div className="feedback-kpi-grid">
        <div className="feedback-kpi-card" id="kpi-avg-rating">
          <div className="feedback-kpi-title">Average rating</div>
          <div className="feedback-kpi-subtitle">Server-verified aggregate</div>
          <div className="feedback-kpi-val">
            {averageRating !== null && averageRating !== undefined
              ? `★ ${averageRating.toFixed(1)} / 5.0`
              : '— / 5.0'}
          </div>
        </div>

        <div className="feedback-kpi-card" id="kpi-feedback-count">
          <div className="feedback-kpi-title">Feedback count</div>
          <div className="feedback-kpi-subtitle">Total customer submissions</div>
          <div className="feedback-kpi-val">{totalCount} reviews</div>
        </div>

        <div className="feedback-kpi-card" id="kpi-period-coverage">
          <div className="feedback-kpi-title">Period coverage</div>
          <div className="feedback-kpi-subtitle">Authenticated submissions</div>
          <div className="feedback-kpi-val">All time</div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="feedback-main-grid">
        {/* Left Column (Wider): Rating distribution & Reviews List */}
        <div className="feedback-left-col">
          {/* Card A: Rating distribution */}
          <div className="feedback-card" id="card-rating-distribution">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Rating distribution</h2>
              <span className="feedback-card-meta">
                {totalRated > 0
                  ? `Based on ${totalRated} verified customer ${
                      totalRated === 1 ? 'review' : 'reviews'
                    }`
                  : 'No customer ratings submitted yet'}
              </span>
            </div>

            <div className="rating-distribution-list">
              {distributionRows.map((item) => (
                <div key={item.stars} className="rating-dist-row">
                  <span className="stars-label">{item.stars} stars</span>
                  <div className="rating-track-bg">
                    {item.percentage > 0 && (
                      <div
                        className="rating-track-fill"
                        style={{ width: `${item.percentage}%` }}
                      />
                    )}
                  </div>
                  <span className="rating-count-label">{item.formatted}</span>
                </div>
              ))}
            </div>

            <p className="distribution-notice">
              Calculated server-side across all completed customer orders.
            </p>
          </div>

          {/* Card B: Topics & aspects (Transparent "In development" state) */}
          <div className="feedback-card" id="card-topics-aspects">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Topics & aspects</h2>
              <span className="topics-in-dev-pill">Pending NLP Pipeline</span>
            </div>

            <div className="topics-table-container">
              <div className="topics-empty-body">
                <div className="topics-empty-icon">📊</div>
                <h3 className="empty-title">Automated topic insights in development</h3>
                <p className="empty-desc">
                  Natural language processing and sentiment topic extraction (Food Taste, Speed,
                  Hospitality) are scheduled for deployment once automated comment categorization is
                  connected.
                </p>
              </div>
            </div>
          </div>

          {/* Card C: Submitted Customer Reviews List */}
          <div className="feedback-card" id="card-reviews-list">
            <div className="feedback-reviews-header">
              <h2 className="feedback-card-title">Customer Reviews</h2>
              <span className="feedback-card-meta">
                Showing {feedbackItems.length} of {totalCount} reviews
              </span>
            </div>

            {feedbackItems.length === 0 ? (
              <div className="feedback-empty-state" id="feedback-empty-state">
                <div className="empty-icon">💬</div>
                <h3>No customer feedback yet</h3>
                <p>
                  When dine-in guests complete meals and submit reviews through their QR dining
                  session, verified ratings and comments will appear here in real time.
                </p>
              </div>
            ) : (
              <div className="reviews-list-container">
                {feedbackItems.map((item) => (
                  <div
                    key={item.id}
                    className={`review-item-card ${
                      item.id === selectedFeedbackId ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedFeedbackId(item.id)}
                  >
                    <div className="review-item-header">
                      <span className="review-item-stars">
                        {item.rating !== null ? `★ ${item.rating}.0` : 'No rating'}
                      </span>
                      <span className="review-item-date">{formatDate(item.submittedAt)}</span>
                    </div>

                    <p
                      className={`review-item-comment ${
                        !item.comment ? 'empty-comment' : ''
                      }`}
                    >
                      {item.comment ? `“${item.comment}”` : '(No written comment provided)'}
                    </p>

                    <div className="review-item-footer">
                      <span className="review-customer-name">
                        {item.customerName || 'Dine-in Guest'}
                      </span>
                      {item.branchName && (
                        <span className="review-branch-badge">{item.branchName}</span>
                      )}
                      {item.orderId ? (
                        <button
                          type="button"
                          className="btn-order-link"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/dashboard/orders/${item.orderId}`);
                          }}
                          title={`Open details for order ${item.orderNumber || item.orderId}`}
                        >
                          Order #{item.orderNumber || item.orderId.slice(0, 8)} ↗
                        </button>
                      ) : (
                        <span className="review-order-tag">
                          Order #{item.orderNumber || '—'}
                        </span>
                      )}
                    </div>
                  </div>
                ))}

                {feedbackData?.pagination.hasMore && (
                  <button
                    type="button"
                    className="btn-load-more"
                    id="btn-feedback-load-more"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                  >
                    {isLoadingMore ? 'Loading more reviews...' : 'Load more reviews ⌄'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column (Narrower): Selected Review Detail & Policy */}
        <div className="feedback-right-col">
          {/* Card D: Selected review detail */}
          <div className="feedback-card" id="card-selected-review">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Review Detail</h2>
            </div>

            <div className="order-linked-body">
              <div className="order-linked-field">
                <span className="field-label">Rating</span>
                <span className="field-val">
                  {selectedItem && selectedItem.rating !== null
                    ? `★ ${selectedItem.rating}.0 / 5.0`
                    : 'Not rated'}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Comment</span>
                <span className="field-val">
                  {selectedItem?.comment
                    ? `“${selectedItem.comment}”`
                    : selectedItem
                    ? '(No written comment provided)'
                    : 'No review selected'}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Customer</span>
                <span className="field-val">
                  {selectedItem?.customerName || (selectedItem ? 'Dine-in Guest' : '—')}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Branch</span>
                <span className="field-val">
                  {selectedItem?.branchName || (selectedItem ? 'Main Branch' : '—')}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Submitted at</span>
                <span className="field-val">{formatDate(selectedItem?.submittedAt)}</span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Status</span>
                <span className="field-pill">
                  {selectedItem?.status
                    ? selectedItem.status.toUpperCase()
                    : selectedItem
                    ? 'PUBLISHED'
                    : '—'}
                </span>
              </div>

              <div className="order-linked-action-box">
                <button
                  type="button"
                  className={`btn-open-order ${!selectedItem?.orderId ? 'disabled' : ''}`}
                  id="btn-open-associated-order"
                  onClick={handleOpenOrder}
                  disabled={!selectedItem?.orderId}
                >
                  Open associated order
                </button>
                <p className="order-action-note">
                  {selectedItem?.orderNumber
                    ? `Associated with order #${selectedItem.orderNumber}. Click to inspect ordered items and receipt.`
                    : 'Select a review from the list to view its associated order.'}
                </p>
              </div>
            </div>
          </div>

          {/* Card E: Review authenticity & policies */}
          <div className="feedback-card" id="card-review-boundaries">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Review Authenticity</h2>
            </div>

            <div className="boundaries-body">
              <div className="boundaries-subheading">Verified Dine-In Feedback</div>
              <p className="boundaries-text">
                Every customer review is verified against a paid, completed QR order session.
                Duplicate reviews per order are prevented at the database level to ensure authentic
                satisfaction metrics.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="feedback-bottom-notice">
        Connected to live backend · Owner feedback service provides real-time customer feedback and
        server-derived summaries.
      </div>

      {/* Interactive Modal for "Data Contract" */}
      {activeSchemaModal && (
        <div className="schema-modal-backdrop" onClick={() => setActiveSchemaModal(null)}>
          <div
            className="schema-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            id="modal-feedback-schema"
          >
            <div className="schema-modal-header">
              <div>
                <span className="modal-category-label">REST API & NEON SCHEMA CONTRACT</span>
                <h3 className="modal-table-title">{activeSchemaModal.table}</h3>
              </div>
              <button
                className="btn-modal-close"
                onClick={() => setActiveSchemaModal(null)}
              >
                ✕
              </button>
            </div>

            <div className="schema-modal-body">
              <div className="modal-status-badge-row">
                <span className="modal-spec-label">Status:</span>
                <span className="modal-status-pill schema-defined">
                  {activeSchemaModal.status}
                </span>
              </div>

              <p className="modal-notes">{activeSchemaModal.notes}</p>

              <div className="modal-columns-section">
                <div className="modal-columns-title">Defined Attributes / Columns:</div>
                <div className="modal-columns-list">
                  {activeSchemaModal.columns.map((col, idx) => (
                    <div key={idx} className="modal-col-row">
                      <span className="col-bullet">▪</span>
                      <code>{col}</code>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="schema-modal-footer">
              <button
                className="btn-copy-spec"
                onClick={() => handleCopySpec(activeSchemaModal)}
              >
                {copiedNotice === activeSchemaModal.table
                  ? '✓ Copied to clipboard!'
                  : 'Copy Contract Schema'}
              </button>
              <button
                className="btn-modal-done"
                onClick={() => setActiveSchemaModal(null)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
