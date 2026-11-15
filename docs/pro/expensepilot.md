# ExpensePilot — Pro project 1 design (not built)

Status: **design only**. The project is `COMING_SOON` in the platform. No lessons, reference code or checkout exist. Starting the build needs owner approval (see `IMPLEMENTATION_STATUS.md`).

## Problem & persona
Junior developer who finished TaskFlow Lite and now needs a project that proves they can handle **authentication, per-user data isolation, aggregation and reporting** — the things single-user CRUD projects never show.

## Scope (v1)
- Accounts: signup, login, logout, session expiry (server-side sessions, Argon2id) — same patterns as the platform, taught step by step.
- Accounts/wallets per user (e.g. "Cash", "Bank — synthetic").
- Categories (seeded defaults + user-defined).
- Transactions: amount (integer minor units), type (income/expense), category, date, note.
- Monthly budget per category; over-budget indicator.
- Filters: date range, category, type; pagination.
- Dashboard: month totals, by-category chart, last-6-months trend.
- CSV export with formula-injection-safe cells.
- **Owner-only access** on every record, verified by tests that try guessed IDs.

Out of scope: bank integrations, real financial data, multi-currency conversion, shared budgets.

## Data model (draft)
```
User(id, email, passwordHash, ...)
Session(id, userId, tokenHash, expiresAt, revokedAt)
Wallet(id, userId, name, currency='EGP')
Category(id, userId?, name, kind)           -- userId null = default
Transaction(id, userId, walletId, categoryId, type, amountMinor INT, occurredOn DATE, note?)
Budget(id, userId, categoryId, month DATE, limitMinor INT) UNIQUE(userId, categoryId, month)
```
Every query filters by `userId` from the session, never from the request body.

## Milestones → modules
| # | Module | Checkpoint (observable) | Est. |
|---|---|---|---|
| 1 | Product scope | scope.md + permissions table | 1.5h |
| 2 | Data model | migrations, money as integers, indexes justified | 2h |
| 3 | Auth | signup/login/logout + tests for wrong password, expiry, logout revocation | 4h |
| 4 | Transactions | CRUD with owner checks; test: user B gets 404 on user A's id | 4h |
| 5 | Reporting | SQL aggregation by month/category; chart renders from API | 3h |
| 6 | Tests | integration + security suite (IDOR, validation, CSV injection) | 3h |
| 7 | Deployment | env, migrations, health, budget alert | 1.5h |
| 8 | Interview pack | 12 questions + rubric | 2h |

Estimated student effort: 18–25h (hypothesis; validate with beta learners).

## Required deliverables before release (spec §10)
- [ ] Starter repo with TODOs + tested reference solution + synthetic seed data
- [ ] 8 modules of Arabic lessons using the lesson template
- [ ] ≥ 13 project-specific prompts (toward the 40+ Pro total)
- [ ] Security/validation/failure-case checklist
- [ ] Deployment & operational README
- [ ] Portfolio presentation pack + 10–15 interview questions + rubric
- [ ] Human review of all content and a clean-install run

## Implementation backlog (platform side)
1. Import ExpensePilot lessons as `DRAFT`; admin preview only.
2. Pro entitlement gating already enforced and tested (`apps/api/test/access.test.ts`).
3. Release = admin flips project/modules/lessons to `PUBLISHED` (audited).
4. Checkout stays disabled until D-008 is resolved; Pro content can be beta-tested with manually granted entitlements (audited) for invited learners.
