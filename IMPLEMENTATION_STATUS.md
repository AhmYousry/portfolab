# Implementation status

Last updated: 2026-11-15

## Summary

Phase 0 (plan), Phase 1 (foundation), Phase 2 (Free MVP) and the TaskFlow Lite content are implemented and tested locally. Payments, email delivery, deployment and Instagram automation are **not** implemented and need owner decisions.

## Done

| Area | What exists | Evidence |
|---|---|---|
| Monorepo | pnpm workspaces, strict TS, ESLint, Prettier, Docker Compose Postgres, env validation | `pnpm lint`, `pnpm typecheck`, `pnpm format:check` clean |
| Data model | All spec §7 entities + `PasswordResetToken`; 2 migrations; partial unique index for one active entitlement per user/tier | `apps/api/prisma/` |
| Auth | Signup/login/logout/me, forgot/reset, change password, Argon2id, DB sessions (hash only), 7-day expiry, revocation, CSRF, Origin check, rate limits | `apps/api/test/auth.test.ts` |
| Access control | Single access service; anonymous/free/Pro/admin matrix; drafts hidden; pro lessons/resources/progress blocked by guessed IDs | `access.test.ts`, `resources.test.ts` |
| Learning | Enrollment, lesson reader, checkpoints, auto lesson completion, dashboard, progress page, project-completion event | `progress.test.ts`, E2E |
| Resources | Authorized downloads only; zips exclude `.env*` (except `.env.example`) and `node_modules`; path-traversal guard; reference solution unlocks after the `crud-endpoints` checkpoints | `resources.test.ts` |
| Admin | Overview, funnel, content tree with audited status changes + confirm, lesson preview, content import, masked user list, orders (empty), CSV export (aggregate, formula-safe), audit log API | `admin.test.ts`, E2E |
| Privacy | Analytics opt-in banner, no IP/UA in events, data export, account deletion (anonymize + revoke) | `account.test.ts`, `analytics.test.ts` |
| Web | RTL Arabic UI: landing, pricing, curriculum, project, lesson (LTR code, spoilers), auth, onboarding, dashboard, progress, resources, account, legal placeholders, admin; mobile nav; code-split | Playwright desktop + mobile |
| TaskFlow Lite | Reference app (Express 5 + Prisma + Zod + React) with 23 API + 4 UI tests; starter with TODOs and acceptance tests; 6 modules / 12 Arabic lessons / 33 checkpoints; F01–F10 prompts; brief, worksheet, README template, deployment checklist | `examples/taskflow-lite/`, `content/` |
| Pro prep | ExpensePilot/TeamBoard/IssueForge seeded `COMING_SOON` (outline only); entitlement model + tests; ExpensePilot design doc | `docs/pro/expensepilot.md` |
| CI | GitHub Actions: lint, format, typecheck, tests (Postgres service), build, Playwright, TaskFlow reference tests | `.github/workflows/ci.yml` (not yet run on GitHub — no remote) |

## Test results (local, 2026-11-15)

| Suite | Result |
|---|---|
| Shared schemas (`packages/shared`) | 3 passed |
| API integration (`apps/api`) | 74 passed |
| Web unit (`apps/web`) | 7 passed |
| Playwright E2E (desktop + mobile, local Chrome) | 7 passed |
| TaskFlow reference server | 23 passed |
| TaskFlow reference client | 4 passed |
| TaskFlow starter health test | 1 passed |
| `pnpm build` (api + web) | passed |

## Bugs found by tests and fixed

1. TaskFlow reference: `updateTaskSchema = createTaskSchema.partial()` re-applied Zod defaults, so a PATCH of only `title` reset `status`/`priority`. Fixed; documented in lesson 05 as a teaching moment.
2. Web: after signup, the "already logged in" redirect beat the onboarding redirect, so onboarding was skipped. Fixed.
3. Web: checkpoint checkbox waited for the server before flipping. Now optimistic with rollback.

## Not done / needs owner input

| Item | Why blocked | Decision ref |
|---|---|---|
| Payments / checkout | Needs provider choice, Egyptian merchant eligibility, webhook verification, policies, explicit approval | D-008 |
| Email delivery (password reset) | No provider chosen; dev prints link to console; production sends nothing | D-009 |
| Legal pages | Placeholders marked "draft — owner review"; need legal identity, support email, refund terms | D-015 |
| Deployment | Hosting provider/budget not chosen | spec Part C |
| Instagram `BUILD` DM flow | External integration; needs Meta permission verification and approval | spec §13 |
| Content review | Lessons were written by Claude and are **not human-reviewed**; needs owner/beta-learner review before public launch | spec §11 |
| Admin manual entitlement grant UI | Not built; entitlements can only be created in DB/tests | backlog |

## Known issues / risks

- `npm audit` reports high-severity advisories in the **Prisma CLI's** dependencies (`effect`, `deepmerge-ts` via `@prisma/config`), a dev/build-time tool; no Prisma 6.x fix exists. Runtime `@prisma/client` is unaffected per the advisory paths. Revisit with a Prisma 7 migration.
- Rate limiting is in-memory (resets on restart, per-instance). Use a shared store if running multiple instances.
- Fonts include all subsets from `@fontsource`; can be trimmed to Arabic + Latin.
- Starter's `tasks.test.js` and `TaskForm.test.jsx` fail until the student implements the TODOs (by design).
- E2E runs against the dev database and leaves `e2e-*@example.test` users behind.

## Next steps (proposed)

1. Owner reviews lessons 01–12 and the landing copy; run 5–10 beta learners through TaskFlow Lite.
2. Choose hosting + email provider; deploy a private beta.
3. Push to GitHub to run CI.
4. Approve starting ExpensePilot (design in `docs/pro/expensepilot.md`).
