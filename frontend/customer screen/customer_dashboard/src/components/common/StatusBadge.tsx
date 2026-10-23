import React from 'react';
import { CheckCircle2, Clock, XCircle, Sparkles } from 'lucide-react';
import { OrderStatus, ReviewEligibilityState } from '../../services/types';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'completed':
      return (
        <span className="badge badge-success">
          <CheckCircle2 size={12} />
          <span>Completed</span>
        </span>
      );
    case 'preparing':
      return (
        <span className="badge badge-warning">
          <Clock size={12} />
          <span>Preparing</span>
        </span>
      );
    case 'ready':
      return (
        <span className="badge badge-brand">
          <Sparkles size={12} />
          <span>Ready</span>
        </span>
      );
    case 'cancelled':
      return (
        <span className="badge badge-danger">
          <XCircle size={12} />
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span className="badge badge-neutral">
          <span>{status}</span>
        </span>
      );
  }
};

interface ReviewStatusBadgeProps {
  status: ReviewEligibilityState;
  showPoints?: boolean;
}

export const ReviewStatusBadge: React.FC<ReviewStatusBadgeProps> = ({ status, showPoints = true }) => {
  switch (status) {
    case 'eligible':
      return (
        <span className="badge badge-brand" title="Eligible for review">
          <Sparkles size={11} />
          <span>Write Review {showPoints ? '(+50 pts)' : ''}</span>
        </span>
      );
    case 'submitted':
      return (
        <span className="badge badge-success" title="Review already submitted">
          <CheckCircle2 size={11} />
          <span>Review Submitted</span>
        </span>
      );
    case 'unavailable':
      return (
        <span className="badge badge-neutral" title="Order in progress">
          <Clock size={11} />
          <span>In Progress</span>
        </span>
      );
    default:
      return null;
  }
};
