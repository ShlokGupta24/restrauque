# Antigravity Master Prompt — Restrauque Restaurant Dashboard

You are working in the existing `restaurant dashboard` project folder for Restrauque. Build a professional, functional restaurant-owner dashboard using the supplied PNG UI/UX references as the source of truth.

## Non-negotiable workflow

**Do not build every screen at once. Work in small, reviewable increments.**

### Phase 0 — inspect and plan only
Before writing or changing application code:

1. Inspect the entire project folder, current framework, package scripts, existing components, styles, routing, and installed dependencies.
2. Find and inspect every PNG reference image. If images are in `reference-images/`, inspect all of them. If they are stored elsewhere in the project, use their actual location. Do not assume filenames or infer designs from filenames alone.
3. Create a reference inventory: image filename, likely screen name, visible layout/components, visible actions, and confidence/unknowns.
4. Match the references to the confirmed scope in `docs/SCREEN_BUILD_PLAN.md`.
5. Propose the actual route map and transitions in `docs/ROUTES_AND_NAVIGATION.md`. Mark any transitions that cannot be established from the images as assumptions requiring user confirmation.
6. Review `docs/NEON_SCHEMA_UI_GUIDE.md` and identify which fields are supported by the known schema, which need backend/API support, and which are not represented in the database.
7. Report your proposed project structure, component plan, route map, and build order. **Do not implement screens during this phase.**
8. Ask the user to approve the plan and the first screen to implement.

### Phase 1 — implement one screen at a time
After approval:

1. Implement only the approved screen and the minimum shared shell/components required for it.
2. Match the reference image closely: theme, colors, typography, spacing, sizing, alignment, sidebar/topbar, cards, tables, charts, icons, borders, and responsive behavior. If the PNG and existing theme conflict, point it out instead of silently changing either.
3. Use real UI elements and components. Never use a full-screen PNG as the finished page.
4. Implement interactions visible or clearly implied by the approved screen. Buttons must do something meaningful or be explicitly marked as not yet wired; avoid fake controls that silently do nothing.
5. Use realistic typed sample data only if no backend API is available. Keep it in a dedicated mock/service layer and make the UI ready to switch to APIs.
6. Run the available lint, type-check, and build scripts. Fix errors caused by your changes.
7. Update `progressUpdate.md` with the screen completed, files changed, interactions implemented, commands/tests run and results, API/mock assumptions, known issues, and next suggested screen.
8. Show the user what changed and wait for approval before moving on.

### Phase 2 — connect data safely
Do not connect the browser directly to Neon. Do not put database credentials, connection strings, API secrets, or privileged keys in frontend code or environment variables exposed to the client.

Use a backend API/service layer. Before wiring any API, inspect the actual backend code and API contract. Do not claim an endpoint exists unless you found it. If an endpoint is missing, document the required endpoint and continue with the isolated mock service until the user approves backend work.

## Confirmed scope

Use `docs/SCREEN_BUILD_PLAN.md` as the scope checklist. The user has identified these main areas:

1. Overview
2. Orders, including Order Details
3. Menu & Products, including Edit Product
4. Tables & QR, including Edit Table
5. Coupons & Loyalty, with separate Coupons and Loyalty pages
6. Analytics
7. AI Insights
8. Feedback
9. Settings

The exact count of screens inside AI Insights and Settings, and any further dialogs or subpages, must be confirmed by inspecting the PNGs. Do not assume they each contain only one screen.

## Visual fidelity and quality rules

- Treat the PNG references as the visual source of truth; do not redesign the product on your own.
- Keep the same theme across screens and reuse shared layout/components.
- Preserve the established information hierarchy and navigation flow.
- Avoid adding unrequested features or extra navigation items.
- Use the project's existing stack and conventions where possible; do not replace the framework or rewrite the project without approval.
- Make loading, empty, error, and success states sensible where relevant, but do not let invented states change the reference design.
- Use accessible labels, keyboard-friendly controls, sensible focus states, and responsive layouts.
- Do not add charts, metrics, filters, form fields, or buttons unless they are in the reference or explicitly approved.
- Do not add fake AI behavior. If insights are mocked, label/sample them clearly in development and isolate the source.

## Database and domain correctness

- Read `docs/NEON_SCHEMA_UI_GUIDE.md` before building data-heavy screens.
- Do not assume the schema supports a field simply because it would be useful in the UI.
- Keep order status separate from payment status.
- Treat restaurant tables and QR codes as related but distinct entities.
- The known products schema does not show a stock quantity field. Do not fabricate inventory tracking as a persisted product field.
- Coupon rules such as per-customer limits, branch/product restrictions, or other advanced targeting must not be treated as database-backed unless verified in the actual schema or backend.
- Use the correct restaurant/branch scope if the existing app implements it; never hard-code a real restaurant ID.
- Respect currency/date formatting already used by the app or confirmed by the user; do not invent production values.

## Completion criteria for each screen

A screen is ready for review when:
- It is visually aligned with its reference PNG.
- Its links/actions follow the approved route map.
- The layout uses reusable components and is responsive.
- Data is typed and comes from an API/service or clearly isolated mock layer.
- No credentials are exposed.
- Relevant lint/type-check/build commands pass, or any pre-existing failures are clearly documented.
- `progressUpdate.md` is updated.
- The user has been shown the result and has approved moving forward.

Start with **Phase 0 only**. Inspect and report; do not code until the user approves.
