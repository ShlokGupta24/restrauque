# Restrauque Restaurant Dashboard — Progress Update

## Current status

- [x] Phase 0: inspect project and all PNG references
- [x] Confirm reference-image inventory and screen-to-PNG mapping
- [x] Confirm route/navigation map
- [x] User approves implementation plan
- [x] Screen 01: Overview
- [x] Screen 02: Orders list
- [x] Screen 03: Order Details
- [x] Screen 04: Menu & Products
- [x] Screen 05: Edit Product
- [x] Screen 06: Tables & QR
- [x] Screen 07: Edit Table (Add Table modal)
- [x] Screen 08: Coupons & Edit Coupon
- [x] Screen 09: Loyalty
- [x] Screen 10: Analytics
- [x] Screen 11: AI Insights
- [x] Screen 12: Feedback
- [x] Screen 13: Settings & Subscriptions

## Implementation log

### Stage C: Architecture Foundation & Shell
- **Files created:** `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/styles/tokens.css`, `src/styles/main.css`, `src/types/domain.ts`, `src/types/entitlements.ts`, `src/context/RestaurantContext.tsx`, `src/context/EntitlementContext.tsx`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/DashboardLayout.tsx`, `src/app/router.tsx`, `src/app/App.tsx`, `src/main.tsx`.
- **Interactions/navigation implemented:** Multi-tenant branch switching context, typed feature entitlement checks (`useFeatureAccess`), client-side routing hierarchy with fallback placeholders.

### Screen 01: Overview
- **Reference PNG(s):** `reference-images/Overview.png`
- **Files created/changed:** `src/features/overview/OverviewPage.tsx`, `src/features/overview/OverviewPage.css`, `src/services/mockData.ts`.
- **Components reused/created:** `Sidebar`, `Topbar`, `DashboardLayout`, `OverviewPage`, `PlaceholderScreen`.
- **Interactions/navigation implemented:**
  - Branch selection dropdown toggling Hazratganj / Gomti Nagar branches.
  - Export report action trigger.
  - Interactive SVG revenue area chart with gradient and week day axis.
  - Top-selling products progress bar list.
  - Recent orders table with clickable rows navigating directly to `/dashboard/orders/RB-1082`.
  - "View orders ↗" button navigating to `/dashboard/orders`.
  - Restrauque Intelligence card with "AI insights ↗" button navigating to `/dashboard/ai-insights`.
  - Floating bottom-right "✦ AI preview · not connected" action.
- **Data source:** Typed development mock data (`src/services/mockData.ts`).
- **Schema/API gaps:** Stored metric definitions, AOV denominator policies, and status enums pending backend confirmation.
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1593 modules transformed, bundle produced). Dev server running at `http://localhost:5173/`. Verified in browser subagent with full visual match against `Overview.png`.
- **Known issues or deviations from reference:** None. Layout and styling strictly align with `Overview.png`.
- **User review:** Approved.

