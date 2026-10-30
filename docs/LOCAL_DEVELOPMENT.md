# Local Development and Onboarding Guide

This guide provides verified, step-by-step instructions for installing dependencies, configuring local environments, running development servers, and executing test suites across all Restrauque applications.

---

## 1. Prerequisites and Environment Verification

Before running any application, ensure your local development machine has the following verified toolchain versions installed:

| Tool | Recommended Version | Minimum Version | Verification Command |
| :--- | :--- | :--- | :--- |
| **Node.js** | `v20.x` or `v22.x` (LTS) | `v18.18.0` | `node --version` |
| **npm** | `v10.x` | `v9.x` | `npm --version` |
| **Git** | `2.40+` | `2.30+` | `git --version` |
| **PostgreSQL / Neon** | PostgreSQL 16+ compatible | PostgreSQL 15 | `psql --version` (optional client) |

> [!IMPORTANT]
> Verify your Node.js and npm versions before proceeding. If you manage multiple Node versions, use `nvm` (Node Version Manager) or `nvm-windows`.

```bash
node --version
npm --version
git --version
```

---

## 2. Repository Applications and Port Allocations

Restrauque is composed of 5 independently developed applications that communicate over HTTP using JSON REST APIs and HttpOnly cookies. In local development, each application runs on a dedicated port:

| Directory | Application Role | Framework / Tooling | Local Port | Proxy / Target |
| :--- | :--- | :--- | :--- | :--- |
| `Backend/` | Authoritative REST API & Database Gateway | Next.js 15 (App Router), Prisma, TypeScript | `http://localhost:3000` | N/A (Listens directly) |
| `frontend/landing page/` | Public Parallax Marketing & Auth Entry Portal | Vite 6, React 19, GSAP, TypeScript | `http://localhost:5173` | `/api` -> `http://localhost:3000` |
| `frontend/restaurant dashboard/` | Restaurant Owner Operations, Menu, POS & Tables | Vite 5, React 18, React Router, TypeScript | `http://localhost:5174` | `/api` -> `http://localhost:3000` |
| `frontend/customer screen/customer_ordering_side/` | Mobile-Optimized Customer Dine-in QR Experience | Vite 6, React 18, Canvas Confetti, TypeScript | `http://localhost:5175` | `/api` -> `http://localhost:3000` |
| `frontend/customer screen/customer_dashboard/` | Customer Account, Order History, Loyalty & Reviews | Vite 5, React 18, React Router, TypeScript | `http://localhost:5176` | `/api` -> `http://localhost:3000` |

---

## 3. Environment Variables Configuration

### 3.1 Backend Environment Setup (`Backend/.env`)

The backend requires a valid `.env` file in the `Backend/` directory. Copy the verified template:

```bash
cd Backend
cp .env.example .env
```

#### Safe Variable Template

```dotenv
# ==============================================================================
# Database Connection (Neon PostgreSQL with connection pooling)
# ==============================================================================
DATABASE_URL="postgresql://username:password@ep-sample-pooler.region.aws.neon.tech/neondb?sslmode=require"

# ==============================================================================
# Cryptographic Keys (Must be >= 32 characters)
# ==============================================================================
JWT_SECRET="replace_with_a_secure_random_string_at_least_32_characters_long"
OTP_SECRET="replace_with_a_dedicated_secret_at_least_32_characters_long"
INTERNAL_API_SECRET="replace_with_a_secure_internal_cron_secret_32_chars"

# ==============================================================================
# Server and Host Configuration
# ==============================================================================
NODE_ENV="development"
PORT=3000
NEXT_PUBLIC_APP_URL="http://localhost:3000"
ALLOWED_ORIGINS="http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176"

# ==============================================================================
# Telecom / SMS Delivery Provider
# In local development: use "mock" for zero-cost simulated SMS in terminal logs.
# In production: use "twilio" with real Twilio Verify or Twilio Messaging credentials.
# ==============================================================================
SMS_PROVIDER="mock"
# TWILIO_ACCOUNT_SID="ACXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
# TWILIO_AUTH_TOKEN="your_auth_token_here"
# TWILIO_VERIFY_SERVICE_SID="VAXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
# TWILIO_PHONE_NUMBER="+1XXXXXXXXXX"

# ==============================================================================
# Cloudinary Image Storage (Optional in local dev; required for dish photo uploads)
# ==============================================================================
# CLOUDINARY_CLOUD_NAME="your-cloud-name"
# CLOUDINARY_API_KEY="your-api-key"
# CLOUDINARY_API_SECRET="your-api-secret"

# ==============================================================================
# Email Notification Provider (Optional)
# ==============================================================================
# EMAIL_PROVIDER="mock"
# RESEND_API_KEY="re_XXXXXXXXXXXXXXXXXXXXXXXX"
# EMAIL_FROM="Restrauque Orders <orders@yourverifieddomain.com>"
```

