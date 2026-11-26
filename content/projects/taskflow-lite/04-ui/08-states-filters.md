---
slug: states-filters
title: Loading وEmpty وError والفلاتر
order: 2
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: three-states
    title: الـ UI بيتعامل مع loading وempty وerror
    instructions: وقفت الـ server (`Ctrl+C`) وعملت refresh لـ http://localhost:5174 - ظهرت رسالة خطأ وزرار "Try again". شغلته تاني وضغطت الزرار - الليستة رجعت. بحثت بكلمة مش موجودة - ظهرت رسالة الـ empty state.
  - key: filters-work
    title: الفلاتر والبحث شغالين
    instructions: البحث بكلمة، الفلترة بـ Status وPriority، والترتيب بالـ Due date - كلهم بيغيروا الليستة في الصفحة، وفي DevTools ← Network بتشوف request لـ `/api/tasks` بالـ query الجديد.
---

## الهدف

الصفحة تعرض المهام الحقيقية من الـ API، وتقول للمستخدم الحقيقة في كل لحظة: بيحمل، فاضي، في مشكلة، أو جاهز.

**هتشوف في الآخر:** المهام اللي عملتها بـ `curl` في درس الـ CRUD ظاهرة في http://localhost:5174، والفلاتر بتغيرها، ولو وقفت الـ server تظهر رسالة خطأ وزرار **Try again**.

**الوقت:** حوالي ساعة.

**الحالة دلوقتي بصراحة:** الإضافة والتعديل والحذف من الواجهة لسه مش شغالين (الدرس الجاي). لو عايز مهام تجرب بيها، ضيفها بـ `curl` زي درس الـ CRUD.

**محتاج شغال:** `npm run dev:server` و`npm run dev:client` من فولدر المشروع الرئيسي، والـ `db` في Docker.

## الخطوات

### 1. حمّل المهام بـ request status واحد

**فين:** المحرر ← `client/src/App.jsx`، بعدين المتصفح.

**إنت تختار:** نص رسالة التحميل. الافتراضي: `Loading tasks…`.

```text prompt=TF08-1
I'm on the "states-filters" step of TaskFlow Lite. Edit only client/src/App.jsx (React 19). client/src/api.js already exports fetchTasks(filters); the Vite dev server proxies /api to the Express API on port 3001.
My loading text: "{{Your loading text}}".

Implement only loading:
- Make tasks real state and add ONE request status: 'loading' | 'ready' | 'error', plus an error message.
- A load(filters) function (useCallback) that calls fetchTasks and sets the status.
- Load on first render and whenever filters change, with a small debounce (a named constant around 250 ms) and a cleanup that clears the timer.
- Render: loading text with role="status"; an error box with role="alert" showing the message and a "Try again" button that calls load(filters); TaskList only when ready.
Keep handleSave as it is and keep the empty handlers passed to TaskList. Explain why one status is safer than separate isLoading/hasError booleans.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only App.jsx.
- If you can edit my files, show the diff. If you can't, give me the exact final content of this one file.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الصفحة بتعرض `Loading tasks…` لحظة، وبعدين `TODO: empty state` أو ليستة فاضية (لأن `TaskList` لسه مش بيرسم المهام).

**اتأكد بنفسك:** وقف الـ server بـ `Ctrl+C` واعمل refresh: لازم تشوف رسالة خطأ وزرار **Try again**. شغل `npm run dev:server` تاني واضغط **Try again**: الخطأ يختفي.

**وقف لو:** الصفحة بتبعت requests من غير توقف (شوف Network). غالبًا الـ `useEffect` dependencies غلط.

### 2. اعرض المهام والـ empty state

**فين:** المحرر ← `client/src/components/TaskList.jsx`، بعدين المتصفح.

**إنت تختار:** نص الـ empty state. لازم يقول للمستخدم يعمل إيه، ويفكره إن الفلتر ممكن يكون السبب. مثال: `No tasks yet. Add your first one above, or clear the filters.`

```text prompt=TF08-2
Still TaskFlow Lite. Edit only client/src/components/TaskList.jsx. Props: tasks, onEdit, onToggle, onDelete. Each task has id, title, description, status (TODO/IN_PROGRESS/DONE), priority (LOW/MEDIUM/HIGH), dueDate ("YYYY-MM-DD" or null).
My empty-state text: "{{Your empty-state text}}".

Implement:
- Empty state: a <p className="empty" role="status"> with my text when tasks is empty.
- Otherwise one <li> per task (key = id) with: a checkbox checked when DONE that calls onToggle(task) and has an aria-label naming the task; the title; the description if present; a priority badge; a readable status; "Due <date>" if present; Edit and Delete buttons calling onEdit(task) and onDelete(task).
Use the class names already in client/src/styles.css where they fit.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only TaskList.jsx.
- If you can edit my files, show the diff. If you can't, give me the exact final content of this one file.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** المهام اللي في الداتابيز بقت ظاهرة في الصفحة، كل واحدة بالـ priority والتاريخ.

**اتأكد بنفسك:** قارن عدد المهام في الصفحة بعددها في http://localhost:3001/api/tasks. لازم يبقوا زي بعض. الـ checkbox وEdit وDelete **مش** هيعملوا حاجة لسه؛ ده طبيعي.

**وقف لو:** شفت `Each child in a list should have a unique "key"` في الـ Console. ناقص `key={task.id}`.

### 3. اتأكد إن الفلاتر بتغير الليستة

**فين:** المتصفح ← DevTools ← Network، والمحرر لو احتجت تصلح.

**إنت تختار:** كلمة بحث موجودة في واحدة من مهامك، وكلمة مش موجودة خالص.

`Filters.jsx` جاهز ومبيملكش state؛ بيبعت object جديد لـ `App` في `onChange`. جرب في الصفحة: اكتب كلمة البحث، غير Status وPriority، واختار **Due date (soonest)**.

```text prompt=TF08-3
I'm testing filters in TaskFlow Lite in the browser with DevTools > Network open.
Search word that exists in one task: "{{A word that exists in your tasks}}". Search word that exists nowhere: "{{A word that exists nowhere}}".
The /api/tasks request URLs I see in the Network tab: {{Paste 2 or 3 request URLs}}.

Explain what each query parameter in my URLs means, why I see one request after I stop typing instead of one per letter, and why the empty-state text should mention clearing filters. If something looks wrong, tell me which ONE file to check and what to look for.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Don't change any file unless something is actually broken; then fix only one file and show the diff.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** الكلمة الموجودة بتسيب مهمة واحدة. الكلمة اللي مش موجودة بتعرض الـ empty state. في Network بتشوف حاجة زي `/api/tasks?search=bank&sort=-createdAt`.

**اتأكد بنفسك:** افتح DevTools ← device toolbar وخلي العرض 360px. الفلاتر لازم تنزل تحت بعض ومفيش scroll أفقي.

**وقف لو:** الـ error box فاضل ظاهر بعد ما الليستة نجحت. اعتمد على `status` بس في الرسم.

```bash
git add client/src
git commit -m "feat(ui): handle loading, empty and error states; add filters and search"
```

## ملاحظات تقنية (اختياري)

- **`role="status"` و`role="alert"`** بيخلوا الـ screen reader يعلن التغيير من غير ما المستخدم يدور.
- **Race condition:** لو كتبت بسرعة، response قديم ممكن يوصل بعد الجديد. الـ debounce بيقلل ده. (Stretch: `AbortController` في `fetchTasks`.)
