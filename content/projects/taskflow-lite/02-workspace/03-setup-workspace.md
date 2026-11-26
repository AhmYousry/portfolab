---
slug: setup-workspace
title: جهز الـ workspace وشغل الـ health check
order: 1
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: services-running
    title: الـ client والـ server شغالين
    instructions: من فولدر المشروع الرئيسي شغلت `npm run dev:client` في terminal و`npm run dev:server` في terminal تاني. http://localhost:5174 بيعرض عنوان "TaskFlow Lite" وتحته "Starter — follow the lessons to make this work."
  - key: health-ok
    title: الـ health check بيرجع ok
    instructions: http://localhost:3001/api/health بيرجع `{"status":"ok","database":"up"}`. وجوه فولدر `server` الأمر `npx vitest run test/health.test.js` بيعدي (1 passed).
  - key: env-ignored
    title: ملف .env مش داخل Git
    instructions: من فولدر المشروع الرئيسي `git status` مش بيظهر فيه `server/.env` ولا `server/.env.test`. لو ظهروا، وقف ومتعملش commit لحد ما تصلح `.gitignore`.
---

## الهدف

تشغل الـ starter على جهازك بأسرع طريقة: الواجهة الأول، بعدين الداتابيز والـ API.

**هتشوف في الآخر:**

- http://localhost:5174 ← صفحة TaskFlow Lite (فورم وفلاتر، **لسه مش بتحفظ حاجة**، ده طبيعي).
- http://localhost:3001/api/health ← `{"status":"ok","database":"up"}`.
- http://localhost:3001/api/tasks ← رسالة `Not implemented yet`. ده شغلك في Module 3.

**الوقت:** حوالي ساعة (أغلبها تسطيب لو أول مرة).

**محتاج متسطب:** Node.js 22 LTS، Git، وDocker Desktop (مجاني للاستخدام الشخصي). كلهم مجانيين ومفيش أي اشتراك مطلوب.

> **على Windows:** أوامر `npm` و`git` و`docker` تشتغل عادي في PowerShell أو terminal الـ VS Code. الأوامر اللي فيها `curl` (في دروس جاية) شغلها في **Git Bash** اللي بيتسطب مع Git.

> **قاعدة أمان:** عمرك ما تلصق محتوى `.env` أو أي باسورد أو connection string في الـ AI. لو هتلصق error، شيل منه أي حاجة شبه `postgresql://...`.

## الخطوات

### 1. نزل الـ starter وافتحه

**فين:** المتصفح ← صفحة **الملفات** في المنصة، بعدين المحرر، بعدين terminal في فولدر المشروع.

**إنت تختار:** نظام التشغيل والمحرر بتوعك. الافتراضي في الدروس: `Windows 11` و`VS Code`.

1. نزل **Starter repo (with TODOs)** وفك الضغط في فولدر مسارُه قصير ومن غير مسافات، مثلًا `C:\dev\taskflow-lite` أو `~/dev/taskflow-lite`.
2. افتح الفولدر ده في المحرر. ده "فولدر المشروع الرئيسي" في كل الدروس الجاية.
3. افتح terminal **في الفولدر ده** وشغل:

```bash
node -v
git init
git add .
git commit -m "chore: start from TaskFlow Lite starter"
```

