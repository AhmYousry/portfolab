---
slug: data-model
title: صمم الـ data model بـ Prisma
order: 1
durationMinutes: 50
status: PUBLISHED
checkpoints:
  - key: task-model
    title: الـ Task model والـ enums موجودين
    instructions: '`server/prisma/schema.prisma` فيه enum `TaskStatus` (TODO, IN_PROGRESS, DONE) وenum `TaskPriority` (LOW, MEDIUM, HIGH) وmodel `Task` فيه id, title, description, status, priority, dueDate, createdAt, updatedAt.'
  - key: migration-applied
    title: الـ migration اتعملت وظاهرة في Prisma Studio
    instructions: من فولدر المشروع الرئيسي شغلت `npm run db:migrate --workspace server -- --name add-task`، ولقيت فولدر جديد جوه `server/prisma/migrations` (لازم يدخل Git)، وجدول `Task` ظاهر في Prisma Studio على http://localhost:5555.
  - key: justify-fields
    title: بررت كل حقل
    instructions: في `docs/data-model.md` جدول فيه لكل حقل - نوعه، required ولا لأ، الـ default، وسبب في سطر.
---

## الهدف

تعمل جدول `Task` حقيقي في PostgreSQL، وتشوفه بعينك، وتقدر تبرر كل حقل فيه.

**هتشوف في الآخر:** Prisma Studio في المتصفح على http://localhost:5555 فيه جدول **Task** فاضي (0 records) بالأعمدة اللي اخترتها.

**الوقت:** حوالي 50 دقيقة.

**الحالة دلوقتي بصراحة:** http://localhost:3001/api/tasks هيفضل يرجع `Not implemented yet` حتى بعد الدرس ده. الجدول هيبقى موجود، بس الـ routes لسه في Module 3 الدرس التالت.

**ثوابت لازم تلتزم بيها** (الـ acceptance tests في `server/test/tasks.test.js` بتعتمد عليها):

- `id` لازم يبقى **string** (مش رقم بيزيد).
- `title` أقصاه 120 حرف. `description` اختياري.
- `status` الافتراضي `TODO`، و`priority` الافتراضي `MEDIUM`.
- `dueDate` اختياري وتاريخ بس من غير وقت.

## الخطوات

### 1. قرر الحقول وبررها

**فين:** AI chat، بعدين المحرر ← ملف جديد `docs/data-model.md`.

**إنت تختار:** حقل زيادة نفسك تضيفه (مثلًا `tags` أو `category` أو `reminderAt`). الـ AI هيقولك تضيفه دلوقتي ولا لأ وليه.

```text prompt=TF04-1
I'm designing the Task table for TaskFlow Lite (Prisma 6 + PostgreSQL). Fixed rules from my acceptance tests: id is a string, title is required and max 120 characters, description is optional, status is TODO/IN_PROGRESS/DONE with default TODO, priority is LOW/MEDIUM/HIGH with default MEDIUM, dueDate is an optional calendar date without time, plus createdAt and updatedAt.
An extra field I'm tempted to add: {{One extra field you are tempted to add}}.

Give me a Markdown table with columns: field | type | required? | default | why (one line). Then tell me in 2 lines whether my extra field belongs in version 1, and what a later migration for it would look like (no code).

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, field names and types in English.
- No code yet; just the table and the short answer.
- Stop at the end and wait for me to verify.
```

**المتوقع:** جدول فيه 8 حقول + رأي في الحقل الزيادة.

**اتأكد بنفسك:** الصق الجدول في `docs/data-model.md`، وعدل عمود "why" بكلامك. لازم تقدر تجاوب: ليه الـ `id` string؟ (الأرقام اللي بتزيد سهل تتخمن وبتكشف عدد المهام.)

**وقف لو:** الجدول فيه `userId` أو جدول تاني. ده out of scope.

### 2. اكتب الـ schema

**فين:** المحرر ← `server/prisma/schema.prisma` (الملف فيه TODO بيقولك المطلوب).

