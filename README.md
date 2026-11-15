# Ahmed & Claude — Portfolio Builder

Arabic-first (RTL) learning platform where junior developers build, test, deploy and explain real full-stack portfolio projects. The free tier ships one complete project (**TaskFlow Lite**); Pro projects are listed as *Coming soon* until they are built and reviewed.

- Product spec (source of truth): [`Ahmed_Claude_Portfolio_Builder_Claude_Code.md`](Ahmed_Claude_Portfolio_Builder_Claude_Code.md)
- What is built and what is not: [`IMPLEMENTATION_STATUS.md`](IMPLEMENTATION_STATUS.md)
- Decisions and open owner questions: [`DECISIONS.md`](DECISIONS.md)
- Architecture: [`docs/architecture.md`](docs/architecture.md) · Roadmap: [`docs/roadmap.md`](docs/roadmap.md) · Acceptance criteria: [`docs/acceptance-criteria.md`](docs/acceptance-criteria.md)

## Stack

pnpm workspaces · TypeScript (strict) · React 19 + Vite 7 + Tailwind 4 · Express 5 · PostgreSQL 16 + Prisma 6 · Zod 4 · Argon2id · Vitest + Supertest · Playwright

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

## Not implemented (by design, needs owner approval)

Payments/checkout, real email delivery for password reset, Instagram DM automation, deployment. See `IMPLEMENTATION_STATUS.md`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Invalid environment configuration: SESSION_SECRET` | Set a 32+ char value in `apps/api/.env` |
| `/api/health` says `database: down` | `docker compose ps`; check `DATABASE_URL` port |
| API tests fail on connect | The `portfolio_builder_test` DB is created on first container init; if your volume predates that, run `docker compose exec db createdb -U pb portfolio_builder_test` |
| Port 5432 busy | Stop the other Postgres or change the port mapping and `DATABASE_URL` |
| Password reset email never arrives | Expected: no email provider yet. In development the link is printed in the API console |
