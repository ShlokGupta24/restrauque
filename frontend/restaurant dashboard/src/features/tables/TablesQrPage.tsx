import React, { useState } from 'react';
import { Plus, ArrowUpRight, Grid, Download, Printer } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { mockTables } from '../../services/tableData';
import { RestaurantTable } from '../../types/domain';
import { AddTableModal } from './AddTableModal';
import './TablesQrPage.css';

export const TablesQrPage: React.FC = () => {
  const { activeBranch } = useRestaurant();

  const [tables, setTables] = useState<RestaurantTable[]>(mockTables);
  const [selectedTableId, setSelectedTableId] = useState<string>('tbl_04'); // T04 selected in Tables&QR.png
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const selectedTable = tables.find((t) => t.id === selectedTableId) || tables[0];

  const handleSaveNewTable = (newTable: RestaurantTable) => {
    setTables((prev) => [...prev, newTable]);
    setSelectedTableId(newTable.id);
  };

  const totalTables = tables.length > 12 ? tables.length : 24;
  const activeTablesCount = tables.filter((t) => t.isActive).length > 12 ? tables.filter((t) => t.isActive).length : 22;
  const qrActiveCount = tables.filter((t) => t.qrActive).length > 12 ? tables.filter((t) => t.qrActive).length : 9;
  const inactiveTablesCount = 2;

  return (
    <div className="tables-qr-container">
      {/* Sub-banner notice */}
      <div className="tables-subbanner">
        Table status, table active and QR active are independent · Demo branch: {activeBranch.name.replace(' branch', '')}.
      </div>

      {/* Top Header Action Row */}
      <div className="tables-top-action-row">
        <div />
        <button
          type="button"
          className="btn btn-primary-red add-table-btn"
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
            <div>Demo values</div>
            <div>Demo values</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">Active tables</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{activeTablesCount}</div>
          <div className="tables-kpi-note">
            <div>Demo values</div>
            <div>Demo values</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">QR active</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{qrActiveCount}</div>
          <div className="tables-kpi-note">
            <div>Demo values</div>
            <div>Demo values</div>
          </div>
        </div>

        <div className="card tables-kpi-card">
          <div className="kpi-top-row">
            <span className="tables-kpi-label">Inactive tables</span>
            <ArrowUpRight size={15} className="kpi-arrow-icon" />
          </div>
          <div className="tables-kpi-value">{inactiveTablesCount}</div>
          <div className="tables-kpi-note">
            <div>Demo values</div>
            <div>Demo values</div>
          </div>
        </div>
      </div>

      {/* 2-Column Content Grid: Floor Tables + QR Preview */}
      <div className="tables-content-grid">
        {/* Left Column: Floor Tables */}
        <div className="card floor-tables-card">
          <div className="card-header-clean">
            <h3 className="card-title">Floor tables</h3>
            <div className="card-subtitle">Select a table to view its QR entry.</div>
          </div>

          <div className="floor-grid-cards">
            {tables.map((tbl) => {
              const isSelected = tbl.id === selectedTable.id;
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

                  <div className="floor-status-badge">Pending</div>

                  <div className="floor-sub-info">
                    Table active: {tbl.isActive ? 'Yes' : 'No'} · QR: {tbl.qrActive ? 'Yes' : 'No'}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="floor-footer-notice">
            Branch context: Lucknow · Hazratganj. Table status and QR preview are illustrative; real QR tokens require backend integration.
          </div>
        </div>

        {/* Right Column: QR Code Preview */}
        <div className="card qr-preview-card">
          <div className="card-header-clean">
            <h3 className="card-title">QR code preview</h3>
            <div className="card-subtitle">
              Preview is static. Public QR resolution and token contract are unconfirmed.
            </div>
          </div>

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
            Demo · Hazratganj · Table {selectedTable.tableNumber}
          </div>
          <div className="qr-subline-text">
            Preview is masked. Public QR resolution and token contract are unconfirmed.
          </div>

          {/* Action Buttons */}
          <div className="qr-actions-list">
            <button type="button" className="btn btn-outline qr-btn-action" disabled>
              <Download size={14} />
              <span>Download QR code</span>
            </button>

            <button type="button" className="btn btn-outline qr-btn-action" disabled>
              <Printer size={14} />
              <span>Print table tent</span>
            </button>
          </div>

          {/* Backend Confirmation Box */}
          <div className="backend-confirm-box">
            <div className="confirm-box-title">Backend confirmation</div>
            <p className="confirm-box-text">
              Status enum and public QR contract pending. Table active and QR active are separate booleans. Download/print disabled until a safe public token is supplied.
            </p>
          </div>
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
