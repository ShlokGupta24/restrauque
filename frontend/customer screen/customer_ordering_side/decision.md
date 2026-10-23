# Architectural & Implementation Decision Log

This log records every key design, architectural, dependency, and pattern decision made across the codebase, along with the technical rationale, trade-offs considered, and mitigation strategies.

---

## 1. Architectural & Core Stack Decisions

### Decision 01: Toolchain Selection — Vite + React 18 + TypeScript
- **Context**: The customer frontend must be fast, mobile-optimized, easily embeddable into QR codes, and strictly typed against backend contracts.
- **Decision**: Selected Vite 6 + React 18 with TypeScript 5.
- **Why this approach**:
  - Vite offers near-instant hot module replacement (HMR) and optimized rollup production bundles (~155 KB total bundle size).
  - React 18 is stable, battle-tested, and has full compatibility with utility packages (`lucide-react`, `canvas-confetti`).
  - TypeScript provides strict compile-time validation for DTO models, preventing database internal schema leaks.
- **Trade-offs Accepted**:
  - Chosen over Next.js/SSR because QR web-apps are client-session driven; static single-page application (SPA) architecture enables simple deployment to edge CDNs (Vercel, Cloudflare, S3) with zero server-side rendering latency overhead.

---

### Decision 02: Service Abstraction Pattern (`CustomerDataService`)
- **Context**: Per specification (`FRONTEND_IMPLEMENTATION_SPEC.md`), UI components must not import mock fixtures directly, and the application must support switching between offline/mock preview and real backend endpoints without modifying UI code.
- **Decision**: Implemented `CustomerDataService` interface, fulfilled by both `MockDataService` and `ApiDataService`, controlled by `VITE_DATA_MODE`.
- **Why this approach**:
  - Screens and components only consume `customerDataService.*` methods.
  - Mock fixtures remain in `src/mocks/` and will never leak into production API requests.
  - Adding or modifying endpoints requires updates only in `ApiDataService.ts`.
- **Trade-offs Accepted**:
  - Requires maintaining matching signatures in both mock and API adapters, but guarantees that mock testing reflects real-world contracts.

---

### Decision 03: Lightweight State-Driven Router (`AppProvider`)
- **Context**: The ordering flow is a sequential, state-preserving journey (Landing → Menu → Product Details → Cart → Auth → Checkout → Confirmation → Feedback) initiated from a physical table QR scan.
- **Decision**: Implemented internal stack-based screen routing (`navigateTo`, `goBack`, `screenHistory`) inside `AppProvider`.
- **Why this approach**:
  - Standard browser URL navigation inside in-app webviews (e.g. Instagram, WeChat, or generic camera QR readers) often causes unexpected refreshes, loss of session storage, or broken URL state.
  - Screen stack navigation ensures instant transitions (150–250ms), effortless back-traversal, and zero risk of losing items in the cart or QR table context.
- **Trade-offs Accepted**:
  - Deep-linking directly to sub-screens requires setting the screen state in `AppProvider` (e.g. via QR token resolver), which is handled cleanly in `resolveQrContext`.

---

### Decision 04: Centralized CSS Custom Property Theme Injection
- **Context**: The specifications require a single source of truth for restaurant branding (`src/config/restaurantTheme.ts`) with warm ivory (`#FCF8ED`) and deep navy (`#174A82`) default tokens.
- **Decision**: Created `applyRestaurantTheme()` which injects approved semantic CSS variables into `document.documentElement` (`--brand-primary`, `--page-background`, `--card-radius`, etc.).
- **Why this approach**:
  - Avoids brittle CSS-in-JS runtimes and complex stylesheet rebuilds.
  - When the backend provides a custom restaurant theme contract (`restaurant-theme.contract.json`), the application can update the visual palette at runtime with zero page reload.
- **Trade-offs Accepted**:
  - Restricts theme properties to predefined semantic tokens, preventing arbitrary or insecure CSS injection from untrusted sources.

---

### Decision 05: Mobile-First Max-Width Framing (`CustomerLayout`)
- **Context**: Customer ordering is primarily used on mobile devices via QR codes. However, developers and restaurant operators often inspect it on laptops or tablets.
- **Decision**: Wrapped pages in `.customer-shell` with a centered `max-width: 480px` layout, subtle desktop backdrop framing (`#EFECE3`), and elevated elevation shadows.
- **Why this approach**:
  - On phones, the layout fills 100% of the screen seamlessly.
  - On desktop/tablet, the layout remains a realistic mobile simulation without stretched cards, distorted images, or awkward wide typography.
