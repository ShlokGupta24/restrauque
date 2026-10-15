export interface RatingDistributionItem {
  stars: number;
  count: number | null;
  percentage: number | null;
  formatted: string;
}

export interface TopicAspectItem {
  id: string;
  topic: string;
  returnedAggregate: string;
  period: string;
  reviewCount: number;
}

export interface OrderLinkedFeedbackItem {
  id: string;
  orderId: string;
  rating: number;
  comment: string;
  submittedAt: string;
  status: 'reviewed' | 'pending' | 'resolved';
  customerName: string;
}

export interface FeedbackDataset {
  averageRating: string;
  feedbackCount: string;
  periodCoverage: string;
  distribution: RatingDistributionItem[];
  topics: TopicAspectItem[];
  orderFeedback: OrderLinkedFeedbackItem[];
  hasLiveRecords: boolean;
}

export interface FeedbackSchemaSpec {
  table: string;
  status: 'Schema defined' | 'Integration required';
  columns: string[];
  notes: string;
}

export const FEEDBACK_SCHEMA_SPECS: FeedbackSchemaSpec[] = [
  {
    table: 'feedback',
    status: 'Schema defined',
    columns: [
      'id (uuid, pk)',
      'restaurant_id (uuid, fk)',
      'branch_id (uuid, fk)',
      'order_id (uuid, fk -> orders)',
      'customer_id (uuid, fk -> customers)',
      'rating (integer 1-5)',
      'comment (text)',
      'sentiment_score (numeric -1.0 to 1.0)',
      'status (enum: pending, reviewed, resolved)',
      'created_at (timestamptz)',
    ],
    notes: 'Core customer satisfaction record collected via QR customer checkout or dining web app.',
  },
  {
    table: 'feedback_topics',
    status: 'Schema defined',
    columns: [
      'id (uuid, pk)',
      'restaurant_id (uuid, fk)',
      'name (varchar: Food Quality, Speed, Hospitality, Cleanliness)',
      'description (text)',
      'is_active (boolean)',
    ],
    notes: 'Aggregated topic classification for automated sentiment breakdown.',
  },
  {
    table: 'feedback_aspects',
    status: 'Schema defined',
    columns: [
      'id (uuid, pk)',
      'feedback_id (uuid, fk -> feedback)',
      'topic_id (uuid, fk -> feedback_topics)',
      'aspect_sentiment (enum: positive, neutral, negative)',
      'aspect_snippet (text)',
      'created_at (timestamptz)',
    ],
    notes: 'Granular extracted aspect phrases supporting NLP sentiment scoring without hallucinating user opinions.',
  },
];

// Empty / Schema Reference dataset strictly matching reference-images/feedback.png
export const EMPTY_FEEDBACK_DATASET: FeedbackDataset = {
  averageRating: 'Not available',
  feedbackCount: 'Not available',
  periodCoverage: 'Not available',
  distribution: [
    { stars: 5, count: null, percentage: null, formatted: 'Not available' },
    { stars: 4, count: null, percentage: null, formatted: 'Not available' },
    { stars: 3, count: null, percentage: null, formatted: 'Not available' },
    { stars: 2, count: null, percentage: null, formatted: 'Not available' },
    { stars: 1, count: null, percentage: null, formatted: 'Not available' },
  ],
  topics: [],
  orderFeedback: [],
  hasLiveRecords: false,
};

// Populated Demo dataset for interactive exploration
export const DEMO_POPULATED_FEEDBACK_DATASET: FeedbackDataset = {
  averageRating: '4.6 / 5.0',
  feedbackCount: '128 reviews',
  periodCoverage: '01–07 Oct 2026',
  distribution: [
    { stars: 5, count: 88, percentage: 69, formatted: '88 reviews (69%)' },
    { stars: 4, count: 26, percentage: 20, formatted: '26 reviews (20%)' },
    { stars: 3, count: 8, percentage: 6, formatted: '8 reviews (6%)' },
    { stars: 2, count: 4, percentage: 3, formatted: '4 reviews (3%)' },
    { stars: 1, count: 2, percentage: 2, formatted: '2 reviews (2%)' },
  ],
  topics: [
    {
      id: 'top-1',
      topic: 'Food Taste & Freshness',
      returnedAggregate: '4.8 ★ positive (94%)',
      period: '01–07 Oct 2026',
      reviewCount: 92,
    },
    {
      id: 'top-2',
      topic: 'QR Table Ordering & Pay',
      returnedAggregate: '4.9 ★ positive (98%)',
      period: '01–07 Oct 2026',
      reviewCount: 84,
    },
    {
      id: 'top-3',
      topic: 'Staff Hospitality',
      returnedAggregate: '4.5 ★ positive (89%)',
      period: '01–07 Oct 2026',
      reviewCount: 61,
    },
    {
      id: 'top-4',
      topic: 'Delivery / Kitchen Speed',
      returnedAggregate: '3.9 ★ mixed (72%)',
      period: '01–07 Oct 2026',
      reviewCount: 48,
    },
  ],
  orderFeedback: [
    {
      id: 'fb-101',
      orderId: 'RB-1082',
      rating: 5,
      comment: 'Paneer Tikka Wrap was incredible and served piping hot at Table 3! Quick QR payment.',
      submittedAt: '07 Oct 2026, 08:45 PM',
      status: 'reviewed',
      customerName: 'Riya Sharma',
    },
    {
      id: 'fb-102',
      orderId: 'RB-1081',
      rating: 4,
      comment: 'Great dinner ambience in Hazratganj branch. Butter Chicken tasted rich and authentic.',
      submittedAt: '07 Oct 2026, 08:40 PM',
      status: 'reviewed',
      customerName: 'Kabir Verma',
    },
    {
      id: 'fb-103',
      orderId: 'RB-1079',
      rating: 5,
      comment: 'Masala Dosa was crispy and chutney was fresh. Loved the seamless digital ordering.',
      submittedAt: '06 Oct 2026, 08:32 PM',
      status: 'resolved',
      customerName: 'Dev Mehta',
    },
  ],
  hasLiveRecords: true,
};