### Screen 02: Orders List & Screen 03: Order Details
- **Reference PNG(s):** `reference-images/Orders.png` & `reference-images/orderDetails.png`
- **Files created/changed:** `src/features/orders/OrdersPage.tsx`, `src/features/orders/OrdersPage.css`, `src/features/orders/OrderDetailsPage.tsx`, `src/features/orders/OrderDetailsPage.css`, `src/services/mockData.ts`, `src/app/router.tsx`.
- **Components reused/created:** `OrdersPage`, `OrderDetailsPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - Orders list filters: Search by order ID or customer name, filter by Order status, filter by Payment status, branch selection.
  - 4 KPI summary cards (Total 1,200, Completed 1,058, Cancelled 142, Payment status Not available).
  - 7 sample orders with itemized breakdowns and calculated amounts.
  - "View detail" link on any row navigates directly to `/dashboard/orders/:orderId`.
  - Order Details page displays Order context, Item breakdown (Paneer Tikka Wrap, Add-ons), calculation formula, status history, order totals, and applied coupons.
  - "Change status" action with interactive status update modal.
  - "← Back to orders" button returns cleanly to `/dashboard/orders`.
- **Data source:** Typed development mock data (`src/services/mockData.ts`).
- **Schema/API gaps:** Order status vs payment status separation maintained; live transition endpoints pending backend.
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1597 modules transformed). Verified in browser subagent with full visual match against `Orders.png` and `orderDetails.png`.
- **Known issues or deviations from reference:** None.
- **User review:** Approved (Create order button removed per user request).

### Screen 04: Menu & Products & Screen 05: Edit Product
- **Reference PNG(s):** `reference-images/menu.png` & `reference-images/editProducts.png`
- **Files created/changed:** `src/features/menu/MenuProductsPage.tsx`, `src/features/menu/MenuProductsPage.css`, `src/features/menu/EditProductPage.tsx`, `src/features/menu/EditProductPage.css`, `src/services/productData.ts`, `src/app/router.tsx`.
- **Components reused/created:** `MenuProductsPage`, `EditProductPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - 3 KPI summary cards (Active products 48, Available now 44, Unavailable now 4).
  - Search input, Category filter, Availability filter, and Active filter.
  - Table item rows with thumbnail previews, category names, prices, active status, and availability toggle switch.
  - Toggling availability switch updates state immediately and shifts status pill between "Available" (green) and "Unavailable" (amber).
  - "Edit" button on any product row navigates to `/dashboard/menu/products/:productId/edit` with prefilled values.
  - "+ Add product" button opens `/dashboard/menu/products/create` in Create mode with blank fields.
  - Edit Product page has Name, Description, Price, Category, Display order, Image URL with live preview, Variants list with individual active/available toggles, Add-ons list, Publishing card, and Menu membership section.
  - "Create mode" / "Edit mode" toggle button in the header.
  - "Back to products" and "Cancel" buttons navigate cleanly back to `/dashboard/menu`.
- **Data source:** Typed development mock data (`src/services/productData.ts`).
- **Schema/API gaps:** Stock quantity is omitted strictly in adherence to schema boundary. Menu membership persistence and dynamic categories require backend contracts.
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1602 modules transformed). Verified in browser subagent with full visual match against `menu.png` and `editProducts.png`.
- **Known issues or deviations from reference:** None.
- **User review:** Approved.

### Screen 06: Tables & QR & Screen 07: Add Table Modal
- **Reference PNG(s):** `reference-images/Tables&QR.png` & `reference-images/addTables.png`
- **Files created/changed:** `src/features/tables/TablesQrPage.tsx`, `src/features/tables/TablesQrPage.css`, `src/features/tables/AddTableModal.tsx`, `src/features/tables/AddTableModal.css`, `src/services/tableData.ts`, `src/app/router.tsx`.
- **Components reused/created:** `TablesQrPage`, `AddTableModal`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - 4 KPI cards: Total tables (12), Active QR codes (12), Total scans (1,840), Orders via QR (1,120).
  - Zone filtering tabs: All, Indoor, Outdoor, Terrace, Bar, Private Dining with dynamic counts.
  - Active tables grid displaying table card with badge status, capacity, location, QR status, and last scanned date.
  - Selecting any table updates the right-hand QR Code Detail & Actions panel with deterministic QR URL (`https://restrauque.app/r/hazratganj/:table`), SVG QR illustration, Download SVG/PNG, Copy link, and Print signage actions.
  - "+ Add table" button opens the interactive Add Table Modal matching `addTables.png`.
  - Modal features form inputs (Table number, Capacity, Zone/Location, QR Code Identifier, Active status toggle), live synchronized grid card preview, and generated URL payload preview.
  - "Save & Generate QR" updates table list state in real time and automatically selects the newly created table.
- **Data source:** Typed development mock data (`src/services/tableData.ts`).
- **Schema/API gaps:** Table entity has capacity, location, is_active, qr_code_id; deterministic URL generation per branch.
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1605 modules transformed). Verified in browser subagent with full visual match against `Tables&QR.png` and `addTables.png`.
- **User review:** Approved.

