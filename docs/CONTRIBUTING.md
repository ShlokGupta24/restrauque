# Developer Contribution & Workflow Guide

Welcome to the Restrauque development team! This guide establishes the code standards, Git hygiene, architectural patterns, and testing protocols required for contributing to the repository.

---

## 1. Quick Onboarding Checklist (Day 1)

Follow this checklist to get your environment ready:

- [ ] Clone the repository and checkout the active branch (`Backend`).
- [ ] Verify Node.js (`v20.x`+ recommended) and npm (`v10.x`+).
- [ ] Review [Architecture Guide](./ARCHITECTURE.md) and [System Workflows](./BUSINESS_WORKFLOWS.md).
- [ ] Create `Backend/.env` from `Backend/.env.example` and set `SMS_PROVIDER="mock"`.
- [ ] Run `npm install` and `npx prisma generate` in `Backend/`.
- [ ] Start the backend development server (`npm run dev`) and verify `http://localhost:3000/api/v1/health`.
- [ ] Install dependencies and start the frontend applications you are contributing to (see [Local Development](./LOCAL_DEVELOPMENT.md)).
- [ ] Run the backend test suite (`npm test` in `Backend/`) to confirm your baseline environment.

---

## 2. Git Conventions & Branching Strategy

### Branch Architecture
- **`main`**: Production-ready, stable releases.
- **`Backend`**: Integration branch for backend APIs, database schemas, and full-stack integrations.
- **`frontend`**: Frontend integration branch.
- **`feature/<name>`**: Focused feature or bugfix branches branched off `Backend`.

### Conventional Commits
All commit messages must follow the [Conventional Commits](https://www.conventionalcommits.org/) standard:

```
<type>(<scope>): <short description in present tense>

[optional detailed body]
```

#### Approved Types:
- `feat`: A new user-facing or API feature.
- `fix`: A bug fix.
- `docs`: Documentation-only additions or revisions.
- `refactor`: Internal code change that neither fixes a bug nor adds a feature.
- `test`: Adding or correcting tests.
- `chore`: Tooling, dependency configuration, or maintenance.

#### Example:
```
feat(loyalty): enforce 50 percent bill cap on points redemption
```

---

## 3. How to Safely Add a New Feature

### 3.1 Adding a New Backend API Endpoint
When introducing a new endpoint:

1. **Create the Route Handler**:
   Create a folder in `Backend/app/api/v1/<domain>/[param]/` containing `route.ts`.
2. **Enforce Authentication & Tenancy**:
   Always use `requireCustomer()` or `requireRestaurantOwner()` from `Backend/lib/auth/guard.ts`. Never trust IDs passed in request bodies or query parameters for tenancy.
3. **Define a Zod Validation Schema**:
   Create a schema in `Backend/lib/validation/<domain>.ts` to parse and validate incoming payloads before invoking domain logic.
4. **Implement Domain Logic in Service Layer**:
   Encapsulate business logic in `Backend/lib/<domain>/service.ts`. Keep route handlers thin.
5. **Use Standard Response Envelopes**:
   Use `formatSuccessResponse(data)` and standard error classes (`ValidationError`, `NotFoundError`, `ForbiddenError`, `ConflictError`) from `Backend/lib/http/errors.ts`.
6. **Add Unit & Integration Tests**:
   Create a test file in `Backend/tests/<feature>.test.ts` using Vitest.

---

### 3.2 Adding or Modifying a Database Model
1. **Update `Backend/prisma/schema.prisma`**:
   Add the model, fields, relations, and indexes. Use PostgreSQL snake_case for column names where mapped (`@map("column_name")`).
2. **Generate Prisma Client**:
   ```bash
   cd Backend
   npx prisma generate
   ```
3. **Prepare Migration SQL**:
   Create a timestamped migration directory under `Backend/prisma/migrations/<timestamp>_<description>/migration.sql` with safe DDL statements and check constraints.
4. **Coordinate with Team**:
   Never execute destructive drop operations on shared databases.

---

### 3.3 Adding a Frontend Page or Feature
1. **Define Domain Types**:
   Update `types.ts` in the respective frontend app to mirror the backend contract.
2. **Add Service Methods**:
   Add methods to `src/services/<domain>Service.ts` with `{ credentials: 'include' }`.
3. **Build Accessible, Responsive Components**:
   Follow Restrauque brand tokens (Navy `#174A82`, Warm Ivory `#FCF8ED`, Gold `#D7B67C`).
4. **Verify TypeScript & Production Build**:
   Run `npm run build` in the frontend directory to ensure zero type errors.

---

## 4. Safety Guardrails & Code Hygiene

1. **No Secret Leaks**: Never hardcode API keys, database credentials, or tokens in source code or commit messages.
2. **Never Commit `node_modules` or `.vite` Churn**: Always check `git status` before committing. Discard `.vite/deps` cache changes.
3. **Preserve Comments & Tests**: Maintain documentation integrity; never delete existing test suites or comments unrelated to your task.
