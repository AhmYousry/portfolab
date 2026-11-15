# Roadmap

Effort estimates are for one focused developer with AI tooling; they are guesses, re-estimated after each phase.

## Phase 1 — Foundation (~2 days)

| # | Item | Depends on | Est. |
|---|---|---|---|
| 1.1 | pnpm workspace, strict TS bases, ESLint flat config, Prettier | — | 2h |
| 1.2 | Docker Compose PostgreSQL (dev + test DBs) | — | 0.5h |
| 1.3 | Prisma schema (all spec §7 entities), first migration | 1.2 | 3h |
| 1.4 | API skeleton: env validation, envelope, error handler, health | 1.1 | 2h |
| 1.5 | Web skeleton: router, RTL shell, design tokens, fonts, primitives | 1.1 | 4h |
| 1.6 | CI workflow (lint, typecheck, test with Postgres service, build) | 1.1–1.5 | 1h |
| 1.7 | README with clean-install steps | all | 1h |

## Phase 2 — Free MVP (~7–10 days)

| # | Item | Depends on | Est. |
|---|---|---|---|
| 2.1 | Auth: signup/login/logout/me, CSRF, rate limits, reset flow | 1.3, 1.4 | 1d |
| 2.2 | Content import (Markdown → DB) + seed admin | 1.3 | 0.5d |
| 2.3 | Public API: projects, curriculum, pricing | 2.2 | 0.5d |
| 2.4 | Access service + lesson API + progress/checkpoints + enrollments | 2.1, 2.2 | 1d |
| 2.5 | Resources download with tier/unlock checks | 2.4 | 0.5d |
| 2.6 | Web pages: landing, pricing, curriculum, project, lesson reader, dashboard, progress, resources, account, auth pages, legal placeholders | 2.1–2.5 | 3d |
| 2.7 | Admin: overview metrics, projects/lessons status + preview, users, orders, analytics CSV, audit log | 2.4 | 1d |
| 2.8 | Analytics events + UTM + consent banner | 2.3 | 0.5d |
| 2.9 | API integration tests (auth, permissions, progress, admin, validation) | 2.1–2.7 | 1d |
| 2.10 | Playwright smoke (anonymous browse, signup → lesson → checkpoint) | 2.6 | 0.5d |

## Phase 2b — TaskFlow Lite content (~4–6 days)

| # | Item | Est. |
|---|---|---|
| 2b.1 | Reference app (React + Express + Prisma + Zod) with tests | 1.5d |
| 2b.2 | Starter repo with TODO markers | 0.5d |
| 2b.3 | Six Arabic modules + F01–F10 prompts | 2d |
| 2b.4 | Resources: brief, API contract, data model worksheet, README template, deployment checklist | 0.5d |

## Phase 3+ (not started — needs owner input)

- Beta testing with 5–10 learners; fix content.
- Real email provider for password reset (D-009).
- Payment provider selection + legal pages (D-008, D-015).
- ExpensePilot full curriculum and reference implementation.
