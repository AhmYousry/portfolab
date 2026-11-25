# Portfolab — PostHog Live Verification

Date: 2026-11-17 · Project: PostHog Cloud **US**, project ID `738449` · Environment: local dev (`localhost:5173` web, `localhost:4000` API) against the real project.

Evidence levels used in this report:

| Level | Meaning |
|---|---|
| **LIVE VERIFIED** | The event is visible in the real PostHog project (Activity → Explore events, and/or the SQL editor). |
| **SENT (browser/server)** | The SDK logged the send and the ingestion endpoint answered HTTP 200, but the event was not looked up in the project. |
| **NOT VERIFIED** | Not exercised in this run. |

## 1. Configuration status

No credential values appear in this report, in commits, or in Git-tracked files.

| Variable | File (gitignored) | Status |
|---|---|---|
| `VITE_POSTHOG_KEY` | `apps/web/.env` | set (`phc_` project key) |
| `VITE_POSTHOG_HOST` | `apps/web/.env` | `https://us.i.posthog.com` |
| `VITE_POSTHOG_REPLAY_ENABLED` | `apps/web/.env` | `false` |
| `POSTHOG_API_KEY` | `apps/api/.env` | set (same project key) |
| `POSTHOG_HOST` | `apps/api/.env` | `https://us.i.posthog.com` |
| `POSTHOG_PERSONAL_API_KEY` | `.env.posthog.local` | set (`phx_` personal key, used only by the dashboard script; revocable after setup) |
| `POSTHOG_APP_HOST` / `POSTHOG_PROJECT_ID` | `.env.posthog.local` | `https://us.posthog.com` / `738449` |

- **Region.** It comes from the owner-provided app host (`us.posthog.com`); it was not guessed. The ingestion host is the matching `us.i.posthog.com`.
- **Fixes during setup.** The project key had been pasted into the host field, and the personal-key slot held the project key. Both were corrected locally.
- **Git safety.** `git check-ignore` confirms all three env files are ignored, and `git status` showed no env file.
- **Key exposure.** The `phc_` project key was printed once in the local session output while diagnosing the slot mix-up. It is a public, write-only ingestion key that ships in the browser bundle by design, and it was not written to any tracked file.

## 2. Events — live results

Test identity: fake account `ph-live-verify-1117@example.test` with a generated test password and the display name "PH Live Verify". No real personal or payment data was used. The UTMs were `utm_source=claude-verify` and `utm_campaign=live-check`.

| # | Event | Source | Browser / server send | In PostHog project | Notes |
|---|---|---|---|---|---|
| 1 | `$pageview` | web | sent, HTTP 200 from `us.i.posthog.com/e/` | **LIVE VERIFIED** | 8 rows; landing pageview carries the UTMs |
| 2 | `button_clicked` | web | sent | **LIVE VERIFIED** | 7+ rows (`hero-free-cta`, `signup-submit`, `onboarding-skip`, `project-start`, `checkpoint-toggle` ×2, `code-copy`, `footer-privacy-settings`) |
| 3 | `signup_completed` | web | sent | **LIVE VERIFIED** | Preceded by `$identify` |
| 4 | `free_project_started` | api (posthog-node) | `AnalyticsClaim` row written | **LIVE VERIFIED** | library = `posthog-node` |
| 5 | `lesson_started` | api | claim written | **LIVE VERIFIED** | `why-taskflow` |
| 6 | `lesson_completed` | api | claim written | **LIVE VERIFIED** | after both checkpoints |
| 7 | `prompt_copied` | web | sent | **LIVE VERIFIED** | prompt `F01`; see the note below |

Also LIVE VERIFIED, though not required:

- `$identify`
- `onboarding_completed`
- `checkpoint_completed` ×2 (api)
- `$autocapture`
- `$pageleave`
- `$web_vitals`
- `$set`

**`prompt_copied` caveat.** The Claude browser pane denies `navigator.clipboard.writeText`. The app correctly emits `prompt_copied` only after a successful copy, so the first click sent only `$autocapture`. For the verification click, the page's clipboard function was stubbed in the browser to resolve successfully; no application code was changed. On a normal browser with clipboard permission the event fires without that stub. Recommendation: one manual copy on a real browser to close this out.

**Not verified in this run** (they need checkout or a full-project path):

- `project_completed`
- `pro_page_viewed`
- `checkout_started`
- `checkout_failed`
- `purchase_completed`
- `purchase_refunded`
- `resource_downloaded`
- `lesson_previewed`
- `login_completed` / `login_failed`
- `logged_out`
- `client_error`

These are covered by unit, integration and E2E tests against the real SDK with an intercepted host, not by the live project.

## 3. Consent & privacy results (live)

