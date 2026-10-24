# Database Architecture & Neon PostgreSQL Reference

This document provides a comprehensive reference for the Restrauque database architecture, Neon PostgreSQL configuration, Prisma ORM schema, entity relationships, indexes, constraints, and migration practices.

---

## 1. Database Infrastructure & Connection Pooling

Restrauque uses **PostgreSQL 16** hosted on **Neon**, a serverless PostgreSQL platform.

### Connection Architecture
1. **Connection Pooling via PgBouncer**:
   Because Next.js route handlers execute in serverless and containerized Node.js environments where thousands of brief connections can overwhelm PostgreSQL, the database URL connects through Neon's pooled endpoint:
   ```
   DATABASE_URL="postgresql://user:password@endpoint-pooler.region.aws.neon.tech/neondb?sslmode=require"
   ```
2. **Prisma Client (`Backend/lib/db/prisma.ts`)**:
   In development, Prisma Client is cached on `globalThis` to prevent connection leaks during Next.js Hot Module Replacement (HMR).

---

## 2. Entity Relationship Diagram (ERD)

The following Mermaid diagram illustrates the primary operational models and relationships across restaurant tenancy, dining tables, menus, orders, feedback, and points-only loyalty:

```mermaid
erDiagram
    users ||--o{ restaurants : "owns"
    users ||--o{ user_sessions : "has"
    
    restaurants ||--o{ branches : "has"
    restaurants ||--o{ categories : "defines"
    restaurants ||--o{ products : "offers"
    restaurants ||--o{ coupons : "creates"
    restaurants ||--o| loyalty_programs : "configures"
    restaurants ||--o{ loyalty_rewards : "lists"
    
    branches ||--o{ restaurant_tables : "contains"
    restaurant_tables ||--o{ qr_codes : "has"
    
    products ||--o{ product_variants : "has"
    products ||--o{ product_addons : "has"
    categories ||--o{ products : "groups"
    
    customers ||--o{ customer_sessions : "maintains"
    customers ||--o{ orders : "places"
    customers ||--o{ customer_loyalty_accounts : "holds"
    
    orders ||--o{ order_items : "contains"
    order_items ||--o{ order_item_addons : "includes"
    orders ||--o{ payments : "settles"
    orders ||--o| feedback : "receives"
    
    customer_loyalty_accounts ||--o{ loyalty_transactions : "records"
    customer_loyalty_accounts }|--|| restaurants : "scoped to"
    
    orders }o--|| restaurant_tables : "seated at"
    orders }o--|| branches : "fulfilled by"
    orders }o--|| restaurants : "belongs to"
```

---

## 3. Comprehensive Model Groups (52 Prisma Models)

### Group 1: Users, Staff, Authentication & Sessions
- **`users`**: Platform administrators and restaurant owners (`id`, `email`, `password_hash`, `role`, `name`, `phone`, `status`, `created_at`, `updated_at`).
- **`user_sessions`**: Active sessions for owners/admins with unhashed SHA-256 tokens (`session_token_hash`, `expires_at`, `revoked_at`, `status`).
- **`restaurant_staff`**: Branch managers, kitchen staff, waitstaff (`id`, `restaurant_id`, `branch_id`, `name`, `role`, `phone`, `pin_code_hash`).
- **`staff_sessions`**: Active login sessions for restaurant floor staff.
- **`staff_permissions`**: Granular role-based capability grants for staff.
- **`permissions`**: Master permission dictionary (e.g., `pos:order_create`, `menu:edit`).
- **`staff_otp_verifications`**: OTP audit trail for staff phone verification.

### Group 2: Restaurant Tenancy & Branches
- **`restaurants`**: Core multi-tenant boundary (`id`, `name`, `legal_name`, `owner_id`, `timezone`, `country`, `status`). Foreign key references `users.id` with `onDelete: Restrict`.
- **`branches`**: Physical restaurant locations (`id`, `restaurant_id`, `name`, `phone`, `address`, `city`, `state`, `timezone`, `status`).
- **`audit_logs`**: Immutable security ledger tracking mutations across restaurant entities.

### Group 3: Dining Tables & Cryptographic QR Codes
- **`restaurant_tables`**: Physical tables inside a branch (`id`, `branch_id`, `table_number`, `capacity`, `status`). Unique index on `[branch_id, table_number]`.
- **`qr_codes`**: Dynamic QR credentials (`id`, `table_id`, `qr_token_hash`, `status`, `expires_at`). Only the SHA-256 hash of the 256-bit token is stored.

### Group 4: Menu, Categories, Products, Variants & Add-ons
- **`menus`**: Restaurant menu catalog headers.
- **`categories`**: Menu categories (`id`, `restaurant_id`, `name`, `sort_order`, `is_active`).
- **`products`**: Menu dishes (`id`, `restaurant_id`, `category_id`, `name`, `base_price`, `image_url`, `dietary_flags`, `is_available`, `is_active`).
- **`menu_products`**: Many-to-many junction mapping products across multiple seasonal menus.
- **`product_variants`**: Size, portion, or preparation variations (`id`, `product_id`, `name`, `price`, `is_available`).
- **`product_addons`**: Customizations and extra toppings (`id`, `product_id`, `name`, `price`, `is_available`).

### Group 5: Customers, Customer Sessions & OTP
- **`customers`**: Diners identified by phone number (`id`, `phone`, `name`, `email`, `status`). Unique index on `phone`.
- **`customer_sessions`**: Diners' active JWT session records (`session_token_hash`, `expires_at`, `status`).
- **`otp_verifications`**: Transient cryptographic verification challenges (`phone`, `otp_code_hash`, `attempts`, `expires_at`, `status`).

