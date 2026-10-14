import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Clock,
  CreditCard,
  Check,
} from 'lucide-react';
import { useRestaurant } from '../../context/RestaurantContext';
import {
  orderService,
  OwnerOrderDetail,
  BackendOrderStatus,
  ALLOWED_STATUS_TRANSITIONS,
} from '../../services/orderService';
import {
  paymentService,
  SafePaymentRecord,
  PaymentMethod,
} from '../../services/paymentService';
import { ApiClientError } from '../../services/apiClient';
import './OrderDetailsPage.css';

export const OrderDetailsPage: React.FC = () => {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const { formatCurrency } = useRestaurant();

  const [order, setOrder] = useState<OwnerOrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isNotFound, setIsNotFound] = useState<boolean>(false);

  // Status transition modal state
  const [showStatusModal, setShowStatusModal] = useState<boolean>(false);
  const [selectedTargetStatus, setSelectedTargetStatus] = useState<BackendOrderStatus | null>(null);
  const [statusNotes, setStatusNotes] = useState<string>('');
  const [isSubmittingStatus, setIsSubmittingStatus] = useState<boolean>(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Payment history & recording state
  const [paymentsList, setPaymentsList] = useState<SafePaymentRecord[]>([]);
  const [isLoadingPayments, setIsLoadingPayments] = useState<boolean>(false);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  const [showRecordPaymentModal, setShowRecordPaymentModal] = useState<boolean>(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>('cash');
  const [transactionReference, setTransactionReference] = useState<string>('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState<boolean>(false);
  const [recordPaymentError, setRecordPaymentError] = useState<string | null>(null);

  const [successToast, setSuccessToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  // Fetch payment records for order
  const fetchPaymentHistory = useCallback(async (oid: string) => {
    setIsLoadingPayments(true);
    setPaymentsError(null);
    try {
      const res = await paymentService.getOrderPayments(oid);
      setPaymentsList(res.payments);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to retrieve payment history';
      setPaymentsError(msg);
      setPaymentsList([]);
    } finally {
      setIsLoadingPayments(false);
    }
  }, []);

  // Fetch authoritative order detail from backend
  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) {
      setError('Order identifier is missing');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    setIsNotFound(false);

    try {
      const data = await orderService.getOrderDetail(orderId);
      setOrder(data);
      // Simultaneously load full payment history
      fetchPaymentHistory(data.id);
    } catch (err: unknown) {
      if (err instanceof ApiClientError && err.statusCode === 404) {
        setIsNotFound(true);
        setError('Order not found or not authorized under your restaurant.');
      } else if (err instanceof ApiClientError && err.statusCode === 403) {
        setError('Access forbidden: Order belongs to another restaurant or requires owner authorization.');
      } else {
        const msg = err instanceof Error ? err.message : 'Failed to retrieve order details';
        setError(msg);
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId, fetchPaymentHistory]);

  useEffect(() => {
    fetchOrderDetail();
  }, [fetchOrderDetail]);

  // Open status modal
  const handleOpenStatusModal = () => {
    if (!order) return;
    const allowed = ALLOWED_STATUS_TRANSITIONS[order.status] || [];
    setSelectedTargetStatus(allowed.length > 0 ? allowed[0] : null);
    setStatusNotes('');
    setStatusError(null);
    setShowStatusModal(true);
  };

  // Submit status transition
  const handleStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || !selectedTargetStatus || isSubmittingStatus) return;

    setIsSubmittingStatus(true);
    setStatusError(null);

    try {
      await orderService.updateOrderStatus(order.id, {
        status: selectedTargetStatus,
        expectedCurrentStatus: order.status,
        notes: statusNotes.trim() || undefined,
      });

      showToast(`Order status updated to "${selectedTargetStatus.toUpperCase()}"!`);
      setShowStatusModal(false);
      await fetchOrderDetail();
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setStatusError(`Conflict: ${err.message}. Refreshing authoritative order state.`);
          await fetchOrderDetail();
        } else {
          setStatusError(err.message);
        }
      } else if (err instanceof Error) {
        setStatusError(err.message);
      } else {
        setStatusError('Failed to transition order status');
      }
    } finally {
      setIsSubmittingStatus(false);
    }
  };

  // Open record payment modal
  const handleOpenRecordPaymentModal = () => {
    if (!order) return;
    setSelectedPaymentMethod('cash');
    setTransactionReference('');
    setRecordPaymentError(null);
    setShowRecordPaymentModal(true);
  };

  // Submit payment record
  const handleRecordPaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!order || isSubmittingPayment) return;

    if (order.status === 'cancelled') {
      setRecordPaymentError('Cannot record payment for a cancelled order.');
      return;
    }

    setIsSubmittingPayment(true);
    setRecordPaymentError(null);

    try {
      const res = await paymentService.recordOrderPayment(order.id, {
        paymentMethod: selectedPaymentMethod,
        amount: order.pricing.totalAmount,
        transactionReference: transactionReference.trim() || undefined,
      });

      if (res.isReplay) {
        showToast('Idempotent replay: Existing payment record confirmed!');
      } else {
        showToast(
          `Payment of ${formatCurrency(res.payment.amount)} recorded successfully as "${res.payment.paymentMethod.toUpperCase()}"!`
        );
      }

      setShowRecordPaymentModal(false);
      await Promise.all([fetchOrderDetail(), fetchPaymentHistory(order.id)]);
    } catch (err: unknown) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setRecordPaymentError(`Conflict: ${err.message}`);
          // Refresh state on conflict
          fetchOrderDetail();
          fetchPaymentHistory(order.id);
        } else {
          setRecordPaymentError(err.message);
        }
      } else if (err instanceof Error) {
        setRecordPaymentError(err.message);
      } else {
        setRecordPaymentError('Failed to record payment');
      }
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  if (isLoading) {
    return (
      <div className="order-details-container" style={{ padding: '60px 20px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
          <RefreshCw size={18} className="animate-spin" />
          <span>Loading authoritative order details from backend...</span>
        </div>
      </div>
    );
  }

  if (isNotFound || !order) {
    return (
      <div className="order-details-container">
        <div className="order-details-top-nav">
          <button
            type="button"
            className="back-to-orders-btn"
            onClick={() => navigate('/dashboard/orders')}
          >
            <ArrowLeft size={14} />
            <span>Back to orders</span>
          </button>
        </div>
        <div
          className="card"
          style={{
            padding: '48px 24px',
            textAlign: 'center',
            backgroundColor: '#ffffff',
            borderRadius: '12px',
            margin: '20px 0',
          }}
        >
          <AlertCircle size={36} color="#d32f2f" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>
            {isNotFound ? 'Order Not Found' : 'Failed to Load Order'}
          </h3>
          <p style={{ fontSize: '13px', color: '#6b7280', maxWidth: '440px', margin: '0 auto 20px' }}>
            {error || 'The requested order does not exist or you do not have permission to access it.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={fetchOrderDetail}
            >
              Retry loading
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ background: '#e53935', color: '#ffffff', border: 'none', padding: '8px 16px', borderRadius: '6px' }}
              onClick={() => navigate('/dashboard/orders')}
            >
              Back to orders list
            </button>
          </div>
        </div>
      </div>
    );
  }

  const allowedTransitions = ALLOWED_STATUS_TRANSITIONS[order.status] || [];
  const isTerminalStatus = allowedTransitions.length === 0;
  const isOrderPaid = order.payment.status === 'paid';
  const isOrderCancelled = order.status === 'cancelled';

  const orderedDateObj = new Date(order.orderedAt);
  const orderedDateStr = isNaN(orderedDateObj.getTime())
    ? order.orderedAt
    : orderedDateObj.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

  const completedDateObj = order.completedAt ? new Date(order.completedAt) : null;
  const completedDateStr = completedDateObj && !isNaN(completedDateObj.getTime())
    ? completedDateObj.toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : 'Not completed yet';

  return (
    <div className="order-details-container">
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: '#059669',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 4px 14px rgba(5, 150, 105, 0.35)',
            zIndex: 200,
          }}
        >
          <CheckCircle size={16} />
          <span>{successToast}</span>
        </div>
      )}

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
          Order ID: {order.id} · Branch: {order.branch.name}
        </div>
      </div>

      {/* Main Title Row & Actions */}
      <div className="order-details-title-row">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h2 className="order-details-heading">{order.orderNumber}</h2>
          <span
            className="status-pill"
            style={{
              padding: '4px 12px',
              borderRadius: '9999px',
              fontSize: '12px',
              fontWeight: 700,
              textTransform: 'uppercase',
              backgroundColor:
                order.status === 'completed'
                  ? '#ecfdf5'
                  : order.status === 'cancelled'
                  ? '#fef2f2'
                  : order.status === 'served'
                  ? '#f3e8ff'
                  : order.status === 'preparing'
                  ? '#eff6ff'
                  : '#fef3c7',
              color:
                order.status === 'completed'
                  ? '#059669'
                  : order.status === 'cancelled'
                  ? '#dc2626'
                  : order.status === 'served'
                  ? '#7c3aed'
                  : order.status === 'preparing'
                  ? '#2563eb'
                  : '#d97706',
            }}
          >
            {order.status}
          </span>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-outline change-status-btn"
            onClick={handleOpenStatusModal}
            disabled={isTerminalStatus}
            title={isTerminalStatus ? `Terminal status "${order.status}" cannot be transitioned` : 'Change order status'}
            style={isTerminalStatus ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
          >
            {isTerminalStatus ? 'Terminal status' : 'Change status'}
          </button>
        </div>
      </div>

      {/* 2-Column Content Grid */}
      <div className="order-details-grid">
        {/* Left Column (2/3 width) */}
        <div className="order-details-left-col">
          {/* 1. Order context Card */}
          <div className="card order-context-card">
            <h3 className="section-card-title">Order Context</h3>

            <div className="order-context-grid">
              <div className="context-field">
                <span className="context-label">Order number</span>
                <span className="context-value bold-value">{order.orderNumber}</span>
              </div>

              <div className="context-field">
                <span className="context-label">Order type</span>
                <span className="context-value" style={{ textTransform: 'capitalize' }}>
                  {order.orderType.replace('_', ' ')}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Canonical status</span>
                <span className="context-value bold-value" style={{ textTransform: 'capitalize' }}>
                  {order.status}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Branch</span>
                <span className="context-value">{order.branch.name}</span>
              </div>

              <div className="context-field">
                <span className="context-label">Table</span>
                <span className="context-value">
                  {order.table ? `Table ${order.table.tableNumber} (Cap: ${order.table.capacity || 'N/A'})` : 'Takeaway / QR'}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Customer</span>
                <span className="context-value">
                  {order.customer ? `${order.customer.name} · ${order.customer.phone}` : 'Walk-in / Absent'}
                </span>
              </div>

              <div className="context-field">
                <span className="context-label">Ordered at</span>
                <span className="context-value">{orderedDateStr}</span>
              </div>

              <div className="context-field">
                <span className="context-label">Completed at</span>
                <span className="context-value">{completedDateStr}</span>
              </div>

              <div className="context-field">
                <span className="context-label">Order notes</span>
                <span className="context-value">{order.notes || 'None'}</span>
              </div>
            </div>
          </div>

          {/* 2. Order items Card */}
          <div className="card order-items-card">
            <div className="order-items-header">
              <h3 className="section-card-title">Historical Order Items</h3>
              <span className="snapshot-tag" style={{ color: '#059669', backgroundColor: '#ecfdf5', padding: '2px 8px', borderRadius: '4px' }}>
                Immutable Snapshot
              </span>
            </div>

            <table className="order-items-table">
              <thead>
                <tr>
                  <th>PRODUCT / VARIANT / ADD-ONS</th>
                  <th>QUANTITY</th>
                  <th>UNIT PRICE</th>
                  <th>TOTAL PRICE</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div className="item-name-cell">{item.productName}</div>
                      {item.variantName && (
                        <div className="item-variant-cell">Variant: {item.variantName}</div>
                      )}
                      {item.addons && item.addons.length > 0 && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#6b7280' }}>
                          {item.addons.map((a) => (
                            <div key={a.id}>
                              + {a.addonName} (x{a.quantity}) · {formatCurrency(a.totalPrice)}
                            </div>
                          ))}
                        </div>
                      )}
                      {item.specialInstructions && (
                        <div style={{ marginTop: '4px', fontSize: '11px', color: '#b45309', fontStyle: 'italic' }}>
                          Note: "{item.specialInstructions}"
                        </div>
                      )}
                    </td>
                    <td className="item-qty-cell">{item.quantity}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td className="item-total-cell">{formatCurrency(item.totalPrice)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="order-items-calc-box">
              <div className="calc-instruction-text">
                <span className="calc-label">Items snapshot integrity:</span>
                <span className="calc-val" style={{ fontStyle: 'normal', color: '#374151' }}>
                  {order.items.length} line items recorded at time of order creation.
                </span>
              </div>
            </div>
          </div>

          {/* 3. Status history Card */}
          <div className="card status-history-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 className="section-card-title" style={{ margin: 0 }}>Status History</h3>
              <button
                type="button"
                className="btn btn-outline update-status-btn"
                onClick={handleOpenStatusModal}
                disabled={isTerminalStatus}
                style={isTerminalStatus ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              >
                {isTerminalStatus ? 'Locked' : 'Update status'}
              </button>
            </div>

            <div className="status-history-table-header">
              <span>STATUS</span>
              <span>CHANGED AT</span>
              <span>AUDIT NOTES</span>
            </div>

            {order.statusHistory && order.statusHistory.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {order.statusHistory.map((hist) => {
                  const hDate = new Date(hist.changedAt);
                  const hDateStr = isNaN(hDate.getTime()) ? hist.changedAt : hDate.toLocaleString();
                  return (
                    <div
                      key={hist.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr',
                        padding: '10px 12px',
                        backgroundColor: '#fbfcfe',
                        border: '1px solid #f3f4f6',
                        borderRadius: '6px',
                        fontSize: '12px',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontWeight: 600, textTransform: 'uppercase', color: '#111827' }}>
                        {hist.status}
                      </span>
                      <span style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={12} />
                        {hDateStr}
                      </span>
                      <span style={{ color: '#4b5563', fontStyle: hist.notes ? 'normal' : 'italic' }}>
                        {hist.notes || 'Status updated'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="status-history-empty-box">
                <div className="empty-title">Initial Status Record</div>
                <div className="empty-desc">
                  Order was created with status "{order.status}".
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column (1/3 width) */}
        <div className="order-details-right-col">
          {/* Order totals Card */}
          <div className="card order-totals-card">
            <h3 className="section-card-title">Order Pricing</h3>

            <div className="totals-row">
              <span className="totals-label">Subtotal</span>
              <span className="totals-val">{formatCurrency(order.pricing.subtotal)}</span>
            </div>

            <div className="totals-row">
              <span className="totals-label">Discount amount</span>
              <span className="totals-val" style={{ color: order.pricing.discountAmount > 0 ? '#059669' : undefined }}>
                -{formatCurrency(order.pricing.discountAmount)}
              </span>
            </div>

            <div className="totals-row">
              <span className="totals-label">Tax amount</span>
              <span className="totals-val">{formatCurrency(order.pricing.taxAmount)}</span>
            </div>

            <div className="totals-divider" />

            <div className="totals-final-row">
              <span className="totals-final-label">Total amount</span>
              <span className="totals-final-val">{formatCurrency(order.pricing.totalAmount)}</span>
            </div>

            <div className="totals-tax-note">
              Values calculated by authoritative backend billing rules.
            </div>
          </div>

          {/* Applied coupon Card */}
          <div className="card applied-coupon-card">
            <h3 className="section-card-title">Applied Coupon</h3>

            {order.appliedCoupon ? (
              <>
                <div className="coupon-field-group">
                  <span className="coupon-label">Coupon Code</span>
                  <span className="coupon-val" style={{ color: '#059669', letterSpacing: '0.05em' }}>
                    {order.appliedCoupon.couponCode}
                  </span>
                </div>

                <div className="coupon-field-group">
                  <span className="coupon-label">Discount Benefit</span>
                  <span className="coupon-val">
                    {order.appliedCoupon.discountType === 'percentage'
                      ? `${order.appliedCoupon.discountValue}% off`
                      : `₹${order.appliedCoupon.discountValue} flat`}
                  </span>
                </div>

                <div className="coupon-field-group">
                  <span className="coupon-label">Total Discount Amount</span>
                  <span className="coupon-val" style={{ color: '#059669' }}>
                    {formatCurrency(order.appliedCoupon.discountAmount)}
                  </span>
                </div>
              </>
            ) : (
              <div className="coupon-footer-note" style={{ color: '#6b7280', fontStyle: 'italic', padding: '8px 0' }}>
                No promotional coupon applied to this order.
              </div>
            )}
          </div>

          {/* Payment Status & Records Card */}
          <div className="card" style={{ padding: '20px' }}>
            <div className="payment-card-header">
              <h3 className="section-card-title" style={{ margin: 0 }}>Payment Settlement</h3>
              <button
                type="button"
                className="record-payment-btn"
                onClick={handleOpenRecordPaymentModal}
                disabled={isOrderPaid || isOrderCancelled}
                title={
                  isOrderCancelled
                    ? 'Cannot record payment for a cancelled order'
                    : isOrderPaid
                    ? 'Order is already settled'
                    : 'Record POS payment'
                }
              >
                <CreditCard size={13} />
                <span>{isOrderPaid ? 'Settled' : 'Record payment'}</span>
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#6b7280' }}>Authoritative Status</span>
                <span
                  style={{
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '4px',
                    backgroundColor:
                      order.payment.status === 'paid'
                        ? '#ecfdf5'
                        : order.payment.status === 'pending'
                        ? '#fef3c7'
                        : '#f3f4f6',
                    color:
                      order.payment.status === 'paid'
                        ? '#059669'
                        : order.payment.status === 'pending'
                        ? '#d97706'
                        : '#6b7280',
                    textTransform: 'capitalize',
                  }}
                >
                  {order.payment.status.replace('_', ' ')}
                </span>
              </div>

              {order.payment.paymentMethod && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Primary Method</span>
                  <span style={{ fontWeight: 600, color: '#111827', textTransform: 'capitalize' }}>
                    {order.payment.paymentMethod}
                  </span>
                </div>
              )}

              {order.payment.transactionReference && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Reference</span>
                  <span style={{ fontWeight: 600, color: '#111827' }}>
                    {order.payment.transactionReference}
                  </span>
                </div>
              )}

              {order.payment.paidAt && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#6b7280' }}>Settled at</span>
                  <span style={{ color: '#374151' }}>
                    {new Date(order.payment.paidAt).toLocaleString()}
                  </span>
                </div>
              )}

              {order.payment.status === 'not_recorded' && (
                <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', marginTop: '2px' }}>
                  No payment record has been settled for this order yet.
                </div>
              )}
            </div>

            {/* Detailed Payment History Section */}
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f3f4f6' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase' }}>
                  Payment Records ({paymentsList.length})
                </span>
                <button
                  type="button"
                  onClick={() => fetchPaymentHistory(order.id)}
                  title="Refresh payment records"
                  style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: '2px' }}
                >
                  <RefreshCw size={12} className={isLoadingPayments ? 'animate-spin' : ''} />
                </button>
              </div>

              {isLoadingPayments && paymentsList.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                  Loading payments...
                </div>
              ) : paymentsError ? (
                <div style={{ fontSize: '11px', color: '#dc2626', padding: '8px 0' }}>
                  {paymentsError}
                </div>
              ) : paymentsList.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', padding: '8px 0' }}>
                  No historical payment records found.
                </div>
              ) : (
                <div className="payment-history-list">
                  {paymentsList.map((p) => {
                    const pDate = p.paidAt ? new Date(p.paidAt) : new Date(p.createdAt);
                    const pDateStr = isNaN(pDate.getTime()) ? '' : pDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={p.id} className="payment-history-item">
                        <div className="payment-history-item-top">
                          <span className="payment-method-tag">{p.paymentMethod}</span>
                          <span className={`payment-status-badge ${p.status}`}>{p.status}</span>
                        </div>
                        <div className="payment-history-item-bottom">
                          <span className="payment-amount-text">{formatCurrency(p.amount)}</span>
                          <span>{pDateStr}</span>
                        </div>
                        {p.transactionReference && (
                          <div style={{ fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' }}>
                            Ref: {p.transactionReference}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Change Status Modal */}
      {showStatusModal && (
        <div className="modal-backdrop" onClick={() => !isSubmittingStatus && setShowStatusModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Update Order Status</h3>
            <p className="modal-desc">
              Transition order <strong>{order.orderNumber}</strong> from current status{' '}
              <strong style={{ textTransform: 'uppercase' }}>"{order.status}"</strong>. Only backend-authorized transitions are permitted.
            </p>

            {statusError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(229, 57, 53, 0.1)',
                  border: '1px solid rgba(229, 57, 53, 0.3)',
                  borderRadius: '6px',
                  color: '#d32f2f',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{statusError}</span>
              </div>
            )}

            <form onSubmit={handleStatusSubmit}>
              <div className="status-options-list">
                {allowedTransitions.map((target) => (
                  <label
                    key={target}
                    className={`status-option-item ${selectedTargetStatus === target ? 'selected' : ''}`}
                    style={{ cursor: 'pointer' }}
                  >
                    <input
                      type="radio"
                      name="orderStatus"
                      value={target}
                      checked={selectedTargetStatus === target}
                      onChange={() => setSelectedTargetStatus(target)}
                      disabled={isSubmittingStatus}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span className="status-option-label" style={{ textTransform: 'capitalize' }}>
                        {target}
                      </span>
                      <span style={{ fontSize: '11px', color: '#6b7280' }}>
                        {target === 'preparing' && 'Kitchen is preparing the dishes'}
                        {target === 'served' && 'Dishes served to the table/customer'}
                        {target === 'completed' && 'Order successfully completed'}
                        {target === 'cancelled' && 'Cancel order and record reason'}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Status Audit Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Prepared and served by table server"
                  value={statusNotes}
                  onChange={(e) => setStatusNotes(e.target.value)}
                  disabled={isSubmittingStatus}
                  maxLength={200}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowStatusModal(false)}
                  disabled={isSubmittingStatus}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary-red"
                  disabled={isSubmittingStatus || !selectedTargetStatus}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isSubmittingStatus && <RefreshCw size={13} className="animate-spin" />}
                  <span>{isSubmittingStatus ? 'Updating...' : 'Save status'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Record Payment Modal */}
      {showRecordPaymentModal && (
        <div
          className="modal-backdrop"
          onClick={() => !isSubmittingPayment && setShowRecordPaymentModal(false)}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Record POS Payment</h3>
            <p className="modal-desc">
              Record staff-verified payment settlement for <strong>{order.orderNumber}</strong>. Amount must match the authoritative total.
            </p>

            {recordPaymentError && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  backgroundColor: 'rgba(229, 57, 53, 0.1)',
                  border: '1px solid rgba(229, 57, 53, 0.3)',
                  borderRadius: '6px',
                  color: '#d32f2f',
                  fontSize: '12px',
                  marginBottom: '16px',
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{recordPaymentError}</span>
              </div>
            )}

            <form onSubmit={handleRecordPaymentSubmit}>
              {/* Payment Amount Display */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Settlement Amount
                </label>
                <div
                  style={{
                    padding: '10px 14px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #d1d5db',
                    borderRadius: '6px',
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#111827',
                  }}
                >
                  {formatCurrency(order.pricing.totalAmount)}
                </div>
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Authoritative total amount required by backend contract.
                </span>
              </div>

              {/* Payment Method Choice Grid */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>
                  Payment Tender Method
                </label>
                <div className="method-choice-grid">
                  {(['cash', 'upi', 'card', 'other'] as const).map((m) => (
                    <div
                      key={m}
                      className={`method-choice-tile ${selectedPaymentMethod === m ? 'selected' : ''}`}
                      onClick={() => !isSubmittingPayment && setSelectedPaymentMethod(m)}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={m}
                        checked={selectedPaymentMethod === m}
                        onChange={() => setSelectedPaymentMethod(m)}
                        disabled={isSubmittingPayment}
                        style={{ cursor: 'pointer' }}
                      />
                      <span>{m}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Transaction Reference Input */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Transaction Reference (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. UPI Ref / Card Txn ID (enables idempotent replay)"
                  value={transactionReference}
                  onChange={(e) => setTransactionReference(e.target.value)}
                  disabled={isSubmittingPayment}
                  maxLength={150}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d1d5db',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px', display: 'block' }}>
                  Recommended for UPI or Card settlements. Allows verified idempotent replays.
                </span>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() => setShowRecordPaymentModal(false)}
                  disabled={isSubmittingPayment}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="record-payment-btn"
                  disabled={isSubmittingPayment}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                >
                  {isSubmittingPayment ? (
                    <>
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Recording...</span>
                    </>
                  ) : (
                    <>
                      <Check size={14} />
                      <span>Confirm & Record</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
