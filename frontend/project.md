# Restrauque Frontend — Project Specification

> Single source of truth for AI agents working on the Restrauque frontend. Read this before making architectural, structural, UI, dependency, routing, state-management, or implementation decisions.
>
> **Scope:** Frontend only. Backend, ML, infrastructure, database implementation, deployment implementation, and external integrations are outside the direct scope unless the frontend needs an interface contract to consume them.

## 1. Project Identity

- **Product:** Restrauque
- **Repository:** `restrauque`
- **Frontend branch:** `frontend`
- **Frontend stack:** React + TypeScript + Vite
- **Linting:** ESLint
- **Frontend directory:** `frontend/`
- **Repository root:** `Restaurque/`

Restrauque is intended to become a commercial, AI-native restaurant/café intelligence platform rather than a simple college project.

The product has three commercially independent layers:

1. **Layer 1 — Business / Transaction Platform**
2. **Layer 2 — AI Intelligence**
3. **Layer 3 — AI Agents**

Central philosophy:

> **Layer 1 captures data → Layer 2 understands data → Layer 3 acts on data.**

The frontend must allow the initial transaction experience to grow into analytics, AI insights, copilot functionality, and agent workflows without requiring a complete rewrite.

## 2. Frontend Mission

One React application contains three major user-facing surfaces.

### A. Customer Web App

Primarily accessed through restaurant QR codes.

```text
QR
↓
Restaurant / Branch / Table context
↓
Menu
↓
Product
↓
Cart
↓
Checkout
↓
Order Tracking
↓
Feedback
↓
Loyalty
```

### B. Café / POS / Owner Dashboard

```text
Login
↓
Dashboard
├── Orders
├── Products
├── Menu
├── Tables
├── Billing / Payments
├── Customers
├── Feedback
├── Loyalty
├── Analytics
├── AI Insights
└── Settings
```

### C. Platform Admin

```text
Platform Dashboard
├── Restaurants
├── Branches
├── Users
├── Orders
├── Revenue
├── Subscriptions
├── Platform Analytics
├── System Health
├── Integrations
├── Feature Flags
└── Settings
```

These are **not three separate React applications**.


## 2.1 Public Product Landing Page — Current First Milestone

The **first frontend implementation milestone** is the public Restrauque product landing page.

This is the marketing/product website that introduces Restrauque, explains its services, and provides entry points for restaurants/cafés and customers.

### Landing page goals

The landing page should communicate:

- What Restrauque is
- The problem it solves for restaurants and cafés
- QR-based digital ordering
- Digital menu
- Restaurant/POS operations
- Customer and product analytics
- Feedback and sentiment intelligence
- AI business insights
- AI copilot
- Future AI-agent capabilities
- How Restrauque works
- Key benefits
- Pricing/packages when finalized
- Contact/company information

Primary entry actions:

```text
Get Started
Restaurant / Café Login
Customer Login
```

The landing page is **public** and must not require authentication.

### Landing page structure

Build the landing page as modular sections/components rather than one giant component.

Initial skeleton:

```text
Landing Page
├── Navbar
├── Hero
├── Problem / Value Proposition
├── How Restrauque Works
├── Product Overview
├── Layer 1 — Operations
├── Layer 2 — Intelligence
├── Layer 3 — AI Agents
├── Key Features
├── Analytics / AI Preview
├── Benefits
├── Pricing / Packages (when ready)
├── CTA
└── Footer
```

The exact marketing sections may evolve as the product messaging is finalized.

### Landing page design direction

The public website must feel like a **real commercial SaaS startup product**, not a college-project showcase.

Priorities:

- strong visual hierarchy
- clear typography
- premium but usable visual language
- clear CTA hierarchy
- restrained and purposeful animation
- responsive sections
- optimized imagery
- accessible contrast
- fast initial loading
- professional information architecture

