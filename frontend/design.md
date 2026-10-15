# Restrauque — Product Landing Page Design Specification

## 1. Document Purpose

This document is the visual and UX source of truth for the **Restrauque public product landing page**.

It defines:

- visual identity
- color palette
- typography direction
- layout principles
- landing-page sections
- CTA hierarchy
- responsive behavior
- mobile-first requirements
- authentication entry points
- animation principles
- accessibility expectations
- reusable design-system direction
- implementation constraints for AI coding agents

This document covers the **public product landing page** and its entry points into authentication.

It does not define the complete Café Owner Dashboard, Customer Ordering Experience, or Platform Admin UI. Those interfaces will reuse the design foundation established here while having their own UX requirements.

---

# 2. Product Context

Restrauque is an **AI-native café and restaurant intelligence platform**.

The overall product is organized around three layers:

```text
LAYER 3 — AI AGENTS
Monitor → Reason → Recommend → Act → Verify

LAYER 2 — AI INTELLIGENCE
Analytics | Product Intelligence | Customer Intelligence
Sentiment | Forecasting | Churn | Anomaly Detection
Recommendations | AI Business Copilot

LAYER 1 — BUSINESS PLATFORM
QR → Digital Menu → Order → Payment → Feedback → Loyalty
+ Lightweight POS
+ External Order Integrations
```

Core philosophy:

```text
Layer 1 → Captures data
Layer 2 → Understands data
Layer 3 → Acts on data
```

The landing page must communicate this progression clearly without overwhelming visitors with technical terminology.

---

# 3. Primary Landing Page Goals

The landing page must answer four questions quickly:

1. **What is Restrauque?**
2. **Why should a restaurant/café care?**
3. **What can Restrauque actually do?**
4. **What should I do next?**

The page should feel like a serious commercial SaaS startup product, not a college project or generic restaurant website.

## Primary audiences

### Restaurant / Café Owner

They should understand that Restrauque can help them:

- digitize ordering
- manage restaurant operations
- understand sales
- understand customers
- understand product performance
- use feedback intelligently
- receive AI-powered business insights
- eventually automate business actions with AI agents

### Customer

The customer is not the primary marketing audience, but the landing page must provide a clear path to the customer experience.

Customer entry:

```text
Customer Login
↓
Phone Number
↓
OTP
↓
Customer Experience
```

---

# 4. Brand Personality

Restrauque should feel:

- modern
- premium
- trustworthy
- intelligent
- energetic
- food-industry relevant
- technology-driven
- approachable
- commercially credible

Avoid making it feel:

- childish
- overly playful
- overly corporate
- generic AI
- like a food-delivery marketplace
- like a college hackathon website
- excessively futuristic
- overloaded with visual effects

The design should communicate:

> **Restaurant technology with intelligence behind it.**

---

# 5. Core Color Palette

The primary Restrauque palette is:

## 5.1 White

```text
#FFFFFF
```

Role:

- primary background
- clean sections
- cards
- whitespace
- main content areas

White should provide the majority of the visual breathing room.

---

## 5.2 Restrauque Red

```text
#E53935
```

Role:

- primary brand color
- primary CTA
- important actions
- active states
- selected elements
- visual highlights
- subtle decorative accents

Red should be used deliberately.

Do NOT make the entire website red.

Red should guide attention rather than dominate every section.

---

## 5.3 Deep Graphite

```text
#1F2937
```

Role:

- dark sections
- AI/analytics sections
- navigation where appropriate
- strong contrast areas
- secondary CTA surfaces
- footer
- product screenshots/visual containers

Graphite provides depth and makes the website feel more like a technology product rather than a conventional food website.

---

# 6. Supporting Colors

These are supporting neutrals and should not compete with the core palette.

| Purpose | Color |
|---|---|
| Primary text | `#111827` |
| Secondary text | `#64748B` |
| Light surface | `#F8FAFC` |
| Border | `#E5E7EB` |
| White | `#FFFFFF` |
| Brand Red | `#E53935` |
| Graphite | `#1F2937` |

Additional semantic colors may be introduced later for application states:

```text
Success
Warning
Error
Info
```

These should be defined through the design system rather than randomly chosen per component.

---

