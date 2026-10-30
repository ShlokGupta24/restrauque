-- Migration: 20261021150000_add_unrecovered_loyalty_points
-- Description: Add additive unrecovered_loyalty_points projection field and non-negative check constraint to orders.
-- Status: PREPARED ONLY (NOT APPLIED TO DATABASE)

-- AlterTable: orders
ALTER TABLE "orders"
  ADD COLUMN "unrecovered_loyalty_points" INTEGER;

-- CreateCheck: check_orders_unrecovered_loyalty_points
ALTER TABLE "orders"
  ADD CONSTRAINT "check_orders_unrecovered_loyalty_points"
  CHECK ("unrecovered_loyalty_points" IS NULL OR "unrecovered_loyalty_points" >= 0);
