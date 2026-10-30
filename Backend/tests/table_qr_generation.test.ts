import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { prisma } from '@/lib/db/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createDatabaseSession } from '@/lib/auth/session';
import { createJwtToken } from '@/lib/auth/jwt';
import { POST as createTableHandler } from '@/app/api/v1/owner/tables/route';
import { GET as getTableQrHandler } from '@/app/api/v1/owner/tables/[tableId]/qr/route';
import { POST as rotateTableQrHandler } from '@/app/api/v1/owner/tables/[tableId]/qr/rotate/route';
import { GET as getTableQrImageHandler } from '@/app/api/v1/owner/tables/[tableId]/qr/image/route';
import { GET as resolvePublicQrHandler } from '@/app/api/v1/public/qr/[token]/route';
import {
  generateSecureQrToken,
  hashQrToken,
  buildPublicQrUrl,
  deriveDeterministicQrToken,
} from '@/lib/qr/token';

function decodeQrCodeBuffer(buffer: Buffer): string | null {
  const png = PNG.sync.read(buffer);
  const code = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  return code ? code.data : null;
}

function decodeDataUrl(dataUrl: string): string | null {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');
  return decodeQrCodeBuffer(buffer);
}

describe('Restrauque — Automatic Per-Table QR Generation & Scan Flow Tests', () => {
  const timestamp = Date.now();

  let owner1Id: string;
  let owner1Token: string;
  let owner1RestaurantId: string;
  let owner1BranchId: string;

  let owner2Id: string;
  let owner2Token: string;
  let owner2RestaurantId: string;
  let owner2BranchId: string;

  let table1Id: string;
  let table1Token: string;
  let table1QrUrl: string;

  let table2Id: string;
  let table2Token: string;
  let table2QrUrl: string;

  let owner2TableId: string;
  let owner2TableToken: string;
  let owner2TableQrUrl: string;

  beforeAll(async () => {
    const passwordHash = await hashPassword('SuperSecureQrPass123!');

    // 1. Create Owner 1 + Restaurant 1 + Branch 1
    const owner1 = await prisma.users.create({
      data: {
        email: `qr_owner_1_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'QR Owner 1',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner1Id = owner1.id;

    const session1 = await createDatabaseSession(owner1Id);
    owner1Token = await createJwtToken({
      userId: owner1Id,
      sessionId: session1.sessionId,
      sessionToken: session1.sessionToken,
      email: owner1.email,
      role: 'RESTAURANT_OWNER',
    });

    const rest1 = await prisma.restaurants.create({
      data: {
        name: `Trattoria QR Venue ${timestamp}`,
        legal_name: 'Trattoria Hospitality Pvt Ltd',
        owner_id: owner1Id,
        status: 'active',
      },
    });
    owner1RestaurantId = rest1.id;

    const b1 = await prisma.branches.create({
      data: {
        restaurant_id: owner1RestaurantId,
        name: 'Downtown Flagship',
        status: 'active',
      },
    });
    owner1BranchId = b1.id;

    // 2. Create Owner 2 + Restaurant 2 + Branch 2 (for tenant isolation)
    const owner2 = await prisma.users.create({
      data: {
        email: `qr_owner_2_${timestamp}@test.com`,
        password_hash: passwordHash,
        name: 'QR Owner 2',
        role: 'RESTAURANT_OWNER',
        status: 'active',
      },
    });
    owner2Id = owner2.id;

    const session2 = await createDatabaseSession(owner2Id);
    owner2Token = await createJwtToken({
      userId: owner2Id,
      sessionId: session2.sessionId,
      sessionToken: session2.sessionToken,
      email: owner2.email,
      role: 'RESTAURANT_OWNER',
    });

    const rest2 = await prisma.restaurants.create({
      data: {
        name: `Bistro QR CrossVenue ${timestamp}`,
        legal_name: 'Bistro Dining LLP',
        owner_id: owner2Id,
        status: 'active',
      },
    });
    owner2RestaurantId = rest2.id;

    const b2 = await prisma.branches.create({
      data: {
        restaurant_id: owner2RestaurantId,
        name: 'Uptown Corner',
        status: 'active',
      },
    });
    owner2BranchId = b2.id;
  });

  afterAll(async () => {
    // Clean up test records
    if (owner1RestaurantId) {
      const branches = await prisma.branches.findMany({ where: { restaurant_id: owner1RestaurantId } });
      const branchIds = branches.map((b) => b.id);
      const tables = await prisma.restaurant_tables.findMany({ where: { branch_id: { in: branchIds } } });
      const tableIds = tables.map((t) => t.id);

      await prisma.qr_codes.deleteMany({ where: { table_id: { in: tableIds } } }).catch(() => {});
      await prisma.restaurant_tables.deleteMany({ where: { id: { in: tableIds } } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner1RestaurantId } }).catch(() => {});
      await prisma.restaurants.deleteMany({ where: { id: owner1RestaurantId } }).catch(() => {});
    }

    if (owner2RestaurantId) {
      const branches = await prisma.branches.findMany({ where: { restaurant_id: owner2RestaurantId } });
      const branchIds = branches.map((b) => b.id);
      const tables = await prisma.restaurant_tables.findMany({ where: { branch_id: { in: branchIds } } });
      const tableIds = tables.map((t) => t.id);

      await prisma.qr_codes.deleteMany({ where: { table_id: { in: tableIds } } }).catch(() => {});
      await prisma.restaurant_tables.deleteMany({ where: { id: { in: tableIds } } }).catch(() => {});
      await prisma.branches.deleteMany({ where: { restaurant_id: owner2RestaurantId } }).catch(() => {});
      await prisma.restaurants.deleteMany({ where: { id: owner2RestaurantId } }).catch(() => {});
    }

    if (owner1Id) {
      await prisma.user_sessions.deleteMany({ where: { user_id: owner1Id } }).catch(() => {});
      await prisma.users.deleteMany({ where: { id: owner1Id } }).catch(() => {});
    }

    if (owner2Id) {
      await prisma.user_sessions.deleteMany({ where: { user_id: owner2Id } }).catch(() => {});
      await prisma.users.deleteMany({ where: { id: owner2Id } }).catch(() => {});
    }
  });

  // =========================================================================
  // Requirement 1: Creating a table automatically provisions a QR identity
  // =========================================================================
  it('Requirement 1: Creating a table automatically provisions a unique QR identity and scannable QR representation', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        branchId: owner1BranchId,
        tableNumber: 'T-101',
        capacity: 4,
        status: 'available',
        isActive: true,
        isQrActive: true,
      }),
    });

    const res = await createTableHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    expect(json.data.table.tableNumber).toBe('T-101');
    expect(json.data.table.isQrActive).toBe(true);

    expect(json.data.qr).toBeDefined();
    expect(json.data.qr.id).toBeDefined();
    expect(json.data.qr.rawToken).toBeDefined();
    expect(json.data.qr.qrUrl).toBeDefined();
    expect(json.data.qr.qrImage).toBeDefined();
    expect(json.data.qr.qrImage).toMatch(/^data:image\/png;base64,/);
    expect(json.data.qr.qrSvg).toBeDefined();
    expect(json.data.qr.qrSvg).toContain('<svg');

    table1Id = json.data.table.id;
    table1Token = json.data.qr.rawToken;
    table1QrUrl = json.data.qr.qrUrl;

    // Verify database stores SHA-256 hash, not plaintext token
    const dbQr = await prisma.qr_codes.findFirst({ where: { table_id: table1Id } });
    expect(dbQr).not.toBeNull();
    expect(dbQr?.code).toBe(hashQrToken(table1Token));
    expect(dbQr?.code).toHaveLength(64);
  });

  // =========================================================================
  // Requirement 2: Two tables in same branch receive distinct QR destinations
  // =========================================================================
  it('Requirement 2: Two tables in the same branch receive distinct QR destinations', async () => {
    const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        branchId: owner1BranchId,
        tableNumber: 'T-102',
        capacity: 2,
        status: 'available',
        isActive: true,
        isQrActive: true,
      }),
    });

    const res = await createTableHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    table2Id = json.data.table.id;
    table2Token = json.data.qr.rawToken;
    table2QrUrl = json.data.qr.qrUrl;

    expect(table1Id).not.toBe(table2Id);
    expect(table1Token).not.toBe(table2Token);
    expect(table1QrUrl).not.toBe(table2QrUrl);
  });

  // =========================================================================
  // Requirement 3: Matching table numbers across different restaurants receive distinct QR destinations
  // =========================================================================
  it('Requirement 3: Tables in different restaurants receive distinct QR destinations even when table numbers match exactly', async () => {
    // Create 'T-101' under Owner 2's restaurant
    const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner2Token}`,
      },
      body: JSON.stringify({
        branchId: owner2BranchId,
        tableNumber: 'T-101', // Identical table number as Owner 1!
        capacity: 4,
        status: 'available',
        isActive: true,
        isQrActive: true,
      }),
    });

    const res = await createTableHandler(req);
    expect(res.status).toBe(201);

    const json = await res.json();
    owner2TableId = json.data.table.id;
    owner2TableToken = json.data.qr.rawToken;
    owner2TableQrUrl = json.data.qr.qrUrl;

    // Both tables are named 'T-101', but belong to different restaurants
    expect(table1Token).not.toBe(owner2TableToken);
    expect(table1QrUrl).not.toBe(owner2TableQrUrl);

    // Resolve both tokens and verify strict tenant isolation
    const res1 = await resolvePublicQrHandler(new NextRequest(table1QrUrl), {
      params: Promise.resolve({ token: table1Token }),
    });
    const json1 = await res1.json();
    expect(json1.data.restaurant.name).toContain('Trattoria QR Venue');
    expect(json1.data.table.id).toBe(table1Id);

    const res2 = await resolvePublicQrHandler(new NextRequest(owner2TableQrUrl), {
      params: Promise.resolve({ token: owner2TableToken }),
    });
    const json2 = await res2.json();
    expect(json2.data.restaurant.name).toContain('Bistro QR CrossVenue');
    expect(json2.data.table.id).toBe(owner2TableId);
  });

  // =========================================================================
  // Requirement 4: The generated QR image programmatically decodes to the expected URL
  // =========================================================================
  it('Requirement 4: The generated QR image truly encodes the expected absolute customer URL when decoded', async () => {
    // 1. Retrieve the QR metadata and image for Table 1
    const params = Promise.resolve({ tableId: table1Id });
    const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${table1Id}/qr`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    const res = await getTableQrHandler(req, { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.qr.qrImage).toBeDefined();

    // 2. Decode the Base64 PNG image programmatically using jsQR
    const decodedUrl = decodeDataUrl(json.data.qr.qrImage);
    expect(decodedUrl).not.toBeNull();
    expect(decodedUrl).toBe(table1QrUrl);
    expect(decodedUrl).toContain(`/qr/${encodeURIComponent(table1Token)}`);

    // 3. Also verify the direct PNG endpoint
    const imgReq = new NextRequest(
      `http://localhost:3000/api/v1/owner/tables/${table1Id}/qr/image?format=png`,
      {
        headers: { Authorization: `Bearer ${owner1Token}` },
      }
    );
    const imgRes = await getTableQrImageHandler(imgReq, { params });
    expect(imgRes.status).toBe(200);
    expect(imgRes.headers.get('content-type')).toBe('image/png');

    const imgArrayBuffer = await imgRes.arrayBuffer();
    const directDecodedUrl = decodeQrCodeBuffer(Buffer.from(imgArrayBuffer));
    expect(directDecodedUrl).toBe(table1QrUrl);
  });

  // =========================================================================
  // Requirement 5: Valid QR token resolves to correct table, branch, and restaurant
  // =========================================================================
  it('Requirement 5: A valid QR token resolves server-side to the correct restaurant, branch, and table', async () => {
    const params = Promise.resolve({ token: table1Token });
    const req = new NextRequest(`http://localhost:3000/api/v1/public/qr/${table1Token}`);

    const res = await resolvePublicQrHandler(req, { params });
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.resolved).toBe(true);
    expect(json.data.table.id).toBe(table1Id);
    expect(json.data.table.tableNumber).toBe('T-101');
    expect(json.data.branch.id).toBe(owner1BranchId);
    expect(json.data.branch.name).toBe('Downtown Flagship');
    expect(json.data.restaurant.id).toBe(owner1RestaurantId);
  });

  // =========================================================================
  // Requirement 6: Invalid, revoked, rotated, or inactive tokens are rejected
  // =========================================================================
  it('Requirement 6: Invalid, rotated, revoked, or inactive tokens are strictly rejected', async () => {
    // 1. Rotate Table 1's QR code
    const rotateParams = Promise.resolve({ tableId: table1Id });
    const rotateReq = new NextRequest(
      `http://localhost:3000/api/v1/owner/tables/${table1Id}/qr/rotate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner1Token}` },
      }
    );
    const rotateRes = await rotateTableQrHandler(rotateReq, { params: rotateParams });
    expect(rotateRes.status).toBe(200);

    const rotateJson = await rotateRes.json();
    const rotatedNewToken = rotateJson.data.rawToken;
    expect(rotatedNewToken).not.toBe(table1Token);

    // 2. Old token must immediately fail with 404
    const oldParams = Promise.resolve({ token: table1Token });
    const oldReq = new NextRequest(`http://localhost:3000/api/v1/public/qr/${table1Token}`);
    const oldRes = await resolvePublicQrHandler(oldReq, { params: oldParams });
    expect(oldRes.status).toBe(404);

    // 3. New token must succeed
    const newParams = Promise.resolve({ token: rotatedNewToken });
    const newReq = new NextRequest(`http://localhost:3000/api/v1/public/qr/${rotatedNewToken}`);
    const newRes = await resolvePublicQrHandler(newReq, { params: newParams });
    expect(newRes.status).toBe(200);

    // 4. Inactivating the table makes the new token reject
    await prisma.restaurant_tables.update({
      where: { id: table1Id },
      data: { is_active: false },
    });
    const inactiveRes = await resolvePublicQrHandler(newReq, { params: newParams });
    expect(inactiveRes.status).toBe(404);

    // Re-activate
    await prisma.restaurant_tables.update({
      where: { id: table1Id },
      data: { is_active: true },
    });

    table1Token = rotatedNewToken;
  });

  // =========================================================================
  // Requirement 7: Owner cannot provision or retrieve another restaurant's QR
  // =========================================================================
  it('Requirement 7: An owner cannot provision or retrieve another restaurant table QR (Tenant Isolation)', async () => {
    // Owner 1 attempts to retrieve Owner 2's table QR
    const params = Promise.resolve({ tableId: owner2TableId });
    const req = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${owner2TableId}/qr`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });

    const res = await getTableQrHandler(req, { params });
    expect(res.status).toBe(404);

    // Owner 1 attempts to rotate Owner 2's table QR
    const rotateReq = new NextRequest(
      `http://localhost:3000/api/v1/owner/tables/${owner2TableId}/qr/rotate`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${owner1Token}` },
      }
    );
    const rotateRes = await rotateTableQrHandler(rotateReq, { params });
    expect(rotateRes.status).toBe(404);
  });

  // =========================================================================
  // Requirement 8: Missing production URL configuration fails safely
  // =========================================================================
  it('Requirement 8: Missing production URL configuration fails safely instead of generating broken URLs', () => {
    const originalEnv = process.env.NODE_ENV;
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    const originalUrl = process.env.APP_URL;

    try {
      (process.env as Record<string, string | undefined>).NODE_ENV = 'production';
      delete process.env.NEXT_PUBLIC_APP_URL;
      delete process.env.APP_URL;

      expect(() => buildPublicQrUrl('any_valid_token_string_here')).toThrow(
        /Missing required NEXT_PUBLIC_APP_URL or APP_URL/
      );
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
      if (originalAppUrl) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      if (originalUrl) process.env.APP_URL = originalUrl;
    }
  });

  // =========================================================================
  // Requirement 9: Existing tables retain stable destinations after refresh
  // =========================================================================
  it('Requirement 9: Existing tables retain stable QR destinations and tokens across multiple refreshes', async () => {
    // Fetch Table 2 QR representation first time
    const params = Promise.resolve({ tableId: table2Id });
    const req1 = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${table2Id}/qr`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const res1 = await getTableQrHandler(req1, { params });
    expect(res1.status).toBe(200);
    const json1 = await res1.json();
    const initialQrUrl = json1.data.qr.qrUrl;
    const initialQrImage = json1.data.qr.qrImage;

    // Simulate page refresh / second query
    const req2 = new NextRequest(`http://localhost:3000/api/v1/owner/tables/${table2Id}/qr`, {
      headers: { Authorization: `Bearer ${owner1Token}` },
    });
    const res2 = await getTableQrHandler(req2, { params });
    expect(res2.status).toBe(200);
    const json2 = await res2.json();

    // Verify 100% stability across dashboard reload
    expect(json2.data.qr.qrUrl).toBe(initialQrUrl);
    expect(json2.data.qr.qrImage).toBe(initialQrImage);

    // Verify decoded QR matches stable table2Token
    const decoded = decodeDataUrl(json2.data.qr.qrImage);
    expect(decoded).toBe(table2QrUrl);
  });

  // =========================================================================
  // Requirement 10: Atomic transaction safety on table and QR creation
  // =========================================================================
  it('Requirement 10: Failure during table creation or QR provisioning does not leave inconsistent database records', async () => {
    const duplicateNumber = 'T-102'; // Already exists in Owner 1 branch

    const req = new NextRequest('http://localhost:3000/api/v1/owner/tables', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${owner1Token}`,
      },
      body: JSON.stringify({
        branchId: owner1BranchId,
        tableNumber: duplicateNumber,
        capacity: 4,
      }),
    });

    const initialQrCount = await prisma.qr_codes.count();
    const initialTableCount = await prisma.restaurant_tables.count();

    const res = await createTableHandler(req);
    expect(res.status).toBe(409); // Conflict

    const finalQrCount = await prisma.qr_codes.count();
    const finalTableCount = await prisma.restaurant_tables.count();

    // Database is completely untainted by failed creation
    expect(finalQrCount).toBe(initialQrCount);
    expect(finalTableCount).toBe(initialTableCount);
  });

  // =========================================================================
  // Requirement 11: Owner QR Image Direct Download & Security Tests
  // =========================================================================
  describe('Requirement 11: GET /api/v1/owner/tables/[tableId]/qr/image Integration & Security', () => {
    it('11a. should allow authorized owner to retrieve a valid, non-empty PNG QR image', async () => {
      const params = Promise.resolve({ tableId: table1Id });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/${table1Id}/qr/image`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      expect(res.headers.get('content-disposition')).toContain('inline; filename="table-T-101-qr.png"');

      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      expect(buffer.length).toBeGreaterThan(100);

      // Verify standard PNG 8-byte magic header: 0x89 50 4E 47 0D 0A 1A 0A
      const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(buffer.subarray(0, 8).equals(pngHeader)).toBe(true);

      // Validate that image accurately decodes to the table's active public QR URL
      const decodedUrl = decodeQrCodeBuffer(buffer);
      expect(decodedUrl).toBe(buildPublicQrUrl(table1Token));
    });

    it('11b. should support SVG format when ?format=svg is requested', async () => {
      const params = Promise.resolve({ tableId: table1Id });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/${table1Id}/qr/image?format=svg`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('image/svg+xml');

      const text = await res.text();
      expect(text).toContain('<svg');
      expect(text).toContain('</svg>');
    });

    it('11c. should reject unauthenticated requests with 401', async () => {
      const params = Promise.resolve({ tableId: table1Id });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/${table1Id}/qr/image`
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(401);
    });

    it('11d. should reject cross-tenant access when owner attempts to retrieve another restaurant table QR', async () => {
      // Owner 1 attempts to download Owner 2's table QR image
      const params = Promise.resolve({ tableId: owner2TableId });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/${owner2TableId}/qr/image`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(404); // Scoped to owner's restaurant, so foreign table is not found
    });

    it('11e. should return 404 for non-existent table UUID', async () => {
      const nonExistentId = '00000000-0000-0000-0000-000000000000';
      const params = Promise.resolve({ tableId: nonExistentId });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/${nonExistentId}/qr/image`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(404);
    });

    it('11f. should return 400 for malformed tableId path parameter', async () => {
      const params = Promise.resolve({ tableId: 'not-a-valid-uuid' });
      const req = new NextRequest(
        `http://localhost:3000/api/v1/owner/tables/not-a-valid-uuid/qr/image`,
        {
          headers: { Authorization: `Bearer ${owner1Token}` },
        }
      );

      const res = await getTableQrImageHandler(req, { params });
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error.code).toBe('VALIDATION_ERROR');
    });
  });
});
