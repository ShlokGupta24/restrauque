-- Migration: 20261020121500_add_loyalty_redemption_fields
-- Description: Add additive loyalty points redemption fields and constraints to loyalty_programs and orders.
-- Status: PREPARED ONLY (NOT APPLIED TO DATABASE)

-- AlterTable: loyalty_programs
ALTER TABLE "loyalty_programs"
  ADD COLUMN "redemption_rate" DECIMAL(10, 2) NOT NULL DEFAULT 1.00;

-- CreateCheck: check_loyalty_programs_redemption_rate
ALTER TABLE "loyalty_programs"
  ADD CONSTRAINT "check_loyalty_programs_redemption_rate"
  CHECK ("redemption_rate" > 0.00 AND "redemption_rate" <= 100.00);

-- AlterTable: orders
ALTER TABLE "orders"
  ADD COLUMN "loyalty_discount_amount" DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- CreateCheck: check_orders_loyalty_discount_amount
ALTER TABLE "orders"
  ADD CONSTRAINT "check_orders_loyalty_discount_amount"
  CHECK ("loyalty_discount_amount" >= 0.00);
