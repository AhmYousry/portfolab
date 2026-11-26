---
slug: connect-frontend
title: اربط الـ frontend بالـ API
order: 1
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: persists
    title: المهمة بتفضل موجودة بعد refresh
    instructions: ضفت مهمة من الفورم، علمت عليها DONE، وعملت refresh - لسه موجودة وDONE. وقفت الـ server وشغلته تاني - برضه موجودة. وفي DevTools ← Network شفت `POST /api/tasks` رجع `201` و`PATCH` رجع `200`.
  - key: server-errors-shown
    title: أخطاء الـ server بتظهر للمستخدم
    instructions: عطلت الـ client validation مؤقتًا وبعت عنوان فاضي - رسالة الـ server "Validation failed" ظهرت في الفورم (role="alert") والـ Network بيقول `400`. رجعت الـ validation بعدها.
---

## الهدف

الواجهة تتكلم مع الـ API بالكامل: تضيف، تعلم DONE، تعدل، وتمسح، والبيانات تعيش في PostgreSQL.

**هتشوف في الآخر:** تضيف مهمة من http://localhost:5174، تعمل refresh، وتلاقيها لسه موجودة. ده أول مرة التطبيق كله شغال من أوله لآخره.

**الوقت:** حوالي ساعة.

**محتاج شغال:** الـ `db` في Docker، و`npm run dev:server` و`npm run dev:client` من فولدر المشروع الرئيسي.

`client/src/api.js` جاهز في الـ starter: فيه `createTask` و`updateTask` و`deleteTask`، وبيرمي `ApiError` فيه رسالة الـ server لما الـ response مش `ok`.

## الخطوات

### 1. الإضافة بتحفظ بجد

**فين:** المحرر ← `client/src/App.jsx`، بعدين المتصفح.

**إنت تختار:** أول مهمة حقيقية هتضيفها من الفورم بعد التعديل.

```text prompt=TF09-1
I'm on the "connect-frontend" step of TaskFlow Lite. Edit only client/src/App.jsx. It already has tasks, a request status, load(filters) and the debounce from the previous lesson. client/src/api.js exports createTask, updateTask, deleteTask and fetchTasks.
The first real task I'll add after this change: "{{Your task title}}".

Replace the console.log in handleSave: call createTask(input), then reload with load(filters). Let errors bubble up so TaskForm can show them in its role="alert".
Explain why reloading the list after saving is simpler and safer for now than editing the array by hand.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only handleSave in App.jsx.
- If you can edit my files, show the diff. If you can't, show me exactly what to replace.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** تكتب العنوان وتضغط **Add task**: المهمة تظهر في الليستة والفورم يتفضى.

**اتأكد بنفسك:** DevTools ← Network: `POST /api/tasks` بـ `201`، وبعده `GET /api/tasks`. اعمل refresh: المهمة لسه موجودة.

**وقف لو:** المهمة اتضافت مرتين. الزرار مش disabled أثناء الحفظ (راجع `TaskForm.jsx`).

### 2. DONE والحذف

**فين:** نفس الملف `client/src/App.jsx`، بعدين المتصفح.

**إنت تختار:** نص رسالة التأكيد قبل الحذف. مثال: `Delete "<title>"?`

```text prompt=TF09-2
Still client/src/App.jsx in TaskFlow Lite. Implement handleToggle and handleDelete and pass them to TaskList instead of the empty functions.
My delete confirmation text: "{{Your delete confirmation text}}".

- handleToggle(task): PATCH only { status } to DONE, or back to TODO if it was DONE, using updateTask; then reload.
- handleDelete(task): ask with window.confirm using my text (include the task title); if confirmed, call deleteTask, then reload.
If a request fails, show the message using the existing error state instead of crashing.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only App.jsx.
- If you can edit my files, show the diff. If you can't, show me exactly what to change.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** الـ checkbox بيحول المهمة لـ DONE، وDelete بيسأل الأول وبعدين يمسح.

**اتأكد بنفسك:** علم مهمة DONE، اعمل refresh: لسه DONE. وقف الـ server وشغله تاني، refresh: لسه DONE. في Network: `PATCH` بـ `200` و`DELETE` بـ `204`.

