# Decisions

| ID | Decision | Why | Status |
|---|---|---|---|
| D-001 | pnpm workspaces monorepo: `apps/web`, `apps/api`, `packages/shared`, `packages/config` | Spec §6 / Part B Step 1 | Accepted |
| D-002 | Pin known-stable majors: TypeScript 5.9, Prisma 6.19, Vite 7, Vitest 3, ESLint 9, React Router 7 | Newer majors (TS 7, Prisma 7/8, Vite 8, Vitest 5) changed toolchains/config; lower risk for an MVP. Revisit after MVP. | Accepted |
| D-003 | Express 5, Zod 4, React 19, Tailwind 4 | Current stable; Express 5 forwards async errors natively | Accepted |
| D-004 | Argon2id via `@node-rs/argon2` | Prebuilt binaries (no node-gyp on Windows); default algorithm is Argon2id | Accepted |
| D-005 | DB-backed opaque sessions, token hash only stored, 7-day absolute TTL | Spec §6: revocable server-side sessions | Accepted |
| D-006 | CSRF: HMAC-signed double-submit cookie + Origin allowlist check | Works for anonymous (login/signup) and authenticated mutations without server state | Accepted |
| D-007 | Content lives in version-controlled Markdown, imported to DB | Spec §12: no rich-text editor needed for MVP | Accepted |
| D-008 | No payment provider, no checkout routes. `checkoutEnabled` is hard `false` | Spec §4, §14, Part B rule 7. Needs owner approval + provider eligibility check | **Blocked on owner** |
| D-009 | Password reset delivered via `ConsoleMailer` only (dev) | No email provider chosen; no credentials in repo | **Blocked on owner** (choose email provider) |
| D-010 | Analytics opt-in banner; no IP/UA stored; anonymous id in sessionStorage | Privacy minimization (spec §6, §13) | Accepted |
| D-011 | Self-hosted fonts (`@fontsource`) instead of Google Fonts CDN | Avoids third-party requests leaking visitor IPs | Accepted |
| D-012 | Teaching project `examples/taskflow-lite/*` is standalone (own `package.json`), not a platform workspace member | Students clone it independently; avoids coupling versions | Accepted |
| D-013 | Lesson `isPreview` flag allows anonymous reading of sample lessons | Spec §5 step 4 | Accepted |
| D-014 | Reference-solution resource unlocks after the learner completes the checkpoints of a configured lesson | Spec §9 "reference implementation accessible after checkpoints" | Accepted |
| D-015 | Legal pages (`/privacy`, `/terms`, `/refund-policy`, `/contact`) are placeholders, visibly marked "draft — owner review required" | Spec Phase 2; no legal identity provided | **Blocked on owner** |
| D-016 | Account deletion = soft delete + anonymize email/name, revoke sessions; purchases retained | Spec §7 | Accepted |
| D-017 | TaskFlow Lite teaching project uses plain JavaScript (ESM), not TypeScript | Target learner knows basic JS; TS adds a second learning curve. Pro projects can introduce TS | Accepted (owner may override) |
| D-018 | Content import keeps admin-chosen statuses; `--sync-status` forces file statuses | Prevents a re-import from silently re-publishing something an admin unpublished | Accepted |
| D-019 | Server-side funnel events for logged-in actions (signup, enroll, checkpoint) are recorded under the privacy policy; anonymous page events need banner consent | Needed to measure the spec §15 north-star without third-party trackers | Accepted, disclosed on `/privacy` draft |
| D-020 | Zod pinned to 4.6.7 (fixes GHSA-mrhx-c7xc-m3w5) | Security advisory | Accepted |
