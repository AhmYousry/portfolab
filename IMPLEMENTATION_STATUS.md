# Implementation status — Portfolab

Last updated: 2026-11-26 (guided learner workflow review)

## Guided learner workflow (2026-11-26)

All 12 TaskFlow Lite lessons now identify where each action happens (AI chat, editor, terminal folder or browser), the learner's choice, the expected result and a manual check. The 42 lesson prompts are English and request simple Egyptian Arabic explanations, one small change at a time, followed by learner verification. Lessons 1–2 use conversation/notes before the repository exists. Setup starts with a visible frontend before database setup and explains the starter's unfinished behavior. Deployment remains optional.

Prompt cards expose editable `{{...}}` choices, an English preview and copy disabled until all choices are filled. Multiline text and literal replacement characters are preserved; blocks are independent and reset across lesson changes. Copy failures are visible and analytics receive only prompt metadata. The landing copy, prompt resource and starter README match this workflow.

Verified: 75 web tests, 20 API content/resource/progress tests, typecheck, lint, formatting and build; live lesson browser checks for customization/copy, navigation reset and a 390px mobile layout. A fresh isolated starter install and its health test passed, and the documented schema-check commands produced the expected results. All 33 checkpoint keys and existing database IDs/progress rows were preserved during content import. The AI's actual response quality remains dependent on the learner's external assistant; no model is embedded or called by the platform. Changes are prepared for local owner review before launch.

## Zero-budget beta

The Render Free deployment uses one Node web service for the API and built React app, with Neon Free for persistent data. `AUTH_MODE=social` enables Google/GitHub signup and login, disables password and reset endpoints, and starts without a mail provider. Deletion uses linked-provider reauthentication followed by an explicit confirmation and a short-lived, single-use grant bound to the original session. The existing password mode remains the default for other deployments.

Setup instructions are in [deploy/RENDER_FREE.md](deploy/RENDER_FREE.md), including an Egyptian Arabic quick-start for an owner with only a GitHub account. `render.yaml` passed validation against Render's published JSON schema and selects one Free service.

Executed locally on 2026-11-25:

- API suite: 267 tests passed across 16 files.
- Web suite: 61 tests passed. Shared schemas: 7 tests passed.
- Render build, typecheck, lint, formatting, and migration deployment passed.
- Production-mode HTTPS browser checks passed for the social-only UI, privacy consent, authorization start, lesson deep links, API JSON 404, enrollment, persisted checkpoints, starter ZIP download, and final account deletion. Provider navigation was intercepted, and the final deletion grant was synthetic. OAuth exchanges and identity verification were tested with mocks.
- Browser checks also passed for capabilities-request failures across signup, login, recovery, and account settings.

Website hosting and real provider callbacks are pending. Neon Free is now connected; the owner still needs a Render account and at least one OAuth client pair. Hosting regions and the remaining legal draft text need final review after account setup.

## Neon Auth email/password mode (2026-11-26, live signup verified)

`AUTH_MODE=neon` is an explicit opt-in; `password` and `social` are unchanged. The browser uses the official `@neon/auth` SDK (`signUp.email`, `signIn.email`, `getSession`, `changePassword`, `signOut`) with the Auth URL delivered at runtime through `/api/auth/oauth/providers` (`neonAuthUrl`), so no build-time alias or secret is needed. `POST /api/auth/neon/session` verifies the Neon JWT (project JWKS, EdDSA only, issuer, audience, expiry, max age) and requires a live `neon_auth.session` row owned by the token subject before creating a local session bound to it (`Session.neonSessionId`, expiry capped at the upstream expiry). `loadSession` re-checks the upstream row on every request and revokes the local session when it is gone, and fails closed on lookup errors. Neon mode accepts only Neon-bound sessions; other modes reject them.

Identity mapping is the new `NeonAuthIdentity` model (unique `subject`, unique `userId`, migration `20261126120000_neon_auth_identity`). Email collisions with existing local users are refused (`EMAIL_IN_USE`) and never auto-linked; local password hashes are never written for existing users. New local accounts require privacy consent (`SIGNUP_REQUIRED` otherwise; the login page offers the consent step). Deletion in neon mode requires a Neon sign-in from the last 5 minutes for the same subject; the identity row remains as a tombstone (`ACCOUNT_UNAVAILABLE` on re-entry). Legacy change-password, reset, password deletion, OAuth start/callback and reauth grants are refused in neon mode. CSP `connect-src` allows the Neon Auth origin only in neon mode.