**وقف لو:** الـ Console فيه `Unexpected end of JSON input` بعد الحذف. ده معناه إن حد بيعمل `res.json()` على `204`؛ `api.js` الأصلي بيتعامل مع ده، فاتأكد إنك مغيرتهوش.

### 3. التعديل (Edit)

**فين:** المحرر ← `client/src/App.jsx` و`client/src/components/TaskForm.jsx`، بعدين المتصفح.

**إنت تختار:** عنوان الفورم في وضع التعديل. الافتراضي: `Edit task`. زرار الإضافة يفضل نصه `Add task` في الوضع العادي (الـ tests بتدور عليه).

```text prompt=TF09-3
Add edit mode to TaskFlow Lite. Files: client/src/App.jsx and client/src/components/TaskForm.jsx only.
Form heading while editing: "{{Your edit heading}}".

- App: keep an `editing` task state (null by default). TaskList's onEdit sets it. Render <TaskForm key={editing?.id ?? 'new'} task={editing} onSave={...} onCancel={() => setEditing(null)} />. When editing, save with updateTask(editing.id, input), clear editing, then reload.
- TaskForm: accept optional task and onCancel props; start values from the task when given; show my heading and a "Save changes" button plus a Cancel button while editing; keep "New task" and "Add task" otherwise; reset the form after adding but not after editing.
Explain why changing the key is simpler than syncing state with useEffect.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Do this step only. Touch only these two files, and keep the existing TaskForm tests passing.
- If you can edit my files, show the diff per file. If you can't, give me exact instructions one file at a time.
- Tell me which test command to re-run and in which folder.
- Never say you ran or tested something you didn't.
- Stop when this step is done and wait for me to verify.
```

**المتوقع:** تضغط **Edit** على مهمة: الفورم يتملي بقيمها. تغير العنوان وتحفظ: الليستة تتحدث.

**اتأكد بنفسك:** جوه `client` شغل `npx vitest run`: لسه `4 passed`. وفي Network: `PATCH /api/tasks/<id>` بـ `200`.

**وقف لو:** الفورم مبيتمليش لما تدوس Edit على مهمة تانية. الـ `key` مش متغير.

### 4. خلي خطأ الـ server يظهر

**فين:** المحرر ← `client/src/components/TaskForm.jsx` (تعديل مؤقت)، بعدين المتصفح.

**إنت تختار:** هتعطل الـ validation إزاي مؤقتًا. الأسهل: تعمل comment للسطر اللي بيعمل `return` لو في errors في `handleSubmit`.

```text prompt=TF09-4
I want to prove that TaskFlow Lite shows server errors to the user. I'll temporarily disable the client-side check in client/src/components/TaskForm.jsx, submit an empty title, then restore it.
The line I plan to comment out: {{Paste the one line you plan to disable}}.

Tell me: is this the right line to disable (and nothing else)? What exact request and status should I see in the Network tab, what text should appear in the role="alert", and which server file produced that message? Remind me to restore the line afterwards.

Rules for your answer:
- Explain in simple Egyptian Arabic; keep code, file paths and commands in English.
- Don't edit anything yourself; this is a temporary manual experiment.
- Never say you ran or tested something you didn't.
- Stop and wait for me to verify.
```

**المتوقع:** Network: `POST /api/tasks` بـ `400`. الفورم يعرض `Validation failed`.

**اتأكد بنفسك:** رجّع السطر، واتأكد إن `Title is required` رجعت تظهر، و`npx vitest run` جوه `client` لسه أخضر.

**وقف لو:** نسيت ترجع السطر. متعملش commit قبل ما ترجعه.

```bash
git add client/src
git commit -m "feat: connect React UI to the tasks API"
```

## ملاحظات تقنية (اختياري)

- **`fetch` مبيرميش exception على 400 أو 500.** `api.js` بيشيك `res.ok` بنفسه ويرمي `ApiError`.
- **الـ proxy:** الـ client على 5174 والـ API على 3001. `client/vite.config.js` بيحول `/api` لـ 3001، فالمتصفح شايف كله من 5174 ومش محتاج CORS في التطوير.
- **`Failed to fetch` أو `Request failed`:** غالبًا الـ server مش شغال.
