# API contract & data model worksheet

املى الجداول دي **قبل** ما تكتب كود. لو مش عارف تملا خانة، ده سؤال لازم تجاوبه الأول.

## 1. Data model — Task

| الحقل | النوع (Prisma) | Required؟ | Default | Constraint | ليه |
|---|---|---|---|---|---|
| id | | | | | |
| title | | | | | |
| description | | | | | |
| status | | | | | |
| priority | | | | | |
| dueDate | | | | | |
| createdAt | | | | | |
| updatedAt | | | | | |

Indexes هعملها على: ______  عشان: ______

## 2. Endpoints

| Method | Path | Request (body/query) | Success (status + body) | Errors (status + سبب) |
|---|---|---|---|---|
| GET | /api/tasks | | | |
| GET | /api/tasks/:id | | | |
| POST | /api/tasks | | | |
| PATCH | /api/tasks/:id | | | |
| DELETE | /api/tasks/:id | | | |
| GET | /api/health | | | |

## 3. شكل الخطأ الموحد

```json
{ "error": { "message": "", "details": [] } }
```

## 4. Validation rules

| الحقل | القاعدة | رسالة الخطأ |
|---|---|---|
| title | | |
| status | | |
| priority | | |
| dueDate | | |
| حقول زيادة | | |

## 5. أسئلة لازم تجاوبها
- الـ PATCH بيبعت الحقول كلها ولا اللي اتغيرت بس؟ إيه اللي يحصل للحقول اللي متبعتتش؟
- `null` و"الحقل مش موجود" بيفرقوا في إيه؟
- delete لمهمة مش موجودة يرجع إيه؟ وليه؟
