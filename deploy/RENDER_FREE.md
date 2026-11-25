# Portfolab beta on Render Free + Neon Free (zero cost)

<div dir="rtl">

## بداية سريعة (عندك حساب GitHub بس)

1. **Neon:** ادخل [neon.tech](https://neon.tech) واختار **Continue with GitHub**. اعمل project جديد
   على الخطة **Free**، واختار region قريبة من الـ region اللي هتختارها على Render. من **Connect**
   اختار **Prisma** وانسخ الرابطين (pooled و direct). متشاركهمش مع حد.
2. **Render:** ادخل [render.com](https://render.com) واختار **Sign in with GitHub**. أول ما يطلب
   صلاحية على الـ repositories، اختار **Only select repositories** وحدد repo بتاع Portfolab بس
   (لو فاتتك: Account Settings → GitHub → Configure).
3. **Blueprint:** Render → **New** → **Blueprint** → اختار الـ repo. هيقرا `render.yaml` (web service
   واحد `plan: free`). حط الرابطين في `DATABASE_URL` و `DIRECT_DATABASE_URL`، وسيب قيم OAuth فاضية
   دلوقتي. أول deploy هيفشل وده متوقع لحد ما تحط OAuth.
4. **GitHub OAuth الأول:** من GitHub → Settings → Developer settings → OAuth Apps اعمل app جديد
   بالـ callback `https://<service>.onrender.com/api/auth/oauth/github/callback`، وحط
   `GITHUB_CLIENT_ID` و `GITHUB_CLIENT_SECRET` في Render → Environment. Google ممكن تضيفه بعدين
   (قسم 4 تحت) من غير ما تغير أي حاجة تانية.
5. **Manual Deploy**، وبعدين اعمل الـ checks اللي في قسم 5.

متدفعش حاجة: متغيرش الخطة، ومتضيفش disk أو cron أو worker، ومتحطش كارت.

</div>

One Render **Free** web service runs the API and serves the built React app from the same origin.
Data lives in a Neon **Free** Postgres project. No purchased domain, no mail provider, no paid
resources. Sign-in is Google/GitHub only (`AUTH_MODE=social`). The VPS path (`deploy/compose.yml`,
`deploy/RUNBOOK.md`) is unchanged and still optional.

## What you get / free-tier limits

- URL: `https://<service>.onrender.com` (Render picks `<service>`; it may add a suffix if the name is taken).
- The service sleeps after ~15 minutes without traffic; the next request waits for a cold start
  (about a minute, plus migrations + content import on every start).
- The filesystem is ephemeral. Everything that must persist (users, sessions, progress) is in Neon;
  lessons, resources, and starter ZIPs are rebuilt from the repo on every start.
- Free instance hours, Neon storage, and Neon compute are capped monthly. Check the current
  numbers on the Render and Neon pricing pages before inviting many users.
- No email is ever sent. Account recovery happens through the provider account the user signed up
  with: they must regain access to that **same original** Google or GitHub account (via Google/GitHub
  recovery). A different provider account with a matching email is **not** linked, and there is no
  manual "claim my account" recovery in the app.
- Analytics stay off (no PostHog keys set).

## 1. Neon

1. Sign in with GitHub and create a Neon project (Free plan). Pick the region closest to your Render region.
2. Open **Connect**, choose **Prisma**, and copy both strings:
   - pooled (`...-pooler...`) → `DATABASE_URL`
   - direct (no `-pooler`) → `DIRECT_DATABASE_URL` (`DATABASE_URL_UNPOOLED`, the name `neon init`
     uses, is accepted as a fallback)
3. Keep `sslmode=require`. Adding `connect_timeout=15` helps when the Neon compute is waking up.

## 2. Render (Blueprint)

1. Sign in to Render with GitHub and grant the Render GitHub app access to this repository only
   (Account Settings → GitHub → Configure if you skipped it).
2. Render → **New** → **Blueprint** → select this repository. Render reads `render.yaml`
   (one web service, `plan: free`).
3. When asked for the `sync: false` values, paste `DATABASE_URL` and `DIRECT_DATABASE_URL`.
   Leave the four OAuth values empty for now if you do not have them yet.
4. After the service is created, copy its URL from the dashboard: `https://<service>.onrender.com`.
   `APP_URL` and `CORS_ORIGINS` default to this URL automatically (`RENDER_EXTERNAL_URL`).
5. The first deploy is **expected to fail at start** until at least one OAuth pair exists:
   `AUTH_MODE=social requires at least one complete OAuth pair ... in production`.

## 3. GitHub OAuth app (start here)

1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App.
   - Homepage URL: `https://<service>.onrender.com`
   - Authorization callback URL: `https://<service>.onrender.com/api/auth/oauth/github/callback`
2. Generate a client secret. Put both into Render as `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

## 4. Google OAuth client (optional, add later)

1. Google Cloud Console → APIs & Services → **OAuth consent screen**: External, app name
   Portfolab, your support email, scopes `openid`, `email`, `profile` only.
2. **Credentials** → Create credentials → OAuth client ID → **Web application**.
   - Authorized JavaScript origin: `https://<service>.onrender.com`
   - Authorized redirect URI: `https://<service>.onrender.com/api/auth/oauth/google/callback`
3. Put the client ID/secret into Render → Environment as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
4. While the consent screen is in "Testing", only listed test users can sign in. Publish it for an open beta.

Each pair is all-or-nothing: a half-set pair stops the service on purpose.

## 5. Deploy and verify

1. Render → **Manual Deploy** → Deploy latest commit (`autoDeploy` is off).
2. Logs should show `prisma migrate deploy`, `[content] imported ...`, `[api] auth mode: social`.
3. Check:
   - `https://<service>.onrender.com/api/health` → JSON
   - `https://<service>.onrender.com/api/does-not-exist` → JSON 404
   - `https://<service>.onrender.com/projects/taskflow-lite` → the app (deep link works)
   - `/signup` shows only the privacy checkbox + Google/GitHub buttons; `/forgot-password` explains social sign-in
   - Sign up, finish onboarding, complete a checkpoint, download the starter ZIP
   - Account → delete flow: type DELETE → confirm with your provider → final delete within ~5 minutes
4. Once the Render and Neon regions are chosen, replace the storage-region placeholder in the
   privacy page (`apps/web/src/pages/Legal.tsx`, social mode hosting section).

## If the URL changes

If you rename the service or add a custom domain, update both OAuth callback URLs. For a custom
domain also set `APP_URL` and `CORS_ORIGINS` to the new `https://` origin.

## Never

- Commit real values or paste them into issues/chats. `SESSION_SECRET` is generated by Render.
- Switch the plan, or add a disk, cron job, or worker — those are paid.
- Use Render Postgres for this beta: its free database expires after a limited period. Use Neon.
