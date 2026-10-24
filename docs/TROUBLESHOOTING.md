# Developer Troubleshooting & Diagnostic Guide

This guide provides targeted diagnostics, likely causes, and safe solutions for common development, runtime, and build issues in Restrauque.

---

## 1. Environment & Configuration Issues

### Symptom: `Environment variable validation failed: DATABASE_URL is required` or `JWT_SECRET must be at least 32 characters long`
- **Likely Cause**: Missing `.env` file in `Backend/` or `JWT_SECRET` is too short.
- **Diagnostic Step**: Check `Backend/.env` presence and string length of `JWT_SECRET`.
- **Safe Fix**: Copy `Backend/.env.example` to `Backend/.env` and generate a 32+ character random secret:
  ```bash
  cd Backend
  cp .env.example .env
  # On Linux/macOS:
  # openssl rand -base64 32
  # On Windows PowerShell:
  # -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 36 | ForEach-Object {[char]$_})
  ```
- **Relevant Files**: `Backend/lib/config/env.ts`, `Backend/.env.example`.

---

## 2. Database & Prisma Connection Issues

### Symptom: `Can't reach database server at endpoint-pooler.region.aws.neon.tech` or `Connection terminated unexpectedly`
- **Likely Cause**: Neon database compute endpoint is suspended (cold start), network connectivity issue, or missing `?sslmode=require` query parameter in `DATABASE_URL`.
- **Diagnostic Step**: Check if `DATABASE_URL` contains `?sslmode=require`. Test connectivity with `npx prisma db pull --print`.
- **Safe Fix**: Ensure the URL includes `sslmode=require`. Wait 3-5 seconds for Neon's serverless compute to wake from auto-suspend, then retry.
- **Relevant Files**: `Backend/prisma/schema.prisma`, `Backend/lib/db/prisma.ts`.

### Symptom: `Property does not exist on type 'PrismaClient'` or runtime query crashes on recently added column
- **Likely Cause**: The local Prisma client bindings in `node_modules/@prisma/client` are out of sync with `schema.prisma`.
- **Diagnostic Step**: Check if `schema.prisma` was recently edited without re-generating client.
- **Safe Fix**:
  ```bash
  cd Backend
  npx prisma generate
  ```

---

## 3. Local Port Conflicts & Server Startup

### Symptom: `Error: listen EADDRINUSE: address already in use :::3000` (or 5173, 5174, 5175, 5176)
- **Likely Cause**: A previous server process or zombie Node process was not terminated cleanly.
- **Diagnostic Step**: Identify the process holding the port:
  - On Windows: `netstat -ano | findstr :3000`
  - On Linux/macOS: `lsof -i :3000`
- **Safe Fix**: Terminate the specific PID:
  - On Windows: `taskkill /PID <PID> /F`
  - On Linux/macOS: `kill -9 <PID>`

---

## 4. Cross-Origin (CORS) & Network Proxy Failures

### Symptom: `Access to fetch at 'http://localhost:3000/api/...' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present`
- **Likely Cause**: The client application is requesting the backend directly from an unwhitelisted port without using the Vite reverse proxy, or `ALLOWED_ORIGINS` does not include the port.
- **Diagnostic Step**: Check `Backend/middleware.ts` allowed origins list (`DEFAULT_ALLOWED_ORIGINS`).
- **Safe Fix**:
  1. If running locally, route requests through `/api` so Vite proxies them to `localhost:3000`.
  2. If running from a custom port (e.g., 5177), add `ALLOWED_ORIGINS="http://localhost:5177"` in `Backend/.env`.
- **Relevant Files**: `Backend/middleware.ts`.

---

## 5. Authentication & Session Persistence Issues

### Symptom: Frontend redirects to `/login` immediately after successful login or page reload
- **Likely Cause**: The browser did not store or send the `restrauque_session` cookie because `credentials: 'include'` was omitted in the fetch request.
- **Diagnostic Step**: Inspect browser DevTools -> Application -> Cookies. Verify if `restrauque_session` exists for `localhost`.
- **Safe Fix**: Ensure all client API calls specify `{ credentials: 'include' }` in `fetch()` options:
  ```ts
  const res = await fetch('/api/v1/auth/me', {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });
  ```
- **Relevant Files**: `frontend/*/src/services/apiClient.ts`.

---

## 6. SMS OTP Delivery Issues

### Symptom: `SMS delivery is restricted by the Twilio trial account (Error 21608)` or `Failed to dispatch SMS verification code via Twilio`
- **Likely Cause**: Twilio trial accounts cannot deliver SMS to unverified phone numbers, or Twilio Verify Service SID is not configured.
- **Diagnostic Step**: Check `Backend/.env` for `SMS_PROVIDER`.
- **Safe Fix**:
  - In Local Development: Set `SMS_PROVIDER="mock"` in `Backend/.env`. The OTP code will be logged to the backend console:
    ```
    [DEV SMS ADAPTER] Simulated SMS to +91 98*** ***10: Your Restrauque OTP is 123456. Valid for 5 minutes.
    ```
  - In Production: Upgrade the Twilio project, configure `TWILIO_VERIFY_SERVICE_SID`, and enable India (+91) geo-permissions in Twilio Console.
- **Relevant Files**: `Backend/lib/auth/otp-provider.ts`, `Backend/lib/auth/otp.ts`.

---

## 7. Dining Table & QR Token Failures

### Symptom: Customer scans table QR code and sees `Table or QR Code Expired / Invalid` (HTTP 404)
- **Likely Cause**: The table's QR token was rotated by the restaurant owner, or the token string was truncated.
- **Diagnostic Step**: Query `qr_codes` for the SHA-256 hash of the token.
- **Safe Fix**: If an owner rotated the QR code from the dashboard, reprint the new QR code from `http://localhost:5174/dashboard/tables` or use the active QR URL displayed in the dashboard.
- **Relevant Files**: `Backend/app/api/v1/public/qr/[token]/route.ts`, `Backend/lib/qr/token.ts`.