```text prompt=TF03-1
I just downloaded the TaskFlow Lite starter (an npm workspaces repo with "client" and "server" folders) and opened it.
My operating system: {{Your operating system}}. My editor: {{Your code editor}}.
`node -v` printed: {{Your node -v output}}.

Tell me:
1. Is my Node version OK for Vite 7 and Prisma 6? If not, how to install Node 22 LTS for free on my OS.
2. How to open a terminal inside the project folder in my editor, and how to tell which folder it is in.
3. What `git init`, `git add .` and `git commit` just did, in 3 short lines.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Don't change any files.
- Tell me exactly what to run, in which folder, and what I should see.
- Never say you ran something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** `node -v` بيطبع `v22.x` (أو أحدث)، والـ commit اتعمل.

**اتأكد بنفسك:** `git log --oneline` بيعرض سطر واحد فيه `start from TaskFlow Lite starter`.

**وقف لو:** `node` أو `git` مش معروفين. سطبهم الأول وافتح terminal جديد.

### 2. شغل الواجهة الأول

**فين:** terminal في فولدر المشروع الرئيسي، بعدين المتصفح.

**إنت تختار:** ولا حاجة هنا. ركز إنك تشوف الصفحة.

```bash
npm install
npm run dev:client
```

سيب الـ terminal ده مفتوح وافتح http://localhost:5174.

```text prompt=TF03-2
I ran `npm install` then `npm run dev:client` in the root of the TaskFlow Lite starter and opened http://localhost:5174.
What I see on the page: {{Describe what you see in the browser}}.

Explain:
1. Why the page loads even though the API and database are not running yet.
2. Which file draws the heading and which file draws the "New task" form (paths only).
3. Why pressing "Add task" does not save anything yet, and where I can see the "TODO save" message.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Don't change any files.
- Never say you ran or opened something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** عنوان **TaskFlow Lite**، تحته `Starter — follow the lessons to make this work.`، فورم **New task** فيه Title وزرار **Add task**، فلاتر (Search / Status / Priority / Sort)، والجملة `TODO: empty state`.

**اتأكد بنفسك:** اضغط **Add task**. مفيش حاجة هتظهر في الصفحة. افتح DevTools (F12) ← Console، هتلاقي `TODO save`. ده معناه إن الزرار شغال بس الحفظ لسه مش متنفذ؛ ده بالظبط الحالة الصح للـ starter.

**وقف لو:** الصفحة بيضا أو الـ terminal فيه error أحمر. استخدم prompt "لو اتزنقت" تحت.

### 3. شغل الداتابيز والـ API

**فين:** Docker Desktop مفتوح، terminal **تاني** في فولدر المشروع الرئيسي، بعدين المحرر، بعدين المتصفح.

**إنت تختار:** هتشغل PostgreSQL إزاي. الافتراضي والأسهل: `Docker Desktop`. لو عندك PostgreSQL متسطب بالفعل وعايز تستخدمه، اكتب كده في الـ prompt وهو هيقولك تغير إيه.

```bash
docker compose up -d db
docker compose ps
```

لازم الـ `db` يبقى `running`. بعدين انسخ ملفات الـ environment:

```bash
# Windows PowerShell
Copy-Item server/.env.example server/.env
Copy-Item server/.env.example server/.env.test

# macOS / Linux / Git Bash
cp server/.env.example server/.env
cp server/.env.example server/.env.test
```

افتح `server/.env.test` في المحرر وغير **اسم الداتابيز بس** في **آخر** `DATABASE_URL` (الكلمة اللي بعد آخر `/`) من `taskflow` لـ `taskflow_test`. **متغيرش** الـ username اللي قبل `@`، ولا الباسورد، ولا الـ port. متعملش find/replace على كل كلمة `taskflow` في السطر، لأن ده بيغير الـ username كمان والـ tests هتفشل. الداتابيز دي اتعملت أوتوماتيك أول مرة Docker شغل الـ `db`، والـ tests بتمسح بياناتها، فلازم تبقى منفصلة عن بيانات التطوير.

وبعدين:

```bash
npm run dev:server
```

```text prompt=TF03-3
I'm setting up the TaskFlow Lite API. How I run PostgreSQL: {{Docker Desktop or local PostgreSQL}}.
The starter's docker-compose.yml maps PostgreSQL to port 5433 and creates two databases: "taskflow" and "taskflow_test". I copied server/.env.example to server/.env and server/.env.test, and changed the database name in .env.test to taskflow_test. I will NOT paste my .env files.

Explain:
1. Why tests need a separate database, in 2 lines.
2. What `npm run dev:server` does (which file it runs, which port).
3. What I should see at http://localhost:3001/api/health and at http://localhost:3001/api/tasks right now, and why /api/tasks returns 501.
If I use local PostgreSQL instead of Docker, give me the exact lines to change, using placeholders instead of real passwords.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Don't edit any file except the ones I named.
- Tell me exactly what to run, in which folder, and what I should see.
- Never ask me to paste secrets, and never say you ran something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الـ terminal بيطبع `TaskFlow API running on http://localhost:3001`.

