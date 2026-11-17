# PostHog setup — Portfolab

Status: **code integrated and tested with a mocked SDK. Not connected to a real PostHog project** (no API key provided). Nothing in this document has been created in PostHog yet; the dashboards below are specifications for you to create.

## 1. Create the project

1. Create a PostHog Cloud project. EU Cloud (`https://eu.i.posthog.com`) is the default in code; use US (`https://us.i.posthog.com`) if you prefer and set the host vars accordingly.
2. Project settings → **Project API key** (`phc_…`). This key is public by design (it ships to browsers).
3. Project settings → **Authorized URLs / domains**: add your production web origin only.
4. Project settings → **Data retention**: choose a period and put the same number in the privacy page placeholder.
5. Session replay settings: keep "Record user sessions" **on** in PostHog only if you will also set `VITE_POSTHOG_REPLAY_ENABLED=true`; replay additionally requires each visitor's explicit opt-in.
6. Recommended: enable "Discard client IP data" in project settings.

## 2. Environment variables

| Where | Variable | Value |
|---|---|---|
| `apps/web/.env.local` (build time) | `VITE_POSTHOG_KEY` | `phc_…` (empty = PostHog fully disabled) |
| | `VITE_POSTHOG_HOST` | `https://eu.i.posthog.com` |
| | `VITE_POSTHOG_REPLAY_ENABLED` | `false` until you approve replay |
| `apps/api/.env` | `POSTHOG_API_KEY` | same `phc_…` key (server-side capture) |
| | `POSTHOG_HOST` | same host |

No personal API key (`phx_…`) is needed by the app. Never put a personal API key in any `VITE_*` variable.

## 3. How it works

