# TaskFlow Lite — AI prompts

**الفكرة:** الـ AI هنا بينفذ ويشرح خطوة صغيرة واحدة كل مرة، وإنت بتخصص الـ prompt بالإنجليزي وتتأكد بنفسك من نتيجة كل خطوة قبل ما تكمل. كل درس فيه prompt لكل خطوة (`TF01-1`، `TF03-2`، ...). الملف ده فيه 10 prompts عامة (F01–F10) تقدر تستخدمها في أي وقت، وفهرس لـ prompts الدروس.

## إزاي تستخدمهم

1. انسخ الـ prompt **زي ما هو** في الـ AI assistant المتاح عندك. المنصة مش بتطلب اشتراك AI مدفوع، ومفيش AI جوه المنصة، بس إحنا مش بنضمن إن أي أداة أو model معين مجاني.
2. غير كل `{{...}}` بقيمتك إنت **بالإنجليزي**. ده الجزء اللي بيخلي الإجابة عن مشروعك إنت.
3. نفذ اللي الـ AI قاله في المكان اللي الدرس محدده (AI chat / محرر / terminal في فولدر معين / متصفح).
4. اتأكد بنفسك زي ما الدرس بيقول، وبعدين بس كمل.

**ممنوع تلصق:** محتوى `.env`، باسوردات، connection strings، أو API keys. لو هتلصق error، شيل منه أي حاجة شبه `postgresql://...`.

**لو الـ AI:** كتب المشروع كله، ضاف dependencies، أو قال "I ran the tests" وهو مشغلهاش، قوله:

```text prompt=TF-stop
Stop. Do only the current step, in one file, and don't claim you ran anything. Explain in simple Egyptian Arabic.
```

---

## F01 — Scope (Module 1)
```text prompt=F01
Act as a senior full-stack mentor. I'm a beginner planning TaskFlow Lite, a single-user task manager.
Who will use it: {{Who will use your app}}. Their main problem: {{The problem in one sentence}}.
Ask me up to 3 clarifying questions, then give me 5 user stories with one browser-visible acceptance check each, and 3 out-of-scope features with one-line reasons.
Explain in simple Egyptian Arabic; keep technical terms in English. No code and no files yet. Stop and wait for my reply.
```

## F02 — Architecture (Module 1)
```text prompt=F02
Review my TaskFlow Lite plan: React on 5174, Express API on 3001, PostgreSQL on 5433 with Prisma.
My user stories: {{Paste your user stories}}.
Explain what each layer is responsible for and NOT responsible for, walk through the "Add task" request (POST /api/tasks, 201, 400), and flag anything I don't need yet.
Explain in simple Egyptian Arabic; keep technical terms in English. No code yet. Stop and wait for my reply.
```

## F03 — Data model (Module 3)
```text prompt=F03
Help me review the Prisma Task model of TaskFlow Lite in server/prisma/schema.prisma.
My current model (no secrets): {{Paste your Task model}}.
Check field types, defaults, the 120-char title limit, the date-only dueDate and the indexes. Ask me to justify one field, then wait.
Explain in simple Egyptian Arabic; keep code in English. Touch only this file and show a diff if needed. Never say you ran a migration. Stop and wait for me to verify.
```

## F04 — API contract (Module 3)
```text prompt=F04
Review my TaskFlow Lite API contract before I implement it.
My contract: {{Paste your docs/api.md}}.
For each of the 5 endpoints check the request, success response, status codes (200, 201, 204, 400, 404) and the shared error shape {"error": {"message", "details"}}. List gaps only.
Explain in simple Egyptian Arabic; keep JSON and paths in English. No implementation yet. Stop and wait for my reply.
```

## F05 — Frontend decomposition (Module 4)
```text prompt=F05
Help me plan the React UI of TaskFlow Lite: App, TaskForm, Filters, TaskList in client/src.
The part I'm unsure about: {{The UI part you are unsure about}}.
Give me props, owned state and events for each component, how loading/empty/error states should render, and the order to build them.
Explain in simple Egyptian Arabic; keep code names in English. No code yet. Stop and wait for my reply.
```

