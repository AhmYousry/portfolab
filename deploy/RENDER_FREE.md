# Portfolab beta on Render Free + Neon Free (zero cost)

<div dir="rtl">

## بداية سريعة (تسجيل بالإيميل عن طريق Neon Auth)

1. **Neon:** ادخل [neon.tech](https://neon.tech) واختار **Continue with GitHub**. اعمل project جديد
   على الخطة **Free**، واختار region قريبة من الـ region اللي هتختارها على Render. من **Connect**
   اختار **Prisma** وانسخ الرابطين (pooled و direct). متشاركهمش مع حد.
2. **Neon Auth:** فعّل Neon Auth على **نفس الـ branch** بتاع `DATABASE_URL` (`neon.ts` فيه
   `auth: true`؛ `neon deploy` وبعدين `neon neon-auth status`)، وانسخ الـ **Auth URL** (رابط عام، مش
   سر).
3. **Render:** ادخل [render.com](https://render.com) واختار **Sign in with GitHub**. أول ما يطلب
   صلاحية على الـ repositories، اختار **Only select repositories** وحدد repo بتاع Portfolab بس
   (لو فاتتك: Account Settings → GitHub → Configure).
4. **Blueprint:** Render → **New** → **Blueprint** → اختار الـ repo. هيقرا `render.yaml` (web service
   واحد `plan: free`، و`AUTH_MODE=neon`). حط الرابطين في `DATABASE_URL` و `DIRECT_DATABASE_URL`،
   والـ Auth URL في `NEON_AUTH_BASE_URL`. سيب `NEON_AUTH_JWKS_URL` / `NEON_AUTH_JWT_ISSUER` /
   `NEON_AUTH_JWT_AUDIENCE` وقيم Google/GitHub فاضية.
5. **Trusted domain:** بعد ما الـ service تتعمل، ضيف رابطها في Neon:
   `neon neon-auth domain add https://<service>.onrender.com`.
6. **Manual Deploy**، وبعدين اعمل الـ checks اللي في قسم 5.

متدفعش حاجة: متغيرش الخطة، ومتضيفش disk أو cron أو worker، ومتحطش كارت.

</div>

One Render **Free** web service runs the API and serves the built React app from the same origin.
Data lives in a Neon **Free** Postgres project, and sign-up/sign-in is email + password through
Neon Auth (`AUTH_MODE=neon`, the `render.yaml` default). No purchased domain, no mail provider, no
paid resources. Google/GitHub sign-in (`AUTH_MODE=social`) remains available as an optional legacy
mode. The VPS path (`deploy/compose.yml`, `deploy/RUNBOOK.md`) is unchanged and still optional.

## What you get / free-tier limits

- URL: `https://<service>.onrender.com` (Render picks `<service>`; it may add a suffix if the name is taken).
- The service sleeps after ~15 minutes without traffic; the next request waits for a cold start
  (about a minute, plus migrations + content import on every start).
- The filesystem is ephemeral. Everything that must persist (users, sessions, progress) is in Neon;
  lessons, resources, and starter ZIPs are rebuilt from the repo on every start.
- Free instance hours, Neon storage, and Neon compute are capped monthly. Check the current
  numbers on the Render and Neon pricing pages before inviting many users.
- Portfolab sends no email. Password reset is not offered in the app yet; the forgot-password page
  points users to the contact page.
- Analytics stay off (no PostHog keys set).

## 1. Neon (database + Neon Auth)

1. Sign in with GitHub and create a Neon project (Free plan). Pick the region closest to your Render region.
2. Open **Connect**, choose **Prisma**, and copy both strings:
   - pooled (`...-pooler...`) → `DATABASE_URL`
   - direct (no `-pooler`) → `DIRECT_DATABASE_URL` (`DATABASE_URL_UNPOOLED`, the name `neon init`
     uses, is accepted as a fallback)
3. Keep `sslmode=require`. Adding `connect_timeout=15` helps when the Neon compute is waking up.
4. Enable Neon Auth on the **same branch** as `DATABASE_URL` (`neon.ts` has `auth: true`; run
   `neon deploy`, then `neon neon-auth status`). The API reads `neon_auth.session` with the app's
   own connection, so a different branch or role fails closed (nobody can sign in).
5. Copy the public **Auth URL** → `NEON_AUTH_BASE_URL`. It is not a secret.

## 2. Render (Blueprint)

1. Sign in to Render with GitHub and grant the Render GitHub app access to this repository only
   (Account Settings → GitHub → Configure if you skipped it).
2. Render → **New** → **Blueprint** → select this repository. Render reads `render.yaml`
   (one web service, `plan: free`, `AUTH_MODE=neon`).
3. When asked for the `sync: false` values, paste `DATABASE_URL`, `DIRECT_DATABASE_URL`, and
   `NEON_AUTH_BASE_URL`. Leave the optional `NEON_AUTH_JWKS_URL`, `NEON_AUTH_JWT_ISSUER`,
   `NEON_AUTH_JWT_AUDIENCE` and the four legacy OAuth values empty.
4. After the service is created, copy its URL from the dashboard: `https://<service>.onrender.com`.
   `APP_URL` and `CORS_ORIGINS` default to this URL automatically (`RENDER_EXTERNAL_URL`).
5. Add that origin as a Neon Auth trusted domain:
   `neon neon-auth domain add https://<service>.onrender.com`. Localhost is pre-approved for development.
6. A missing or non-https `NEON_AUTH_BASE_URL` stops the service at start on purpose. With it set,
   no OAuth values are needed.

## 3. Neon Auth details (`AUTH_MODE=neon`)

Users sign up and sign in with email + password against Neon Auth (Managed Better Auth) from the
browser; Portfolab never sees or stores their password.

How the bridge works: after `signUp.email` / `signIn.email`, the browser sends the Neon session JWT
and session id to `POST /api/auth/neon/session`. The API verifies the JWT signature against the
project JWKS (EdDSA only), issuer, audience, expiry and age, then confirms the upstream session row
in `neon_auth.session` is live and owned by the token's subject. Only then does it create a local
session bound to that upstream session. Every API request re-checks the upstream row, so Neon
sign-out, password change (other sessions), admin revocation, ban, or user deletion ends the local
session on the next request. Users are mapped by Neon user id only (`NeonAuthIdentity`); an existing
local account with the same email is **never** linked (the user gets "email in use"), and local
password hashes are never changed.

Optional overrides: `NEON_AUTH_JWKS_URL`, `NEON_AUTH_JWT_ISSUER`, `NEON_AUTH_JWT_AUDIENCE`
(comma-separated). Defaults: JWKS at `<Auth URL>/.well-known/jwks.json`; issuer and audience
accepted as the Auth URL or its origin. If a real token carries other `iss`/`aud` values, set
these to exactly those values; never loosen them otherwise.

Behavior in neon mode:

- Legacy password/OAuth sessions from earlier modes are not accepted; existing users of those modes
  cannot sign in until migrated (no automatic email linking). Their data stays intact; switching
  `AUTH_MODE` back restores their access.
- Change password runs through Neon (`changePassword`, revoking other sessions) and re-binds this
  device. Local `/api/auth/change-password`, `/forgot-password`, `/reset-password`, password-based
  and OAuth-grant deletion are refused.
- Account deletion requires typing DELETE and re-entering the password: the browser signs in again
  and the API accepts only a Neon session created within the last 5 minutes for the same subject.
  The local account is anonymized; the Neon identity row remains as a tombstone so the same Neon
  user cannot silently re-create a local account. Delete the upstream Neon user from the Neon
  Console if the person asks for full erasure.
- Password reset is not offered in the app yet (Neon's shared SMTP supports codes, not links); the
  forgot-password page points users to the contact page.
- Neon Auth's session cookie lives on the Neon Auth domain. Browsers that block third-party cookies
  can fail to read the session after sign-in; the UI shows a cookie hint. Verify in Safari before
  inviting users.
- Email verification: off by default. If you turn it on in Neon, also set
  `NEON_AUTH_REQUIRE_EMAIL_VERIFIED=true`.

## 4. Optional legacy: Google/GitHub sign-in (`AUTH_MODE=social`)

Only if you switch `AUTH_MODE=social` (change it in `render.yaml` so a Blueprint sync does not reset
it). In that mode at least one complete OAuth pair is required in production, and the Neon Auth
values are ignored. Each pair is all-or-nothing: a half-set pair stops the service on purpose.

GitHub OAuth app:

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
   - Homepage URL: `https://<service>.onrender.com`
   - Authorization callback URL: `https://<service>.onrender.com/api/auth/oauth/github/callback`
2. Generate a client secret. Put both into Render as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Google OAuth client:

1. Google Cloud Console → APIs & Services → **OAuth consent screen**: External, app name
   Portfolab, your support email, scopes `openid`, `email`, `profile` only.
2. **Credentials** → Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origin: `https://<service>.onrender.com`
   - Authorized redirect URI: `https://<service>.onrender.com/api/auth/oauth/google/callback`
3. Put the client ID/secret into Render → Environment as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. While the consent screen is in "Testing", only listed test users can sign in. Publish it for an open beta.

In social mode no email is sent and recovery happens through the **same original** Google or GitHub
account; a different provider account with a matching email is **not** linked.

## 5. Deploy and verify

1. Render → **Manual Deploy** → Deploy latest commit (`autoDeploy` is off).
2. Logs should show `prisma migrate deploy`, `[content] imported ...`, `[api] auth mode: neon`.
3. Check:
   - `https://<service>.onrender.com/api/health` → JSON
   - `https://<service>.onrender.com/api/does-not-exist` → JSON 404
   - `https://<service>.onrender.com/projects/taskflow-lite` → the app (deep link works)
   - `/signup` shows the email/password form + privacy checkbox; `/forgot-password` points to the contact page
   - Sign up with email, sign out, sign in again (also in Safari for the third-party cookie hint)
   - Finish onboarding, complete a checkpoint, download the starter ZIP
   - Account → delete flow: type DELETE → re-enter password → final delete within ~5 minutes
4. Once the Render and Neon regions are chosen, replace the storage-region placeholder in the
   privacy page (`apps/web/src/pages/Legal.tsx`, hosting section).

## If the URL changes

If you rename the service or add a custom domain, add the new origin as a Neon Auth trusted domain
(and update both OAuth callback URLs if you use the legacy social mode). For a custom domain also
set `APP_URL` and `CORS_ORIGINS` to the new `https://` origin.

## Never

- Commit real values or paste them into issues/chats. `SESSION_SECRET` is generated by Render.
- Switch the plan, or add a disk, cron job, or worker — those are paid.
- Use Render Postgres for this beta: its free database expires after a limited period. Use Neon.
