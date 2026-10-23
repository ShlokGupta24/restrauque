import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Download,
  Printer,
  X,
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
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);

  const printCardRef = useRef<HTMLDivElement>(null);

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

  // Load QR metadata & image for selected table
  const loadSelectedQrMetadata = useCallback(async (tableId: string) => {
    try {
      const res = await tableService.getTableQr(tableId, true);
      setTableQrMetadata(res.qr);
      if (res.qr.qrUrl) {
        setTableQrUrls((prev) => ({ ...prev, [tableId]: res.qr.qrUrl! }));
      }
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
    qr?: { rawToken: string; qrUrl: string; qrImage?: string; qrSvg?: string }
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
      showToast(
        `QR ordering ${nextQrActive ? 'enabled' : 'disabled'} for "${selectedTable.tableNumber}"`
      );
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

  // Download QR as PNG
  const handleDownloadQrPng = () => {
    if (!selectedTable || !tableQrMetadata) return;

    const fileName = `${restaurant?.name || 'Restaurant'}_${activeBranch?.name || 'Branch'}_Table_${selectedTable.tableNumber}_QR.png`.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    if (tableQrMetadata.qrImage) {
      const a = document.createElement('a');
      a.href = tableQrMetadata.qrImage;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast(`Downloaded PNG for Table ${selectedTable.tableNumber}!`);
    } else {
      // Fallback to direct backend endpoint
      const directUrl = tableService.getTableQrImageUrl(selectedTable.id, 'png');
      window.open(directUrl, '_blank');
    }
  };

  // Download QR as SVG
  const handleDownloadQrSvg = () => {
    if (!selectedTable || !tableQrMetadata?.qrSvg) return;

    const fileName = `${restaurant?.name || 'Restaurant'}_${activeBranch?.name || 'Branch'}_Table_${selectedTable.tableNumber}_QR.svg`.replace(
      /[^a-zA-Z0-9_-]/g,
      '_'
    );

    const blob = new Blob([tableQrMetadata.qrSvg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(`Downloaded SVG for Table ${selectedTable.tableNumber}!`);
  };

  // Trigger Print
  const handlePrint = () => {
    window.print();
  };

  // Metrics
  const totalTables = summary ? summary.totalTables : tables.length;
  const activeTablesCount = summary ? summary.activeTables : tables.filter((t) => t.isActive).length;
  const qrActiveCount = summary ? summary.qrActiveTables : tables.filter((t) => t.isQrActive).length;
  const inactiveTablesCount = summary ? summary.inactiveTables : tables.filter((t) => !t.isActive).length;

  const currentQrUrl = selectedTable ? tableQrUrls[selectedTable.id] || tableQrMetadata?.qrUrl : undefined;

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

        {/* Right Column: QR Code Preview & Actions */}
        <div className="card qr-preview-card">
          <div className="card-header-clean">
            <h3 className="card-title">QR code preview</h3>
            <div className="card-subtitle">
              Cryptographically secure QR token bound to table.
            </div>
          </div>

          {selectedTable ? (
            <>
              {/* Real Scannable QR Container */}
              <div className="large-qr-container">
                {tableQrMetadata?.qrSvg ? (
                  <div
                    className="real-qr-svg-wrapper"
                    dangerouslySetInnerHTML={{ __html: tableQrMetadata.qrSvg }}
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                ) : tableQrMetadata?.qrImage ? (
                  <img
                    src={tableQrMetadata.qrImage}
                    alt={`Scannable QR Code for Table ${selectedTable.tableNumber}`}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      display: 'block',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#9ca3af',
                      fontSize: '11px',
                      textAlign: 'center',
                    }}
                  >
                    Generating QR code...
                  </div>
                )}
              </div>

              <div className="qr-headline-text">
                {restaurant?.name || 'Restaurant'} · Table {selectedTable.tableNumber}
              </div>
              <div className="qr-subline-text">
                Status:{' '}
                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                  {selectedTable.status}
                </span>{' '}
                · {selectedTable.capacity} Seats · Branch: {activeBranch?.name || 'Main Branch'}
              </div>

              {/* Status Switcher Row */}
              <div style={{ marginBottom: '16px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '11px',
                    color: '#9ca3af',
                    marginBottom: '6px',
                  }}
                >
                  OPERATIONAL STATUS
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
                  {(['available', 'occupied', 'reserved', 'maintenance'] as TableOperationalStatus[]).map(
                    (st) => (
                      <button
                        key={st}
                        type="button"
                        disabled={isUpdatingStatus}
                        onClick={() => handleChangeStatus(st)}
                        style={{
                          padding: '6px 10px',
                          borderRadius: '6px',
                          border:
                            selectedTable.status === st
                              ? '1px solid var(--brand-red)'
                              : '1px solid #374151',
                          backgroundColor:
                            selectedTable.status === st
                              ? 'rgba(229, 57, 53, 0.15)'
                              : '#1f2937',
                          color: selectedTable.status === st ? '#ffffff' : '#9ca3af',
                          fontSize: '11px',
                          textTransform: 'capitalize',
                          cursor: 'pointer',
                          fontWeight: selectedTable.status === st ? 600 : 400,
                        }}
                      >
                        {st}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="qr-actions-list">
                {/* Print and Download Quick Actions */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-primary-red qr-btn-action"
                    onClick={() => setIsPrintModalOpen(true)}
                    disabled={!currentQrUrl}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Printer size={14} />
                    <span>Print Label</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-outline qr-btn-action"
                    onClick={handleDownloadQrPng}
                    disabled={!currentQrUrl}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  >
                    <Download size={14} />
                    <span>Download PNG</span>
                  </button>
                </div>

                {currentQrUrl ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-outline qr-btn-action"
                      onClick={() => handleCopyQrLink(currentQrUrl)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Copy size={14} />
                      <span>Copy Customer Scan URL</span>
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline qr-btn-action"
                      onClick={() => window.open(currentQrUrl, '_blank')}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      <span>Test Scan in Browser</span>
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
                    <span>
                      {isRotatingQr ? 'Generating QR token...' : 'Generate / Provision QR Code'}
                    </span>
                  </button>
                )}

                {currentQrUrl && (
                  <button
                    type="button"
                    className="btn btn-outline qr-btn-action"
                    disabled={isRotatingQr}
                    onClick={handleRotateQr}
                    style={{
                      color: '#f59e0b',
                      borderColor: '#78350f',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                    }}
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
                  <span>
                    {selectedTable.isQrActive ? 'Disable QR Ordering' : 'Enable QR Ordering'}
                  </span>
                </button>

                <button
                  type="button"
                  className="btn btn-outline qr-btn-action"
                  onClick={() => handleDeleteTable(selectedTable)}
                  style={{
                    color: '#ff6c64',
                    borderColor: 'rgba(229, 57, 53, 0.4)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Trash2 size={14} />
                  <span>Delete / Archive Table</span>
                </button>
              </div>

              {/* Backend Confirmation Box */}
              <div className="backend-confirm-box">
                <div className="confirm-box-title">Cryptographic Token & Resolver Status</div>
                <div className="confirm-box-text">
                  {currentQrUrl ? (
                    <>
                      <div>
                        Authoritative Scan Target:
                      </div>
                      <code
                        style={{
                          fontSize: '11px',
                          color: '#10b981',
                          wordBreak: 'break-all',
                          display: 'block',
                          margin: '4px 0',
                        }}
                      >
                        {currentQrUrl}
                      </code>
                      <div style={{ color: '#9ca3af', fontSize: '10px' }}>
                        Scannable with any iOS/Android smartphone camera. Resolves to this specific table.
                      </div>
                    </>
                  ) : (
                    'Loading QR token status from Neon database...'
                  )}
                </div>
              </div>
            </>
          ) : (
            <div
              style={{
                padding: '40px',
                textAlign: 'center',
                color: '#9ca3af',
                fontSize: '13px',
              }}
            >
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

      {/* Print Preview & Label Modal */}
      {isPrintModalOpen && selectedTable && tableQrMetadata && (
        <div
          className="print-modal-overlay"
          onClick={() => setIsPrintModalOpen(false)}
        >
          <div
            className="print-modal-container"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="print-modal-header">
              <h3>Print Table QR Label</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsPrintModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="print-modal-body">
              {/* Stand Label Card to Print */}
              <div
                id="printable-table-label"
                ref={printCardRef}
                className="printable-table-label-card"
              >
                <div className="label-restaurant-name">
                  {restaurant?.name || 'Restaurant'}
                </div>
                <div className="label-branch-name">
                  {activeBranch?.name || 'Main Branch'}
                </div>

                <div className="label-table-badge">
                  <span>TABLE</span>
                  <span className="label-table-num">{selectedTable.tableNumber}</span>
                </div>

                <div className="label-qr-wrapper">
                  {tableQrMetadata.qrImage ? (
                    <img
                      src={tableQrMetadata.qrImage}
                      alt={`QR Code Table ${selectedTable.tableNumber}`}
                      className="label-qr-img"
                    />
                  ) : (
                    <div
                      dangerouslySetInnerHTML={{ __html: tableQrMetadata.qrSvg || '' }}
                    />
                  )}
                </div>

                <div className="label-instructions">
                  <strong>SCAN TO BROWSE & ORDER</strong>
                  <p>Point phone camera at code to view live menu</p>
                </div>

                <div className="label-powered-by">
                  Powered by Restrauque Intelligence
                </div>
              </div>
            </div>

            <div className="print-modal-footer">
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleDownloadQrSvg}
              >
                <Download size={14} style={{ marginRight: '6px' }} />
                Save Vector SVG
              </button>
              <button
                type="button"
                className="btn btn-primary-red"
                onClick={handlePrint}
              >
                <Printer size={14} style={{ marginRight: '6px' }} />
                Print Sticker / Label
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
