# Restrauque Customer Ordering — Antigravity + Backend Handoff

This package is the implementation brief for the customer-facing ordering experience in Restrauque.

## Scope
- One shared, responsive customer ordering UI.
- Visual direction inspired by the supplied second concept: warm ivory surface, deep navy actions, simple restaurant/table header, focused menu browsing, compact product cards, accessible cart and checkout.
- A separate customer feedback experience after the backend confirms order completion.
- One easy-to-edit theme configuration file per restaurant.
- Mock data isolated from production-facing services so it can be removed by switching the service provider, not by rewriting screens.
- Frontend and backend documents are separated for clear engineering ownership.

## How to use
1. Copy the `frontend/` docs and `backend/` docs into the existing repository without deleting current files.
2. Have Antigravity read `frontend/docs/FRONTEND_IMPLEMENTATION_SPEC.md`, `frontend/docs/NEON_SCHEMA_UI_MAPPING.md`, and `frontend/docs/IMPLEMENTATION_PROMPT.md`.
3. Give the backend engineer `backend/docs/BACKEND_API_CONTRACT.md` and `backend/docs/NEON_SCHEMA_REFERENCE.md`.
4. Share `shared-contracts/` with both.
5. Ask both engineers to confirm existing routes, authentication, and API names before implementing or renaming endpoints.
6. Build one vertical slice first: QR resolution → menu → add to cart → mobile login/OTP → order creation → completion state → feedback submission. Then expand the other views.

## Hard constraints
- Do not display database schema/table/column names, UUIDs, internal statuses, or other internal metadata in the customer UI.
- Do not connect the browser directly to Neon. Keep all database credentials on the backend.
- Do not claim any endpoint exists until verified in the current backend repository.
- Do not apply database migrations or change the schema without explicit review and approval.
- Do not present mock data as live restaurant data.
- Do not invent payment providers, order statuses, OTP delivery, or review capabilities not supported by the backend.
- The current schema’s `feedback` supports overall order-level rating/comment. Product-level written comments can be represented through `feedback_aspects`; it lacks a dedicated per-item star-rating field and an order-item foreign key on `feedback_aspects`. That limitation is explicitly documented.
