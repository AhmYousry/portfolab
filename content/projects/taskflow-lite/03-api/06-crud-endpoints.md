---
slug: crud-endpoints
title: ابني الـ CRUD endpoints
order: 3
durationMinutes: 90
status: PUBLISHED
checkpoints:
  - key: crud-works
    title: الخمس endpoints شغالين
    instructions: http://localhost:3001/api/tasks بقى بيرجع `{"data":[...]}` بدل `Not implemented yet`، وجربت create وlist وget وpatch وdelete وكل واحد رجع الـ status code اللي في `docs/api.md`.
  - key: invalid-400
    title: input غلط بيرجع 400
    instructions: 'بعت `POST /api/tasks` بعنوان فاضي، وبعدين بـ `{"title":"ok","status":"DOING"}`، والاتنين رجعوا `400` مع `details` بتحدد الحقل الغلط.'
  - key: acceptance-tests
    title: الـ acceptance tests بتعدي
    instructions: جوه فولدر `server` شغلت `npx vitest run` وكل التستات في `health.test.js` و`tasks.test.js` عدت.
---

## الهدف

الـ API يبقى شغال بجد: تضيف مهمة وترجع تلاقيها، والـ acceptance tests اللي في الـ starter كلها تعدي.

**هتشوف في الآخر:** http://localhost:3001/api/tasks في المتصفح بيعرض مهمتك بالـ JSON بدل `Not implemented yet`، و`npx vitest run` كله أخضر.

**الوقت:** حوالي ساعة ونص.

**الحالة دلوقتي بصراحة:** الواجهة على 5174 لسه **مش** هتعرض المهام. ده Module 4.

**التقسيمة:** `task.service.js` بيكلم Prisma بس ومبيعرفش HTTP. `task.routes.js` بيقرا الـ request، يعمل validation، ويختار الـ status code، ومبيعرفش SQL.

## الخطوات

### 1. الـ service: list و get

**فين:** المحرر ← `server/src/tasks/task.service.js` (فيه `toResponse` جاهز و5 functions بترمي `not implemented`).

**إنت تختار:** ترتيب المهام اللي من غير due date لما ترتب بالتاريخ. الـ tests مستنية إنها تيجي **في الآخر**؛ فكر ليه ده منطقي للمستخدم واكتبه في سطر.

```text prompt=TF06-1
I'm on the "crud-endpoints" step of TaskFlow Lite. Edit only server/src/tasks/task.service.js. Prisma 6, PostgreSQL. Keep toResponse as it is.
Why tasks without a due date should come last, in my words: {{Your reason in one line}}.

Implement only listTasks and getTask:
- listTasks({ status, priority, search, sort }): filter by status and priority when given; search the title case-insensitively; sort is one of createdAt, -createdAt, dueDate, -dueDate ("-" means descending); for dueDate sorting put null dates last, then newest createdAt. Return tasks mapped with toResponse.
- getTask(id): return the task through toResponse, or null if it does not exist.
Explain how Prisma keeps "search" safe from SQL injection.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Leave createTask, updateTask and deleteTask unchanged for now.
- If you can edit my files, show the diff. If you can't, show me exactly what to replace in this one file.
- Don't add dependencies, and never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** functionين بقوا حقيقيين، والـ 3 التانيين لسه بيرموا error.

**اتأكد بنفسك:** مفيش `$queryRawUnsafe` ولا string بيتلزق جوه SQL. كله `prisma.task.findMany` / `findUnique`.

**وقف لو:** الـ AI غير `task.routes.js` أو `toResponse`.

### 2. الـ service: create و update و delete

**فين:** نفس الملف `server/src/tasks/task.service.js`.

**إنت تختار:** هل الـ delete لمهمة مش موجودة يرجع `404` ولا `204`؟ الـ tests بتاعتنا مستنية `404`. اكتب رأيك؛ الـ AI هيوضحلك الـ tradeoff.

```text prompt=TF06-2
Still in server/src/tasks/task.service.js for TaskFlow Lite. Implement only createTask, updateTask and deleteTask.
My opinion on deleting a missing task (404 or 204) and why: {{Your opinion in one line}}.

- createTask(input): convert dueDate "YYYY-MM-DD" to a Date at UTC midnight before saving; keep null as null.
- updateTask(id, input): return null if the task does not exist; otherwise update only the fields sent. undefined means "don't touch", null means "clear the value".
- deleteTask(id): return true if a row was deleted, false otherwise, without throwing for a missing id.
All return values go through toResponse where a task is returned. Briefly react to my opinion: what are the pros and cons, and why my tests expect 404.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only these three functions.
- If you can edit my files, show the diff. If you can't, show me exactly what to replace in this one file.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** مفيش ولا `throw new Error('... not implemented yet')` فاضل في الملف.

