# Complete API Reference & Endpoint Catalog

This document is the authoritative catalog of all 60 REST API endpoints implemented in `Backend/app/api/v1/`.

---

## Standard Request & Response Conventions

### Success Envelope
All successful API responses return a standardized JSON envelope formatted by `Backend/lib/http/response.ts`:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "meta": {
    "timestamp": "2026-10-24T15:00:00.000Z"
  }
}
```

### Error Envelope
All error responses conform to `Backend/lib/http/errors.ts`:
```json
{
  "success": false,
  "data": null,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Specific error description",
    "details": [ ... ]
  },
  "meta": {
    "timestamp": "2026-10-24T15:00:00.000Z"
  }
}
```

---

## 1. Authentication Endpoints (`/api/v1/auth/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/auth/owner/register` | Public | Register a new restaurant owner account. |
| `POST` | `/api/v1/auth/owner/login` | Public | Login with email and password; issues HttpOnly session cookie. |
| `POST` | `/api/v1/auth/register` | Public | Generic user registration endpoint. |
| `POST` | `/api/v1/auth/login` | Public | Generic user authentication endpoint. |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revokes current session in database and clears auth cookie. |
| `GET` | `/api/v1/auth/me` | Authenticated | Restores active user profile and verifies session validity. |
| `POST` | `/api/v1/auth/customer/otp/request` | Public | Initiates SMS OTP delivery via Twilio Verify or Mock provider. |
| `POST` | `/api/v1/auth/customer/otp/verify` | Public | Verifies 6-digit OTP code and creates customer session cookie. |
| `POST` | `/api/v1/auth/customer/logout` | Customer | Revokes customer session and clears auth cookie. |
| `GET` | `/api/v1/auth/test-protected` | Authenticated | Diagnostic test for general auth guard. |
| `GET` | `/api/v1/auth/test-protected/customer` | Customer | Diagnostic test for customer role guard. |
| `GET` | `/api/v1/auth/test-protected/owner` | Owner | Diagnostic test for restaurant owner role guard. |

---

## 2. Public QR Resolution (`/api/v1/public/qr/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/public/qr/[token]` | Public | Resolves dining table, branch, and restaurant branding from a 256-bit QR token. Verifies table and branch active status. |

---

## 3. Customer Dine-In Ordering & History (`/api/v1/customer/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/customer/menu` | Public | Retrieves active categories, products, variants, and add-ons for the table's restaurant. Query param: `?restaurantId=UUID`. |
| `POST` | `/api/v1/customer/orders/preview` | Public / Customer | Calculates server-authoritative line totals, coupon discounts, and points redemption discounts without committing. |
| `POST` | `/api/v1/customer/orders` | Customer | Transactionally creates a dining order. Enforces idempotency via `idempotencyKey` and row-level locks on loyalty balances. |
| `GET` | `/api/v1/customer/orders` | Customer | Fetches customer's past orders with base64url cursor-based pagination (`?cursor=...&limit=10`). |
| `GET` | `/api/v1/customer/orders/[orderId]` | Customer | Retrieves itemized receipt and live preparation timeline for an order. |
| `GET` | `/api/v1/customer/dashboard/overview` | Customer | Aggregates diner stats, multi-restaurant loyalty balances, and recent visit history. |

---

## 4. Customer Feedback & Loyalty (`/api/v1/customer/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/customer/orders/[orderId]/feedback` | Customer | Evaluates feedback eligibility for an order (enforces order status = `completed` and prevents duplicate reviews). |
| `POST` | `/api/v1/customer/orders/[orderId]/feedback` | Customer | Submits 1-5 star ratings and item reviews. Atomically awards loyalty review points (`stars_per_review`). |
| `GET` | `/api/v1/customer/feedback` | Customer | Lists submitted feedback and past completed orders eligible for review. |
| `GET` | `/api/v1/customer/loyalty` | Customer | Retrieves diner's points balance, recent transaction ledger, and earning rules. Query param: `?restaurantId=UUID`. |

---

## 5. Owner Restaurant & Branch Management (`/api/v1/owner/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/context` | Owner | Resolves primary restaurant, active branches, and owner account profile. |
| `GET` | `/api/v1/owner/verify-access` | Owner | Verifies owner tenancy access without payload overhead. |
| `GET` | `/api/v1/owner/restaurants` | Owner | Lists all restaurants owned by the authenticated caller. |
| `GET` | `/api/v1/owner/restaurant` | Owner | Retrieves comprehensive profile of the owner's primary restaurant. |
| `PUT` | `/api/v1/owner/restaurant` | Owner | Updates restaurant legal name, contact email, phone, and timezone. |
| `GET` | `/api/v1/owner/branches` | Owner | Lists all active branches for the authorized restaurant. |
| `POST` | `/api/v1/owner/branches` | Owner | Creates a new physical branch location. |
| `GET` | `/api/v1/owner/branches/[branchId]` | Owner | Retrieves branch details with tenancy verification. |
| `PUT` | `/api/v1/owner/branches/[branchId]` | Owner | Updates branch address, phone number, and operating status. |

---

## 6. Owner Menu, Variants & Cloudinary Uploads (`/api/v1/owner/menu/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/menu/summary` | Owner | Retrieves counts of total products, active categories, and out-of-stock items. |
| `GET` | `/api/v1/owner/menu/categories` | Owner | Lists menu categories ordered by sort position. |
| `POST` | `/api/v1/owner/menu/categories` | Owner | Creates a new menu category. |
| `PUT` | `/api/v1/owner/menu/categories/[categoryId]` | Owner | Updates category name, sort order, or active state. |
| `DELETE` | `/api/v1/owner/menu/categories/[categoryId]` | Owner | Soft-archives category (sets `is_active: false`). |
| `GET` | `/api/v1/owner/menu/products` | Owner | Retrieves paginated dish list with category and dietary filters. |
| `POST` | `/api/v1/owner/menu/products` | Owner | Creates a new menu item with optional base price, image, and flags. |
| `POST` | `/api/v1/owner/menu/products/upload` | Owner | Uploads dish photo to Cloudinary; returns secure CDN URL. |
| `GET` | `/api/v1/owner/menu/products/[productId]` | Owner | Retrieves dish details including all variants and add-ons. |
| `PUT` | `/api/v1/owner/menu/products/[productId]` | Owner | Updates product name, description, price, and availability. |
| `DELETE` | `/api/v1/owner/menu/products/[productId]` | Owner | Soft-archives product (sets `is_active: false`). |
| `GET` | `/api/v1/owner/menu/products/[productId]/variants` | Owner | Lists portions/sizes for a dish. |
| `POST` | `/api/v1/owner/menu/products/[productId]/variants` | Owner | Creates a new portion/size variant. |
| `PUT` | `/api/v1/owner/menu/products/[productId]/variants/[variantId]` | Owner | Updates variant pricing and availability. |
| `DELETE` | `/api/v1/owner/menu/products/[productId]/variants/[variantId]` | Owner | Archives variant. |
| `GET` | `/api/v1/owner/menu/products/[productId]/addons` | Owner | Lists customizable add-ons/toppings for a dish. |
| `POST` | `/api/v1/owner/menu/products/[productId]/addons` | Owner | Creates a new add-on with unit pricing. |
| `PUT` | `/api/v1/owner/menu/products/[productId]/addons/[addonId]` | Owner | Updates add-on details. |
| `DELETE` | `/api/v1/owner/menu/products/[productId]/addons/[addonId]` | Owner | Archives add-on. |

---

## 7. Owner Dining Tables & QR Codes (`/api/v1/owner/tables/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/tables` | Owner | Lists branch dining tables with table numbers, capacity, and QR codes. |
| `POST` | `/api/v1/owner/tables` | Owner | Creates a table and generates a 256-bit cryptographically secure QR token. |
| `GET` | `/api/v1/owner/tables/[tableId]` | Owner | Retrieves table configuration. |
| `PUT` | `/api/v1/owner/tables/[tableId]` | Owner | Updates table capacity or number. |
| `GET` | `/api/v1/owner/tables/[tableId]/qr` | Owner | Returns current QR token string and customer dine-in deep link. |
| `GET` | `/api/v1/owner/tables/[tableId]/qr/image` | Owner | Generates and streams dynamic high-resolution PNG QR image in brand colors. |
| `POST` | `/api/v1/owner/tables/[tableId]/qr/rotate` | Owner | Atomically revokes old QR token and generates a fresh token. |

---

## 8. Owner POS Orders, Payments & Analytics (`/api/v1/owner/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/orders` | Owner | Live POS kitchen queue with status filtering (`placed`, `preparing`, `ready`, etc.). |
| `GET` | `/api/v1/owner/orders/[orderId]` | Owner | Detailed POS order view including items, add-on snapshots, and customer notes. |
| `PATCH` | `/api/v1/owner/orders/[orderId]/status` | Owner | Updates order status; triggers automated order completion tasks (notifications, spend loyalty points) or cancellation reversals. |
| `POST` | `/api/v1/owner/orders/[orderId]/payments` | Owner | Records POS bill settlement (cash, card, UPI) with concurrency locking. |
| `GET` | `/api/v1/owner/dashboard/sales` | Owner | Computes gross sales, net billed sales, discount totals, payment methods, and hourly trends. |

---

## 9. Owner Promotional Coupons (`/api/v1/owner/coupons/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/coupons` | Owner | Lists restaurant promotional coupons. |
| `POST` | `/api/v1/owner/coupons` | Owner | Creates percentage or fixed-amount discount coupon. |
| `GET` | `/api/v1/owner/coupons/[couponId]` | Owner | Retrieves coupon details and usage statistics. |
| `PUT` | `/api/v1/owner/coupons/[couponId]` | Owner | Updates coupon validity dates, discount values, and limits. |
| `DELETE` | `/api/v1/owner/coupons/[couponId]` | Owner | Soft-archives coupon (`is_active: false`). |

---

## 10. Owner Feedback Management (`/api/v1/owner/feedback/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/feedback` | Owner | Lists verified diner reviews with star ratings, dish feedback, and aspect scores. |

---

## 11. Owner Points-Only Loyalty Accounting (`/api/v1/owner/loyalty/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/owner/loyalty/rules` | Owner | Retrieves active loyalty rules (points per visit, points per review, redemption rate). |
| `PUT` | `/api/v1/owner/loyalty/rules` | Owner | Updates points earning and rupee redemption rate rules. |
| `GET` | `/api/v1/owner/loyalty/accounts` | Owner | Paginated customer points balances and lifetime statistics. |
| `GET` | `/api/v1/owner/loyalty/accounts/[accountId]` | Owner | Complete double-entry points ledger history for a specific customer. |
| `GET` | `/api/v1/owner/loyalty/rewards` | Owner | Lists catalogue rewards for point redemptions. |
| `POST` | `/api/v1/owner/loyalty/rewards` | Owner | Creates new item in reward catalogue. |
| `PUT` | `/api/v1/owner/loyalty/rewards/[id]` | Owner | Updates reward details or deactivates reward. |
| `GET` | `/api/v1/owner/loyalty/rewards/[id]/redemptions` | Owner | Lists redemptions for a specific reward. |
| `GET` | `/api/v1/owner/orders/loyalty/liabilities` | Owner | Lists cancelled orders with outstanding unrecovered loyalty points. |
| `POST` | `/api/v1/owner/orders/[orderId]/loyalty/recover` | Owner | Attempts recovery of outstanding loyalty liability from customer balance. |

---

## 12. Internal Automation & Recovery (`/api/v1/internal/*`)

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/internal/notifications/recover` | Internal Cron (`INTERNAL_API_SECRET`) | Background sweeper that re-dispatches unread or failed order notifications using distributed database lease locks. |

---

## 13. System Health

| Method | Endpoint | Role / Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/v1/health` | Public | Returns system status, environment, and Neon PostgreSQL database connectivity. |
