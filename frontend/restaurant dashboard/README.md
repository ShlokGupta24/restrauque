# Restrauque Restaurant Dashboard — Antigravity Starter Docs

These documents define the screen scope and incremental workflow for building the Restrauque restaurant dashboard from your PNG UI/UX references.

## Before you start

1. Keep your existing PNG reference images.
2. Copy them into `reference-images/` (or update the master prompt with the folder where they already live).
3. Open this folder in Antigravity.
4. Read `ANTIGRAVITY_MASTER_PROMPT.md` and give its contents to Antigravity.
5. Ask Antigravity to **inspect and inventory first**. Do not let it build all screens in one go.
6. Review the proposed inventory and route flow, then approve the first screen only.

## Documents

- `ANTIGRAVITY_MASTER_PROMPT.md` — main instructions for Antigravity.
- `docs/SCREEN_BUILD_PLAN.md` — confirmed screen scope and incremental implementation order.
- `docs/ROUTES_AND_NAVIGATION.md` — proposed routes and interaction expectations; confirm exact transitions against PNGs.
- `docs/NEON_SCHEMA_UI_GUIDE.md` — schema-aware data mapping and database safety notes.
- `progressUpdate.md` — implementation log Antigravity must update after each approved screen.
- `reference-images/PUT_PNG_REFERENCES_HERE.txt` — reminder to place reference images here.

## Important

The exact visual details, filenames, route patterns, and any unlisted subpages must be discovered from the PNGs and existing code. Do not invent missing designs. The route paths in the navigation guide are suggested defaults, not claims about existing application routes.

Build actual responsive UI components. Do not use the PNG itself as a page background or substitute for functional UI. Use mock data only when an API is unavailable, and keep mock data behind a clear service/data layer so it can later be replaced by backend API calls.