## F06 — Guided implementation (Modules 3–5)
```text prompt=F06
I'm implementing {{The feature you are implementing}} in TaskFlow Lite, in the file {{The file path}}.
My current code (no secrets): {{Paste your code}}.
Give me hints first. Then, only if I ask, a small targeted change in this one file that keeps my style.
Explain in simple Egyptian Arabic; keep code, paths and commands in English. Tell me what to run, in which folder, and what I should see. Don't rewrite other files, don't add dependencies, never claim you ran anything. Stop and wait for me to verify.
```

## F07 — Debugging (any module)
```text prompt=F07
In TaskFlow Lite I ran {{The command or action and the folder}} and got this error (secrets removed): {{Paste the error without secrets}}.
Rank the 3 most likely causes. For each, give ONE thing to check first and what I'd see if it's the cause. Don't suggest deleting data, reinstalling everything, or big rewrites.
Explain in simple Egyptian Arabic; keep commands in English. Never claim you ran anything. Stop and wait for my result.
```

## F08 — Testing (Module 5)
```text prompt=F08
Help me add one test to server/test/tasks.test.js in TaskFlow Lite (Vitest + Supertest, separate taskflow_test database, beforeEach empties the table).
Behavior I want to test: {{The behavior your new test will check}}.
Explain arrange/act/assert in words first, then show one small test I can paste. It must not depend on other tests.
Explain in simple Egyptian Arabic; keep code in English. Touch only this file. Tell me the exact command and folder. Never claim you ran it. Stop and wait for me to verify.
```

## F09 — Security review (Module 6)
```text prompt=F09
Review this TaskFlow Lite file for validation, injection, secret handling, CORS, request size and error leaks.
File path: {{The file path}}. Code (no secrets): {{Paste the file content}}.
Split findings into "critical" and "optional hardening". For critical ones, give the smallest fix in this one file and the test command to re-run.
Explain in simple Egyptian Arabic; keep code in English. No rewrites, no new dependencies, no auth. Never claim you ran anything. Stop and wait for me to verify.
```

## F10 — Portfolio readiness (Module 6)
```text prompt=F10
Act as a technical interviewer for a {{The role you are applying for}} position. Review my TaskFlow Lite README: {{Paste your README}}.
List the gaps, then ask me 5 "why" questions about my decisions, ONE at a time, waiting for my answer each time. After each answer, give me an honest, better 2-sentence version without exaggerating my work.
Explain in simple Egyptian Arabic; keep technical terms in English. Don't answer for me. Ask the first question and stop.
```

---

## فهرس prompts الدروس

| الدرس | الـ prompts |
|---|---|
| 1. ليه TaskFlow Lite؟ | `TF01-1` stories، `TF01-2` out of scope، `TF01-3` sketch |
| 2. الـ Architecture | `TF02-1` الطبقات، `TF02-2` رحلة Add task، `TF02-3` tradeoff |
| 3. جهز الـ workspace | `TF03-1` فتح المشروع، `TF03-2` الواجهة، `TF03-3` الداتابيز والـ API، `TF03-4` أول test، `TF03-help` لو اتزنقت |
| 4. الـ data model | `TF04-1` الحقول، `TF04-2` الـ schema، `TF04-3` الـ migration |
| 5. الـ API contract | `TF05-1` الـ contract، `TF05-2` create/update schemas، `TF05-3` list query |
| 6. الـ CRUD endpoints | `TF06-1` list/get، `TF06-2` create/update/delete، `TF06-3` routes، `TF06-4` تجربة وتستات |
| 7. الـ components | `TF07-1` الخريطة، `TF07-2` الفورم، `TF07-3` تستات الفورم |
| 8. States والفلاتر | `TF08-1` loading/error، `TF08-2` الليستة والـ empty state، `TF08-3` الفلاتر |
| 9. ربط الـ frontend | `TF09-1` الإضافة، `TF09-2` DONE والحذف، `TF09-3` التعديل، `TF09-4` أخطاء الـ server |
| 10. Tests | `TF10-1` اشرح test، `TF10-2` test بإيدك، `TF10-3` اكسر عمدًا |
| 11. Security review | `TF11-1` secrets، `TF11-2` code review، `TF11-3` limitations |
| 12. Deploy واشرح | `TF12-1` README، `TF12-2` GitHub، `TF12-3` clean install، `TF12-4` إنترفيو، `TF12-opt` نشر اختياري |