### Screen 08: Coupons & Screen 09: Edit / Create Coupon
- **Reference PNG(s):** `reference-images/coupons and loyalty.png` & `reference-images/editCoupons.png`
- **Files created/changed:** `src/features/coupons/CouponsPage.tsx`, `src/features/coupons/CouponsPage.css`, `src/features/coupons/EditCouponPage.tsx`, `src/features/coupons/EditCouponPage.css`, `src/services/couponData.ts`, `src/app/router.tsx`.
- **Components reused/created:** `CouponsPage`, `EditCouponPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - 4 KPI cards: Active coupons (3), Global usage count (464), Global usage limit (870), Within validity window (2).
  - Navigation tabs: "🏷 Coupons 5" active, and "☆ Loyalty & Rewards 3 Tiers" which navigates directly to `/dashboard/loyalty`.
  - Scope pills: All Offers, Coupons Only, Points & Cashback.
  - Filter bar: All / Active / Inactive segmented control, search input by coupon code or name, validity window dropdown, and CSV Export.
  - Coupons table with live Active toggles: Clicking any switch toggles active state in the store and recalculates active KPIs immediately.
  - Clicking any coupon row or "Edit" button navigates directly to `/dashboard/coupons/:couponId/edit` with prefilled values matching `editCoupons.png`.
  - "+ Create coupon" action (both top-right and bottom-right) opens `/dashboard/coupons/create` in Create mode with blank fields.
  - Edit Coupon page features Coupon identity card, Discount definition card, Validity window card, Activation card with validity summary, Global usage limits and readonly usage count, and Informational cards.
  - "Create mode" / "Edit mode" toggle button in the header.
  - "Cancel" and "Save changes" buttons handle local state updates and navigate back to `/dashboard/coupons`.
- **Data source:** Typed development mock data (`src/services/couponData.ts`).
- **Schema/API gaps:** Discount type enum pending from backend; no per-customer caps or claim ledger in current schema.
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1612 modules transformed). Verified in browser subagent with full visual match against `coupons and loyalty.png` and `editCoupons.png`.
- **User review:** Approved.

### Screen 09: Loyalty & Loyalty Setup Page
- **Reference PNG(s):** `reference-images/loyalty.png`
- **Files created/changed:** `src/features/loyalty/LoyaltySetupPage.tsx`, `src/features/loyalty/LoyaltySetupPage.css`, `src/services/loyaltyData.ts`, `src/features/loyalty/LoyaltyView.tsx`, `src/features/loyalty/LoyaltyView.css`, `src/features/coupons/CouponsView.tsx`, `src/features/coupons/CouponsPage.tsx`, `src/features/coupons/CouponsPage.css`, `src/components/layout/Sidebar.tsx`, `src/app/router.tsx`.
- **Components reused/created:** `LoyaltyView`, `LoyaltySetupPage`, `CouponsView`, `CouponsPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - Integrated Coupons and Loyalty under a unified smooth sliding container with GPU-accelerated horizontal shift.
  - Added dedicated **Loyalty Program Setup Page** at `/dashboard/loyalty/setup` to configure and launch a dining rewards program.
  - Setup form includes: Program identity (name, customer tagline, active status), earning rules (mode, stars per ₹100 spent, stars per visit, stars per review, min order amount), 3 reward tier definitions (Bronze, Silver, Gold VIP with thresholds, multipliers and perks), live customer mobile pass preview card, redemption formula, and expiry policies.
  - "Save & Activate Program" saves configured details to `loyaltyData.ts` store and seamlessly populates the Loyalty dashboard.
  - Loyalty dashboard dynamically updates: Program configuration card displays live program name, earning mode, active toggle, stars per visit/review, and "Edit program" button; Account detail preview card reflects live tier and balances; Rewards card displays configured tiers; Accounts table card displays 5 enrolled customer accounts with real-time star balances, tier badges, and active statuses.
- **Data source:** State-backed loyalty store (`src/services/loyaltyData.ts`).
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1618 modules transformed). Verified in browser subagent with program configuration, dynamic fields update (tested changing program name and stars per visit), and bidirectional navigation.
- **Known issues or deviations from reference:** None.
- **User review:** Approved.

