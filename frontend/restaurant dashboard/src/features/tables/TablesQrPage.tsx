import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  ArrowUpRight,
  Grid,
  RefreshCw,
  AlertCircle,
  Check,
  RotateCw,
  ExternalLink,
  Copy,
  Trash2,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  tableService,
  SafeDiningTable,
  TableSummaryCounts,
  TableOperationalStatus,
  SafeQrCodeMetadata,
} from '../../services/tableService';
import { AddTableModal } from './AddTableModal';
import './TablesQrPage.css';

export const TablesQrPage: React.FC = () => {
  const { activeBranch, restaurant } = useRestaurant();

  const [tables, setTables] = useState<SafeDiningTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [summary, setSummary] = useState<TableSummaryCounts | null>(null);
  const [tableQrMetadata, setTableQrMetadata] = useState<SafeQrCodeMetadata | null>(null);
  const [tableQrUrls, setTableQrUrls] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [isRotatingQr, setIsRotatingQr] = useState<boolean>(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState<boolean>(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 3500);
  };

  // Load tables from backend
  const loadTables = useCallback(async () => {
    if (!activeBranch) {
      setTables([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await tableService.getTables({
        branchId: activeBranch.id,
        limit: 100,
      });

      setTables(res.tables);
      setSummary(res.summary);

      if (res.tables.length > 0) {
        setSelectedTableId((prev) => {
          const exists = res.tables.find((t) => t.id === prev);
          return exists ? exists.id : res.tables[0].id;
        });
      } else {
        setSelectedTableId(null);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load dining tables';
      setError(msg);
      setTables([]);
    } finally {
      setIsLoading(false);
    }
  }, [activeBranch]);

  // Load QR metadata for selected table
  const loadSelectedQrMetadata = useCallback(async (tableId: string) => {
    try {
      const res = await tableService.getTableQr(tableId);
      setTableQrMetadata(res.qr);
    } catch {
      setTableQrMetadata(null);
    }
  }, []);

  useEffect(() => {
    loadTables();
  }, [loadTables]);

  useEffect(() => {
    if (selectedTableId) {
      loadSelectedQrMetadata(selectedTableId);
    } else {
      setTableQrMetadata(null);
    }
  }, [selectedTableId, loadSelectedQrMetadata]);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || null;

  // Handle table created from modal
  const handleSaveNewTable = (
    newTable: SafeDiningTable,
    qr?: { rawToken: string; qrUrl: string }
  ) => {
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(newTable.id);
    if (qr?.qrUrl) {
      setTableQrUrls((prev) => ({ ...prev, [newTable.id]: qr.qrUrl }));
    }
    showToast(`Table "${newTable.tableNumber}" created with active QR!`);
    loadTables();
  };

  // Rotate QR code for selected table
  const handleRotateQr = async () => {
    if (!selectedTable || isRotatingQr) return;

    const confirmed = window.confirm(
      `Rotate QR code for table "${selectedTable.tableNumber}"? Any previously printed or saved QR codes for this table will be invalidated immediately.`
    );
    if (!confirmed) return;

    setIsRotatingQr(true);
    try {
      const res = await tableService.rotateTableQr(selectedTable.id);
      setTableQrUrls((prev) => ({ ...prev, [selectedTable.id]: res.qrUrl }));

      setTables((prev) =>
        prev.map((t) => (t.id === selectedTable.id ? { ...t, isQrActive: true } : t))
      );

      showToast(`QR code rotated for "${selectedTable.tableNumber}". New URL generated!`);
      await loadSelectedQrMetadata(selectedTable.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to rotate QR code';
      alert(msg);
    } finally {
      setIsRotatingQr(false);
    }
  };

  // Toggle QR active state on selected table
  const handleToggleQrActive = async () => {
    if (!selectedTable || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    const nextQrActive = !selectedTable.isQrActive;
    try {
      const res = await tableService.updateTable(selectedTable.id, {
        isQrActive: nextQrActive,
      });

      setTables((prev) =>
        prev.map((t) => (t.id === selectedTable.id ? { ...t, isQrActive: res.table.isQrActive } : t))
      );
      showToast(`QR ordering ${nextQrActive ? 'enabled' : 'disabled'} for "${selectedTable.tableNumber}"`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to toggle QR status';
      alert(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Change table operational status
  const handleChangeStatus = async (nextStatus: TableOperationalStatus) => {
    if (!selectedTable || isUpdatingStatus) return;

    setIsUpdatingStatus(true);
    try {
      const res = await tableService.updateTable(selectedTable.id, {
        status: nextStatus,
      });

      setTables((prev) =>
        prev.map((t) => (t.id === selectedTable.id ? { ...t, status: res.table.status } : t))
      );
      showToast(`Table "${selectedTable.tableNumber}" set to ${nextStatus}`);
      loadTables();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to update table status';
      alert(msg);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Delete / Archive Table
  const handleDeleteTable = async (table: SafeDiningTable) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete table "${table.tableNumber}"? If the table has past order history, it will be safely deactivated and archived.`
    );
    if (!confirmed) return;

    try {
      const res = await tableService.deleteTable(table.id);
      showToast(res.message);
      await loadTables();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to delete table';
      alert(msg);
    }
  };

  // Copy QR Link
  const handleCopyQrLink = (url: string) => {
    navigator.clipboard.writeText(url);
    showToast('Authoritative QR Link copied to clipboard!');
  };

  // Metrics
  const totalTables = summary ? summary.totalTables : tables.length;
  const activeTablesCount = summary ? summary.activeTables : tables.filter((t) => t.isActive).length;
  const qrActiveCount = summary ? summary.qrActiveTables : tables.filter((t) => t.isQrActive).length;
  const inactiveTablesCount = summary ? summary.inactiveTables : tables.filter((t) => !t.isActive).length;

  const currentQrUrl = selectedTable ? tableQrUrls[selectedTable.id] : undefined;

  const getStatusBadgeStyle = (status: TableOperationalStatus) => {
    switch (status) {
      case 'available':
        return { bg: '#ecfdf5', color: '#059669', label: 'Available' };
      case 'occupied':
        return { bg: '#fef2f2', color: '#dc2626', label: 'Occupied' };
      case 'reserved':
        return { bg: '#fef3c7', color: '#d97706', label: 'Reserved' };
      case 'maintenance':
        return { bg: '#f3f4f6', color: '#6b7280', label: 'Maintenance' };
      default:
        return { bg: '#f3f4f6', color: '#6b7280', label: status };
    }
  };

  return (
    <div className="tables-qr-container">
      {/* Sub-banner notice */}
      <div className="tables-subbanner">
        Authoritative dining tables & secure QR token lifecycle · Branch: {activeBranch?.name || 'Active Branch'}.
      </div>

      {successToast && (
        <div
          style={{
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: '#059669',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
          }}
        >
          <Check size={16} /> {successToast}
        </div>
      )}

      {error && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 14px',
            borderRadius: '8px',
            backgroundColor: 'rgba(229, 57, 53, 0.1)',
            border: '1px solid rgba(229, 57, 53, 0.3)',
            color: '#ff6c64',
            fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadTables}
            style={{
              background: 'none',
              border: 'none',
              color: '#ff6c64',
              fontWeight: 600,
              cursor: 'pointer',
              textDecoration: 'underline',
            }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Top Header Action Row */}
      <div className="tables-top-action-row">
        <div />
        <button
          type="button"
          className="btn btn-primary-red add-table-btn"
          id="btn-add-table"
          onClick={() => setIsAddModalOpen(true)}
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>Add table</span>
        </button>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="tables-kpi-grid">
        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">Total tables</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{totalTables}</div>
          <div className="tables-kpi-note">
            <div>All registered tables</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">Active tables</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{activeTablesCount}</div>
          <div className="tables-kpi-note">
            <div>Orderable on floor</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">QR active</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{qrActiveCount}</div>
          <div className="tables-kpi-note">
            <div>Digital QR enabled</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">Inactive tables</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{inactiveTablesCount}</div>
          <div className="tables-kpi-note" style={{ color: '#9ca3af' }}>
            <div>Disabled / Archived</div>
          </div>
        </div>
      </div>

      {/* 2-Column Content Grid: Floor Tables + QR Preview */}
      <div className="tables-content-grid">
        {/* Left Column: Floor Tables */}
        <div className="card floor-tables-card">
          <div className="card-header-clean">
            <div>
              <h3 className="card-title">Floor tables</h3>
              <div className="card-subtitle">
                Select a table to view its secure QR entry and live controls.
              </div>
            </div>
            <button
              type="button"
              className="filter-chip-btn"
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              onClick={loadTables}
              disabled={isLoading}
            >
              <RefreshCw size={13} className={isLoading ? 'spin-icon' : ''} />
              <span>Refresh</span>
            </button>
          </div>

          {isLoading && tables.length === 0 ? (
            <div style={{ padding: '60px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Loading dining tables from backend...
            </div>
          ) : tables.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '8px',
                margin: '16px 0',
              }}
            >
              <p style={{ margin: '0 0 14px', fontSize: '14px', color: '#d1d5db' }}>
                No tables registered for this branch yet.
              </p>
              <button
                type="button"
                className="btn btn-primary-red"
                onClick={() => setIsAddModalOpen(true)}
                style={{ fontSize: '12px', padding: '6px 14px' }}
              >
                <Plus size={14} style={{ marginRight: '4px' }} /> Add your first table
              </button>
            </div>
          ) : (
            <div className="floor-grid-cards">
              {tables.map((tbl) => {
                const isSelected = tbl.id === selectedTable?.id;
                const badge = getStatusBadgeStyle(tbl.status);

                return (
                  <div
                    key={tbl.id}
                    className={`floor-table-item ${isSelected ? 'table-selected' : ''}`}
                    onClick={() => setSelectedTableId(tbl.id)}
                  >
                    <div className="floor-table-top">
                      <span className="floor-table-num">{tbl.tableNumber}</span>
                      <Grid size={15} className="floor-grid-icon" />
                    </div>

                    <div className="floor-seats-text">{tbl.capacity} seats</div>

                    <div
                      className="floor-status-badge"
                      style={{ backgroundColor: badge.bg, color: badge.color }}
                    >
                      {badge.label}
                    </div>

                    <div className="floor-sub-info">
                      Active: {tbl.isActive ? 'Yes' : 'No'} · QR: {tbl.isQrActive ? 'Yes' : 'No'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="floor-footer-notice">
            Branch: {activeBranch?.name || 'Milano Branch'}. Table status and QR tokens are persisted in Neon PostgreSQL.
          </div>
        </div>

        {/* Right Column: QR Code Preview */}
        <div className="card qr-preview-card">
          <div className="card-header-clean">
            <h3 className="card-title">QR code preview</h3>
            <div className="card-subtitle">
              Cryptographically secure QR token bound to table.
            </div>
          </div>

          {selectedTable ? (
            <>
              {/* Large QR Box */}
              <div className="large-qr-container">
                <svg viewBox="0 0 100 100" className="large-qr-svg">
                  {/* Outer Position Markers */}
                  <rect x="10" y="10" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="15" y="15" width="14" height="14" fill="#ffffff" />
                  <rect x="18" y="18" width="8" height="8" fill="#111827" />

                  <rect x="66" y="10" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="71" y="15" width="14" height="14" fill="#ffffff" />
                  <rect x="74" y="18" width="8" height="8" fill="#111827" />

                  <rect x="10" y="66" width="24" height="24" rx="4" fill="#111827" />
                  <rect x="15" y="71" width="14" height="14" fill="#ffffff" />
                  <rect x="18" y="74" width="8" height="8" fill="#111827" />

                  {/* Data Blocks */}
                  <rect x="44" y="12" width="8" height="8" fill="#111827" />
                  <rect x="44" y="30" width="8" height="8" fill="#111827" />
                  <rect x="44" y="48" width="8" height="8" fill="#111827" />
                  <rect x="44" y="66" width="8" height="8" fill="#111827" />
                  <rect x="24" y="44" width="8" height="8" fill="#111827" />
                  <rect x="68" y="44" width="8" height="8" fill="#111827" />
                  <rect x="68" y="68" width="12" height="12" fill="#111827" />
                  <rect x="56" y="80" width="8" height="8" fill="#111827" />
                  <rect x="34" y="56" width="6" height="6" fill="#111827" />
                  <rect x="56" y="34" width="6" height="6" fill="#111827" />
                </svg>
              </div>

              <div className="qr-headline-text">
                {restaurant?.name || 'Restaurant'} · {selectedTable.tableNumber}
              </div>
              <div className="qr-subline-text">
                Status: <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{selectedTable.status}</span> · {selectedTable.capacity} Seats · ID: <small style={{ color: '#9ca3af' }}>{selectedTable.id}</small>
              </div>

              {/* Status Switcher Row */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '6px' }}>
                  OPERATIONAL STATUS
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {(['available', 'occupied', 'reserved', 'maintenance'] as TableOperationalStatus[]).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={isUpdatingStatus}
                      onClick={() => handleChangeStatus(st)}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: selectedTable.status === st ? '1px solid var(--brand-red)' : '1px solid #374151',
                        backgroundColor: selectedTable.status === st ? 'rgba(229, 57, 53, 0.15)' : '#1f2937',
                        color: selectedTable.status === st ? '#ffffff' : '#9ca3af',
                        fontSize: '11px',
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        fontWeight: selectedTable.status === st ? 600 : 400,
                      }}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="qr-actions-list">
                {currentQrUrl ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline qr-btn-action"
                      onClick={() => handleCopyQrLink(currentQrUrl)}
                    >
                      <Copy size={14} />
                      <span>Copy Customer QR Link</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline qr-btn-action"
                      onClick={() => window.open(currentQrUrl, '_blank')}
                    >
                      <ExternalLink size={14} />
                      <span>Open Customer QR Order Page</span>
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="btn btn-outline qr-btn-action"
                    disabled={isRotatingQr}
                    onClick={handleRotateQr}
                  >
                    <RotateCw size={14} className={isRotatingQr ? 'spin-icon' : ''} />
                    <span>{isRotatingQr ? 'Generating QR token...' : 'Generate / Rotate QR Token'}</span>
                  </button>
                )}

                {currentQrUrl && (
                  <button
                    type="button"
                    className="btn btn-outline qr-btn-action"
                    disabled={isRotatingQr}
                    onClick={handleRotateQr}
                    style={{ color: '#f59e0b', borderColor: '#78350f' }}
                  >
                    <RotateCw size={14} className={isRotatingQr ? 'spin-icon' : ''} />
                    <span>Rotate QR Token (Invalidates old code)</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn btn-outline qr-btn-action"
                  disabled={isUpdatingStatus}
                  onClick={handleToggleQrActive}
                >
                  <span>{selectedTable.isQrActive ? 'Disable QR Ordering' : 'Enable QR Ordering'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline qr-btn-action"
                  onClick={() => handleDeleteTable(selectedTable)}
                  style={{ color: '#ff6c64', borderColor: 'rgba(229, 57, 53, 0.4)' }}
                >
                  <Trash2 size={14} />
                  <span>Delete / Archive Table</span>
                </button>
              </div>

              {/* Backend Confirmation Box */}
              <div className="backend-confirm-box">
                <div className="confirm-box-title">Cryptographic Token Status</div>
                <p className="confirm-box-text">
                  {currentQrUrl ? (
                    <>
                      Active token URL loaded: <br />
                      <code style={{ fontSize: '10px', color: '#10b981', wordBreak: 'break-all' }}>
                        {currentQrUrl}
                      </code>
                    </>
                  ) : tableQrMetadata ? (
                    <>
                      QR record registered: <code>{tableQrMetadata.id}</code> (SHA-256 hash stored in DB).
                      Click "Generate / Rotate QR Token" above to generate a new active public URL.
                    </>
                  ) : (
                    'No active QR code recorded. Click generate above to create one.'
                  )}
                </p>
              </div>
            </>
          ) : (
            <div style={{ padding: '40px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
              Select a table from the floor grid to view details and manage QR tokens.
            </div>
          )}
        </div>
      </div>

      {/* Add Table Modal Dialog */}
      <AddTableModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSave={handleSaveNewTable}
      />
    </div>
  );
};
