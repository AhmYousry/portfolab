---
slug: testing
title: Tests بتثبت إن الـ API شغال
order: 2
durationMinutes: 75
status: PUBLISHED
checkpoints:
  - key: own-test
    title: كتبت test جديد بنفسك
    instructions: ضفت test واحد على الأقل في `server/test/tasks.test.js` مش موجود في الـ starter (مثلًا - بحث بكلمة مش موجودة يرجع `[]`، أو `?sort=title` يرجع `400`)، وبيعدي.
  - key: all-green
    title: كل التستات بتعدي
    instructions: من فولدر المشروع الرئيسي (والـ `db` في Docker شغال) `npm test` بيشغل تستات الـ server والـ client وكلها خضرا.
  - key: explain-test
    title: أقدر أشرح test واحد
    instructions: في `docs/testing.md` كتبت test واحد - هو بيثبت إيه بالظبط، وإيه الـ bug اللي كان هيعدي من غيره.
---

## الهدف

تفهم التستات اللي معاك، تضيف test بإيدك، وتشوف test بيفشل لما تكسر الكود عمدًا.

**هتشوف في الآخر:** `npm test` كله أخضر، وفيه test إنت اللي كاتبه، وشفت بعينك test بيبقى أحمر لما شلت `.strict()`.

**الوقت:** حوالي ساعة وربع.

**أمان:** تستات الـ server بتمسح جدول `Task` قبل كل test، بس في داتابيز `taskflow_test` بس. `server/vitest.config.js` بيرفض يشتغل لو `DATABASE_URL` في `.env.test` مفيهوش `test`. **عمرك ما تغير ده** عشان التستات تعدي.

## الخطوات

### 1. شغل كل التستات واشرح واحد

**فين:** terminal في فولدر المشروع الرئيسي، بعدين AI chat، بعدين المحرر ← ملف جديد `docs/testing.md`.

**إنت تختار:** test واحد من `server/test/tasks.test.js` يعجبك. اقتراحات: `only changes the fields that were sent` أو `returns a safe 500 without leaking internals`.

```bash
npm test
```

```text prompt=TF10-1
I ran `npm test` in the root of TaskFlow Lite (it runs Vitest + Supertest for the server against a separate taskflow_test database, and Vitest + Testing Library for the client).
The test I picked from server/test/tasks.test.js: "{{The test name you picked}}".
Its code (no secrets inside):
{{Paste the test code}}

Explain in 4 short lines: what request it sends, what it expects, what behavior it proves, and a realistic bug that would slip through without it. Then give me a 2-sentence version I can put in docs/testing.md and say in an interview.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, test names and commands in English.
- No code changes in this step.
- Never say you ran something you didn't.
- Stop at the end and wait for me to verify.
```

**المتوقع:** كل الـ test files passed، و4 سطور شرح.

**اتأكد بنفسك:** اكتب في `docs/testing.md` الشرح **بكلامك**. اقراه من غير ما تبص على الكود؛ لو مش قادر، ارجع اقرا الـ test.

**وقف لو:** `npm test` قال `Tests need a separate database`. راجع `server/.env.test` (درس الـ workspace). متعدلش `vitest.config.js`.

### 2. ضيف test بإيدك

**فين:** المحرر ← `server/test/tasks.test.js`، بعدين terminal في `server`.

**إنت تختار:** السلوك اللي هتختبره. اقتراحات مضمونة: بحث بكلمة مش موجودة يرجع `{"data": []}`، `GET /api/tasks?sort=title` يرجع `400`، أو `PATCH` بـ `{"priority": "URGENT"}` يرجع `400`.

```text prompt=TF10-2
I want to add ONE new test to server/test/tasks.test.js in TaskFlow Lite. The file already has a createTask(body) helper, a beforeEach that empties the table, and uses request(app) from Supertest.
Behavior my test will check: {{The behavior your new test will check}}.

Guide me to write it myself: first give me the test name and the 3 parts (arrange, act, assert) in plain words. Only after that, show the final test as a small block I can paste inside the right describe. It must not depend on other tests or on data from the dev database.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only server/test/tasks.test.js, and add one test without changing existing ones.
- If you can edit my files, show the diff. If you can't, tell me exactly where to paste it.
- Tell me the exact command to run and in which folder.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** test جديد واحد، وجوه `server` الأمر `npx vitest run` بيعدي.

**اتأكد بنفسك:** غير الـ `expect` في الـ test بتاعك لقيمة غلط عمدًا (مثلًا `400` ← `200`) وشغل تاني: لازم يفشل. رجعها. test عمره ما بيفشل مبيثبتش حاجة.

**وقف لو:** الـ test بتاعك بيعدي بس لما يتشغل بعد test تاني. كل test لازم يجهز بياناته بنفسه.

### 3. اكسر الكود عمدًا

**فين:** المحرر ← `server/src/tasks/task.schema.js` (تعديل مؤقت)، بعدين terminal في `server`.

**إنت تختار:** حاجة واحدة تكسرها. الافتراضي: شيل `.strict()` من `createTaskSchema`. بديل: غير `max(120)` لـ `max(200)`.

```bash
cd server
npx vitest run
```

```text prompt=TF10-3
I broke TaskFlow Lite on purpose to see which test catches it.
What I changed: {{What you broke on purpose}}.
The failing test name and its expected vs received lines: {{Paste the failing test output}}.

Explain why exactly this test failed and what real-world problem it protects users from. If no test failed, tell me what kind of test is missing (in words only).
Remind me to undo my change and confirm all tests are green again.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, test names and commands in English.
- Don't edit any file; I will undo my change myself.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** لو شلت `.strict()`، الـ test اللي اسمه `rejects invalid body {"title":"ok","isAdmin":true} with 400` هيفشل.

**اتأكد بنفسك:** رجع التعديل، ومن فولدر المشروع الرئيسي `npm test` تاني: كله أخضر.

**وقف لو:** الكود لسه مكسور وإنت عامل commit. رجّع الأول.

```bash
git add server/test docs/testing.md
git commit -m "test: add my own API test and document what tests prove"
```

## ملاحظات تقنية (اختياري)

- **ليه integration tests؟** `request(app)` بيشغل الـ Express app الحقيقي مع داتابيز test حقيقية، فبيثبت إن الـ routes والـ validation وPrisma والـ SQL شغالين **مع بعض**.
- **test الـ 500:** بيعمل `vi.spyOn(prisma.task, 'findMany')` ويخليه يفشل، ويتأكد إن الـ response مفيهوش تفاصيل داخلية زي IP.
- **متعملش snapshot لكل response:** بيكسر مع أي تغيير بسيط. اختبر الحاجات المهمة بس.
