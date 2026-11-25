# Portfolab free public beta — VPS runbook (portfolab.blog)

Single VPS, Docker Compose. Caddy terminates HTTPS and is the only published service.

```
internet ──443/80──▶ caddy (static SPA + /api/* proxy, path preserved)
                        │ edge network
                        ▼
                      api:4000 (Express) ──db network (internal)──▶ db:5432 (PostgreSQL 16)
```

- `db` is only on an `internal: true` network. `api` has no published port. Only `caddy` publishes 80/443.
- Volumes: `pgdata` (database), `caddy_data` (TLS certs/keys), `caddy_config`.
- The `migrate` one-shot service runs `prisma migrate deploy` and the content import before `api` starts, on every `up`.
- The API image contains `content/` and `examples/taskflow-lite/{starter,reference}`; the build fails if they are missing. `CONTENT_DIR=/app/content`, so REPO_ZIP resources resolve to `/app/examples/...`.
- Build context is allowlisted by the root `.dockerignore` (deny-by-default). Local `.env*` files (except the TaskFlow `server/.env.example`), `node_modules`, agent folders, `scripts/`, `docs/`, `e2e/`, tests and exports never enter the context. The API stage copies only workspace manifests, `node_modules`, `packages/`, `apps/api/{prisma,src,dist}`, content and the TaskFlow repos — no web sources or build.
- If the build fails with a missing file, add that path to the allowlist in `.dockerignore`, not a broad `!` pattern.
- Checkout is hard-disabled (`CHECKOUT_ENABLED=false`). PostHog is off unless keys are set.
- Web build uses `VITE_FREE_LAUNCH=true`: only TaskFlow Lite is shown; `/pricing`, `/checkout*`, `/refund-policy` redirect to `/projects/taskflow-lite`.

## 1. Prerequisites (owner)

- VPS with Docker Engine + Compose plugin. Firewall: allow 22, 80, 443 (tcp) and 443/udp only.
- DNS `A`/`AAAA` for `portfolab.blog` → VPS IP. Wait until it resolves before first start (ACME).
- Resend: add the sending domain, publish the SPF + DKIM records it shows (DMARC recommended), wait for **Verified**. Pick the sender address on that domain. Create a **sending-only** API key.

## 2. Configure

```sh
git clone <repo> portfolab && cd portfolab/deploy
cp .env.example .env && chmod 600 .env
# fill POSTGRES_PASSWORD, SESSION_SECRET, RESEND_API_KEY, EMAIL_FROM
openssl rand -hex 24   # POSTGRES_PASSWORD
openssl rand -hex 32   # SESSION_SECRET
```

The API refuses to start in production without a valid Resend key and a sender on a non-test domain.

## 3. Build and start

```sh
cd deploy
docker compose build
docker compose up -d
docker compose logs migrate        # "[content] imported {...}"
docker compose ps                  # api healthy, caddy up, migrate exited 0
```

Explicit one-off commands:

```sh
docker compose run --rm migrate                                   # migrations + import (keeps admin status edits)
docker compose run --rm migrate node dist/scripts/import-content.js --sync-status   # force statuses from files
```

First admin (after signing up on the site with that email):

```sh
docker compose exec api ./node_modules/.bin/tsx src/scripts/make-admin.ts <email>
```

## 4. Smoke test

```sh
curl -fsS https://portfolab.blog/api/health                       # {"data":{"status":"ok"...}}
curl -s   https://portfolab.blog/api/nope                         # JSON 404, not HTML
curl -fsS https://portfolab.blog/api/pricing | grep -o '"checkoutEnabled":[a-z]*'   # all false
curl -fsSI https://portfolab.blog/projects/taskflow-lite | head -1   # 200 (SPA fallback)
docker compose ps --format '{{.Service}} {{.Ports}}'              # only caddy has published ports
nc -zv portfolab.blog 5432; nc -zv portfolab.blog 4000            # both must fail
```

Browser (private window):

