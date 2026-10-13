# Restrauque Parallax Landing Page

A React + TypeScript + Vite frontend prototype based on the supplied Restrauque hero reference. GSAP and ScrollTrigger provide the intro sequence, scroll parallax, and section reveals.

## Run locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite (normally `http://localhost:5173`).

## Verify

```bash
npm run lint
npm run build
```

## Routes

- `/` — public landing page
- `/login/restaurant` — restaurant login UI prototype
- `/login/customer` — phone + demo OTP UI prototype
- `/get-started` — entry choice

## Notes

- This is a frontend prototype. Restaurant authentication, SMS/OTP delivery, AI, analytics and payments are not connected to a backend.
- The visual assets are crops of the supplied design reference. They are used as scene imagery, while headings, cards, charts and controls are real HTML/CSS elements.
- `hello@restrauque.com` is a placeholder contact address; replace it with the official contact before launch.
- Use the project's existing dependencies/configuration if merging into another Vite app; do not blindly overwrite an existing `package.json`.
