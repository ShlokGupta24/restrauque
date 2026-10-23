import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { OrderItemInput } from '@/lib/validation/order';
import { ValidationError, NotFoundError } from '@/lib/http/errors';
import { resolveEffectiveVariantPrice } from '@/lib/menu/format';
import {
  MIN_REDEMPTION_POINTS,
  MAX_REDEMPTION_DISCOUNT_PERCENTAGE,
} from '@/lib/loyalty/service';

export interface ValidatedAddonSnapshot {
  productAddonId: string;
  addonName: string;
  unitPrice: Prisma.Decimal;
  totalPrice: Prisma.Decimal;
  quantity: number;
}

export interface ValidatedItemSnapshot {
  productId: string;
  productName: string;
  variantId: string | null;
  variantName: string | null;
  unitPrice: Prisma.Decimal; // Effective unit price of variant / product
  quantity: number;
  totalPrice: Prisma.Decimal; // (unitPrice + sum(addons.unitPrice)) * quantity
  specialInstructions: string | null;
  addons: ValidatedAddonSnapshot[];
}

export interface AuthoritativePricingResult {
  items: ValidatedItemSnapshot[];
  subtotal: Prisma.Decimal;
  discountAmount: Prisma.Decimal; // Promotional coupon discount only
  loyaltyDiscountAmount: Prisma.Decimal; // Loyalty points discount separately
  taxAmount: Prisma.Decimal;
  totalAmount: Prisma.Decimal;
  pointsRedeemed: number;
  redemptionRate?: Prisma.Decimal | null;
  couponRecord?: {
    id: string;
    code: string;
    discountType: string;
    discountValue: Prisma.Decimal;
  } | null;
  canonicalPayloadHash: string;
}

export interface PricingOptions {
  pointsToRedeem?: number | null;
  customerId?: string | null;
}

/**
 * Computes a deterministic SHA-256 hash of the canonical order request.
 * Used for database-enforced idempotency to detect identical vs conflicting payloads.
 */
export function computeCanonicalPayloadHash(
  tableId: string,
  items: OrderItemInput[],
  couponCode?: string | null,
  notes?: string | null,
  pointsToRedeem?: number | null
): string {
  // Normalize and sort items deterministically
  const normalizedItems = items.map((it) => ({
    productId: it.productId,
    variantId: it.variantId ?? null,
    addonIds: [...(it.addonIds ?? [])].sort(),
    quantity: it.quantity,
    specialInstructions: it.specialInstructions?.trim() ?? null,
  })).sort((a, b) => {
    const keyA = `${a.productId}:${a.variantId ?? ''}:${a.addonIds.join(',')}:${a.quantity}`;
    const keyB = `${b.productId}:${b.variantId ?? ''}:${b.addonIds.join(',')}:${b.quantity}`;
    return keyA.localeCompare(keyB);
  });

  const canonicalObj = {
    tableId,
    items: normalizedItems,
    couponCode: couponCode?.trim().toUpperCase() ?? null,
    notes: notes?.trim() ?? null,
    pointsToRedeem:
      typeof pointsToRedeem === 'number' && Number.isInteger(pointsToRedeem) && pointsToRedeem > 0
        ? pointsToRedeem
        : null,
  };

  return crypto.createHash('sha256').update(JSON.stringify(canonicalObj)).digest('hex');
}

/**
 * Validates requested order items against authoritative database records,
 * enforcing active states, restaurant scoping, and decimal pricing calculations.
 */
