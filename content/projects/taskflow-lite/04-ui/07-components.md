---
slug: components
title: قسم الـ UI لـ components وابني الفورم
order: 1
durationMinutes: 75
status: PUBLISHED
checkpoints:
  - key: component-map
    title: رسمت خريطة الـ components
    instructions: في `docs/frontend.md` كتبت كل component (App, TaskForm, Filters, TaskList)، الـ props بتاعته، والـ state اللي هو مسؤول عنه.
  - key: form-validation
    title: الفورم بيعمل validation ويعرض الخطأ
    instructions: على http://localhost:5174 الضغط على "Add task" بعنوان فاضي بيعرض "Title is required" تحت الحقل ومبيطبعش "TODO save" في الـ Console. وجوه فولدر `client` الأمر `npx vitest run` بيعدي كل تستات `TaskForm.test.jsx`.
  - key: labels
    title: كل input ليه label
    instructions: كل input وselect في الفورم ليه `<label htmlFor>` مربوط بالـ `id` بتاعه. الضغط على كلمة "Priority" بيركز على الـ select، وتقدر تتنقل في الفورم بالـ Tab بس.
---

## الهدف

تبني فورم "New task" كامل: كل الحقول، رسالة خطأ واضحة، وaccessibility صح.

**هتشوف في الآخر:** على http://localhost:5174 الفورم فيه Title, Description, Status, Priority, Due date. لو ضغطت **Add task** والعنوان فاضي، هتشوف `Title is required` تحت الحقل.

**الوقت:** حوالي ساعة وربع.

**الحالة دلوقتي بصراحة:** الفورم مش هيحفظ في الداتابيز لسه. `handleSave` في `App.jsx` بيطبع `TODO save` في الـ Console بس. الربط الحقيقي في Module 5.

شغل الواجهة لو مش شغالة: من فولدر المشروع الرئيسي `npm run dev:client`.

## الخطوات

### 1. خريطة الـ components

**فين:** AI chat، بعدين المحرر ← ملف جديد `docs/frontend.md`.

**إنت تختار:** تخمينك: الـ state بتاع "المهمة اللي بعدلها دلوقتي" يعيش فين؟ `App` ولا `TaskForm` ولا `TaskList`؟

```text prompt=TF07-1
TaskFlow Lite's React client has these files in client/src: App.jsx, api.js, components/TaskForm.jsx, components/Filters.jsx (already done, no state), components/TaskList.jsx.
My guess for where "the task I'm currently editing" state should live: {{App, TaskForm or TaskList}}.

Give me a small component map as a tree. For each component list: props, the state it owns (or "none"), and the events it sends up. Then tell me if my guess is right using the rule "state lives in the closest component that needs it".

Rules for your answer:
- Explain in simple Egyptian Arabic; keep component, prop and file names in English.
- No code yet; just the map and the short answer.
- Stop at the end and wait for me to verify.
```

**المتوقع:** شجرة: `App` فوق (بيملك tasks, filters, request status, editing)، وتحته `TaskForm` و`Filters` و`TaskList`.

**اتأكد بنفسك:** الصق الشجرة في `docs/frontend.md`. لازم `Filters` و`TaskList` يبقى قصادهم "no state".

**وقف لو:** الـ AI اقترح Redux أو Context. مش محتاجينهم لصفحة واحدة.

### 2. ابني الفورم

**فين:** المحرر ← `client/src/components/TaskForm.jsx`.

**إنت تختار:** الـ priority الافتراضية اللي هتظهر في الفورم. لازم تبقى `MEDIUM` عشان تطابق الـ API والـ tests؛ إنت تختار **ترتيب** الحقول تحت الـ Title.

```text prompt=TF07-2
I'm on the "components" step of TaskFlow Lite. Edit only client/src/components/TaskForm.jsx (React 19). Keep the exported validateTask function and the default export.
Order I want for the fields after Title: {{Your field order, e.g. Priority, Due date, Status, Description}}.

Implement:
- validateTask(values): { title: 'Title is required' } for a blank title, a max-120 message for long titles, {} otherwise.
- Fields with <label htmlFor> and matching id: Title, Description (textarea), Status (TODO default), Priority (MEDIUM default; the label text must be exactly "Priority"), Due date (type="date").
- On submit: validate first; if there are errors, show the title error under the field with aria-invalid and aria-describedby, and do NOT call onSave.
- Otherwise call onSave with { title trimmed, description trimmed or null, status, priority, dueDate or null }.
- Disable the submit button while saving. If onSave throws, show err.message in an element with role="alert". The button text stays "Add task".
Leave edit mode (a task prop and a Cancel button) for a later lesson.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only this file.
- If you can edit my files, show the diff. If you can't, give me the exact final content of this one file.
- Don't add dependencies, and never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الصفحة اتحدثت لوحدها (Vite) والفورم بقى فيه 5 حقول.

**اتأكد بنفسك:** اضغط **Add task** والعنوان فاضي: `Title is required` ظهرت، والـ Console **مفيهوش** `TODO save` جديد. اكتب عنوان واضغط تاني: الـ Console فيه `TODO save` ومعاه object فيه `title` و`priority` و`dueDate`.

**وقف لو:** الـ AI عدل `App.jsx`. ده مش الخطوة دي.

### 3. شغل تستات الفورم وجرب بالكيبورد

**فين:** terminal في فولدر `client`، بعدين المتصفح.

**إنت تختار:** عنوان تجربه في الفورم بمسافات في الأول والآخر، زي `  Call the bank  `، عشان تشوف الـ trim.

```bash
cd client
npx vitest run
```

```text prompt=TF07-3
I ran `npx vitest run` in the client folder of TaskFlow Lite.
Result (summary line, or the first failing test with expected vs received): {{Paste the test summary or first failure}}.
In the browser I typed the title "{{Your title with spaces around it}}" and the console printed: {{Paste the TODO save line}}.

Explain what each of the 4 tests in TaskForm.test.jsx proves. If one failed, point to the exact line in TaskForm.jsx to change and the smallest fix. Also confirm whether my console output shows the title was trimmed.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Fix only what a failing test needs, in TaskForm.jsx only.
- If you can edit my files, show the diff. If you can't, show me exactly what to change.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** `4 passed`.

**اتأكد بنفسك:** اضغط على كلمة **Priority** في الصفحة: الـ select لازم ياخد focus. وبعدين اتنقل بالـ Tab بس من Title لحد زرار Add task.

**وقف لو:** test بيدور على `Priority` ومش لاقيه. الـ label لازم يبقى النص `Priority` بالظبط ومربوط بـ `htmlFor`.

```bash
git add client/src/components docs/frontend.md
git commit -m "feat(ui): add accessible task form with client-side validation"
```

## ملاحظات تقنية (اختياري)

- **`placeholder` مش بديل عن `label`:** بيختفي لما تكتب، ومش كل screen readers بتقراه.
- **`noValidate` على الـ form:** عشان رسايلك إنت تظهر بدل رسايل المتصفح المختلفة.
- **الـ description الفاضي بيتبعت `null` مش `""`** عشان يطابق الـ contract.
