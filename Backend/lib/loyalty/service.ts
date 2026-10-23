import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { AppError, NotFoundError, ConflictError, ForbiddenError, ValidationError } from '@/lib/http/errors';
import type { UpdateLoyaltyRulesInput } from '@/lib/validation/feedback';
import type {
  OwnerLoyaltyAccountsQueryInput,
  OwnerLoyaltyAccountDetailQueryInput,
  OwnerRewardsQueryInput,
  CreateRewardInput,
  UpdateRewardInput,
  OwnerRewardRedemptionsQueryInput,
} from '@/lib/validation/loyalty';

export interface LoyaltyRuleSummary {
  id: string;
  restaurantId: string;
  name: string;
  description: string | null;
  isActive: boolean;
  earningMode: string;
  starsPerVisit: number;
  starsPerReview: number;
  redemptionRate: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Approved business rules for loyalty points redemption:
 * - Minimum redemption: 20 points
 * - Maximum points-funded discount: 50% (0.50) of eligible bill value
 * - Spend earn rate: 1 point per ₹50 of eligible discounted spend
 */
export const MIN_REDEMPTION_POINTS = 20;
export const MAX_REDEMPTION_DISCOUNT_PERCENTAGE = 0.5;
export const SPEND_POINTS_PER_RUPEES = 50;

export interface CustomerLoyaltySummary {
  accountId: string;
  customerId: string;
  restaurantId: string;
  programName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  recentTransactions: {
    id: string;
    transactionType: string;
    stars: number;
    description: string | null;
    createdAt: string;
  }[];
}

export interface AwardRewardResult {
  starsAwarded: number;
  newBalance: number;
  isRewardEarned: boolean;
  programName: string;
  description: string;
}

/**
 * Retrieves the loyalty program for a restaurant, creating a default one if it doesn't exist yet.
 */
export async function getOrCreateRestaurantLoyaltyProgram(
  restaurantId: string,
  tx?: Prisma.TransactionClient
): Promise<LoyaltyRuleSummary> {
  const db = tx || prisma;

  let program = await db.loyalty_programs.findUnique({
    where: { restaurant_id: restaurantId },
  });

  if (!program) {
    // Auto-initialize standard default loyalty program for the restaurant
    program = await db.loyalty_programs.create({
      data: {
        restaurant_id: restaurantId,
        name: 'Dining Rewards',
        description: 'Earn stars on completed visits and dining reviews to unlock rewards.',
        is_active: true,
        earning_mode: 'visit_and_review',
        stars_per_visit: 5,
        stars_per_review: 10,
        redemption_rate: new Prisma.Decimal('1.00'),
      },
    });
  }

  return {
    id: program.id,
    restaurantId: program.restaurant_id,
    name: program.name,
    description: program.description,
    isActive: program.is_active,
    earningMode: program.earning_mode,
    starsPerVisit: program.stars_per_visit,
    starsPerReview: program.stars_per_review,
    redemptionRate:
      program.redemption_rate !== undefined && program.redemption_rate !== null
        ? Number(program.redemption_rate)
        : 1.0,
    createdAt:
      program.created_at instanceof Date
        ? program.created_at.toISOString()
        : program.created_at
        ? new Date(program.created_at).toISOString()
        : new Date().toISOString(),
    updatedAt:
      program.updated_at instanceof Date
        ? program.updated_at.toISOString()
        : program.updated_at
        ? new Date(program.updated_at).toISOString()
        : new Date().toISOString(),
  };
}

/**
 * Updates loyalty program rules for an authorized restaurant owner.
 */
export async function updateRestaurantLoyaltyRules(
  restaurantId: string,
  input: UpdateLoyaltyRulesInput
): Promise<LoyaltyRuleSummary> {
  // Ensure the program exists first
  await getOrCreateRestaurantLoyaltyProgram(restaurantId);

  const updated = await prisma.loyalty_programs.update({
    where: { restaurant_id: restaurantId },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.isActive !== undefined ? { is_active: input.isActive } : {}),
      ...(input.earningMode !== undefined ? { earning_mode: input.earningMode } : {}),
      ...(input.starsPerVisit !== undefined ? { stars_per_visit: input.starsPerVisit } : {}),
      ...(input.starsPerReview !== undefined ? { stars_per_review: input.starsPerReview } : {}),
      ...(input.redemptionRate !== undefined
        ? { redemption_rate: new Prisma.Decimal(input.redemptionRate.toFixed(2)) }
        : {}),
      updated_at: new Date(),
    },
  });

  return {
    id: updated.id,
    restaurantId: updated.restaurant_id,
    name: updated.name,
    description: updated.description,
    isActive: updated.is_active,
    earningMode: updated.earning_mode,
    starsPerVisit: updated.stars_per_visit,
    starsPerReview: updated.stars_per_review,
    redemptionRate:
      updated.redemption_rate !== undefined && updated.redemption_rate !== null
        ? Number(updated.redemption_rate)
        : 1.0,
    createdAt:
      updated.created_at instanceof Date
        ? updated.created_at.toISOString()
        : updated.created_at
        ? new Date(updated.created_at).toISOString()
        : new Date().toISOString(),
    updatedAt:
      updated.updated_at instanceof Date
        ? updated.updated_at.toISOString()
        : updated.updated_at
        ? new Date(updated.updated_at).toISOString()
        : new Date().toISOString(),
  };
}

/**
 * Retrieves a customer's loyalty balance and transactions for a specific restaurant.
 */
export async function getCustomerLoyaltySummary(
  customerId: string,
  restaurantId: string
): Promise<CustomerLoyaltySummary> {
  const program = await getOrCreateRestaurantLoyaltyProgram(restaurantId);

  let account = await prisma.customer_loyalty_accounts.findUnique({
    where: {
      customer_id_restaurant_id: {
        customer_id: customerId,
        restaurant_id: restaurantId,
      },
    },
    include: {
      loyalty_transactions: {
        orderBy: { created_at: 'desc' },
        take: 10,
      },
    },
  });

  if (!account) {
    // Create loyalty account if first time interacting with this restaurant
    account = await prisma.customer_loyalty_accounts.create({
      data: {
        customer_id: customerId,
        restaurant_id: restaurantId,
        loyalty_program_id: program.id,
        stars_balance: 0,
        lifetime_stars_earned: 0,
        lifetime_stars_redeemed: 0,
        tier: 'standard',
        status: 'active',
      },
      include: {
        loyalty_transactions: {
          orderBy: { created_at: 'desc' },
          take: 10,
        },
      },
    });
  }

  return {
    accountId: account.id,
    customerId: account.customer_id,
    restaurantId: account.restaurant_id,
    programName: program.name,
    starsBalance: account.stars_balance,
    lifetimeStarsEarned: account.lifetime_stars_earned,
    lifetimeStarsRedeemed: account.lifetime_stars_redeemed,
    tier: account.tier,
    status: account.status,
    recentTransactions: account.loyalty_transactions.map((tx) => ({
      id: tx.id,
      transactionType: tx.transaction_type,
      stars: tx.stars,
      description: tx.description,
      createdAt: tx.created_at.toISOString(),
    })),
  };
}

/**
 * Authoritative, transactional reward awarding for eligible feedback.
 * Guaranteed idempotent and atomic:
 * - Checks whether a reward transaction for this feedback already exists.
 * - Respects active restaurant rules.
 * - Locks the customer loyalty account row during update to prevent race conditions.
 */
