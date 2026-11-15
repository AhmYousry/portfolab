---
slug: why-taskflow
title: ليه TaskFlow Lite؟ حدد الـ scope قبل ما تكتب سطر كود
order: 1
durationMinutes: 35
isPreview: true
status: PUBLISHED
checkpoints:
  - key: user-stories
    title: كتبت 5 user stories على الأقل
    instructions: اكتب في ملف `docs/scope.md` في الـ repo بتاعك 5 user stories بصيغة "كـ ... عايز ... عشان ...". كل story لازم يبقى ليها acceptance criteria واحد على الأقل تقدر تختبره.
  - key: out-of-scope
    title: كتبت قائمة "مش هعمله دلوقتي"
    instructions: في نفس الملف، اكتب 3 حاجات على الأقل قررت متعملهاش في النسخة دي (مثلًا login أو مشاركة المهام) وسبب كل واحدة في سطر.
---

## الهدف من الدرس

في آخر الدرس ده هيكون عندك **scope مكتوب** لمشروع TaskFlow Lite: user stories، acceptance criteria، وقائمة واضحة بالحاجات اللي **مش** هتعملها. ده أول ملف في الـ repo بتاعك، وأول حاجة الإنترفيور ممكن يسألك عنها.

**المتطلبات:** تعرف أساسيات JavaScript وHTML/CSS وGit.
**الوقت المتوقع:** حوالي 35 دقيقة.

## المشكلة

أحمد عنده 17 calculator app على GitHub. كلهم شبه بعض، وكلهم frontend بس. لما الإنترفيور سأله "الداتا بتتخزن فين؟" سكت.

المشكلة مش إن أحمد مش شاطر. المشكلة إنه دايمًا بيبدأ بالكود قبل ما يحدد هو بيبني إيه. النتيجة: مشاريع ملهاش نهاية واضحة، ومفيش حاجة يقدر يشرحها.

**TaskFlow Lite** مشروع صغير بالقصد: task manager لشخص واحد. صغير كفاية إنك تخلصه، وكامل كفاية إنه يلمس كل طبقة في أي تطبيق full stack حقيقي:

- **Frontend** بيعرض ويجمع البيانات من المستخدم.
- **API** بيتأكد إن البيانات سليمة وبيقرر يرد بإيه.
- **Database** بتحفظ البيانات بحيث متضيعش لما تعمل refresh.

## ليه نبدأ بالـ scope؟

لأن كل قرار تقني بعد كده بيعتمد عليه. لو مش عارف هل في "due date" ولا لأ، مش هتعرف تصمم الـ database. ولو مش عارف هل في login ولا لأ، مش هتعرف تقدر حجم الشغل.

الـ scope كمان بيحميك من **scope creep**: إنك كل شوية تضيف feature جديدة ومتخلصش أبدًا.

## الخطوات

### 1. اكتب الـ user stories

الصيغة: **كـ [مين] عايز [إيه] عشان [ليه]**. الـ "ليه" مهمة؛ هي اللي بتخليك تفرق بين feature مهمة وfeature "حلوة وخلاص".

أمثلة للبداية (اكتب نسختك بكلامك):

1. كمستخدم، عايز أضيف task بعنوان، عشان مانساش الحاجات اللي ورايا.
2. كمستخدم، عايز أحدد priority وdue date، عشان أعرف أبدأ بإيه.
3. كمستخدم، عايز أعلم على الـ task إنها خلصت، عشان أشوف أنا ماشي فين.
4. كمستخدم، عايز أدور وأفلتر المهام، عشان ألاقي اللي محتاجه بسرعة.
5. كمستخدم، عايز المهام تفضل موجودة بعد ما أقفل المتصفح، عشان أقدر أعتمد على التطبيق.

### 2. حط acceptance criteria لكل story

الـ acceptance criteria لازم تبقى **حاجة تقدر تشوفها أو تختبرها**، مش إحساس.

| Story | Acceptance criteria |
|---|---|
| إضافة task | لو العنوان فاضي، الفورم يرفض ويقول السبب. لو سليم، الـ task تظهر في الليستة. |
| خلصت | الضغط على checkbox يغير الحالة لـ DONE، ولما أعمل refresh تفضل DONE. |
| فلترة | اختيار priority = HIGH يعرض الـ HIGH بس. |

### 3. اكتب اللي مش هتعمله

ده جزء محترفين كتير بيتجاهلوه. في النسخة دي **مش** هنعمل:

- تسجيل دخول وحسابات (التطبيق لمستخدم واحد).
- مشاركة المهام مع ناس تانية.
- إشعارات وتذكيرات.
- Pagination (ليستة شخصية مش هتوصل لآلاف المهام).

كتابة ده بتخليك تقدر تقول في الإنترفيو: "اخترت متعملش X لأن Y، ولو هكبر المشروع هبدأ بـ Z". ده كلام Junior فاهم.

## النتيجة المتوقعة

ملف `docs/scope.md` فيه حوالي صفحة واحدة: 5+ user stories، acceptance criteria، وقائمة out-of-scope.

## أخطاء شائعة

- **Stories تقنية:** "عايز أعمل POST endpoint" مش user story. المستخدم مش عارف يعني إيه endpoint.
- **Acceptance criteria مبهمة:** "الفورم يبقى سهل" مينفعش تختبره. "الفورم يعرض رسالة خطأ تحت الحقل الفاضي" ينفع.
- **Scope كبير:** لو لقيت نفسك كاتب 15 story، اختار أهم 5–7 والباقي out of scope.

## AI mentor prompt (F01)

استخدم الـ prompt ده مع أي AI assistant. لاحظ إنه بيطلب أسئلة الأول ومش بيطلب كود:

```text
Act as a senior full-stack mentor. I know basic JavaScript. Help me scope TaskFlow Lite into a buildable MVP. Ask up to 5 clarifying questions, then give user stories, out-of-scope features, and an acceptance checklist. Don't write the app for me.
```

بعد ما يرد، **قارن** رده باللي كتبته. متنسخش. لو اقترح حاجة مش مقتنع بيها، اكتب ليه رفضتها.

## Stretch goal

ارسم wireframe على ورقة (أو Excalidraw) لصفحة واحدة: فورم فوق، فلاتر، وليستة المهام. صوره وحطه في `docs/wireframe.png`.

## Git commit

```bash
git add docs/scope.md
git commit -m "docs: define TaskFlow Lite MVP scope and user stories"
```