Do not add excessive gradients, animations, cards, glassmorphism, or decorative effects simply because an AI coding agent suggests them. Every visual element should serve a product or UX purpose.

## 2.2 Authentication Entry Points

Restrauque has two distinct authentication experiences.

### Restaurant / Café authentication

Restaurants and cafés use authentication to access their business platform.

Conceptual flow:

```text
Landing Page
↓
Restaurant / Café Login
↓
Authentication
↓
Restaurant Owner / Staff Platform
↓
Dashboard
```

The exact credential mechanism is a backend contract and must not be invented by the frontend.

Potential future capabilities include:

- owner login
- staff login
- role-based access
- branch selection where applicable

Do not hard-code these capabilities until the backend authentication contract is defined.

### Customer authentication

Customer authentication is explicitly:

> **Phone number + OTP only.**

There is no customer email/password authentication in the initial product design.

Conceptual flow:

```text
Customer Login
↓
Enter Phone Number
↓
Request OTP
↓
Enter OTP
↓
Verify OTP
↓
Authenticated Customer
↓
Continue to Customer Experience
```

The UI should support:

- country code
- phone number validation
- OTP input
- resend OTP
- resend countdown
- invalid OTP state
- expired OTP state
- loading state
- network/server error state
- successful verification state

Do not implement production authentication logic in the frontend. If the backend is not connected yet, use clearly labelled mock behavior only.

## 2.3 Customer QR + OTP Flow

QR context must survive customer authentication.

Expected flow:

```text
Restaurant QR
↓
/q/:token
↓
Resolve Restaurant + Branch + Table
↓
Customer Login
↓
Enter Phone Number
↓
OTP Verification
↓
Restore QR Context
↓
Restaurant Menu
```

The frontend must not lose the restaurant, branch, or table context while navigating through authentication.

The backend will eventually provide the authoritative QR-resolution and authentication contracts.

Do not hard-code a specific restaurant, branch, table, or QR token into production UI.

## 2.4 Cross-Platform Web Requirement

Restrauque is a **responsive web platform**.

The initial frontend is one React application, not separate native applications.

It must work across:

- Android browsers
- iPhone/iOS Safari
- tablets
- Windows browsers
- macOS browsers
- laptop displays
- desktop monitors

The same codebase should adapt to viewport size and input method.

### Customer priority

The customer-facing experience is **mobile-first and mobile-centric** because customers are expected to access Restrauque primarily through QR codes on their phones.

Primary customer viewport targets:

```text
360px
375px
390px
414px
430px
```

The mobile experience is the source design. Do not create a desktop design first and squeeze it into mobile.

### Customer mobile flow

The complete customer journey must eventually work smoothly on a phone:

```text
QR
↓
Restaurant Context
↓
Phone + OTP
↓
Menu
↓
Product
↓
Cart
↓
Checkout
↓
Payment
↓
Order Tracking
↓
Feedback
↓
Loyalty
```

Mobile requirements:

- no unintended horizontal scrolling
- comfortable touch targets
- readable typography without browser zoom
- one-hand-friendly interaction where practical
- responsive images
- optimized assets
- lightweight animations
- mobile-safe spacing
- mobile keyboard handling
- browser safe-area support where required
- clear loading/skeleton states
- clear error/retry states
- no critical hover-only interaction
- fast perceived performance

### Café and Platform interfaces

Café/POS and Platform Admin interfaces may prioritize desktop/tablet because they are operational tools, but they must remain responsive and usable on smaller screens.

## 2.5 Frontend Milestone 1 — Landing Page Skeleton

The first implementation milestone is **the public product landing page plus authentication entry points**, not the complete restaurant ordering platform.

Milestone scope:

```text
PUBLIC
├── Landing Page
│   ├── Navbar
│   ├── Hero
│   ├── Product Overview
│   ├── Layer 1
│   ├── Layer 2
│   ├── Layer 3
│   ├── How It Works
│   ├── Benefits / Features
│   ├── CTA
│   └── Footer
│
AUTH ENTRY
├── Restaurant / Café Login
└── Customer Phone + OTP Login
```

