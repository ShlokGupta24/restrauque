# Known Limitations, Technical Debt & Integration Status

This document provides a realistic, source-verified audit of the current integration status, partial features, dormant database models, and technical risks across the Restrauque platform.

---

## 1. Feature Integration Audit Table

| Feature / Domain | Current Status | Evidence / Source Paths | Current Limitations & Gaps | Dependencies / Decisions Needed |
| :--- | :--- | :--- | :--- | :--- |
| **Dine-In QR Ordering** | **Implemented** | `Backend/app/api/v1/customer/orders/`, `frontend/customer screen/customer_ordering_side/` | Complete end-to-end flow with variant/add-on pricing, coupon validation, and points redemption. | Production deployment domain and physical QR printing. |
| **Points-Only Loyalty** | **Implemented** | `Backend/lib/loyalty/service.ts`, `Backend/app/api/v1/customer/loyalty/`, `frontend/restaurant dashboard/src/features/loyalty/` | Full double-entry points ledger, visit/review earning, 50% checkout discount cap, order cancellation reversals, and liability tracking. | None. Tier progression is intentionally disabled (system is points-only). |
| **Customer Feedback** | **Implemented** | `Backend/app/api/v1/customer/orders/[orderId]/feedback/`, `Backend/lib/feedback/service.ts` | Completed order gatekeeper and one-review-per-order invariant strictly enforced. | None. |
| **Customer Phone OTP** | **Implemented** | `Backend/lib/auth/otp.ts`, `Backend/lib/auth/otp-provider.ts` | Supports Twilio Verify, Twilio Messaging, and Mock provider. In production, mock mode is strictly rejected. | Upgraded Twilio account and TRAI/DLT template registration for live Indian SMS delivery. |
| **POS Kitchen & Payments** | **Implemented** | `Backend/app/api/v1/owner/orders/`, `Backend/app/api/v1/owner/dashboard/sales/` | Order status transitions and POS payment recording (Cash, Card, UPI) with concurrency locking. | Online customer pre-payment gateway (Razorpay/Stripe) is not yet wired to customer checkout. |
| **Dish Image Uploads** | **Implemented** | `Backend/app/api/v1/owner/menu/products/upload/`, `Backend/lib/media/cloudinary.ts` | Authenticated Cloudinary image upload with MIME validation and size limits. | Cloudinary API credentials in `.env`. |
| **Notification Recovery** | **Implemented** | `Backend/lib/notifications/service.ts`, `Backend/app/api/v1/internal/notifications/recover/` | Distributed database lease locks (`claimNotificationLease`) prevent duplicate dispatch. | Scheduled cron/EventBridge trigger to call recovery endpoint periodically. |
| **Reward Catalogue** | **Partially Implemented** | `Backend/app/api/v1/owner/loyalty/rewards/`, `Backend/lib/loyalty/service.ts` | Owner CRUD endpoints exist for catalogue items, but customer dine-in checkout uses direct rupee point redemptions. | UX decision on whether to support physical reward claims alongside bill discounts. |
| **AI Insights & Copilot** | **Preview / Demo Only** | `frontend/restaurant dashboard/src/features/insights/AiInsightsPage.tsx`, `Backend/prisma/schema.prisma` | Database schema models exist (`ai_insights`, `ai_agent_runs`), but no live LLM orchestration engine is currently connected. | LLM provider selection (Gemini / Claude / OpenAI API keys) and background analysis pipeline. |
| **CRM Customer Segments** | **Dormant Schema** | `Backend/prisma/schema.prisma` (`customer_segments`, `campaigns`) | Database tables exist from initial schema creation, but no backend REST endpoints currently operate on campaigns. | Product specification for marketing campaigns. |
| **Legacy Loyalty Tiers** | **Dormant Schema** | `customer_loyalty_accounts.tier` | Column defaults to `'bronze'` in database schema. Restrauque loyalty is strictly points-only; tier logic is unused. | Leave column inert for schema backward compatibility. |

---

## 2. Technical Debt & Development Notes

1. **Frontend Vite Dependency Inconsistencies**:
   - `frontend/landing page/` uses React 19 and Vite 6.
   - `frontend/restaurant dashboard/` uses React 18 and Vite 5.
   - `frontend/customer screen/customer_dashboard/` uses React 18 and Vite 5.
   - `frontend/customer screen/customer_ordering_side/` uses React 18 and Vite 6.
   - *Impact*: Applications must be built and run in their respective subdirectories; they do not share a single monorepo root package lockfile.

2. **Tracked Node Modules in Landing Page History**:
   - Early commits in Git history tracked `frontend/landing page/node_modules/`.
   - *Guideline*: Never run `git add .` indiscriminately from the root without verifying `git status`. Always discard `.vite/deps` changes prior to staging.

3. **In-Memory Notification Locks Across Scale**:
   - `Backend/lib/notifications/service.ts` utilizes an in-process `Set<string>` lock combined with a database-backed `read_at` lease.
   - While the database lease guarantees correctness across multiple cluster instances, high-scale multi-region deployments should adopt Redis for sub-millisecond lock acquisition.
