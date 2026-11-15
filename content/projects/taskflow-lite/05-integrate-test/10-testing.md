---
slug: testing
title: Tests بتثبت إن الـ API شغال
order: 2
durationMinutes: 75
status: PUBLISHED
checkpoints:
  - key: own-test
    title: كتبت test جديد بنفسك
    instructions: ضيف test واحد على الأقل مش موجود في الـ starter (مثلًا - search بكلمة مش موجودة يرجع array فاضي، أو dueDate زي 2026-02-30 يترفض).
  - key: all-green
    title: كل التستات بتعدي
    instructions: من فولدر المشروع الرئيسي شغل `npm test` - تستات الـ server والـ client كلها خضرا.
  - key: explain-test
    title: أقدر أشرح test واحد
    instructions: اختار test واحد واكتب في `docs/testing.md` هو بيثبت إيه بالظبط، وإيه الـ bug اللي كان هيعدي من غيره.
---

## الهدف من الدرس

تفهم الـ tests الموجودة في الـ starter، تكتب tests جديدة، وتعرف تشرح كل test بيحمي من إيه.

**الوقت المتوقع:** ساعة وربع.

## ليه integration tests؟

الـ tests في `server/test/tasks.test.js` بتشغل الـ Express app الحقيقي مع داتابيز test حقيقية. بتثبت إن الـ routes والـ validation والـ Prisma والـ SQL شغالين **مع بعض**. ده أكتر test بيديك ثقة بأقل مجهود في مشروع زي ده.

## تشريح test

```js
it('rejects unknown filter values', async () => {
  const res = await request(app).get('/api/tasks?status=SOMEDAY')
  expect(res.status).toBe(400)
})
```

- `request(app)`: Supertest بيبعت request للـ app من غير ما يفتح port.
- الـ test بيثبت **سلوك** (400 لفلتر غلط)، مش تفاصيل implementation.

### العزل بين التستات

```js
beforeEach(async () => {
  await prisma.task.deleteMany()
})
```

كل test بيبدأ بداتابيز فاضية، فمفيش test بيعتمد على اللي قبله. وعشان كده الـ config بيرفض يشتغل لو اسم الداتابيز مفيهوش `test`:

```js
if (!process.env.DATABASE_URL?.includes('test')) {
  throw new Error('Tests need a separate database. ...')
}
```

### اختبار فشل الداتابيز

```js
it('returns a safe 500 without leaking internals', async () => {
  const spy = vi.spyOn(prisma.task, 'findMany').mockRejectedValueOnce(new Error('connection refused at 10.0.0.5'))
  const res = await request(app).get('/api/tasks')
  expect(res.status).toBe(500)
  expect(JSON.stringify(res.body)).not.toContain('10.0.0.5')
  spy.mockRestore()
})
```

ده بيثبت حاجتين: الـ API مبيقعش لما الداتابيز تقع، و**مبيسربش** تفاصيل داخلية للمستخدم.

## الخطوات

1. شغل `npm test` من فولدر المشروع الرئيسي.
2. اقرا كل `describe` واكتب في `docs/testing.md` سطر واحد لكل مجموعة: بتغطي إيه.
3. ضيف test جديد بنفسك (شوف الـ checkpoint).
4. **جرب تكسر الكود عمدًا** (مثلًا شيل `.strict()`) وشوف أنهي test بيفشل. لو مفيش test فشل، يبقى في فجوة.

## أخطاء شائعة

- **Tests بتعتمد على ترتيب التشغيل:** كل test يجهز البيانات بتاعته.
- **تشغيل التستات على داتابيز التطوير:** هتمسح شغلك. الـ guard موجود عشان كده.
- **Snapshot لكل response:** بيكسر مع أي تغيير بسيط. اختبر الحاجات المهمة بس.

## AI mentor prompt (F08)

```text
Review my TaskFlow Lite API behavior and propose Vitest/Supertest tests covering success, invalid input, not-found and database failures. Explain what each test proves.
```

## Git commit

```bash
git add server/test client/src docs/testing.md
git commit -m "test: extend API and UI tests"
```
