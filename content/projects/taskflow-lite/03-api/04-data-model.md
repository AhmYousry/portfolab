---
slug: data-model
title: صمم الـ data model بـ Prisma
order: 1
durationMinutes: 50
status: PUBLISHED
checkpoints:
  - key: task-model
    title: الـ Task model والـ enums موجودين
    instructions: '`server/prisma/schema.prisma` فيه enums لـ TaskStatus وTaskPriority وmodel اسمه Task فيه كل الحقول المطلوبة.'
  - key: migration-applied
    title: الـ migration اتعملت واتعمل لها commit
    instructions: شغلت `npm run db:migrate --workspace server -- --name add-task` ولقيت فولدر جديد جوه `server/prisma/migrations`. الفولدر ده لازم يدخل Git.
  - key: justify-fields
    title: بررت كل حقل
    instructions: في `docs/data-model.md` اكتب لكل حقل نوعه، هل هو required، الـ default بتاعه، وليه.
---

## الهدف من الدرس

تكتب Prisma schema لجدول `Task`، تعمل migration، وتقدر تبرر كل حقل.

**الوقت المتوقع:** 50 دقيقة.

## المشكلة

لو صممت الـ data model غلط، كل اللي فوقه هيتعب. مثال: لو خزنت الـ status كـ text حر، هتلاقي في الداتابيز `"done"` و`"Done"` و`"DONE "` و`"خلصت"`. الفلترة هتبوظ.

## فكر الأول، اكتب بعدين

قبل الكود، املى الجدول ده بنفسك (ده نفس محتوى الـ worksheet في صفحة الملفات):

| الحقل | النوع | Required؟ | Default | ليه |
|---|---|---|---|---|
| id | ? | | | |
| title | ? | | | |
| description | ? | | | |
| status | ? | | | |
| priority | ? | | | |
| dueDate | ? | | | |
| createdAt / updatedAt | ? | | | |

أسئلة تسألها لنفسك:

- هل الـ `id` يبقى رقم بيزيد (1, 2, 3) ولا string عشوائي؟ (تلميح: IDs بتزيد بتكشف عدد المهام وسهل تخمينها.)
- الـ `dueDate`: محتاج وقت ولا تاريخ بس؟
- إيه الحد الأقصى المعقول لطول العنوان؟

## الخطوات

### 1. الـ enums

الـ enum بيخلي الداتابيز نفسها ترفض أي قيمة غير المسموحة:

```prisma
enum TaskStatus {
  TODO
  IN_PROGRESS
  DONE
}
```

اكتب `TaskPriority` بنفس الشكل (LOW, MEDIUM, HIGH).

### 2. الـ model

جرب تكتبه بنفسك الأول. لما تخلص (أو تتزنق)، قارن بالحل:

```prisma spoiler
// server/prisma/schema.prisma
model Task {
  id          String       @id @default(cuid())
  title       String       @db.VarChar(120)
  description String?      @db.VarChar(2000)
  status      TaskStatus   @default(TODO)
  priority    TaskPriority @default(MEDIUM)
  dueDate     DateTime?    @db.Date
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([status])
  @@index([priority])
  @@index([dueDate])
}
```

نقط مهمة في الحل:

- `cuid()`: ID عشوائي مش سهل يتخمن ومفيش collision عملي.
- `@db.VarChar(120)`: الداتابيز نفسها بتحمي من عنوان طوله 10 ميجا، حتى لو الـ API فيه bug.
- `@db.Date`: تاريخ بس من غير وقت، عشان منتعبش مع الـ time zones.
- `@updatedAt`: Prisma بيحدثه أوتوماتيك.
- الـ indexes على الحقول اللي بنفلتر ونرتب بيها.

### 3. اعمل migration

```bash
npm run db:migrate --workspace server -- --name add-task
```

افتح ملف الـ SQL اللي اتعمل جوه `server/prisma/migrations/`. **اقرأه.** ده الـ SQL الحقيقي اللي اتنفذ. لازم تفهم `CREATE TYPE` و `CREATE TABLE` و `CREATE INDEX`.

## أخطاء شائعة

- **تعديل migration قديمة بعد ما اتطبقت:** متعملش كده. اعمل migration جديدة.
- **نسيان commit لفولدر الـ migrations:** من غيره، أي حد يعمل clone مش هيقدر يبني نفس الداتابيز.
- **استخدام `prisma db push` في الإنتاج:** `db push` للتجربة السريعة بس. في الإنتاج بنستخدم `migrate deploy`.
- **`Float` للفلوس:** مش موجود هنا، بس افتكره لـ ExpensePilot. الفلوس بتتخزن integers (قروش).

## AI mentor prompt (F03)

```text
Help me design a Prisma Task model with status, priority and due date. Explain field types, defaults, validation and migration risks. Ask me to justify each field.
```

## Tradeoff تكتبه

في `docs/data-model.md`: "اخترت `cuid()` بدل autoincrement لأن ..." أو أي قرار تاني اتخذته.

## Stretch goal

إيه اللي يحصل لو عايز تضيف حقل `tags` بعدين؟ اكتب migration plan من غير ما تنفذه: هل محتاج جدول تاني؟ ليه؟

## Git commit

```bash
git add server/prisma
git commit -m "feat(db): add Task model, enums and indexes"
```
