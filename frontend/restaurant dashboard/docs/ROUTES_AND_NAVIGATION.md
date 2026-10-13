# Routes and Navigation — Proposed Map

## Status

This is a proposed starting map based on the user's named screens. It is **not** a statement that these routes already exist. Antigravity must inspect the project and PNG references, then confirm/update the map before implementation.

## Suggested route pattern

| Screen | Suggested route |
|---|---|
| Overview | `/dashboard/overview` |
| Orders list | `/dashboard/orders` |
| Order Details | `/dashboard/orders/:orderId` |
| Menu & Products | `/dashboard/menu` |
| Edit Product | `/dashboard/menu/products/:productId/edit` |
| Tables & QR | `/dashboard/tables-qr` |
| Edit Table | `/dashboard/tables/:tableId/edit` |
| Coupons | `/dashboard/coupons` |
| Loyalty | `/dashboard/loyalty` |
| Analytics | `/dashboard/analytics` |
| AI Insights | `/dashboard/ai-insights` |
| Feedback | `/dashboard/feedback` |
| Settings | `/dashboard/settings` |

Change these paths to match the existing router conventions. Do not introduce a new routing library if the project already has a suitable router.

## Navigation behavior to verify against PNGs

- Main sidebar items navigate to their matching main area.
- Selecting an order opens Order Details for that order.
- The Order Details back action returns to Orders, ideally preserving search/filter/page state if feasible.
- Selecting Edit Product opens the editor for the selected product.
- Save validates and submits through the approved service layer; on success, return to the correct parent view or show the reference-matching success state. Cancel/back must not save changes.
- Selecting Edit Table opens the editor for the selected table.
- Coupons and Loyalty are separate destinations under the same main navigation grouping if that is what the PNG shows.
- AI Insights, Feedback, Analytics, and Settings should use the exact entry points and labels shown in the reference.
- Browser back/forward navigation should work if routing is used.
- Unknown actions should be listed as questions, not silently invented.

## Dialogs vs routes

Do not assume every image represents a separate route. Compare the PNGs:
- A full-page design with its own navigation context may be a route.
- An overlay/modal may be a dialog.
- A different selected tab may be a state within one route.
- A form shown separately may be a route or modal; confirm from the reference and user.

Record the final decisions in this file before building Screen 1.