**إنت تختار:** نوع الـ ID: `cuid` أو `uuid`. الاتنين strings ومقبولين. الافتراضي في الحل المرجعي: `cuid`.

```text prompt=TF04-2
I'm on the "data-model" step of TaskFlow Lite. Edit only server/prisma/schema.prisma (it already has the generator, the datasource and a TODO comment).
ID strategy I chose: {{cuid or uuid}}.

Add:
- enum TaskStatus { TODO IN_PROGRESS DONE } and enum TaskPriority { LOW MEDIUM HIGH }
- model Task with: id (String, my ID strategy), title (VarChar 120), description (optional, VarChar 2000), status (default TODO), priority (default MEDIUM), dueDate (optional, @db.Date), createdAt (default now), updatedAt (@updatedAt)
- indexes on status, priority and dueDate
Explain each attribute (@id, @default, @db.VarChar, @db.Date, @updatedAt, @@index) in one short line.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only server/prisma/schema.prisma; keep the generator and datasource blocks as they are.
- If you can edit my files, show the diff. If you can't, give me the exact final content of this one file.
- Don't run any migration yet, and never say you ran something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الملف فيه 2 enums وmodel واحد، ومفيش أي حاجة اتغيرت في `generator` و`datasource`.

**اتأكد بنفسك:** في terminal جوه فولدر `server` شغل `npx prisma validate`. لازم يقول إن الـ schema valid.

**وقف لو:** الـ AI عايز يغير `datasource` أو يضيف جداول تانية.

### 3. اعمل الـ migration وشوف الجدول

**فين:** terminal في فولدر المشروع الرئيسي (والـ `db` في Docker شغال)، بعدين المحرر، بعدين المتصفح.

**إنت تختار:** اسم الـ migration. الافتراضي `add-task`. خليه وصف قصير بالإنجليزي من غير مسافات.

```bash
npm run db:migrate --workspace server -- --name add-task
```

بعدين افتح ملف `migration.sql` اللي اتعمل جوه `server/prisma/migrations/<timestamp>_add-task/` في المحرر.

```text prompt=TF04-3
I ran `npm run db:migrate --workspace server -- --name {{Your migration name}}` in the root of TaskFlow Lite.
Here is the generated migration.sql (it contains no secrets):
{{Paste your migration.sql}}

Explain in plain words what each CREATE TYPE, CREATE TABLE and CREATE INDEX line does to my database.
Then tell me: why this migrations folder must be committed to Git, and why I should never edit a migration after it has been applied.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep SQL, file paths and commands in English.
- Do this step only. Don't change any files.
- Never say you ran something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الـ terminal بيقول إن الـ migration اتطبقت، وفي فولدر جديد جوه `server/prisma/migrations`.

**اتأكد بنفسك:** في terminal جوه فولدر `server`:

```bash
npx prisma studio
```

افتح http://localhost:5555. لازم تشوف موديل **Task** ولما تفتحه يبقى فاضي بالأعمدة اللي كتبتها. اقفل Studio بـ `Ctrl+C` لما تخلص.

**وقف لو:** الـ migration فشلت بـ `Can't reach database server`. اتأكد إن `docker compose ps` بيقول `running` قبل ما تجرب تاني.

```bash
git add server/prisma docs/data-model.md
git commit -m "feat(db): add Task model, enums and indexes"
```

## ملاحظات تقنية (اختياري)

- **ليه enum مش text؟** من غيره هتلاقي في الداتابيز `"done"` و`"Done"` و`"DONE "`، والفلترة هتبوظ. الـ enum بيخلي الداتابيز نفسها ترفض أي قيمة تانية.
- **`@db.VarChar(120)`:** حماية من الداتابيز نفسها حتى لو الـ API فيه bug.
- **`@db.Date`:** تاريخ من غير وقت، عشان متتعبش مع الـ time zones.
- **`prisma db push`** للتجربة السريعة بس. في الإنتاج بنستخدم `migrate deploy` (هتشوفه في درس الـ deploy).