**اتأكد بنفسك:** دور في الملف على `not implemented`. لازم صفر نتايج.

**وقف لو:** الـ update بيعمل `delete` وبعدين `create`. ده مش update.

### 3. الـ routes

**فين:** المحرر ← `server/src/tasks/task.routes.js`، بعدين terminal الـ server، بعدين المتصفح.

**إنت تختار:** رسالة الـ 404. لازم تبقى مفهومة ومتكشفش تفاصيل داخلية. الافتراضي: `Task not found`.

```text prompt=TF06-3
I'm wiring the routes of TaskFlow Lite. Edit only server/src/tasks/task.routes.js (Express 5).
My 404 message: "{{Your 404 message}}".

Remove the taskRouter.all(...) that throws 501 and add the five routes from my contract, using validate(schema, value) and HttpError from ../http.js, the schemas from ./task.schema.js, and the service functions from ./task.service.js:
GET / (validate req.query with listQuerySchema), GET /:id, POST / (201), PATCH /:id (200), DELETE /:id (204 with no body). Validate :id with idSchema. Throw HttpError(404, ...) when the service returns null or false.
Explain why Express 5 does not need try/catch in each async route here.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only this file; don't change http.js or app.js.
- If you can edit my files, show the diff. If you can't, give me the exact final content of this one file.
- Tell me how to restart the server and which URL to open.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** في terminal الـ server اعمل `Ctrl+C` وبعدين `npm run dev:server` تاني من فولدر المشروع الرئيسي (عشان يشوف الـ Prisma client الجديد بعد الـ migration).

**اتأكد بنفسك:** افتح http://localhost:3001/api/tasks. لازم تشوف `{"data":[]}` بدل `Not implemented yet`. وhttp://localhost:3001/api/tasks?status=SOMEDAY لازم يرجع `Validation failed`.

**وقف لو:** شفت `Something went wrong`. بص على الـ terminal بتاع الـ server، الـ error الحقيقي مكتوب هناك.

### 4. جرب بإيدك وشغل الـ acceptance tests

**فين:** terminal (على Windows استخدم **Git Bash**) في أي فولدر، بعدين المتصفح، بعدين terminal في `server`.

**إنت تختار:** عنوان مهمتك الحقيقية والـ priority بتاعتها (`LOW` / `MEDIUM` / `HIGH`). غير `Write README` و`HIGH` تحت بقيمك.

```bash
curl -i -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"Write README","priority":"HIGH"}'
curl -i -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":""}'
curl -i -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d '{"title":"ok","status":"DOING"}'
```

افتح http://localhost:3001/api/tasks?priority=HIGH. مهمتك لازم تظهر. بعدين:

```bash
cd server
npx vitest run
```

```text prompt=TF06-4
I'm checking my TaskFlow Lite API by hand and with the acceptance tests.
Status lines I got from my 3 curl commands: {{Paste the 3 HTTP status lines}}.
Vitest summary (or the first failing test with its expected vs received, no secrets): {{Paste the test summary or first failure}}.

If everything passed, explain what each status code proves. If a test failed, explain what the failure message means, which ONE file most likely causes it, and the smallest change to try. Don't rewrite whole files.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Fix only what this failure needs, in one file.
- If you can edit my files, show the diff. If you can't, show me exactly what to change.
- Tell me exactly what to re-run and in which folder.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** `201` للأول، `400` للتاني والتالت مع `details` فيها `title` و`status`. والـ tests كلها passed.

**اتأكد بنفسك:** في مخرجات الـ test دور على `only changes the fields that were sent` و`returns a safe 500 without leaking internals`. الاتنين لازم يبقوا ✓.

**وقف لو:** test فشل وإنت مش فاهم ليه. اقرا سطر `expected` و`received` الأول، وبعدين ابعت الـ prompt.

```bash
git add server/src
git commit -m "feat(api): implement task CRUD with filtering, search and sorting"
```

> بعد ما تخلص الـ checkpoints دي، الـ **reference solution** هتتفتح لك في صفحة الملفات. قارن بيها، متنسخش.

## ملاحظات تقنية (اختياري)

- **`findUnique` بعدين `delete`:** `delete` بيرمي exception لو المهمة مش موجودة، فهترجع `500` بدل `404`. `deleteMany` بيرجع `count` من غير exception.
- **`res.status(204).json(...)` غلط:** الـ 204 معناها مفيش body. استخدم `.end()`.
- **`toResponse`** بيحول التاريخ لـ `"2026-12-01"` عشان `<input type="date">` يفهمه.