export async function awardFeedbackLoyaltyReward(
  tx: Prisma.TransactionClient,
  params: {
    customerId: string;
    restaurantId: string;
    orderId: string;
    feedbackId: string;
    itemCount: number;
  }
): Promise<AwardRewardResult> {
  const { customerId, restaurantId, orderId, feedbackId, itemCount } = params;

  // 1. Fetch restaurant rules
  const program = await getOrCreateRestaurantLoyaltyProgram(restaurantId, tx);

  // 2. Check if reward is already awarded for this feedback (idempotency check)
  const existingTransaction = await tx.loyalty_transactions.findFirst({
    where: {
      feedback_id: feedbackId,
      transaction_type: 'review_reward',
    },
  });

  // Ensure customer loyalty account exists
  let account = await tx.customer_loyalty_accounts.findUnique({
    where: {
      customer_id_restaurant_id: {
        customer_id: customerId,
        restaurant_id: restaurantId,
      },
    },
  });

  if (!account) {
    account = await tx.customer_loyalty_accounts.create({
      data: {
        customer_id: customerId,
        restaurant_id: restaurantId,
        loyalty_program_id: program.id,
        stars_balance: 0,
        lifetime_stars_earned: 0,
        lifetime_stars_redeemed: 0,
        tier: 'standard',
        status: 'active',
      },
    });
  }

  if (existingTransaction) {
    return {
      starsAwarded: existingTransaction.stars,
      newBalance: account.stars_balance,
      isRewardEarned: existingTransaction.stars > 0,
      programName: program.name,
      description: existingTransaction.description || 'Feedback reward already claimed',
    };
  }

  // 3. If program is inactive or rewards are 0, record zero-point claim or skip
  if (!program.isActive || program.starsPerReview <= 0) {
    return {
      starsAwarded: 0,
      newBalance: account.stars_balance,
      isRewardEarned: false,
      programName: program.name,
      description: 'Loyalty rewards are currently inactive for this restaurant',
    };
  }

  // 4. Calculate authoritative reward points: base stars per review + optional 1 bonus star per rated item (capped at 5 bonus stars)
  const baseStars = program.starsPerReview;
  const itemBonusStars = Math.min(itemCount, 5); // 1 bonus star per item reviewed, up to 5 bonus stars
  const totalStarsToAward = baseStars + itemBonusStars;

  // 5. Lock customer loyalty account row
  const lockedAccounts: any[] = await tx.$queryRaw`
    SELECT id, stars_balance, lifetime_stars_earned
    FROM customer_loyalty_accounts
    WHERE id = ${account.id}::uuid
    FOR UPDATE
  `;

  if (!lockedAccounts || lockedAccounts.length === 0) {
    throw new NotFoundError('Loyalty account not found for update');
  }

  const currentAccount = lockedAccounts[0];
  const newBalance = currentAccount.stars_balance + totalStarsToAward;
  const newLifetime = currentAccount.lifetime_stars_earned + totalStarsToAward;

  // 6. Persist transaction record
  const description =
    itemBonusStars > 0
      ? `Earned ${baseStars} stars for overall review + ${itemBonusStars} bonus stars for rating items`
      : `Earned ${baseStars} stars for order review`;

  await tx.loyalty_transactions.create({
    data: {
      loyalty_account_id: account.id,
      customer_id: customerId,
      restaurant_id: restaurantId,
      order_id: orderId,
      feedback_id: feedbackId,
      transaction_type: 'review_reward',
      stars: totalStarsToAward,
      description,
    },
  });

  // 7. Update customer loyalty account balance
  await tx.customer_loyalty_accounts.update({
    where: { id: account.id },
    data: {
      stars_balance: newBalance,
      lifetime_stars_earned: newLifetime,
      updated_at: new Date(),
    },
  });

  return {
    starsAwarded: totalStarsToAward,
    newBalance,
    isRewardEarned: true,
    programName: program.name,
    description,
  };
}

export interface AwardSpendRewardResult {
  pointsAwarded: number;
  newBalance: number;
  isRewardEarned: boolean;
  eligibleSpend: number;
  description: string;
}

/**
 * Authoritative, transactional loyalty points awarding for eligible dining spend on order completion.
 * Rule: 1 point per ₹50 of eligible discounted spend (persisted subtotal - applicable coupon discount).
 * Discards fractional points (floor division). Excludes taxes and tips.
 * If eligible spend < ₹50, awards 0 points and creates no zero-value transaction.
 * Strictly idempotent: prevents duplicate awards on repeated or concurrent completion requests.
 */
export async function awardOrderSpendLoyaltyReward(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderNumber: string;
    restaurantId: string;
    customerId: string;
    subtotal: Prisma.Decimal | number | string;
    discountAmount: Prisma.Decimal | number | string;
  }
): Promise<AwardSpendRewardResult> {
  const { orderId, orderNumber, restaurantId, customerId, subtotal, discountAmount } = params;

  // 1. Check if spend reward has already been awarded for this order (idempotency guard)
  const existingTransaction = await tx.loyalty_transactions.findFirst({
    where: {
      order_id: orderId,
      transaction_type: 'visit_reward',
    },
  });

  if (existingTransaction) {
    const existingAccount = await tx.customer_loyalty_accounts.findUnique({
      where: {
        customer_id_restaurant_id: {
          customer_id: customerId,
          restaurant_id: restaurantId,
        },
      },
      select: { stars_balance: true },
    });

    return {
      pointsAwarded: existingTransaction.stars,
      newBalance: existingAccount ? existingAccount.stars_balance : 0,
      isRewardEarned: existingTransaction.stars > 0,
      eligibleSpend: 0,
      description: existingTransaction.description || 'Spend reward already awarded for this order',
    };
  }

  // 2. Calculate eligible spend: persisted subtotal - coupon discount (excluding taxes and tips)
  const subtotalDec = new Prisma.Decimal(subtotal ?? 0);
  const discountDec = new Prisma.Decimal(discountAmount ?? 0);
  let eligibleSpendDec = subtotalDec.sub(discountDec);
  if (eligibleSpendDec.lessThan(0)) {
    eligibleSpendDec = new Prisma.Decimal(0);
  }

  const eligibleSpendNum = Number(eligibleSpendDec);

  // 3. Calculate whole points: Math.floor(eligibleSpend / 50)
  const pointsToAward = Math.floor(eligibleSpendNum / 50);

  // 4. Retrieve or auto-initialize loyalty program for the restaurant
  const program = await getOrCreateRestaurantLoyaltyProgram(restaurantId, tx);

  // 5. If program is inactive or points to award is 0, do NOT create zero-value transaction
  if (!program.isActive || pointsToAward <= 0) {
    const currentAccount = await tx.customer_loyalty_accounts.findUnique({
      where: {
        customer_id_restaurant_id: {
          customer_id: customerId,
          restaurant_id: restaurantId,
        },
      },
      select: { stars_balance: true },
    });

    return {
      pointsAwarded: 0,
      newBalance: currentAccount ? currentAccount.stars_balance : 0,
      isRewardEarned: false,
      eligibleSpend: eligibleSpendNum,
      description: !program.isActive
        ? 'Loyalty rewards are currently inactive for this restaurant'
        : 'Eligible spend under ₹50; no points awarded',
    };
  }

  // 6. Ensure customer loyalty account exists (safely handling potential P2002 race condition)
  let account = await tx.customer_loyalty_accounts.findUnique({
    where: {
      customer_id_restaurant_id: {
        customer_id: customerId,
        restaurant_id: restaurantId,
      },
    },
  });

  if (!account) {
    try {
      account = await tx.customer_loyalty_accounts.create({
        data: {
          customer_id: customerId,
          restaurant_id: restaurantId,
          loyalty_program_id: program.id,
          stars_balance: 0,
          lifetime_stars_earned: 0,
          lifetime_stars_redeemed: 0,
          tier: 'standard',
          status: 'active',
        },
      });
    } catch (createErr: any) {
      if (createErr?.code === 'P2002') {
        account = await tx.customer_loyalty_accounts.findUnique({
          where: {
            customer_id_restaurant_id: {
              customer_id: customerId,
              restaurant_id: restaurantId,
            },
          },
        });
      } else {
        throw createErr;
      }
    }
  }

  if (!account) {
    throw new NotFoundError('Failed to resolve customer loyalty account');
  }

  // 7. Acquire row-level lock on customer loyalty account to serialize balance updates
  const lockedAccounts: any[] = await tx.$queryRaw`
    SELECT id, stars_balance, lifetime_stars_earned
    FROM customer_loyalty_accounts
    WHERE id = ${account.id}::uuid
    FOR UPDATE
  `;

  if (!lockedAccounts || lockedAccounts.length === 0) {
    throw new NotFoundError('Loyalty account not found for update');
  }

  const lockedAccount = lockedAccounts[0];
  const newBalance = lockedAccount.stars_balance + pointsToAward;
  const newLifetime = lockedAccount.lifetime_stars_earned + pointsToAward;

  // 8. Persist non-zero loyalty transaction record
  const description = `Earned ${pointsToAward} point${pointsToAward === 1 ? '' : 's'} for dining spend (Order #${orderNumber})`;

  await tx.loyalty_transactions.create({
    data: {
      loyalty_account_id: account.id,
      customer_id: customerId,
      restaurant_id: restaurantId,
      order_id: orderId,
      transaction_type: 'visit_reward',
      stars: pointsToAward,
      description,
    },
  });

  // 9. Update customer loyalty account balance atomically
  await tx.customer_loyalty_accounts.update({
    where: { id: account.id },
    data: {
      stars_balance: newBalance,
      lifetime_stars_earned: newLifetime,
      updated_at: new Date(),
    },
  });

  return {
    pointsAwarded: pointsToAward,
    newBalance,
    isRewardEarned: true,
    eligibleSpend: eligibleSpendNum,
    description,
  };
}

