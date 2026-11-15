# TaskFlow Lite — Project brief

## المشكلة
مشاريع بورتفوليو كتير frontend بس، أو منسوخة من tutorial، وصاحبها مش قادر يشرحها. TaskFlow Lite مشروع صغير بالقصد بيلمس كل طبقة: UI، API، database، tests، وdeployment.

## المنتج
Task manager شخصي لمستخدم واحد.

## Features مطلوبة (MVP)
- إضافة task: title (مطلوب)، description (اختياري)، status، priority، due date.
- عرض المهام، بحث بالعنوان، فلترة بالـ status والـ priority، ترتيب بالـ due date أو تاريخ الإنشاء.
- تعديل، تعليم كمكتملة، حذف مع تأكيد.
- حالات loading وempty وvalidation وAPI error.
- Responsive على الموبايل.
- Server-side validation، أخطاء آمنة، migrations.
- Tests للـ API (نجاح وفشل).
- دليل deployment و`.env.example`.

## خارج الـ scope
- تسجيل دخول وحسابات متعددة.
- مشاركة المهام.
- إشعارات.
- Pagination.

## Data model
`Task(id, title, description?, status: TODO|IN_PROGRESS|DONE, priority: LOW|MEDIUM|HIGH, dueDate?, createdAt, updatedAt)`

## API
- `GET /api/tasks?status=&priority=&search=&sort=`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`
- `GET /api/health`

## تعريف "خلصت"
- كل الـ acceptance tests بتعدي.
- أي حد يقدر يشغل المشروع من الـ README بس.
- مفيش secrets في الـ repo.
- تقدر تشرح كل طبقة وقرار واحد على الأقل في كل module.