# 7. Color Usage Strategy

The visual balance should generally follow:

```text
WHITE / LIGHT SURFACES
        ↓
Main content + breathing room

GRAPHITE
        ↓
Depth + technology + AI sections

RED
        ↓
Attention + action + brand identity
```

Example landing-page rhythm:

```text
Hero
White

Product Overview
White / Light Gray

Operations
White

AI Intelligence
Graphite + White + Red

AI Agents
Graphite / Dark

Benefits
White

Final CTA
Red or Graphite

Footer
Graphite
```

This creates visual rhythm between sections.

Do not make every section visually identical.

---

# 8. Typography

Typography should be modern, highly readable, and suitable for a SaaS product.

Recommended direction:

- modern sans-serif
- strong heading hierarchy
- clean body text
- generous line height
- readable mobile typography

Possible font direction:

```text
Inter
```

or another similarly clean modern sans-serif if the implementation has a strong reason to use it.

Do not introduce multiple decorative fonts.

Recommended hierarchy:

```text
Display / Hero
Large and confident

H1
Strong product statement

H2
Section-level message

H3
Feature/product subsection

Body
Comfortable reading size

Caption
Small supporting information
```

Typography should remain readable on 360–430px mobile screens.

---

# 9. Visual Design Principles

## 9.1 Clean over crowded

Whitespace is intentional.

Do not try to place every product capability above the fold.

## 9.2 Strong hierarchy

Every section should have:

```text
Eyebrow / Context
↓
Heading
↓
Short explanation
↓
Visual / Feature
↓
Optional CTA
```

## 9.3 Product before decoration

Screenshots, dashboards, workflows, analytics visualizations, and meaningful product UI should be preferred over decorative illustrations.

## 9.4 Real product feeling

Whenever possible, show what the actual Restrauque product will look like.

Examples:

- dashboard previews
- analytics cards
- product intelligence visualization
- AI insight cards
- QR ordering flow
- restaurant configuration
- customer ordering UI

Avoid fake generic SaaS illustrations that do not represent the product.

---

# 10. Landing Page Structure

Initial structure:

```text
Landing Page
│
├── Navbar
│
├── Hero
│
├── Problem / Value Proposition
│
├── How Restrauque Works
│
├── Product Overview
│
├── Layer 1 — Operations
│
├── Layer 2 — Intelligence
│
├── Layer 3 — AI Agents
│
├── Key Features
│
├── Analytics / AI Preview
│
├── Benefits
│
├── Pricing / Packages
│
├── Final CTA
│
└── Footer
```

Sections may evolve, but the page must remain modular.

---

# 11. Navbar

The navbar should establish the brand immediately.

Suggested structure:

```text
[Restrauque Logo]

Product
How It Works
Solutions
Pricing

                         Login
                         Get Started
```

The exact navigation labels can change as the product evolves.

## Desktop

Use a clean horizontal navigation.

## Mobile

Use:

```text
[Logo]                         [Menu]
```

with a mobile navigation drawer/menu.

The mobile menu must not create horizontal overflow.

---

# 12. Hero Section

The hero is the most important landing-page section.

It should communicate the core product value rather than listing every feature.

Suggested messaging direction:

```text
Eyebrow:
AI-Native Intelligence for Cafés & Restaurants

Headline:
Run your café.
Understand your business.
Let AI help you grow.

Supporting text:
Restrauque brings digital ordering, restaurant operations,
analytics, customer intelligence and AI-powered business
insights into one platform.

Primary CTA:
Get Started

Secondary CTA:
Explore the Platform
```

This is a design/content direction, not locked final copy.

## Hero visual

The visual should represent the actual product.

Possible composition:

```text
                    ┌───────────────────────┐
                    │ Revenue               │
                    │ ₹82,400     ↑ 8.4%   │
                    ├───────────────────────┤
                    │ AI Insight             │
                    │ Cold Coffee requires   │
                    │ attention...           │
                    ├───────────────────────┤
                    │ Product Performance    │
                    │ ███████████            │
                    └───────────────────────┘
```

Use restrained red highlights and graphite surfaces.

Avoid a generic AI robot/brain graphic.

---

# 13. Problem / Value Proposition Section

The visitor should recognize the business problem.

