# Architecture — Portfolab

Source of truth: `Ahmed_Claude_Portfolio_Builder_Claude_Code.md`. This document describes what is **actually built**.

## Repository discovery (2026-11-15)

- Folder contained only the specification file. No git repo, no code to preserve.
- Toolchain: Node 24.14, npm 11.9, pnpm 9.15 (installed globally via npm), Git 2.42, Docker 29.4 (Docker Desktop).
- No local PostgreSQL install; PostgreSQL runs in Docker Compose.

## Layout

```
apps/
  api/        Express 5 + TypeScript + Prisma 6 (PostgreSQL)
  web/        React 19 + Vite 7 + TypeScript + Tailwind 4 (RTL-first)
packages/
  shared/     Zod schemas, enums, API types shared by web and api
  config/     Shared tsconfig bases
content/      Version-controlled lesson Markdown + resource files (imported to DB)
examples/
  taskflow-lite/reference   Complete teaching app (own workspace, not in platform monorepo)
  taskflow-lite/starter     Student starter with TODO markers
docs/         Architecture, roadmap, acceptance criteria
e2e/          Playwright smoke tests
```

## Runtime flow

```
Browser (web, :5173) --/api proxy--> API (:4000) --Prisma--> PostgreSQL (:5432, Docker)
```

In production the web app is static files; the API is a separate service. `/api/health` is always JSON from the API, never the SPA fallback.

## API

- Response envelope: `{ data, error, meta }`. Errors: `{ data: null, error: { code, message, details? } }`. Stack traces are never returned.
- Validation: Zod at every boundary (`body`, `params`, `query`).
- Layers: `routes/*` (HTTP) → `services/*` (business rules, access checks) → Prisma.
- Middleware order: helmet → CORS allowlist → JSON body limit → cookie-parser → session loader → CSRF check (mutations) → routes → 404 → error handler.

## Authentication & sessions

- Passwords: Argon2id (`@node-rs/argon2`, prebuilt native binary).
- Session: 32-byte random token in `pb_session` cookie (`HttpOnly`, `SameSite=Lax`, `Secure` in production). Only the SHA-256 hash is stored in `Session.sessionTokenHash`.
- Expiry: 7 days absolute (`SESSION_TTL_DAYS`). Login creates a new session (rotation). Logout revokes. Password reset and password change revoke all sessions.
- CSRF: signed double-submit cookie. `GET /api/auth/csrf` sets `pb_csrf` (readable, HMAC-signed) and returns the token; every non-GET request must echo it in `X-CSRF-Token`. Plus `Origin` must be in `CORS_ORIGINS` when present.
- Rate limits (in-memory, per IP): auth endpoints, password reset, analytics ingest.
- Password reset: hashed single-use token, 30 min expiry. Consumption is an atomic conditional update (`usedAt IS NULL AND expiresAt > now`) inside the password-change transaction, so concurrent requests with one token cannot both succeed.
- Reset email delivery goes through the `Mailer` interface (`apps/api/src/services/mailer.ts`), Arabic RTL template:
  - `ConsoleMailer` (default in development/test): no network, no credentials; dev prints the link, test is silent.
  - `ResendMailer` (`services/resend-mailer.ts`): native `fetch` `POST https://api.resend.com/emails`, `Authorization: Bearer`, body `from/to/subject/text/html`, 10 s timeout (`AbortSignal.timeout`), redirects refused. Errors carry only a class (`timeout`/`network`/`http`) and HTTP status — never the response body, recipient, link or key.
  - Selection: `MAIL_PROVIDER` (`console`|`resend`), default `resend` in production and `console` elsewhere. Credentials alone never switch dev/E2E to Resend. Validated once at server startup (`server.ts`); production exits if the provider is `console`, `RESEND_API_KEY` is missing/not `re_...`, or `EMAIL_FROM` is missing/malformed/on `resend.dev` or a reserved test domain. Error output names the variable only. Scripts that import `env.ts` are unaffected.
  - `forgot-password` creates the token synchronously, then dispatches delivery without awaiting it, so response body, status and latency do not depend on whether the account exists or the provider succeeds. Failures log `[mailer] password reset delivery failed {reason, status}` only. In-flight deliveries are drained on SIGTERM/SIGINT.
  - Prerequisite: the `EMAIL_FROM` domain must be verified in Resend (SPF + DKIM DNS records) before production; otherwise Resend returns 403 and users receive nothing while the API still answers 200.

## Authorization & entitlements

`services/access.ts` is the single place that decides lesson/resource access:

| Content | Anonymous | Student (free) | Student + PRO entitlement | Admin |
|---|---|---|---|---|
| Published project overview + lesson titles | yes | yes | yes | yes |
| Free project, `isPreview` lesson body | yes | yes | yes | yes |
| Free project, other lesson body | no (401) | yes | yes | yes |
| Pro project lesson body | no (401) | no (403) | yes | yes |
| Draft / coming-soon project content | 404 | 404 | 404 | preview only via `/api/admin/*` |
| Resource download | no | tier + unlock rule | tier + unlock rule | yes |

Resources are served only through `GET /api/resources/:id/download`. There is no static path to `content/`.

## Content pipeline

`content/projects/<slug>/project.json` + `content/projects/<slug>/<NN-module>/<NN-lesson>.md` (frontmatter: slug, title, order, durationMinutes, isPreview, status, checkpoints[]). `pnpm --filter @pb/api content:import` upserts them; admins can trigger the same import from `/admin`. Pro projects are seeded `COMING_SOON` with outline only.

Lesson Markdown is rendered with `react-markdown` (raw HTML disabled). Code fences are forced `dir="ltr"`. A fence with meta `spoiler` renders collapsed behind an explicit reveal button.

## Analytics

Two layers:

1. **First-party funnel** (`LeadEvent`): allowlisted events, no IP/UA, used for the admin overview. Anonymous page events only after banner consent.
2. **PostHog** (behavioral analytics): web SDK (`apps/web/src/lib/analytics.ts`) lazy-loaded only after consent; server SDK (`apps/api/src/services/product-analytics.ts`) sends learning/purchase events only for users with `User.analyticsConsent = true`. All properties pass the shared allowlist (`sanitizeProperties`). Details and event catalog: `docs/analytics/posthog-setup.md`.

## Payments (Paymob)

`routes/checkout.ts` (session, status, availability) and `routes/webhooks.ts` (mounted before the global JSON parser and CSRF, own 256 kb parser and rate limit). `services/paymob.ts` is the only code that talks to Paymob; `services/payments.ts` owns the purchase state machine (PENDING → PAID | FAILED; PAID → REFUNDED) with conditional updates for idempotency. Entitlements are granted only from an HMAC-verified webhook or an authenticated transaction inquiry. Checkout is closed unless `CHECKOUT_ENABLED`, Paymob configured (test keys unless `PAYMOB_ALLOW_LIVE`), and a Pro project is published. Details: `docs/payments/paymob.md`.