export interface CancelLoyaltyResult {
  orderId: string;
  pointsRestored: number;
  pointsReversed: number;
  pointsAttemptedToReverse: number;
  outstandingSpendLiability: number;
  newBalance: number;
  redemptionRestored: boolean;
  spendRewardReversed: boolean;
  notes: string[];
}

export interface RecoverLoyaltyLiabilityResult {
  orderId: string;
  orderNumber: string;
  customerId: string;
  pointsRecovered: number;
  outstandingPointsRemaining: number;
  isRecoveryComplete: boolean;
  currentStarsBalance: number;
  notes: string[];
}

export interface CancelledOrderLiabilitySummary {
  orderId: string;
  orderNumber: string;
  branchId: string;
  branchName: string | null;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  orderedAt: string;
  totalEarnedPoints: number;
  totalReversedPoints: number;
  outstandingLiability: number;
  customerCurrentBalance: number;
  canRecoverNow: boolean;
  recoverablePoints: number;
  isRecoveryComplete: boolean;
}

export interface ListLoyaltyLiabilitiesResult {
  orders: CancelledOrderLiabilitySummary[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  summary: {
    totalCandidateOrders: number;
    ordersWithOutstandingLiability: number;
    totalOutstandingPoints: number;
    totalRecoverablePointsNow: number;
  };
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REVERSAL_TAG_PREFIX_REGEX = /^\[REF_TX:([^\]]+)\]/;

export interface ParsedReversalTag {
  hasTagPrefix: boolean;
  refTxId: string | null;
  isMalformed: boolean;
}

/**
 * Structured tag format linking an adjustment reversal to its original transaction UUID:
 * Format: [REF_TX:<uuid>]
 */
export function formatReversalTag(origTxId: string): string {
  return `[REF_TX:${origTxId}]`;
}

/**
 * Strict parser for reversal association tags.
 * Only tags starting at index 0 are considered system association tags.
 * Untrusted notes containing "[REF_TX:" elsewhere are ignored.
 */
export function parseReversalTag(description: string | null | undefined): ParsedReversalTag {
  if (!description) {
    return { hasTagPrefix: false, refTxId: null, isMalformed: false };
  }
  const match = description.match(REVERSAL_TAG_PREFIX_REGEX);
  if (!match) {
    return { hasTagPrefix: false, refTxId: null, isMalformed: false };
  }
  const candidateId = match[1];
  if (!UUID_REGEX.test(candidateId)) {
    return { hasTagPrefix: true, refTxId: null, isMalformed: true };
  }
  return { hasTagPrefix: true, refTxId: candidateId, isMalformed: false };
}

/**
 * Checks whether an adjustment transaction's description is tagged for a specific original transaction.
 * Fails safely if the tag header is malformed.
 */
export function isReversalForTx(description: string | null | undefined, origTxId: string): boolean {
  if (!description) return false;
  const parsed = parseReversalTag(description);
  if (parsed.isMalformed) {
    throw new ConflictError(`Malformed reversal association tag encountered: "${description}"`);
  }
  return parsed.refTxId === origTxId;
}

/**
 * Validates that all adjustment transactions with association tags on an order are well-formed
 * and reference valid known transactions.
 */
export function validateOrderAdjustmentTags(
  orderTransactions: Array<{ id: string; transaction_type: string; stars: number; description: string | null }>,
  knownTxIds: Set<string>
): void {
  for (const tx of orderTransactions) {
    if (tx.transaction_type === 'adjustment' && tx.description) {
      const parsed = parseReversalTag(tx.description);
      if (parsed.hasTagPrefix) {
        if (parsed.isMalformed) {
          throw new ConflictError(
            `Malformed association tag detected on adjustment transaction ${tx.id}: "${tx.description}". Safe recovery aborted.`
          );
        }
        if (parsed.refTxId && !knownTxIds.has(parsed.refTxId)) {
          throw new ConflictError(
            `Ambiguous association tag on adjustment transaction ${tx.id}: referenced transaction ${parsed.refTxId} does not belong to this order.`
          );
        }
      }
    }
  }
}

interface SharedSpendReversalExecutionParams {
  tx: Prisma.TransactionClient;
  accountId: string;
  customerId: string;
  restaurantId: string;
  orderId: string;
  orderNumber: string;
  spendRewardTxs: Array<{ id: string; stars: number }>;
  orderTransactions: Array<{ id: string; transaction_type: string; stars: number; description: string | null }>;
  currentBalance: number;
  currentLifetimeEarned: number;
  isRecovery?: boolean;
}

interface SharedSpendReversalExecutionResult {
  pointsReversed: number;
  pointsAttemptedToReverse: number;
  outstandingSpendLiability: number;
  newBalance: number;
  newLifetimeEarned: number;
  spendRewardReversed: boolean;
  notes: string[];
}

/**
 * Authoritative, shared accounting algorithm for spend-reward liability reversal and recovery.
 * Used identically by both cancellation reversal and owner liability recovery.
 */
async function executeSpendReversalReconstructionAndDeduction(
  params: SharedSpendReversalExecutionParams
): Promise<SharedSpendReversalExecutionResult> {
  const {
    tx,
    accountId,
    customerId,
    restaurantId,
    orderId,
    orderNumber,
    spendRewardTxs,
    orderTransactions,
    currentBalance,
    currentLifetimeEarned,
    isRecovery = false,
  } = params;

  let balance = currentBalance;
  let lifetimeEarned = currentLifetimeEarned;
  let pointsReversed = 0;
  let pointsAttemptedToReverse = 0;
  let outstandingSpendLiability = 0;
  let spendRewardReversed = false;
  const notes: string[] = [];

  for (const origSpendTx of spendRewardTxs) {
    const origPoints = origSpendTx.stars;
    pointsAttemptedToReverse += origPoints;

    // Sum adjustments already specifically applied to reverse this exact spend reward transaction
    const alreadyReversed = orderTransactions
      .filter(
        (t) =>
          t.transaction_type === 'adjustment' &&
          t.stars < 0 &&
          isReversalForTx(t.description, origSpendTx.id)
      )
      .reduce((sum, t) => sum + Math.abs(t.stars), 0);

    const remainingToReverse = Math.max(0, origPoints - alreadyReversed);
    if (remainingToReverse > 0) {
      // Deduct up to current available balance (strictly maintaining non-negative balance)
      const actualDeduction = Math.min(balance, remainingToReverse);

      if (actualDeduction > 0) {
        balance -= actualDeduction;
        // Decrement lifetime_stars_earned ONLY by the amount actually revoked from the customer's balance
        if (lifetimeEarned < actualDeduction) {
          notes.push(
            `Warning: lifetime_stars_earned (${lifetimeEarned}) was lower than actual deduction (${actualDeduction}); clamped to 0.`
          );
          lifetimeEarned = 0;
        } else {
          lifetimeEarned -= actualDeduction;
        }
        pointsReversed += actualDeduction;
        spendRewardReversed = true;

        const isPartial = actualDeduction < remainingToReverse;
        const actionLabel = isRecovery ? 'Recovered' : 'Reversed';
        const desc = `${formatReversalTag(origSpendTx.id)} ${actionLabel} ${actualDeduction} of ${origPoints} spend-earned points for cancelled order #${orderNumber}${
          isPartial ? ` (partial ${isRecovery ? 'recovery' : 'reversal'}, capped at available balance)` : ''
        }`;

        await tx.loyalty_transactions.create({
          data: {
            loyalty_account_id: accountId,
            customer_id: customerId,
            restaurant_id: restaurantId,
            order_id: orderId,
            transaction_type: 'adjustment',
            stars: -actualDeduction,
            description: desc,
          },
        });

        notes.push(
          `${actionLabel} ${actualDeduction} points for spend reward ${origSpendTx.id}${
            isPartial ? ` (${remainingToReverse - actualDeduction} remaining liability)` : ''
          }.`
        );
      }

      const uncollectedForThisTx = remainingToReverse - actualDeduction;
      if (uncollectedForThisTx > 0) {
        outstandingSpendLiability += uncollectedForThisTx;
        notes.push(
          `Outstanding spend reversal liability of ${uncollectedForThisTx} points for transaction ${origSpendTx.id} pending customer balance replenishment.`
        );
      }
    }
  }

  return {
    pointsReversed,
    pointsAttemptedToReverse,
    outstandingSpendLiability,
    newBalance: balance,
    newLifetimeEarned: lifetimeEarned,
    spendRewardReversed,
    notes,
  };
}

/**
 * Authoritative, transactional loyalty reversal and redemption restoration on order cancellation.
 * - Restores points redeemed at checkout (transaction_type: 'redemption') exactly once per redemption entry.
 * - Reverses spend-earned points awarded on completion (transaction_type: 'visit_reward') with partial retry support.
 * - Records reversals using supported transaction type 'adjustment' tagged with [REF_TX:<orig_id>].
 * - Pre-locks the order and customer loyalty account rows FOR UPDATE before reading transactions.
 * - Preserves review rewards ('review_reward') untouched.
 * - Ensures customer loyalty balance never drops below 0 (caps deduction at available balance).
 * - Accurately tracks outstanding spend liability across retries without duplicate deductions.
 * - Maintains exact three-way reconciliation between signed ledger, balance, and lifetime counters.
 */
export async function reverseOrderLoyaltyOnCancellation(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderNumber: string;
    restaurantId: string;
    customerId: string | null | undefined;
  }
): Promise<CancelLoyaltyResult> {
  const { orderId, orderNumber, restaurantId, customerId } = params;

  // 1. Guard against orders without customer
  if (!customerId) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      pointsRestored: 0,
      pointsReversed: 0,
      pointsAttemptedToReverse: 0,
      outstandingSpendLiability: 0,
      newBalance: 0,
      redemptionRestored: false,
      spendRewardReversed: false,
      notes: ['No customer associated with order; skipped loyalty reversal.'],
    };
  }

  // 2. Resolve customer loyalty account
  const account = await tx.customer_loyalty_accounts.findUnique({
    where: {
      customer_id_restaurant_id: {
        customer_id: customerId,
        restaurant_id: restaurantId,
      },
    },
  });

  if (!account) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      pointsRestored: 0,
      pointsReversed: 0,
      pointsAttemptedToReverse: 0,
      outstandingSpendLiability: 0,
      newBalance: 0,
      redemptionRestored: false,
      spendRewardReversed: false,
      notes: ['Customer loyalty account not found; skipped loyalty reversal.'],
    };
  }

  // 3. Acquire row-level locks on BOTH the order and customer loyalty account BEFORE reading ledger state
  await tx.$queryRaw`
    SELECT id FROM orders
    WHERE id = ${orderId}::uuid
    FOR UPDATE
  `;

  const lockedAccounts: any[] = await tx.$queryRaw`
    SELECT id, stars_balance, lifetime_stars_earned, lifetime_stars_redeemed
    FROM customer_loyalty_accounts
    WHERE id = ${account.id}::uuid
    FOR UPDATE
  `;

  if (!lockedAccounts || lockedAccounts.length === 0) {
    throw new NotFoundError('Loyalty account not found for update');
  }

  const lockedAccount = lockedAccounts[0];
  let currentBalance = lockedAccount.stars_balance;
  let currentLifetimeEarned = lockedAccount.lifetime_stars_earned;
  let currentLifetimeRedeemed = lockedAccount.lifetime_stars_redeemed;

  // 4. Read loyalty transactions for the order under serialized locks
  const orderTransactions = await tx.loyalty_transactions.findMany({
    where: { order_id: orderId },
  });

  const redemptionTxs = orderTransactions.filter(
    (t) => t.transaction_type === 'redemption' && t.stars < 0
  );
  const spendRewardTxs = orderTransactions.filter(
    (t) => t.transaction_type === 'visit_reward' && t.stars > 0
  );

  // Validate existing adjustment tags against known transaction IDs for this order
  const knownTxIds = new Set<string>([
    ...redemptionTxs.map((t) => t.id),
    ...spendRewardTxs.map((t) => t.id),
  ]);
  validateOrderAdjustmentTags(orderTransactions, knownTxIds);

  if (redemptionTxs.length === 0 && spendRewardTxs.length === 0) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      pointsRestored: 0,
      pointsReversed: 0,
      pointsAttemptedToReverse: 0,
      outstandingSpendLiability: 0,
      newBalance: currentBalance,
      redemptionRestored: false,
      spendRewardReversed: false,
      notes: ['No redemption or spend reward ledger entries found for order.'],
    };
  }

  let pointsRestored = 0;
  let redemptionRestored = false;
  const notes: string[] = [];

  // 5. Process Redemption Restoration per individual original redemption transaction
  for (const origRedTx of redemptionTxs) {
    const origPoints = Math.abs(origRedTx.stars);

    // Sum adjustments already specifically applied to reverse this exact redemption transaction
    const alreadyRestored = orderTransactions
      .filter(
        (t) =>
          t.transaction_type === 'adjustment' &&
          t.stars > 0 &&
          isReversalForTx(t.description, origRedTx.id)
      )
      .reduce((sum, t) => sum + t.stars, 0);

    const remainingToRestore = Math.max(0, origPoints - alreadyRestored);
    if (remainingToRestore > 0) {
      currentBalance += remainingToRestore;
      currentLifetimeRedeemed = Math.max(0, currentLifetimeRedeemed - remainingToRestore);
      pointsRestored += remainingToRestore;
      redemptionRestored = true;

      const desc = `${formatReversalTag(origRedTx.id)} Restored ${remainingToRestore} redeemed points for cancelled order #${orderNumber}`;

      await tx.loyalty_transactions.create({
        data: {
          loyalty_account_id: account.id,
          customer_id: customerId,
          restaurant_id: restaurantId,
          order_id: orderId,
          transaction_type: 'adjustment',
          stars: remainingToRestore,
          description: desc,
        },
      });

      notes.push(
        `Restored ${remainingToRestore} points for redemption transaction ${origRedTx.id}.`
      );
    }
  }

  // 6. Process Spend Reward Reversal via shared accounting algorithm
  const spendResult = await executeSpendReversalReconstructionAndDeduction({
    tx,
    accountId: account.id,
    customerId,
    restaurantId,
    orderId,
    orderNumber,
    spendRewardTxs,
    orderTransactions,
    currentBalance,
    currentLifetimeEarned,
    isRecovery: false,
  });

  currentBalance = spendResult.newBalance;
  currentLifetimeEarned = spendResult.newLifetimeEarned;
  notes.push(...spendResult.notes);

  // 7. Update customer loyalty account atomically if any balance or counter changed
  if (redemptionRestored || spendResult.spendRewardReversed) {
    await tx.customer_loyalty_accounts.update({
      where: { id: account.id },
      data: {
        stars_balance: currentBalance,
        lifetime_stars_earned: currentLifetimeEarned,
        lifetime_stars_redeemed: currentLifetimeRedeemed,
        updated_at: new Date(),
      },
    });
  } else if (spendResult.outstandingSpendLiability === 0) {
    notes.push('Loyalty reversal already completed for this order (idempotent no-op).');
  }

  // 8. Dual-write to orders.unrecovered_loyalty_points atomically
  await tx.orders.update({
    where: { id: orderId },
    data: {
      unrecovered_loyalty_points: spendResult.outstandingSpendLiability,
    },
  });

  return {
    orderId,
    pointsRestored,
    pointsReversed: spendResult.pointsReversed,
    pointsAttemptedToReverse: spendResult.pointsAttemptedToReverse,
    outstandingSpendLiability: spendResult.outstandingSpendLiability,
    newBalance: currentBalance,
    redemptionRestored,
    spendRewardReversed: spendResult.spendRewardReversed,
    notes,
  };
}

