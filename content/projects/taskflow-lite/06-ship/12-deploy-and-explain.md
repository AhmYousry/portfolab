---
slug: deploy-and-explain
title: Deploy، README، واشرح مشروعك
order: 2
durationMinutes: 90
status: PUBLISHED
checkpoints:
  - key: readme
    title: README كامل
    instructions: الـ README فيه - وصف، screenshot، architecture، API، خطوات تشغيل من الصفر، tests، deployment، وknown limitations. استخدم الـ README template من صفحة الملفات.
  - key: clean-install
    title: Clean install شغال
    instructions: اعمل clone للـ repo في فولدر جديد واتبع الـ README حرفيًا. لو احتجت تعمل أي خطوة مش مكتوبة، ضيفها للـ README.
  - key: public-repo
    title: الـ repo على GitHub بشكل آمن
    instructions: اعمل push للـ repo على GitHub (public أو private، قرارك) بعد ما تتأكد من checkpoint الـ secrets في الدرس اللي فات. حط اللينك في صفحة حسابك على المنصة لو حابب.
  - key: interview-answers
    title: جاوبت على 5 أسئلة إنترفيو
    instructions: استخدم prompt F10 وجاوب على الخمس أسئلة كتابة في `docs/interview-notes.md`.
---

## الهدف من الدرس

المشروع يبقى **قابل للتشغيل من أي حد**، موثق بشكل محترم، ومنشور (لو حابب)، وإنت جاهز تشرحه.

**الوقت المتوقع:** ساعة ونص.

## 1. الـ README

الـ README هو أول (وأحيانًا آخر) حاجة الـ recruiter بيشوفها. نزل الـ template من صفحة الملفات. الأقسام المهمة:

1. **سطر واحد** بيقول المشروع بيعمل إيه.
2. **Screenshot** أو GIF قصير.
3. **Architecture** (ممكن تاخد الجدول من `docs/architecture.md`).
4. **API** (من `docs/api.md`).
5. **Run locally** خطوة بخطوة.
6. **Tests** وإزاي تشغلها.
7. **Known limitations** بصراحة.
8. **What I learned** (2–3 نقط حقيقية).

> **متبالغش.** متكتبش "production-ready scalable enterprise app". اكتب اللي عملته فعلًا. الإنترفيور هيسأل.

## 2. Deployment (مبدأ عام)

مش هنفرض provider معين لأن الأسعار والـ free tiers بتتغير. أي provider هتختاره محتاج نفس الحاجات:

| المكون | المطلوب |
|---|---|
| PostgreSQL | داتابيز managed، وخد الـ connection string |
| API | Node service، env vars: `DATABASE_URL`، `CLIENT_ORIGIN`، `PORT` |
| Release step | `npm run db:deploy --workspace server` (مش `migrate dev`) |
| Client | static build: `VITE_API_URL=https://your-api... npm run build`، وانشر `client/dist` |
| Health check | `/api/health`، ولازم يرجع JSON |

نزل `Deployment & security checklist` وامشي عليه بند بند. **اقرا الـ pricing بتاع الـ provider** قبل ما تحط أي كارت، واعمل budget alert لو متاح.

## 3. Clean install test

ده أهم اختبار للـ README: فولدر جديد، `git clone`، وامشي على الـ README **حرفيًا**. أي خطوة عملتها ومش مكتوبة = bug في الـ README.

## 4. اشرح مشروعك

الإنترفيور مش هيسألك "عملت إيه". هيسألك **"ليه"**. جهز إجابات لـ:

- ليه فصلت routes عن service؟
- إيه اللي بيحصل لو الداتابيز وقعت؟
- ليه الـ validation في الـ server والـ client الاتنين؟
- لو عايز تضيف مستخدمين، إيه اللي هيتغير؟
- إيه أصعب bug قابلته وحليته إزاي؟ (عندك قصة `.partial()` جاهزة لو حصلت معاك.)

## AI mentor prompt (F10)

```text
Act as a technical interviewer. Review my README, screenshots, tests and architecture notes. Identify gaps, ask me five questions about my design decisions, and help me write an honest project summary without exaggerating my contributions.
```

## خلصت!

لو عديت كل الـ checkpoints، إنت بنيت مشروع full stack حقيقي، مختبر، وموثق، وبتقدر تشرحه. ده أهم من 17 calculator app.

**الخطوة الجاية (اختياري):** شارك لينك الـ repo معانا من صفحة حسابك. وفي Pro (لما ينزل) هنبني ExpensePilot: auth حقيقي، بيانات لكل مستخدم، charts، وتقارير.

## Git commit

```bash
git add README.md docs
git commit -m "docs: write portfolio README and interview notes"
git push
```