Possible narrative:

```text
Running a café generates huge amounts of data.

Orders.
Customers.
Products.
Feedback.
Payments.
Sales.

But most businesses only see the numbers.

Restrauque helps them understand what those numbers mean
and what to do next.
```

Visual direction:

```text
Data
↓
Understanding
↓
Action
```

This should naturally lead into the three-layer architecture.

---

# 14. How Restrauque Works

Present the product as a progression.

```text
01 — Capture
Digital ordering + operations

02 — Understand
Analytics + AI intelligence

03 — Act
AI agents + automation
```

Visual:

```text
CAPTURE
   ↓
UNDERSTAND
   ↓
ACT
```

Each step should have:

- short explanation
- product visual
- relevant features

Keep the section simple.

---

# 15. Layer 1 — Operations

Purpose:

Show how Restrauque digitizes restaurant operations.

Features may include:

- QR ordering
- digital menu
- cart
- ordering
- payment
- feedback
- loyalty
- lightweight POS
- table management
- product management
- order management

Visual direction:

Use a product UI preview showing a restaurant/café workflow.

Color:

- white/light background
- red highlights
- graphite text

---

# 16. Layer 2 — Intelligence

This is one of the most important sections.

Purpose:

Show that Restrauque does more than collect data.

Capabilities:

- revenue analytics
- product analytics
- customer intelligence
- sentiment analysis
- repeat purchase analysis
- churn prediction
- forecasting
- anomaly detection
- recommendations
- AI business insights
- AI Copilot

Suggested narrative:

```text
Your data already knows a lot.

Restrauque turns it into decisions.
```

## Visual treatment

This section can use:

```text
Graphite background
White typography
Restrauque Red accents
```

Show realistic dashboard/analytics UI.

Example:

```text
Revenue
₹82,400
↑ 8.4%

Orders
1,248

Repeat Customers
+7.2%

Attention Required
Cold Coffee ↓ 18%
```

Numbers shown on the marketing site should either be clearly labeled as examples/demo data or come from real approved product data.

Never imply fake metrics are real customer results.

---

# 17. Layer 3 — AI Agents

This should feel like the most advanced layer.

Concept:

```text
Monitor
↓
Reason
↓
Recommend
↓
Act
↓
Verify
```

Explain that Layer 3 can eventually move from:

```text
"Here is what happened."
```

to:

```text
"Here is what you should do."
```

to:

```text
"I prepared the action for you."
```

Possible agent examples:

- Business Analyst Agent
- Product Agent
- Customer Retention Agent
- Marketing Agent

Use graphite/dark visual treatment with controlled red accents.

Avoid presenting autonomous actions as already available if they are not implemented.

Clearly distinguish:

```text
Available
Coming Soon
Future Vision
```

---

# 18. Key Features Section

Use a modular grid.

Possible feature cards:

```text
QR Ordering
Digital Menu
POS
Payments
Feedback
Loyalty
Analytics
Customer Intelligence
Product Intelligence
AI Insights
AI Copilot
AI Agents
```

Cards should be concise.

Do not create huge text-heavy cards.

Use:

```text
Icon
Title
1–2 line description
Optional visual
```

---

# 19. Analytics / AI Preview

This section should visually demonstrate the product.

Potential UI:

```text
Revenue
₹82,400
↑ 8.4%

Orders
1,248

Average Order Value
₹660

Customer Retention
72%

------------------------------

AI INSIGHT

Cold Coffee sales dropped 17%.

Overall café traffic remained stable,
while negative feedback about sweetness increased.

Recommended action:
Run a 7-day recipe experiment.
```

Important:

These values are **illustrative demo content** unless backed by real data.

The landing page must never present fabricated metrics as real business performance.

---

# 20. Benefits Section

Focus on outcomes rather than technology.

Possible outcomes:

### Operate better

Digitize everyday restaurant operations.

### Understand customers

Know who returns, who is at risk, and what customers care about.

### Improve products

Understand which products are growing, declining, and why.

### Make better decisions

Turn business data into understandable insights.

### Act faster

Use AI assistance to move from insight toward action.

---

# 21. Pricing / Packages

The product architecture defines three commercial layers:

