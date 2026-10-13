export interface AiInsightEvidence {
  source_type: string;
  evidence_role: string;
  metric_name: string;
  metric_value: string;
  evidence_text: string;
}

export interface ProposedAction {
  action_type: string;
  title: string;
  description: string;
  requires_owner_approval: boolean;
  status: 'proposed' | 'approved' | 'rejected' | 'executed';
}

export interface AiInsightRecord {
  id: string;
  insight_type: 'revenue_opportunity' | 'operational_anomaly' | 'menu_optimization' | 'retention_risk';
  type_label: string;
  title: string;
  summary: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'active' | 'dismissed' | 'resolved' | 'pending_approval';
  confidence: number;
  metric_name: string;
  metric_value: string;
  previous_metric_value: string;
  change_percentage: string;
  detected_at: string;
  valid_until: string;
  evidence: AiInsightEvidence[];
  proposed_action?: ProposedAction;
}

export interface SchemaRequirementSpec {
  table: string;
  status: 'Schema defined' | 'Integration required' | 'Outside schema boundary';
  columns: string[];
  notes: string;
}

export const SCHEMA_REQUIREMENTS: SchemaRequirementSpec[] = [
  {
    table: 'ai_insights',
    status: 'Schema defined',
    columns: [
      'id (uuid, pk)',
      'restaurant_id (uuid, fk)',
      'branch_id (uuid, fk)',
      'insight_type (varchar)',
      'title (text)',
      'summary (text)',
      'severity (enum: low/medium/high/critical)',
      'status (enum: active/dismissed/resolved)',
      'confidence (numeric 0.00-1.00)',
      'metric_name (varchar)',
      'metric_value (text)',
      'previous_metric_value (text)',
      'change_percentage (numeric)',
      'detected_at (timestamptz)',
      'valid_until (timestamptz)',
    ],
    notes: 'Primary intelligence model output. Must remain traceable with linked evidence rows.',
  },
  {
    table: 'ai_insight_evidence',
    status: 'Schema defined',
    columns: [
      'id (uuid, pk)',
      'insight_id (uuid, fk -> ai_insights)',
      'source_type (varchar: orders, daily_metrics, products)',
      'evidence_role (varchar: primary_indicator, historical_baseline)',
      'metric_name (varchar)',
      'metric_value (text)',
      'evidence_text (text)',
      'created_at (timestamptz)',
    ],
    notes: 'Audit trail for AI claims. Guarantees no hallucinated metrics without real order or sales records.',
  },
  {
    table: 'ai_agent_runs & actions',
    status: 'Integration required',
    columns: [
      'agent_run_id (uuid)',
      'agent_type (varchar)',
      'action_name (varchar)',
      'proposed_payload (jsonb)',
      'approval_status (pending_owner, approved, rejected)',
      'approved_by_user_id (uuid, fk -> users)',
      'executed_at (timestamptz)',
    ],
    notes: 'Autonomous agent capability. Marketing coupons, price changes, and refunds strictly require explicit owner approval.',
  },
  {
    table: 'inventory & stock ledgers',
    status: 'Outside schema boundary',
    columns: ['N/A - Table absent from current Neon schema'],
    notes: 'On-hand stock, stock ledgers, and supplier lead times were not found in schema. Restock forecasts cannot be presented as stored facts.',
  },
];

export const SAMPLE_SIMULATED_INSIGHTS: AiInsightRecord[] = [
  {
    id: 'INS-401',
    insight_type: 'revenue_opportunity',
    type_label: 'Revenue Opportunity',
    title: 'Friday Biryani demand surge in Hazratganj',
    summary: 'Awadhi Dum Biryani orders peaked 38.5% higher than 4-week historical average between 7:30 PM - 10:00 PM on Fridays.',
    severity: 'high',
    status: 'active',
    confidence: 94,
    metric_name: 'Biryani Order Volume',
    metric_value: '184 units / evening',
    previous_metric_value: '133 units / evening',
    change_percentage: '+38.5%',
    detected_at: '10 Oct 2026, 11:30 PM',
    valid_until: '17 Oct 2026, 11:59 PM',
    evidence: [
      {
        source_type: 'orders',
        evidence_role: 'primary_indicator',
        metric_name: 'Friday Dinner Volume',
        metric_value: '184 orders',
        evidence_text: 'Aggregated from 1,058 completed orders across Hazratganj branch.',
      },
      {
        source_type: 'analytics_product_metrics',
        evidence_role: 'historical_baseline',
        metric_name: '4-Week Friday Mean',
        metric_value: '133 units',
        evidence_text: 'Rolling 28-day baseline for Awadhi Dum Biryani.',
      },
    ],
    proposed_action: {
      action_type: 'menu_combo',
      title: 'Highlight Biryani + Raita combo on QR menu top banner',
      description: 'Pin Awadhi Dum Biryani at top of Dine-in QR menu for dinner hours to capture peak appetite.',
      requires_owner_approval: true,
      status: 'proposed',
    },
  },
  {
    id: 'INS-402',
    insight_type: 'operational_anomaly',
    type_label: 'Operational Anomaly',
    title: 'Table 4 QR scan-to-order drop during lunch rush',
    summary: 'Table 4 has 42 QR scans but only 6 completed orders over the past 3 days, indicating a physical QR readability or network blindspot issue.',
    severity: 'medium',
    status: 'active',
    confidence: 88,
    metric_name: 'QR Conversion Rate',
    metric_value: '14.3%',
    previous_metric_value: '84.0%',
    change_percentage: '-69.7%',
    detected_at: '11 Oct 2026, 03:15 PM',
    valid_until: '14 Oct 2026, 11:59 PM',
    evidence: [
      {
        source_type: 'restaurant_tables & qr_codes',
        evidence_role: 'primary_indicator',
        metric_name: 'Scan Count vs Orders',
        metric_value: '42 scans : 6 orders',
        evidence_text: 'Table 4 (Indoor Main Dining, Capacity 4) scan ledger anomaly.',
      },
    ],
    proposed_action: {
      action_type: 'hardware_check',
      title: 'Reprint QR card or verify Wi-Fi signal at Table 4',
      description: 'Inspect acrylic stand at Table 4 to confirm QR code is unscratched and floor Wi-Fi is reachable.',
      requires_owner_approval: false,
      status: 'proposed',
    },
  },
  {
    id: 'INS-403',
    insight_type: 'menu_optimization',
    type_label: 'Menu Optimization',
    title: 'Paneer Tikka Wrap high cart attachment but zero bundle discount',
    summary: 'Customers frequently pair Paneer Tikka Wrap with Masala Chaas, but 28% drop off before checkout due to individual item pricing.',
    severity: 'low',
    status: 'active',
    confidence: 85,
    metric_name: 'Combo Pair Frequency',
    metric_value: '312 co-occurrences',
    previous_metric_value: '220 co-occurrences',
    change_percentage: '+41.8%',
    detected_at: '09 Oct 2026, 06:45 PM',
    valid_until: '20 Oct 2026, 11:59 PM',
    evidence: [
      {
        source_type: 'order_items',
        evidence_role: 'cross_correlation',
        metric_name: 'Basket Co-occurrence',
        metric_value: '29.5% of wrap orders',
        evidence_text: 'Analyzed from recent Hazratganj itemized orders.',
      },
    ],
    proposed_action: {
      action_type: 'create_coupon',
      title: 'Launch "WRAPCHAA" bundle discount coupon',
      description: 'Offer ₹30 discount when Paneer Tikka Wrap and Masala Chaas are ordered together.',
      requires_owner_approval: true,
      status: 'proposed',
    },
  },
];
