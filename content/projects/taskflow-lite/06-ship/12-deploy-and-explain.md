---
slug: deploy-and-explain
title: Deploy، README، واشرح مشروعك
order: 2
durationMinutes: 90
status: PUBLISHED
checkpoints:
  - key: readme
    title: README كامل
    instructions: '`README.md` في فولدر المشروع الرئيسي بقى بتاعك (مش README الـ starter)، وفيه - سطر وصف، screenshot، architecture، API، Run locally من الصفر، Tests، Deployment (أو "not deployed")، Known limitations، وWhat I learned.'
  - key: clean-install
    title: Clean install شغال
    instructions: عملت clone للـ repo في فولدر جديد واتبعت الـ README حرفيًا لحد ما http://localhost:5174 اشتغل و`npm test` عدى. أي خطوة احتجتها ومش مكتوبة ضفتها للـ README.
  - key: public-repo
    title: الـ repo على GitHub بشكل آمن
    instructions: عملت push للـ repo على GitHub (public أو private، قرارك) بعد checkpoint الـ secrets في الدرس اللي فات، و`server/.env` مش ظاهر في صفحة الـ repo. حط اللينك في صفحة حسابك على المنصة لو حابب.
  - key: interview-answers
    title: جاوبت على 5 أسئلة إنترفيو
    instructions: استخدمت prompt `TF12-4` وجاوبت على الخمس أسئلة كتابة في `docs/interview-notes.md` بكلامك.
---

## الهدف

أي حد يقدر يشغل مشروعك من الـ README لوحده، والكود على GitHub، وإنت جاهز تشرح قراراتك.

**هتشوف في الآخر:** صفحة الـ repo على GitHub بالـ README والـ screenshot بتاعك، ونسخة جديدة من المشروع اشتغلت من الصفر على جهازك باتباع الـ README بس.

**الوقت:** حوالي ساعة ونص.

**النشر أونلاين (deploy) اختياري.** الـ checkpoints كلها تتعمل من غيره. ومش محتاج كارت ولا domain ولا أي اشتراك مدفوع.

## الخطوات

### 1. اكتب الـ README بتاعك

**فين:** المتصفح ← صفحة الملفات (نزل **Portfolio README template**)، بعدين AI chat، بعدين المحرر ← `README.md` في فولدر المشروع الرئيسي (هتستبدل README الـ starter).

**إنت تختار:** جملة واحدة بتوصف التطبيق، وأصعب bug قابلك. مثال: `A single-user task manager with a validated REST API and tests` و`PATCH was resetting status because of Zod defaults`.

```text prompt=TF12-1
Help me fill the README template for my TaskFlow Lite project (React + Vite on 5174, Express 5 API on 3001, PostgreSQL 16 in Docker on 5433, Prisma, Zod, Vitest + Supertest).
What my app does in one sentence: {{One sentence about what your app does}}.
The hardest bug I fixed: {{The hardest bug you fixed}}.

Use these real commands for "Run locally": docker compose up -d db; copy server/.env.example to server/.env and server/.env.test (test DB name taskflow_test); npm install; npm run db:deploy --workspace server (applies the committed migrations); npm run dev:server; npm run dev:client. Tests: npm test from the root.
Write the README sections in English: one-line summary, screenshot placeholder, architecture (3 layers), API table, run locally, tests, deployment ("not deployed yet" is fine), known limitations (I'll paste mine), what I learned (3 honest bullets from my bug).

Rules for your answer:
- Explain your choices in simple Egyptian Arabic, but write the README itself in English.
- Do this step only. Touch only README.md; don't invent features, numbers or users I don't have.
- If you can edit my files, show the diff. If you can't, give me the final README content.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** README فيه الأقسام كلها، وكلامه عن مشروعك إنت.

**اتأكد بنفسك:** خد screenshot للصفحة على 5174 وفيها مهام، حطها في `docs/screenshot.png`، واربطها في الـ README. افتح الـ README في معاينة المحرر (Markdown preview) واتأكد إن الصورة ظاهرة.

**وقف لو:** لقيت "scalable" أو "enterprise" أو "production-ready". امسحها. الإنترفيور هيسأل.

### 2. ارفع الـ repo على GitHub

**فين:** المتصفح ← github.com (repo جديد **فاضي** من غير README)، بعدين terminal في فولدر المشروع الرئيسي.

**إنت تختار:** الـ repo `public` ولا `private`. الـ public أحسن للبورتفوليو، والاتنين مجانيين.

```text prompt=TF12-2
I created an empty GitHub repository for TaskFlow Lite and want to push my local project for the first time.
Visibility I chose: {{Public or private repo}}. My operating system: {{Your operating system}}.

Give me the exact commands, in order, to run from the project root: check git status first, rename the branch to main if needed, add the remote (use YOUR-USERNAME/YOUR-REPO as a placeholder), and push. Tell me what to check on the GitHub page afterwards to be sure server/.env and server/.env.test are not there. If git asks for a password, explain the free options (browser sign-in or a personal access token) without asking me to paste any token here.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep commands in English.
- Don't suggest force-push.
- Never ask for tokens or passwords, and never say you ran something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** صفحة الـ repo فيها الكود والـ README بتاعك.

