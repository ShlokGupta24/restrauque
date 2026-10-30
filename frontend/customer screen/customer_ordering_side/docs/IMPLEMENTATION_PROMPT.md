# Prompt for Antigravity — Build the Restrauque Customer Frontend

Read every file in `frontend/docs/`, the shared contracts, the current source tree, existing dashboard/owner app conventions and supplied visual reference image(s) before editing.

Implement the customer-facing frontend against `FRONTEND_IMPLEMENTATION_SPEC.md` and `NEON_SCHEMA_UI_MAPPING.md`.

Must do:
1. Audit current code and report files/routes that already exist; do not overwrite working code blindly.
2. Build the reference-inspired, uniquely Restrauque UI: warm ivory canvas, navy action color, compact restaurant/table header, promo/coins UI only if the backend/config supports it, pure-veg filter only if a reliable vegetarian attribute exists in the verified API (the currently confirmed `products` columns do not include one, so otherwise omit it or keep it clearly as a frontend demo-only filter until the API gains that property), search, menu categories, food product list and sticky cart affordance.
3. Use restaurant names, table labels, categories, and products from the API; use mocks only in the isolated mock provider.
4. Add complete path through product details, cart, mobile login/OTP, checkout, order confirmation and post-completion feedback.
5. Add the feedback form exactly as documented. Feedback prompt appears only after server-confirmed completion and is dismissible.
6. Implement all theme tokens in `src/config/restaurantTheme.ts`. Colors, fonts, radius and branding values must come from a single typed `RestaurantThemeConfig`. Do not create multiple theme categories/preset pages. A local default is for development; an API-backed theme config is a separate contract because those values are not currently confirmed as restaurant table columns.
7. Ensure UI components do not directly import mock fixture files. Build a stable interface/adapter and select mock/API mode through explicit development configuration. Prevent production builds from accidentally using mock data.
8. Use accessible semantics, responsive mobile-first layout, tasteful micro-interactions and `prefers-reduced-motion`.
9. Keep Neon schema hidden from the customer. No UUIDs/internal fields in copy, no raw database errors, no client-side Neon connection.
10. Test cart calculations as a display model only; final prices come from backend. Add tests for theme override, QR-context retention across auth, feedback required/optional fields and status-gated prompt.
11. Run actual lint/typecheck/test/build commands and report results without claiming unrun tests passed.

First deliver an audit and a plan. Then implement in small increments, beginning with the menu landing screen. Do not change database schema or invent endpoints independently of the backend contract.
