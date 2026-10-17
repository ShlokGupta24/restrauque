# Frontend UI ↔ Neon Schema Mapping

This is developer-facing documentation. Do not surface schema names or raw database fields in customer-facing UI.

Database context previously inspected: Neon project `resro_intelligence`, branch `production`, database `neondb`, schema `public`. Verify this against the current project before implementation. No schema changes are authorized by this document.

## Restaurant and QR entry
- `restaurants`: known fields include `id`, `name`, `legal_name`, `email`, `phone`, `address`, `city`, `state`, `country`, `timezone`, `status`, `created_at`, `updated_at`, `owner_id`.
- `branches`: known fields include `id`, `restaurant_id`, `name`, `address`, `city`, `state`, `country`, `phone`, `timezone`, `status`, timestamps.
- `restaurant_tables`: known fields include `id`, `branch_id`, `table_number`, `capacity`, `status`, `is_active`, timestamps.
- `qr_codes`: known fields include `id`, `table_id`, `code`, `qr_type`, `is_active`, timestamps.
Backend resolves an opaque QR identifier into public restaurant/branch/table context. Do not trust raw browser-supplied IDs or expose UUIDs.

Brand logo, hero image, color palette, and font are not confirmed as columns on `restaurants`; get them from a separate approved restaurant-theme configuration API. Until that exists, use a local mock theme only in development.

## Menu
- `categories`: `id`, `restaurant_id`, `name`, `description`, `display_order`, `is_active`, timestamps.
- `menus`: `id`, `restaurant_id`, `name`, `description`, `is_active`, timestamps.
- `menu_products`: exists in schema; verify exact columns/relationship and how active menu memberships are queried before use.
- `products`: `id`, `restaurant_id`, `category_id`, `name`, `description`, `price`, `image_url`, `display_order`, `is_available`, `is_active`, timestamps.
- `product_variants`: `id`, `product_id`, `name`, `price`, `display_order`, `is_available`, `is_active`, timestamps.
- `product_addons`: `id`, `product_id`, `name`, `price`, `is_available`, `is_active`, `display_order`, timestamps.
Only show active/available records. Do not invent product calories, ingredient/allergen data, stock quantity, ratings, prep time, inventory, or discount labels. Query relationship through the verified backend contract; don’t assume columns not documented here.

## Customer auth
- `customers`: known fields include `id`, `name`, `phone`, `status`, `first_visit_at`, `last_visit_at`, timestamps.
- `otp_verifications`: columns include phone, purpose, expires_at, verified_at, attempts, max_attempts, status, timestamps; `otp_code` must never be shown or returned to the browser.
- `customer_sessions`: includes customer ID, `session_token_hash`, expires/last-used/revoked/status/timestamps. Never expose session hashes. Verify exact auth flow in existing backend; table presence does not prove SMS/OTP provider integration exists.

## Cart/order
- `orders`: `id`, `restaurant_id`, `branch_id`, nullable `table_id`, `customer_id`, `order_number`, `order_type`, `status`, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, `notes`, `ordered_at`, `completed_at`, timestamps, idempotency fields.
- `order_items`: `id`, `order_id`, `product_id`, nullable `variant_id`, `product_name`, nullable `variant_name`, `quantity`, `unit_price`, `total_price`, `special_instructions`, `created_at`.
- `order_item_addons`: `id`, `order_item_id`, nullable `product_addon_id`, `addon_name`, `quantity`, `unit_price`, `total_price`, timestamp.
- `order_status_history`: `id`, `order_id`, `status`, `changed_at`, `notes`, timestamp.
Backend calculates final prices and validates current product availability. Item product-name/price snapshots should be used for historical receipts. Keep payment status separate from order status.

## Coupons and payments
- `coupons`: known fields include `id`, `restaurant_id`, `code`, `name`, `description`, `discount_type`, `discount_value`, `minimum_order_amount`, `maximum_discount_amount`, `usage_limit`, `usage_count`, `valid_from`, `valid_until`, `is_active`, timestamps.
- `order_coupons`: `order_id`, `coupon_id`, `coupon_code`, `discount_type`, `discount_value`, `discount_amount`, timestamp.
- `payments`: `id`, `order_id`, `amount`, `payment_method`, `status`, `transaction_reference`, `paid_at`, timestamps.
- `payment_transactions`: `id`, `payment_id`, `provider`, `transaction_id`, `provider_transaction_id`, `amount`, `currency`, `status`, `response_code`, `response_message`, initiated/completed and audit timestamps.
Show only methods supported by the verified backend. Never show raw gateway messages, credentials, or internal transaction identifiers. Don't hardcode taxes or mark payment paid until backend confirmation.

## Feedback
- `feedback`: known columns: `id`, `restaurant_id`, `branch_id`, `order_id`, `customer_id`, nullable integer `rating` constrained to 1–5, nullable `comment`, `feedback_type` default `review`, `status` default `published`, `submitted_at`, timestamps.
- `feedback_aspects`: known columns: `id`, `feedback_id`, nullable `product_id`, required `aspect`, required `sentiment` (positive/negative/neutral/mixed), nullable `aspect_value`, nullable `confidence` 0–1, timestamps.
- `feedback_topics`: `id`, `feedback_id`, `topic`, `sentiment`, nullable `confidence`, timestamps.
- `feedback_products` also exists; exact columns were not confirmed in the current inspection. Inspect before use.
Overall order rating/comment map to `feedback`. Item-specific written comments can map to `feedback_aspects` with `product_id`, a backend-approved `aspect` value (e.g. `item_review`), and `aspect_value`. `feedback_aspects` has no order_item_id and no numeric per-item rating. Don't promise persisted per-product stars without approved schema/API extension. Because `sentiment` is required, backend must implement/approve a consistent default or classifier policy; frontend must not invent sentiment.

## Customer display rules
Translate database data into friendly user copy. Internal table/column names, UUIDs, status tokens, session hashes, OTP data, SQL/stack traces, and raw provider response values must never be surfaced.
