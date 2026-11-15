---
slug: api-contract
title: الـ API contract والـ validation بـ Zod
order: 2
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: contract-written
    title: كتبت الـ API contract
    instructions: '`docs/api.md` فيه الخمس endpoints، ولكل واحد request، response ناجح، وأخطاء محتملة بالـ status codes.'
  - key: schemas-done
    title: الـ Zod schemas مكتملة
    instructions: '`server/src/tasks/task.schema.js` فيه createTaskSchema وupdateTaskSchema وlistQuerySchema حقيقيين (مفيش passthrough).'
  - key: no-defaults-on-update
    title: الـ update schema مبيطبقش defaults
    instructions: اكتب في `docs/api.md` جملة بتشرح ليه الـ update schema مينفعش يبقى فيه defaults، واتأكد إن الكود بتاعك ماشي على كده.
---

## الهدف من الدرس

تتفق مع نفسك على **شكل الـ API** قبل ما تكتب أي route، وتكتب Zod schemas بتحمي الـ server من أي input غلط.

**الوقت المتوقع:** ساعة.

## المشكلة

أحمد بدأ يكتب routes على طول. بعد يومين الـ frontend بيبعت `due_date` والـ backend مستني `dueDate`، والـ errors راجعة بأشكال مختلفة في كل endpoint. الـ contract بيمنع ده.

## الخطوة 1: اكتب الـ contract

| Method | Path | Body / Query | Success | Errors |
|---|---|---|---|---|
| GET | `/api/tasks` | `?status=&priority=&search=&sort=` | `200 {data: Task[]}` | `400` فلتر غلط |
| GET | `/api/tasks/:id` | — | `200 {data: Task}` | `404` |
| POST | `/api/tasks` | `{title, description?, status?, priority?, dueDate?}` | `201 {data: Task}` | `400` |
| PATCH | `/api/tasks/:id` | أي حقل من دول، واحد على الأقل | `200 {data: Task}` | `400`, `404` |
| DELETE | `/api/tasks/:id` | — | `204` من غير body | `404` |

وشكل الخطأ **موحد** في كل حتة:

```json
{
  "error": {
    "message": "Validation failed",
    "details": [{ "field": "title", "message": "title is required" }]
  }
}
```

**ليه 201 مش 200 للـ create؟** لأن 201 معناها "اتعمل resource جديد". **ليه 204 للـ delete؟** مفيش حاجة نرجعها. دي تفاصيل بيسألوا عنها في الإنترفيو.

## الخطوة 2: الـ Zod schemas

Zod بيعمل حاجتين: **بيتأكد** إن البيانات سليمة، و**بينضفها** (trim مثلًا) ويرجعلك نسخة آمنة.

جرب تكتب `createTaskSchema` بنفسك من الـ TODOs في الملف. المتطلبات:

- `title`: string، trim، من 1 لـ 120 حرف.
- `description`: اختياري، ممكن `null`، أقصى 2000.
- `status` و`priority`: من القوايم بس، وليهم defaults.
- `dueDate`: اختياري، ممكن `null`، بصيغة `YYYY-MM-DD`.
- أي حقل زيادة (زي `isAdmin`) يترفض: `.strict()`.

```js spoiler
// server/src/tasks/task.schema.js
const dueDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'dueDate must be YYYY-MM-DD')
  .refine((value) => !Number.isNaN(Date.parse(value)), 'dueDate is not a real date')
  .nullable()

const taskFields = {
  title: z.string().trim().min(1, 'title is required').max(TITLE_MAX),
  description: z.string().trim().max(DESCRIPTION_MAX).nullable(),
  status: z.enum(STATUSES),
  priority: z.enum(PRIORITIES),
  dueDate,
}

export const createTaskSchema = z
  .object({
    ...taskFields,
    description: taskFields.description.optional(),
    status: taskFields.status.default('TODO'),
    priority: taskFields.priority.default('MEDIUM'),
    dueDate: taskFields.dueDate.optional(),
  })
  .strict()

export const updateTaskSchema = z
  .object(taskFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'send at least one field to update')
```

## الخطأ اللي وقعنا فيه إحنا نفسنا

أول نسخة من الـ reference solution كانت كاتبة:

```js
export const updateTaskSchema = createTaskSchema.partial()
```

شكلها منطقي، صح؟ الـ test ده فضحها:

```js
it('only changes the fields that were sent', async () => {
  const task = await createTask({ title: 'Keep me', status: 'IN_PROGRESS', priority: 'HIGH' })
  const res = await request(app).patch(`/api/tasks/${task.id}`).send({ title: 'Renamed' })
  expect(res.body.data).toMatchObject({ title: 'Renamed', status: 'IN_PROGRESS', priority: 'HIGH' })
})
```

`.partial()` بيخلي الحقول optional، **لكن الـ defaults بتفضل شغالة**. فلما تبعت `{title: 'Renamed'}`، Zod بيضيف `status: 'TODO'` و`priority: 'MEDIUM'` من عنده، والـ PATCH يرجع المهمة لـ TODO من غير ما المستخدم يطلب! عشان كده الحل بيبني الـ update schema من `taskFields` اللي من غير defaults.

الدرس: **الـ tests مش رفاهية.** الـ bug ده كان هيوصل للمستخدمين.

## أخطاء شائعة

- **الثقة في `req.body` من غير validation:** أي حد يقدر يبعت أي حاجة.
- **رفض الحقول الزيادة بصمت:** من غير `.strict()`، حد يبعت `{"id": "..."}` ويحاول يغير الـ ID.
- **رسائل خطأ بتكشف تفاصيل داخلية:** الرسالة للمستخدم توصف المشكلة في الـ input بتاعه بس.

## AI mentor prompt (F04)

```text
Help me define REST endpoints for task CRUD and filtering. For each endpoint show request, success response, validation errors and HTTP status codes. Don't implement until I approve the contract.
```

## Git commit

```bash
git add docs/api.md server/src/tasks/task.schema.js
git commit -m "feat(api): define task API contract and Zod validation"
```
