import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as listAccountsHandler } from '@/app/api/v1/owner/loyalty/accounts/route';
import { GET as getAccountDetailHandler } from '@/app/api/v1/owner/loyalty/accounts/[accountId]/route';
import { requireAuthorizedRestaurant } from '@/lib/auth/tenancy';
import { prisma } from '@/lib/db/prisma';
import { AuthenticationError, ForbiddenError } from '@/lib/http/errors';

vi.mock('@/lib/auth/tenancy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/tenancy')>();
  return {
    ...actual,
    requireAuthorizedRestaurant: vi.fn(),
  };
});

vi.mock('@/lib/db/prisma', () => {
  const mockPrisma = {
    customer_loyalty_accounts: {
      count: vi.fn(),
      aggregate: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    loyalty_transactions: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
  };
  return { prisma: mockPrisma };
});

describe('Step 8J: Owner Loyalty Accounts & Ledger API', () => {
  const authorizedRestaurantId = '11111111-1111-4111-8111-111111111111';
  const unauthorizedRestaurantId = '99999999-9999-4999-8999-999999999999';
  const mockAccountId1 = 'aaaa1111-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const mockAccountId2 = 'bbbb2222-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const foreignAccountId = 'ffff3333-ffff-4fff-8fff-ffffffffffff';
  const mockProgramId = 'prog-1111-2222-3333-444444444444';

  const mockAccountItem1 = {
    id: mockAccountId1,
    customer_id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
    restaurant_id: authorizedRestaurantId,
    loyalty_program_id: mockProgramId,
    stars_balance: 350,
    lifetime_stars_earned: 500,
    lifetime_stars_redeemed: 150,
    tier: 'gold',
    status: 'active',
    joined_at: new Date('2026-09-01T10:00:00.000Z'),
    created_at: new Date('2026-09-01T10:00:00.000Z'),
    updated_at: new Date('2026-10-20T12:00:00.000Z'),
    customers: {
      id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
      name: 'Priya Sharma',
    },
    loyalty_programs: {
      id: mockProgramId,
      name: 'VIP Dining Club',
    },
  };

  const mockAccountItem2 = {
    id: mockAccountId2,
    customer_id: 'cccc2222-cccc-4ccc-8ccc-cccccccccccc',
    restaurant_id: authorizedRestaurantId,
    loyalty_program_id: mockProgramId,
    stars_balance: 50,
    lifetime_stars_earned: 50,
    lifetime_stars_redeemed: 0,
    tier: 'standard',
    status: 'active',
    joined_at: new Date('2026-10-15T15:30:00.000Z'),
    created_at: new Date('2026-10-15T15:30:00.000Z'),
    updated_at: new Date('2026-10-15T15:30:00.000Z'),
    customers: {
      id: 'cccc2222-cccc-4ccc-8ccc-cccccccccccc',
      name: null, // Test fallback for missing customer name
    },
    loyalty_programs: {
      id: mockProgramId,
      name: 'VIP Dining Club',
    },
  };

  const mockTransactions = [
    {
      id: 'tx-1111-1111-1111-111111111111',
      loyalty_account_id: mockAccountId1,
      customer_id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
      restaurant_id: authorizedRestaurantId,
      order_id: 'ord-1111-1111-1111-111111111111',
      feedback_id: null,
      transaction_type: 'visit_reward',
      stars: 20,
      description: 'Spend reward (Order #ORD-101)',
      created_at: new Date('2026-10-20T12:00:00.000Z'),
      orders: {
        id: 'ord-1111-1111-1111-111111111111',
        order_number: 'ORD-101',
      },
    },
    {
      id: 'tx-2222-2222-2222-222222222222',
      loyalty_account_id: mockAccountId1,
      customer_id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
      restaurant_id: authorizedRestaurantId,
      order_id: 'ord-2222-2222-2222-222222222222',
      feedback_id: null,
      transaction_type: 'redemption',
      stars: -50,
      description: 'Redeemed 50 points for dining discount (Order #ORD-095)',
      created_at: new Date('2026-10-18T18:30:00.000Z'),
      orders: {
        id: 'ord-2222-2222-2222-222222222222',
        order_number: 'ORD-095',
      },
    },
    {
      id: 'tx-3333-3333-3333-333333333333',
      loyalty_account_id: mockAccountId1,
      customer_id: 'cccc1111-cccc-4ccc-8ccc-cccccccccccc',
      restaurant_id: authorizedRestaurantId,
      order_id: null,
      feedback_id: 'fb-1111-1111-1111-111111111111',
      transaction_type: 'review_reward',
      stars: 10,
      description: 'Reward for dining review feedback',
      created_at: new Date('2026-10-10T09:15:00.000Z'),
      orders: null,
    },
  ];

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
  });

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated requests
  // ---------------------------------------------------------------------------
  it('1. Rejects unauthenticated requests with 401', async () => {
    vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
      new AuthenticationError('Authentication required')
    );

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  // ---------------------------------------------------------------------------
  // 2. Unauthorized roles (e.g. CUSTOMER)
  // ---------------------------------------------------------------------------
  it('2. Rejects unauthorized customer role with 403 Forbidden', async () => {
    vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
      new ForbiddenError('Access forbidden: Restaurant owner permissions required')
    );

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  // ---------------------------------------------------------------------------
  // 3. Valid account listing
  // ---------------------------------------------------------------------------
  it('3. Successfully lists owner loyalty accounts with correct envelope and fields', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([
      mockAccountItem1,
      mockAccountItem2,
    ] as any);
    vi.mocked(prisma.customer_loyalty_accounts.count)
      .mockResolvedValueOnce(2) // totalFilteredCount
      .mockResolvedValueOnce(2) // totalEnrolled
      .mockResolvedValueOnce(2); // activeAccounts
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: {
        stars_balance: 400,
        lifetime_stars_earned: 550,
        lifetime_stars_redeemed: 150,
      },
    } as any);

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.restaurantId).toBe(authorizedRestaurantId);
    expect(body.data.accounts).toHaveLength(2);

    const acc1 = body.data.accounts[0];
    expect(acc1.id).toBe(mockAccountId1);
    expect(acc1.customerName).toBe('Priya Sharma');
    expect(acc1.starsBalance).toBe(350);
    expect(acc1.lifetimeStarsEarned).toBe(500);
    expect(acc1.lifetimeStarsRedeemed).toBe(150);
    expect(acc1.tier).toBe('gold');
    expect(acc1.status).toBe('active');
    expect(acc1.joinedAt).toBe('2026-09-01T10:00:00.000Z');

    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      totalCount: 2,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Restaurant tenant isolation
  // ---------------------------------------------------------------------------
  it('4. Enforces strict restaurant tenant isolation in database queries', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.customer_loyalty_accounts.count).mockResolvedValue(0);
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: { stars_balance: null, lifetime_stars_earned: null, lifetime_stars_redeemed: null },
    } as any);

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    await listAccountsHandler(req);

    // Verify findMany was called with restaurant_id = authorizedRestaurantId
    expect(prisma.customer_loyalty_accounts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restaurant_id: authorizedRestaurantId,
        }),
      })
    );
  });

  // ---------------------------------------------------------------------------
  // 5. Explicit foreign restaurant ID rejection
  // ---------------------------------------------------------------------------
  it('5. Rejects explicitly supplied foreign restaurantId parameter with 403 Forbidden', async () => {
    vi.mocked(requireAuthorizedRestaurant).mockRejectedValueOnce(
      new ForbiddenError('Access forbidden: You do not have owner access to this restaurant')
    );

    const req = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts?restaurantId=${unauthorizedRestaurantId}`
    );
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(requireAuthorizedRestaurant).toHaveBeenCalledWith(req, unauthorizedRestaurantId);
  });

  // ---------------------------------------------------------------------------
  // 6. Pagination defaults, limit clamping, and malformed parameters
  // ---------------------------------------------------------------------------
  it('6. Handles pagination defaults, max limit, and rejects invalid parameters', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.customer_loyalty_accounts.count).mockResolvedValue(50);
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: { stars_balance: 1000, lifetime_stars_earned: 1500, lifetime_stars_redeemed: 500 },
    } as any);

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts?page=2&limit=15');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.customer_loyalty_accounts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 15, // (page - 1) * limit
        take: 15,
      })
    );
    expect(body.data.pagination).toEqual({
      page: 2,
      limit: 15,
      totalCount: 50,
      totalPages: 4,
      hasNextPage: true,
      hasPrevPage: true,
    });

    // Malformed limit > 100 rejected
    const reqInvalid = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts?limit=250');
    const resInvalid = await listAccountsHandler(reqInvalid);
    expect(resInvalid.status).toBe(400);

    // Malformed page < 1 rejected
    const reqPage0 = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts?page=0');
    const resPage0 = await listAccountsHandler(reqPage0);
    expect(resPage0.status).toBe(400);
  });

  // ---------------------------------------------------------------------------
  // 7. Search behavior
  // ---------------------------------------------------------------------------
  it('7. Filters accounts by customer name when search parameter is supplied', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([mockAccountItem1] as any);
    vi.mocked(prisma.customer_loyalty_accounts.count).mockResolvedValue(1);
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: { stars_balance: 350, lifetime_stars_earned: 500, lifetime_stars_redeemed: 150 },
    } as any);

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts?search=Priya');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(prisma.customer_loyalty_accounts.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          restaurant_id: authorizedRestaurantId,
          customers: {
            name: {
              contains: 'Priya',
              mode: 'insensitive',
            },
          },
        }),
      })
    );
    expect(body.data.accounts).toHaveLength(1);
  });

  // ---------------------------------------------------------------------------
  // 8. Correct summary calculations and empty results
  // ---------------------------------------------------------------------------
  it('8. Safely returns zero counts and zero metrics for restaurant with no accounts', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.customer_loyalty_accounts.count)
      .mockResolvedValueOnce(0) // filtered
      .mockResolvedValueOnce(0) // enrolled
      .mockResolvedValueOnce(0); // active
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: { stars_balance: null, lifetime_stars_earned: null, lifetime_stars_redeemed: null },
    } as any);

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.accounts).toHaveLength(0);
    expect(body.data.summary).toEqual({
      totalEnrolledAccounts: 0,
      activeAccounts: 0,
      totalPointsInCirculation: 0,
      totalLifetimePointsEarned: 0,
      totalLifetimePointsRedeemed: 0,
    });
    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      totalCount: 0,
      totalPages: 0,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Individual account lookup (Endpoint B)
  // ---------------------------------------------------------------------------
  it('9. Retrieves individual customer loyalty account profile and transaction ledger', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findFirst).mockResolvedValueOnce(mockAccountItem1 as any);
    vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce(mockTransactions as any);
    vi.mocked(prisma.loyalty_transactions.count).mockResolvedValueOnce(3);

    const req = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts/${mockAccountId1}`
    );
    const res = await getAccountDetailHandler(req, {
      params: Promise.resolve({ accountId: mockAccountId1 }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.account.id).toBe(mockAccountId1);
    expect(body.data.account.customerName).toBe('Priya Sharma');
    expect(body.data.account.starsBalance).toBe(350);
    expect(body.data.account.programName).toBe('VIP Dining Club');

    expect(body.data.transactions).toHaveLength(3);
    const tx1 = body.data.transactions[0];
    expect(tx1.transactionType).toBe('visit_reward');
    expect(tx1.stars).toBe(20);
    expect(tx1.orderNumber).toBe('ORD-101');

    const tx2 = body.data.transactions[1];
    expect(tx2.transactionType).toBe('redemption');
    expect(tx2.stars).toBe(-50);
    expect(tx2.orderNumber).toBe('ORD-095');

    expect(body.data.pagination).toEqual({
      page: 1,
      limit: 20,
      totalCount: 3,
      totalPages: 1,
      hasNextPage: false,
      hasPrevPage: false,
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Foreign-tenant account lookup (Endpoint B)
  // ---------------------------------------------------------------------------
  it('10. Rejects access to an account belonging to another restaurant with 403 Forbidden', async () => {
    // Not found under authorized restaurant
    vi.mocked(prisma.customer_loyalty_accounts.findFirst).mockResolvedValueOnce(null);
    // But found globally under a foreign restaurant
    vi.mocked(prisma.customer_loyalty_accounts.findUnique).mockResolvedValueOnce({
      id: foreignAccountId,
      restaurant_id: unauthorizedRestaurantId,
    } as any);

    const req = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts/${foreignAccountId}`
    );
    const res = await getAccountDetailHandler(req, {
      params: Promise.resolve({ accountId: foreignAccountId }),
    });
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toContain('does not belong to the authorized restaurant');
  });

  // ---------------------------------------------------------------------------
  // 11. Bounded, newest-first ledger results
  // ---------------------------------------------------------------------------
  it('11. Queries transactions with newest-first ordering and bounded pagination', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findFirst).mockResolvedValueOnce(mockAccountItem1 as any);
    vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.loyalty_transactions.count).mockResolvedValueOnce(0);

    const req = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts/${mockAccountId1}?page=1&limit=10`
    );
    await getAccountDetailHandler(req, {
      params: Promise.resolve({ accountId: mockAccountId1 }),
    });

    expect(prisma.loyalty_transactions.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          loyalty_account_id: mockAccountId1,
          restaurant_id: authorizedRestaurantId,
        },
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        skip: 0,
        take: 10,
      })
    );
  });

  // ---------------------------------------------------------------------------
  // 12. Nullable display fields and empty ledger history
  // ---------------------------------------------------------------------------
  it('12. Handles accounts with null customer names and empty transaction histories', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findFirst).mockResolvedValueOnce(mockAccountItem2 as any);
    vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.loyalty_transactions.count).mockResolvedValueOnce(0);

    const req = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts/${mockAccountId2}`
    );
    const res = await getAccountDetailHandler(req, {
      params: Promise.resolve({ accountId: mockAccountId2 }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.account.customerName).toBe('Dine-in Customer');
    expect(body.data.transactions).toEqual([]);
    expect(body.data.pagination.totalCount).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // 13. Privacy: phone numbers and authentication fields are not exposed
  // ---------------------------------------------------------------------------
  it('13. Strictly excludes customer phone numbers, OTPs, and auth fields from both endpoints', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockResolvedValueOnce([mockAccountItem1] as any);
    vi.mocked(prisma.customer_loyalty_accounts.count).mockResolvedValue(1);
    vi.mocked(prisma.customer_loyalty_accounts.aggregate).mockResolvedValueOnce({
      _sum: { stars_balance: 350, lifetime_stars_earned: 500, lifetime_stars_redeemed: 150 },
    } as any);

    const reqList = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const resList = await listAccountsHandler(reqList);
    const bodyList = await resList.json();

    const accountFromList = bodyList.data.accounts[0];
    expect(accountFromList).not.toHaveProperty('phone');
    expect(accountFromList).not.toHaveProperty('otp');
    expect(accountFromList).not.toHaveProperty('password');
    expect(accountFromList).not.toHaveProperty('token');

    vi.mocked(prisma.customer_loyalty_accounts.findFirst).mockResolvedValueOnce(mockAccountItem1 as any);
    vi.mocked(prisma.loyalty_transactions.findMany).mockResolvedValueOnce(mockTransactions as any);
    vi.mocked(prisma.loyalty_transactions.count).mockResolvedValueOnce(3);

    const reqDetail = new NextRequest(
      `http://localhost/api/v1/owner/loyalty/accounts/${mockAccountId1}`
    );
    const resDetail = await getAccountDetailHandler(reqDetail, {
      params: Promise.resolve({ accountId: mockAccountId1 }),
    });
    const bodyDetail = await resDetail.json();

    const accountFromDetail = bodyDetail.data.account;
    expect(accountFromDetail).not.toHaveProperty('phone');
    expect(accountFromDetail).not.toHaveProperty('otp');
    expect(accountFromDetail).not.toHaveProperty('password');
    expect(accountFromDetail).not.toHaveProperty('token');
  });

  // ---------------------------------------------------------------------------
  // 14. Database failures return safe error responses
  // ---------------------------------------------------------------------------
  it('14. Database failures return safe 500 response without leaking internal details', async () => {
    vi.mocked(prisma.customer_loyalty_accounts.findMany).mockRejectedValueOnce(
      new Error('Connection terminated unexpectedly: secret_db_uri')
    );

    const req = new NextRequest('http://localhost/api/v1/owner/loyalty/accounts');
    const res = await listAccountsHandler(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(body.error.message).not.toContain('secret_db_uri');
  });
});
