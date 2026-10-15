import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Grid, AlertCircle } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { tableService, SafeDiningTable, TableOperationalStatus } from '../../services/tableService';
import { ApiClientError } from '../../services/apiClient';
import './AddTableModal.css';

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTable: SafeDiningTable, qr?: { rawToken: string; qrUrl: string }) => void;
}

export const AddTableModal: React.FC<AddTableModalProps> = ({ isOpen, onClose, onSave }) => {
  const { activeBranch, restaurant } = useRestaurant();

  const [tableNumberNum, setTableNumberNum] = useState('1');
  const [capacity, setCapacity] = useState(4);
  const [status, setStatus] = useState<TableOperationalStatus>('available');
  const [isActive, setIsActive] = useState(true);
  const [autoGenerateQR, setAutoGenerateQR] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const fullTableNumber = `T-${tableNumberNum.trim()}`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!activeBranch) {
      setError('No active branch selected. Please select a branch before adding tables.');
      return;
    }

    if (!tableNumberNum.trim()) {
      setError('Table identifier is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await tableService.createTable({
        branchId: activeBranch.id,
        tableNumber: fullTableNumber,
        capacity,
        status,
        isActive,
        isQrActive: autoGenerateQR,
      });

      onSave(res.table, res.qr);
      onClose();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.details && Array.isArray(err.details)) {
          const formatted = (err.details as Array<{ field?: string; message: string }>)
            .map((d) => d.message)
            .join('. ');
          setError(formatted || err.message);
        } else {
          setError(err.message);
        }
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to create table');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const statusOptions: { key: TableOperationalStatus; label: string; sub: string; dotColor: string }[] = [
    { key: 'available', label: 'Available', sub: 'Ready', dotColor: '#059669' },
    { key: 'occupied', label: 'Occupied', sub: 'Dining', dotColor: '#dc2626' },
    { key: 'reserved', label: 'Reserved', sub: 'Booked', dotColor: '#d97706' },
    { key: 'maintenance', label: 'Maintenance', sub: 'Out of service', dotColor: '#6b7280' },
  ];

  return (
    <div className="add-table-modal-overlay" onClick={onClose}>
      <div className="add-table-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header-row">
          <div className="modal-title-left">
            <div className="modal-icon-badge">
              <Plus size={16} strokeWidth={2.5} />
            </div>
            <div>
              <div className="modal-title-group">
                <h3 className="modal-main-title">Add New Table</h3>
                <span className="modal-schema-tag">schema: restaurant_tables</span>
              </div>
              <p className="modal-subtitle">
                Configure dining table properties, capacity parameters, and atomic QR token generation.
              </p>
            </div>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 14px',
              borderRadius: '8px',
              backgroundColor: 'rgba(229, 57, 53, 0.15)',
              border: '1px solid rgba(229, 57, 53, 0.35)',
              color: '#ff6c64',
              fontSize: '13px',
              margin: '0 24px 16px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {/* Modal Body with 2 Columns */}
        <form onSubmit={handleSubmit} className="modal-body-grid">
          {/* Left Form Column */}
          <div className="modal-form-col">
            {/* Primary Key Tag */}
            <div className="primary-key-box">
              <div className="pk-badge-group">
                <span className="pk-label">PRIMARY KEY</span>
                <span className="pk-type-tag">id: UUID</span>
              </div>
              <span className="pk-auto-note">Generated by database</span>
            </div>

            {/* Restaurant Branch */}
            <div className="modal-field-group">
              <div className="field-label-row">
                <label className="field-main-label">Restaurant Branch *</label>
                <span className="field-type-tag">branch_id (UUID)</span>
              </div>
              <select className="modal-select" disabled>
                <option>
                  {restaurant?.name || 'Restaurant'} · {activeBranch?.name || 'Main Branch'}
                </option>
              </select>
              <span className="field-hint-text">Pre-selected to the active branch context ({activeBranch?.id || 'Loaded'}).</span>
            </div>

            {/* Table Identifier */}
            <div className="modal-field-group">
              <div className="field-label-row">
                <label className="field-main-label">Table Identifier *</label>
                <span className="field-type-tag">table_number VARCHAR(20)</span>
              </div>
              <div className="table-prefix-input-wrap">
                <span className="table-input-prefix">T-</span>
                <input
                  type="text"
                  className="table-number-input"
                  value={tableNumberNum}
                  onChange={(e) => setTableNumberNum(e.target.value)}
                  maxLength={18}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="field-hint-split">
                <span>Required. Must be unique within this branch.</span>
                <span>Max 20 chars</span>
              </div>
            </div>

            {/* Seating Capacity */}
            <div className="modal-field-group">
              <div className="field-label-row">
                <label className="field-main-label">Seating Capacity *</label>
                <span className="field-type-tag">capacity INT DEFAULT 2</span>
              </div>
              <div className="capacity-stepper-row">
                <div className="stepper-controls">
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={isSubmitting || capacity <= 1}
                    onClick={() => setCapacity(Math.max(1, capacity - 1))}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="stepper-val">{capacity}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    disabled={isSubmitting || capacity >= 100}
                    onClick={() => setCapacity(Math.min(100, capacity + 1))}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="capacity-quick-pills">
                  {[2, 4, 6, 8].map((seats) => (
                    <button
                      key={seats}
                      type="button"
                      disabled={isSubmitting}
                      className={`pill-btn ${capacity === seats ? 'selected' : ''}`}
                      onClick={() => setCapacity(seats)}
                    >
                      {seats === 8 ? '8+ seats' : `${seats} seats`}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Initial Operational Status */}
            <div className="modal-field-group">
              <div className="field-label-row">
                <label className="field-main-label">Initial Operational Status *</label>
                <span className="field-type-tag">status VARCHAR(20)</span>
              </div>
              <div className="status-selection-grid">
                {statusOptions.map((opt) => (
                  <div
                    key={opt.key}
                    className={`status-choice-card ${status === opt.key ? 'selected' : ''}`}
                    onClick={() => setStatus(opt.key)}
                  >
                    <div className="status-choice-header">
                      <span className="choice-dot" style={{ background: opt.dotColor }} />
                      <span className="choice-label">{opt.label}</span>
                    </div>
                    <span className="choice-sub">{opt.sub}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active & Orderable Toggle */}
            <div className="modal-toggle-row">
              <div className="toggle-text-block">
                <div className="toggle-label-with-type">
                  <span className="toggle-label-bold">Active & Orderable</span>
                  <span className="toggle-type-badge">is_active: true</span>
                </div>
                <p className="toggle-sub-note">
                  When enabled, table is available for customer ordering and floor management.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isActive}
                disabled={isSubmitting}
                className={`toggle-switch ${isActive ? 'switch-on-red' : 'switch-off'}`}
                onClick={() => setIsActive(!isActive)}
              >
                <span className="toggle-thumb" />
              </button>
            </div>

            {/* Auto-generate Static QR Checkbox */}
            <div className="qr-checkbox-banner">
              <label className="qr-checkbox-label">
                <input
                  type="checkbox"
                  checked={autoGenerateQR}
                  onChange={(e) => setAutoGenerateQR(e.target.checked)}
                  disabled={isSubmitting}
                  className="qr-checkbox-input"
                />
                <span className="qr-checkbox-title">Auto-generate secure QR code on creation</span>
              </label>
              <p className="qr-checkbox-desc">
                Generates a cryptographically secure token with 256 bits of entropy and stores its SHA-256 hash.
              </p>
            </div>
          </div>

          {/* Right Live Preview Column */}
          <div className="modal-preview-col">
            {/* Live Grid Card Preview */}
            <div className="preview-section-box">
              <div className="preview-box-header">
                <span className="preview-header-label">LIVE GRID CARD PREVIEW</span>
                <span className="sync-badge">Synchronized</span>
              </div>

              <div className="table-card-preview-item">
                <div className="preview-card-top">
                  <span className="preview-table-num">{fullTableNumber}</span>
                  <Grid size={14} className="preview-grid-icon" />
                </div>
                <div className="preview-seats-text">{capacity} seats</div>

                <div className="preview-status-badge">
                  <span className="status-dot-green" />
                  <span style={{ textTransform: 'capitalize' }}>{status}</span>
                </div>

                <div className="preview-sub-flags">
                  Table active: {isActive ? 'Yes' : 'No'} · QR: {autoGenerateQR ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Payload Preview */}
            <div className="preview-section-box payload-preview-card">
              <div className="preview-header-label text-center">QR PREVIEW</div>

              {/* QR Pattern SVG */}
              <div className="qr-code-graphic-box">
                <svg viewBox="0 0 100 100" className="qr-svg-preview">
                  <rect x="10" y="10" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="15" y="15" width="14" height="14" fill="#ffffff" />
                  <rect x="18" y="18" width="8" height="8" fill="#111827" />

                  <rect x="66" y="10" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="71" y="15" width="14" height="14" fill="#ffffff" />
                  <rect x="74" y="18" width="8" height="8" fill="#111827" />

                  <rect x="10" y="66" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="15" y="71" width="14" height="14" fill="#ffffff" />
                  <rect x="18" y="74" width="8" height="8" fill="#111827" />

                  {/* QR Data Dots */}
                  <rect x="44" y="14" width="8" height="8" fill="#111827" />
                  <rect x="44" y="32" width="8" height="8" fill="#111827" />
                  <rect x="44" y="50" width="8" height="8" fill="#111827" />
                  <rect x="44" y="68" width="8" height="8" fill="#111827" />
                  <rect x="24" y="44" width="8" height="8" fill="#111827" />
                  <rect x="68" y="44" width="8" height="8" fill="#111827" />
                  <rect x="68" y="68" width="12" height="12" fill="#111827" />
                  <rect x="56" y="78" width="8" height="8" fill="#111827" />
                </svg>
              </div>

              <div className="payload-text-headline">
                {restaurant?.name || 'Restaurant'} · Table {fullTableNumber}
              </div>
              <div className="payload-url-text" style={{ fontSize: '11px', color: '#9ca3af' }}>
                Secure QR URL generated atomically upon save
              </div>
            </div>

            <div className="schema-audits-note">
              <span>🕒</span>
              <span>Schema audits: created_at and updated_at tracked automatically.</span>
            </div>
          </div>

          {/* Modal Footer inside form */}
          <div className="modal-footer-row" style={{ gridColumn: 'span 2' }}>
            <span className="esc-discard-hint">Press <kbd>ESC</kbd> to discard changes</span>

            <div className="footer-actions-group">
              <button
                type="button"
                className="btn btn-outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary-red save-qr-btn"
                disabled={isSubmitting}
              >
                <Check size={14} strokeWidth={2.5} />
                <span>{isSubmitting ? 'Creating table...' : 'Save & Generate QR'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