Tests added in `apps/api/test/neon-auth.test.ts`: mode validation, forged/foreign-key/wrong-issuer/wrong-audience/expired/HS256/unsigned/tampered tokens, session-ownership mismatch, client-supplied identity fields, privacy consent, email collision, subject-based login, upstream revocation, fail-closed lookup, cross-mode session separation, logout, and deletion (stale/foreign/legacy proofs and the deleted-user tombstone). All 19 tests passed against the isolated local test database.

Neon CLI install/init/deploy completed for the requested production branch; Auth is enabled and the seventh additive migration is applied. The organization remains on Free. Actual SDK signup/getSession/signout/signin passed, and live JWT issuer/audience and managed session column names were confirmed. Local browser signup, same-user readback, reload, logout/copied-cookie rejection, wrong-password messaging, relogin, protected-page redirection, and upstream-session revocation passed against real Neon. Synthetic test accounts were cleaned up. Typecheck, lint, web tests (61) and shared tests (7) passed. The initial existing API suite had two expected-response failures caused by the added nullable capability field; the expectations were updated and all 12 tests in that affected file passed. Render now defaults to neon mode; local env also opts in. Pending: Render origin allowlist and hosting env/deployment, real-browser password change/deletion, and third-party-cookie-blocking browsers. Password reset in neon mode is not implemented.

## Live Neon verification (2026-11-25)

Neon CLI initialized the requested project `gentle-recipe-76904760`, branch `production`, in organization `org-lively-mode-74750072`. Deployment utilized Postgres only and pulled the connection variables into ignored `.env.local`. The organization plan was verified as Free.

The existing Prisma driver uses the pooled runtime URL. Migration deployment uses the direct connection through `DATABASE_URL_UNPOOLED` (or the existing `DIRECT_DATABASE_URL` alias). All six migrations were applied and course content imported. A subsequent `pnpm neon:migrate` reported no pending migrations.

Validation passed: exact `npm run build`, typecheck, lint, formatting, 14 isolated environment/migration safety tests, and a check that the web build contains no Neon credentials. Playwright uses `dev:local` and refuses to reuse an existing API server, preventing normal test setup from connecting to the root Neon environment.

A local browser run against actual Neon verified signup/session persistence, onboarding, enrollment, checkpoint persistence after reload and relogin, authenticated starter download, and account deletion/session revocation. The synthetic account and associated user rows were cleaned up. This run used temporary local password mode; real Google/GitHub callbacks remain unverified and the social-only hosting configuration is unchanged. An initial browser run timed out because it navigated before logout completed; awaiting the logout response resolved the test timing issue and the full rerun passed.

## Earlier product summary (2026-11-15)

The Free MVP (platform + TaskFlow Lite) is implemented and tested locally. The upgrade added the **Portfolab** brand, **PostHog** product analytics (consent-gated, typed, server + client), and a **Paymob** checkout integration that is complete in code and tested against a mocked Paymob API, but **sandbox-only and closed** until you provide credentials, publish a Pro project, and approve going live.

## Done

