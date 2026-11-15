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
- **Autocapture:** clicks/submits/changes on `a`, `button`, `form`, `select`, `label`. Important elements carry stable `data-attr` ids (below). Auth, checkout and account forms have `ph-no-capture`.
- **Identity:** `identify(user.id, { role, plan })` — internal cuid only, never email/name. `reset()` on logout. `person_profiles: 'identified_only'`.
- **Attribution:** `utm_*` captured from the URL on landing and registered as super properties (`utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `campaign`) plus `device_type`.
- **Scrubbing:** `before_send` redacts `token`, `hmac`, `clientSecret`, `client_secret`, `secret`, `code` query params from `$current_url`, `$referrer` and initial URL properties. All custom properties go through an allowlist (`sanitizeProperties` in `packages/shared/src/analytics.ts`); any value that looks like an email is dropped.
- **Session replay:** off unless (build flag) AND (visitor opted in). `maskAllInputs`, `pre`/`code`/`.ph-mask` text masked, `.ph-no-capture` blocked, and recording is stopped on `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/account`, `/checkout*`.
- **Failure-safe:** every PostHog call is wrapped; ad-blockers or SDK errors never break the UI.

## 4. Event catalog

| Event | Emitted by | When | Properties |
|---|---|---|---|
| `$pageview` | web | each route change | `path`, super props |
| `$autocapture` | web (SDK) | clicks/submits on allowlisted elements | SDK defaults + `data-attr` |
| `signup_completed` | web | signup API succeeded | `source` |
| `login_completed` | web | login API succeeded | `source` |
| `free_project_started` | **api** | first enrollment in a FREE project | `project_id`, `source` |
| `lesson_started` | web | first open of a lesson (no progress yet) | `project_id`, `lesson_id` |
| `lesson_completed` | **api** | lesson progress transitions to COMPLETED | `project_id`, `lesson_id` |
| `prompt_copied` | web | copy button on a `text` block (AI prompts) | `project_id`, `lesson_id`, `feature_name` |
| `project_completed` | **api** | all published lessons completed (once per user/project) | `project_id`, `plan` |
| `pro_page_viewed` | web | `/pricing`, `/checkout`, any Pro project page | `source` |
| `checkout_started` | **api** | Paymob intention created | `plan`, `source`, `amount_egp` |
| `checkout_failed` | api + web | api: intention error / declined payment webhook; web: client-side errors other than 502 | `plan`, `source`, `reason` |
| `purchase_completed` | **api only** | verified Paymob success, deduped by `Purchase.analyticsCapturedAt` | `plan`, `amount_egp`, `currency`, `provider`, `purchase_id` |
| `feature_used` | web | `code_copied`, `spoiler_revealed` | `feature_name`, `source` |
| `client_error` | web | `window.onerror` / unhandled rejection | `reason`, `feature_name` |

All events carry `device_type`. Server events carry `app: 'api'`, web events `app: 'web'`. `project_id`/`lesson_id` are slugs.

Stable `data-attr` ids: `nav-logo`, `hero-free-cta`, `pricing-free-cta`, `pricing-pro-cta`, `project-start`, `checkpoint-toggle`, `code-copy`, `code-spoiler-toggle`, `checkout-pay`, `checkout-retry`, `consent-accept`, `consent-decline`, `footer-privacy-settings`.

## 5. Dashboards to create (manual)

Create each as a PostHog dashboard; insights are listed with their exact configuration. Date range default: last 30 days.

### 1. Traffic & Acquisition
- Trends: `$pageview` total, breakdown by `utm_source`.
- Trends: unique users `$pageview`, breakdown by `utm_campaign`.
- Trends: `$pageview` breakdown by `device_type`.
- Table: `$pageview` breakdown by `$referring_domain`.
- Trends: `signup_completed` breakdown by `utm_campaign` (campaign → signup attribution).

### 2. Most Used Features & Buttons
- Trends: `$autocapture` where `event type = click`, breakdown by **element attribute `data-attr`**, top 20.
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