### Group 6: Orders, Line Items, Addons & Snapshots
- **`orders`**: Transactional orders (`id`, `order_number`, `restaurant_id`, `branch_id`, `table_id`, `customer_id`, `status`, `subtotal`, `discount_amount`, `loyalty_discount_amount`, `tax_amount`, `total_amount`, `points_redeemed`, `unrecovered_loyalty_points`, `ordered_at`, `completed_at`).
- **`order_items`**: Immutable order line item snapshots (`id`, `order_id`, `product_id`, `product_name`, `variant_id`, `variant_name`, `unit_price`, `quantity`, `total_price`).
- **`order_item_addons`**: Selected add-on snapshots (`addon_name`, `unit_price`, `total_price`, `quantity`).
- **`order_status_history`**: Audit trail of order lifecycle transitions (`placed` -> `confirmed` -> `preparing` -> `ready` -> `served` -> `completed` / `cancelled`).
- **`order_coupons`**: Junction record preserving coupon discounts applied to orders.

### Group 7: Payments & POS Settlements
- **`payments`**: POS payment settlements (`id`, `order_id`, `amount`, `payment_method`, `status`, `paid_at`).
- **`payment_transactions`**: Gateway transaction logs for digital/card integrations.

### Group 8: Coupons & Promotions
- **`coupons`**: Restaurant promotional codes (`id`, `restaurant_id`, `code`, `discount_type`, `discount_value`, `minimum_order_amount`, `maximum_discount_amount`, `usage_limit`, `usage_count`, `valid_from`, `valid_until`, `is_active`). Unique index on `[restaurant_id, code]`.

### Group 9: Customer Feedback & Reviews
- **`feedback`**: Order reviews (`id`, `order_id`, `customer_id`, `restaurant_id`, `rating`, `comment`, `created_at`). Enforces a strict 1-to-1 relationship with `orders` via unique constraint on `order_id`.
- **`feedback_products`**: Item-level 1-5 star ratings for individual dishes in an order.
- **`feedback_aspects`**: Structured tagging of food quality, ambience, speed of service, and value.
- **`feedback_topics`**: Clustered feedback discussion topics.
- **`feedback_embeddings`**: Vector representations for AI semantic search.

### Group 10: Points-Only Loyalty Accounting
- **`loyalty_programs`**: Restaurant loyalty rules (`id`, `restaurant_id`, `is_active`, `earning_mode`, `stars_per_visit`, `stars_per_review`, `redemption_rate`). Unique index on `restaurant_id`.
- **`customer_loyalty_accounts`**: Diner balance at a specific restaurant (`id`, `customer_id`, `restaurant_id`, `stars_balance`, `lifetime_stars_earned`, `lifetime_stars_redeemed`, `tier`, `status`). Unique index on `[customer_id, restaurant_id]`.
- **`loyalty_transactions`**: Append-only double-entry transaction ledger (`id`, `loyalty_account_id`, `order_id`, `transaction_type`, `stars`, `description`, `created_at`).
- **`loyalty_rewards`**: Optional reward catalogue for item redemptions (`id`, `restaurant_id`, `reward_type`, `stars_required`, `discount_amount`, `discount_percentage`, `product_id`, `is_active`).
- **`loyalty_redemptions`**: Record of catalogue reward claims.

### Group 11: Transactional Notifications
- **`notifications`**: SMS/Email dispatch queue and audit ledger (`id`, `restaurant_id`, `customer_id`, `order_id`, `channel`, `status`, `read_at` as distributed lease lock, `created_at`).

### Group 12: AI Intelligence, Analytics & CRM Segments
- **`ai_insights`**, **`ai_insight_evidence`**, **`ai_agent_runs`**, **`ai_agent_actions`**: Generated operational recommendations and automated agent execution history.
- **`analytics_daily_metrics`**, **`analytics_product_metrics`**, **`customer_metrics`**: Pre-aggregated reporting data for owner dashboards.
- **`customer_segments`**, **`customer_segment_members`**, **`customer_events`**, **`campaigns`**, **`campaign_recipients`**: Diner engagement and campaign tracking.

---

## 4. Key Performance Indexes & Constraints

| Table | Index / Constraint Name | Indexed Fields | Purpose |
| :--- | :--- | :--- | :--- |
| `restaurants` | `idx_restaurants_owner_id` | `owner_id` | High-speed resolution of owner restaurant context |
| `branches` | `idx_branches_restaurant_id` | `restaurant_id` | Fast branch filtering under restaurant tenancy |
| `restaurant_tables` | `unique_table_number_per_branch` | `[branch_id, table_number]` | Prevents duplicate table numbers in a branch |
| `qr_codes` | `idx_qr_codes_token_hash` | `qr_token_hash` | O(1) table lookup when customer scans QR code |
| `orders` | `idx_orders_restaurant_id` | `restaurant_id` | Scopes order queries to authorized restaurant |
| `orders` | `idx_orders_customer_id` | `customer_id` | Fast retrieval of customer dining history |
| `orders` | `idx_orders_status` | `status` | Filters live POS kitchen queue |
| `customer_loyalty_accounts`| `unique_customer_restaurant_loyalty` | `[customer_id, restaurant_id]` | Single authoritative points balance per restaurant |
| `feedback` | `unique_feedback_order_id` | `order_id` | Guarantees exactly one feedback submission per order |

---

## 5. Migration Practices & Safety Rules

- **Schema Location**: `Backend/prisma/schema.prisma`
- **Migration SQL Scripts**: `Backend/prisma/migrations/`
- **Client Generation**: Run `npx prisma generate` in `Backend/` whenever `schema.prisma` is updated.
- **Production Guardrail**: Never run destructive migration commands (`prisma migrate reset` or manual `DROP TABLE`) against production databases.
