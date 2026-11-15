---
slug: setup-workspace
title: جهز الـ workspace وشغل الـ health check
order: 1
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: services-running
    title: الـ server والـ client شغالين
    instructions: شغل `npm run dev:server` و `npm run dev:client` في terminalين. افتح http://localhost:5174 وتأكد إن صفحة TaskFlow Lite ظهرت.
  - key: health-ok
    title: الـ health check بيرجع ok
    instructions: افتح http://localhost:3001/api/health ولازم تشوف `{"status":"ok","database":"up"}`. وبعدين شغل `npx vitest run test/health.test.js` جوه فولدر `server` ولازم يعدي.
  - key: env-ignored
    title: ملف .env مش داخل Git
    instructions: شغل `git status` واتأكد إن `server/.env` مش ظاهر. لو ظاهر، صلح `.gitignore` قبل أي commit.
---

## الهدف من الدرس

يبقى عندك على جهازك: PostgreSQL شغال، API شغال، frontend شغال، وhealth check بيأكد إن الـ API شايف قاعدة البيانات.

**المتطلبات:** Node.js 20.19 أو أحدث، Git، وDocker Desktop (أو PostgreSQL متسطب عندك).
**الوقت المتوقع:** ساعة (أغلبها تسطيب لو أول مرة).

## المشكلة

أحمد عمل push لملف `.env` فيه باسورد الداتابيز على GitHub public. بعد ساعتين جاله إيميل إن حد بيحاول يدخل. ده بيحصل فعلًا، وفي bots بتدور على secrets في الـ repos العامة طول الوقت.

النهاردة هنجهز الشغل **صح من الأول**.

## الخطوات

### 1. نزل الـ starter

من صفحة **الملفات** (Resources) في المنصة نزل `TaskFlow Lite — Starter repo`، فك الضغط، وافتح الفولدر في VS Code. بعدين:

```bash
git init
git add .
git commit -m "chore: start from TaskFlow Lite starter"
```

### 2. شغل PostgreSQL

الـ starter فيه `docker-compose.yml` بيشغل PostgreSQL على port `5433` (عشان ميتخانقش مع أي PostgreSQL تاني عندك على 5432):

```bash
docker compose up -d db
docker compose ps
```

لازم تشوف الـ container حالته `running`.

### 3. جهز ملفات الـ environment

```bash
cp server/.env.example server/.env
cp server/.env.example server/.env.test
```

افتح `server/.env.test` وغير اسم الداتابيز في آخر `DATABASE_URL` من `taskflow` لـ `taskflow_test`. الـ tests هتمسح البيانات، فلازم تبقى على داتابيز منفصلة.

> **ليه `.env.example` موجود في Git و`.env` لأ؟** الـ example بيوضح **أسماء** المتغيرات من غير **قيم** حقيقية. أي حد يعمل clone يعرف محتاج إيه.

### 4. سطب وشغل

```bash
npm install
npm run dev:server
```

في terminal تاني:

```bash
npm run dev:client
```

### 5. جرب الـ health check

افتح http://localhost:3001/api/health. ده الكود اللي بيرد عليك (موجود جاهز في `server/src/app.js`):

```js
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', database: 'up' })
  } catch {
    res.status(503).json({ status: 'degraded', database: 'down' })
  }
})
```

لاحظ: الـ health check **بيكلم الداتابيز فعلًا**. health check بيرجع ok دايمًا من غير ما يتأكد من حاجة ملوش لازمة. ولاحظ إنه بيرجع JSON مش HTML، وده مهم لما الـ hosting provider يستخدمه.

### 6. شغل أول test

```bash
cd server
npx vitest run test/health.test.js
```

## النتيجة المتوقعة

- http://localhost:5174 بيعرض صفحة TaskFlow Lite (لسه مش شغالة، عادي).
- http://localhost:3001/api/health بيرجع `{"status":"ok","database":"up"}`.
- http://localhost:3001/api/tasks بيرجع `501 Not implemented yet`. ده شغلك في Module 3.

## أخطاء شائعة وإزاي تحلها

| العرض | السبب المحتمل | جرب |
|---|---|---|
| `database: "down"` | Docker مش شغال أو الـ port غلط | `docker compose ps`، وراجع الـ port في `DATABASE_URL` |
| `DATABASE_URL is missing` | مفيش `server/.env` | راجع خطوة 3 |
| `EADDRINUSE :3001` | في process تاني ماسك الـ port | اقفل الـ terminal القديم أو غير `PORT` في `.env` |
| `Tests need a separate database` | `.env.test` بيشاور على داتابيز التطوير | غير اسم الداتابيز لـ `taskflow_test` |

## AI mentor prompt (F07 — Debugging)

لو حاجة مش شغالة، متلصقش الـ error وتقول "صلحه". استخدم ده:

```text
I'm seeing [error] when [steps]. Here are logs and relevant code: [paste, with secrets removed]. Rank likely causes, suggest minimal reproduction, and tell me what to inspect before changing code.
```

**قبل ما تلصق أي log:** امسح الباسوردات والـ connection strings.

## Stretch goal

ضيف script في `package.json` الرئيسي اسمه `dev` بيشغل الاتنين مع بعض. (تلميح: في packages زي `concurrently`، بس اسأل نفسك الأول: هل الـ dependency دي تستاهل؟)

## Git commit

```bash
git add .
git status   # اتأكد إن .env مش موجود!
git commit -m "chore: configure local environment and verify health check"
```