### 3.2 Frontend Environment Setup

The frontend Vite applications are pre-configured to communicate with the local backend (`http://localhost:3000`) via Vite's built-in development reverse proxy (`/api` -> `http://localhost:3000`).

If you need to customize cross-application redirect targets or target a remote staging backend, configure `.env` files in the respective frontend directories:

#### `frontend/landing page/.env` (Optional)
```dotenv
VITE_DEV_BACKEND_URL=http://localhost:3000
VITE_DASHBOARD_URL=http://localhost:5174/dashboard/overview
VITE_CUSTOMER_DASHBOARD_URL=http://localhost:5176
```

#### `frontend/customer screen/customer_dashboard/.env` (Optional)
```dotenv
VITE_DEV_BACKEND_URL=http://localhost:3000
VITE_LANDING_URL=http://localhost:5173
```

#### `frontend/customer screen/customer_ordering_side/.env` (Optional)
```dotenv
VITE_API_BASE_URL=
VITE_USE_MOCK_DATA=false
```

---

## 4. Step-by-Step Installation & Local Startup

To run the complete platform, start the applications in separate terminal windows following this recommended sequence:

### Terminal 1: Backend API Gateway & Database Engine

```bash
# 1. Navigate to the backend directory
cd Backend

# 2. Install dependencies according to package-lock.json
npm install

# 3. Generate Prisma client bindings
npx prisma generate

# 4. Start the Next.js development server
npm run dev
```
*Expected output: Ready on `http://localhost:3000`.*  
*Verify health check:* Visit `http://localhost:3000/api/v1/health` in your browser.

---

### Terminal 2: Restaurant Dashboard (Owner Management)

```bash
# 1. Navigate to the restaurant dashboard directory
cd "frontend/restaurant dashboard"

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
*Expected output: Local server running at `http://localhost:5174`.*

---

### Terminal 3: Customer Ordering Experience (Dine-in QR UI)

```bash
# 1. Navigate to the customer ordering directory
cd "frontend/customer screen/customer_ordering_side"

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
*Expected output: Local server running at `http://localhost:5175`.*

---

### Terminal 4: Customer Account & Loyalty Dashboard

```bash
# 1. Navigate to the customer dashboard directory
cd "frontend/customer screen/customer_dashboard"

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
*Expected output: Local server running at `http://localhost:5176`.*

---

### Terminal 5: Public Landing Page

```bash
# 1. Navigate to the landing page directory
cd "frontend/landing page"

# 2. Install dependencies
npm install

# 3. Start the Vite development server
npm run dev
```
*Expected output: Local server running at `http://localhost:5173`.*

---

## 5. Verification and Quality Checks

Each application has dedicated verification scripts configured in its `package.json`:

### 5.1 Backend Verification

```bash
cd Backend

# Run full Vitest test suite (48 test suites)
npm test

# Run TypeScript type check
npx tsc --noEmit

# Test production build
npm run build
```

### 5.2 Customer Dashboard Verification

```bash
cd "frontend/customer screen/customer_dashboard"

# Run integration tests (Node/tsx test runner)
npm test

# Run TypeScript type check
npx tsc -b

# Test production build
npm run build
```

### 5.3 Customer Ordering UI Verification

```bash
cd "frontend/customer screen/customer_ordering_side"

# Run unit and contract tests (Node test runner)
npm test

# Run TypeScript type check
npx tsc --noEmit

# Test production build
npm run build
```

### 5.4 Restaurant Dashboard Verification

```bash
cd "frontend/restaurant dashboard"

# Run TypeScript type check
npx tsc -b

# Test production build
npm run build
```

### 5.5 Landing Page Verification

```bash
cd "frontend/landing page"

# Run landing auth integration tests
npm test

# Run TypeScript type check
npx tsc -b

# Test production build
npm run build
```

---

## 6. Safe Developer Workflow & Guardrails

1. **Never commit `.env` files**: All sensitive credentials must remain in `.env`, which is strictly ignored by `.git`.
2. **Never commit `node_modules` or `.vite` cache**: Ensure temporary Vite cache files (`.vite/deps`) are discarded before staging git changes.
3. **Database Changes**: Never apply ad-hoc schema alterations directly to production. Always create and review SQL scripts under `Backend/prisma/migrations/`.
4. **Use HttpOnly Cookies for Auth**: Always pass `credentials: 'include'` when fetching from frontend services to preserve JWT and session cookie binding.
