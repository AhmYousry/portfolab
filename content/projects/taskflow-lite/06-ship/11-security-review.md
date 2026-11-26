---
slug: security-review
title: Security review قبل ما تنشر
order: 1
durationMinutes: 45
status: PUBLISHED
checkpoints:
  - key: no-secrets
    title: مفيش secrets حقيقية في الـ Git history
    instructions: من فولدر المشروع الرئيسي دورت في الـ history (Git Bash - `git log --all -p | grep -i -E "password|secret|DATABASE_URL="`، أو PowerShell - `git log --all -p | Select-String -Pattern "password|secret|DATABASE_URL="`). الحاجة الوحيدة المسموحة هي باسورد التطوير المحلي `taskflow_local_only`. لو لقيت قيمة حقيقية، غير الباسورد ده فورًا؛ مسح الملف في commit جديد مش كفاية.
  - key: checklist-done
    title: عديت على الـ security checklist
    instructions: نزلت `Deployment & security checklist` من صفحة الملفات وعلمت على كل بند أو كتبت ليه مش منطبق، وضفت قسم "Known limitations" في الـ notes بتاعة الـ README.
---

## الهدف

تراجع مشروعك زي security reviewer، وتفرق بين المشاكل **الحرجة** والتحسينات الاختيارية، من غير ما تكسر حاجة شغالة.

**هتشوف في الآخر:** نتيجة بحث في الـ Git history مفيهاش غير باسورد التطوير المحلي، وليستة قصيرة "حرج / اختياري" لمشروعك، وقسم Known limitations صادق.

**الوقت:** حوالي 45 دقيقة.

**قاعدة الدرس:** متلصقش `.env` ولا أي باسورد حقيقي في الـ AI. الصق الكود و`.env.example` بس. وأي إصلاح يبقى صغير، ملف واحد، وبعده `npm test`.

## الخطوات

### 1. دور على secrets في الـ history

**فين:** terminal في فولدر المشروع الرئيسي.

**إنت تختار:** الـ terminal اللي هتستخدمه. الأمرين بيعملوا نفس الحاجة:

```bash
# Git Bash / macOS / Linux
git log --all -p | grep -i -E "password|secret|DATABASE_URL="

# Windows PowerShell
git log --all -p | Select-String -Pattern "password|secret|DATABASE_URL="
```

```text prompt=TF11-1
I searched the Git history of TaskFlow Lite for secrets. The starter intentionally contains a local-only development password "taskflow_local_only" in docker-compose.yml and server/.env.example.
My matching lines, with any other real value replaced by ***: {{Paste the matching lines with real values hidden}}.

For each line tell me: local-only and acceptable, or a real leak. If anything is a real leak, tell me the safe order of actions: rotate the password first, then clean up. Explain in 2 lines why deleting the file in a new commit does not remove it from history.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Don't suggest force-pushing or rewriting history as the first step.
- Never ask me to paste real secrets, and never say you ran something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** السطور الوحيدة فيها `taskflow_local_only`. ده باسورد Docker محلي ومش بيفتح أي حاجة برا جهازك.

**اتأكد بنفسك:** مفيش `server/.env` في أي commit: `git log --all --oneline -- server/.env` لازم ميطبعش حاجة.

**وقف لو:** لقيت connection string لداتابيز على الإنترنت أو API key. غيّره من عند الـ provider **قبل** أي حاجة تانية.

### 2. Review للكود: حرج ولا اختياري

**فين:** AI chat (بتلصق كود)، بعدين المحرر لو في إصلاح حرج.

**إنت تختار:** أول ملف تراجعه: `server/src/app.js` أو `server/src/http.js` أو `server/src/tasks/task.routes.js`.

```text prompt=TF11-2
Review this file from TaskFlow Lite (single-user task app: Express 5, Prisma, Zod, React client). No auth on purpose, documented as a known limitation.
File path: {{The file you want reviewed first}}.
Code:
{{Paste the file content}}

Check only: server-side validation, injection risks (raw SQL), secret handling, CORS, request size limit, and leaking internal error details. Split findings into "critical" and "optional hardening". For each critical one, give the smallest fix in this one file and the test command to re-run.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- One file only. Don't propose a rewrite, new architecture, or adding auth.
- Don't add dependencies in this step; list them under "optional" instead.
- If you can edit my files, show the diff. If you can't, show me exactly what to change.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** في الـ starter معظم الحرج متغطي: Zod + `.strict()`، Prisma من غير raw SQL، `cors({ origin: CLIENT_ORIGIN })`، `express.json({ limit: '16kb' })`، والـ `errorHandler` بيرجع `Something went wrong` بدل تفاصيل الداتابيز.

**اتأكد بنفسك:** لو عملت أي إصلاح، من فولدر المشروع الرئيسي `npm test` لازم يفضل أخضر.

**وقف لو:** الـ AI عايز يضيف login أو JWT. ده out of scope؛ اكتبه كـ limitation.

### 3. اكتب الـ limitations بصراحة

**فين:** المتصفح ← صفحة الملفات (نزل **Deployment & security checklist**)، بعدين AI chat، بعدين notes الـ README.

**إنت تختار:** هتشارك التطبيق فين. أمثلة: `only on my laptop`، `a public demo link`، `GitHub only, no live demo`.

```text prompt=TF11-3
Help me write an honest "Known limitations" section for my TaskFlow Lite README.
Where I plan to share it: {{Where you plan to share the app}}.

Facts: single user, no login, anyone with the API URL can edit or delete tasks if deployed publicly, no rate limiting, no pagination, no security headers package. Write 3 to 5 bullet points in clear English for the README, each with "why it's acceptable for this version" and "what I would add next". Keep it short and don't exaggerate.

Rules for your answer:
- Explain your reasoning in simple Egyptian Arabic, but write the README bullets in English.
- No code changes in this step.
- Stop at the end and wait for me to verify.
```

**المتوقع:** 3–5 bullets صادقة.

**اتأكد بنفسك:** علم على كل بند في الـ checklist أو اكتب جنبه ليه مش منطبق. احفظ الـ bullets؛ هتحطها في الـ README الدرس الجاي.

**وقف لو:** الـ bullets بتقول "secure" أو "production-ready". امسحها.

```bash
git add .
git status   # اتأكد إن مفيش .env
git commit -m "chore: security review fixes and documented limitations"
```

## ملاحظات تقنية (اختياري)

- **تحسينات ممكن تضيفها بعدين:** `helmet` للـ security headers، `express-rate-limit` (أهم بكتير لما يبقى في login)، و`npm audit` (اقرا النتيجة؛ مش كل تحذير بيأثر عليك).
- **ليه مفيش auth هنا؟** التطبيق لمستخدم واحد بالقصد. الصراحة في الـ README بتبين إنك فاهم الحدود.