1. Landing shows only TaskFlow Lite; no "الأسعار" in nav, no "الاسترجاع" or "تواصل" in footer. `/privacy` has no Paymob section; `/account` has no purchases card.
2. `/pricing`, `/checkout`, `/refund-policy` land on `/projects/taskflow-lite`; `/projects/expensepilot` shows the "not available in the free beta" page.
3. Sign up → onboarding (try "تخطى") → dashboard → start TaskFlow Lite → tick a checkpoint → logout/login keeps progress.
4. `/resources`: download a markdown file and the starter zip (opens, contains `package.json`, no `.env`).
5. Forgot password → email arrives from the verified sender; link opens `https://portfolab.blog/reset-password?...`.

Local free-mode browser check (no deploy): `PW_FREE_LAUNCH=1 pnpm exec playwright test --project=free-launch`.

## 5. Backups

```sh
mkdir -p ~/backups
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' \
  > ~/backups/portfolab-$(date +%F-%H%M).dump
```

- Schedule daily via cron, copy off the VPS, keep ≥ 7 days. Back up before every deploy.
- Restore (stop the API first):

```sh
docker compose stop api caddy
docker compose exec -T db sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists' \
  < ~/backups/<file>.dump
docker compose up -d
```

- Test a restore into a scratch database at least once before launch.
- `caddy_data` holds certificates; losing it only triggers re-issuance (mind ACME rate limits).

## 6. Update / rollback

```sh
git pull && cd deploy && docker compose build && docker compose up -d
```

Migrations are forward-only. To roll back: check out the previous commit, rebuild, and restore the pre-deploy backup if the schema changed.

## 7. Social sign-in (Google / GitHub, optional)

Off until both values of a pair are in `deploy/.env`; a half-set pair stops the API on purpose. Buttons appear only for configured providers (`GET /api/auth/oauth/providers`).

| Provider | Production callback | Local callback (`APP_URL=http://localhost:5173`) |
| --- | --- | --- |
| Google | `https://portfolab.blog/api/auth/oauth/google/callback` | `http://localhost:5173/api/auth/oauth/google/callback` |
| GitHub | `https://portfolab.blog/api/auth/oauth/github/callback` | `http://localhost:5173/api/auth/oauth/github/callback` |

Callbacks are built from `APP_URL` (bare origin, https in production). They are not taken from `API_PUBLIC_URL`, because the state cookie is set on the web origin.

Google (Google Cloud Console → APIs & Services):
1. OAuth consent screen: External, app name Portfolab, support email, privacy URL `https://portfolab.blog/privacy`, terms URL `https://portfolab.blog/terms`, authorized domain `portfolab.blog`. Scopes: `openid`, `email`, `profile` only. Publish the app (Testing mode only lets listed test users sign in).
2. Credentials → Create OAuth client ID → Web application. Authorized redirect URIs: the production callback. Use a separate client for local dev with the local callback.
3. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

GitHub (Settings → Developer settings → OAuth Apps → New OAuth App, an OAuth App, not a GitHub App):
1. Homepage `https://portfolab.blog`, Authorization callback URL: the production callback. Use a separate app for local dev, since a GitHub OAuth App has only one callback.
2. Generate a client secret. Put the values into `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`. Scopes requested are `read:user user:email` only.

Activate with `docker compose up -d api` and confirm the buttons appear on `/login` and `/signup`. Smoke test in a private window: sign up with each provider (privacy box required), log out, log back in. Then trying the same provider email that already has a password account must show "sign in with your original method" and must not log you in.

Rotate a secret by replacing it in `.env` and running `docker compose up -d api`. Provider access tokens are never stored, so no stored tokens need to be revoked.

## Owner inputs still required

- `EMAIL_FROM` address and verified Resend domain.
- Legal pages show the owner-provided operator name and support email. The governing law, PostHog data region and retention, and refund terms are still drafts pending review. The refund page is hidden in free mode.
- Optional: Google and GitHub OAuth client ID/secret pairs (§7), Google consent-screen publishing/verification.
- Whether `www.portfolab.blog` should exist (add a Caddy redirect block + DNS if so).