/**
 * Authoritative, transactional recovery of outstanding cancellation loyalty liabilities.
 * - Enforces that order is already cancelled.
 * - Locks order and customer loyalty account rows FOR UPDATE before reading ledger.
 * - Reconstructs outstanding liability strictly from original spend reward and reversal adjustments.
 * - Deducts only up to customer's available balance (never negative).
 * - Decrements lifetime_stars_earned strictly by the newly recovered amount.
 * - Idempotent and safe to call repeatedly.
 * - Does not alter order status or create redundant status history entries.
 */
export async function recoverOrderLoyaltyLiability(
  tx: Prisma.TransactionClient,
  params: {
    orderId: string;
    orderNumber: string;
    restaurantId: string;
    customerId: string | null | undefined;
  }
): Promise<RecoverLoyaltyLiabilityResult> {
  const { orderId, orderNumber, restaurantId, customerId } = params;

  if (!customerId) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      orderNumber,
      customerId: '',
      pointsRecovered: 0,
      outstandingPointsRemaining: 0,
      isRecoveryComplete: true,
      currentStarsBalance: 0,
      notes: ['No customer associated with order; skipped loyalty recovery.'],
    };
  }

  const account = await tx.customer_loyalty_accounts.findUnique({
    where: {
      customer_id_restaurant_id: {
        customer_id: customerId,
        restaurant_id: restaurantId,
      },
    },
  });

  if (!account) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      orderNumber,
      customerId,
      pointsRecovered: 0,
      outstandingPointsRemaining: 0,
      isRecoveryComplete: true,
      currentStarsBalance: 0,
      notes: ['Customer loyalty account not found; skipped loyalty recovery.'],
    };
  }

  // Pre-lock customer loyalty account row under serialized lock
  const lockedAccounts: any[] = await tx.$queryRaw`
    SELECT id, stars_balance, lifetime_stars_earned, lifetime_stars_redeemed
    FROM customer_loyalty_accounts
    WHERE id = ${account.id}::uuid
    FOR UPDATE
  `;

  if (!lockedAccounts || lockedAccounts.length === 0) {
    throw new NotFoundError('Loyalty account not found for update');
  }

  const lockedAccount = lockedAccounts[0];
  const currentBalance = lockedAccount.stars_balance;
  const currentLifetimeEarned = lockedAccount.lifetime_stars_earned;

  // Read transactions under locks
  const orderTransactions = await tx.loyalty_transactions.findMany({
    where: { order_id: orderId },
  });

  const spendRewardTxs = orderTransactions.filter(
    (t) => t.transaction_type === 'visit_reward' && t.stars > 0
  );

  const redemptionTxs = orderTransactions.filter(
    (t) => t.transaction_type === 'redemption' && t.stars < 0
  );

  const knownTxIds = new Set<string>([
    ...redemptionTxs.map((t) => t.id),
    ...spendRewardTxs.map((t) => t.id),
  ]);
  validateOrderAdjustmentTags(orderTransactions, knownTxIds);

  if (spendRewardTxs.length === 0) {
    await tx.orders.update({
      where: { id: orderId },
      data: { unrecovered_loyalty_points: 0 },
    });
    return {
      orderId,
      orderNumber,
      customerId,
      pointsRecovered: 0,
      outstandingPointsRemaining: 0,
      isRecoveryComplete: true,
      currentStarsBalance: currentBalance,
      notes: ['No spend reward ledger entries found for order; no liability exists.'],
    };
  }

  // Execute shared spend reversal accounting with isRecovery = true
  const spendResult = await executeSpendReversalReconstructionAndDeduction({
    tx,
    accountId: account.id,
    customerId,
    restaurantId,
    orderId,
    orderNumber,
    spendRewardTxs,
    orderTransactions,
    currentBalance,
    currentLifetimeEarned,
    isRecovery: true,
  });

  if (spendResult.spendRewardReversed) {
    await tx.customer_loyalty_accounts.update({
      where: { id: account.id },
      data: {
        stars_balance: spendResult.newBalance,
        lifetime_stars_earned: spendResult.newLifetimeEarned,
        updated_at: new Date(),
      },
    });
  } else if (spendResult.outstandingSpendLiability === 0) {
    spendResult.notes.push('Recovery already complete; no outstanding liability remains.');
  } else {
    spendResult.notes.push(
      `Recovery attempted, but customer available balance is ${currentBalance}; remaining liability is ${spendResult.outstandingSpendLiability}.`
    );
  }

  // Synchronize orders.unrecovered_loyalty_points atomically
  await tx.orders.update({
    where: { id: orderId },
    data: {
      unrecovered_loyalty_points: spendResult.outstandingSpendLiability,
    },
  });

  return {
    orderId,
    orderNumber,
    customerId,
    pointsRecovered: spendResult.pointsReversed,
    outstandingPointsRemaining: spendResult.outstandingSpendLiability,
    isRecoveryComplete: spendResult.outstandingSpendLiability === 0,
    currentStarsBalance: spendResult.newBalance,
    notes: spendResult.notes,
  };
}