- **Trade-offs Accepted**:
  - Tablet/desktop does not expand into a multi-column dashboard, which aligns strictly with the project requirement for a dedicated customer ordering mobile experience.

---

## 2. Library & Dependency Decisions

| Library | Selected Alternative | Why Selected | Trade-off Accepted |
| :--- | :--- | :--- | :--- |
| **`lucide-react`** | FontAwesome / Material Icons | Modern, lightweight, SVG tree-shakeable, matches UIUX mockup style exactly (clean lines, round joins) | Requires individual component imports |
| **`canvas-confetti`** | Lottie / heavy animation CSS | Zero-dependency canvas confetti for the order confirmation celebration | Canvas-based rendering rather than SVG DOM elements |
| **Vanilla CSS + Variables** | TailwindCSS / styled-components | Full control over custom properties, zero build-time utility bloat, exactly adheres to project rules | Writing explicit CSS classes per screen |

---

## 3. Screen 01 Implementation Decisions

- **Monogram Avatar ("R")**: Implemented as an elegant circular serif badge with `#EADBCC` background matching `01-restaurant-landing.png`, with fallback support for an image `logoUrl` when provided by the backend.
- **Hero Image Overlay**: Applied a subtle two-stage linear gradient (`rgba(15, 15, 15, 0.78)` to `transparent`) over the hero food image to guarantee high text contrast and legibility regardless of the uploaded background image.
- **Category Filter Separation**: Excluded the synthetic `'cat-all'` option from the 2×3 circular grid on Screen 01, reserving `'cat-all'` exclusively for the full menu view (Screen 02). Clicking any circular category (e.g. *Beverages*) automatically navigates to Screen 02 with that category pre-selected.
- **Floating Cart Indicator**: Implemented a sticky bottom bar that conditionally mounts whenever items exist in the cart, providing a direct shortcut to the Cart screen (`Screen 04`).

---

## 4. White-Label Reusability & Multi-Tenant Architectural Decisions

### Decision 06: Decoupled Multi-Tenant Core Architecture
- **Context**: The customer ordering frontend must serve different restaurants identically without code modifications, adapting dynamically to each restaurant's theme, logo, name, table, and menu catalog.
- **Decision**:
  - The UI codebase contains zero hardcoded restaurant names, IDs, or static menu lists.
  - All restaurant identity attributes (`name`, `logoUrl`, `tableLabel`, `heroTitle`, `heroSubtitle`, `heroImageUrl`) are injected dynamically through `useApp().restaurant`.
  - Brand colors, fonts, and radii are injected via CSS Custom Properties by `applyRestaurantTheme()` on startup or QR resolution.
  - Categories and products are requested dynamically via `customerDataService.getCategories()` and `customerDataService.getProducts()`.
- **Trade-offs Accepted**:
  - Requires fallback states/defaults (like generic monogram avatar 'R' when no logo is supplied) to ensure flawless display across arbitrary restaurant profiles.

---

## 5. Screen 02 Implementation Decisions

### Decision 07: Live Search & Smart Add Delegation
- **Context**: Screen 02 provides both quick-browsing and direct ordering from a compact card layout.
- **Decision**:
  - **Instant Search**: Implemented client-side filtering via `useMemo` that evaluates name and description substrings against `searchQuery` without network roundtrips.
  - **Smart Add Delegation**: When tapping the `+` button on a product:
    - If the product has multiple variants (e.g. Regular vs Large) or optional add-ons, the application automatically routes to `Screen 03 (ProductDetailScreen)` to capture customer choices accurately.
    - If the item is simple with a single default variant and no required add-ons, it immediately increments the cart quantity and displays the floating bottom cart bar.
- **Trade-offs Accepted**:
  - Direct 1-tap add is reserved for simple items to prevent accidental omission of necessary item customization.

---

## 6. Screen 03 Implementation Decisions

### Decision 08: Reactive Price Calculation & Deterministic Cart Keying
- **Context**: Screen 03 permits customers to configure product sizes (variants) with price deltas and check/uncheck optional paid add-ons before adding them in variable quantities.
- **Decision**:
  - **Reactive Price Calculation**: Memoized `unitPrice` and `totalPrice` synchronously update as the user selects variants, toggles add-ons, or taps the quantity stepper `[-] qty [+]`.
  - **Deterministic Cart Keying**: To prevent line-item collision, each cart entry generates an immutable composite key: `${productId}-${variantId}-${selectedAddonIds.sort().join('_')}`.
    - If a customer adds a *Large Iced Latte with Extra Shot*, and later adds another *Large Iced Latte with Extra Shot*, the application cleanly increments the quantity of that existing row.
    - If they configure a *Regular Iced Latte with Whipped Cream*, it creates a distinct separate line item.