The first milestone should establish the reusable design system, routing foundation, responsive rules, and component conventions that later customer, café, and platform interfaces will use.

## 3. Product Architecture Context

```text
CUSTOMER WEB APP
       │
       ▼
FASTAPI CORE
       │
       ▼
POSTGRESQL
       │
       ▼
DATA / EVENTS
       │
       ├──────────────► ANALYTICS
       ├──────────────► ML / AI
       ▼
INSIGHT ENGINE
       │
       ▼
LLM / COPILOT
       │
       ▼
AGENT TOOL LAYER
       │
       ▼
AI AGENTS
```

The frontend consumes APIs and intelligence produced by backend/ML. It must not duplicate backend business logic.

Initial product architecture should remain a modular monolith rather than premature microfrontend/microservice complexity.

## 4. Team Context

### Frontend developer

Responsible for:

- React architecture
- Customer web app
- POS UI
- Owner dashboard
- Platform admin UI
- Design system
- Responsive UX
- State management
- API integration
- Data visualization
- Agent UI
- Loading/error/empty states
- Frontend quality

### Backend developer

Responsible for FastAPI, PostgreSQL, SQLAlchemy, authentication, POS APIs, orders, payments, loyalty, feedback, integrations, jobs, security, and infrastructure.

### ML/AI developer

Responsible for analytics, data pipelines, feature engineering, NLP, ML models, forecasting, recommendation engine, AI insight engine, LLM layer, agents, and MLOps.

The frontend must maintain clear API boundaries and must not assume backend/ML implementation details that have not been agreed.

## 5. Frontend Technology Stack

Required:

- React
- TypeScript
- Vite
- ESLint

Planned libraries, introduced only when needed:

- React Router — routing
- TanStack Query — server state/API data
- Axios — HTTP/API client
- Zustand — client-side global state only when genuinely required
- Tailwind CSS — styling/design system
- Recharts — analytics/data visualization

Do not install libraries merely because they are popular. Before adding a dependency, document the problem it solves and why existing tools are insufficient.

## 6. Repository Structure

Intended repository:

```text
restrauque/
├── frontend/
├── backend/
├── ml/
├── docs/
├── README.md
└── docker-compose.yml
```

Do not create another Git repository inside `frontend/`.

## 7. Frontend Source Structure

Intended scalable structure:

```text
frontend/
├── public/
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   │
│   ├── components/
│   │   ├── ui/
│   │   └── layout/
│   │
│   ├── pages/
│   │   ├── customer/
│   │   ├── cafe/
│   │   └── platform/
│   │
│   ├── features/
│   │   ├── auth/
│   │   ├── customer/
│   │   ├── menu/
│   │   ├── cart/
│   │   ├── orders/
│   │   ├── products/
│   │   ├── tables/
│   │   ├── analytics/
│   │   ├── feedback/
│   │   ├── loyalty/
│   │   └── ai/
│   │
│   ├── services/
│   │   ├── api/
│   │   └── auth/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   ├── utils/
│   └── assets/
├── .env.example
├── package.json
├── tsconfig.json
├── vite.config.ts
└── eslint.config.js
```

Do not create dozens of empty files merely to fill the tree. Add implementation files as features are built.

## 8. Folder Responsibilities

### `app/`

Application-level bootstrapping:

- application root
- routing
- providers
- global configuration

Do not put business-specific functionality here.

### `components/ui/`

Reusable visual primitives:

- Button
- Input
- Select
- Card
- Badge
- Modal
- Drawer
- Tabs
- Dropdown
- Table
- Pagination
- Skeleton
- Toast
- EmptyState
- ErrorState
- LoadingState

These should be generic and reusable.

### `components/layout/`

Reusable layouts such as:

- CustomerLayout
- CafeLayout
- PlatformLayout
- Header
- Sidebar
- MobileNavigation
- Breadcrumbs
- Notification area

### `pages/`

Route-level screens. Pages compose features and reusable components and should not become giant business-logic files.

### `features/`

Business capabilities such as:

```text
features/
├── auth/
├── menu/
├── cart/
├── orders/
├── products/
├── tables/
├── analytics/
├── feedback/
├── loyalty/
└── ai/
```

A feature may eventually contain:

```text
feature/
├── components/
├── hooks/
├── api.ts
├── types.ts
└── utils.ts
```

### `services/`

External/API communication.

### `hooks/`

Reusable React hooks.

### `store/`

Client-side global state only where necessary.

### `types/`

Shared TypeScript types.

### `utils/`

Pure helper functions.

### `assets/`

Frontend assets.

## 9. Pages vs Features

Maintain this distinction:

> **Page = where functionality is displayed.**

> **Feature = what the functionality does.**

For example:

```text
pages/customer/MenuPage.tsx
```

can compose:

```text
features/menu/
```

and:

```text
components/ui/
```

Do not duplicate business functionality between pages.

## 10. Routing Strategy

Use React Router when routing is introduced.

Route groups:

```text
/customer/*
/cafe/*
/platform/*
```

Potential customer routes:

```text
/customer/menu
/customer/product/:id
/customer/cart
/customer/checkout
/customer/order/:id
/customer/feedback
/customer/loyalty
```

Potential café routes:

```text
/cafe/dashboard
/cafe/orders
/cafe/products
/cafe/menu
/cafe/tables
/cafe/customers
/cafe/analytics
/cafe/insights
/cafe/settings
```

Potential platform routes:

```text
/platform/dashboard
/platform/restaurants
/platform/branches
/platform/users
/platform/analytics
/platform/system-health
/platform/integrations
/platform/feature-flags
/platform/settings
```

Exact names may evolve if the change is documented.

## 11. QR Customer Experience

The customer experience is primarily entered through QR scanning.

```text
QR token
↓
Restaurant
↓
Branch
↓
Table
↓
Menu
```

The backend will eventually resolve QR token context. The frontend should be prepared for a route such as `/q/:token` or another route agreed with backend.

Do not hard-code restaurant information.

## 12. Multi-Tenancy

Conceptual hierarchy:

```text
Platform
↓
Restaurant
↓
Branch
↓
Users
```

The frontend must eventually support restaurant-specific configuration, potentially including:

- name
- logo
- colors
- typography
- hero image
- tagline
- welcome message
- currency
- featured products

The customer experience must not be hard-coded for one café.

## 13. Customer UX

The customer web application is:

- mobile-first
- fast
- polished
- simple
- touch-friendly
- accessible
- responsive
- usable without installing an app

Main journey:

```text
Open → Browse → Select → Cart → Checkout → Order
```

It should not feel like an enterprise dashboard.

## 14. Café Dashboard UX

Professional, data-oriented, clean, responsive, and efficient for repeated use.

Potential information:

- today's revenue
- orders
- average order value
- active orders
- tables
- pending payments
- customer activity
- feedback
- analytics
- AI insights
- recommended actions

## 15. Platform Admin UX

Internal SaaS interface prioritizing:

- information density
- clarity
- system status
- management workflows
- permissions
- navigation
- operational visibility

## 16. Responsive / Mobile Requirements

Responsive design is first-class.

Support:

- small phones
- large phones
- tablets
- laptops
- desktop monitors

Customer: mobile-first.

Café dashboard: desktop-oriented but responsive.

Platform admin: desktop-oriented with responsive fallback.

Avoid:

- fixed desktop widths
- horizontal overflow
- tiny touch targets
- hover-only interactions
- viewport-height hacks
- fragile absolute positioning
- overflowing images
- layouts that break with longer text