/**
 * Authoritative, bounded discovery query for cancelled orders with outstanding loyalty liability.
 * Reconstructs liability dynamically from ledger adjustment tags; never trusts stale notes.
 * Enforces restaurant tenancy and bounded pagination.
 */
export async function listCancelledOrdersWithOutstandingLoyaltyLiability(
  restaurantId: string,
  options: {
    page?: number;
    limit?: number;
    branchId?: string;
    unrecoveredOnly?: boolean;
  } = {}
): Promise<ListLoyaltyLiabilitiesResult> {
  const page = options.page && options.page > 0 ? options.page : 1;
  const limit = options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 20;
  const skip = (page - 1) * limit;
  const unrecoveredOnly = options.unrecoveredOnly !== false;

  const where: Prisma.ordersWhereInput = {
    restaurant_id: restaurantId,
    status: 'cancelled',
    loyalty_transactions: {
      some: {
        transaction_type: 'visit_reward',
        stars: { gt: 0 },
      },
    },
  };

  if (options.branchId) {
    where.branch_id = options.branchId;
  }

  const candidateOrders = await prisma.orders.findMany({
    where,
    include: {
      customers: {
        select: {
          id: true,
          name: true,
          phone: true,
          customer_loyalty_accounts: {
            where: { restaurant_id: restaurantId },
            select: { stars_balance: true },
          },
        },
      },
      branches: {
        select: { id: true, name: true },
      },
      loyalty_transactions: {
        select: {
          id: true,
          transaction_type: true,
          stars: true,
          description: true,
          created_at: true,
        },
      },
    },
    orderBy: [{ ordered_at: 'desc' }, { id: 'desc' }],
  });

  const allSummaries: CancelledOrderLiabilitySummary[] = [];
  let totalOutstandingPoints = 0;
  let ordersWithOutstandingLiability = 0;

  // Group customer wallets by customer ID for venue-wide recoverability calculation.
  // Each customer has at most one loyalty account per restaurant.
  const customerWallets = new Map<string, { walletBalance: number; totalOutstandingLiability: number }>();

  for (const order of candidateOrders) {
    const txs = order.loyalty_transactions;
    const spendRewardTxs = txs.filter((t) => t.transaction_type === 'visit_reward' && t.stars > 0);
    const adjustmentTxs = txs.filter((t) => t.transaction_type === 'adjustment' && t.stars < 0);

    let totalEarned = 0;
    let totalReversed = 0;
    let orderOutstanding = 0;

    for (const spendTx of spendRewardTxs) {
      totalEarned += spendTx.stars;
      const reversedForTx = adjustmentTxs
        .filter((t) => isReversalForTx(t.description, spendTx.id))
        .reduce((sum, t) => sum + Math.abs(t.stars), 0);
      totalReversed += reversedForTx;
      const unreversed = Math.max(0, spendTx.stars - reversedForTx);
      orderOutstanding += unreversed;
    }

    const rawBalance = order.customers?.customer_loyalty_accounts?.[0]?.stars_balance;
    const customerBalance = typeof rawBalance === 'number' && rawBalance > 0 ? rawBalance : 0;
    const canRecoverNow = customerBalance > 0 && orderOutstanding > 0;
    const recoverablePoints = Math.min(customerBalance, orderOutstanding);

    if (orderOutstanding > 0) {
      ordersWithOutstandingLiability++;
      totalOutstandingPoints += orderOutstanding;

      const customerId = order.customer_id || order.id;
      const existingWallet = customerWallets.get(customerId);
      if (existingWallet) {
        existingWallet.totalOutstandingLiability += orderOutstanding;
        if (existingWallet.walletBalance === 0 && customerBalance > 0) {
          existingWallet.walletBalance = customerBalance;
        }
      } else {
        customerWallets.set(customerId, {
          walletBalance: customerBalance,
          totalOutstandingLiability: orderOutstanding,
        });
      }
    }

    allSummaries.push({
      orderId: order.id,
      orderNumber: order.order_number,
      branchId: order.branch_id,
      branchName: order.branches?.name ?? null,
      customerId: order.customer_id,
      customerName: order.customers?.name ?? null,
      customerPhone: order.customers?.phone ?? null,
      orderedAt: order.ordered_at.toISOString(),
      totalEarnedPoints: totalEarned,
      totalReversedPoints: totalReversed,
      outstandingLiability: orderOutstanding,
      customerCurrentBalance: customerBalance,
      canRecoverNow,
      recoverablePoints,
      isRecoveryComplete: orderOutstanding === 0,
    });
  }

  // Count that wallet's available balance only once across all of that customer's matching orders:
  // customerRecoverableNow = min(nonNegativeWalletBalance, customerTotalOutstandingLiability)
  let totalRecoverablePointsNow = 0;
  for (const wallet of customerWallets.values()) {
    const customerRecoverableNow = Math.min(wallet.walletBalance, wallet.totalOutstandingLiability);
    totalRecoverablePointsNow += customerRecoverableNow;
  }

  const matchingOrders = unrecoveredOnly
    ? allSummaries.filter((o) => o.outstandingLiability > 0)
    : allSummaries;

  const totalCount = matchingOrders.length;
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  const paginatedOrders = matchingOrders.slice(skip, skip + limit);

  return {
    orders: paginatedOrders,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
    summary: {
      totalCandidateOrders: candidateOrders.length,
      ordersWithOutstandingLiability,
      totalOutstandingPoints,
      totalRecoverablePointsNow,
    },
  };
}