| Check | Method | Result |
|---|---|---|
| No tracking before consent | Fresh load with UTMs, 3 s wait; network list and resource timing | **PASS**: zero requests to any `posthog.com` host before "موافق" |
| Revoking consent stops tracking | Footer → "إعدادات التحليلات" → "لأ، شكرًا", then two route changes (`/terms`, `/privacy`); queried the project for the last 6 minutes | **PASS**: no events for `/terms` or `/privacy` reached the project; opt-out flag persisted |
| Identity consistent after signup | SQL over all events in the project | **PASS**: 42 events, **1 person**, 2 distinct IDs (anonymous device ID merged into the user cuid via `$identify`); server events use the same cuid |
| Sensitive form values excluded | SQL `ilike` over `properties` and `elements_chain` for the test email, name, password, card brand and number, `hmac`, `amount_cents`, `source_data`, transaction id | **PASS**: **0 hits** in 42 events |
| Checkout URLs sanitized | Opened `/checkout/status?purchase=…&id=…&source_data.pan=…&source_data.sub_type=…&amount_cents=…&hmac=…` (all fake) | **PASS**: the stored `$current_url` is `…/checkout/status?purchase=cmverifyfake01`, and the address bar was cleaned too |
| Session replay disabled | Resource timing for recorder or `/s/` requests; `VITE_POSTHOG_REPLAY_ENABLED=false` | **PASS**: no recorder script loaded, no snapshot requests |

Observations from the revoke test:

- **Post-revoke traffic.** After revoking, the page made one `/flags` call (`reset()` reloads flags) and flushed one final batch. The project shows that batch contained only events captured *before* the revoke: `footer-privacy-settings` and its `$autocapture`.
- **Decline click recorded (low).** The click on "لأ، شكرًا" itself is recorded as `$autocapture`. Autocapture listens in the capture phase, before the app's revoke handler runs. Low severity: it carries no personal data. Fix if wanted: add `ph-no-capture` to the consent banner's decline button.

## 4. Things the PostHog project turned on by itself

The project's remote config enabled these on the client, on top of the app's own settings:

- heatmaps (`$$heatmap`)
- web vitals (`$web_vitals`)
- dead-click capture
- surveys
- `$pageleave`

None of these carry form values (verified by the leak query above), but they were not part of the analytics design. Review them in **Project settings → Autocapture & heatmaps / Web vitals / Surveys** and switch off whatever you don't want.

Owner settings still to set, carried over from audit item M-11:

- **Project settings → IP data capture:** enable "Discard client IP data".
- **Data retention:** set to the policy period.
- **Filter out internal and test users:** add `$host` ∌ `localhost`. Otherwise the local verification events (all from `localhost`) stay in charts; you can also delete the test person `cmwkfrsfx0008vsh8dl9crwad` under People.

## 5. Dashboard setup status

**Status: CREATED.** On 2026-11-17, [`scripts/posthog-dashboards.mjs`](scripts/posthog-dashboards.mjs) created 7 dashboards (31 insights) in project `738449`, authenticated with a `phx_` personal API key.

| # | Dashboard | ID | Insights |
|---|---|---|---|
| 1 | Portfolab · 1. Traffic & Acquisition | 2367510 | 5 |
| 2 | Portfolab · 2. Most Clicked Buttons | 2367511 | 3 |
| 3 | Portfolab · 3. Learning Engagement | 2367512 | 6 |
| 4 | Portfolab · 4. Project Completion | 2367513 | 4 |
| 5 | Portfolab · 5. Free-to-Pro Conversion | 2367514 | 2 |
| 6 | Portfolab · 6. Checkout Funnel | 2367515 | 4 |
| 7 | Portfolab · 7. Errors & Friction | 2367516 | 5 |

Links: `https://us.posthog.com/project/738449/dashboard/<ID>`.

- **Most Clicked Buttons.** It uses `button_clicked` broken down by `analytics_id` (top 30); `$autocapture` is not used in any click count. It was checked in the UI: it renders the live verification clicks, which are `checkpoint-toggle`, `code-copy`, `footer-privacy-settings`, `hero-free-cta`, `onboarding-skip`, `project-start` and `signup-submit`.
- **Test-account filter.** Every insight has "filter out internal and test users" on. Once `$host ∌ localhost` is added to the project's test-account filter, the local verification data drops out of these charts.
- **Data so far.** Checkout, purchase and refund insights stay empty until checkout events flow (Paymob sandbox).
- **Re-running.** The script is idempotent: dashboards and insights are matched by name. Use `--dry-run` to list them without changes.

## 6. Remaining blockers

| Blocker | Owner | Impact |
|---|---|---|
| Revoke or keep the `phx_` dashboard key | owner | Least privilege once dashboards exist |
| IP discard, retention, test-account filter, review of extra remote features | owner (PostHog settings) | Privacy posture / clean charts |
| Checkout and purchase events live | needs Paymob sandbox credentials | Conversion funnels empty until then |
| Replay masking verification | owner + verification run | Replay must stay disabled until done |
| One real-browser `prompt_copied` | owner, 1 minute | Closes the clipboard caveat |
| Production deploy env | owner | Same 4 variables must be set on the hosting platform |

## 7. Readiness score

**91 / 100**, up from 82/100 in `PORTFOLAB_ANALYTICS_AUDIT_V2.md`.

Up:

- Real-project delivery is proven for the 7 core events, web and server.
- Identity merges into one person.
- No personal data in 42 stored events.
- Consent gate and revoke both hold live.
- All 7 dashboards created, with the button ranking verified against live data.

Still deducted:

- Checkout and purchase events not exercised live.
- Project-level privacy settings pending.
- Extra remote features (heatmaps, dead clicks, surveys) enabled without review.
- Decline-click autocapture.
- Replay masking unverified (replay correctly off).
