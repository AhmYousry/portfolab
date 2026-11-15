---
slug: components
title: قسم الـ UI لـ components وابني الفورم
order: 1
durationMinutes: 75
status: PUBLISHED
checkpoints:
  - key: component-map
    title: رسمت خريطة الـ components
    instructions: في `docs/frontend.md` اكتب كل component، الـ props بتاعته، والـ state اللي هو مسؤول عنه.
  - key: form-validation
    title: الفورم بيعمل validation ويعرض الخطأ
    instructions: الضغط على "Add task" بعنوان فاضي بيعرض "Title is required" تحت الحقل ومبيبعتش request. شغل `npx vitest run` جوه `client` وتأكد إن `TaskForm.test.jsx` بيعدي.
  - key: labels
    title: كل input ليه label
    instructions: كل input وselect في الفورم ليه `<label htmlFor>` مربوط بالـ `id` بتاعه. جرب تتنقل في الفورم بالـ Tab بس.
---

## الهدف من الدرس

تقسم الشاشة لـ components صغيرة، كل واحد مسؤول عن حاجة واحدة، وتبني `TaskForm` بـ validation وaccessibility صح.

**الوقت المتوقع:** ساعة وربع.

## الخريطة

```text
App                 ← يملك: tasks, filters, request status, editing
├── TaskForm        ← يملك: قيم الفورم، أخطاء الحقول، submitting
├── Filters         ← مفيش state؛ بياخد value ويبعت onChange
└── TaskList        ← مفيش state؛ بيعرض وبيبعت events
```

**قاعدة:** الـ state يعيش في **أقرب component** محتاجه. الـ `tasks` في `App` لأن `TaskList` بيعرضها و`TaskForm` بيأثر فيها.

## TaskForm خطوة بخطوة

### 1. الـ state

```js
const [values, setValues] = useState(() => initialValues(task))
const [errors, setErrors] = useState({})
const [submitting, setSubmitting] = useState(false)
const [serverError, setServerError] = useState('')
```

أربع حاجات مختلفة: قيم، أخطاء الحقول، هل بنحفظ دلوقتي، وخطأ راجع من الـ server.

### 2. الـ validation في الـ client

افصل الـ validation في function عادية عشان تقدر تختبرها لوحدها:

```js spoiler
// client/src/components/TaskForm.jsx
export function validateTask(values) {
  const errors = {}
  const title = values.title.trim()
  if (!title) errors.title = 'Title is required'
  else if (title.length > TITLE_MAX) errors.title = `Title must be ${TITLE_MAX} characters or less`
  return errors
}
```

### 3. الـ accessibility

دي مش "تحسينات"؛ دي جزء من إن الفورم شغال:

```jsx
<label htmlFor="title">Title</label>
<input
  id="title"
  value={values.title}
  onChange={update('title')}
  aria-invalid={Boolean(errors.title)}
  aria-describedby={errors.title ? 'title-error' : undefined}
/>
{errors.title && <p id="title-error" className="field-error">{errors.title}</p>}
```

- `htmlFor` + `id`: الضغط على الـ label يركز على الحقل، والـ screen reader يقرا الاسم.
- `aria-invalid` و`aria-describedby`: الـ screen reader يقول إن في خطأ ويقرأه.
- `noValidate` على الـ `<form>`: عشان رسايلنا تظهر بدل رسايل المتصفح المختلفة.

### 4. الـ submit

```js spoiler
// client/src/components/TaskForm.jsx
async function handleSubmit(event) {
  event.preventDefault()
  const found = validateTask(values)
  setErrors(found)
  if (Object.keys(found).length > 0) return

  setSubmitting(true)
  setServerError('')
  try {
    await onSave({
      title: values.title.trim(),
      description: values.description.trim() || null,
      status: values.status,
      priority: values.priority,
      dueDate: values.dueDate || null,
    })
    if (!task) setValues(initialValues(null))
  } catch (err) {
    setServerError(err.message)
  } finally {
    setSubmitting(false)
  }
}
```

لاحظ: الـ `description` الفاضي بيتبعت `null` مش `""`، والـ `dueDate` الفاضي `null`. ده بيطابق الـ contract.

### 5. Edit mode

الفورم نفسه بيستخدم للإضافة والتعديل. في `App` بنستخدم `key`:

```jsx
<TaskForm key={editing?.id ?? 'new'} task={editing} onSave={handleSave} onCancel={() => setEditing(null)} />
```

تغيير الـ `key` بيخلي React يعمل الفورم من الأول بالقيم الجديدة. أبسط من `useEffect` بيزامن الـ state.

## أخطاء شائعة

- **`placeholder` بدل `label`:** الـ placeholder بيختفي لما تكتب، ومش كل screen readers بتقراه.
- **زرار Submit مش disabled أثناء الحفظ:** المستخدم يضغط مرتين وتتعمل مهمتين.
- **الاعتماد على validation الـ client بس:** افتكر Module 1.

## AI mentor prompt (F05)

```text
Break my TaskFlow Lite React UI into small components and state responsibilities. Explain form validation, loading, empty and error states. Give an implementation order.
```

## Git commit

```bash
git add client/src/components docs/frontend.md
git commit -m "feat(ui): add accessible task form with client-side validation"
```