Prefer:

- CSS Grid
- Flexbox
- responsive typography
- responsive spacing
- max-width containers
- fluid layouts
- semantic HTML
- touch-friendly controls

## 17. State Management

### Local UI state

React `useState` / `useReducer`.

### Server state

TanStack Query.

Examples:

- menu
- products
- orders
- analytics
- customers
- feedback
- AI insights

### Global client state

Zustand only when genuinely needed.

Do not put server data into Zustand just because it is globally accessible.

## 18. API Architecture

Centralize backend communication.

Planned:

```text
services/
└── api/
    ├── client.ts
    └── ...
```

Eventually handle:

- base URL
- authentication headers
- request configuration
- response handling
- common errors
- timeouts if required

Do not scatter raw API calls across components.

## 19. Environment Variables

Never hard-code:

- API URLs
- secrets
- private keys
- payment credentials
- tokens

Use `.env.example`.

Example:

```text
VITE_API_BASE_URL=
```

Real secrets must never be committed.

## 20. Error / Loading / Empty States

Every data-driven screen should consider:

```text
Loading
↓
Success
↓
Empty
↓
Error
```

Do not design only the happy path.

## 21. TypeScript Rules

Use TypeScript properly.

Avoid `any` unless documented and unavoidable.

Prefer:

- typed props
- typed API responses
- typed hooks
- typed route parameters
- shared types

Avoid unnecessary assertions.

## 22. Performance

Prepare for:

- route-level lazy loading
- code splitting
- TanStack Query caching
- avoiding unnecessary renders
- efficient lists
- image optimization
- pagination
- virtualization only where genuinely necessary

Do not prematurely optimize.

## 23. Accessibility

Progressively follow:

- semantic HTML
- accessible labels
- keyboard navigation
- visible focus states
- accessible buttons
- accessible form errors
- meaningful headings
- appropriate ARIA
- adequate touch targets
- sufficient contrast

## 24. Security Boundaries

Frontend UI restrictions are not authorization.

Backend must enforce authorization.

Frontend should:

- handle authentication state
- handle expired sessions
- avoid storing secrets
- avoid exposing sensitive data
- safely render user-generated content
- reflect permissions where known

## 25. Analytics and AI UI

Layer 2 will eventually include:

- revenue analytics
- product analytics
- customer analytics
- sentiment
- forecasting
- churn
- anomaly detection
- recommendations
- AI insights
- business copilot

Layer 3 will eventually include:

- business analyst agent
- product agent
- customer retention agent
- marketing agent
- action approval UI
- campaign status
- action results

Future frontend capabilities may include:

- charts
- insight cards
- evidence displays
- AI explanations
- streaming responses
- approval workflows
- action confirmations
- notifications
- agent status
- action history

Do not build these before the corresponding contracts exist.

## 26. Vertical Slice Philosophy

Development should progress through working vertical slices.

### Slice 1

```text
QR → Menu → Order → Database → POS sees order
```

### Slice 2

```text
Order → Payment → Feedback → Database
```

### Slice 3

```text
Feedback → Sentiment → Product analytics → Dashboard
```

### Slice 4

```text
Sales + Feedback + Customer behavior → AI insight → Owner
```

### Slice 5

```text
AI insight → Agent → Action → Result
```

Frontend should align with these slices whenever practical.

## 27. Current Frontend Phase

Focus initially on:

1. React fundamentals
2. TypeScript fundamentals
3. component architecture
4. routing
5. design system foundation
6. responsive layouts
7. customer experience foundation
8. API client
9. TanStack Query
10. authentication structure
11. café dashboard
12. platform admin

Do not prematurely implement AI agents, advanced ML visualizations, complex WebSockets, production payment logic, complicated state machines, microfrontends, or excessive abstractions.

## 27.1 Landing Page Definition of Done

The first landing-page milestone is complete only when:

