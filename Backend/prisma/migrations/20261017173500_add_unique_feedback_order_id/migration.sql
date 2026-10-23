-- Migration: 20261017173500_add_unique_feedback_order_id
-- Description: Add database-level uniqueness constraint on feedback.order_id to guarantee 1:1 order-feedback integrity.
-- Status: PREPARED ONLY (NOT APPLIED TO DATABASE)

-- CreateIndex
CREATE UNIQUE INDEX "unique_feedback_order_id" ON "feedback"("order_id");