### Screen 10: Analytics & Reports
- **Reference PNG(s):** `reference-images/Analytics.png`
- **Files created/changed:** `src/features/analytics/AnalyticsPage.tsx`, `src/features/analytics/AnalyticsPage.css`, `src/services/analyticsData.ts`, `src/app/router.tsx`.
- **Components reused/created:** `AnalyticsPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - 4 KPI summary cards (Total revenue ₹1,42,850 [+12.8%], Completed orders 1,058 [+8.4%], AOV ₹135 [+3.2%], Returning customers 365).
  - Timeframe dropdown (`Last 7 days`, `Last 30 days`, `This month`, `Year to date`) with reactive dataset recalculation.
  - Interactive SVG revenue area chart with gradient fill, grid lines, data points, and hover tooltips showing precise rupee amounts.
  - Top products by revenue with ranked progress bars and formatted revenues.
  - Order source mix breakdown cards (54%, 31%, 15%) totaling 1,058 orders.
  - Schema coverage card documenting `Schema` vs `Needed` integration notes.
- **Data source:** Typed development mock data (`src/services/analyticsData.ts`).
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1621 modules transformed). Verified in browser subagent.
- **User review:** Approved.

### Screen 11: AI Insights
- **Reference PNG(s):** `reference-images/AIinsights.png`
- **Files created/changed:** `src/features/insights/AiInsightsPage.tsx`, `src/features/insights/AiInsightsPage.css`, `src/services/insightsData.ts`, `src/components/layout/DashboardLayout.tsx`, `src/components/layout/DashboardLayout.css`, `src/components/layout/Sidebar.tsx`, `src/app/router.tsx`.
- **Components reused/created:** `AiInsightsPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - Header: Title `AI Insights`, subtitle `No records supplied · branch and filters resolve through the backend.`, and `Disabled / No endpoint` button.
  - Hero Dark Banner (`#18181B`): Red square with 4-point star icon, `PREVIEW` pill, `No AI insights yet` headline, evidence description, and disabled button.
  - Middle Row 3 Cards:
    1. `No AI insights yet` with `NO DATA` / `PENDING RECORDS` pills, `REQUIRED FIELDS` monospace specification block for `ai_insights` and `ai_insight_evidence`, and `Confirm with backend` action.
    2. `Severity filters` with `SEVERITY` / `NEUTRAL PLACEHOLDERS` pills, 4 `Backend value pending` items, and `Confirm with backend` action.
    3. `Status filters` with `STATUS` / `NEUTRAL PLACEHOLDERS` pills, 4 `Backend value pending` items, and `Confirm with backend` action.
  - Bottom Row 2 Cards:
    1. `Inventory is not in current schema` with `SCHEMA BOUNDARY` / `BACKEND REQUIRED` pills, `Future integration only` explanation, and `Confirm with backend` action.
    2. `Agent roadmap` with `AGENT CAPABILITIES` / `FUTURE CAPABILITY` pills, `Future capability notes` box, and `Confirm with backend` action.
  - Safety rule note at bottom: `Safety rule: recommendations must be traceable...`
  - Floating bottom-right AI preview CTA dynamically displays in neutral inactive styling (`#edeae7`, `#52525b`) when on `/dashboard/ai-insights`, matching `AIinsights.png`.
  - Interactive "Confirm with backend" modal dialog showing full Neon schema specifications, column attributes, and clipboard copy.
  - Interactive "Preview Simulated Insights" toggle showing realistic, evidence-backed recommendations (e.g. Biryani surge +38.5%, Table 4 QR conversion drop, Combos opportunity) with confidence badges, metric diffs, trace citations, and owner approval controls.
- **Data source:** Typed development mock data (`src/services/insightsData.ts`).
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1624 modules transformed). Verified in browser subagent.
- **Known issues or deviations from reference:** None. Layout and styling strictly align with `AIinsights.png`.
- **User review:** Approved.

