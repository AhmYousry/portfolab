# Portfolab — PostHog Analytics Audit V2 (after Remediation Phase 2)

**Date:** 2026-11-17
**Baseline:** `cc6fc8e` (H-1 to H-4 already fixed; see `PORTFOLAB_ANALYTICS_AUDIT.md` §0)
**State audited:** working tree on top of `cc6fc8e`, **not committed**
**Scope:** all MEDIUM (M-1 to M-11) and LOW (L-1 to L-9) findings from V1.

## Evidence levels used in this report

| Level | Meaning |
|---|---|
| **Implemented** | Code exists at the cited file and line |
| **Unit/integration-tested** | Covered by Vitest against a fake PostHog object (web) or a fake sink with a real Postgres (API) |
| **Real-SDK-tested** | Covered by Vitest running the real `posthog-js` 1.438.21 in jsdom, network stubbed |
| **Browser-verified** | Real `posthog-js` in real Chromium (Playwright). Every request to a fake PostHog host is intercepted and decoded, and assertions run on the exact payloads PostHog would receive |
| **Live-verified** | Confirmed received in a real PostHog project. **Nothing in this report is live-verified: no PostHog project, key or dashboard access exists.** |

---

## 1. Executive summary

All 20 remaining findings were addressed. 18 are fixed in code. Two are partly owner actions: M-11 (PostHog IP and retention settings live in the PostHog project) and the cross-device consent design noted under M-4.

Key changes:

- **Single source and atomic dedupe for once-per-user events.** A new `AnalyticsClaim` table (composite primary key, `INSERT … ON CONFLICT DO NOTHING`, never purged) gates both the PostHog event and the first-party `LeadEvent` for:
  - `project_started` (→ `free_project_started` / `pro_project_started`)
  - `lesson_started`, `lesson_completed`, `checkpoint_completed`
  - `project_completed`
  - `purchase_refunded`

  The migration backfills claims from existing progress, so nothing re-fires after deploy.
- **`lesson_started` comes from the server only.** Anonymous preview readers emit `lesson_previewed` instead, and the browser can no longer post first-party `lesson_started`.
- **Stable `data-analytics-id` on every important control,** with an explicit `button_clicked` event carrying `analytics_id`. There's a typed registry (`ANALYTICS_IDS`), and a test fails if the UI uses an unregistered id or any required ranking id is missing.
- **Explicit events where autocapture is disabled for privacy:**
  - signup and login submits plus `signup_failed` / `login_failed` (error code only)
  - checkout pay
  - onboarding
  - logout
