# Portfolab

**Build Real Projects. Prove Your Skills.**

## Why Portfolab

Many Arabic-speaking beginners finish courses but still have no portfolio that reflects what employers actually hire for, and there is very little project-based learning content in Arabic. Portfolab closes that gap: learners build complete full-stack projects, with tests, deployment and a written explanation, so they finish with real work they can show in interviews.

**Who it is for:** junior developers and new graduates who want job-ready portfolio projects.

**How it works:** Arabic lessons with checkpoints, a starter repo with TODO markers, and a tested reference solution for each project.

**Market-driven:** project ideas are chosen from skills that job postings repeatedly ask for.

Arabic-first (RTL) learning platform where junior developers build, test, deploy and explain real full-stack portfolio projects. The free tier ships one complete project (**TaskFlow Lite**); Pro projects (**Portfolab Pro**) are listed as *Coming soon* until they are built and reviewed. Portfolab is made by the team behind the *Ahmed & Claude* Instagram series.

- Original product spec (written under the working name *Ahmed & Claude — Portfolio Builder*): [`Ahmed_Claude_Portfolio_Builder_Claude_Code.md`](Ahmed_Claude_Portfolio_Builder_Claude_Code.md)
- Analytics (PostHog): [`docs/analytics/posthog-setup.md`](docs/analytics/posthog-setup.md) · Payments (Paymob): [`docs/payments/paymob.md`](docs/payments/paymob.md)
- What is built and what is not: [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- Decisions and open owner questions: [`DECISIONS.md`](DECISIONS.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md) · Roadmap: [`docs/roadmap.md`](docs/roadmap.md) · Acceptance criteria: [`docs/acceptance-criteria.md`](docs/acceptance-criteria.md)

## Stack

pnpm workspaces · TypeScript (strict) · React 19 + Vite 7 + Tailwind 4 · Express 5 · PostgreSQL 16 + Prisma 6 · Zod 4 · Argon2id · PostHog · Paymob · Vitest + Supertest · Playwright

Internal identifiers (package names `@pb/*`, the root package name, DB/env names) intentionally keep their original names to avoid breaking compatibility.

```
apps/api        Express API (auth, content, progress, resources, admin)
apps/web        React SPA (RTL Arabic UI)
packages/shared Zod schemas + shared types
packages/config tsconfig base
content/        Lesson Markdown + downloadable resources (imported into the DB)
examples/taskflow-lite/{reference,starter}   The free teaching project (standalone npm projects)
e2e/            Playwright smoke tests
```

## Local setup (clean clone)

Requirements: Node 20.19+ (tested on 24), pnpm 9, Docker Desktop.

```bash
pnpm install
docker compose up -d db            # PostgreSQL 16 on :5432 (creates *_test DBs too)
cp apps/api/.env.example apps/api/.env
```

Edit `apps/api/.env`: set `SESSION_SECRET` to a long random string. Optionally set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` (local only) to get an admin user.

```bash
pnpm --filter @pb/api db:deploy    # apply migrations
pnpm db:seed                       # import content/ + optional admin
pnpm dev                           # API :4000 + web :5173
```

Open http://localhost:5173. API health: http://localhost:4000/api/health.

Make an existing user an admin: `pnpm --filter @pb/api make-admin you@example.com`.

## Tests

```bash
pnpm lint && pnpm typecheck
pnpm test                          # shared + API integration (uses portfolio_builder_test) + web unit
PW_CHANNEL=chrome pnpm test:e2e    # Playwright; omit PW_CHANNEL after `pnpm exec playwright install chromium`
```

TaskFlow Lite reference project (own DB on :5433):

```bash
cd examples/taskflow-lite/reference
docker compose up -d db
cp server/.env.example server/.env && cp server/.env.example server/.env.test   # set DB name to taskflow_test in .env.test
npm install && npm test
```

## Content workflow

Lessons live in `content/projects/<slug>/<module-key>/*.md` with YAML frontmatter (slug, title, order, durationMinutes, isPreview, status, checkpoints). Import with `pnpm --filter @pb/api content:import` or the **استيراد المحتوى** button in `/admin/projects`. Import updates text and checkpoints but keeps statuses chosen in the admin UI (`--sync-status` overrides). A fenced code block with `spoiler` in its meta (```` ```js spoiler ````) renders collapsed.

## Security notes

HttpOnly/SameSite session cookies (Secure in production) with server-side revocation · Argon2id · signed double-submit CSRF + Origin allowlist · rate limits on auth, reset and analytics · Zod on every input · helmet · JSON body limit · no stack traces to clients · paid content and downloads only via authorized API routes · no IP addresses stored for analytics.

## Analytics & payments

- **PostHog** (optional): `cp apps/web/.env.example apps/web/.env.local`, set `VITE_POSTHOG_KEY`; set `POSTHOG_API_KEY` in `apps/api/.env` for server events. Without keys, analytics is a no-op. Nothing loads before the visitor consents. Details: [`docs/analytics/posthog-setup.md`](docs/analytics/posthog-setup.md).
- **Paymob** (sandbox only): set the `PAYMOB_*`, `API_PUBLIC_URL` and `CHECKOUT_ENABLED` variables in `apps/api/.env`. Checkout stays closed until a Pro project is published. Live keys are refused unless `PAYMOB_ALLOW_LIVE=true`. Details: [`docs/payments/paymob.md`](docs/payments/paymob.md).
- Maintenance: `pnpm --filter @pb/api payments:reconcile` (stuck pending orders), `pnpm --filter @pb/api analytics:purge` (retention).

## Not implemented (by design, needs owner approval)

Live payments (Paymob is integrated but sandbox-only and gated), real email delivery for password reset, PostHog project + dashboards (need your account), Instagram DM automation, deployment. See `IMPLEMENTATION_STATUS.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration: SESSION_SECRET` | Set a 32+ char value in `apps/api/.env` |
| `/api/health` says `database: down` | `docker compose ps`; check `DATABASE_URL` port |
| API tests fail on connect | The `portfolio_builder_test` DB is created on first container init; if your volume predates that, run `docker compose exec db createdb -U pb portfolio_builder_test` |
| Port 5432 busy | Stop the other Postgres or change the port mapping and `DATABASE_URL` |
| Password reset email never arrives | Expected: no email provider yet. In development the link is printed in the API console |
| Windows PowerShell: `pnpm.ps1 cannot be loaded` (script execution disabled) | Run `pnpm.cmd` instead of `pnpm`, enable scripts with `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`, or run commands in WSL2 / Git Bash |
| Windows PowerShell: `cp` or `&&` setup commands fail | Use `Copy-Item apps/api/.env.example apps/api/.env` and `;` instead of `&&`, or run the setup commands in WSL2 / Git Bash |
| Windows: `docker compose up -d db` fails to start or connect | Start Docker Desktop and ensure the WSL2 (Linux containers) backend is running before `docker compose up -d db` |
