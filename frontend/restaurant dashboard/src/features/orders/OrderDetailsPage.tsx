import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import { mockRecentOrders } from '../../services/mockData';
import './OrderDetailsPage.css';

export const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { formatCurrency, activeBranch } = useRestaurant();

  // Find order by orderNumber or id, fallback to first sample order
  const order =
    mockRecentOrders.find(
      (o) => o.orderNumber.toLowerCase() === (orderId || '').toLowerCase() || o.id === orderId
    ) || mockRecentOrders[0];

  const [orderStatus, setOrderStatus] = useState(order.orderStatus);
  const [showStatusModal, setShowStatusModal] = useState(false);

  return (
    <div className="order-details-container">
      {/* Back Navigation & Breadcrumb Subtitle */}
      <div className="order-details-top-nav">
        <button
          type="button"
          className="back-to-orders-btn"
          onClick={() => navigate('/dashboard/orders')}
        >
          <ArrowLeft size={14} />
          <span>Back to orders</span>
        </button>
        <div className="order-details-subtext">
          Orders / Detail / Demo · Currency INR, locale en-IN and Asia/Kolkata are configurable demo presentation settings.
        </div>
      </div>

      {/* Main Title Row & Actions */}
      <div className="order-details-title-row">
        <h2 className="order-details-heading">{order.orderNumber} · DEMO</h2>
        <button
          type="button"
          className="btn btn-outline change-status-btn"
          onClick={() => setShowStatusModal(true)}
        >
          Change status
        </button>
      </div>

      {/* 2-Column Content Grid */}
      <div className="order-details-grid">
        {/* Left Column (2/3 width) */}
        <div className="order-details-left-col">
          {/* 1. Order context Card */}
          <div className="card order-context-card">
            <h3 className="section-card-title">Order context</h3>

            <div className="order-context-grid">
              <div className="context-field">
                <span className="context-label">Order number</span>
                <span className="context-value bold-value">{order.orderNumber} · DEMO</span>
              </div>

              <div className="context-field">
                <span className="context-label">Order type</span>
                <span className="context-value text-unconfirmed">
                  Not available <span className="sub-hint">Confirm with backend</span>
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Canonical order status</span>
                <span className="context-value text-unconfirmed">
                  {orderStatus.toUpperCase()} <span className="sub-hint">Confirm with backend</span>
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Branch</span>
                <span className="context-value">{activeBranch.name.replace(' branch', '')} · DEMO</span>
              </div>

              <div className="context-field">
                <span className="context-label">Table - optional</span>
                <span className="context-value">
                  {order.tableNumber ? `${order.tableNumber} · DEMO` : 'Not available'}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Customer - optional</span>
                <span className="context-value">
                  {order.customerName && order.customerName !== 'Not available'
                    ? `${order.customerName} · DEMO`
                    : 'Not available'}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Ordered at</span>
                <span className="context-value">{order.orderedAt} · DEMO</span>
              </div>

              <div className="context-field">
                <span className="context-label">Completed at - optional</span>
                <span className="context-value text-unconfirmed">Not available</span>
              </div>

              <div className="context-field">
                <span className="context-label">When customer is absent</span>
                <span className="context-value text-unconfirmed">Not available</span>
              </div>
            </div>
          </div>

          {/* 2. Order items Card */}
          <div className="card order-items-card">
            <div className="order-items-header">
              <h3 className="section-card-title">Order items</h3>
              <span className="snapshot-tag">Snapshot values · DEMO</span>
            </div>

            <table className="order-items-table">
              <thead>
                <tr>
                  <th>Product / variant</th>
                  <th>Quantity</th>
                  <th>Unit price</th>
                  <th>Total price</th>
                </tr>
              </thead>
              <tbody>
                {order.items.length > 0 ? (
                  order.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="item-name-cell">{item.productName}</div>
                        <div className="item-variant-cell">
                          Variant: {item.variantName || 'Not available'}
                        </div>
                      </td>
                      <td className="item-qty-cell">{item.quantity}</td>
                      <td>{formatCurrency(item.unitPrice)} · DEMO</td>
                      <td className="item-total-cell">{formatCurrency(item.totalPrice)} · DEMO</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td>
                      <div className="item-name-cell">Paneer Tikka Wrap</div>
                      <div className="item-variant-cell">Variant: Not available</div>
                    </td>
                    <td className="item-qty-cell">2</td>
                    <td>₹220 · DEMO</td>
                    <td className="item-total-cell">₹440 · DEMO</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div className="order-items-calc-box">
              <div className="calc-instruction-text">
                <span className="calc-label">Special instructions</span>
                <span className="calc-val">Not available</span>
              </div>
              <div className="calc-formula-text">
                2 × ₹220 + ₹20 add-on = ₹460. Add-on allocation and safe item DTO: Confirm with backend.
              </div>
            </div>
          </div>

          {/* 3. Status history Card */}
          <div className="card status-history-card">
            <h3 className="section-card-title">Status history</h3>

            <div className="status-history-table-header">
              <span>Status</span>
              <span>Changed at</span>
              <span>Transition</span>
            </div>

            <div className="status-history-empty-box">
              <div className="empty-title">No data yet</div>
              <div className="empty-desc">
                No history records supplied. Values and allowed transitions: Confirm with backend.
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline update-status-btn"
              onClick={() => setShowStatusModal(true)}
            >
              Update order status
            </button>
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="order-details-right-col">
          {/* Order totals Card */}
          <div className="card order-totals-card">
            <h3 className="section-card-title">Order totals</h3>

            <div className="totals-row">
              <span className="totals-label">Subtotal</span>
              <span className="totals-val">{formatCurrency(order.subtotal || 460)} · DEMO</span>
            </div>

            <div className="totals-row">
              <span className="totals-label">Discount amount</span>
              <span className="totals-val">₹0 · DEMO</span>
            </div>

            <div className="totals-row">
              <span className="totals-label">Tax amount</span>
              <span className="totals-val">₹0 · DEMO</span>
            </div>

            <div className="totals-divider" />

            <div className="totals-final-row">
              <span className="totals-final-label">Total amount</span>
              <span className="totals-final-val">{formatCurrency(order.totalAmount || 460)} · DEMO</span>
            </div>

            <div className="totals-tax-note">
              Zero tax is a sample value, not a tax policy.
            </div>
          </div>

          {/* Applied coupon Card */}
          <div className="card applied-coupon-card">
            <h3 className="section-card-title">Applied coupon</h3>

            <div className="coupon-field-group">
              <span className="coupon-label">Coupon snapshot</span>
              <span className="coupon-empty-val">No data yet</span>
            </div>

            <div className="coupon-field-group">
              <span className="coupon-label">Applied discount amount</span>
              <span className="coupon-val">₹0 · DEMO</span>
            </div>

            <div className="coupon-footer-note">
              No applied coupon record supplied.
            </div>
          </div>
        </div>
      </div>

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="modal-backdrop" onClick={() => setShowStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Update Order Status</h3>
            <p className="modal-desc">
              Change fulfillment status for {order.orderNumber}. Transitions must adhere to backend lifecycle constraints.
            </p>

            <div className="status-options-list">
              {(['pending', 'preparing', 'ready', 'completed', 'cancelled'] as const).map((st) => (
                <label key={st} className={`status-option-item ${orderStatus === st ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="orderStatus"
                    value={st}
                    checked={orderStatus === st}
                    onChange={() => setOrderStatus(st)}
                  />
                  <span className="status-option-label">
                    {st.charAt(0).toUpperCase() + st.slice(1)}
                  </span>
                </label>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => setShowStatusModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary-red"
                onClick={() => setShowStatusModal(false)}
              >
                Save status
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