| Area | What exists | Evidence |
|---|---|---|
| Monorepo | pnpm workspaces, strict TS, ESLint, Prettier, Docker Compose Postgres, env validation | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean |
| Data model | Spec §7 entities + `PasswordResetToken`; 3 migrations (3rd is additive: purchase lifecycle fields + `User.analyticsConsent`); partial unique index for one active entitlement per user/tier | `apps/api/prisma/` |
| Auth | Signup/login/logout/me, forgot/reset, change password, Argon2id, DB sessions (hash only), expiry, revocation, CSRF, Origin check, rate limits | `auth.test.ts` |
| Access control | Anonymous/free/Pro/admin matrix; drafts hidden; Pro lessons/resources/progress blocked by guessed IDs | `access.test.ts`, `resources.test.ts` |
| Learning | Enrollment, lesson reader, checkpoints, dashboard, progress page | `progress.test.ts`, E2E |
| Branding | Portfolab name, tagline, logo mark/wordmark, favicon, OG/Twitter meta + 1200×630 PNG, PWA manifest, per-route titles, Portfolab Starter/Pro tiers, branded reset email template, README/docs | E2E branding test |
| PostHog (web) | Lazy SDK after consent; manual SPA pageviews; scoped autocapture with `data-attr` ids; typed custom events; identify by internal id; reset on logout; UTM + device super properties; URL secret scrubbing; replay double-gated + masked + blocked on sensitive routes; failure-safe | `apps/web/src/lib/analytics.test.ts` (16) |
| PostHog (api) | `captureForUser` (consent-checked, allowlisted props) for learning and purchase events; no-op without key; flush on shutdown | `payments.test.ts` |
| Consent | Banner with separate replay opt-in, footer "إعدادات التحليلات", account settings, server sync, privacy page | E2E consent test |
| Paymob | Intention + Unified Checkout URL; HMAC-SHA512 webhook verification (doc sample vector); idempotent webhook events; amount/currency check; PAID → entitlement + audit; FAILED; REFUNDED → revoke; reconciliation via transaction inquiry (status `?refresh=1` + `payments:reconcile` script); secure logging; live keys refused by default | `payments.test.ts` (24) |
| Admin | Overview with verified metrics (users, active learners 30d, project starts/completions, free→Pro conversion, confirmed purchases, revenue from PAID records, refunds), checkout/Paymob config status (no secrets), orders with failure reasons | `payments.test.ts` admin case, E2E |
| Retention | `analytics:purge` removes first-party events and webhook records older than `ANALYTICS_RETENTION_DAYS` (395) | script |
| TaskFlow Lite | Reference app + starter + 12 Arabic lessons (unchanged by this upgrade) | `examples/taskflow-lite/` |
| CI | GitHub Actions workflow (not yet run — no remote) | `.github/workflows/ci.yml` |

## Test results (local, 2026-11-15, after the upgrade)

| Suite | Result |
|---|---|
| Shared (`packages/shared`) | 6 passed |
| API integration (`apps/api`) | 98 passed (74 existing + 24 payments/analytics) |
| Web unit (`apps/web`) | 23 passed (7 existing + 16 analytics) |
| Playwright E2E (desktop + mobile, local Chrome) | 10 passed |
| `pnpm build` (api + web) | passed |
| Lint / typecheck / format | clean |

## Bugs found and fixed

1. TaskFlow reference: `.partial()` re-applied Zod defaults on PATCH. Fixed (lesson 05 teaches it).
2. Web: onboarding skipped after signup. Fixed.
3. Web: checkpoint checkbox waited for the server. Now optimistic with rollback.
4. **Upgrade:** the committed `pnpm-lock.yaml` still resolved `zod@4.1.12` for `packages/shared` although its `package.json` said `4.6.7` (CI's `--frozen-lockfile` would have failed). Lockfile re-synced.

## Not done / needs owner input

| Item | Needed from you | Ref |
|---|---|---|
| PostHog project + dashboards | Create project, set keys, create the 7 dashboards from `docs/analytics/posthog-setup.md` §5, set retention | D-022 |
| Paymob sandbox run | Merchant account, test integration IDs, keys, HMAC secret, public `API_PUBLIC_URL`; run the sandbox checklist | `docs/payments/paymob.md` |
| Live payments | Explicit approval + `PAYMOB_ALLOW_LIVE=true` + a PUBLISHED Pro project + final refund/terms | D-027 |
| Email delivery | Resend adapter is implemented. Create a Resend account, verify a sending domain (SPF/DKIM DNS), create a sending-only API key, set `RESEND_API_KEY` + `EMAIL_FROM` in the production host env | D-009 |
| Legal pages | Business identity, support email, refund terms, PostHog region/retention values | D-015 |
| Deployment | Hosting provider/budget | spec Part C |
| Content review | Human review of lessons | spec §11 |
| Admin manual entitlement grant UI | Not built | backlog |

## Known issues / risks

- PostHog delivery and Paymob calls are verified only against mocks; real-network behavior is unverified until keys exist.
- Paymob `transaction_inquiry` response shape is not fully documented; validate in sandbox.
- Prisma CLI dev-dependency advisories (no Prisma 6 fix); in-memory rate limiting; E2E leaves `e2e-*@example.test` users in the dev DB.

## Next steps (proposed)

1. Provide PostHog keys → verify with the checklist in `docs/analytics/posthog-setup.md` §6.
2. Provide Paymob **test** credentials + a public API URL (e.g. a tunnel) → run the sandbox checklist.
3. Review lessons/landing copy; beta-test TaskFlow Lite.
4. Approve ExpensePilot build; publish it before opening checkout.