export interface OwnerLoyaltyAccountItem {
  id: string;
  customerId: string;
  customerName: string;
  starsBalance: number;
  lifetimeStarsEarned: number;
  lifetimeStarsRedeemed: number;
  tier: string;
  status: string;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerLoyaltyAccountsSummary {
  totalEnrolledAccounts: number;
  activeAccounts: number;
  totalPointsInCirculation: number;
  totalLifetimePointsEarned: number;
  totalLifetimePointsRedeemed: number;
}

export interface OwnerLoyaltyAccountsResponse {
  restaurantId: string;
  summary: OwnerLoyaltyAccountsSummary;
  accounts: OwnerLoyaltyAccountItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface OwnerLoyaltyTransactionItem {
  id: string;
  transactionType: string;
  stars: number;
  description: string | null;
  orderId: string | null;
  orderNumber: string | null;
  feedbackId: string | null;
  createdAt: string;
}

export interface OwnerLoyaltyAccountDetailResponse {
  restaurantId: string;
  account: {
    id: string;
    customerId: string;
    customerName: string;
    restaurantId: string;
    loyaltyProgramId: string;
    programName: string;
    starsBalance: number;
    lifetimeStarsEarned: number;
    lifetimeStarsRedeemed: number;
    tier: string;
    status: string;
    joinedAt: string;
    createdAt: string;
    updatedAt: string;
  };
  transactions: OwnerLoyaltyTransactionItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

/**
 * Retrieves paginated customer loyalty accounts and aggregate balance metrics
 * for an authorized restaurant owner.
 * Strictly tenant-scoped: only accounts belonging to `restaurantId` are queried.
 * Privacy-safe: customer phone numbers, OTPs, and authentication credentials are never queried or returned.
 */
export async function getOwnerLoyaltyAccounts(
  restaurantId: string,
  query: OwnerLoyaltyAccountsQueryInput
): Promise<OwnerLoyaltyAccountsResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  // 1. Build base tenant-isolated filter
  const where: Prisma.customer_loyalty_accountsWhereInput = {
    restaurant_id: restaurantId,
  };

  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }

  if (query.search && query.search.trim()) {
    where.customers = {
      name: {
        contains: query.search.trim(),
        mode: 'insensitive',
      },
    };
  }

  // 2. Summary scope across the authorized restaurant (unfiltered by search to provide stable KPIs)
  const summaryScopeWhere: Prisma.customer_loyalty_accountsWhereInput = {
    restaurant_id: restaurantId,
  };

