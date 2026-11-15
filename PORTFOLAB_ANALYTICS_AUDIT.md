# Portfolab — PostHog Analytics Audit

**Audit date:** 2026-11-15
**Commit audited:** `374e565` (clean working tree)
**Scope:** web (`apps/web`), API (`apps/api`), shared (`packages/shared`), tests, E2E. Audit only. No application code was changed.
**Auditor's evidence rule:** every claim cites source lines. Statements marked *(unverified)* are inferences that need a runtime check.

---

## 0. Remediation update (H-1 to H-4), 2026-11-15

The four HIGH findings are fixed in the working tree (not yet committed). The fixes were verified by new tests, including tests that run the **real** `posthog-js` 1.438.21 SDK in jsdom with the network stubbed. Against the pre-fix code, 5 of those 8 real-SDK tests fail; against the fix, all pass.

**Correction to the original H-2 diagnosis.** A probe of the real SDK showed that `reset()` *clears* a prior `opt_out_capturing()`. The original revoke order (opt-out, then reset) therefore left the SDK **opted in** after the user revoked consent. The wrapper stopped its own calls, but SDK-level autocapture and `$pageleave` would have continued. Re-granting happened to work only because of that side effect. The real defect was worse than reported: **revoking consent did not stop SDK-level tracking**.

| ID | Fix | Code | Tests |
|---|---|---|---|
| H-1 | `identify()` now stores the current user and marks it identified only after the SDK call actually runs; on consent grant the current user is re-identified | `apps/web/src/lib/analytics.ts` (`sendIdentify`, `onConsentGranted`, `analytics.identify`) | `analytics.test.ts` "H-1: …" (2); `analytics.real-sdk.test.ts` "H-1: …" (2, real SDK: `get_distinct_id()` equals the user id) |
| H-2 | One SDK instance for the page lifetime. Revoke = stop replay, `reset()`, **then** `opt_out_capturing()`. Grant = `opt_in_capturing({ captureEventName: false })` on the existing instance. At init, a persisted opt-out is cleared when consent is granted. Logout while revoked re-asserts the opt-out | `analytics.ts` (`applyConsent`, `ensureClient`, `analytics.reset`) | `analytics.test.ts` (order, re-grant, persisted opt-out, logout); `analytics.real-sdk.test.ts` (real SDK: `has_opted_out_capturing()` true after revoke, direct `capture()` blocked, re-grant and persisted opt-out recovery) |
| H-3 | `ROUTE_QUERY_ALLOWLIST`: on `/checkout/status` only `purchase` survives in any scrubbed URL (`path`, `$current_url`, `$referrer`, initial URLs via `before_send`). The status page also replaces the address bar with `?purchase=<id>` | `packages/shared/src/analytics.ts` (`ROUTE_QUERY_ALLOWLIST`, `scrubUrl`); `apps/web/src/pages/Checkout.tsx` (`CheckoutStatus` effect) | `schemas.test.ts` (Paymob redirect sample); `analytics.real-sdk.test.ts` (real SDK event contains no PAN, brand, amount, transaction id or hmac); E2E `smoke.spec.ts` (address bar cleaned) |
| H-4 | The last route is remembered while consent is absent; on grant, exactly one `$pageview` is sent for it (deduped against the routing effect by scrubbed path). Replay state is also synced to the current path right after init | `analytics.ts` (`lastRoute`, `pageviewSentFor`, `sendPageview`, `onConsentGranted`, `syncReplay`) | `analytics.test.ts` "H-4: …" (2); `analytics.real-sdk.test.ts` (one `$pageview` after consent) |

Test totals after remediation: shared 7, web 38 (30 unit + 8 real-SDK), API 98, E2E 10. Lint, typecheck, format and web build are clean.

**Still true after remediation:** nothing has been confirmed in a real PostHog project (no key or credentials). All MEDIUM and LOW findings below remain open. The readiness score in §11 is the pre-remediation score. With H-1 to H-4 fixed and real-SDK tests added, the "Data correctness", "Privacy and consent" and "Verification evidence" rows would rise. Re-score after a real PostHog verification run.

---

## 1. Executive summary

PostHog is integrated on both the web and the API through two central, typed wrappers. The design is privacy-first: the SDK loads only after consent, properties pass an allowlist, secrets are scrubbed from URLs, and purchase events come only from the backend after verification.

**The integration has never run against a real PostHog project.** No PostHog key is set anywhere locally (`apps/web/.env.local` does not exist; `apps/api/.env` has no `POSTHOG_*` lines). Every test uses a fake PostHog object. The E2E test "no PostHog requests before consent" passes trivially because the SDK cannot load without a key.

The audit found **4 HIGH** and several MEDIUM issues that would corrupt funnels or leak payment metadata once keys are added:

1. **HIGH:** a logged-in user who grants consent *after* page load is never identified, so client events stay anonymous while server events use the user ID. This breaks Funnels B and C.
2. **HIGH:** revoking and then re-granting consent leaves PostHog opted out. The fix path calls `init()` again, which the SDK treats as a no-op, and the opt-out state is persisted.
3. **HIGH:** Paymob's redirect back to `/checkout/status` appends transaction query parameters (card last-4, card brand, amounts). They are sent to PostHog in `$pageview` URLs, because the scrubber redacts only 6 parameter names.
4. **HIGH:** the landing-page `$pageview` is lost for every first-time visitor. The SDK isn't loaded until consent, and no pageview is replayed after consent. Funnel A's first step is undercounted.

**Final readiness score: 52 / 100** (§11).

---

## 2. PostHog configuration

### 2.1 SDKs

| Package | Version | Where |
|---|---|---|
| `posthog-js` | `1.438.21` (exact pin) | `apps/web/package.json:19` |
| `posthog-node` | `5.57.2` (exact pin) | `apps/api/package.json:33` |

### 2.2 Environment variables (names only)

| Variable | Side | Defined at | Locally set? |
|---|---|---|---|
| `VITE_POSTHOG_KEY` | web (public, build time) | `apps/web/src/vite-env.d.ts:4`, `apps/web/.env.example:3` | **No** |
| `VITE_POSTHOG_HOST` (default `https://eu.i.posthog.com`) | web | `apps/web/src/lib/analytics.ts:44-45` | No (default used) |
| `VITE_POSTHOG_REPLAY_ENABLED` | web | `apps/web/src/lib/analytics.ts:46` | **No** (replay off) |
| `POSTHOG_API_KEY` | api | `apps/api/src/env.ts:34` | **No** |
| `POSTHOG_HOST` (default EU) | api | `apps/api/src/env.ts:35` | No |
| `ANALYTICS_RETENTION_DAYS` (first-party only, default 395) | api | `apps/api/src/env.ts:36` | No (default) |

### 2.3 Web initialization (`apps/web/src/lib/analytics.ts`)

| Setting | Value | Line |
|---|---|---|
| Loading | dynamic `import('posthog-js')` only when key present AND consent granted | 49, 157-174 |
| Init call | `ph.init(POSTHOG_KEY, posthogConfig(consent))` then `register(superProperties())` | 163-164 |
| `person_profiles` | `'identified_only'` | 129 |
| `persistence` | `'localStorage'` (no cookies) | 130 |
| `capture_pageview` | `false` (manual SPA pageviews) | 131 |
| `capture_pageleave` | `true` | 132 |
| `respect_dnt` | `true` | 133 |
| `autocapture` | `dom_event_allowlist: click, submit, change`; `element_allowlist: a, button, form, select, label`; `css_selector_allowlist: [data-attr], a, button, form` | 134-138 |
| `mask_all_text` / `mask_all_element_attributes` | `false` / `false` | 139-140 |
| `disable_session_recording` | `!(REPLAY_ALLOWED && consent.replay)` | 141 |
| `session_recording` | `maskAllInputs: true`, `maskTextSelector: '.ph-mask, [data-ph-mask], pre, code'`, `blockSelector: '.ph-no-capture'` | 142-146 |
| `before_send` | scrubs `$current_url`, `$referrer`, `$initial_current_url`, `$initial_referrer`, `$pathname` in `properties`, `$set`, `$set_once` | 27-33, 119-124, 147-153 |
| Pre-load queue | up to 50 calls queued until SDK loads | 25, 176-181 |
| Error capture | `window.onerror` / `unhandledrejection` → `client_error` | 214-217, 268-273 |
| Super properties | `app`, `device_type`, `campaign`, `utm_source/medium/campaign/content` | 106-117 |

### 2.4 API initialization (`apps/api/src/services/product-analytics.ts`)

- `new PostHog(apiKey, { host, flushAt: 20, flushInterval: 10_000 })`: line 19. Every event gets `app: 'api'` (line 27).
- No-op sink when `POSTHOG_API_KEY` is unset (lines 35-42).
- `captureForUser()` loads `User.analyticsConsent` and `deletedAt` before every send. It sends nothing unless consent is true and the user isn't deleted, then sanitizes the properties (lines 52-68).
- Flush on shutdown: `apps/api/src/server.ts:12` (`shutdownAnalytics()` on SIGINT/SIGTERM).

### 2.5 Sanitization (`packages/shared/src/analytics.ts`)

- `ALLOWED_PROPERTY_KEYS` allowlist: line 81. Any key not listed is dropped.
- `EMAIL_LIKE` values are dropped: line 105.
- `SECRET_QUERY_PARAMS = token, hmac, clientSecret, client_secret, secret, code`: line 106.
- `sanitizeProperties()`: line 110. `scrubUrl()`: line 126.

### 2.6 Parallel first-party analytics (not PostHog)