export async function calculateAuthoritativePricing(
  items: OrderItemInput[],
  restaurantId: string,
  tableId: string,
  couponCode?: string | null,
  notes?: string | null,
  dbClient: Prisma.TransactionClient | typeof prisma = prisma,
  options?: PricingOptions
): Promise<AuthoritativePricingResult> {
  if (!items || items.length === 0) {
    throw new ValidationError('Order must contain at least one item');
  }

  // Collect unique product IDs
  const productIds = Array.from(new Set(items.map((i) => i.productId)));

  // Query products with active variants and addons belonging to the restaurant
  const products = await dbClient.products.findMany({
    where: {
      id: { in: productIds },
      restaurant_id: restaurantId,
    },
    include: {
      product_variants: true,
      product_addons: true,
    },
  });

  const productMap = new Map(products.map((p) => [p.id, p]));

  // Verify all products exist and belong to the restaurant
  for (const requestedItem of items) {
    const product = productMap.get(requestedItem.productId);
    if (!product) {
      throw new NotFoundError(
        `Product with ID ${requestedItem.productId} does not exist or does not belong to this restaurant`
      );
    }

    if (!product.is_active || !product.is_available) {
      throw new ValidationError(
        `Product "${product.name}" is currently unavailable or inactive`
      );
    }
  }

  const validatedSnapshots: ValidatedItemSnapshot[] = [];
  let subtotalDecimal = new Prisma.Decimal(0);

  for (const item of items) {
    const product = productMap.get(item.productId)!;

    // Determine unit price and variant name
    let itemUnitPrice = new Prisma.Decimal(product.price);
    let variantNameSnapshot: string | null = null;
    let selectedVariantId: string | null = null;

    if (item.variantId) {
      const variant = product.product_variants.find((v) => v.id === item.variantId);
      if (!variant) {
        throw new ValidationError(
          `Variant with ID ${item.variantId} does not belong to product "${product.name}"`
        );
      }
      if (!variant.is_active || !variant.is_available) {
        throw new ValidationError(
          `Variant "${variant.name}" of "${product.name}" is currently unavailable`
        );
      }

      const effectivePrice = resolveEffectiveVariantPrice(variant.price, product.price);
      itemUnitPrice = new Prisma.Decimal(effectivePrice.toFixed(2));
      variantNameSnapshot = variant.name;
      selectedVariantId = variant.id;
    }

    // Process selected addons
    const addonSnapshots: ValidatedAddonSnapshot[] = [];
    let addonsUnitSum = new Prisma.Decimal(0);

    if (item.addonIds && item.addonIds.length > 0) {
      for (const addonId of item.addonIds) {
        const addon = product.product_addons.find((a) => a.id === addonId);
        if (!addon) {
          throw new ValidationError(
            `Add-on with ID ${addonId} does not belong to product "${product.name}"`
          );
        }
        if (!addon.is_active || !addon.is_available) {
          throw new ValidationError(
            `Add-on "${addon.name}" for "${product.name}" is currently unavailable`
          );
        }

        const addonUnitPrice = new Prisma.Decimal(addon.price);
        const addonTotalPrice = addonUnitPrice.mul(item.quantity);
        addonsUnitSum = addonsUnitSum.add(addonUnitPrice);

        addonSnapshots.push({
          productAddonId: addon.id,
          addonName: addon.name,
          unitPrice: addonUnitPrice,
          totalPrice: addonTotalPrice,
          quantity: item.quantity,
        });
      }
    }

    // Line total: (itemUnitPrice + addonsUnitSum) * quantity
    const effectiveUnitPrice = itemUnitPrice.add(addonsUnitSum);
    const lineTotal = effectiveUnitPrice.mul(item.quantity);
    subtotalDecimal = subtotalDecimal.add(lineTotal);

    validatedSnapshots.push({
      productId: product.id,
      productName: product.name,
      variantId: selectedVariantId,
      variantName: variantNameSnapshot,
      unitPrice: itemUnitPrice,
      quantity: item.quantity,
      totalPrice: lineTotal,
      specialInstructions: item.specialInstructions?.trim() || null,
      addons: addonSnapshots,
    });
  }

  // Calculate discount from coupon if provided
  let discountDecimal = new Prisma.Decimal(0);
  let appliedCoupon: AuthoritativePricingResult['couponRecord'] = null;

  if (couponCode && couponCode.trim()) {
    const codeNormalized = couponCode.trim().toUpperCase();
    const now = new Date();

    const coupon = await dbClient.coupons.findFirst({
      where: {
        code: codeNormalized,
        restaurant_id: restaurantId,
        is_active: true,
      },
    });

    if (!coupon) {
      throw new ValidationError(`Coupon code "${couponCode}" is invalid or does not exist`);
    }

    if (coupon.valid_from > now || (coupon.valid_until && coupon.valid_until < now)) {
      throw new ValidationError(`Coupon code "${couponCode}" has expired or is not yet active`);
    }

    if (coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
      throw new ValidationError(`Coupon code "${couponCode}" usage limit has been reached`);
    }

    const minAmount = new Prisma.Decimal(coupon.minimum_order_amount);
    if (subtotalDecimal.lessThan(minAmount)) {
      throw new ValidationError(
        `Order subtotal (${subtotalDecimal.toFixed(2)}) is less than minimum required (${minAmount.toFixed(2)}) for coupon "${couponCode}"`
      );
    }

    const discountVal = new Prisma.Decimal(coupon.discount_value);
    if (coupon.discount_type === 'percentage') {
      discountDecimal = subtotalDecimal.mul(discountVal).div(100);
      if (coupon.maximum_discount_amount) {
        const maxDiscount = new Prisma.Decimal(coupon.maximum_discount_amount);
        if (discountDecimal.greaterThan(maxDiscount)) {
          discountDecimal = maxDiscount;
        }
      }
    } else {
      // Fixed discount
      discountDecimal = Prisma.Decimal.min(discountVal, subtotalDecimal);
    }

    // Ensure 2 decimal places
    discountDecimal = new Prisma.Decimal(discountDecimal.toFixed(2));
    appliedCoupon = {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: discountVal,
    };
  }

  // 5. Calculate loyalty points discount if pointsToRedeem requested
  let loyaltyDiscountDecimal = new Prisma.Decimal('0.00');
  let pointsRedeemed = 0;
  let redemptionRateDecimal: Prisma.Decimal | null = null;

  if (options?.pointsToRedeem !== undefined && options?.pointsToRedeem !== null) {
    const requestedPoints = options.pointsToRedeem;

    if (typeof requestedPoints !== 'number' || !Number.isInteger(requestedPoints) || requestedPoints <= 0) {
      throw new ValidationError('pointsToRedeem must be a positive integer');
    }

    if (requestedPoints < MIN_REDEMPTION_POINTS) {
      throw new ValidationError(`Minimum redemption is ${MIN_REDEMPTION_POINTS} points`);
    }

    // Load authorized restaurant's active loyalty program
    const program = await dbClient.loyalty_programs.findUnique({
      where: { restaurant_id: restaurantId },
    });

    if (!program || !program.is_active) {
      throw new ValidationError('Loyalty redemption is currently unavailable for this restaurant');
    }

    redemptionRateDecimal = program.redemption_rate
      ? new Prisma.Decimal(program.redemption_rate)
      : new Prisma.Decimal('1.00');

    // Eligible bill for loyalty cap is non-negative subtotal after coupon discount, excluding tax and tips
    let eligibleSpend = subtotalDecimal.sub(discountDecimal);
    if (eligibleSpend.lessThan(0)) {
      eligibleSpend = new Prisma.Decimal('0.00');
    }

    // Maximum loyalty discount: 50% of eligible bill
    const maxLoyaltyDiscount = eligibleSpend.mul(MAX_REDEMPTION_DISCOUNT_PERCENTAGE);

    // Rupee conversion: pointsToRedeem * redemptionRate, rounded to 2 decimal places deterministically
    const pointsDec = new Prisma.Decimal(requestedPoints);
    const calculatedLoyaltyDiscount = pointsDec.mul(redemptionRateDecimal);
    const roundedLoyaltyDiscount = new Prisma.Decimal(calculatedLoyaltyDiscount.toFixed(2));

    // Reject requests exceeding the 50% maximum discount cap (do NOT silently clamp)
    if (roundedLoyaltyDiscount.greaterThan(maxLoyaltyDiscount)) {
      throw new ValidationError(
        `Requested redemption of ${requestedPoints} points (₹${roundedLoyaltyDiscount.toFixed(2)}) exceeds maximum allowed discount of ₹${maxLoyaltyDiscount.toFixed(2)} (50% of eligible bill)`
      );
    }

    // Customer balance check if customerId provided
    if (options.customerId) {
      const customerAccount = await dbClient.customer_loyalty_accounts.findUnique({
        where: {
          customer_id_restaurant_id: {
            customer_id: options.customerId,
            restaurant_id: restaurantId,
          },
        },
      });

      const currentPoints = customerAccount ? customerAccount.stars_balance : 0;
      if (currentPoints < requestedPoints) {
        throw new ValidationError(
          `Insufficient loyalty points: requested ${requestedPoints} points but account has ${currentPoints} points`
        );
      }
    }

    loyaltyDiscountDecimal = roundedLoyaltyDiscount;
    if (loyaltyDiscountDecimal.greaterThan(eligibleSpend)) {
      loyaltyDiscountDecimal = eligibleSpend;
    }
    pointsRedeemed = requestedPoints;
  }

  // Tax calculation: Default 0.00 as verified in design (no invented arbitrary rates)
  const taxDecimal = new Prisma.Decimal(0);

  // Total amount: subtotal - couponDiscount - loyaltyDiscount + tax
  let totalDecimal = subtotalDecimal.sub(discountDecimal).sub(loyaltyDiscountDecimal).add(taxDecimal);
  if (totalDecimal.lessThan(0)) {
    totalDecimal = new Prisma.Decimal(0);
  }

  const canonicalPayloadHash = computeCanonicalPayloadHash(
    tableId,
    items,
    couponCode,
    notes,
    options?.pointsToRedeem
  );

  return {
    items: validatedSnapshots,
    subtotal: new Prisma.Decimal(subtotalDecimal.toFixed(2)),
    discountAmount: new Prisma.Decimal(discountDecimal.toFixed(2)),
    loyaltyDiscountAmount: new Prisma.Decimal(loyaltyDiscountDecimal.toFixed(2)),
    taxAmount: new Prisma.Decimal(taxDecimal.toFixed(2)),
    totalAmount: new Prisma.Decimal(totalDecimal.toFixed(2)),
    pointsRedeemed,
    redemptionRate: redemptionRateDecimal,
    couponRecord: appliedCoupon,
    canonicalPayloadHash,
  };
}
