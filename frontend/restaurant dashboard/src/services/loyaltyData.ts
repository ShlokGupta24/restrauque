export interface LoyaltyTier {
  id: string;
  name: string;
  minStars: number;
  multiplier: string;
  perks: string;
}

export interface LoyaltyAccount {
  id: string;
  customerName: string;
  phone: string;
  starsBalance: number;
  lifetimeEarned: number;
  lifetimeRedeemed: number;
  tier: string;
  status: 'Active' | 'Inactive';
}

export interface LoyaltyProgramConfig {
  isConfigured: boolean;
  programName: string;
  tagline: string;
  earningMode: string;
  isActive: boolean;
  starsPerSpend: number; // e.g. 5 stars per ₹100
  starsPerVisit: number; // e.g. 10 stars
  starsPerReview: number; // e.g. 25 stars
  minOrderAmount: number; // e.g. 200
  redemptionRate: string; // e.g. "100 stars = ₹50 discount"
  expiryWindow: string; // e.g. "12 Months"
  tiers: LoyaltyTier[];
  sampleAccounts: LoyaltyAccount[];
}

export const DEFAULT_SAMPLE_ACCOUNTS: LoyaltyAccount[] = [
  {
    id: 'acc-1',
    customerName: 'Aarav Kapoor',
    phone: '+91 98765 43210',
    starsBalance: 420,
    lifetimeEarned: 620,
    lifetimeRedeemed: 200,
    tier: 'Gold VIP',
    status: 'Active',
  },
  {
    id: 'acc-2',
    customerName: 'Priya Sharma',
    phone: '+91 98112 34567',
    starsBalance: 180,
    lifetimeEarned: 180,
    lifetimeRedeemed: 0,
    tier: 'Bronze',
    status: 'Active',
  },
  {
    id: 'acc-3',
    customerName: 'Rohan Verma',
    phone: '+91 99234 56789',
    starsBalance: 310,
    lifetimeEarned: 410,
    lifetimeRedeemed: 100,
    tier: 'Silver',
    status: 'Active',
  },
  {
    id: 'acc-4',
    customerName: 'Neha Gupta',
    phone: '+91 97654 32198',
    starsBalance: 560,
    lifetimeEarned: 860,
    lifetimeRedeemed: 300,
    tier: 'Gold VIP',
    status: 'Active',
  },
  {
    id: 'acc-5',
    customerName: 'Kabir Mehta',
    phone: '+91 98451 23678',
    starsBalance: 95,
    lifetimeEarned: 95,
    lifetimeRedeemed: 0,
    tier: 'Bronze',
    status: 'Active',
  },
];

export const DEFAULT_LOYALTY_PROGRAM: LoyaltyProgramConfig = {
  isConfigured: true,
  programName: 'Basil & Brick VIP Club',
  tagline: 'Earn stars on every dining experience and unlock seasonal rewards.',
  earningMode: 'Hybrid (Spend + Visit)',
  isActive: true,
  starsPerSpend: 5,
  starsPerVisit: 10,
  starsPerReview: 25,
  minOrderAmount: 200,
  redemptionRate: '100 stars = ₹50 discount',
  expiryWindow: '12 Months',
  tiers: [
    {
      id: 'tier-bronze',
      name: 'Bronze Tier',
      minStars: 0,
      multiplier: '1.0x',
      perks: 'Complimentary welcome drink on dine-in',
    },
    {
      id: 'tier-silver',
      name: 'Silver Tier',
      minStars: 250,
      multiplier: '1.25x',
      perks: 'Free dessert on birthday month, priority seating',
    },
    {
      id: 'tier-gold',
      name: 'Gold VIP',
      minStars: 500,
      multiplier: '1.5x',
      perks: '15% off dine-in bills, chef tasting invitation',
    },
  ],
  sampleAccounts: DEFAULT_SAMPLE_ACCOUNTS,
};

let loyaltyProgramMemoryStore: LoyaltyProgramConfig = {
  ...DEFAULT_LOYALTY_PROGRAM,
};

/**
 * In-memory client preview store.
 * NOTE: Loyalty API endpoints are not yet deployed in the backend.
 * These helpers support UI demonstration and do NOT persist to database.
 */
export function getLoyaltyProgram(): LoyaltyProgramConfig {
  return { ...loyaltyProgramMemoryStore };
}

export function saveLoyaltyProgram(config: Partial<LoyaltyProgramConfig>): LoyaltyProgramConfig {
  loyaltyProgramMemoryStore = {
    ...loyaltyProgramMemoryStore,
    ...config,
    isConfigured: true,
  };
  return { ...loyaltyProgramMemoryStore };
}

export function toggleLoyaltyProgramActive(): boolean {
  loyaltyProgramMemoryStore.isActive = !loyaltyProgramMemoryStore.isActive;
  return loyaltyProgramMemoryStore.isActive;
}