**اتأكد بنفسك:** في المتصفح:

- http://localhost:3001/api/health ← `{"status":"ok","database":"up"}`
- http://localhost:3001/api/tasks ← `{"error":{"message":"Not implemented yet — this is your job in Module 3"}}`

التانية دي **مش** غلط؛ ده الـ TODO بتاعك. الواجهة على 5174 لسه زي ما هي، لأنها مش بتطلب المهام من الـ API لحد Module 4.

**وقف لو:** شفت `database: "down"` أو `DATABASE_URL is missing`. متعدلش كود؛ استخدم prompt "لو اتزنقت".

### 4. أول test، واتأكد إن الأسرار برا Git

**فين:** terminal في فولدر `server`، بعدين نفس الـ terminal في فولدر المشروع الرئيسي.

**إنت تختار:** تنقل الـ notes بتاعة درس 1 و2 للـ repo ولا لأ (مُستحسن). لو آه، اعمل ملف `docs/plan.md` والصق فيه الـ stories والـ out of scope والـ tradeoff.

```bash
cd server
npx vitest run test/health.test.js
cd ..
git status
```

```text prompt=TF03-4
I ran the health test of the TaskFlow Lite starter from the "server" folder and then `git status` from the root.
Test summary line I got: {{Paste the test summary line}}.
Files listed by git status: {{Paste the file names from git status}}.

Explain:
1. What this health test proves, and why it talks to the real test database.
2. Whether any file in my git status list must NOT be committed, and why .env.example is safe but .env is not.
3. The exact git commands to commit only safe files.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Don't change any files.
- Tell me exactly what to run and in which folder.
- Never say you ran something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** `1 passed`، و`git status` **مش** فيه `server/.env` ولا `server/.env.test` (الـ `.gitignore` اللي في الـ starter بيخفيهم). بعدين من فولدر المشروع الرئيسي:

```bash
git add .
git commit -m "chore: configure local environment and verify health check"
```

**اتأكد بنفسك:** شغل `git ls-files server`. هتلاقي `server/.env.example`، ومفيش `server/.env` ولا `server/.env.test`.

**وقف لو:** `.env` ظاهر في `git status`. متعملش commit لحد ما تصلح الموضوع.

## لو اتزنقت

```text prompt=TF03-help
I'm setting up the TaskFlow Lite starter on {{Your operating system}}.
The command I ran and the folder I ran it in: {{The command and the folder}}.
The error (passwords and connection strings removed): {{Paste the error without secrets}}.

Rank the 3 most likely causes. For each one, tell me ONE thing to check first and what I should see if that is the cause. Don't suggest deleting Docker volumes, reinstalling everything, or editing source code.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Tell me exactly what to run, in which folder, and what I should see.
- Never say you ran something you didn't.
- Stop after the 3 causes and wait for my result.
```

أشهر الأسباب: Docker Desktop مقفول، الـ terminal في فولدر غلط، أو process قديم ماسك port `3001` أو `5174` (اقفل الـ terminal القديم).

## ملاحظات تقنية (اختياري)

- الـ health check في `server/src/app.js` **بيكلم الداتابيز فعلًا** (`SELECT 1`) وبيرجع `503` لو مش شايفها. health check بيرجع ok دايمًا ملوش لازمة.
- `server/vitest.config.js` بيرفض يشتغل لو `DATABASE_URL` في `.env.test` مفيهوش كلمة `test`. ده حماية عشان التستات متمسحش بيانات التطوير.
- Port الداتابيز `5433` مش `5432` عشان ميتخانقش مع أي PostgreSQL تاني عندك.