There is a second, older pipeline that writes `LeadEvent` rows (`apps/api/src/services/analytics.ts`, ingested at `POST /api/analytics/events`, `apps/api/src/routes/public.ts:52`). It uses different event names (`signup_complete`, `lesson_started`, `landing_view`, …; `packages/shared/src/analytics.ts:3`, `:19`). It feeds the admin funnel table. It is listed here because it overlaps with the PostHog events and is double-counted in one place (issue M-3).

---

## 3. Complete events inventory (PostHog)

Typed contract: `ProductEventMap` in `packages/shared/src/analytics.ts:52`. `device_type` is added to every web custom event (`analytics.ts:222`). The web side also attaches the super properties; the API side attaches `app: 'api'`.

| # | Event | Purpose | Trigger | Side | Source | Properties (type) | Can repeat? | Dedup | Tested? |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `$pageview` | Traffic, navigation | Every SPA route or query change, only after consent | Web | `apps/web/src/lib/analytics.ts:226-232`, called at `:307` | `$current_url` (string, scrubbed), `path` (string, scrubbed) + super props | Yes | Same `pathname+search` is skipped (`:304-306`) | Unit test, fake SDK: `analytics.test.ts:131-137` |
| 2 | `$autocapture` | Clicks, submits, changes | SDK autocapture on allowlisted elements | Web | config `analytics.ts:134-138` | SDK default (`$el_text`, element chain, `attr__data-attr`) | Yes | None | **No** (config shape only, real SDK never exercised) |
| 3 | `$pageleave` | Time on page | SDK | Web | `analytics.ts:132` | SDK default | Yes | None | No |
| 4 | `signup_completed` | Acquisition conversion | Signup API returned success | Web | `apps/web/src/lib/auth.ts:32` (called from `pages/AuthPages.tsx` signup `onSuccess`) | `source` (string: `signup_page` \| `signup_with_next`) | Once per signup | n/a | **No** |
| 5 | `login_completed` | Returning-user activity | Login API returned success | Web | `apps/web/src/lib/auth.ts:33` | `source` (string `login_page`) | Yes, every login | None | **No** |
| 6 | `free_project_started` | Funnel A end / Funnel B start | First `Enrollment` row created for a FREE project | API | `apps/api/src/services/progress.ts:26-31` | `project_id` (slug), `source` (`enrollment`) | Intended once per user and project | Enrollment existence check (`:12-15`); **not race-safe** (find, then upsert) | Yes: `payments.test.ts:466` (fake sink) |
| 7 | `lesson_started` | Learning engagement | Lesson page loaded and `progressStatus === null` (also for anonymous preview views) | Web | `apps/web/src/pages/LessonPage.tsx:143-145` | `project_id` (slug from URL), `lesson_id` (slug from URL) | Yes (see M-1) | `useRef` per mount only (`:137, :141-142`) | **No** |
| 8 | `lesson_completed` | Learning progress | Lesson progress changes from non-COMPLETED to COMPLETED | API | `apps/api/src/services/progress.ts:53-64` | `project_id` (slug), `lesson_id` (slug) | **Yes**: fires again after un-checking and re-checking a checkpoint | Only `before?.status !== 'COMPLETED'` | Partly: `payments.test.ts:465` checks the count for a single pass; repeat firing not tested |
| 9 | `project_completed` | Funnel B end | All published lessons COMPLETED, first time | API | `apps/api/src/services/progress.ts:86-102` | `project_id` (slug), `plan` (`free`\|`pro`) | Once per user and project | `trackOnce` on `LeadEvent` (`:95`); not race-safe; reset if the 395-day purge deletes the row | Yes: `payments.test.ts:467-480` |
| 10 | `prompt_copied` | AI-prompt usage | Copy button on a code block whose language is `text` | Web | `apps/web/src/pages/LessonPage.tsx:251-252` (callback from `components/Markdown.tsx:44`) | `project_id`, `lesson_id`, `feature_name` (`lesson_prompt`); `prompt_id` is **never set** | Yes | None | **No** |
| 11 | `feature_used` | Feature adoption | Code copy (non-`text`) or spoiler reveal | Web | `LessonPage.tsx:246-250` (`spoiler_revealed`), `:254` (`code_copied`); triggers `Markdown.tsx:44, :62` | `feature_name` (string), `source` (lesson slug) | Yes | None | Sanitizer only: `analytics.test.ts:104-112` |
| 12 | `pro_page_viewed` | Funnel C entry | Mount of `/pricing`, `/checkout`, or any PRO project page | Web | `pages/Pricing.tsx:26`, `pages/Checkout.tsx:35`, `pages/ProjectPage.tsx:30-33` | `source` (`pricing` \| `checkout` \| `project:<slug>`) | Yes, every mount | None | Indirectly: used as the sample event in `analytics.test.ts`; page wiring not tested |
| 13 | `checkout_started` | Funnel C step 2 | Paymob intention created successfully | API | `apps/api/src/services/payments.ts:90-94` | `plan` (`pro`), `source` (string from client body), `amount_egp` (number) | Yes, per attempt | None (one per intention) | Yes: `payments.test.ts:255` |
| 14 | `checkout_failed` | Friction | (a) API: intention creation error; (b) API: declined payment webhook; (c) Web: client error other than HTTP 502 | API + Web | API `payments.ts:103`, `payments.ts:245-251`; Web `pages/Checkout.tsx:47-56` | `plan`, `source` (`checkout_page` \| `paymob` \| client-sent), `reason` (`intention_failed` \| `internal_error` \| `declined` \| API error code) | Yes | Web skips 502 so it doesn't duplicate (a) | API: `payments.test.ts:261-269`, `:358`; Web path: **No** |
| 15 | `purchase_completed` | Revenue | Paymob transaction verified (HMAC webhook or authenticated inquiry) and purchase moved to PAID | API only | `apps/api/src/services/payments.ts:149-163`, called at `:231` | `plan` (`pro`), `amount_egp` (number), `currency` (`EGP`), `provider` (`paymob`), `purchase_id` (cuid) | No | **Yes**: atomic `updateMany … analyticsCapturedAt: null` claim (`:150-154`) | Yes: `payments.test.ts:311` (once), `:335` (second tx), `:439` (webhook after reconcile) |
| 16 | `client_error` | Errors and friction | `window.onerror` or `unhandledrejection` | Web | `analytics.ts:214-217`, `:268-273` | `reason` (string ≤200, **not scrubbed**), `feature_name` | Yes | None | **No** |
| — | identify | Identity | Successful signup or login; `/me` returns a user | Web | `auth.ts:31`, `analytics.ts:234-243`, `:311-313` | distinct id = internal user cuid; `$set: role, plan` | Once per page session | `identifiedId` guard | Yes: `analytics.test.ts:116-121` |
| — | reset | Identity | Logout; consent revoked | Web | `auth.ts:38`; `analytics.ts:183-196, :245-252` | — | — | — | Yes: `analytics.test.ts:74-85, :123-129` (fake SDK) |

