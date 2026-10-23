import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { GET, PUT } from '@/app/api/v1/owner/loyalty/rules/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { prisma } from '@/lib/db/prisma';
import { AuthenticationError, ForbiddenError } from '@/lib/http/errors';
import {
  MIN_REDEMPTION_POINTS,
  MAX_REDEMPTION_DISCOUNT_PERCENTAGE,
  SPEND_POINTS_PER_RUPEES,
} from '@/lib/loyalty/service';

vi.mock('@/lib/auth/tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tenancy')>();
  return {
    ...actual,
    requireAuthorizedRestaurant: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    $transaction: vi.fn(async (cb: any) => cb(mockPrisma)),
    loyalty_programs: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 41 — Owner-Configurable Loyalty Redemption Settings API', () => {
  const authorizedRestaurantId = '11111111-1111-4111-8111-111111111111';
  const unauthorizedRestaurantId = '99999999-9999-4999-8999-999999999999';
  const mockProgramId = 'prog-1111-2222-3333-444444444444';

  const defaultMockProgram = {
    id: mockProgramId,
    restaurant_id: authorizedRestaurantId,
    name: 'Dining Rewards',
    description: 'Earn stars on completed visits and dining reviews to unlock rewards.',
    is_active: true,
    earning_mode: 'visit_and_review',
    stars_per_visit: 5,
    stars_per_review: 10,
    redemption_rate: new Prisma.Decimal('1.50'),
    created_at: new Date('2026-01-01T00:00:00.000Z'),
    updated_at: new Date('2026-01-02T00:00:00.000Z'),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(requireAuthorizedRestaurant).mockResolvedValue({
      owner: { id: 'owner-uuid-1', role: 'RESTAURANT_OWNER' } as any,
      restaurant: {
        id: authorizedRestaurantId,
        name: 'The Rustic Hearth',
        status: 'active',
      } as any,
      branches: [],
    });
  });

  describe('A. Centralized Business Rule Constants', () => {
    it('defines the approved minimum redemption points constant as 20', () => {
      expect(MIN_REDEMPTION_POINTS).toBe(20);
    });

    it('defines the approved maximum discount cap constant as 50% (0.5)', () => {
      expect(MAX_REDEMPTION_DISCOUNT_PERCENTAGE).toBe(0.5);
    });

    it('defines the approved spend-earning rate as ₹50 per 1 point', () => {
      expect(SPEND_POINTS_PER_RUPEES).toBe(50);
    });
  });

  describe('B. GET /api/v1/owner/loyalty/rules', () => {
    it('returns 200 with persisted redemptionRate when loyalty program exists', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rules?restaurantId=${authorizedRestaurantId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.restaurantId).toBe(authorizedRestaurantId);
      expect(json.data.restaurantName).toBe('The Rustic Hearth');
      expect(json.data.loyaltyProgram).toEqual({
        id: mockProgramId,
        restaurantId: authorizedRestaurantId,
        name: 'Dining Rewards',
        description: 'Earn stars on completed visits and dining reviews to unlock rewards.',
        isActive: true,
        earningMode: 'visit_and_review',
        starsPerVisit: 5,
        starsPerReview: 10,
        redemptionRate: 1.5,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-02T00:00:00.000Z',
      });
      expect(prisma.loyalty_programs.findUnique).toHaveBeenCalledWith({
        where: { restaurant_id: authorizedRestaurantId },
      });
    });

    it('auto-initializes program with default redemptionRate 1.0 when program does not exist yet', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.loyalty_programs.create).mockResolvedValue({
        ...defaultMockProgram,
        redemption_rate: new Prisma.Decimal('1.00'),
      } as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules');
      const response = await GET(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.data.loyaltyProgram.redemptionRate).toBe(1.0);
      expect(prisma.loyalty_programs.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          restaurant_id: authorizedRestaurantId,
          redemption_rate: new Prisma.Decimal('1.00'),
        }),
      });
    });

    it('rejects unauthenticated caller with 401 Unauthorized', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new AuthenticationError('Invalid or missing authentication credentials')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules');
      const response = await GET(request);
      expect(response.status).toBe(401);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('UNAUTHORIZED');
    });

    it('rejects cross-restaurant access with 403 Forbidden', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError('You do not have access to this restaurant')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rules?restaurantId=${unauthorizedRestaurantId}`
      );
      const response = await GET(request);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });
  });

  describe('C. PUT /api/v1/owner/loyalty/rules — Valid Updates', () => {
    it('updates redemptionRate successfully for the authorized restaurant', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);
      vi.mocked(prisma.loyalty_programs.update).mockResolvedValue({
        ...defaultMockProgram,
        redemption_rate: new Prisma.Decimal('2.50'),
      } as any);

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rules?restaurantId=${authorizedRestaurantId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ redemptionRate: 2.5 }),
        }
      );
      const response = await PUT(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data.loyaltyProgram.redemptionRate).toBe(2.5);

      expect(prisma.loyalty_programs.update).toHaveBeenCalledWith({
        where: { restaurant_id: authorizedRestaurantId },
        data: expect.objectContaining({
          redemption_rate: new Prisma.Decimal('2.50'),
        }),
      });
    });

    it('allows boundary redemption rate values (0.01 and 100)', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);
      vi.mocked(prisma.loyalty_programs.update).mockResolvedValue({
        ...defaultMockProgram,
        redemption_rate: new Prisma.Decimal('100.00'),
      } as any);

      const requestMax = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: 100 }),
      });
      const responseMax = await PUT(requestMax);
      expect(responseMax.status).toBe(200);

      vi.mocked(prisma.loyalty_programs.update).mockResolvedValue({
        ...defaultMockProgram,
        redemption_rate: new Prisma.Decimal('0.01'),
      } as any);

      const requestMin = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: 0.01 }),
      });
      const responseMin = await PUT(requestMin);
      expect(responseMin.status).toBe(200);
    });

    it('leaves redemptionRate unchanged when omitted in update request', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockResolvedValue(defaultMockProgram as any);
      vi.mocked(prisma.loyalty_programs.update).mockResolvedValue({
        ...defaultMockProgram,
        stars_per_visit: 15,
        name: 'Gourmet Lounge Club',
      } as any);

      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({
          name: 'Gourmet Lounge Club',
          starsPerVisit: 15,
        }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(200);

      // Verify redemption_rate was NOT included in update payload
      expect(prisma.loyalty_programs.update).toHaveBeenCalledWith({
        where: { restaurant_id: authorizedRestaurantId },
        data: {
          name: 'Gourmet Lounge Club',
          stars_per_visit: 15,
          updated_at: expect.any(Date),
        },
      });
    });
  });

  describe('D. PUT /api/v1/owner/loyalty/rules — Validation and Rejections', () => {
    it('rejects zero redemption rate (redemptionRate: 0) with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: 0 }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'redemptionRate',
            message: 'Redemption rate must be greater than 0',
          }),
        ])
      );
    });

    it('rejects negative redemption rate (redemptionRate: -2.5) with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: -2.5 }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects redemption rate greater than 100 with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: 100.01 }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'redemptionRate',
            message: 'Redemption rate cannot exceed 100',
          }),
        ])
      );
    });

    it('rejects redemption rate with more than 2 decimal places (1.234) with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: 1.234 }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
      expect(json.error.details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'redemptionRate',
            message: 'Redemption rate cannot have more than 2 decimal places',
          }),
        ])
      );
    });

    it('rejects string values for redemption rate (e.g. "1.50") with 400 Validation Error', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: '1.50' }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects null, boolean, or array for redemption rate with 400 Validation Error', async () => {
      const requestNull = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: null }),
      });
      const responseNull = await PUT(requestNull);
      expect(responseNull.status).toBe(400);

      const requestBool = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({ redemptionRate: true }),
      });
      const responseBool = await PUT(requestBool);
      expect(responseBool.status).toBe(400);
    });

    it('rejects unknown request fields due to strict schema validation', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: JSON.stringify({
          redemptionRate: 2.0,
          unrecognizedKey: 'malicious',
        }),
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects malformed JSON payloads in request body with 400 MALFORMED_JSON', async () => {
      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules', {
        method: 'PUT',
        body: 'invalid-json{{{',
      });
      const response = await PUT(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('MALFORMED_JSON');
    });
  });

  describe('E. Authorization & Database Error Handling', () => {
    it('rejects PUT from unauthorized owner with 403 Forbidden', async () => {
      vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
        new ForbiddenError('You do not have access to this restaurant')
      );

      const request = new NextRequest(
        `http://localhost:3000/api/v1/owner/loyalty/rules?restaurantId=${unauthorizedRestaurantId}`,
        {
          method: 'PUT',
          body: JSON.stringify({ redemptionRate: 2.0 }),
        }
      );
      const response = await PUT(request);
      expect(response.status).toBe(403);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('FORBIDDEN');
    });

    it('handles unexpected database failures with 500 without leaking stack traces', async () => {
      vi.mocked(prisma.loyalty_programs.findUnique).mockRejectedValueOnce(
        new Error('Database connection terminated unexpectedly')
      );

      const request = new NextRequest('http://localhost:3000/api/v1/owner/loyalty/rules');
      const response = await GET(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.success).toBe(false);
      expect(json.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(json.error.message).toBe('An unexpected internal server error occurred');
      expect(json.stack).toBeUndefined();
    });
  });
});