- **New events:** `pro_project_started`, `checkpoint_completed`, `resource_downloaded` (server, authorized only), `purchase_refunded` (server, once, flushed immediately), `onboarding_completed`, `logged_out`, `lesson_previewed`.
- **Prompt tracking.** The 11 real AI-prompt blocks are tagged ```` ```text prompt=F0x ````, and `prompt_copied` carries `prompt_id`. The 2 diagram blocks no longer count as prompts.
- **Privacy:**
  - replay blocked on `/admin*` and `/onboarding`
  - `client_error` text sanitized
  - consent copy corrected (no "anonymous" claim)
  - onboarding form excluded from autocapture
- **Consent sync:** retry with backoff, plus reconciliation whenever the user loads and the local decision differs from the server flag. This also covers the legacy `'granted'` value.
- **Two issues found by the new real-browser E2E and fixed:**
  - Logging out from a protected page landed on `/login?next=…` instead of home.
  - `pro_page_viewed` was lost when consent was granted on the pricing page itself. Page-scoped view events are now held in memory, never sent, until a decision, and replayed only if consent is granted on that page.
- **Test-harness finding:** `posthog-js` drops every event when `navigator.webdriver === true` or the UA is `HeadlessChrome` (bot filter). Real users are unaffected; the E2E overrides both for its own page only.

**Readiness score: 82 / 100** (was 52; §11).

---

## 2. Finding-by-finding status

| ID | Finding (V1) | Status | Fix (source) | Evidence |
|---|---|---|---|---|
| M-1 | `lesson_started` fired for anonymous previews and re-fired | **Fixed** | Server-only, once per user and lesson: `apps/api/src/services/progress.ts:60-64`. Anonymous → `lesson_previewed`: `apps/web/src/pages/LessonPage.tsx:156-159` | API: `analytics-phase2.test.ts` "lesson_started comes only from the server…". Browser: `e2e/analytics.spec.ts` test 1 asserts `lesson_previewed` and **no** `lesson_started` |
| M-2 | `lesson_completed` re-fired on re-check | **Fixed** | `claimOnce('lesson_completed')`: `progress.ts:65-68` | API: "lesson_completed does not re-fire after un-checking and re-checking" (3 cycles) |
| M-3 | First-party `lesson_started` written twice | **Fixed** | Client post removed; `lesson_started` removed from `CLIENT_ANALYTICS_EVENTS` (`packages/shared/src/analytics.ts:20`); server write inside the claim (`progress.ts:61`) | API: first-party count = 1; browser post of `lesson_started` → 400 |
| M-4 | Consent sync gaps | **Fixed** (design note) | Retry with backoff `apps/web/src/lib/auth.ts:22`; mismatch reconciliation `auth.ts:38-56`, mounted in `components/Layout.tsx:51` | Web unit: `consentNeedsSync` cases. Design note: consent stays per device; the server flag mirrors the most recent decision (last write wins across devices, by design) |
| M-5 | No `purchase_refunded` | **Fixed** | `apps/api/src/services/payments.ts:171-190`, called at `:218`; once via claim; `$set plan` recomputed; flushed | API: `payments.test.ts` "purchase_refunded fires once…" (3 refund-state callbacks → 1 event) |
| M-6 | `prompt_copied` misclassified; no `prompt_id` | **Fixed** | Fence meta parsed `apps/web/src/components/Markdown.tsx` (`promptIdFromMeta`); event `LessonPage.tsx:281-290`; 11 prompts tagged in `content/projects/taskflow-lite/**` (diagram blocks at `01-define/02-architecture.md:34`, `04-ui/07-components.md:27` untagged) | Web unit: `Markdown.test.tsx` "copy on a prompt block reports its id; a plain text block has none" |
| M-7 | Buttons not rankable | **Fixed** | Registry `packages/shared/src/analytics.ts:54`; `Button`/`ButtonLink`/`TrackedLink` `apps/web/src/components/ui.tsx`; `trackClick` `apps/web/src/lib/analytics.ts:346` | Web unit: registry coverage and required-id tests. Browser: `button_clicked` for `hero-preview-lesson`, `login-submit`, `signup-submit`, `nav-logout` |
| M-8 | Replay not blocked on `/admin*` | **Fixed** | `REPLAY_BLOCKED_PATHS` adds `/admin`, `/onboarding`: `analytics.ts:40` | Web unit: "replay is blocked on admin and onboarding routes". Replay itself is never exercised (disabled in every environment) |
| M-9 | Autocapture config never run against real SDK | **Fixed** | Allowlists include `[data-analytics-id]` and checkbox inputs: `analytics.ts:154` | **Browser-verified**: `$autocapture` payload contains `hero-preview-lesson`. jsdom can't verify this (the SDK waits for remote config), so the vacuous jsdom tests were removed |
| M-10 | Privacy E2E vacuous; no real-SDK test | **Fixed** | `e2e/analytics.spec.ts` + `analytics` project in `playwright.config.ts` (fake host, decoded payloads) | **Browser-verified**: no request before consent; no email, password, name, card last-4, brand, amount, transaction id or hmac in **any** decoded payload |
| M-11 | IP and retention not configured; "anonymous" claim | **Partly fixed** | Copy corrected `components/ConsentBanner.tsx`, `pages/Account.tsx` | IP discard and PostHog retention are **owner actions** in PostHog project settings (`docs/analytics/posthog-setup.md` §1) |
| L-1 | Non-atomic dedupe | **Fixed** | `apps/api/src/services/analytics-claims.ts` (`createMany … skipDuplicates`); race-safe enrollment upsert `progress.ts` | API: 6 parallel enroll requests → 1 event; 5 parallel final-checkpoint requests → 1 `project_completed` |
| L-2 | Dedupe deleted by retention purge | **Fixed** | Claims live in `AnalyticsClaim`, never purged | API: "purging first-party events does not let project_completed fire again" |
| L-3 | `client_error` unsanitized | **Fixed** | `sanitizeErrorText` `packages/shared/src/analytics.ts:245`; used at `analytics.ts:358` | Web unit: token, email and long id removed |
| L-4 | `pro_page_viewed` on closed checkout or for Pro owners | **Fixed** | `apps/web/src/pages/Checkout.tsx:34-40` (`canBuy` gate) | Code-level; not separately tested |
| L-5 | Stale person `plan` | **Fixed** | Re-identify when plan changes (`identityKey`, `analytics.ts:218`); server `$set plan` on purchase and refund (`payments.ts:150-190`) | Web unit: "re-identifies when the plan changes". API: `set: { plan: 'pro' }` / `{ plan: 'free' }` |
| L-6 | Two taxonomies | **Documented** | First-party names kept for DB/admin compatibility; mapping in `docs/analytics/posthog-setup.md` §4; double writes removed | — |
| L-7 | Missing events | **Fixed** | `signup_failed`, `login_failed` (`pages/AuthPages.tsx:52, :131, :150`), `logged_out` (`lib/auth.ts:71`), `onboarding_completed` (`pages/Onboarding.tsx:47, :94`), `resource_downloaded` (`apps/api/src/routes/resources.ts:83`), `checkpoint_completed` (`progress.ts:86`), `pro_project_started` (`progress.ts:34`) | API + browser tests (§8) |
| L-8 | Server events lost before flush | **Mitigated** | Revenue events flushed immediately (`product-analytics.ts:80`); others still batched (20 events / 10 s) | API: flush counter asserted for purchase and refund |
| L-9 | Purge not scheduled | **Fixed** | `scheduleRetention()` (`apps/api/src/services/retention.ts:16`) started in `apps/api/src/server.ts:11` (1 min after boot, then daily) | Purge logic covered by the L-2 test; the timer itself isn't tested |

---

## 3. PostHog configuration (changes since V1)

- **Autocapture** (`apps/web/src/lib/analytics.ts:151-163`):
  - `element_allowlist: a, button, form, select, label, input`
  - `css_selector_allowlist: [data-analytics-id], a, button, form, select, label, input[type="checkbox"]`
- **Replay** blocked paths: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/checkout*`, **`/onboarding`, `/admin*`** (`:40`).
- **Identify:** `identify(user.id, { role, plan }, { initial_utm_source, initial_utm_medium, initial_utm_campaign, initial_utm_content })`; re-sent when the plan changes (`:218-235`).
- **Page-scoped pre-consent buffer:** `pro_page_viewed` and `lesson_previewed` (`:31`) are held in memory, max 5, never transmitted while consent is undecided. They're sent only if consent is granted on the same page, and discarded on decline or navigation.
- **Server sink:** `captureForUser(…, { setPersonProperties, flush })` (`apps/api/src/services/product-analytics.ts:61-90`); `$set` passes the same allowlist.
- **Unchanged:** consent-gated lazy SDK load, `person_profiles: 'identified_only'`, `localStorage` persistence, `respect_dnt`, `before_send` URL scrubbing, `/checkout/status` query allowlist.

---

## 4. Complete events inventory

| Event | Side | Trigger | Source | Properties | Repeats | Dedup | Tested | Browser-verified |
|---|---|---|---|---|---|---|---|---|
| `$pageview` | web | route change; current page once on consent grant | `analytics.ts:236-243, :246-257` | `path`, `$current_url` (scrubbed), super props | per nav | same-path guard | unit, real-SDK | ✅ (landing with UTM, logout identity switch, scrubbed `/checkout/status`) |
| `$autocapture` | web SDK | allowlisted clicks | config `analytics.ts:150` | SDK default incl. `attr__data-analytics-id` | yes | — | — | ✅ (`hero-preview-lesson`) |
| `button_clicked` | web | tracked controls | `analytics.ts:346`; call sites in §5 | `analytics_id`, `path`, opt. `project_id` / `lesson_id` / `resource_id` | yes | — | unit | ✅ |
| `signup_completed` | web | signup success | `lib/auth.ts:65` | `source` | per signup | — | — | ✅ |
| `signup_failed` | web | API error / client validation | `pages/AuthPages.tsx:131, :150` | `reason` (code) | yes | — | — | — |
| `login_completed` | web | login success | `lib/auth.ts:66` | `source` | per login | — | — | — |
| `login_failed` | web | login error | `AuthPages.tsx:52` | `reason` (code) | yes | — | — | ✅ (`UNAUTHORIZED`) |
| `logged_out` | web | logout | `lib/auth.ts:71` | `source` | yes | — | — | ✅ (identified as the user) |
| `onboarding_completed` | web | save / skip | `pages/Onboarding.tsx:47, :94` | `source` | per visit | — | — | ✅ (`skipped`) |
| `free_project_started` / `pro_project_started` | api | first enrollment | `services/progress.ts:25-35` | `project_id`, `source` | once | claim | API (incl. race) | — |
| `lesson_previewed` | web | anonymous lesson view | `pages/LessonPage.tsx:156-159` | `project_id`, `lesson_id` | per mount | — | unit (buffer) | ✅ |
| `lesson_started` | api | first progress | `progress.ts:60-64` | `project_id`, `lesson_id` | once | claim | API | — |
| `lesson_completed` | api | first completion | `progress.ts:65-68` | `project_id`, `lesson_id` | once | claim | API | — |
| `checkpoint_completed` | api | first checkpoint completion | `progress.ts:73-92` | `project_id`, `lesson_id`, `checkpoint_id` | once | claim | API | — |
| `project_completed` | api | all lessons complete | `progress.ts:112-128` | `project_id`, `plan` | once | claim | API (incl. race, purge) | — |
| `prompt_copied` | web | copy on tagged prompt | `LessonPage.tsx:281-287` | `project_id`, `lesson_id`, `prompt_id`, `feature_name` | yes | — | unit | — |
| `feature_used` | web | untagged copy / spoiler | `LessonPage.tsx:274-289` | `feature_name`, `source` | yes | — | — | — |
| `resource_downloaded` | api | authorized download | `routes/resources.ts:80-89` | `resource_id`, `project_id`, `plan` | yes | — | API | — |
| `pro_page_viewed` | web | pricing, open checkout, Pro project | `Pricing.tsx:26`, `Checkout.tsx:34-40`, `ProjectPage.tsx:30-33` | `source` | per view | pre-consent buffer | unit | ✅ |
| `checkout_started` | api | intention created | `services/payments.ts:91` | `plan`, `source`, `amount_egp` | per attempt | — | API | — |
| `checkout_failed` | api + web | intention error / decline / client error ≠ 502 | `payments.ts:104, :274`; `Checkout.tsx:55` | `plan`, `source`, `reason` | yes | split by status | API | — |
| `purchase_completed` | api | verified payment | `payments.ts:150-169` | `plan`, `amount_egp`, `currency`, `provider`, `purchase_id`; `$set plan` | once | `analyticsCapturedAt` | API | — |
| `purchase_refunded` | api | refund / void | `payments.ts:171-190` | same; `$set plan` | once | claim | API | — |
| `client_error` | web | `window.onerror` / rejection | `analytics.ts:358-363` | `reason` (sanitized), `feature_name` | yes | — | unit | — |
| identify / reset | web | auth, consent, plan change, logout | `analytics.ts:218-235`, `lib/auth.ts` | `$set role, plan`; `$set_once initial_utm_*` | — | identity key | unit, real-SDK | ✅ (`$identify` distinct id = user id; anonymous after logout) |

---

## 5. Button tracking: can we reliably rank them?

**Yes**, for every control in the requirement, using Trends → `button_clicked` broken down by `analytics_id`. Each id is typed, registered, and enforced by a test.

| Requirement | `analytics_id` | Where | How tracked |
|---|---|---|---|
| Landing CTAs | `hero-free-cta`, `hero-preview-lesson`, `landing-curriculum-link` | `pages/Landing.tsx` | `ButtonLink analyticsId` |
| Signup / login submissions | `signup-submit`, `login-submit` | `AuthPages.tsx:59, :141` | in `onSubmit` (Enter key included); forms stay `ph-no-capture` |
| Pricing CTAs | `pricing-free-cta`, `pricing-pro-cta` | `pages/Pricing.tsx` | `ButtonLink analyticsId` |
| Project start | `project-start`, `project-signup-cta`, `project-card`, `project-lesson-link` | `pages/ProjectPage.tsx`, `components/ProjectCard.tsx` | `Button` / `TrackedLink` |
| Dashboard continue | `dashboard-continue`, `dashboard-start-taskflow`, `progress-lesson-link` | `pages/StudentPages.tsx` | `ButtonLink` / `TrackedLink` with lesson context |
| Lesson navigation | `lesson-prev`, `lesson-next`, `lesson-breadcrumb-project`, `lesson-locked-signup`, `lesson-locked-login`, `lesson-pro-pricing` | `pages/LessonPage.tsx` | `TrackedLink` / `ButtonLink` |
| Prompt copy | `code-copy` + `prompt_copied.prompt_id` | `LessonPage.tsx:281-287` | callback from `Markdown` |
| Resource downloads | `resource-download` (client, with `resource_id`) + `resource_downloaded` (server) | `StudentPages.tsx:192`; `routes/resources.ts:83` | click + authoritative server event |
| Checkout button | `checkout-pay` | `Checkout.tsx:92` | in `onSubmit`; form stays `ph-no-capture` |
| Navigation and footer | `nav-*`, `footer-*` | `components/Layout.tsx` | `tracked()` helper |

Caveat: a click on a tracked element produces both `button_clicked` and `$autocapture`. Rank only on `button_clicked`.

---

## 6. Funnel coverage (re-evaluated)

| Funnel | Steps (events) | Identity | Double counting | Reliable? |
|---|---|---|---|---|
| A Acquisition | `$pageview` path `/` → `signup_completed` → `free_project_started` | anonymous → `identify(user.id)` merges (browser-verified); server uses the same id | none; once-claims on the server step | **Yes**, among consenting visitors |
| B Learning | `free_project_started` / `pro_project_started` → `lesson_started` → `lesson_completed` → `project_completed` | all server-side under `user.id` | none; each step once per user + subject | **Yes**, among consenting users |
| C Monetization | `pro_page_viewed` → `checkout_started` → `purchase_completed` (− `purchase_refunded`) | web identified via H-1 fix; server `user.id` | `checkout_started` counts attempts (use unique users); purchase and refund once | **Yes structurally**; no data until checkout opens |

Structural caveat for every funnel: only users who consented are measured. Server events also require `User.analyticsConsent`, now kept in sync (M-4).

---

## 7. Session replay and privacy

| Check | Status | Evidence |
|---|---|---|
| No traffic before consent | ✅ | Browser: zero requests to the PostHog host before the choice (`e2e/analytics.spec.ts` test 1) |
| No PII or payment data in payloads | ✅ | Browser: decoded bodies contain no email, password, display name, card last-4, card brand, `amount_cents`, transaction id or `hmac` (test 2) |
| Revocation stops capture | ✅ | Browser: no event *captured* after revoke (judged by SDK timestamp; earlier events may still arrive in the next batch) (test 3). Real-SDK: SDK opted out after revoke |
| Replay masking and blocking | Config-level only | Replay is disabled everywhere; masking has **never** been exercised against a real recording |
| Admin / onboarding replay | ✅ blocked (config + unit test) | — |
| Error text | ✅ sanitized | unit |
| Pre-consent memory buffer | Design note for privacy review | Two view events are held in memory (never transmitted or persisted) until a decision |
| IP address, PostHog retention | ⚠️ **Owner action** | PostHog project settings |

---

## 8. Testing and verification status

| Suite | Count | Result | What it proves |
|---|---|---|---|
| Shared (`packages/shared`) | 7 | ✅ | sanitizer, scrubber, schemas |
| Web unit (`analytics.test.ts`, `analytics.phase2.test.tsx`, `Markdown.test.tsx`) | 50 | ✅ | wrapper logic, ids, buffering, identity, prompt ids (fake SDK) |
| Web real-SDK (`analytics.real-sdk.test.ts`) | 8 | ✅ | consent and identity with the real `posthog-js` (jsdom) |
| API integration (10 files) | 110 | ✅ | server emission rules, atomic dedupe, races, refunds, flush, backfill (fake sink, real Postgres) |
| E2E smoke (desktop + mobile) | 10 | ✅ | app behavior unchanged |
| **E2E analytics (real browser, intercepted PostHog)** | 3 | ✅ | §7 rows marked browser-verified |
| Build (api + web), lint, typecheck, format | — | ✅ | — |
| **Live in PostHog** | — | ❌ **not done** | no project or key |
| **posthog-node network delivery** | — | ❌ not tested | API tests use a fake sink |

Web total 58 (50 + 8). E2E total 13.

---

## 9. Remaining risks and open items

| Severity | Item |
|---|---|
| MEDIUM | Nothing is live-verified in PostHog; `posthog-node` delivery and batching are untested against a real endpoint |
| MEDIUM | Session replay masking is untested (replay disabled); test it before enabling `VITE_POSTHOG_REPLAY_ENABLED` |
| MEDIUM | PostHog project settings (discard IP, retention, authorized domains) are owner actions |
| LOW | Consent is per device; the server flag is last-write-wins across devices (by design, documented) |
| LOW | `button_clicked` and `$autocapture` both fire for tagged elements (volume; dashboards must use `button_clicked`) |
| LOW | `lesson_previewed` and `pro_page_viewed` fire per view, with no per-user dedupe (intended view semantics) |
| LOW | The legacy first-party taxonomy remains for DB and admin compatibility (L-6) |
| LOW | The analytics E2E needs `http://localhost:5175` in the API's `CORS_ORIGINS` (set in local `.env` and CI) |

---

## 10. Files changed in Phase 2

**API:**
- `prisma/schema.prisma`; new migration `prisma/migrations/20261117065003_analytics_claims/` (table + backfill)
- new `src/services/analytics-claims.ts`, new `src/services/retention.ts`
- `src/services/progress.ts`, `src/services/payments.ts`, `src/services/product-analytics.ts`
- `src/routes/resources.ts`, `src/routes/student.ts`, `src/server.ts`, `src/scripts/purge-analytics.ts`
- tests: new `test/analytics-phase2.test.ts`; `test/payments.test.ts`, `test/helpers.ts`

**Web:**
- `src/lib/analytics.ts`, `src/lib/auth.ts`
- `src/components/ui.tsx`, `Layout.tsx`, `Markdown.tsx`, `ConsentBanner.tsx`, `ProjectCard.tsx`
- pages: `Landing`, `Pricing`, `ProjectPage`, `LessonPage`, `StudentPages`, `AuthPages`, `Onboarding`, `Checkout`, `Account`
- tests: new `src/lib/analytics.phase2.test.tsx`; `analytics.test.ts`, `analytics.real-sdk.test.ts`, `components/Markdown.test.tsx`

**Shared:** `packages/shared/src/analytics.ts`, `types.ts`

**Content:** 11 lesson files (prompt tags)

**E2E and CI:** new `e2e/analytics.spec.ts`; `playwright.config.ts`; `.github/workflows/ci.yml` (CORS for the analytics E2E origin)

**Docs:** `docs/analytics/posthog-setup.md` (event catalog, ids, dashboards)

**Local only, not in git:** `apps/api/.env` (`CORS_ORIGINS` adds 5175). The dev database got the additive migration and a content re-import.

---

## 11. Readiness score: **82 / 100** (V1: 52)

| Area | Weight | V1 | V2 | Notes |
|---|---|---|---|---|
| Architecture and typing | 15 | 13 | 14 | id registry, claim service, typed sink options |
| Event coverage for funnels A–C | 20 | 12 | 18 | all steps, Pro start, refunds, failures, onboarding, downloads |
| Data correctness (dedupe, identity) | 20 | 8 | 17 | atomic claims, single sources, plan refresh; attempts vs users still a dashboard choice |
| Privacy and consent | 20 | 10 | 17 | browser-verified no-PII, revoke, consent sync; IP and retention pending; replay untested |
| Paymob purchase integrity | 10 | 8 | 9 | refund tracked and flushed; never run against real Paymob |
| Verification evidence | 15 | 1 | 7 | real SDK + real browser payloads; **no live PostHog confirmation** |

**To reach 90+:** add the PostHog key in a staging environment, run the checklist in `docs/analytics/posthog-setup.md` §6, verify one server event end to end, and test replay masking before enabling it.