### Screen 12: Feedback & Reviews
- **Reference PNG(s):** `reference-images/feedback.png`
- **Files created/changed:** `src/features/feedback/FeedbackPage.tsx`, `src/features/feedback/FeedbackPage.css`, `src/services/feedbackData.ts`, `src/components/layout/Sidebar.tsx`, `src/components/layout/Topbar.tsx`, `src/components/layout/Topbar.css`, `src/app/router.tsx`.
- **Components reused/created:** `FeedbackPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - Sidebar navigation updated: Added **Feedback** between Coupons & Loyalty and Analytics & Reports with `MessageSquare` icon and active red selection state matching `feedback.png`.
  - Topbar breadcrumb displays `BASIL & BRICK / OWNER / SCHEMA ALIGNED`, page title `Feedback`, and dynamic amber badge `● FUTURE READY`.
  - Subtitle: `Feedback / Future Ready / No Data · Aggregate review concept; no submitted feedback or analytics supplied.`
  - Filter bar: Branch dropdown (`Hazratganj · DEMO ⌄`), Date range (`📅 01–07 Oct 2026 · DEMO`), and Refresh action (`🔄 Refresh feedback`).
  - 3 KPI summary cards: Average rating (`Not available`), Feedback count (`Not available`), Period coverage (`Not available`).
  - Left column:
    1. *Rating distribution card:* 5 star rows (5, 4, 3, 2, 1 stars) with neutral gray empty tracks and `Not available` counts. Bottom note clarifying neutral tracks.
    2. *Topics & aspects card:* Table header with `Topic / aspect`, `Returned aggregate`, `Period`, and empty message `No topics or aspects yet`.
  - Right column:
    1. *Order-linked feedback card:* Rating, Comment, Submitted at, and Status pill (`Not available`), clickable `Confirm with backend` link, and `Open associated order` action button.
    2. *Review boundaries card:* `No data yet` sub-heading and backend authorization boundaries description.
  - Page bottom notice: `Design only · No live data connection. Backend owns validation, authorization and transactions.`
  - Interactive "Confirm with backend" modal dialog detailing table specs for `feedback`, `feedback_topics`, and `feedback_aspects` with copy-to-clipboard functionality.
  - Interactive "Preview Demo Feedback" toggle: Shows realistic customer reviews (4.6 / 5.0, 128 reviews, gradient progress bars, topic breakdowns), and enables `Open associated order` which navigates seamlessly to `/dashboard/orders/RB-1082`.
- **Data source:** Typed development mock data (`src/services/feedbackData.ts`).
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1627 modules transformed). Verified in browser subagent.
- **Known issues or deviations from reference:** None. Layout and styling strictly align with `feedback.png`.
- **User review:** Approved.

### Screen 13: Settings & Subscriptions
- **Reference PNG(s):** `reference-images/settings.png`
- **Files created/changed:** `src/features/settings/SettingsPage.tsx`, `src/features/settings/SettingsPage.css`, `src/services/settingsData.ts`, `src/context/RestaurantContext.tsx`, `src/app/router.tsx`.
- **Components reused/created:** `SettingsPage`, `Sidebar`, `Topbar`, `DashboardLayout`.
- **Interactions/navigation implemented:**
  - Sidebar: `Settings` is active in brand red with gear icon. Feature access preview card at bottom with `Manage access` button navigating directly to subscription settings.
  - Topbar breadcrumb displays `BASIL & BRICK / SETTINGS / DEMO` and title `Restaurant & Branch`.
  - Subtitle: `Restaurant, branch and staff context · demo values · backend authorization required.`
  - Left settings navigation card: `Settings` title and 6 vertical tabs (`Restaurant profile`, `Branches`, `Team & permissions`, `QR menu appearance`, `Subscription & features`, `Integrations`).
  - Restaurant profile form: Authenticated restaurant context inputs prefilled with `Basil & Brick`, `owner@basilbrick.example`, `Hazratganj, Lucknow`, `INR — Indian Rupee ⌄ · DEMO`. "Save changes" updates `RestaurantContext` and displays a confirmation toast banner.
  - Subscription & feature access card: 3 selectable plan tiers (`Operate`, `Intelligence` [Selected default with red dot, border, and `PREVIEW` tag], and `Autonomous`). Selecting any tier dynamically updates `EntitlementContext` across the entire application in real time.
  - Caveat note: `Prototype only: backend must enforce every entitlement for all endpoints and actions; hiding navigation is not access control.`
  - Additional tabs supported: Branches (capacities, GST, tables), Team & staff roles (RBAC roles), QR menu brand customization, and Hardware & service integrations (Neon DB, Razorpay, Thermal POS).
- **Data source:** Typed development mock data (`src/services/settingsData.ts`) and global contexts (`RestaurantContext`, `EntitlementContext`).
- **Commands run:** `npm run build` (tsc -b && vite build), `npm run dev`.
- **Results:** Clean build succeeded (0 errors, 1629 modules transformed). Verified in browser subagent with full visual match against `settings.png`.
- **Known issues or deviations from reference:** None.
- **User review:** Ready for review.
- **Milestone:** All 13 core screens from design references and the build plan are now fully built, wired, interconnected, and verified!
