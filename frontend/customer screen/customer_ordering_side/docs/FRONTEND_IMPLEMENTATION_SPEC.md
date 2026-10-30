# Frontend Implementation Specification

## 1. Product goal
Implement one shared mobile-first customer ordering website for Restrauque. Each restaurant has its own identity, but the ordering flow and underlying components are shared. The customer arrives using a restaurant table QR code, browses the menu, selects products, authenticates with mobile number/OTP when required, checks the order/payment summary, places an order through the backend, and optionally reviews the completed order and each item.

## 2. Visual direction
Use the supplied second UI concept as design inspiration, not as an exact copy:
- Warm ivory page background.
- Deep navy primary actions.
- Restrained neutral surfaces and thin borders.
- Clear sans-serif typography with strong hierarchy.
- Real product imagery from API `image_url` when present.
- Simple, aligned product rows/cards; modest corner radii; subtle transitions.
- Avoid AI-looking visual clutter: no random decorative blobs, excessive gradient cards, invented marketing sections, unnecessary chips/badges, fake star averages, fake review counts, fake prep times, fake ratings, or oversized illustrations.
- Primary target is mobile (QR entry), with proper tablet and desktop layouts.
- Use natural transitions around 150–250ms and respect `prefers-reduced-motion`.

## 3. Required UI flow
1. QR entry resolver: `/q/:qrToken` (suggested path; reconcile with router).
2. Restaurant landing/menu home: restaurant name, branch/table label, optional approved logo/branding configuration, “Explore Menu”, simple category preview, cart indicator.
3. Menu: active categories, search, products sorted by `display_order`, price/description/image, availability state, add action.
4. Product detail: product name and description, image, price, active variants, active add-ons, quantity, optional special instructions. Only render controls supported by actual API contract.
5. Cart: items, variant/add-on snapshots, quantity/remove/edit, notes, server-priced totals, continue/checkout.
6. Mobile auth: phone entry and OTP verification. Preserve QR context and cart. UI can be built in mock mode, but real OTP must be backend verified.
7. Checkout/payment summary: order snapshot, `subtotal`, `discount_amount`, `tax_amount`, `total_amount`, selected supported payment method. Do not hard-code tax, coupon, or payment rules.
8. Order confirmation: only after API confirms order creation; show customer-facing `order_number`, restaurant and table label, appropriate status.
9. Order tracking: show statuses provided by API and `order_status_history` if exposed. Never invent a tracking timeline.
10. Post-completion feedback prompt: only when the API confirms order completed. Optional/dismissible.
11. Feedback form: one overall order rating/comment; per-product written comments for every distinct ordered product. Product-level star input must not imply persistent storage unless a schema change is approved.
12. Feedback success state and order history entry, using only verified backend responses.

## 4. Do not show internal schema in UI
Table and column names are contracts for developers only. The customer sees terms such as “Your order”, “Table F18”, “Total”, “How was this item?”, and human-readable order status labels. Never show:
- `restaurants`, `orders`, `feedback_aspects`, or other table names.
- UUIDs, foreign keys, raw QR tokens, internal transaction IDs.
- `status` enum tokens without mapping to clear customer labels.
- OTP table details, session hashes, internal database errors, stack traces.
- schema field labels such as `total_amount` or `feedback_type`.

## 5. Theme configuration
Keep all theme values in `frontend/src/config/restaurantTheme.ts`. Screens must consume semantic tokens and never hard-code brand colors. Branding values from the QR-resolved API should override local defaults after validation. Theme properties are not confirmed as columns on `restaurants`; treat them as a separate API/config contract requiring backend agreement.

## 6. Data source switching
UI components must use domain services/hooks, not import mock arrays directly. Use a service-provider switch (for example, `VITE_DATA_MODE=mock|api`) or an equivalent typed strategy. Keep mock data only under `frontend/src/mocks/`. The mock provider must implement the same interfaces as the API provider. Default behavior must be explicit; production deployments must not accidentally fall back to mock mode.

## 7. Error and loading states
Every API-backed screen must handle loading, empty, error, retry, disabled/unavailable product, expired QR, expired OTP, authentication failure, invalid order request, payment failure, already-submitted feedback, and feedback submission errors where relevant.

## 8. Code quality
- Follow existing React + TypeScript + Vite conventions.
- Inspect current code before proposing file moves.
- Use strict types; avoid `any`.
- Create reusable components only for genuinely shared UI.
- Keep pages focused, API calls in services/hooks, theme in config, mock fixtures in one location.
- Comments should explain decisions and non-obvious behavior; no comments that simply restate code.
- Add unit tests for price presentation boundaries, cart behavior, feedback validation and route/context preservation.
- Run lint, typecheck, tests and build, recording real results.

## 9. Suggested structure
Adapt to the repository instead of blindly recreating files:
```text
frontend/src/
  app/                 # router, providers, app setup
  layouts/             # customer layout and responsive navigation
  features/
    restaurant/        # QR context, landing/home
    menu/              # category/product browsing
    cart/              # cart state and UI
    auth/              # phone/OTP screens
    checkout/          # summary and supported payment UI
    orders/             # confirmation, status, history
    feedback/           # completion prompt and review form
  components/           # shared buttons, fields, modal, skeletons
  config/
    restaurantTheme.ts  # all branding tokens/defaults
  services/
    contracts/          # typed API response/input types
    api/                # API client and API implementations
    mock/               # optionally only adapters; fixtures remain in mocks/
  mocks/
    restaurant.ts
    menu.ts
    order.ts
    feedback.ts
  hooks/
  utils/
```
Keep mock fixture data under one clearly removable directory and keep service interfaces stable when switching to live endpoints.