- **Trade-offs Accepted**:
  - Client calculates display pricing for immediate responsiveness, but final financial validation is enforced by `customerDataService.calculateBill()` and verified server-side on order creation.

---

## 7. Screen 04 Implementation Decisions

### Decision 09: Cart State Hydration, Dynamic Bill Calculation & Auth-Gated Checkout Transition
- **Context**: The cart must allow granular item management (stepper modification, line deletion), dynamic coupon application, and tax calculations, while cleanly gating checkout based on customer authentication.
- **Decision**:
  - **Dynamic Bill Calculation**: Bill details (Subtotal, Discount, Tax, Total) are evaluated through `customerDataService.calculateBill()`, ensuring promotional discounts (e.g. `WELCOME10` providing 10% discount) update tax bases and totals accurately.
  - **Context-Preserving Auth Gate**: When the customer taps *"Proceed to Checkout"*:
    - If `auth.isAuthenticated` is `false`, the app transitions to `Screen 05 (MobileLoginScreen)` while preserving all cart contents and table context.
    - If `auth.isAuthenticated` is `true`, the app proceeds directly to `Screen 07 (PaymentOrderSummaryScreen)`.
  - **Zero-Friction Empty State**: If a user navigates to the cart without items, it displays a clean empty state with an *"Explore Menu"* CTA and a *"Load sample items from reference design"* option for testing and evaluation.
- **Trade-offs Accepted**:
  - Requires maintaining live bill recalculation hooks in `AppContext`, but guarantees total price integrity across all cart mutations.

---

## 8. Screen 05 Implementation Decisions

### Decision 10: Phone Sanitization, Privacy Messaging & Nonce Session Storage
- **Context**: Screen 05 initiates customer authentication required prior to final order persistence, without exposing sensitive database session tokens or raw OTP hashes.
- **Decision**:
  - **Client-Side Digit Sanitization**: Strict input masking `/^\d{0,10}$/` prevents malformed inputs and eliminates country-code parsing ambiguities by standardizing on `+91`.
  - **Explicit Privacy Assurances**: Added the security trust badge (*"Your number is safe with us. We'll only use it for order-related updates."*) with a shield icon directly below the CTA, reducing user abandonment during mobile verification.
  - **QR & Order State Retention**: Navigating to `Screen 05` leaves all existing cart items, table context, and applied coupon codes unaltered in `AppContext`. If a user clicks back (`<`), their cart remains intact.
- **Trade-offs Accepted**:
  - Restricts phone number format to standard 10-digit mobile layout (matching standard Indian mobile dining formats in the UI mockup).

---

## 9. Screen 06 Implementation Decisions

### Decision 11: Session Persistence Lifecycle, Expiration Windows & Re-Order Friction Elimination
- **Context**: Customers frequently place multiple orders during a single dining session (e.g. initial drinks, then main courses, then desserts). Requiring repeated OTP verification on every order causes severe friction.
- **Decision**:
  - **4-Hour Dining Session Window**: Successful OTP verification writes a signed/hashed session object (`{ phone, token, expiresAt }`) to `localStorage.setItem('restrauque_customer_session', ...)`.
  - **Automatic Expiration Validation**: On application initialization, `AppProvider` checks `Date.now() < session.expiresAt`.
    - If valid, the user remains authenticated across page reloads, order placements, and menu re-visits.
    - If expired, the stored session is automatically purged, triggering secure re-authentication.
  - **Explicit Logout**: Exposed a `logout()` method in `AppContext` for immediate session termination when needed.
- **Trade-offs Accepted**:
  - Storing auth tokens in `localStorage` requires HTTPS in production and zero exposure of internal database credentials.

### Decision 12: Dual-Input OTP Matrix & Auto-Submission
- **Context**: Screen 06 must feel native on mobile touch devices while remaining fully accessible and responsive on desktop/laptop web browsers.
- **Decision**:
  - **On-Screen Numerical Keypad**: Implemented an authentic iOS/Android styled numeric keypad (digits 1–9, 0, and backspace `⌫`) matching the reference mockup layout.
  - **Global Keyboard Listener**: Added physical keyboard event hooks (`^[0-9]$` and `Backspace`) for desktop testers and physical keyboards.
  - **Auto-Submission**: Entering the 6th digit automatically triggers `verifyAndLogin()`, removing the need for an unnecessary extra "Submit" button click.
- **Trade-offs Accepted**:
  - Auto-submitting on 6th digit requires rapid validation feedback and clear error recovery if an incorrect code is entered.

---

## 10. Screen 07 Implementation Decisions