  const [
    accounts,
    totalFilteredCount,
    totalEnrolled,
    activeAccounts,
    pointsAgg,
  ] = await Promise.all([
    prisma.customer_loyalty_accounts.findMany({
      where,
      select: {
        id: true,
        customer_id: true,
        stars_balance: true,
        lifetime_stars_earned: true,
        lifetime_stars_redeemed: true,
        tier: true,
        status: true,
        joined_at: true,
        created_at: true,
        updated_at: true,
        customers: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: [
        { created_at: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.customer_loyalty_accounts.count({ where }),
    prisma.customer_loyalty_accounts.count({ where: summaryScopeWhere }),
    prisma.customer_loyalty_accounts.count({
      where: { ...summaryScopeWhere, status: 'active' },
    }),
    prisma.customer_loyalty_accounts.aggregate({
      where: summaryScopeWhere,
      _sum: {
        stars_balance: true,
        lifetime_stars_earned: true,
        lifetime_stars_redeemed: true,
      },
    }),
  ]);

  const totalPages = totalFilteredCount === 0 ? 0 : Math.ceil(totalFilteredCount / limit);

  return {
    restaurantId,
    summary: {
      totalEnrolledAccounts: totalEnrolled,
      activeAccounts,
      totalPointsInCirculation: pointsAgg._sum.stars_balance ?? 0,
      totalLifetimePointsEarned: pointsAgg._sum.lifetime_stars_earned ?? 0,
      totalLifetimePointsRedeemed: pointsAgg._sum.lifetime_stars_redeemed ?? 0,
    },
    accounts: accounts.map((acc) => ({
      id: acc.id,
      customerId: acc.customer_id,
      customerName: acc.customers?.name?.trim() || 'Dine-in Customer',
      starsBalance: acc.stars_balance,
      lifetimeStarsEarned: acc.lifetime_stars_earned,
      lifetimeStarsRedeemed: acc.lifetime_stars_redeemed,
      tier: acc.tier,
      status: acc.status,
      joinedAt: acc.joined_at.toISOString(),
      createdAt: acc.created_at.toISOString(),
      updatedAt: acc.updated_at.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalCount: totalFilteredCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Retrieves an individual customer loyalty account profile and bounded transaction ledger
 * for an authorized restaurant owner.
 * Strictly tenant-scoped: requires matching `restaurant_id` in database query.
 * Throws ForbiddenError if account belongs to another restaurant.
 * Throws NotFoundError if account does not exist.
 */
export async function getOwnerLoyaltyAccountDetail(
  restaurantId: string,
  accountId: string,
  query: OwnerLoyaltyAccountDetailQueryInput
): Promise<OwnerLoyaltyAccountDetailResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  // 1. Fetch account with mandatory restaurant tenancy
  const account = await prisma.customer_loyalty_accounts.findFirst({
    where: {
      id: accountId,
      restaurant_id: restaurantId,
    },
    select: {
      id: true,
      customer_id: true,
      restaurant_id: true,
      loyalty_program_id: true,
      stars_balance: true,
      lifetime_stars_earned: true,
      lifetime_stars_redeemed: true,
      tier: true,
      status: true,
      joined_at: true,
      created_at: true,
      updated_at: true,
      customers: {
        select: {
          id: true,
          name: true,
        },
      },
      loyalty_programs: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!account) {
    // Check if account exists under another restaurant to return 403 Forbidden vs 404 Not Found
    const existsElsewhere = await prisma.customer_loyalty_accounts.findUnique({
      where: { id: accountId },
      select: { id: true, restaurant_id: true },
    });

    if (existsElsewhere) {
      throw new ForbiddenError(
        'Access forbidden: Requested loyalty account does not belong to the authorized restaurant'
      );
    }

    throw new NotFoundError('Loyalty account not found');
  }

  // 2. Fetch bounded, newest-first transactions ledger
  const txWhere: Prisma.loyalty_transactionsWhereInput = {
    loyalty_account_id: accountId,
    restaurant_id: restaurantId,
  };

  const [rawTransactions, totalTransactions] = await Promise.all([
    prisma.loyalty_transactions.findMany({
      where: txWhere,
      select: {
        id: true,
        transaction_type: true,
        stars: true,
        description: true,
        order_id: true,
        feedback_id: true,
        created_at: true,
        orders: {
          select: {
            id: true,
            order_number: true,
          },
        },
      },
      orderBy: [
        { created_at: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.loyalty_transactions.count({ where: txWhere }),
  ]);

  const totalPages = totalTransactions === 0 ? 0 : Math.ceil(totalTransactions / limit);

  return {
    restaurantId,
    account: {
      id: account.id,
      customerId: account.customer_id,
      customerName: account.customers?.name?.trim() || 'Dine-in Customer',
      restaurantId: account.restaurant_id,
      loyaltyProgramId: account.loyalty_program_id,
      programName: account.loyalty_programs?.name || 'Dining Rewards',
      starsBalance: account.stars_balance,
      lifetimeStarsEarned: account.lifetime_stars_earned,
      lifetimeStarsRedeemed: account.lifetime_stars_redeemed,
      tier: account.tier,
      status: account.status,
      joinedAt: account.joined_at.toISOString(),
      createdAt: account.created_at.toISOString(),
      updatedAt: account.updated_at.toISOString(),
    },
    transactions: rawTransactions.map((tx) => ({
      id: tx.id,
      transactionType: tx.transaction_type,
      stars: tx.stars,
      description: tx.description,
      orderId: tx.order_id,
      orderNumber: tx.orders?.order_number || null,
      feedbackId: tx.feedback_id,
      createdAt: tx.created_at.toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalCount: totalTransactions,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

// ==========================================
// Owner Reward Catalogue Services
// ==========================================

export interface OwnerRewardSummary {
  id: string;
  restaurantId: string;
  loyaltyProgramId: string;
  name: string;
  description: string | null;
  rewardType: string;
  starsRequired: number;
  discountAmount: number | null;
  discountPercentage: number | null;
  productId: string | null;
  productName: string | null;
  redemptionLimit: number | null;
  redemptionCount: number;
  validFrom: string;
  validUntil: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OwnerRewardsListResponse {
  restaurantId: string;
  rewards: OwnerRewardSummary[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface OwnerRewardRedemptionItem {
  id: string;
  rewardId: string;
  rewardName: string;
  customerId: string;
  customerName: string;
  orderId: string | null;
  orderNumber: string | null;
  starsRedeemed: number;
  status: string;
  notes: string | null;
  redeemedAt: string;
  createdAt: string;
}

export interface OwnerRewardRedemptionsListResponse {
  restaurantId: string;
  rewardId: string;
  rewardName: string;
  redemptions: OwnerRewardRedemptionItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

function formatOwnerReward(r: {
  id: string;
  restaurant_id: string;
  loyalty_program_id: string;
  name: string;
  description: string | null;
  reward_type: string;
  stars_required: number;
  discount_amount: Prisma.Decimal | number | null;
  discount_percentage: Prisma.Decimal | number | null;
  product_id: string | null;
  redemption_limit: number | null;
  redemption_count: number;
  valid_from: Date | string;
  valid_until: Date | string | null;
  is_active: boolean;
  created_at: Date | string;
  updated_at: Date | string;
  products?: { id: string; name: string } | null;
}): OwnerRewardSummary {
  return {
    id: r.id,
    restaurantId: r.restaurant_id,
    loyaltyProgramId: r.loyalty_program_id,
    name: r.name,
    description: r.description ?? null,
    rewardType: r.reward_type,
    starsRequired: r.stars_required,
    discountAmount:
      r.discount_amount !== null && r.discount_amount !== undefined
        ? Number(r.discount_amount)
        : null,
    discountPercentage:
      r.discount_percentage !== null && r.discount_percentage !== undefined
        ? Number(r.discount_percentage)
        : null,
    productId: r.product_id ?? null,
    productName: r.products?.name ?? null,
    redemptionLimit: r.redemption_limit ?? null,
    redemptionCount: r.redemption_count ?? 0,
    validFrom:
      r.valid_from instanceof Date
        ? r.valid_from.toISOString()
        : new Date(r.valid_from).toISOString(),
    validUntil: r.valid_until
      ? r.valid_until instanceof Date
        ? r.valid_until.toISOString()
        : new Date(r.valid_until).toISOString()
      : null,
    isActive: r.is_active,
    createdAt:
      r.created_at instanceof Date
        ? r.created_at.toISOString()
        : new Date(r.created_at).toISOString(),
    updatedAt:
      r.updated_at instanceof Date
        ? r.updated_at.toISOString()
        : new Date(r.updated_at).toISOString(),
  };
}

/**
 * Lists rewards for an authorized restaurant owner with optional active/inactive status filter and pagination.
 */
export async function getOwnerLoyaltyRewards(
  restaurantId: string,
  query: OwnerRewardsQueryInput
): Promise<OwnerRewardsListResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  const where: Prisma.loyalty_rewardsWhereInput = {
    restaurant_id: restaurantId,
  };

  if (query.status === 'active') {
    where.is_active = true;
  } else if (query.status === 'inactive') {
    where.is_active = false;
  }
  // status === 'all' or undefined includes both active and inactive

  const [rawRewards, totalCount] = await Promise.all([
    prisma.loyalty_rewards.findMany({
      where,
      include: {
        products: {
          select: { id: true, name: true },
        },
      },
      orderBy: [
        { is_active: 'desc' },
        { created_at: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.loyalty_rewards.count({ where }),
  ]);

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);

  return {
    restaurantId,
    rewards: rawRewards.map(formatOwnerReward),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

/**
 * Creates a new catalogue reward for an authorized restaurant owner.
 */
export async function createOwnerLoyaltyReward(
  restaurantId: string,
  input: CreateRewardInput
): Promise<OwnerRewardSummary> {
  // 1. Ensure loyalty program exists for restaurant
  const program = await getOrCreateRestaurantLoyaltyProgram(restaurantId);

  // 2. Validate product ownership if productId provided
  if (input.productId) {
    const product = await prisma.products.findFirst({
      where: {
        id: input.productId,
        restaurant_id: restaurantId,
      },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new ValidationError('Product does not belong to this restaurant or does not exist');
    }
  }

  // 3. Parse valid dates
  const validFrom = input.validFrom ? new Date(input.validFrom) : new Date();
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;

  if (validUntil && validUntil.getTime() <= validFrom.getTime()) {
    throw new ValidationError('validUntil must be later than validFrom');
  }

  // 4. Create reward record
  const created = await prisma.loyalty_rewards.create({
    data: {
      restaurant_id: restaurantId,
      loyalty_program_id: program.id,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      reward_type: input.rewardType,
      stars_required: input.starsRequired,
      discount_amount:
        input.discountAmount !== undefined && input.discountAmount !== null
          ? new Prisma.Decimal(input.discountAmount.toFixed(2))
          : null,
      discount_percentage:
        input.discountPercentage !== undefined && input.discountPercentage !== null
          ? new Prisma.Decimal(input.discountPercentage.toFixed(2))
          : null,
      product_id: input.productId || null,
      redemption_limit: input.redemptionLimit || null,
      redemption_count: 0,
      valid_from: validFrom,
      valid_until: validUntil,
      is_active: input.isActive ?? true,
    },
    include: {
      products: {
        select: { id: true, name: true },
      },
    },
  });

  return formatOwnerReward(created);
}

/**
 * Updates an existing catalogue reward for an authorized restaurant owner.
 * Disallows updating server-managed fields and enforces soft deactivation instead of hard deletion.
 */
export async function updateOwnerLoyaltyReward(
  restaurantId: string,
  rewardId: string,
  input: UpdateRewardInput
): Promise<OwnerRewardSummary> {
  // 1. Verify existence and restaurant ownership
  const existing = await prisma.loyalty_rewards.findFirst({
    where: {
      id: rewardId,
      restaurant_id: restaurantId,
    },
  });

  if (!existing) {
    throw new NotFoundError('Loyalty reward not found');
  }

  // 2. Validate product ownership if productId provided
  if (input.productId) {
    const product = await prisma.products.findFirst({
      where: {
        id: input.productId,
        restaurant_id: restaurantId,
      },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new ValidationError('Product does not belong to this restaurant or does not exist');
    }
  }

  // 3. Validate date logic against existing validFrom
  if (input.validUntil !== undefined && input.validUntil !== null) {
    const untilDate = new Date(input.validUntil);
    const fromDate =
      existing.valid_from instanceof Date ? existing.valid_from : new Date(existing.valid_from);
    if (untilDate.getTime() <= fromDate.getTime()) {
      throw new ValidationError('validUntil must be later than validFrom');
    }
  }

  // 4. Validate field compatibility with existing reward_type
  if (existing.reward_type === 'free_product') {
    if (input.discountAmount !== undefined && input.discountAmount !== null) {
      throw new ValidationError('discountAmount cannot be specified for free_product reward type');
    }
    if (input.discountPercentage !== undefined && input.discountPercentage !== null) {
      throw new ValidationError(
        'discountPercentage cannot be specified for free_product reward type'
      );
    }
  } else if (existing.reward_type === 'fixed_discount') {
    if (input.productId !== undefined && input.productId !== null) {
      throw new ValidationError('productId cannot be specified for fixed_discount reward type');
    }
    if (input.discountPercentage !== undefined && input.discountPercentage !== null) {
      throw new ValidationError(
        'discountPercentage cannot be specified for fixed_discount reward type'
      );
    }
    if (
      input.discountAmount !== undefined &&
      (input.discountAmount === null || input.discountAmount <= 0)
    ) {
      throw new ValidationError(
        'discountAmount must be a positive number for fixed_discount reward type'
      );
    }
  } else if (existing.reward_type === 'percentage_discount') {
    if (input.productId !== undefined && input.productId !== null) {
      throw new ValidationError(
        'productId cannot be specified for percentage_discount reward type'
      );
    }
    if (input.discountAmount !== undefined && input.discountAmount !== null) {
      throw new ValidationError(
        'discountAmount cannot be specified for percentage_discount reward type'
      );
    }
    if (
      input.discountPercentage !== undefined &&
      (input.discountPercentage === null ||
        input.discountPercentage <= 0 ||
        input.discountPercentage > 100)
    ) {
      throw new ValidationError(
        'discountPercentage must be between 0.01 and 100 for percentage_discount reward type'
      );
    }
  }

  // 5. Build update data (strictly server-managed fields excluded)
  const updateData: Prisma.loyalty_rewardsUpdateInput = {
    updated_at: new Date(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name.trim();
  }
  if (input.description !== undefined) {
    updateData.description = input.description?.trim() || null;
  }
  if (input.starsRequired !== undefined) {
    updateData.stars_required = input.starsRequired;
  }
  if (input.discountAmount !== undefined) {
    updateData.discount_amount =
      input.discountAmount !== null
        ? new Prisma.Decimal(input.discountAmount.toFixed(2))
        : null;
  }
  if (input.discountPercentage !== undefined) {
    updateData.discount_percentage =
      input.discountPercentage !== null
        ? new Prisma.Decimal(input.discountPercentage.toFixed(2))
        : null;
  }
  if (input.productId !== undefined) {
    updateData.products = input.productId
      ? { connect: { id: input.productId } }
      : { disconnect: true };
  }
  if (input.redemptionLimit !== undefined) {
    updateData.redemption_limit = input.redemptionLimit;
  }
  if (input.validUntil !== undefined) {
    updateData.valid_until = input.validUntil ? new Date(input.validUntil) : null;
  }
  if (input.isActive !== undefined) {
    updateData.is_active = input.isActive;
  }

  const updated = await prisma.loyalty_rewards.update({
    where: { id: rewardId },
    data: updateData,
    include: {
      products: {
        select: { id: true, name: true },
      },
    },
  });

  return formatOwnerReward(updated);
}

/**
 * Lists redemptions for a specific catalogue reward for an authorized restaurant owner.
 * Never exposes customer phone numbers or sensitive credentials.
 */
export async function getOwnerRewardRedemptions(
  restaurantId: string,
  rewardId: string,
  query: OwnerRewardRedemptionsQueryInput
): Promise<OwnerRewardRedemptionsListResponse> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 20;
  const skip = (page - 1) * limit;

  // 1. Verify reward exists and belongs to authorized restaurant
  const reward = await prisma.loyalty_rewards.findFirst({
    where: {
      id: rewardId,
      restaurant_id: restaurantId,
    },
    select: {
      id: true,
      name: true,
    },
  });

  if (!reward) {
    throw new NotFoundError('Loyalty reward not found');
  }

  // 2. Query redemptions
  const where: Prisma.loyalty_redemptionsWhereInput = {
    reward_id: rewardId,
    restaurant_id: restaurantId,
  };

  if (query.status && query.status !== 'all') {
    where.status = query.status;
  }

  const [rawRedemptions, totalCount] = await Promise.all([
    prisma.loyalty_redemptions.findMany({
      where,
      include: {
        customers: {
          select: {
            id: true,
            name: true, // Never select phone numbers, tokens, or OTPs
          },
        },
        orders: {
          select: {
            id: true,
            order_number: true,
          },
        },
      },
      orderBy: [
        { redeemed_at: 'desc' },
        { id: 'desc' },
      ],
      skip,
      take: limit,
    }),
    prisma.loyalty_redemptions.count({ where }),
  ]);

  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);

  return {
    restaurantId,
    rewardId: reward.id,
    rewardName: reward.name,
    redemptions: rawRedemptions.map((r) => ({
      id: r.id,
      rewardId: r.reward_id,
      rewardName: reward.name,
      customerId: r.customer_id,
      customerName: r.customers?.name?.trim() || 'Dine-in Customer',
      orderId: r.order_id,
      orderNumber: r.orders?.order_number || null,
      starsRedeemed: r.stars_redeemed,
      status: r.status,
      notes: r.notes,
      redeemedAt:
        r.redeemed_at instanceof Date
          ? r.redeemed_at.toISOString()
          : new Date(r.redeemed_at).toISOString(),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : new Date(r.created_at).toISOString(),
    })),
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}