**Not implemented** (declared nowhere in code): `landing_viewed` (PostHog), `signup_started` / `signup_failed`, `login_failed`, `logout`, `onboarding_completed`, `checkpoint_completed` (PostHog), `resource_downloaded`, `purchase_refunded`, `checkout_abandoned`, a Pro-project start event.

---

## 4. Autocapture and button tracking

| Capability | Status | Evidence |
|---|---|---|
| Page views | Manual `$pageview`, only after consent | `analytics.ts:131, :226-232, :302-309` |
| SPA navigation | Yes, via the `pathname`/`search` effect in `Layout` | `components/Layout.tsx` → `useAnalyticsRouting` (`analytics.ts:295-314`) |
| Button clicks | Autocapture on `button` | `analytics.ts:134-138` |
| Link clicks | Autocapture on `a` | same |
| Form interactions | `submit` and `change` on `form`/`select`. **All auth and checkout forms carry `ph-no-capture`**, so nothing is captured from them | `AuthPages.tsx:58, :146, :231, :290`; `Checkout.tsx:98` |
| Input fields | `input` is not in `element_allowlist`; no input values are captured | `analytics.ts:136` |

### Stable identifiers

**No element in the codebase has a `data-analytics-id` attribute.** The project uses `data-attr` instead (PostHog's toolbar convention). Autocapture records it as `attr__data-attr` because `mask_all_element_attributes: false`.

Elements with `data-attr` (13):

| `data-attr` | Element | Location | Captured by autocapture? |
|---|---|---|---|
| `nav-logo` | header logo link | `components/Layout.tsx:61` | Yes (`a`) |
| `hero-free-cta` | landing CTA | `pages/Landing.tsx:114` | Yes |
| `pricing-free-cta` | pricing Free CTA | `pages/Pricing.tsx:88` | Yes |
| `pricing-pro-cta` | pricing Pro CTA (only rendered when checkout is enabled) | `pages/Pricing.tsx:96` | Yes |
| `project-start` | enroll button | `pages/ProjectPage.tsx:87` | Yes |
| `checkpoint-toggle` | checkpoint `<input type=checkbox>` | `pages/LessonPage.tsx:104` | *(unverified)*: `input` isn't allowlisted; may only be captured via the parent `label` |
| `code-copy` | code copy button | `components/Markdown.tsx:81` | Yes |
| `code-spoiler-toggle` | spoiler reveal | `components/Markdown.tsx:65` | Yes |
| `checkout-pay` | pay button | `pages/Checkout.tsx:135` | **No**: inside the `ph-no-capture` form |
| `checkout-retry` | retry link | `pages/Checkout.tsx:234` | Yes |
| `consent-accept` | banner accept | `components/ConsentBanner.tsx:69` | No, effectively: the SDK isn't loaded when clicked |
| `consent-decline` | banner decline | `components/ConsentBanner.tsx:76` | No: no consent |
| `footer-privacy-settings` | footer button | `components/Layout.tsx:190` | Yes |

Important controls **without** stable IDs:
- Header and mobile nav links, mobile menu toggle, logout button.
- Login and signup submit buttons (inside `ph-no-capture`).
- Dashboard "continue" button, lesson prev/next links.
- Resource download links, onboarding save/skip, account actions, all admin actions.

### Can we reliably rank the most-clicked buttons?

**Partially, and not yet reliably:**
- Tagged elements can be broken down by `attr__data-attr`, but only 13 elements are tagged, and the most important conversion button (`checkout-pay`) is excluded by `ph-no-capture`.
- Untagged elements can only be told apart by `$el_text` (Arabic copy that will change) or CSS selectors.
- The combined effect of `element_allowlist` and `css_selector_allowlist` has never been exercised against the real SDK *(unverified)*.
- Only users who consented are counted.

---

## 5. Conversion funnel coverage

### Funnel A — Landing → Signup → Free project started

| Step | Event | Exists? |
|---|---|---|
| Landing | `$pageview` where `path = /` (no dedicated landing event) | Yes, but **undercounted** (H-4) |
| Signup | `signup_completed` (web) | Yes |
| Free project started | `free_project_started` (API) | Yes |

**Identity:** anonymous ID before signup, then `identify(user.id)` at signup (`auth.ts:31`), which merges the anonymous person. The API uses the same `user.id`, so identity is consistent once identify has been sent.

**Reliability:** low today.
- The first landing `$pageview` is dropped (H-4).
- `free_project_started` needs the server-side consent flag, which is synced asynchronously after signup (`auth.ts:34`). If the sync fails, the step silently disappears (M-4).
- UTM attribution on the first event depends on the URL still holding the UTMs when consent is given.

**Double counting:** none in PostHog. The first-party funnel is separate.

### Funnel B — Project started → Lesson started → Lesson completed → Project completed

| Step | Event | Exists? |
|---|---|---|
| Project started | `free_project_started` (API, FREE only) | Yes for free; **missing for Pro** |
| Lesson started | `lesson_started` (web) | Yes |
| Lesson completed | `lesson_completed` (API) | Yes |
| Project completed | `project_completed` (API) | Yes |

**Identity:** mixed sources (web and API). Consistent only if the browser has identified the user. Broken by H-1 for logged-in users who give consent after the page has loaded.

**Reliability:** medium-low.
- `lesson_started` also fires for anonymous preview views and again after identification (M-1).
- `lesson_completed` re-fires on re-completion (M-2).
- Use "unique users" funnels, not totals.

**Double counting:** `lesson_completed` totals can inflate. Per-lesson completion ratios computed from totals will be wrong.

### Funnel C — Pro page viewed → Checkout started → Purchase completed

| Step | Event | Exists? |
|---|---|---|
| Pro page viewed | `pro_page_viewed` (web, 3 sources) | Yes |
| Checkout started | `checkout_started` (API, after intention created) | Yes |
| Purchase completed | `purchase_completed` (API, verified, deduped) | Yes |

**Identity:** web event on the browser's distinct ID, API events on `user.id`. They match only when the user is identified in the browser (H-1 breaks this).

**Reliability:** structurally good. `purchase_completed` is the most trustworthy event in the system.
- Checkout is currently closed (no Pro project is published; Paymob isn't configured), so the funnel has no data.
- `pro_page_viewed` on `/checkout` fires even when checkout is closed or the user already has Pro (`Checkout.tsx:34-36` runs before those checks).

**Double counting:**
- `checkout_failed` is split between web and API by HTTP status. They don't overlap by design.
- `checkout_started` counts attempts, not users. Use unique users.
- No `purchase_refunded` event, so PostHog revenue never decreases (M-5).

---

## 6. Session replay and privacy

| Check | Result | Evidence |
|---|---|---|
| Replay off by default | **Pass**: needs the build flag AND a separate visitor opt-in | `analytics.ts:141`; banner checkbox `ConsentBanner.tsx` |
| Inputs masked | **Pass** (config): `maskAllInputs: true` | `analytics.ts:143` |
| Code and lesson content masked | **Pass** (config): `pre, code` | `analytics.ts:144` |
| Auth, account and checkout not recorded | **Pass** (config): stop on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/checkout*` | `analytics.ts:34-41, :254-266` |
| Admin pages not recorded | **Fail**: `/admin*` is not blocked; user display names and masked emails are visible in the users table | `analytics.ts:34-41` |
| Names excluded | Partial: header name has `ph-no-capture ph-mask` (`Layout.tsx:81`), dashboard greeting `ph-mask` (`StudentPages.tsx:22`); other places a name appears are not audited exhaustively | — |
| Passwords and tokens not tracked | **Pass**: auth forms `ph-no-capture`; inputs never captured; URL `token` redacted | `AuthPages.tsx:58…`; `analytics.test.ts:131-153` |
| Payment info not tracked | **Fail (H-3)**: Paymob redirect query parameters reach `$pageview` URLs | `payments.ts:83`; scrub list `packages/shared/src/analytics.ts:106` |
| Event properties allowlisted | **Pass** | `sanitizeProperties` `packages/shared/src/analytics.ts:110`; tests `schemas.test.ts`, `analytics.test.ts:104-112` |
| `client_error.reason` scrubbed | **Fail (L)**: raw error messages, truncated only | `analytics.ts:268-273` |
| Consent before any network call | **Pass** (logic) | `analytics.ts:157-160, :176-181`; E2E `e2e/smoke.spec.ts:47-62` (but vacuous without a key) |
| Revoke consent | **Pass**: opt-out, stop replay, reset | `analytics.ts:183-196` |
| Re-grant consent | **Fail (H-2)** | `analytics.ts:157-174, :198-207` + SDK re-init guard |
| Identity reset on logout | **Pass**: `analytics.reset()` after the logout API call | `auth.ts:36-38`; unit test with fake SDK only |
| Server respects consent | **Pass**: per-user DB flag | `product-analytics.ts:57-62`; `payments.test.ts:442-451` |
| IP address | **Not configured**: PostHog stores client IP unless "Discard client IP data" is enabled in project settings (owner action) | `docs/analytics/posthog-setup.md` §1 |
| Retention | PostHog: not configured (no project). First-party: `analytics:purge` script exists but **is not scheduled** | `apps/api/src/scripts/purge-analytics.ts` |

---

## 7. Paymob purchase tracking

| Requirement | Status | Evidence |
|---|---|---|
| Purchase event only from backend | **Pass**: no client code emits `purchase_completed` | grep: only `payments.ts:155` |
| Only after verified confirmation | **Pass**: reached only from `processTransaction` success. Callers: HMAC-verified webhook (`routes/webhooks.ts`) or authenticated transaction inquiry (`reconcilePurchase`) | `payments.ts:165-233` |
| Amount and currency verified before grant/event | **Pass** | `payments.ts:200-207` |
| Duplicate protection (event) | **Pass**: atomic claim on `Purchase.analyticsCapturedAt` | `payments.ts:149-154`; tests `payments.test.ts:311, :335, :439` |
| Duplicate protection (webhook) | **Pass**: `WebhookEvent (provider, providerEventId)` unique key | `routes/webhooks.ts` |
| Consent-gated | Yes: purchases by non-consenting users never reach PostHog. **Revenue in PostHog will understate; the DB is the source of truth.** | `product-analytics.ts:62` |
| Refund tracking | **Missing**: refunds revoke access but emit no analytics event | `payments.ts:173-195` |
| Person `plan` property after purchase | Stale until the next page load: `identify` runs once per page session | `analytics.ts:234-236` |
| Real Paymob traffic | **Never tested**: all Paymob calls are mocked | `payments.test.ts` (`setPaymobFetch`) |

---

## 8. Testing and verification status

| Layer | What exists | What it proves | What it does not prove |
|---|---|---|---|
| **Implemented in source** | All 16 events in §3 | — | — |
| **Unit tests (web)** `apps/web/src/lib/analytics.test.ts` (16 tests) | Consent gating, queueing, revoke, sanitization, identify-once, reset, URL scrub, replay gating, failure safety | Wrapper logic against a **fake** PostHog object | Real SDK behavior: re-init no-op (H-2), autocapture, masking, delivery. Page-level wiring of `lesson_started`, `prompt_copied`, `pro_page_viewed`, `signup_completed`, `login_completed` |
| **Integration tests (API)** `apps/api/test/payments.test.ts` (24 tests) | Server events with a fake sink and real Postgres: `checkout_started`, `checkout_failed`, `purchase_completed` dedupe, consent gating, `free_project_started`, `lesson_completed`, `project_completed` | Correct server emission rules and dedupe | posthog-node delivery and flushing; `lesson_completed` re-firing |
| **Shared tests** `packages/shared/src/schemas.test.ts` | `sanitizeProperties`, `scrubUrl` | Allowlist and scrub rules | Paymob redirect parameters (not in the scrub list) |
| **E2E** `e2e/smoke.spec.ts:43-62` | Banner shows, decline persists, settings reopen, no `posthog` requests | Consent UI works | **Vacuous for "no requests"**: no key is configured, so PostHog could never load |
| **Verified locally at runtime** | App runs with PostHog **disabled** (no key) | Analytics failing safely does not break the app | Any real event emission |
| **Confirmed received in PostHog** | **Nothing.** No PostHog project, key or dashboard access was available to this audit | — | Everything |

---

## 9. Missing events and risks (ranked)

### CRITICAL
None that cause harm today, because PostHog is disabled. **The four HIGH issues become CRITICAL the moment keys are added.**

### HIGH

| ID | Issue | Evidence | Impact |
|---|---|---|---|
| H-1 | **Identify lost when consent is granted after load.** `identify()` sets `identifiedId` *before* `withClient()` drops the call for lack of consent. Later identify calls short-circuit. | `analytics.ts:234-242`, `:176-177`, `:311-313` | Logged-in users who accept the banner mid-session send web events under an anonymous ID while API events use `user.id`. Funnels B and C split across two persons. |
| H-2 | **Consent re-grant does not resume capture.** Revoke calls `opt_out_capturing()` + `reset()` and drops the client. Re-grant calls `ph.init()` again, which the SDK treats as a no-op ("Re-initializing is a no-op", confirmed in the `posthog-js` 1.438.21 bundle). `opt_in_capturing()` is never called on that path, and opt-out is persisted under `__ph_opt_in_out_<token>` (confirmed in the bundle). | `analytics.ts:183-209`, `:157-174` | Users who change their mind are silently never tracked again, at least for that page session. Whether `posthog.reset()` clears the persisted opt-out was **not verified**; if it doesn't, the effect is permanent. |
| H-3 | **Paymob redirect parameters leak into `$pageview`.** `redirection_url = /checkout/status?purchase=…` (`payments.ts:83`). Per Paymob's docs, the redirect appends transaction details as query parameters; the response-callback HMAC field list includes `source_data.pan`, `source_data.sub_type`, `amount_cents`, `id`, `order`. `scrubUrl` only redacts 6 names (`packages/shared/src/analytics.ts:106`), and `/checkout/status` gets a normal `$pageview` (replay is blocked, pageviews are not). | as cited | Masked card last-4, card brand, amount and transaction IDs are stored in PostHog against an identified person. |
| H-4 | **Landing pageview lost for first-time visitors.** The `$pageview` effect runs before consent and is dropped (`withClient` returns at `analytics.ts:177`). After consent, no pageview is emitted for the current page (`useAnalyticsRouting` dedupes by path, `:304-306`). The banner only sends the *first-party* `landing_view` (`ConsentBanner.tsx:37`). | as cited | Funnel A step 1 and acquisition dashboards undercount every new visitor's entry page. |

### MEDIUM

| ID | Issue | Evidence |
|---|---|---|
| M-1 | `lesson_started` fires for every anonymous preview view (anonymous `progressStatus` is always `null`), and again after signup for the same lesson. A failed `IN_PROGRESS` PUT makes it re-fire on the next visit. | `LessonPage.tsx:143-156` |
| M-2 | `lesson_completed` re-fires when a learner un-checks and re-checks a checkpoint (`before.status` becomes `IN_PROGRESS`). | `progress.ts:53`; test only covers one pass (`payments.test.ts:465`) |
| M-3 | First-party `lesson_started` is written twice for logged-in users: the client posts it on **every** lesson open (`LessonPage.tsx:147`, not gated on progress) and the server writes it on first progress (`progress.ts:51`). This inflates the admin funnel table. | as cited |
| M-4 | Server-side events depend on `User.analyticsConsent`, which is synced only on banner choice, login/signup, or account settings (`auth.ts:17-23, :34`; `ConsentBanner.tsx:36`; `Account.tsx:139-141`). Sync errors are swallowed. Users with a stored legacy `'granted'` value (`consent.ts:23`) never see the banner again, so they are never synced. Consent is last-write-wins across devices. | as cited |
| M-5 | No `purchase_refunded` event. PostHog revenue and conversion never reflect refunds. | `payments.ts:173-195` |
| M-6 | `prompt_copied` is classified purely by code-block language `text`. 2 of 13 `text` blocks are diagrams, not prompts (`content/projects/taskflow-lite/01-define/02-architecture.md:34`, `04-ui/07-components.md:27`). `prompt_id` is declared but never populated. | `LessonPage.tsx:251-252` |
| M-7 | Most important buttons can't be ranked: no `data-analytics-id`; `checkout-pay` and the auth submits sit inside `ph-no-capture`; nav, logout, downloads and dashboard actions have no stable ID. | §4 |
| M-8 | Session replay is not blocked on `/admin*` (user names and partially masked emails visible). | `analytics.ts:34-41` |
| M-9 | Autocapture allowlist semantics (`element_allowlist` × `css_selector_allowlist`) are untested against the real SDK; `checkpoint-toggle` is an `input` and may not be captured. | `analytics.ts:134-138` |
| M-10 | The E2E privacy test is vacuous (no key), and no test exercises the real `posthog-js`. H-1 and H-2 passed the suite. | `e2e/smoke.spec.ts:47-62`; `analytics.test.ts` fake SDK |
| M-11 | PostHog IP collection and data retention are not configured (needs a project). The banner calls the analytics "anonymous" (`ConsentBanner.tsx`), yet logged-in users are identified by user ID. | `docs/analytics/posthog-setup.md` §1 |

### LOW

| ID | Issue | Evidence |
|---|---|---|
| L-1 | `free_project_started` and `project_completed` dedupe is check-then-insert, not atomic; concurrent requests can double-fire. | `progress.ts:12-21`, `services/analytics.ts` `trackOnce` |
| L-2 | `project_completed` dedupe relies on a `LeadEvent` row that `analytics:purge` deletes after 395 days. | `progress.ts:95`; `purge-analytics.ts` |
| L-3 | `client_error.reason` isn't URL-scrubbed (it could contain a URL with a token). | `analytics.ts:268-273` |
| L-4 | `pro_page_viewed` on `/checkout` fires even when checkout is closed or the user already has Pro. | `Checkout.tsx:34-36` |
| L-5 | Person property `plan` is stale after purchase until the next page load. | `analytics.ts:234-236` |
| L-6 | Two parallel taxonomies (`signup_complete` vs `signup_completed`, two `lesson_started`) invite confusion. | `packages/shared/src/analytics.ts:3, :52` |
| L-7 | No Pro project start event, and no `signup_failed`, `login_failed`, `logout`, `onboarding_completed`, `resource_downloaded`, `checkpoint_completed` (PostHog) events. | §3 "Not implemented" |
| L-8 | API events can be lost on a crash before flush (batching every 20 events or 10 s). | `product-analytics.ts:19` |
| L-9 | First-party retention purge exists but isn't scheduled. | `purge-analytics.ts` |

---

## 10. Recommended improvements (priority order)

1. **Fix H-1:** set `identifiedId` only after the identify call actually runs. Alternatively, on consent grant, re-identify the current `/me` user.
2. **Fix H-2:** initialize PostHog once with `opt_out_capturing_by_default: true` and switch with `opt_in_capturing()` / `opt_out_capturing()` instead of re-`init`. On grant, always call `opt_in_capturing()`.
3. **Fix H-3:** strip *all* query parameters except `purchase` on `/checkout/status` (or allowlist query keys per route) in `scrubUrl` / `before_send`. Better still, have the status page replace the URL (`history.replaceState`) before the pageview fires.
4. **Fix H-4:** after consent is granted, emit a `$pageview` for the current location. Consider a dedicated `landing_viewed` with UTM properties.
5. Add `purchase_refunded` (API, deduped like `purchase_completed`) and set the person property `plan` from the server (`$set` in `purchase_completed`).
6. Make `lesson_completed` once per user and lesson (claim column or `LeadEvent` unique key), and make `lesson_started` once per user and lesson (server-side, or only for identified users after the progress write).
7. Mark prompts explicitly (for example a `prompt` fence meta such as ```` ```text prompt=F01 ````) and send `prompt_id`.
8. Add `data-analytics-id` (or keep `data-attr` consistently) to nav, logout, dashboard continue, lesson navigation, resource download, onboarding and auth submit buttons. Track `checkout_pay_clicked` and `signup_submitted` / `signup_failed` explicitly, since those forms are `ph-no-capture`.
9. Add `/admin` to the replay block list. Scrub URLs in `client_error.reason`.
10. Remove the first-party client `lesson_started` (M-3) or rename the legacy taxonomy.
11. Test against the real SDK: one Vitest suite using real `posthog-js` with `api_host` pointed at a local stub, plus an E2E run with a dummy key and request interception asserting payloads (consent, identify ordering, scrubbing, no PII).
12. Configure PostHog: EU project, discard client IP, retention period, replay settings. Schedule `analytics:purge`. Build the 7 dashboards in `docs/analytics/posthog-setup.md`, then run its §6 verification checklist and record the results.

---

## 11. Final readiness score: **52 / 100**

| Area | Weight | Score | Notes |
|---|---|---|---|
| Architecture and typing | 15 | 13 | Central typed wrappers, allowlist, server/client split |
| Event coverage for funnels A–C | 20 | 12 | All named events exist; landing loss, Pro start and refund gaps |
| Data correctness (dedupe, identity) | 20 | 8 | H-1, M-1, M-2, M-3 |
| Privacy and consent | 20 | 10 | Strong design; H-2, H-3, M-8 |
| Paymob purchase integrity | 10 | 8 | Verified and deduped; no refund event; never run for real |
| Verification evidence | 15 | 1 | Nothing confirmed in PostHog; tests use fakes; E2E check is vacuous |

**Verdict:** the architecture is sound and the backend purchase tracking is well protected. Fix H-1 to H-4 and run the real-SDK verification before relying on any PostHog dashboard.
