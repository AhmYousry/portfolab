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
    instructions: اكتب في `docs/architecture.md` فقرة قصيرة لكل طبقة (client / API / database) بتقول هي مسؤولة عن إيه و**مش** مسؤولة عن إيه. اقرأها بصوت عالي كأنك في إنترفيو.
  - key: data-flow
    title: رسمت رحلة طلب "إضافة task"
    instructions: ارسم (أو اكتب كخطوات مرقمة) رحلة الطلب من لحظة الضغط على "Add task" لحد ما الـ task تظهر في الليستة. لازم تذكر الـ HTTP method والـ status code المتوقع.
  - key: tradeoff
    title: كتبت tradeoff واحد
    instructions: اكتب قرار تقني واحد وبديله والسبب، مثلًا "PostgreSQL بدل localStorage لأن ..."
---

## الهدف من الدرس

تفهم **ليه** في 3 طبقات، ومسؤولية كل واحدة، وترسم رحلة طلب واحد من المتصفح لقاعدة البيانات ورجوعًا.

**الوقت المتوقع:** 40 دقيقة.

## المشكلة

أحمد عمل app بـ React بيحفظ المهام في `localStorage`. اشتغل تمام لحد ما فتحه من الموبايل ولقى الليستة فاضية. وبعدين مسح الـ browser data وكل حاجة راحت.

`localStorage` مش غلط؛ هو بس مش مكان لبيانات المفروض تعيش وتتشارك بين أجهزة. هنا بييجي دور الـ backend.

## الطبقات التلاتة

```text
[ Browser: React ]  --HTTP JSON-->  [ Express API ]  --SQL (Prisma)-->  [ PostgreSQL ]
       :5174                             :3001                              :5433
```

| الطبقة | مسؤولة عن | مش مسؤولة عن |
|---|---|---|
| **Client (React)** | عرض البيانات، جمع input، feedback سريع (زي "العنوان مطلوب") | إنها تكون آخر خط دفاع؛ أي حد يقدر يبعت request من غير الـ UI |
| **API (Express)** | التأكد من صحة البيانات (validation)، قواعد التطبيق، اختيار status codes، إخفاء تفاصيل الأخطاء | شكل الـ UI |
| **Database (PostgreSQL)** | حفظ البيانات بشكل دائم وموثوق، الـ constraints، البحث والترتيب بكفاءة | قواعد الـ UI أو رسائل الخطأ |

> **قاعدة ذهبية:** الـ validation في الـ client عشان راحة المستخدم. الـ validation في الـ server عشان الأمان. لازم الاتنين.

## رحلة طلب "إضافة task"

1. المستخدم يكتب "Write README" ويضغط **Add task**.
2. الـ React form يتأكد إن العنوان مش فاضي (feedback سريع).
3. الـ client يبعت `POST /api/tasks` بـ body: `{"title": "Write README"}`.
4. الـ API يعمل validation بـ Zod. لو غلط → `400` مع تفاصيل الحقل الغلط.
5. لو سليم، الـ API يطلب من Prisma يعمل `INSERT` في جدول `Task`.
6. PostgreSQL يحفظ ويرجع الصف بالـ `id` والـ `createdAt`.
7. الـ API يرد بـ `201 Created` و `{"data": {...task}}`.
8. الـ client يعيد تحميل الليستة والـ task الجديدة تظهر.

## ليه Express وPostgreSQL وPrisma؟

- **Express:** بسيط ومنتشر جدًا، فهتلاقي مصادر كتير وهتفهم الـ HTTP بنفسك من غير سحر.
- **PostgreSQL:** قاعدة بيانات relational جادة بتستخدمها شركات حقيقية. بتعلمك SQL وconstraints.
- **Prisma:** بيخليك تكتب schema واضحة وmigrations متتبعة في Git، وبيحميك من SQL injection في الـ queries العادية لأنه بيستخدم parameterized queries.

ده **مش** الاختيار الوحيد الصح. الأهم إنك تعرف تبرر اختيارك.

## أخطاء شائعة

- **"الـ frontend بيعمل validation فخلاص":** أي حد يقدر يبعت request بـ `curl` ويتخطى الـ UI خالص.
- **إن الـ API يرجع رسالة الخطأ بتاعة الداتابيز للمستخدم:** بتسرب تفاصيل داخلية (أسماء جداول، IPs). هنتعامل مع ده في Module 3.
- **Over-engineering:** مش محتاج microservices ولا Redis ولا Docker Swarm لـ task manager شخصي.

## AI mentor prompt (F02)

```text prompt=F02
Review my TaskFlow Lite requirements and propose a simple React + Express + PostgreSQL architecture. Explain data flow and why each layer exists. Flag unnecessary complexity.
```

الصق الـ `docs/scope.md` بتاعك بعد الـ prompt. لو الـ AI اقترح حاجات زيادة (queues, caching)، ده تمرين كويس: اكتب ليه مش محتاجها دلوقتي.

## Stretch goal

اكتب في `docs/architecture.md` إيه اللي هيتغير لو المشروع بقى لأكتر من مستخدم. (تلميح: auth، وكل task هيبقى ليها `userId`، وكل query لازم يفلتر بيه.) ده بالظبط اللي بنعمله في ExpensePilot.

## Git commit

```bash
git add docs/architecture.md
git commit -m "docs: add architecture overview and request data flow"
```