```text
OPERATE
Layer 1

INTELLIGENCE
Layer 1 + Layer 2

AUTONOMOUS
Layer 1 + Layer 2 + Layer 3
```

The landing page may eventually represent these as three pricing/product packages.

Do not invent final prices until the business team defines them.

If pricing is not finalized, use:

```text
Explore Plan
Contact Us
Coming Soon
```

rather than fabricated pricing.

---

# 22. Final CTA

The final CTA should be simple and strong.

Example:

```text
Your café already generates the data.

Now turn it into intelligence.

[ Get Started ]

Already using Restrauque?
[ Login ]
```

Possible background:

- Restrauque Red
- or Deep Graphite

Use white text and strong contrast.

---

# 23. Footer

Suggested structure:

```text
Restrauque

AI-native intelligence for cafés and restaurants.

Product
Solutions
Pricing
How It Works

Company
About
Contact

Resources
Documentation
Support

Legal
Privacy
Terms

© Restrauque
```

Exact links will be finalized later.

---

# 24. Authentication Entry Design

The landing page must clearly distinguish the two login paths.

## Restaurant / Café

```text
Restaurant / Café
Login
```

Leads to the restaurant authentication experience.

## Customer

```text
Customer
Login
```

Leads to:

```text
Phone Number
↓
OTP
↓
Customer Experience
```

The customer login must never ask for email/password.

---

# 25. Mobile-First Design Rules

The customer-facing Restrauque experience is primarily accessed through QR codes on phones.

Therefore:

> **Mobile is the source design, not a secondary adaptation.**

Primary testing widths:

```text
360px
375px
390px
414px
430px
```

## Required behavior

- no unintended horizontal scrolling
- touch-friendly buttons
- comfortable spacing
- readable typography
- mobile-safe padding
- responsive images
- optimized assets
- mobile keyboard handling
- safe-area support where necessary
- no critical hover interactions
- fast perceived performance
- lightweight animations
- clear loading states
- clear error states
- clear disabled states

---

# 26. Cross-Platform Requirements

The web application must work across:

```text
Android
iOS
Tablet
Windows
macOS
Laptop
Desktop
```

Browser support should be based on modern browsers.

The same React codebase should adapt to:

- viewport width
- touch input
- mouse/trackpad input
- keyboard input

Do not create separate implementations for each platform unless a real technical requirement appears.

---

# 27. Responsive Breakpoint Philosophy

Do not design around a large number of arbitrary breakpoints.

Prefer fluid responsive layouts.

General behavior:

```text
Mobile
↓
Single-column
↓
Tablet
↓
Two-column where useful
↓
Desktop
↓
Multi-column / dashboard compositions
```

Components should respond naturally to available space.

Avoid hard-coded widths that break between common device sizes.

---

# 28. Animation & Motion

Animation should communicate hierarchy and interaction.

Good uses:

- subtle section reveal
- button hover/press
- card entrance
- chart animation
- navigation transitions
- smooth mobile menu
- product UI transitions

Avoid:

- constant floating objects
- excessive parallax
- long page transitions
- distracting background animations
- animations that delay content
- heavy video backgrounds
- excessive particle effects

Respect reduced-motion preferences.

---

# 29. Performance

The landing page should feel fast.

Priorities:

1. Fast first content
2. Optimized images
3. Lazy-load below-the-fold media
4. Avoid unnecessary JavaScript
5. Avoid large animation libraries unless justified
6. Avoid oversized assets
7. Avoid blocking fonts/resources
8. Keep components reasonably lightweight

Do not sacrifice performance for visual effects.

---

# 30. Accessibility

The landing page should follow accessible web practices.

Requirements:

- semantic HTML
- meaningful headings
- keyboard navigation
- visible focus states
- accessible buttons
- accessible forms
- appropriate labels
- sufficient contrast
- alt text for meaningful images
- decorative images marked appropriately
- reduced-motion support
- errors communicated clearly

Do not rely solely on color to communicate meaning.

---

# 31. Component Design Direction

Reusable UI primitives should eventually include:

```text
Button
Input
Container
Section
Card
Badge
Modal
Drawer
Tabs
Tooltip
Skeleton
Spinner
Toast
EmptyState
ErrorState
```

Landing-specific components can include:

```text
Navbar
Hero
FeatureCard
LayerCard
AnalyticsPreview
InsightCard
CTASection
Footer
```

Do not create a new component for every tiny visual element.

Use composition.

---

# 32. Design System Rules

## Buttons

Primary:

```text
Red background
White text
```

Secondary:

```text
White / transparent
Graphite border/text
```

Dark-section CTA:

```text
Red background
White text
```

Buttons must have:

- hover
- active/pressed
- focus
- disabled
- loading

states where applicable.

## Cards

Cards should use subtle borders, shadows, or surface contrast.

Avoid excessive floating cards.

## Borders

Use subtle neutral borders.

## Radius

Use a consistent radius scale.

Do not mix many unrelated corner radii.

---

# 33. Content & Copy Rules

Copy should be:

- concise
- confident
- understandable
- business-oriented
- benefit-focused

Avoid unnecessary technical language in the hero.

For example, prefer:

> Understand which products are hurting your growth.

over:

> AI-powered multi-modal predictive product intelligence pipeline.

Technical depth can appear lower on the page where appropriate.

---

# 34. Trust & Credibility

Do not fabricate:

- customer logos
- customer testimonials
- revenue numbers
- performance percentages
- restaurant counts
- AI accuracy
- business outcomes
- awards
- partnerships

If these are not available, use:

- product visuals
- architecture
- clear feature explanations
- transparent "coming soon" labels

Credibility is more important than making the page look artificially established.

---

# 35. Product State Labels

When a capability is not yet production-ready, distinguish it visually.

Examples:

```text
Available
Coming Soon
Beta
Future
```

This is especially important for:

- AI Copilot
- AI Agents
- autonomous actions
- external integrations
- advanced analytics

Do not present the roadmap as current functionality.

---

# 36. Landing Page Technical Boundaries

The landing page should not:

- directly access the database
- contain backend credentials
- implement production authentication itself
- invent API endpoints
- hard-code restaurant data
- duplicate business logic
- create separate apps for customer/café/platform
- introduce unnecessary state management
- introduce unnecessary dependencies

The frontend should consume well-defined backend APIs once those contracts exist.

---

# 37. AI Coding Agent Rules

Any AI coding agent working on the landing page must:

1. Read `project.md`.
2. Read `design.md`.
3. Understand the current milestone before coding.
4. Preserve the existing architecture.
5. Avoid silent architectural changes.
6. Explain significant structural changes.
7. Avoid generating huge monolithic components.
8. Reuse existing design-system components.
9. Keep mobile-first behavior intact.
10. Test responsive behavior.
11. Test the actual application rather than assuming it works.
12. Never claim a feature is implemented if it is only mocked.
13. Update `progressUpdate.md` after meaningful work.
14. Record dependencies added.
15. Record files created/modified.
16. Record verification performed.
17. Never invent backend contracts.

---

# 38. Landing Page Definition of Done

The landing page milestone is complete only when:

- public landing page loads successfully
- navbar works
- hero works
- primary CTA works
- Restaurant/Café Login entry point exists
- Customer Login entry point exists
- customer login follows phone + OTP UX
- landing sections are modular
- design system foundation is reusable
- mobile layout works at 360–430px
- tablet layout works
- desktop layout works
- no unintended horizontal scrolling exists
- no major console errors exist
- lint/build passes
- accessibility basics are implemented
- images/assets are reasonably optimized
- animations are purposeful
- reduced-motion behavior is respected
- no fake business claims are presented as real
- no production authentication is falsely represented
- no backend assumptions are hard-coded
- project architecture remains consistent with `project.md`

---

# 39. Final Visual Direction

The Restrauque landing page should visually communicate:

```text
                 RESTRUQUE

          FOOD × TECHNOLOGY × AI

                    ↓

              WHITE
          Clean / Premium

                    +

              RED
       Energy / Action / Brand

                    +

             GRAPHITE
       Technology / Intelligence
```

The final feeling should be:

> **A premium restaurant technology platform that happens to be powered by serious AI — not an AI demo pretending to be a restaurant product.**

The design should remain clean enough for a restaurant owner to trust and visually sophisticated enough to communicate that Restrauque is building a serious technology product.
