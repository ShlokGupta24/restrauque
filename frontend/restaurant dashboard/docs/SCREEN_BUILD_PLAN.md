# Screen Build Plan — Restrauque Restaurant Dashboard

## Purpose

This is the confirmed high-level scope from the user. The PNG references decide the exact appearance, visible content, and any additional subpages. Build one approved screen at a time.

## Screen inventory and suggested order

The order below is a recommended implementation sequence, not a claim that the PNGs have already been inspected. After Phase 0, update the order if the existing code or reference dependencies make another sequence safer.

| ID | Main area | Screen(s) explicitly identified | Build notes |
|---|---|---|---|
| 01 | Overview | Overview | Establish the shared dashboard shell only if the PNG confirms the shell design. |
| 02 | Orders | Orders list | List filters, search, row actions, pagination, and status controls only if shown in the PNG. |
| 03 | Orders | Order Details | Enter from an order row or visible action; implement back navigation according to the reference. |
| 04 | Menu & Products | Menu and Products page | Confirm from PNG whether menu categories and products share one page or use tabs/subsections. |
| 05 | Menu & Products | Edit Product | Open from the relevant product action; implement save/cancel and validation only as supported by the design. |
| 06 | Tables & QR | Tables & QR page | Keep table management and QR-code management distinct in data and behavior. |
| 07 | Tables & QR | Edit Table | Open from a table action; confirm fields and save behavior from PNG. |
| 08 | Coupons & Loyalty | Coupons page | Coupon creation/edit/detail flows only if shown in the references. |
| 09 | Coupons & Loyalty | Loyalty page | Loyalty program, accounts, rewards, and redemptions only as supported by the PNGs and actual schema. |
| 10 | Analytics | Analytics page | Use actual schema-backed metrics or clearly isolated demo data; do not invent business performance figures as real. |
| 11 | AI Insights | AI Insights page(s) | Inspect all PNGs to establish whether insight details, evidence, or action views are separate screens. |
| 12 | Feedback | Feedback page | Confirm whether feedback details, filters, or response actions are separate screens. |
| 13 | Settings | Settings page(s) | Inspect all PNGs for tabs/sections and determine whether they are in-page panels or separate routes. |

The minimum explicitly named list contains 13 screen/page views if each named item is separate. The final count may be higher if the PNGs include additional AI Insights or Settings views, dialogs, or subpages.

## Required inventory before implementation

Antigravity must inspect every reference image and add an entry for each:

- Exact filename and image dimensions
- Proposed screen name and ID above
- Shared shell visible (sidebar, header, breadcrumbs, profile menu, etc.)
- Main content layout and key components
- Visible controls and expected interactions
- Likely route/entry point and exit/back behavior
- Responsive behavior that can be inferred (otherwise mark unknown)
- Ambiguities that need user confirmation

Do not make up image content. If the reference is unclear, ask.

## Incremental acceptance loop

For each screen:

1. Confirm the PNG reference and any preceding screen it connects to.
2. State the scope for this iteration.
3. Implement that screen and required shared components only.
4. Wire its approved navigation and interactions.
5. Run available lint/type-check/build checks.
6. Update `progressUpdate.md`.
7. Present the result and wait for user approval.

Do not begin the next screen just because the current screen compiles.

## Cross-screen consistency

- Reuse the same sidebar, header, typography, spacing tokens, colors, buttons, cards, form fields, and table patterns shown in the references.
- Do not invent a new theme on individual pages.
- Use shared components only where the reference supports a shared pattern.
- Maintain working navigation and preserve state where appropriate.
- If the PNGs show different states of the same page, classify them as states unless the user confirms they are separate routes.
