import React from 'react';
import type { Metadata } from 'next';
import FeedbackPageClient from './FeedbackPageClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Order Feedback & Loyalty Rewards | Restrauque',
  description: 'Share your dining feedback and earn loyalty rewards on your completed restaurant order.',
};

interface PageProps {
  params: Promise<{ orderId: string }>;
}

export default async function OrderFeedbackStandalonePage({ params }: PageProps) {
  const { orderId } = await params;

  return <FeedbackPageClient orderId={orderId} />;
}
