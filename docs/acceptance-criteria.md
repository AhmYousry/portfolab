# Acceptance Criteria

Derived from spec §17–§18. Each line maps to an automated test where marked `[T]` (file in parentheses) or manual check `[M]`.

## Public
- [T] Anonymous visitor lists projects, sees curriculum and pricing (`apps/api/test/public.test.ts`).
- [T] Curriculum endpoint never returns lesson bodies (`public.test.ts`).
- [T] Coming-soon / draft projects expose no lesson bodies (`public.test.ts`, `access.test.ts`).
- [T] `GET /api/health` returns JSON (`public.test.ts`).
- [T] Preview lesson readable anonymously; non-preview free lesson returns 401 (`access.test.ts`).

## Auth
- [T] Signup creates Argon2id hash, sets HttpOnly session cookie (`auth.test.ts`).
- [T] Duplicate email → 409 without leaking which field; invalid input → 400 (`auth.test.ts`).
- [T] Wrong password → 401 generic message (`auth.test.ts`).
- [T] Logout revokes session; old cookie no longer authenticates (`auth.test.ts`).
- [T] Expired session is rejected (`auth.test.ts`).
- [T] Password reset: token single-use, expires, revokes all sessions (`auth.test.ts`).
- [T] Mutations without CSRF token → 403 (`auth.test.ts`).
- [T] Login rate limit returns 429 (`ratelimit.test.ts`).

## Free learning
- [T] Student enrolls, opens lesson, completes checkpoint, progress persists across logout/login (`progress.test.ts`).
- [T] Authorized resource download works; locked reference solution returns 403 until checkpoints complete (`resources.test.ts`).
- [T][M] Full flow in browser (`e2e/smoke.spec.ts`).

## Permissions
- [T] Free user gets 403 on Pro lesson; entitled user gets 200 (`access.test.ts`).
- [T] Free user cannot download Pro resource by id (`resources.test.ts`).
- [T] Student → 403 on every `/api/admin/*` route; anonymous → 401 (`admin.test.ts`).
- [T] Draft lessons visible only via admin preview (`admin.test.ts`).
- [T] Publish/unpublish writes an AuditLog row (`admin.test.ts`).

## Privacy
- [T] No response ever contains `passwordHash` or token hashes (`auth.test.ts`).
- [T] Data export returns user's own data only; deletion anonymizes and revokes sessions (`account.test.ts`).
- [T] Analytics rejects non-allowlisted events (`analytics.test.ts`).

## Learning project (TaskFlow Lite reference)
- [T] API CRUD, validation 400, not-found 404 tests pass (`examples/taskflow-lite/reference/server/test`).
- [M] Clean install per its README works.

## Accessibility / RTL
- [M] `dir="rtl"` on `<html>`, code blocks LTR, visible focus rings, labelled inputs, 360px viewport without horizontal scroll.

## Payments
- Not applicable until D-008 is resolved. Checkout UI is disabled and labelled.
