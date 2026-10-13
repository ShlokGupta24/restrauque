# Neon Schema to UI Guide — Restrauque Restaurant Dashboard

## Purpose and limitations

This guide captures the schema observations available to the project. Antigravity must inspect the actual database schema and backend/API code again before implementing data access. This document is not a live database connection or a guarantee that endpoints exist.

Known Neon project context from prior schema review:
- Project label: `resro_intelligence`
- Branch: `production`
- Database name: `neondb`
- Schema: `public`

Never place credentials or connection strings in frontend source. The browser must call a backend API; the backend owns database connectivity and authorization.

## Known domain tables

The previously inspected schema included these tables:

`restaurants`, `branches`, `users`, `restaurant_staff`, `categories`, `menus`, `menu_products`, `products`, `product_variants`, `product_addons`, `orders`, `order_items`, `order_status_history`, `payments`, `payment_transactions`, `coupons`, `order_coupons`, `restaurant_tables`, `qr_codes`, `customers`, `customer_metrics`, `feedback`, `feedback_topics`, `feedback_aspects`, `loyalty_programs`, `customer_loyalty_accounts`, `loyalty_rewards`, `loyalty_redemptions`, `loyalty_transactions`, `analytics_daily_metrics`, `analytics_product_metrics`, `ai_insights`, `ai_insight_evidence`, `ai_agent_runs`, `ai_agent_actions`, `campaigns`, `customer_segments`.

Verify current names, columns, constraints, foreign keys, indexes, and enum/status values before relying on them.

## Screen-to-domain mapping

| UI area | Likely domain tables | Important caution |
|---|---|---|
| Overview | `analytics_daily_metrics`, `orders`, `analytics_product_metrics`, `ai_insights` | Verify metric definitions and date/branch scope; use no fake production totals. |
| Orders / Order Details | `orders`, `order_items`, `order_status_history`, `payments`, `payment_transactions`, `customers`, `order_coupons` | Keep order status separate from payment status. Verify whether payment fields live on `payments` or `payment_transactions`. |
| Menu & Products / Edit Product | `menus`, `menu_products`, `categories`, `products`, `product_variants`, `product_addons` | Known product fields include `name`, `description`, `price`, `image_url`, `display_order`, `is_available`, `is_active`, `category_id`. Verify exact current schema. |
| Tables & QR / Edit Table | `restaurant_tables`, `qr_codes`, `branches` | Tables and QR codes are separate entities; do not treat a QR code as the table record itself. |
| Coupons | `coupons`, `order_coupons` | Known coupon fields include `code`, `name`, `discount_type`, `discount_value`, `minimum_order_amount`, `maximum_discount_amount`, `usage_limit`, `usage_count`, `valid_from`, `valid_until`, `is_active`. Verify before use. |
| Loyalty | `loyalty_programs`, `customer_loyalty_accounts`, `loyalty_rewards`, `loyalty_redemptions`, `loyalty_transactions`, `customers` | Do not assume every loyalty capability shown in a design is implemented in the schema. |
| Analytics | `analytics_daily_metrics`, `analytics_product_metrics`, `orders` | Confirm aggregation rules, date ranges, branch scope, and definitions with backend/schema. |
| AI Insights | `ai_insights`, `ai_insight_evidence`, `ai_agent_runs`, `ai_agent_actions` | Do not claim a live AI result or execute actions unless an actual backend service supports it. |
| Feedback | `feedback`, `feedback_topics`, `feedback_aspects`, `customers` | Verify fields for rating, comments, timestamps, response status, and customer relation. |
| Settings | `restaurants`, `branches`, `users`, `restaurant_staff` and other verified settings tables | The exact settings schema is not confirmed by this guide. Do not assume every setting is persisted. |

## Schema gaps to handle explicitly

- The previously inspected `products` fields did **not** include a stock quantity field. Do not present stock/inventory quantity as a persisted product attribute unless the current schema or a migration confirms it.
- The previously inspected `coupons` fields did **not** show per-customer limits or branch/product restrictions. Do not represent these as database-backed rules without verification.
- Order status and payment status are different concepts and should be displayed/updated separately.
- Tables and QR codes are separate entities with potentially different lifecycles.
- Any field visible in a PNG but absent from the schema should be logged as a schema/API gap. Do not quietly drop it or pretend it saves successfully.

## Data and API rules

1. Inspect the existing backend and its API contract before connecting the UI.
2. Do not invent API endpoint names as if they already exist.
3. If the API is missing, define the required request/response contract in a separate note and use typed mock data in a dedicated service layer until backend work is approved.
4. Validate user input in the UI and again on the server.
5. Use the authenticated user's restaurant/branch context; never hard-code a production tenant ID.
6. Handle loading, empty, error, and success states.
7. Avoid leaking secrets and enforce authorization on the server.
8. Keep UI display labels distinct from stored enum/status values; map statuses explicitly.
9. Use realistic development sample data, clearly marked as mock. Never mix fake values into production responses.

## Required mapping table after PNG inspection

For every field/metric shown in a screen, document:
- UI label and screen
- source table/column or computed metric
- data type and formatting
- filter/date/branch scope
- read/write behavior
- API endpoint if verified, or mark `not implemented`
- mock status, if applicable
- schema migration/backend work required
