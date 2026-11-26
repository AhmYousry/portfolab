---
slug: api-contract
title: الـ API contract والـ validation بـ Zod
order: 2
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: contract-written
    title: كتبت الـ API contract
    instructions: '`docs/api.md` فيه الخمس endpoints، ولكل واحد - request، response ناجح، والأخطاء المحتملة بالـ status codes، وشكل الخطأ الموحد.'
  - key: schemas-done
    title: الـ Zod schemas مكتملة
    instructions: '`server/src/tasks/task.schema.js` فيه createTaskSchema وupdateTaskSchema وlistQuerySchema حقيقيين (مفيش `.passthrough()`)، وفحص `node -e` في الدرس بيطبع `false` للعنوان الفاضي.'
  - key: no-defaults-on-update
    title: الـ update schema مبيطبقش defaults
    instructions: '`updateTaskSchema.parse({ title: "Renamed" })` بيرجع `{ title: "Renamed" }` بس (من غير status ولا priority)، وكتبت في `docs/api.md` جملة بتشرح ليه.'
---

## الهدف

تتفق على **شكل الـ API** قبل أي route، وتكتب الـ Zod schemas اللي بتحمي الـ server من أي input غلط.

**هتشوف في الآخر:** في الـ terminal، `false` لما تجرب عنوان فاضي، و`{ title: 'Renamed' }` بس لما تجرب تعديل، من غير ما الـ server يتغير.

**الوقت:** حوالي ساعة.

**الحالة دلوقتي بصراحة:** الـ schemas هتبقى جاهزة، بس `/api/tasks` لسه بيرجع `Not implemented yet`. الـ routes اللي هتستخدم الـ schemas دي في الدرس الجاي.

## الخطوات

### 1. اكتب الـ contract

**فين:** AI chat، بعدين المحرر ← ملف جديد `docs/api.md`.

**إنت تختار:** مثال حقيقي هيتكرر في الـ contract: عنوان مهمة وتاريخ. مثال: `Prepare portfolio README` و`2026-12-15`.

```text prompt=TF05-1
Help me write the API contract for TaskFlow Lite as a Markdown table, before any code. Use my example task: title "{{Your task title}}", dueDate "{{A due date in YYYY-MM-DD}}".

Endpoints (fixed by my acceptance tests):
- GET /api/tasks?status=&priority=&search=&sort= -> 200 {"data": Task[]}, 400 for unknown filter values. sort is one of createdAt, -createdAt, dueDate, -dueDate (default -createdAt).
- GET /api/tasks/:id -> 200 {"data": Task}, 404
- POST /api/tasks -> 201 {"data": Task}, 400
- PATCH /api/tasks/:id -> 200 {"data": Task}, 400 (including an empty body), 404
- DELETE /api/tasks/:id -> 204 with no body, 404
Every error looks like {"error": {"message": "...", "details": [{"field": "...", "message": "..."}]}}.

For each endpoint show: example request, example success response using my task, and one example error. Then explain in 2 lines why create returns 201 and delete returns 204.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, JSON, paths and status codes in English.
- No implementation code yet; contract only.
- Stop at the end and wait for me to verify.
```

**المتوقع:** جدول + أمثلة JSON فيها المهمة بتاعتك.

**اتأكد بنفسك:** الصقه في `docs/api.md`. دور على `201` و`204` و`404` و`400`. لو واحد ناقص، الـ contract ناقص.

**وقف لو:** الـ AI ضاف endpoints زيادة (login, users, tags). امسحها.

### 2. اكتب الـ create والـ update schemas

**فين:** المحرر ← `server/src/tasks/task.schema.js` (فيه TODOs، و`STATUSES` و`PRIORITIES` و`SORTS` و`idSchema` جاهزين).

**إنت تختار:** رسالة الخطأ اللي هتظهر لو العنوان فاضي. لازم تحتوي `title`، والأسهل: `title is required`.