- the public landing page renders correctly
- navigation works
- Restaurant/Café Login entry point exists
- Customer Login entry point exists
- customer authentication UI is based on phone number + OTP
- QR-context preservation is considered in the routing architecture
- responsive behavior works across mobile, tablet, and desktop
- customer-facing sections are mobile-first
- no unintended horizontal overflow exists
- interactive elements have appropriate loading/disabled/error states
- accessibility basics are respected
- assets are responsive and reasonably optimized
- the page does not depend on hard-coded backend data
- mock authentication is clearly separated from production authentication
- no unnecessary dependency or architectural change was introduced
- code follows this project specification

## 28. Definition of Done

Where applicable, a frontend feature should have:

- responsive behavior
- correct TypeScript types
- loading state
- empty state
- error state
- success state
- accessible interactions
- clean component boundaries
- no console errors
- no unnecessary duplication
- lint passing
- build passing
- mobile verification

## 29. AI Agent Working Rules

Before changing code, an AI agent MUST:

1. Read `project.md`.
2. Read `progressUpdate.md`.
3. Inspect current code.
4. Understand current architecture.
5. Not assume a feature already exists.
6. Not overwrite working architecture unnecessarily.

Before adding a dependency, explain why it is needed.

Before restructuring, inspect `progressUpdate.md`.

After every frontend-changing task, the agent MUST:

1. Verify the implementation.
2. Run relevant checks.
3. Update `progressUpdate.md`.
4. Record the exact user prompt/request.
5. Record created/modified/deleted files.
6. Record important architectural decisions.
7. Record verification results.
8. Record known limitations and next steps.

## 30. No Silent Architectural Changes

AI agents must not silently:

- replace the React architecture
- change state-management strategy
- replace the styling system
- replace TanStack Query
- move major folders
- rename major concepts
- add major dependencies
- create another application
- introduce microfrontends

Significant architectural changes must be documented.

## 31. Git Rules

Current simple team workflow:

```text
main
frontend
backend
ml
```

The frontend developer primarily works on `frontend`.

Feature branches may be introduced later when the project grows.

Meaningful milestones should use clear commit messages such as:

```text
feat: initialize frontend architecture
feat: add customer menu
feat: add cart state
feat: add cafe dashboard layout
fix: prevent mobile menu overflow
refactor: extract reusable order card
```

## 32. Current Known State

At the initial frontend setup:

- GitHub repository exists: `restrauque`
- Frontend branch exists: `frontend`
- React project exists inside `frontend/`
- Vite is configured
- TypeScript is configured
- ESLint is configured
- Vite development server has successfully run
- Git repository is rooted at the Restrauque repository root
- `frontend` tracks `origin/frontend`
- The project is at the frontend foundation stage

## 33. Immediate Objectives

```text
Skeletal architecture
↓
React fundamentals
↓
Routing
↓
Design system
↓
Customer experience shell
↓
Menu/product/cart flow
↓
Backend API
↓
Order flow
↓
Café/POS dashboard
↓
Analytics
↓
AI insight UI
↓
Platform admin
↓
Advanced agent UI
```

The sequence may change according to real dependencies, but changes must be documented.

## 34. Final Principle

The frontend should be:

> **Simple enough for a three-person startup to maintain, but structured enough to grow into a commercial SaaS platform.**

Avoid both extremes:

- one giant `App.tsx` with everything mixed together
- hundreds of abstractions, packages, microfrontends, and complex state machines before the product exists

Target:

```text
Clean
Modular
Responsive
Typed
Testable
Maintainable
Scalable
User-focused
API-driven
```

## 35. Source of Truth

This document describes the intended frontend architecture based on the Restrauque product architecture document.

When this document conflicts with the actual implementation:

1. Inspect the current implementation.
2. Determine whether it represents an intentional newer decision.
3. Record the discrepancy in `progressUpdate.md`.
4. Update this document only when the team intentionally changes the architecture.
