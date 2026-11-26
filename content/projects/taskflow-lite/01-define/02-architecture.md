---
slug: architecture
title: الـ Architecture — مين مسؤول عن إيه؟
order: 2
durationMinutes: 40
isPreview: true
status: PUBLISHED
checkpoints:
  - key: explain-layers
    title: أقدر أشرح مسؤولية الـ client والـ API والـ DB
    instructions: تقدر تقول بصوت عالي جملة لكل طبقة (React client / Express API / PostgreSQL) - هي مسؤولة عن إيه و**مش** مسؤولة عن إيه. اكتبهم في نفس الـ notes بتاعة الدرس اللي فات؛ لسه مش محتاج ملف في repo.
  - key: data-flow
    title: رسمت رحلة طلب "إضافة task"
    instructions: رسمت على ورقة (أو كتبت كخطوات مرقمة) رحلة الطلب من الضغط على "Add task" لحد ما الـ task تظهر في الليستة، وفيها `POST /api/tasks` والـ status code `201` (وكمان `400` لو العنوان فاضي).
  - key: tradeoff
    title: كتبت tradeoff واحد
    instructions: كتبت قرار تقني واحد وبديله والسبب في جملة، مثلًا "PostgreSQL بدل localStorage لأن ...".
---

## الهدف

تفهم ليه التطبيق متقسم 3 طبقات، وترسم رحلة طلب واحد من الزرار لحد الداتابيز ورجوعًا.

**هتشوف في الآخر:** رسمة على ورقة فيها 3 صناديق (React ← Express ← PostgreSQL) وأسهم مرقمة لرحلة "Add task"، وجملة tradeoff واحدة.

**الوقت:** حوالي 40 دقيقة. **مش محتاج:** كود أو repo لسه.

الصورة اللي هنوصلها (الأرقام دي هي الـ ports اللي هتشوفها فعلًا في الـ starter الدرس الجاي):

```text
[ Browser: React ]  --HTTP JSON-->  [ Express API ]  --Prisma-->  [ PostgreSQL ]
   localhost:5174                    localhost:3001               localhost:5433
```

## الخطوات

### 1. افهم الطبقات التلاتة

**فين:** AI chat (نفس محادثة الدرس اللي فات لو موجودة).

**إنت تختار:** إنت فاكر الـ validation (التأكد إن العنوان مش فاضي) مكانه فين. اكتب تخمينك حتى لو مش متأكد: `only in React`، `only in Express`، أو `both`.

```text prompt=TF02-1
I'm planning TaskFlow Lite (single user): React client on port 5174, Express API on port 3001, PostgreSQL on port 5433, using Prisma.
My guess for where "title must not be empty" should be checked: {{Your guess: React, Express, or both}}.

For each of the 3 layers, give me one line "responsible for" and one line "NOT responsible for".
Then tell me if my guess is right, and why, using one example where someone skips the React UI completely.
Finally, name 2 things beginners add to an app like this that it does NOT need (for example microservices or caching).

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet. Keep it short.
- Stop at the end and wait for my reply.
```

**المتوقع:** 6 سطور (2 لكل طبقة)، وتصحيح لتخمينك. الإجابة الصح: **الاتنين**؛ React عشان راحة المستخدم، وExpress عشان الأمان.

**اتأكد بنفسك:** غطي رد الـ AI وقول من دماغك جملة لكل طبقة. لو اتلخبطت في طبقة، ارجع اقراها.

**وقف لو:** الـ AI بدأ يشرح Docker وKubernetes وqueues. قوله: `Keep it to the 3 layers only.`

### 2. ارسم رحلة "Add task"

**فين:** ورقة وقلم.

**إنت تختار:** عنوان مهمة حقيقية من حياتك هتمشي بيها الرحلة. مثال: `Submit CV to 3 companies`.

```text prompt=TF02-2
Walk me through what happens when I type the task title "{{Your task title}}" in TaskFlow Lite and press "Add task".
Give me 7 to 9 numbered steps from the browser to PostgreSQL and back. Mention the HTTP method and path (POST /api/tasks), the JSON body, the success status code (201) and the response shape {"data": {...}}.
Then add a short second path: what happens if the title is empty (400 with an error message), and which layer stops it.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet. Keep it short.
- Stop at the end and wait for my reply.
```

**المتوقع:** خطوات مرقمة زي: React يتأكد ← يبعت `POST /api/tasks` ← Express يعمل validation ← Prisma يحفظ ← PostgreSQL يرجع الصف ← `201` ← الليستة تتحدث.

**اتأكد بنفسك:** ارسم الخطوات كأسهم بين الـ 3 صناديق على الورقة. لازم تلاقي على الأسهم `POST`، `201`، و`400`.

**وقف لو:** مش فاهم خطوة. اسأل عنها هي بس: `Explain step 5 only, with an everyday example.`

### 3. اختار tradeoff واحد ودافع عنه

**فين:** AI chat، وبعدين الـ notes بتاعتك.

**إنت تختار:** قرار واحد من دول: `PostgreSQL instead of localStorage`، `Express instead of a full framework`، أو `Prisma instead of raw SQL`.

```text prompt=TF02-3
Act as a friendly interviewer. I chose this for TaskFlow Lite: {{Your decision, e.g. PostgreSQL instead of localStorage}}.
Ask me ONE question about why. Wait for my answer. Then tell me what was good in my answer and give me a better one-sentence version I can say in an interview.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet.
- Ask your question, then stop and wait for my reply.
```

**المتوقع:** سؤال واحد، تجاوب إنت، وبعدين جملة محسنة.

**اتأكد بنفسك:** اكتب الجملة النهائية في الـ notes بكلامك إنت، مش نسخ.

**وقف لو:** الـ AI جاوب مكانك قبل ما تكتب. قوله: `Wait for my answer first.`

## خلصت الدرس لما

- تقدر تشرح الـ 3 طبقات من غير ما تبص.
- عندك رسمة رحلة "Add task" فيها `POST` و`201` و`400`.
- عندك جملة tradeoff واحدة بكلامك.

الدرس الجاي هتنزل الـ starter وهتشوف الـ ports دي شغالة بعينك.

## ملاحظات تقنية (اختياري)

- **localStorage مش غلط**، بس البيانات بتعيش في متصفح واحد وبتضيع لو مسحت الـ browser data. الداتابيز بتعيش برا المتصفح.
- **ليه Prisma؟** بيبعت القيم كـ parameters منفصلة عن الـ SQL، فبيحميك من SQL injection في الـ queries العادية.
- **لو المشروع بقى لأكتر من مستخدم:** هتحتاج auth، وكل task هيبقى ليها `userId`، وكل query لازم يفلتر بيه.
