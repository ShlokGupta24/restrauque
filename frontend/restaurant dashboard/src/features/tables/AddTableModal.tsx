import React, { useState, useEffect } from 'react';
import { X, Plus, Minus, Check, Grid } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { RestaurantTable, TableOperationalStatus } from '../../types/domain';
import './AddTableModal.css';

interface AddTableModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (newTable: RestaurantTable) => void;
}

export const AddTableModal: React.FC<AddTableModalProps> = ({ isOpen, onClose, onSave }) => {
  const { activeBranch } = useRestaurant();

  const [tableNumberNum, setTableNumberNum] = useState('13');
  const [capacity, setCapacity] = useState(4);
  const [status, setStatus] = useState<TableOperationalStatus>('available');
  const [isActive, setIsActive] = useState(true);
  const [autoGenerateQR, setAutoGenerateQR] = useState(true);

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

  const fullTableNumber = `T${tableNumberNum}`;
  const payloadUrl = `https://restrauque.app/r/bb-hazratganj/t${tableNumberNum.toLowerCase()}`;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newTable: RestaurantTable = {
      id: `tbl_${Date.now()}`,
      branchId: activeBranch.id,
      tableNumber: fullTableNumber,
      capacity,
      operationalStatus: status,
      isActive,
      qrActive: autoGenerateQR,
      qrPayloadUrl: payloadUrl,
    };
    onSave(newTable);
    onClose();
  };

  const statusOptions: { key: TableOperationalStatus; label: string; sub: string; dotColor: string }[] = [
    { key: 'available', label: 'Available', sub: 'Ready', dotColor: '#059669' },
    { key: 'reserved', label: 'Reserved', sub: 'Booked', dotColor: '#d97706' },
    { key: 'occupied', label: 'Occupied', sub: 'Dining', dotColor: '#dc2626' },
    { key: 'cleaning', label: 'Cleaning', sub: 'Resetting', dotColor: '#2563eb' },
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
                <span className="modal-schema-tag">schema: tables</span>
              </div>
              <p className="modal-subtitle">
                Configure dining table properties, capacity parameters, and instant QR generation.
              </p>
            </div>
          </div>

          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

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
              <span className="pk-auto-note">Auto-generated upon save</span>
            </div>

            {/* Restaurant Branch */}
            <div className="modal-field-group">
              <div className="field-label-row">
                <label className="field-main-label">Restaurant Branch *</label>
                <span className="field-type-tag">branch_id (UUID)</span>
              </div>
              <select className="modal-select" disabled>
                <option>Basil & Brick · Hazratganj, Lucknow (Default branch)</option>
              </select>
              <span className="field-hint-text">Pre-selected to the active workspace branch session.</span>
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
                  maxLength={20}
                  required
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
                    onClick={() => setCapacity(Math.max(1, capacity - 1))}
                  >
                    <Minus size={14} />
                  </button>
                  <span className="stepper-val">{capacity}</span>
                  <button
                    type="button"
                    className="stepper-btn"
                    onClick={() => setCapacity(capacity + 1)}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                <div className="capacity-quick-pills">
                  {[2, 4, 6, 8].map((seats) => (
                    <button
                      key={seats}
                      type="button"
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
                  When enabled, customers can place orders and table appears in active floor reports.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={isActive}
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
                  className="qr-checkbox-input"
                />
                <span className="qr-checkbox-title">Auto-generate static QR entry on creation</span>
              </label>
              <p className="qr-checkbox-desc">
                Creates a deterministic digital token bound to Hazratganj branch table routing contract.
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
                  <span>Available</span>
                </div>

                <div className="preview-sub-flags">
                  Table active: {isActive ? 'Yes' : 'No'} · QR: {autoGenerateQR ? 'Yes' : 'No'}
                </div>
              </div>
            </div>

            {/* Payload Preview */}
            <div className="preview-section-box payload-preview-card">
              <div className="preview-header-label text-center">PAYLOAD PREVIEW</div>

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
                Basil & Brick · Table {fullTableNumber}
              </div>
              <div className="payload-url-text">{payloadUrl}</div>
            </div>

            <div className="schema-audits-note">
              <span>🕒</span>
              <span>Schema audits: created_at and updated_at tracked automatically.</span>
            </div>
          </div>
        </form>

        {/* Modal Footer */}
        <div className="modal-footer-row">
          <span className="esc-discard-hint">Press <kbd>ESC</kbd> to discard changes</span>

          <div className="footer-actions-group">
            <button type="button" className="btn btn-outline" onClick={onClose}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary-red save-qr-btn" onClick={handleSubmit}>
              <Check size={14} strokeWidth={2.5} />
              <span>Save & Generate QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