**اتأكد بنفسك:** على GitHub افتح فولدر `server`. هتلاقي `.env.example` بس.

**وقف لو:** شايف `.env` على GitHub. اتبع خطوة 1 من الدرس اللي فات فورًا (غيّر الباسورد لو حقيقي).

### 3. Clean install من الصفر

**فين:** terminal في فولدر **جديد** برا المشروع، بعدين المتصفح.

**إنت تختار:** اسم الفولدر الجديد. مثال: `taskflow-clean-test`.

قبل ما تبدأ: من فولدر المشروع **القديم** شغل `docker compose down` (من غير `-v`، فبياناتك هتفضل موجودة). كده الـ port `5433` يفضى للنسخة الجديدة.

```text prompt=TF12-3
I'm doing a clean-install test of my TaskFlow Lite README: clone into a new folder and follow the README exactly.
New folder name: {{Your clean-test folder name}}.
The first step that failed or was missing from my README (or "none"): {{The step that failed, without secrets}}.

If something failed: explain why in simple words and give me the exact sentence or command to ADD to README.md so the next person doesn't hit it. If nothing failed: give me a 5-item checklist to confirm the clean copy really works (page on 5174, health on 3001, add a task, refresh, npm test).

Rules for your answer:
- Explain in simple Egyptian Arabic; keep commands and file paths in English.
- Only suggest README changes; don't change source code.
- Never say you ran something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** النسخة الجديدة بتشتغل بالـ README بس: صفحة 5174، health ok، و`npm test` أخضر.

**اتأكد بنفسك:** كل خطوة عملتها ومش مكتوبة = bug في الـ README. ضيفها، واعمل commit وpush من فولدر المشروع الأصلي.

**وقف لو:** حاجة اشتغلت بس لأنها موجودة على جهازك من قبل (زي `.env` قديم). اكتبها في الـ README.

### 4. جهز نفسك للإنترفيو

**فين:** AI chat، بعدين المحرر ← ملف جديد `docs/interview-notes.md`.

**إنت تختار:** نوع الوظيفة اللي بتقدم عليها. أمثلة: `junior full-stack developer`، `junior backend developer`، `frontend intern`.

```text prompt=TF12-4
Act as a technical interviewer for a {{The role you are applying for}} position. My project is TaskFlow Lite (React, Express 5, PostgreSQL, Prisma, Zod, Vitest + Supertest). Here is my README:
{{Paste your README}}

Ask me 5 questions about WHY I made my decisions (for example: routes vs service split, what happens if the database is down, validation on both client and server, what changes for multiple users, the hardest bug). Ask ONE question at a time and wait for my answer. After each answer, tell me what was strong, what was missing, and give a better 2-sentence version without exaggerating what I did.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- Don't answer for me and don't invent experience I didn't mention.
- Ask the first question, then stop and wait for my reply.
```

**المتوقع:** 5 أسئلة، واحد ورا التاني، وتعليق بعد كل إجابة.

**اتأكد بنفسك:** اكتب الإجابات النهائية بكلامك في `docs/interview-notes.md`. قولها بصوت عالي مرة من غير ما تقرا.

**وقف لو:** الـ AI بيكتب الإجابات مكانك. قوله: `Wait for my answer first.`

```bash
git add README.md docs
git commit -m "docs: write portfolio README and interview notes"
git push
```

## اختياري: انشره أونلاين

مش مطلوب لأي checkpoint. لو provider طلب كارت أو domain وإنت مش عايز، **وقف**؛ المشروع على GitHub كفاية للبورتفوليو. الـ free tiers بتتغير، فاقرا صفحة الأسعار بنفسك قبل أي تسجيل.

أي provider محتاج نفس الحاجات: PostgreSQL أونلاين، Node service للـ API بالـ env vars (`DATABASE_URL`، `CLIENT_ORIGIN`، `PORT`) وrelease step بيشغل `npm run db:deploy --workspace server` (مش `migrate dev`)، وstatic build للـ client بـ `VITE_API_URL` بيشاور على الـ API، وhealth check على `/api/health`.

```text prompt=TF12-opt
I want to deploy TaskFlow Lite as an optional demo, only on free plans that do not require a credit card.
Provider(s) I'm considering: {{Provider names you are considering}}.

Using only what the provider's own docs say today, give me a checklist: where the database lives, the API service settings (build command, start command "npm start --workspace server", env vars DATABASE_URL, CLIENT_ORIGIN, PORT), the release command "npm run db:deploy --workspace server", the static client build with VITE_API_URL, and how to confirm /api/health returns JSON. Tell me clearly if a step needs a card or a paid plan so I can stop. Remind me that my public demo has no login.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep commands, env var names and settings in English.
- Don't change source code; if the provider needs a config file, tell me its exact content as one file and wait.
- Don't promise free limits you are not sure about, never ask me to paste secrets, and never say you deployed or ran anything.
- Stop and wait for me to verify.
```

## خلصت!

لو عديت كل الـ checkpoints، إنت بنيت مشروع full stack حقيقي، مختبر، وموثق، وبتقدر تشرح كل قرار فيه.
