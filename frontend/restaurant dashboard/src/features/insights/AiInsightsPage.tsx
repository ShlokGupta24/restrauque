import React, { useState } from 'react';
import {
  SCHEMA_REQUIREMENTS,
  SAMPLE_SIMULATED_INSIGHTS,
  AiInsightRecord,
  SchemaRequirementSpec,
} from '../../services/insightsData';
import './AiInsightsPage.css';

export const AiInsightsPage: React.FC = () => {
  const [activeSchemaModal, setActiveSchemaModal] = useState<SchemaRequirementSpec | null>(null);
  const [showSimulatedPreview, setShowSimulatedPreview] = useState<boolean>(false);
  const [simulatedInsights, setSimulatedInsights] = useState<AiInsightRecord[]>(SAMPLE_SIMULATED_INSIGHTS);
  const [copiedNotice, setCopiedNotice] = useState<string | null>(null);

  const handleActionApproval = (insightId: string, approved: boolean) => {
    setSimulatedInsights((prev) =>
      prev.map((ins) => {
        if (ins.id === insightId && ins.proposed_action) {
          return {
            ...ins,
            proposed_action: {
              ...ins.proposed_action,
              status: approved ? 'approved' : 'rejected',
            },
          };
        }
        return ins;
      })
    );
  };

  const handleCopySpec = (spec: SchemaRequirementSpec) => {
    const text = `Table: ${spec.table}\nStatus: ${spec.status}\nColumns:\n${spec.columns.join('\n')}\nNotes: ${spec.notes}`;
    navigator.clipboard?.writeText(text);
    setCopiedNotice(spec.table);
    setTimeout(() => setCopiedNotice(null), 2500);
  };

  return (
    <div className="ai-insights-page">
      {/* Top Header Section */}
      <div className="insights-header-section">
        <div className="insights-title-row">
          <div>
            <h1>AI Insights</h1>
            <p className="insights-subtitle">
              No records supplied · branch and filters resolve through the backend.
            </p>
          </div>

          <div className="insights-header-actions">
            {/* Interactive Toggle for Sample Preview */}
            <button
              className={`btn-preview-toggle ${showSimulatedPreview ? 'active' : ''}`}
              id="btn-toggle-ai-preview"
              onClick={() => setShowSimulatedPreview(!showSimulatedPreview)}
              title="Toggle between Reference Schema View and Simulated Evidence Insights"
            >
              <span className="sparkle-icon">✦</span>
              {showSimulatedPreview ? 'View Reference State' : 'Preview Simulated Insights'}
            </button>

            {/* Reference image disabled button */}
            <button
              className="btn-disabled-endpoint"
              id="btn-disabled-endpoint-top"
              disabled
            >
              Disabled / No endpoint
            </button>
          </div>
        </div>
      </div>

      {/* Simulated Preview Mode Banner when active */}
      {showSimulatedPreview && (
        <div className="simulated-preview-banner">
          <div className="preview-banner-text">
            <span className="preview-indicator-badge">SIMULATED PREVIEW</span>
            <span>
              Displaying demonstration evidence records for <strong>Basil & Brick · Hazratganj</strong> based on 1,058 completed orders and QR tables. Recommendations require owner authorization before taking effect.
            </span>
          </div>
          <button
            className="btn-close-preview"
            onClick={() => setShowSimulatedPreview(false)}
          >
            ✕ Exit Preview
          </button>
        </div>
      )}

      {!showSimulatedPreview ? (
        /* ================= 100% VISUAL PARITY WITH AIinsights.png ================= */
        <div className="reference-view-container">
          {/* Hero Dark Card */}
          <div className="hero-dark-card" id="card-ai-hero">
            <div className="hero-dark-left">
              <div className="hero-red-icon-box">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 2L14.4 9.6L22 12L14.4 14.4L12 22L9.6 14.4L2 12L9.6 9.6L12 2Z"
                    fill="white"
                  />
                </svg>
              </div>

              <div className="hero-dark-content">
                <div className="badge-preview-pill">PREVIEW</div>
                <h2 className="hero-dark-title">No AI insights yet</h2>
                <p className="hero-dark-subtitle">
                  Evidence-led insights appear only when backend records are supplied. Status and severity mappings remain unconfirmed.
                </p>
              </div>
            </div>

            <div className="hero-dark-right">
              <button
                className="btn-hero-disabled"
                id="btn-hero-disabled"
                disabled
              >
                Disabled / No endpoint
              </button>
            </div>
          </div>

          {/* Middle Row: 3 Equal Cards */}
          <div className="insights-three-cards-grid">
            {/* Card 1: No AI insights yet / Required Fields */}
            <div className="insight-card" id="card-insights-required-fields">
              <div className="insight-card-top-row">
                <span className="badge-gray-pill">NO DATA</span>
                <span className="card-top-meta-label">PENDING RECORDS</span>
              </div>

              <h2 className="insight-card-title">No AI insights yet</h2>
              <p className="insight-card-subtitle">
                No recommendations, confidence, sentiment, forecast or citation can be shown until backend records are supplied.
              </p>

              <div className="required-fields-box">
                <div className="required-fields-heading">REQUIRED FIELDS</div>
                <div className="required-fields-content">
                  <div className="fields-row">
                    <span className="table-prefix">ai_insights:</span> insight_type, title, summary, severity, status, confidence, metric_name, metric_value, previous_metric_value, change_percentage, detected_at, valid_until
                  </div>
                  <div className="fields-row">
                    <span className="table-prefix">ai_insight_evidence:</span> source_type, evidence_role, metric_name, metric_value, evidence_text
                  </div>
                </div>
              </div>

              <div className="insight-card-footer">
                <span className="footer-status-text">Evidence/detail affordance disabled</span>
                <button
                  type="button"
                  className="footer-action-link"
                  onClick={() => setActiveSchemaModal(SCHEMA_REQUIREMENTS[0])}
                  id="link-confirm-ai-insights"
                >
                  Confirm with backend
                </button>
              </div>
            </div>

            {/* Card 2: Severity filters */}
            <div className="insight-card" id="card-insights-severity">
              <div className="insight-card-top-row">
                <span className="badge-gray-pill">SEVERITY</span>
                <span className="card-top-meta-label">NEUTRAL PLACEHOLDERS</span>
              </div>

              <h2 className="insight-card-title">Severity filters</h2>
              <p className="insight-card-subtitle">
                Neutral placeholders only. Severity values will be populated from backend records.
              </p>

              <div className="neutral-placeholders-list">
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
              </div>

              <div className="insight-card-footer">
                <span className="footer-status-text">Pending backend</span>
                <button
                  type="button"
                  className="footer-action-link"
                  onClick={() => setActiveSchemaModal(SCHEMA_REQUIREMENTS[0])}
                  id="link-confirm-severity"
                >
                  Confirm with backend
                </button>
              </div>
            </div>

            {/* Card 3: Status filters */}
            <div className="insight-card" id="card-insights-status">
              <div className="insight-card-top-row">
                <span className="badge-gray-pill">STATUS</span>
                <span className="card-top-meta-label">NEUTRAL PLACEHOLDERS</span>
              </div>

              <h2 className="insight-card-title">Status filters</h2>
              <p className="insight-card-subtitle">
                Neutral placeholders only. Status values will be populated from backend records.
              </p>

              <div className="neutral-placeholders-list">
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
                <div className="placeholder-item">
                  <span className="placeholder-label">Backend value pending</span>
                  <span className="placeholder-dash">—</span>
                </div>
              </div>

              <div className="insight-card-footer">
                <span className="footer-status-text">Pending backend</span>
                <button
                  type="button"
                  className="footer-action-link"
                  onClick={() => setActiveSchemaModal(SCHEMA_REQUIREMENTS[0])}
                  id="link-confirm-status"
                >
                  Confirm with backend
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Row: 2 Cards */}
          <div className="insights-two-cards-grid">
            {/* Card 4: Inventory is not in current schema */}
            <div className="insight-card" id="card-insights-inventory">
              <div className="insight-card-top-row">
                <span className="badge-gray-pill">SCHEMA BOUNDARY</span>
                <span className="card-top-meta-label">BACKEND REQUIRED</span>
              </div>

              <h2 className="insight-card-title">Inventory is not in current schema</h2>
              <p className="insight-card-subtitle">
                On-hand stock, stock ledgers and supplier lead times were not found. This design does not present restock quantities or forecasts as stored facts.
              </p>

              <div className="info-sub-box">
                <div className="info-sub-box-title">Future integration only</div>
                <div className="info-sub-box-text">
                  Any future inventory or forecast integration requires a separate confirmed source and backend contract.
                </div>
              </div>

              <div className="insight-card-footer">
                <span className="footer-status-text">Disabled pending endpoint</span>
                <button
                  type="button"
                  className="footer-action-link"
                  onClick={() => setActiveSchemaModal(SCHEMA_REQUIREMENTS[3])}
                  id="link-confirm-inventory"
                >
                  Confirm with backend
                </button>
              </div>
            </div>

            {/* Card 5: Agent roadmap */}
            <div className="insight-card" id="card-insights-agent-roadmap">
              <div className="insight-card-top-row">
                <span className="badge-gray-pill">AGENT CAPABILITIES</span>
                <span className="card-top-meta-label">FUTURE CAPABILITY</span>
              </div>

              <h2 className="insight-card-title">Agent roadmap</h2>
              <p className="insight-card-subtitle">
                Agent runs and actions are optional future capability only. Run status, action status, approval requirement and proposed versus executed states will be distinguished when data is supplied.
              </p>

              <div className="info-sub-box">
                <div className="info-sub-box-title">Future capability notes</div>
                <div className="info-sub-box-text">
                  Agent type labels will be provided by the backend. Proposed actions will remain pending until approved. Executed actions will be audited and attributed to authorized backend permissions.
                </div>
              </div>

              <div className="insight-card-footer">
                <span className="footer-status-text">Optional future capability</span>
                <button
                  type="button"
                  className="footer-action-link"
                  onClick={() => setActiveSchemaModal(SCHEMA_REQUIREMENTS[2])}
                  id="link-confirm-agent"
                >
                  Confirm with backend
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ================= SIMULATED EVIDENCE-LED INSIGHTS VIEW ================= */
        <div className="simulated-insights-container">
          <div className="simulated-insights-header">
            <div>
              <h2>Active Evidence-Backed Insights ({simulatedInsights.length})</h2>
              <p className="simulated-header-desc">
                Derived from real order totals, table QR scans, and product sales. Each recommendation is linked directly to audit evidence.
              </p>
            </div>
            <div className="simulated-filter-pills">
              <span className="filter-pill active">All (3)</span>
              <span className="filter-pill">High Severity (1)</span>
              <span className="filter-pill">Medium Severity (1)</span>
              <span className="filter-pill">Revenue Opportunities (2)</span>
            </div>
          </div>

          <div className="simulated-cards-list">
            {simulatedInsights.map((insight) => (
              <div key={insight.id} className="simulated-insight-card">
                <div className="simulated-card-header">
                  <div className="simulated-badge-group">
                    <span className={`severity-badge ${insight.severity}`}>
                      {insight.severity.toUpperCase()}
                    </span>
                    <span className="type-badge">{insight.type_label}</span>
                    <span className="confidence-badge">
                      ✦ {insight.confidence}% Confidence
                    </span>
                  </div>
                  <span className="detected-time">Detected: {insight.detected_at}</span>
                </div>

                <div className="simulated-body">
                  <div className="simulated-text-col">
                    <h3 className="simulated-title">{insight.title}</h3>
                    <p className="simulated-summary">{insight.summary}</p>

                    {/* Metric Diff Block */}
                    <div className="metric-diff-box">
                      <div className="metric-item">
                        <span className="metric-label">{insight.metric_name}</span>
                        <span className="metric-value">{insight.metric_value}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Historical Baseline</span>
                        <span className="metric-value">{insight.previous_metric_value}</span>
                      </div>
                      <div className="metric-item">
                        <span className="metric-label">Observed Delta</span>
                        <span className={`metric-delta ${insight.change_percentage.startsWith('+') ? 'positive' : 'negative'}`}>
                          {insight.change_percentage}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Evidence Ledger Section */}
                <div className="evidence-ledger-section">
                  <div className="evidence-ledger-title">
                    <span>Audit Evidence Records (Schema: ai_insight_evidence)</span>
                    <span className="evidence-trace-badge">Traceable</span>
                  </div>
                  <div className="evidence-items-list">
                    {insight.evidence.map((ev, idx) => (
                      <div key={idx} className="evidence-row">
                        <span className="evidence-source">[{ev.source_type}]</span>
                        <span className="evidence-role">{ev.evidence_role} · <strong>{ev.metric_name}</strong>: {ev.metric_value}</span>
                        <span className="evidence-text">“{ev.evidence_text}”</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Proposed Action Approval Row */}
                {insight.proposed_action && (
                  <div className="proposed-action-row">
                    <div className="action-info">
                      <span className="action-tag">Proposed Action</span>
                      <strong className="action-title">{insight.proposed_action.title}</strong>
                      <p className="action-desc">{insight.proposed_action.description}</p>
                    </div>

                    <div className="action-buttons">
                      {insight.proposed_action.status === 'proposed' ? (
                        <>
                          <button
                            type="button"
                            className="btn-approve-action"
                            onClick={() => handleActionApproval(insight.id, true)}
                          >
                            ✓ Owner Approve
                          </button>
                          <button
                            type="button"
                            className="btn-dismiss-action"
                            onClick={() => handleActionApproval(insight.id, false)}
                          >
                            ✕ Dismiss
                          </button>
                        </>
                      ) : (
                        <span className={`status-pill ${insight.proposed_action.status}`}>
                          {insight.proposed_action.status === 'approved' ? '✓ Authorized by Owner' : '✕ Dismissed'}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Safety Rule Note at Bottom */}
      <div className="insights-safety-rule-row">
        Safety rule: recommendations must be traceable. Marketing messages, refunds and price changes require explicit permission and appropriate owner approval.
      </div>

      {/* Interactive Modal for "Confirm with backend" */}
      {activeSchemaModal && (
        <div className="schema-modal-backdrop" onClick={() => setActiveSchemaModal(null)}>
          <div
            className="schema-modal-dialog"
            onClick={(e) => e.stopPropagation()}
            id="modal-schema-contract"
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
                <span className={`modal-status-pill ${activeSchemaModal.status.replace(/\s+/g, '-').toLowerCase()}`}>
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
                {copiedNotice === activeSchemaModal.table ? '✓ Copied to clipboard!' : 'Copy Contract Schema'}
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
