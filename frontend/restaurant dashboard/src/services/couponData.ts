import { Coupon } from '../types/domain';

export interface CouponItem extends Coupon {
  discountLabel: string;
  validityRangeLabel: string;
  minOrderLabel?: string;
  maxDiscountLabel?: string;
}

export const INITIAL_COUPONS: CouponItem[] = [
  {
    id: 'c-welcome10',
    code: 'WELCOME10',
    name: 'Welcome offer',
    description: 'Welcome offer description - DEMO',
    discountType: 'percentage',
    discountValue: 10,
    discountLabel: '10% off',
    usageLimit: 300,
    usageCount: 128,
    validFrom: '01 Oct 2026 - 12:00 AM',
    validUntil: '31 Oct 2026 - 11:59 PM',
    validityRangeLabel: '01 Oct 2026 - 31 Oct 2026',
    isActive: true,
    minOrderLabel: 'Not available',
    maxDiscountLabel: 'Not available',
  },
  {
    id: 'c-comeback15',
    code: 'COMEBACK15',
    name: 'Come back for more',
    description: 'Special return reward for loyal diners returning within the month - DEMO',
    discountType: 'percentage',
    discountValue: 15,
    discountLabel: '15% off',
    usageLimit: 150,
    usageCount: 84,
    validFrom: '15 Oct 2026 - 12:00 AM',
    validUntil: '20 Oct 2026 - 11:59 PM',
    validityRangeLabel: '15 Oct 2026 - 20 Oct 2026',
    isActive: true,
    minOrderLabel: 'Not available',
    maxDiscountLabel: 'Not available',
  },
  {
    id: 'c-lunch80',
    code: 'LUNCH80',
    name: 'Lunch hour offer',
    description: 'Flat ₹80 discount applied on lunch items during weekday operational hours - DEMO',
    discountType: 'fixed',
    discountValue: 80,
    discountLabel: '₹80 off',
    usageLimit: 120,
    usageCount: 52,
    validFrom: '10 Oct 2026 - 12:00 AM',
    validUntil: '15 Oct 2026 - 11:59 PM',
    validityRangeLabel: '10 Oct 2026 - 15 Oct 2026',
    isActive: true,
    minOrderLabel: 'Not available',
    maxDiscountLabel: 'Not available',
  },
  {
    id: 'c-weekend5',
    code: 'WEEKEND5',
    name: 'Weekend special',
    description: 'Weekend celebratory 5% discount across dining parties - DEMO',
    discountType: 'percentage',
    discountValue: 5,
    discountLabel: '5% off',
    usageLimit: 200,
    usageCount: 200,
    validFrom: '01 Oct 2026 - 12:00 AM',
    validUntil: '05 Oct 2026 - 11:59 PM',
    validityRangeLabel: '01 Oct 2026 - 05 Oct 2026',
    isActive: false,
    minOrderLabel: 'Not available',
    maxDiscountLabel: 'Not available',
  },
  {
    id: 'c-return20',
    code: 'RETURN20',
    name: 'Autumn offer',
    description: 'Autumn festive campaign planned for future season - DEMO',
    discountType: 'percentage',
    discountValue: 20,
    discountLabel: '20% off',
    usageLimit: 100,
    usageCount: 0,
    validFrom: '01 Nov 2026 - 12:00 AM',
    validUntil: '30 Nov 2026 - 11:59 PM',
    validityRangeLabel: '01 Nov 2026 - 30 Nov 2026',
    isActive: false,
    minOrderLabel: 'Not available',
    maxDiscountLabel: 'Not available',
  },
];

let couponsMemoryStore: CouponItem[] = [...INITIAL_COUPONS];

export function getCouponsStore(): CouponItem[] {
  return [...couponsMemoryStore];
}

export function getCouponById(idOrCode: string): CouponItem | undefined {
  const normalized = idOrCode.toLowerCase();
  return couponsMemoryStore.find(
    (c) => c.id.toLowerCase() === normalized || c.code.toLowerCase() === normalized
  );
}

export function updateCouponInStore(updated: Partial<CouponItem> & { id: string }): CouponItem | null {
  const index = couponsMemoryStore.findIndex((c) => c.id === updated.id);
  if (index === -1) return null;
  couponsMemoryStore[index] = {
    ...couponsMemoryStore[index],
    ...updated,
  };
  return couponsMemoryStore[index];
}

export function createCouponInStore(couponData: Omit<CouponItem, 'id' | 'usageCount'>): CouponItem {
  const newCoupon: CouponItem = {
    ...couponData,
    id: `c-${couponData.code.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    usageCount: 0,
  };
  couponsMemoryStore.unshift(newCoupon);
  return newCoupon;
}

export function toggleCouponActive(id: string): CouponItem | null {
  const coupon = couponsMemoryStore.find((c) => c.id === id);
  if (!coupon) return null;
  coupon.isActive = !coupon.isActive;
  return { ...coupon };
}
