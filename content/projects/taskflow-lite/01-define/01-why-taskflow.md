---
slug: why-taskflow
title: ليه TaskFlow Lite؟ حدد الـ scope قبل ما تكتب سطر كود
order: 1
durationMinutes: 35
isPreview: true
status: PUBLISHED
checkpoints:
  - key: user-stories
    title: عندك 5 user stories على الأقل
    instructions: عندك 5 user stories بصيغة "As a ... I want ... so that ..."، ولكل واحدة acceptance check واحد تقدر تشوفه بعينك في المتصفح. احفظهم في ورقة أو notes أو في المحادثة نفسها. لسه مش محتاج repo؛ هتنقلهم للمشروع في درس "جهز الـ workspace".
  - key: out-of-scope
    title: كتبت قائمة "مش هعمله دلوقتي"
    instructions: في نفس الـ notes، اكتب 3 حاجات على الأقل قررت متعملهاش في النسخة دي (زي login أو مشاركة المهام) وسبب كل واحدة في سطر.
---

## الهدف

تخرج من الدرس ده وإنت عارف **بالظبط** إنت بتبني إيه: 5 user stories، قائمة حاجات مش هتعملها، ورسمة بسيطة على ورقة للشاشة.

**هتشوف في الآخر:** ورقة (أو notes) فيها 5 stories + 3 حاجات out of scope + sketch للصفحة الوحيدة في التطبيق.

**الوقت:** حوالي 35 دقيقة. **مش محتاج:** كود، repo، أو تسطيب أي حاجة.

> **إزاي تستخدم الـ prompts:** انسخ الـ prompt زي ما هو في أي AI chat بتستخدمه (حتى لو مجاني). اللي بين `{{ }}` إنت لازم تغيره بكلامك **بالإنجليزي**. متلصقش أي باسوردات أو بيانات شخصية.

## الخطوات

### 1. اكتب الـ user stories مع الـ AI

**فين:** AI chat.

**إنت تختار:** مين هيستخدم التطبيق ومشكلته إيه. أمثلة: `a university student` + `I forget assignment deadlines`، أو `a freelance designer` + `I lose track of client revisions`.

```text prompt=TF01-1
I'm planning TaskFlow Lite: a personal task manager for ONE user, built later with React, Express and PostgreSQL. I'm a beginner who knows basic JavaScript.
The person who will use it: {{Who will use your app}}.
Their main problem today: {{The problem in one sentence}}.

Give me exactly 5 user stories in the format "As a ..., I want ..., so that ...". Each story must fit a single-page app with: add a task (title, optional description, priority, due date), mark it done, edit, delete, search and filter.
Under each story add ONE acceptance check I can see in the browser, for example: "submitting an empty title shows an error under the field".

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet. Keep it short.
- Don't guess my answers; ask me instead.
- Stop at the end and wait for my reply.
```

**المتوقع:** 5 stories، تحت كل واحدة check واحد.

**اتأكد بنفسك:** اقرا كل check واسأل: "أقدر أشوف ده بعيني في المتصفح؟" لو الإجابة لأ (زي "الفورم يبقى سهل")، اطلب من الـ AI يعيد صياغته.

**وقف لو:** الـ AI كتب كود أو اقترح login وحسابات. قوله: `No code and no login. Single user only.`

### 2. اكتب اللي **مش** هتعمله

**فين:** نفس الـ AI chat.

**إنت تختار:** feature واحدة نفسك تضيفها. أمثلة: `email reminders`، `sharing tasks with friends`، `dark mode`.

```text prompt=TF01-2
Now help me write an "out of scope" list for version 1 of TaskFlow Lite.
A feature I'm tempted to add: {{One feature you are tempted to add}}.

Give me 3 to 5 features I should NOT build now (include mine), each with a one-line reason a junior developer could say in an interview. Login/accounts must be on the list because the app is for one user.
Then tell me in one sentence which ONE of them you would build first in version 2 and why.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet. Keep it short.
- Stop at the end and wait for my reply.
```

**المتوقع:** ليستة قصيرة، كل بند معاه سبب في سطر.

**اتأكد بنفسك:** اقرا السبب بصوت عالي كأنك في إنترفيو: "مش هعمل X دلوقتي لأن Y". لو مش مقتنع بسبب، غيره بكلامك.

**وقف لو:** الليستة طلعت أطول من الـ stories نفسها. اختار أهم 3.

### 3. ارسم الشاشة على ورقة

**فين:** ورقة وقلم (أو Excalidraw مجاني في المتصفح).

**إنت تختار:** ترتيب الحاجات في الصفحة. الشكل اللي هنبنيه في الآخر: فورم "New task" فوق، بعده فلاتر (Search / Status / Priority / Sort)، وتحتهم ليستة المهام.

```text prompt=TF01-3
I'm sketching the single page of TaskFlow Lite on paper before writing any code.
My layout from top to bottom: {{Your layout, e.g. form, filters, task list}}.

Review my layout against my 5 user stories above. Tell me:
1. Which story has no visible place on the page yet.
2. What the page should show when there are no tasks, while loading, and when the server is down (one short line each).
3. One thing to remove to keep version 1 small.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep technical terms in English.
- No code and no files yet. Keep it short.
- Stop at the end and wait for my reply.
```

**المتوقع:** ملاحظات قصيرة على الرسمة + جملة لكل حالة (فاضي / بيحمل / فيه مشكلة).

**اتأكد بنفسك:** حط صباعك على كل story وشاور على مكانها في الرسمة. لو story ملهاش مكان، ضيفلها مكان أو شيلها.

**وقف لو:** رسمت أكتر من صفحة واحدة. TaskFlow Lite صفحة واحدة بس.

## خلصت الدرس لما

- عندك 5 stories بـ checks تتشاف بالعين.
- عندك 3 حاجات out of scope بأسبابها.
- عندك رسمة واحدة للصفحة. صورها بالموبايل؛ هتحتاجها في الـ README بعدين.

## ملاحظات تقنية (اختياري)

- **ليه scope قبل الكود؟** كل قرار بعد كده (الداتابيز، الـ API، الفورم) مبني عليه. من غيره هتقع في **scope creep**: كل يوم feature جديدة ومفيش نهاية.
- **Story تقنية مش story:** "I want a POST endpoint" ده مش كلام مستخدم. المستخدم ميعرفش يعني إيه endpoint.
