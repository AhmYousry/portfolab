---
slug: connect-frontend
title: اربط الـ frontend بالـ API
order: 1
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: persists
    title: المهمة بتفضل موجودة بعد refresh
    instructions: ضيف مهمة، علم عليها DONE، اعمل refresh للصفحة - لازم تفضل موجودة وDONE. اقفل الـ server وافتحه تاني - برضه موجودة.
  - key: server-errors-shown
    title: أخطاء الـ server بتظهر للمستخدم
    instructions: عطل الـ client validation مؤقتًا وابعت عنوان فاضي - لازم رسالة الـ server تظهر في الفورم (role="alert"). رجع الـ validation بعدها.
---

## الهدف من الدرس

الـ UI يتكلم مع الـ API الحقيقي، والبيانات تعيش في PostgreSQL، وأخطاء الـ server توصل للمستخدم بشكل مفهوم.

**الوقت المتوقع:** ساعة.

## الخطوات

### 1. API client صغير

حط كل كلام الـ HTTP في ملف واحد (`client/src/api.js`). الـ components متعرفش حاجة عن `fetch`:

```js spoiler
// client/src/api.js
async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  })
  if (res.status === 204) return null
  const body = await res.json().catch(() => null)
  if (!res.ok) {
    throw new ApiError(res.status, body?.error?.message ?? 'Request failed', body?.error?.details)
  }
  return body.data
}
```

نقطتين:

- `fetch` **مبيرميش** exception على 400 أو 500. لازم تشيك `res.ok` بنفسك.
- `encodeURIComponent(id)` لما تحط الـ id في الـ URL.

### 2. الـ proxy في التطوير

الـ client على 5174 والـ API على 3001. بدل ما نفتح CORS على كل حاجة، الـ Vite dev server بيعمل proxy:

```js
// client/vite.config.js
server: { port: 5174, proxy: { '/api': API_URL } }
```

فالمتصفح شايف كله جاي من 5174. في الإنتاج هنظبط `CLIENT_ORIGIN` في الـ API.

### 3. App: load + handlers

```js spoiler
// client/src/App.jsx
const load = useCallback(async (activeFilters) => {
  setStatus('loading')
  try {
    setTasks(await fetchTasks(activeFilters))
    setStatus('ready')
  } catch (err) {
    setError(err.message)
    setStatus('error')
  }
}, [])

async function handleToggle(task) {
  await updateTask(task.id, { status: task.status === 'DONE' ? 'TODO' : 'DONE' })
  await load(filters)
}

async function handleDelete(task) {
  if (!window.confirm(`Delete "${task.title}"?`)) return
  await deleteTask(task.id)
  await load(filters)
}
```

إعادة التحميل بعد كل تغيير أبسط وأضمن من إنك تعدل الـ array محليًا. لما الليستة تكبر، ممكن تفكر في optimistic updates (ده موضوع Pro).

### 4. اختبر بإيدك زي المستخدم

اعمل الـ checkpoints بالترتيب. افتح DevTools → Network وشوف كل request: الـ method، الـ status، والـ response.

## أخطاء شائعة

| العرض | السبب |
|---|---|
| `Failed to fetch` | الـ server مش شغال، أو بتنادي `http://localhost:3001` مباشرة من غير CORS |
| الليستة مبتتحدثش بعد الإضافة | نسيت `await load(filters)` |
| `Unexpected end of JSON input` | بتعمل `res.json()` على 204 |
| المهمة اتضافت مرتين | الزرار مش disabled أثناء الحفظ |

## AI mentor prompt (F07)

```text
I'm seeing [error] when [steps]. Here are logs and relevant code: [paste, with secrets removed]. Rank likely causes, suggest minimal reproduction, and tell me what to inspect before changing code.
```

## Git commit

```bash
git add client/src
git commit -m "feat: connect React UI to the tasks API"
```