- **Single entry point:** `apps/web/src/lib/analytics.ts` (`analytics.capture / pageview / identify / reset`) and `apps/api/src/services/product-analytics.ts` (`captureForUser`). No other file imports PostHog.
- **Consent first:** the PostHog SDK is not even downloaded until the visitor clicks "موافق" in the banner. Revoking calls `reset()` **then** `opt_out_capturing()` (in posthog-js, `reset()` clears a previous opt-out, so the order matters). The SDK instance is kept, and re-granting calls `opt_in_capturing()`, re-identifies the current user and sends a `$pageview` for the current page. A persisted opt-out is cleared at init when consent is granted. On `/checkout/status` every query parameter except `purchase` is removed from URLs before sending, and from the address bar. Logged-in users' choice is stored server-side (`User.analyticsConsent`); the API only sends server events for users who consented.
- **Pageviews:** manual `$pageview` on every SPA route change (`useAnalyticsRouting` in `Layout`).
- **Autocapture:** clicks/submits/changes on `a`, `button`, `form`, `select`, `label`, checkbox inputs and anything with `data-analytics-id`. Auth, checkout and onboarding forms have `ph-no-capture`; their conversions are tracked explicitly (`button_clicked`, `*_failed`, `*_completed`).
- **Identity:** `identify(user.id, { role, plan })` — internal cuid only, never email/name. `reset()` on logout. `person_profiles: 'identified_only'`.
- **Attribution:** `utm_*` captured from the URL on landing and registered as super properties (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `campaign`) plus `device_type`.
- **Scrubbing:** `before_send` redacts `token`, `hmac`, `clientSecret`, `client_secret`, `secret`, `code` query params from `$current_url`, `$referrer` and initial URL properties. All custom properties go through an allowlist (`sanitizeProperties` in `packages/shared/src/analytics.ts`); any value that looks like an email is dropped.
- **Session replay:** off unless (build flag) AND (visitor opted in). `maskAllInputs`, `pre`/`code`/`.ph-mask` text masked, `.ph-no-capture` blocked, and recording is stopped on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/checkout*`.
- **Failure-safe:** every PostHog call is wrapped; ad-blockers or SDK errors never break the UI.

## 4. Event catalog

Typed contract: `ProductEventMap` in `packages/shared/src/analytics.ts`. "Once" means atomically deduplicated per user + subject by the `AnalyticsClaim` table (never purged).

| Event | Emitted by | When | Properties | Repeats? |
|---|---|---|---|---|
| `$pageview` | web | each route change; the current page is (re)sent once when consent is granted | `path`, super props | per navigation |
| `$autocapture` | web (SDK) | clicks/submits on `a`, `button`, `form`, `select`, `label`, `input[type=checkbox]`, `[data-analytics-id]`; never inside `.ph-no-capture` | SDK defaults incl. `attr__data-analytics-id` | yes |
| `button_clicked` | web | every tracked control (see ids below); submit buttons tracked in `onSubmit` (covers Enter) | `analytics_id`, `path`, optional `project_id`, `lesson_id`, `resource_id` | yes |
| `signup_completed` / `login_completed` | web | auth API success | `source` | per signup / login |
| `signup_failed` / `login_failed` | web | auth API error or client validation | `reason` = API error code or `client_validation` (never input) | yes |
| `logged_out` | web | logout, before identity reset | `source` | yes |
| `onboarding_completed` | web | onboarding saved or skipped | `source` (`saved`/`skipped`) | per visit |
| `free_project_started` / `pro_project_started` | **api** | first enrollment | `project_id`, `source` | **once** |
| `lesson_previewed` | web | anonymous visitor opens a preview lesson | `project_id`, `lesson_id` | per mount |
| `lesson_started` | **api** | first non-NOT_STARTED progress | `project_id`, `lesson_id` | **once** |
| `lesson_completed` | **api** | first COMPLETED progress | `project_id`, `lesson_id` | **once** |
| `checkpoint_completed` | **api** | first completion of a checkpoint | `project_id`, `lesson_id`, `checkpoint_id` (key) | **once** |
| `project_completed` | **api** | all published lessons completed | `project_id`, `plan` | **once** |
| `prompt_copied` | web | copy on a block tagged ```` ```text prompt=F0x ```` | `project_id`, `lesson_id`, `prompt_id`, `feature_name` | yes |
| `feature_used` | web | `code_copied` (untagged block), `spoiler_revealed` | `feature_name`, `source` | yes |
| `resource_downloaded` | **api** | authorized download served | `resource_id` (stable key), `project_id`, `plan` | yes (every download) |
| `pro_page_viewed` | web | `/pricing`, open `/checkout` (not for Pro owners), Pro project page; held in memory before a consent decision and sent only if consent is granted on that page | `source` | per view |
| `checkout_started` | **api** | Paymob intention created | `plan`, `source`, `amount_egp` | per attempt |
| `checkout_failed` | api + web | api: intention error / declined webhook; web: client errors except 502 | `plan`, `source`, `reason` | yes |
| `purchase_completed` | **api only** | verified payment; `$set plan=pro`; flushed immediately | `plan`, `amount_egp`, `currency`, `provider`, `purchase_id` | **once** (`Purchase.analyticsCapturedAt`) |
| `purchase_refunded` | **api only** | refund/void processed; `$set plan` recomputed; flushed immediately | same as purchase | **once** |
| `client_error` | web | `window.onerror` / unhandled rejection; text sanitized (URL queries, emails, card-like numbers, tokens) | `reason`, `feature_name` | yes |

All events carry `device_type`. Server events carry `app: 'api'`, web events `app: 'web'`. Identify sends `$set` `role`, `plan` and `$set_once` `initial_utm_*`. First-party `LeadEvent` names (`signup_complete`, `project_enrolled`, `lesson_started`, `checkpoint_completed`, `free_project_completed`, …) are a separate admin-only store; `lesson_started` and `checkpoint_completed` are now written once, by the server only.

Stable ids (`data-analytics-id` / `analytics_id`), registry `ANALYTICS_IDS` in `packages/shared/src/analytics.ts` (a unit test fails if the UI uses an unregistered id): navigation `nav-*`, footer `footer-*`, landing `hero-free-cta`, `hero-preview-lesson`, `landing-curriculum-link`, pricing `pricing-free-cta`, `pricing-pro-cta`, projects `project-card`, `project-start`, `project-signup-cta`, `project-lesson-link`, dashboard `dashboard-continue`, `dashboard-start-taskflow`, `progress-lesson-link`, lessons `lesson-prev`, `lesson-next`, `lesson-breadcrumb-project`, `lesson-locked-signup`, `lesson-locked-login`, `lesson-pro-pricing`, `code-copy`, `code-spoiler-toggle`, `checkpoint-toggle`, `resource-download`, auth `signup-submit`, `login-submit`, `forgot-password-submit`, `reset-password-submit`, onboarding `onboarding-save`, `onboarding-skip`, checkout `checkout-pay`, `checkout-retry`, `checkout-dashboard`, consent `consent-accept`, `consent-decline`.