### Decision 13: Order Snapshot Immutability, Pay-at-Restaurant Method & Context Change
- **Context**: Screen 07 summarizes the dining contract (restaurant, table, line items, final pricing, payment selection) before transactional creation.
- **Decision**:
  - **Location & Table Visibility**: Rendered the prominent location card with a pin icon in a light peach container (`#FBECE8`), explicitly reinforcing restaurant identity (`NBC - Engineering College`) and table assignment (`Table F18`), with a *"Change"* shortcut to return to landing if needed.
  - **Pay at Restaurant as Default**: In accordance with the reference mockup and dining spec (`BACKEND_API_CONTRACT.md`), supported payment is initialized to *"Pay at Restaurant (Cash / Card / UPI)"* with an integrated store icon. This avoids inventing unverified online payment gateways and matches the in-restaurant physical service model.
  - **Atomic Order Placement**: Clicking *"Place Order"* triggers `customerDataService.createOrder()`. Only after server/mock confirms creation is `activeOrderId` populated, the active cart purged via `clearCart()`, and the app routed to `Screen 08 (OrderConfirmationScreen)`.
- **Trade-offs Accepted**:
  - Payment is recorded as a pay-at-counter/table intent rather than immediate gateway settlement, which accurately matches the physical dining scenario.

---

## 11. Screen 08 Implementation Decisions

### Decision 14: Confetti Micro-interaction, Strict Schema Masking & Gated Feedback Transition
- **Context**: Screen 08 provides customer assurance immediately following transactional order placement, displaying customer-safe receipt metadata without exposing raw database UUIDs or internal status tokens.
- **Decision**:
  - **Celebration Micro-Interaction**: Integrated `canvas-confetti` upon mount, matching the festive colorful confetti dots in reference `08-order-confirmation.png` to create an elevated emotional payoff upon successful order receipt.
  - **Strict Neon Schema Masking**: In strict compliance with `FRONTEND_IMPLEMENTATION_SPEC.md` and `NEON_SCHEMA_UI_MAPPING.md`, all database column names (`orders`, `table_id`, `status` enum keys, idempotency tokens) are masked. Customers see human-readable labels:
    - `order_number` → `#NBC1234`
    - `restaurant_name` → `NBC - Engineering College`
    - `table_number` → `F18`
    - `ordered_at` → `12 Dec 2024, 1:24 PM`
  - **Gated Feedback Entry**: Post-completion review submission (`Screen 09 (FeedbackScreen)`) is conditionally unlocked only when the order status reaches `completed`.
- **Trade-offs Accepted**:
  - Included an interactive kitchen status simulator in development/mock mode (`Status: Preparing in Kitchen` → `Mark Done`) so evaluators can test the complete lifecycle through to post-completion feedback without needing an external kitchen display system.

---

## 12. Screen 09 Implementation Decisions

### Decision 15: Two-Tier Feedback Schema Mapping, Per-Dish Star Ratings & Post-Submission Reset
- **Context**: Customers need the ability to rate both their overall restaurant experience and each individual ordered dish using star ratings (1–5) and dish-specific comment inputs, while maintaining alignment with backend contracts (`customer-feedback.contract.json` and Neon database `feedback_aspects`).
- **Decision**:
  - **Two-Tier Review Separation & Dish-Level Stars**:
    - **Overall Experience Rating**: 1–5 stars recorded at the order level, with an optional overarching comment note.
    - **Per-Dish Star Ratings**: Each ordered dish card (e.g. *Creamy mushroom pasta*, *Avocado toast*) provides an independent 5-star rating control (`itemRatings[productId]`) with hover preview states (`itemHoverRatings`) and click selection, alongside the dish comment input field.
    - Dish ratings are submitted in the `items` array payload (`{ productId, rating, comment }`), enabling granular dish quality tracking in analytics and kitchen operations.
  - **Elevated Interactive Star Controls**: Implemented SVG star buttons (`size={22}` for dish items, `size={32}` for overall) with responsive gold fill transitions (`#EAB308`), scale micro-animations (`transform: scale(1.2)` on hover), and accessible ARIA attributes (`role="radiogroup"` / `role="radio"`).
  - **Graceful Lifecycle Completion**: Upon feedback submission, the app displays an elevated confirmation modal (*"Thank You! Your feedback has been received and shared directly with the kitchen and restaurant team."*) with a *"Back to Restaurant"* button that redirects to `Screen 01 (RestaurantLandingScreen)` while preserving customer authentication for future orders.
- **Trade-offs Accepted**:
  - Added optional `rating?: number` to `ItemFeedbackSubmission` in TypeScript contracts to support direct dish ratings while maintaining backwards compatibility with backends that only store text aspect notes.