```text prompt=TF05-2
I'm on the "api-contract" step of TaskFlow Lite. Edit only server/src/tasks/task.schema.js (Zod 4). Keep STATUSES, PRIORITIES, SORTS and idSchema as they are.
My error message for an empty title: "{{Your empty-title error message}}".

Replace the two placeholder schemas:
- createTaskSchema: title trimmed, 1..120 chars; description optional, nullable, trimmed, max 2000; status and priority from the lists with defaults TODO and MEDIUM; dueDate optional, nullable, format YYYY-MM-DD and a real date; reject unknown fields with .strict().
- updateTaskSchema: same fields, all optional, NO defaults at all, .strict(), and reject an empty object.
Build both from one shared fields object so the rules live in one place. Explain why update must not reuse the create schema with .partial().

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only this file; leave listQuerySchema for the next step.
- If you can edit my files, show the diff. If you can't, show me exactly what to replace in this one file.
- Don't add dependencies, and never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** مفيش `.passthrough()` في الـ create والـ update، وفي object واحد مشترك للحقول.

**اتأكد بنفسك:** في terminal جوه فولدر `server`:

```bash
node -e "import('./src/tasks/task.schema.js').then((m) => console.log(m.createTaskSchema.safeParse({ title: '' }).success))"
node -e "import('./src/tasks/task.schema.js').then((m) => console.log(m.updateTaskSchema.parse({ title: 'Renamed' })))"
```

الأول لازم يطبع `false`. التاني لازم يطبع `{ title: 'Renamed' }` **بس**. لو شفت `status: 'TODO'` جواه، الـ update schema فيه defaults، وده bug حقيقي (شوف الملاحظات تحت).

**وقف لو:** الأمر طلع `SyntaxError`. اتأكد إنك جوه فولدر `server` وإن الملف اتحفظ.

### 3. اكتب الـ list query schema

**فين:** نفس الملف `server/src/tasks/task.schema.js`، بعدين terminal في `server`.

**إنت تختار:** أقصى طول لكلمة البحث. الافتراضي في الحل المرجعي `100`.

```text prompt=TF05-3
Still in server/src/tasks/task.schema.js for TaskFlow Lite. Replace only the placeholder listQuerySchema.
Max search length I chose: {{Your max search length}}.

Rules for the query string: status optional (one of STATUSES), priority optional (one of PRIORITIES), search optional and trimmed with my max length, sort one of SORTS with default "-createdAt". Unknown values for status, priority or sort must fail so the route can return 400.
Explain why query-string values arrive as strings and why "sort" gets a default but the others don't.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only listQuerySchema in this file.
- If you can edit my files, show the diff. If you can't, show me exactly what to replace.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** `listQuerySchema` بقى schema حقيقي.

**اتأكد بنفسك:** جوه `server`:

```bash
node -e "import('./src/tasks/task.schema.js').then((m) => console.log(m.listQuerySchema.parse({})))"
```

لازم يطبع `{ sort: '-createdAt' }`. ضيف في `docs/api.md` جملة بكلامك: "الـ update schema مفيهوش defaults عشان ...".

**وقف لو:** فتحت `task.routes.js`. ده الدرس الجاي.

```bash
git add docs/api.md server/src/tasks/task.schema.js
git commit -m "feat(api): define task API contract and Zod validation"
```

## ملاحظات تقنية (اختياري)

- **الغلطة اللي وقعنا فيها إحنا:** أول نسخة من الحل المرجعي كانت `updateTaskSchema = createTaskSchema.partial()`. `.partial()` بيخلي الحقول optional، **بس الـ defaults بتفضل شغالة**. فـ `PATCH {title: 'Renamed'}` كان بيرجع المهمة لـ `TODO` من غير ما حد يطلب. الـ test اللي اسمه `only changes the fields that were sent` هو اللي مسكه.
- **`.strict()`:** من غيره حد يبعت `{"isAdmin": true}` أو `{"id": "..."}` والـ server يتجاهله بصمت أو يعدّيه.
- **Validation في الـ server لازم** حتى لو الفورم بيعمل validation؛ أي حد يقدر يبعت request من غير الواجهة.
