import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listRewardsHandler, POST as createRewardHandler } from '@/app/api/v1/owner/loyalty/rewards/route';
import { PATCH as updateRewardHandler } from '@/app/api/v1/owner/loyalty/rewards/[id]/route';
import { GET as getRewardRedemptionsHandler } from '@/app/api/v1/owner/loyalty/rewards/[id]/redemptions/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { prisma } from '@/lib/db/prisma';
import { AuthenticationError, ForbiddenError } from '@/lib/http/errors';
import { Prisma } from '@prisma/client';

vi.mock('@/lib/auth/tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tenancy')>();
  return {
    ...actual,
    requireAuthorizedRestaurant: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    loyalty_rewards: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    loyalty_redemptions: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    loyalty_programs: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    products: {
      findFirst: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 8K: Owner Loyalty Rewards Catalogue API', () => {
  const authorizedRestaurantId = '11111111-1111-4111-8111-111111111111';
  const unauthorizedRestaurantId = '99999999-9999-4999-8999-999999999999';
  const mockRewardId1 = 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const mockRewardId2 = 'bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const foreignRewardId = 'ffff3333-ffff-4fff-8fff-ffffffffffff';
  const mockProductId = 'e1111111-1111-4111-8111-111111111111';

  const mockReward1 = {
    id: mockRewardId1,
    restaurant_id: authorizedRestaurantId,
    name: 'Free Tiramisu Dessert',
    description: 'Complimentary artisan dessert for dessert lovers',
    reward_type: 'free_product',
    stars_required: 150,
    discount_amount: null,
    discount_percentage: null,
    product_id: mockProductId,
    redemption_limit: 100,
    redemption_count: 14,
    valid_from: new Date('2026-01-01T00:00:00.000Z'),
    valid_until: new Date('2026-12-31T23:59:59.000Z'),
    is_active: true,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-06-01T00:00:00.000Z'),
    products: {
      id: mockProductId,
      name: 'Tiramisu Classico',
    },
  };

  const mockReward2 = {
    id: mockRewardId2,
    restaurant_id: authorizedRestaurantId,
    name: '15% Off Your Meal',
    description: 'Save 15% on dining experience',
    reward_type: 'percentage_discount',
    stars_required: 200,
    discount_amount: null,
    discount_percentage: new Prisma.Decimal('15.00'),
    product_id: null,
    redemption_limit: null,
    redemption_count: 5,
    valid_from: new Date('2026-02-01T00:00:00.000Z'),
    valid_until: null,
    is_active: false,
    created_at: new Date('2026-02-01T00:00:00.000Z'),
    updated_at: new Date('2026-07-01T00:00:00.000Z'),
    products: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuthorizedRestaurant).mockResolvedValue({
      owner: { id: 'owner-uuid-1', role: 'RESTAURANT_OWNER' } as any,
      restaurant: {
        id: authorizedRestaurantId,
        name: 'The Rustic Hearth',
        owner_id: 'owner-uuid-1',
      } as any,
      branches: [],
    } as any);

    vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue({
      id: 'prog-1111-1111-1111-111111111111',
      restaurant_id: authorizedRestaurantId,
      points_per_currency: new Prisma.Decimal('1.0'),
      is_active: true,
    } as any);
  });

  // ===========================================================================
  // 1. Authentication & Tenancy Authorization (401 & 403)
  // ===========================================================================
  describe('Authentication & Authorization', () => {
    it('1. Rejects unauthenticated requests with 401 Unauthorized', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Authentication required')
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards');
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('2. Rejects unauthorized / customer-role caller with 403 Forbidden', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError('Only restaurant owners may access this resource')
      );

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards');
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('3. Rejects cross-tenant access when owner attempts to query another restaurant', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError('You are not authorized to access this restaurant')
      );

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards?restaurantId=${unauthorizedRestaurantId}`
      );
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(403);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('not authorized');
    });
  });

  // ===========================================================================
  // 2. Retrieval of Rewards Catalogue (GET /api/v1/owner/loyalty/rewards)
  // ===========================================================================
  describe('GET /api/v1/owner/loyalty/rewards', () => {
    it('4. Retrieves catalogue list with pagination metadata', async () => {
      vi.mocked(prisma.loyalty_rewards.findMany).mockResolvedValueOnce([mockReward1, mockReward2] as any);
      vi.mocked(prisma.loyalty_rewards.count).mockResolvedValueOnce(2);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards?restaurantId=${authorizedRestaurantId}&page=1&limit=20`
      );
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.restaurantId).toBe(authorizedRestaurantId);
      expect(json.data.rewards).toHaveLength(2);
      expect(json.data.rewards[0].id).toBe(mockRewardId1);
      expect(json.data.rewards[0].productName).toBe('Tiramisu Classico');
      expect(json.data.rewards[0].starsRequired).toBe(150);
      expect(json.data.rewards[1].discountPercentage).toBe(15);
      expect(json.data.pagination).toEqual({
        page: 1,
        limit: 20,
        totalCount: 2,
        totalPages: 1,
        hasNextPage: false,
        hasPrevPage: false,
      });

      expect(prisma.loyalty_rewards.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: authorizedRestaurantId,
          }),
        })
      );
    });

    it('5. Filters rewards by status: active-only', async () => {
      vi.mocked(prisma.loyalty_rewards.findMany).mockResolvedValueOnce([mockReward1] as any);
      vi.mocked(prisma.loyalty_rewards.count).mockResolvedValueOnce(1);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards?status=active`
      );
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.rewards).toHaveLength(1);
      expect(json.data.rewards[0].isActive).toBe(true);

      expect(prisma.loyalty_rewards.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: authorizedRestaurantId,
            is_active: true,
          }),
        })
      );
    });

    it('6. Filters rewards by status: inactive-only', async () => {
      vi.mocked(prisma.loyalty_rewards.findMany).mockResolvedValueOnce([mockReward2] as any);
      vi.mocked(prisma.loyalty_rewards.count).mockResolvedValueOnce(1);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards?status=inactive`
      );
      const response = await listRewardsHandler(req);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.rewards).toHaveLength(1);
      expect(json.data.rewards[0].isActive).toBe(false);

      expect(prisma.loyalty_rewards.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            restaurant_id: authorizedRestaurantId,
            is_active: false,
          }),
        })
      );
    });
  });

  // ===========================================================================
  // 3. Reward Creation (POST /api/v1/owner/loyalty/rewards)
  // ===========================================================================
  describe('POST /api/v1/owner/loyalty/rewards', () => {
    it('7. Creates a free_product reward successfully', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValueOnce({
        id: mockProductId,
        restaurant_id: authorizedRestaurantId,
        name: 'Tiramisu Classico',
      } as any);

      vi.mocked(prisma.loyalty_rewards.create).mockResolvedValueOnce(mockReward1 as any);

      const payload = {
        name: 'Free Tiramisu Dessert',
        description: 'Complimentary artisan dessert for dessert lovers',
        rewardType: 'free_product',
        starsRequired: 150,
        productId: mockProductId,
        redemptionLimit: 100,
        validFrom: '2026-01-01T00:00:00.000Z',
        validUntil: '2026-12-31T23:59:59.000Z',
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.id).toBe(mockRewardId1);
      expect(json.data.rewardType).toBe('free_product');
      expect(json.data.productName).toBe('Tiramisu Classico');

      expect(prisma.loyalty_rewards.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            restaurant_id: authorizedRestaurantId,
            name: 'Free Tiramisu Dessert',
            reward_type: 'free_product',
            stars_required: 150,
            product_id: mockProductId,
          }),
        })
      );
    });

    it('8. Creates a fixed_discount reward successfully', async () => {
      const fixedReward = {
        ...mockReward1,
        id: '22222222-2222-4222-8222-222222222222',
        name: '$10 Off Bill',
        reward_type: 'fixed_discount',
        discount_amount: new Prisma.Decimal('10.00'),
        discount_percentage: null,
        product_id: null,
        products: null,
      };

      vi.mocked(prisma.loyalty_rewards.create).mockResolvedValueOnce(fixedReward as any);

      const payload = {
        name: '$10 Off Bill',
        rewardType: 'fixed_discount',
        starsRequired: 100,
        discountAmount: 10.0,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.rewardType).toBe('fixed_discount');
      expect(json.data.discountAmount).toBe(10);
    });

    it('9. Creates a percentage_discount reward successfully', async () => {
      vi.mocked(prisma.loyalty_rewards.create).mockResolvedValueOnce(mockReward2 as any);

      const payload = {
        name: '15% Off Your Meal',
        rewardType: 'percentage_discount',
        starsRequired: 200,
        discountPercentage: 15.0,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.success).toBe(true);
      expect(json.data.rewardType).toBe('percentage_discount');
      expect(json.data.discountPercentage).toBe(15);
    });

    it('10. Fails validation when missing required fields (e.g. name or starsRequired)', async () => {
      const invalidPayload = {
        description: 'Missing name and starsRequired',
        rewardType: 'fixed_discount',
        discountAmount: 5,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error).toBeDefined();
    });

    it('11. Fails validation when discountAmount is supplied on free_product', async () => {
      const invalidPayload = {
        name: 'Illegal Free Product with Cash Discount',
        rewardType: 'free_product',
        starsRequired: 100,
        productId: mockProductId,
        discountAmount: 15,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      const detailsStr = JSON.stringify(json.error);
      expect(detailsStr).toContain('discountAmount cannot be specified for free_product');
    });

    it('12. Fails validation when percentage is invalid (> 100 or <= 0)', async () => {
      const invalidPayload = {
        name: 'Over 100 Percent Discount',
        rewardType: 'percentage_discount',
        starsRequired: 100,
        discountPercentage: 150,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      const detailsStr = JSON.stringify(json.error);
      expect(detailsStr).toContain('100');
    });

    it('13. Rejects creation if productId does not belong to authorized restaurant', async () => {
      vi.mocked(prisma.products.findFirst).mockResolvedValueOnce(null);

      const foreignProductId = '88888888-8888-4888-8888-888888888888';
      const foreignProductPayload = {
        name: 'Foreign Item Reward',
        rewardType: 'free_product',
        starsRequired: 100,
        productId: foreignProductId,
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(foreignProductPayload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('Product not found in this restaurant');
    });

    it('14. Fails validation when validUntil is earlier than validFrom', async () => {
      const invertedDatePayload = {
        name: 'Time Travel Reward',
        rewardType: 'fixed_discount',
        starsRequired: 50,
        discountAmount: 5,
        validFrom: '2026-10-01T00:00:00.000Z',
        validUntil: '2026-09-01T00:00:00.000Z',
      };

      const req = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rewards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invertedDatePayload),
      });

      const response = await createRewardHandler(req);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.success).toBe(false);
      const detailsStr = JSON.stringify(json.error);
      expect(detailsStr).toContain('validUntil cannot be earlier than validFrom');
    });
  });

  // ===========================================================================
  // 4. Reward Updates & Deactivation (PATCH /api/v1/owner/loyalty/rewards/[id])
  // ===========================================================================
  describe('PATCH /api/v1/owner/loyalty/rewards/[id]', () => {
    it('15. Updates reward name and starsRequired successfully', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce(mockReward1 as any);
      vi.mocked(prisma.loyalty_rewards.update).mockResolvedValueOnce({
        ...mockReward1,
        name: 'Deluxe Tiramisu',
        stars_required: 180,
      } as any);

      const updatePayload = {
        name: 'Deluxe Tiramisu',
        starsRequired: 180,
      };

      const req = new NextRequest(`http://localhost:3000/api/v1/owner/loyalty/rewards/${mockRewardId1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const response = await updateRewardHandler(req, { params: Promise.resolve({ id: mockRewardId1 }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.name).toBe('Deluxe Tiramisu');
      expect(json.data.starsRequired).toBe(180);

      expect(prisma.loyalty_rewards.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockRewardId1 },
          data: expect.objectContaining({
            name: 'Deluxe Tiramisu',
            stars_required: 180,
          }),
        })
      );
    });

    it('16. Soft-deactivates a reward (isActive: false)', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce(mockReward1 as any);
      vi.mocked(prisma.loyalty_rewards.update).mockResolvedValueOnce({
        ...mockReward1,
        is_active: false,
      } as any);

      const updatePayload = {
        isActive: false,
      };

      const req = new NextRequest(`http://localhost:3000/api/v1/owner/loyalty/rewards/${mockRewardId1}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const response = await updateRewardHandler(req, { params: Promise.resolve({ id: mockRewardId1 }) });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.isActive).toBe(false);
    });

    it('17. Returns 404 Not Found when updating non-existent reward', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce(null);

      const updatePayload = {
        name: 'Ghost Reward',
      };

      const nonExistentId = '00000000-0000-4000-8000-000000000000';
      const req = new NextRequest(`http://localhost:3000/api/v1/owner/loyalty/rewards/${nonExistentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const response = await updateRewardHandler(req, { params: Promise.resolve({ id: nonExistentId }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('not found');
    });

    it('18. Returns 404 when attempting to update a cross-tenant reward', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce(null);

      const updatePayload = {
        name: 'Hijacked Reward',
      };

      const req = new NextRequest(`http://localhost:3000/api/v1/owner/loyalty/rewards/${foreignRewardId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });

      const response = await updateRewardHandler(req, { params: Promise.resolve({ id: foreignRewardId }) });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('not found');
    });
  });

  // ===========================================================================
  // 5. Reward Redemptions Retrieval & Privacy Safeguards
  // ===========================================================================
  describe('GET /api/v1/owner/loyalty/rewards/[id]/redemptions', () => {
    const mockRedemption = {
      id: 'red-1111-1111-1111-111111111111',
      reward_id: mockRewardId1,
      customer_id: 'cust-1111-1111-1111-111111111111',
      restaurant_id: authorizedRestaurantId,
      order_id: 'ord-1111-1111-1111-111111111111',
      stars_redeemed: 150,
      status: 'completed',
      notes: 'Customer redeemed at counter',
      redeemed_at: new Date('2026-10-20T19:30:00.000Z'),
      created_at: new Date('2026-10-20T19:30:00.000Z'),
      customers: {
        id: 'cust-1111-1111-1111-111111111111',
        name: 'Amit Patel',
      },
      orders: {
        id: 'ord-1111-1111-1111-111111111111',
        order_number: 'ORD-8821',
      },
    };

    it('19. Retrieves paginated redemptions for a reward', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce({
        id: mockRewardId1,
        name: 'Free Tiramisu Dessert',
      } as any);

      vi.mocked(prisma.loyalty_redemptions.findMany).mockResolvedValueOnce([mockRedemption] as any);
      vi.mocked(prisma.loyalty_redemptions.count).mockResolvedValueOnce(1);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards/${mockRewardId1}/redemptions?page=1&limit=10`
      );

      const response = await getRewardRedemptionsHandler(req, {
        params: Promise.resolve({ id: mockRewardId1 }),
      });
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.data.rewardId).toBe(mockRewardId1);
      expect(json.data.rewardName).toBe('Free Tiramisu Dessert');
      expect(json.data.redemptions).toHaveLength(1);

      const item = json.data.redemptions[0];
      expect(item.id).toBe('red-1111-1111-1111-111111111111');
      expect(item.customerName).toBe('Amit Patel');
      expect(item.orderNumber).toBe('ORD-8821');
      expect(item.starsRedeemed).toBe(150);
      expect(item.status).toBe('completed');
    });

    it('20. Strictly ensures customer phone numbers and sensitive data are NOT exposed', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce({
        id: mockRewardId1,
        name: 'Free Tiramisu Dessert',
      } as any);

      vi.mocked(prisma.loyalty_redemptions.findMany).mockResolvedValueOnce([mockRedemption] as any);
      vi.mocked(prisma.loyalty_redemptions.count).mockResolvedValueOnce(1);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards/${mockRewardId1}/redemptions`
      );

      const response = await getRewardRedemptionsHandler(req, {
        params: Promise.resolve({ id: mockRewardId1 }),
      });
      const json = await response.json();

      const item = json.data.redemptions[0];
      expect(item.phone).toBeUndefined();
      expect(item.customerPhone).toBeUndefined();
      expect(item.token).toBeUndefined();
      expect(item.otp).toBeUndefined();

      expect(prisma.loyalty_redemptions.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.objectContaining({
            customers: {
              select: {
                id: true,
                name: true,
              },
            },
          }),
        })
      );
    });

    it('21. Returns 404 when querying redemptions for a cross-tenant reward', async () => {
      vi.mocked(prisma.loyalty_rewards.findFirst).mockResolvedValueOnce(null);

      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rewards/${foreignRewardId}/redemptions`
      );

      const response = await getRewardRedemptionsHandler(req, {
        params: Promise.resolve({ id: foreignRewardId }),
      });
      const json = await response.json();

      expect(response.status).toBe(404);
      expect(json.success).toBe(false);
      expect(json.error.message).toContain('not found');
    });
  });
});

