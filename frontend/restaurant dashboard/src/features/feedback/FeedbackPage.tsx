import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EMPTY_FEEDBACK_DATASET,
  DEMO_POPULATED_FEEDBACK_DATASET,
  FEEDBACK_SCHEMA_SPECS,
  FeedbackDataset,
  FeedbackSchemaSpec,
} from '../../services/feedbackData';
import './FeedbackPage.css';

export const FeedbackPage: React.FC = () => {
  const navigate = useNavigate();
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [selectedBranch, setSelectedBranch] = useState<string>('hazratganj');
  const [activeSchemaModal, setActiveSchemaModal] = useState<FeedbackSchemaSpec | null>(null);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const dataset: FeedbackDataset = isDemoMode
    ? DEMO_POPULATED_FEEDBACK_DATASET
    : EMPTY_FEEDBACK_DATASET;

  const handleCopySpec = (spec: FeedbackSchemaSpec) => {
    const text = `Table: ${spec.table}\nStatus: ${spec.status}\nColumns:\n${spec.columns.join('\n')}\nNotes: ${spec.notes}`;
    navigator.clipboard?.writeText(text);
    setCopiedNotice(spec.table);
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  const handleOpenOrder = () => {
    if (dataset.hasLiveRecords && dataset.orderFeedback.length > 0) {
      navigate(`/dashboard/orders/${dataset.orderFeedback[0].orderId}`);
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
              Feedback / Future Ready / No Data · Aggregate review concept; no submitted feedback or analytics supplied.
            </p>
          </div>

          {/* Interactive Mode Toggle */}
          <div className="feedback-header-actions">
            <button
              type="button"
              className={`btn-feedback-demo-toggle ${isDemoMode ? 'active' : ''}`}
              id="btn-toggle-feedback-mode"
              onClick={() => setIsDemoMode(!isDemoMode)}
              title="Toggle between Reference Schema State and Demo Reviews"
            >
              <span className="toggle-icon">{isDemoMode ? '✦' : '○'}</span>
              {isDemoMode ? 'Reference State (No Data)' : 'Preview Demo Feedback'}
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="feedback-filter-bar">
          <div className="filter-left-group">
            <select
              className="feedback-filter-select"
              id="select-feedback-branch"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
            >
              <option value="hazratganj">Hazratganj · DEMO ⌄</option>
              <option value="gomti_nagar">Gomti Nagar · DEMO ⌄</option>
            </select>

            <button
              type="button"
              className="feedback-date-btn"
              id="btn-feedback-date"
            >
              <span className="date-icon">📅</span>
              <span>01–07 Oct 2026 · DEMO</span>
            </button>

            <button
              type="button"
              className="feedback-refresh-btn"
              id="btn-refresh-feedback"
              onClick={() => setIsDemoMode((prev) => !prev)}
            >
              <span className="refresh-icon">🔄</span>
              <span>Refresh feedback</span>
            </button>
          </div>
        </div>
      </div>

      {/* 3 KPI Summary Cards */}
      <div className="feedback-kpi-grid">
        <div className="feedback-kpi-card" id="kpi-avg-rating">
          <div className="feedback-kpi-title">Average rating</div>
          <div className="feedback-kpi-subtitle">Returned aggregate</div>
          <div className="feedback-kpi-val">{dataset.averageRating}</div>
        </div>

        <div className="feedback-kpi-card" id="kpi-feedback-count">
          <div className="feedback-kpi-title">Feedback count</div>
          <div className="feedback-kpi-subtitle">Returned aggregate</div>
          <div className="feedback-kpi-val">{dataset.feedbackCount}</div>
        </div>

        <div className="feedback-kpi-card" id="kpi-period-coverage">
          <div className="feedback-kpi-title">Period coverage</div>
          <div className="feedback-kpi-subtitle">Returned aggregate</div>
          <div className="feedback-kpi-val">{dataset.periodCoverage}</div>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="feedback-main-grid">
        {/* Left Column (Wider): Rating distribution & Topics/aspects */}
        <div className="feedback-left-col">
          {/* Card A: Rating distribution */}
          <div className="feedback-card" id="card-rating-distribution">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Rating distribution</h2>
              <span className="feedback-card-meta">
                {dataset.hasLiveRecords
                  ? 'Based on 128 verified customer reviews'
                  : 'No distribution supplied · not zero counts'}
              </span>
            </div>

            <div className="rating-distribution-list">
              {dataset.distribution.map((item) => (
                <div key={item.stars} className="rating-dist-row">
                  <span className="stars-label">{item.stars} stars</span>
                  <div className="rating-track-bg">
                    {item.percentage !== null && item.percentage > 0 && (
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
              Neutral tracks indicate missing data, not volume or sentiment.
            </p>
          </div>

          {/* Card B: Topics & aspects */}
          <div className="feedback-card" id="card-topics-aspects">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Topics & aspects</h2>
            </div>

            <div className="topics-table-container">
              <div className="topics-table-header">
                <span className="col-topic">Topic / aspect</span>
                <span className="col-aggregate">Returned aggregate</span>
                <span className="col-period">Period</span>
              </div>

              {!dataset.hasLiveRecords || dataset.topics.length === 0 ? (
                <div className="topics-empty-body">
                  <h3 className="empty-title">No topics or aspects yet</h3>
                  <p className="empty-desc">
                    feedback_topics and feedback_aspects must be supplied before labels or values can be displayed.
                  </p>
                </div>
              ) : (
                <div className="topics-table-rows">
                  {dataset.topics.map((t) => (
                    <div key={t.id} className="topic-data-row">
                      <span className="col-topic font-medium">{t.topic}</span>
                      <span className="col-aggregate text-highlight">
                        {t.returnedAggregate}
                      </span>
                      <span className="col-period text-muted">{t.period}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Narrower): Order-linked feedback & Review boundaries */}
        <div className="feedback-right-col">
          {/* Card C: Order-linked feedback */}
          <div className="feedback-card" id="card-order-linked-feedback">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Order-linked feedback</h2>
            </div>

            <div className="order-linked-body">
              <div className="order-linked-field">
                <span className="field-label">Rating</span>
                <span className="field-val">
                  {dataset.hasLiveRecords && dataset.orderFeedback.length > 0
                    ? `★ ${dataset.orderFeedback[0].rating}.0 / 5.0`
                    : 'Not available'}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Comment</span>
                <span className="field-val">
                  {dataset.hasLiveRecords && dataset.orderFeedback.length > 0
                    ? `“${dataset.orderFeedback[0].comment}”`
                    : 'Not available'}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Submitted at</span>
                <span className="field-val">
                  {dataset.hasLiveRecords && dataset.orderFeedback.length > 0
                    ? dataset.orderFeedback[0].submittedAt
                    : 'Not available'}
                </span>
              </div>

              <div className="order-linked-field">
                <span className="field-label">Status</span>
                <span className="field-pill">
                  {dataset.hasLiveRecords && dataset.orderFeedback.length > 0
                    ? dataset.orderFeedback[0].status.toUpperCase()
                    : 'Not available'}
                </span>
              </div>

              <div className="order-linked-confirm-link">
                <button
                  type="button"
                  className="link-confirm-backend"
                  id="link-confirm-feedback-schema"
                  onClick={() => setActiveSchemaModal(FEEDBACK_SCHEMA_SPECS[0])}
                >
                  Confirm with backend
                </button>
              </div>

              <div className="order-linked-action-box">
                <button
                  type="button"
                  className={`btn-open-order ${!dataset.hasLiveRecords ? 'disabled' : ''}`}
                  id="btn-open-associated-order"
                  onClick={handleOpenOrder}
                  disabled={!dataset.hasLiveRecords}
                >
                  Open associated order
                </button>
                <p className="order-action-note">
                  No submitted record or order link supplied. Individual feedback remains inside its associated order detail.
                </p>
              </div>
            </div>
          </div>

          {/* Card D: Review boundaries */}
          <div className="feedback-card" id="card-review-boundaries">
            <div className="feedback-card-header">
              <h2 className="feedback-card-title">Review boundaries</h2>
            </div>

            <div className="boundaries-body">
              <div className="boundaries-subheading">No data yet</div>
              <p className="boundaries-text">
                No sentiment, quotations or topics are inferred. Branch, period and permissions resolve through the backend.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Footer Notice */}
      <div className="feedback-bottom-notice">
        Design only · No live data connection. Backend owns validation, authorization and transactions.
      </div>

      {/* Interactive Modal for "Confirm with backend" */}
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
