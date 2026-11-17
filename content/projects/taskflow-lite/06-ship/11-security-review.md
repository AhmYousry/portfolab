---
slug: security-review
title: Security review قبل ما تنشر
order: 1
durationMinutes: 45
status: PUBLISHED
checkpoints:
  - key: no-secrets
    title: مفيش secrets في الـ Git history
    instructions: شغل `git log --all -p | grep -i -E "password|secret|DATABASE_URL="` (أو ابحث يدوي). لو لقيت قيمة حقيقية، غير الباسورد فورًا - مسح الملف من commit جديد مش كفاية.
  - key: checklist-done
    title: عديت على الـ security checklist
    instructions: نزل `Deployment & security checklist` من صفحة الملفات وعلم على كل بند أو اكتب ليه مش منطبق.
---

## الهدف من الدرس

تراجع مشروعك زي ما security reviewer هيراجعه، وتفرق بين المشاكل **الحرجة** والتحسينات الاختيارية.

**الوقت المتوقع:** 45 دقيقة.

## المشكلة

افتكر أحمد و`.env` على GitHub. لو الـ secret دخل الـ Git history مرة، اعتبره **اتسرب**. مسحه في commit جديد بيشيله من النسخة الحالية بس؛ الـ history لسه فيه.

## Checklist حرج (لازم)

| البند | ازاي تتأكد | في TaskFlow Lite |
|---|---|---|
| مفيش secrets في الكود أو الـ history | `git log -p` وبحث | `.env` في `.gitignore`، و`.env.example` من غير قيم حقيقية |
| Validation على الـ server لكل input | جرب curl بقيم غلط | Zod + `.strict()` |
| مفيش SQL بـ string concatenation | دور على `$queryRawUnsafe` | Prisma parameterized queries |
| الأخطاء مبتكشفش تفاصيل داخلية | test الـ 500 | `errorHandler` بيرجع رسالة عامة |
| CORS مش مفتوح لكل الناس | جرب request من origin تاني | `cors({ origin: CLIENT_ORIGIN })` |
| حجم الـ request محدود | ابعت body كبير | `express.json({ limit: '16kb' })` |

## تحسينات (اختياري، ومهم تعرفها)

- **Security headers** بـ `helmet`.
- **Rate limiting** بـ `express-rate-limit` (أهم بكتير لما يبقى في login).
- **Dependency audit**: `npm audit`. اقرا النتيجة؛ مش كل تحذير بيأثر عليك، بس لازم تعرف السبب.

## ليه مفيش auth هنا؟

TaskFlow Lite لمستخدم واحد بالقصد. **لو نشرته public، أي حد عنده اللينك يقدر يعدل المهام.** ده مقبول لـ demo، بس لازم تكتبه في الـ README تحت "Known limitations". الصراحة دي بتبين إنك فاهم. (الـ auth والـ authorization هما محور ExpensePilot في Pro.)

## AI mentor prompt (F09)

```text prompt=F09
Review this small full-stack task app for input validation, injection risks, secret handling, CORS and unsafe error exposure. Separate critical issues from optional hardening.
```

متلصقش `.env` الحقيقي في الـ AI. الصق الكود و`.env.example` بس.

## Git commit

```bash
git add .
git commit -m "chore: security review fixes and documented limitations"
```