**Ranking buttons:** use a Trends insight on `button_clicked` broken down by `analytics_id` (not `$autocapture`, which also fires for the same clicks and is kept only for heatmaps/toolbar).

## 5. Dashboards to create (manual)

Create each as a PostHog dashboard; insights are listed with their exact configuration. Date range default: last 30 days.

### 1. Traffic & Acquisition
- Trends: `$pageview` total, breakdown by `utm_source`.
- Trends: unique users `$pageview`, breakdown by `utm_campaign`.
- Trends: `$pageview` breakdown by `device_type`.
- Table: `$pageview` breakdown by `$referring_domain`.
- Trends: `signup_completed` breakdown by `utm_campaign` (campaign → signup attribution).

### 2. Most Used Features & Buttons
- Trends: `button_clicked`, breakdown by `analytics_id`, top 30 (the reliable button ranking).
- Trends: `button_clicked` where `analytics_id` in (`hero-free-cta`, `pricing-free-cta`, `pricing-pro-cta`, `project-start`, `dashboard-continue`, `checkout-pay`), breakdown by `analytics_id`.
- Trends: `feature_used` breakdown by `feature_name`.
- Trends: `prompt_copied` breakdown by `lesson_id`.
- Trends: `$pageview` breakdown by `path`, top 20.

### 3. User Engagement
- Lifecycle: `$pageview` (new / returning / resurrecting / dormant), weekly.
- Retention: start event `signup_completed`, return event `lesson_started` OR `lesson_completed`, weekly, 8 weeks.
- Stickiness: `lesson_completed`, unique users.
- Trends: DAU/WAU of `$pageview` unique users.

### 4. Project & Lesson Completion
- Funnel (ordered, 30-day window): `free_project_started` → `lesson_completed` → `project_completed` where `project_id = taskflow-lite`.
- Trends: `lesson_completed` breakdown by `lesson_id` (find drop-off lessons).
- Trends: `lesson_started` vs `lesson_completed` by `lesson_id` (completion ratio per lesson, formula `B/A`).

### 5. Free-to-Pro Conversion
- Funnel (60-day window): `signup_completed` → `project_completed` (`plan = free`) → `pro_page_viewed` → `checkout_started` → `purchase_completed`.
- Trends: `pro_page_viewed` breakdown by `source`.
- Note: revenue truth is in the database (admin overview); PostHog is behavioral.

### 6. Checkout Funnel
- Funnel (1-day window): `pro_page_viewed` (`source = checkout`) → `checkout_started` → `purchase_completed`.
- Trends: `checkout_failed` breakdown by `reason` and `source`.
- Trends: `purchase_completed` count and sum of `amount_egp`.

### 7. Errors & User Friction
- Trends: `client_error` breakdown by `reason`.
- Trends: `checkout_failed` breakdown by `reason`.
- Trends: `$rageclick` (enable "Rageclick capture" in project settings) breakdown by `$current_url`.
- Trends: `$pageview` where `path` contains `/login` vs `login_completed` (login friction).
- Session replay filter (only if replay enabled): sessions with `client_error` or `$rageclick`.

## 6. Verification checklist after adding keys

1. Load the site in a fresh browser profile → Network tab shows **no** request to `*.posthog.com` before clicking "موافق".
2. Click "موافق" → `$pageview` appears in PostHog **Activity** within ~1 minute.
3. Sign up → `signup_completed`; person profile id equals the user's cuid (check DB), and has **no** email/name.
4. Log out → next events are anonymous (new distinct id).
5. Open `/reset-password?token=…` → the event URL shows `token=REDACTED`.
6. Complete a lesson while logged in with consent → `lesson_completed` arrives with `app = api`.
7. Footer → "إعدادات التحليلات" → "لأ، شكرًا" → no further events.
