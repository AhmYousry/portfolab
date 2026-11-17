---
slug: crud-endpoints
title: ابني الـ CRUD endpoints
order: 3
durationMinutes: 90
status: PUBLISHED
checkpoints:
  - key: crud-works
    title: الخمس endpoints شغالين
    instructions: جربت بـ curl أو Thunder Client - create وlist وget وpatch وdelete - وكل واحد رجع الـ status code اللي في الـ contract.
  - key: invalid-400
    title: input غلط بيرجع 400
    instructions: 'بعت `POST /api/tasks` بعنوان فاضي وبـ `{"status": "DOING"}` ورجعلك 400 مع `details` بتحدد الحقل.'
  - key: acceptance-tests
    title: الـ acceptance tests بتعدي
    instructions: جوه `server` شغل `npx vitest run` - كل التستات في `tasks.test.js` لازم تعدي.
---

## الهدف من الدرس

تنفذ الـ service (كلام مع الداتابيز) والـ routes (كلام HTTP) لحد ما الـ acceptance tests اللي في الـ starter تعدي كلها.

**الوقت المتوقع:** ساعة ونص.

## ليه نفصل routes عن service؟

| `task.routes.js` | `task.service.js` |
|---|---|
| يقرا `req`، يعمل validation، يختار status code | يتكلم مع Prisma بس |
| ميعرفش SQL | ميعرفش HTTP |

الفصل ده بيخلي كل ملف صغير ومفهوم، وبيخليك تغير الداتابيز أو شكل الـ API من غير ما تكسر التاني.

## الخطوات

### 1. الـ service: list مع الفلترة والترتيب

ابدأ بـ `listTasks`. محتاج تبني `where` و`orderBy`:

- `status` و`priority`: لو `undefined`، Prisma بيتجاهلهم. مريح.
- `search`: `{ title: { contains: search, mode: 'insensitive' } }`.
- `sort`: `-dueDate` معناها تنازلي. المهام اللي من غير due date تيجي **في الآخر** (`nulls: 'last'`).

```js spoiler
// server/src/tasks/task.service.js
function orderBy(sort) {
  const direction = sort.startsWith('-') ? 'desc' : 'asc'
  const field = sort.replace('-', '')
  if (field === 'dueDate') return [{ dueDate: { sort: direction, nulls: 'last' } }, { createdAt: 'desc' }]
  return [{ createdAt: direction }]
}

export async function listTasks({ status, priority, search, sort }) {
  const tasks = await prisma.task.findMany({
    where: {
      status,
      priority,
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    },
    orderBy: orderBy(sort),
  })
  return tasks.map(toResponse)
}
```

> **SQL injection؟** Prisma بيبعت القيم كـ parameters منفصلة عن الـ query، فـ `search = "'; DROP TABLE..."` بيتعامل معاها كنص عادي. خطر الـ injection بيرجع لو استخدمت `$queryRawUnsafe` مع string concatenation. متعملش كده.

### 2. الـ service: create / update / delete

- `createTask`: حول `dueDate` من `"2026-12-01"` لـ `Date` قبل الحفظ.
- `updateTask`: لو الـ task مش موجودة، رجع `null` (الـ route هيحولها لـ 404).
- `deleteTask`: `deleteMany({ where: { id } })` بترجع `count`، فتقدر ترجع `true/false` من غير exception.

```js spoiler
// server/src/tasks/task.service.js
function toDate(value) {
  if (value === undefined) return undefined
  if (value === null) return null
  return new Date(`${value}T00:00:00.000Z`)
}

export async function updateTask(id, input) {
  const existing = await prisma.task.findUnique({ where: { id } })
  if (!existing) return null
  const task = await prisma.task.update({
    where: { id },
    data: { ...input, dueDate: toDate(input.dueDate) },
  })
  return toResponse(task)
}

export async function deleteTask(id) {
  const result = await prisma.task.deleteMany({ where: { id } })
  return result.count > 0
}
```

لاحظ الفرق بين `undefined` (متغيرش الحقل) و`null` (امسح القيمة). Prisma بيتجاهل `undefined`.

### 3. الـ routes

امسح الـ `taskRouter.all(...)` اللي بيرجع 501، واكتب الخمس routes. Express 5 بيمسك أي error من `async` function ويبعته للـ error handler أوتوماتيك، فمش محتاج `try/catch` في كل route.

```js spoiler
// server/src/tasks/task.routes.js
taskRouter.post('/', async (req, res) => {
  const input = validate(createTaskSchema, req.body)
  res.status(201).json({ data: await createTask(input) })
})

taskRouter.patch('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id)
  const input = validate(updateTaskSchema, req.body)
  const task = await updateTask(id, input)
  if (!task) throw new HttpError(404, 'Task not found')
  res.json({ data: task })
})

taskRouter.delete('/:id', async (req, res) => {
  const id = validate(idSchema, req.params.id)
  const deleted = await deleteTask(id)
  if (!deleted) throw new HttpError(404, 'Task not found')
  res.status(204).end()
})
```

### 4. جرب يدوي

```bash
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d "{\"title\":\"Write README\",\"priority\":\"HIGH\"}"
curl "http://localhost:3001/api/tasks?priority=HIGH"
curl -X POST http://localhost:3001/api/tasks -H "Content-Type: application/json" -d "{\"title\":\"\"}"
```

### 5. شغل الـ acceptance tests

```bash
cd server
npx vitest run
```

لو test فشل، **اقرا رسالة الفشل كويس**. هي بتقولك expected إيه وجالها إيه. ده أسرع debugging ممكن.

## أخطاء شائعة

- **`findUnique` بعدين `delete` من غير تشيك:** `delete` بيرمي exception لو مش موجود، فهترجع 500 بدل 404.
- **رجوع الـ `Date` object زي ما هو:** هيطلع `"2026-12-01T00:00:00.000Z"` والـ `<input type="date">` مش هيفهمه. عشان كده `toResponse`.
- **`res.status(204).json(...)`:** الـ 204 معناها مفيش body.
- **نسيان `await`:** الـ route هيرد قبل ما الداتابيز تخلص.

## AI mentor prompt (F06)

```text prompt=F06
I'm implementing [feature]. Here is my code: [paste]. Give me hints first, then a small targeted example only if necessary. Preserve my existing style and explain every change.
```

## Tradeoff تكتبه

"استخدمت `deleteMany` بدل `delete` عشان ..." أو "رجعت 404 بدل 204 لما المهمة مش موجودة لأن ...". (في فرق آراء حقيقي في الموضوع ده؛ المهم تبرر.)

## Git commit

```bash
git add server/src
git commit -m "feat(api): implement task CRUD with filtering, search and sorting"
```

> بعد ما تخلص الـ checkpoints دي، الـ **reference solution** الكاملة هتتفتح لك في صفحة الملفات.
