import { describe, it, expect } from 'vitest';
import { prisma } from '@/lib/db/prisma';

describe('Database Schema Integrity', () => {
  it('should verify all existing platform models remain intact in Prisma client', () => {
    // Check that core tables/models from the existing 50 tables exist on the Prisma client
    expect(prisma.restaurants).toBeDefined();
    expect(prisma.branches).toBeDefined();
    expect(prisma.restaurant_staff).toBeDefined();
    expect(prisma.restaurant_tables).toBeDefined();
    expect(prisma.products).toBeDefined();
    expect(prisma.categories).toBeDefined();
    expect(prisma.orders).toBeDefined();
    expect(prisma.order_items).toBeDefined();
    expect(prisma.payments).toBeDefined();
    expect(prisma.customers).toBeDefined();
    expect(prisma.customer_sessions).toBeDefined();
    expect(prisma.feedback).toBeDefined();
    expect(prisma.loyalty_programs).toBeDefined();
    expect(prisma.ai_insights).toBeDefined();
    expect(prisma.ai_agent_actions).toBeDefined();
    expect(prisma.analytics_daily_metrics).toBeDefined();
    expect(prisma.coupons).toBeDefined();
    expect(prisma.qr_codes).toBeDefined();
    expect(prisma.notifications).toBeDefined();
    expect(prisma.audit_logs).toBeDefined();

    // Check newly added auth models
    expect(prisma.users).toBeDefined();
    expect(prisma.user_sessions).toBeDefined();
  });

  it('should successfully query existing restaurant data without errors', async () => {
    const restaurants = await prisma.restaurants.findMany({ take: 1 });
    expect(Array.isArray(restaurants)).toBe(true);
    if (restaurants.length > 0) {
      expect(restaurants[0].name).toBeDefined();
    }
  });
});
