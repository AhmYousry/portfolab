---
slug: states-filters
title: Loading وEmpty وError والفلاتر
order: 2
durationMinutes: 60
status: PUBLISHED
checkpoints:
  - key: three-states
    title: الـ UI بيتعامل مع loading وempty وerror
    instructions: وقف الـ server وعمل refresh - لازم تشوف رسالة خطأ وزرار "Try again". شغله تاني واضغط الزرار - الليستة ترجع. امسح كل المهام - لازم تشوف empty state.
  - key: filters-work
    title: الفلاتر والبحث شغالين
    instructions: البحث بكلمة، الفلترة بـ status وpriority، والترتيب بالـ due date - كلهم بيغيروا الليستة.
---

## الهدف من الدرس

الـ UI بتاعك يقول للمستخدم الحقيقة في كل لحظة: بيحمل، فاضي، في مشكلة، أو جاهز. وتضيف بحث وفلاتر.

**الوقت المتوقع:** ساعة.

## المشكلة

أغلب مشاريع البورتفوليو بتشتغل بس في "الحالة السعيدة". أول ما الـ API يقع، الشاشة تفضل فاضية والمستخدم مش فاهم حاجة. الإنترفيور اللي بيفهم هيقفل الـ server ويشوف إيه اللي هيحصل.

## الخطوات

### 1. Request status واحد

بدل `isLoading` و`hasError` و`isEmpty` منفصلين (ممكن يبقوا `true` مع بعض بالغلط)، استخدم status واحد:

```js
const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'error'
```

```jsx
{status === 'loading' && <p role="status">Loading tasks…</p>}
{status === 'error' && (
  <div role="alert" className="alert">
    <p>Could not load tasks: {error}</p>
    <button onClick={() => load(filters)}>Try again</button>
  </div>
)}
{status === 'ready' && <TaskList tasks={tasks} ... />}
```

`role="status"` و`role="alert"` بيخلوا الـ screen reader يعلن التغيير.

### 2. Empty state بيساعد

```jsx
if (tasks.length === 0) {
  return <p className="empty" role="status">No tasks yet. Add your first one above, or clear the filters.</p>
}
```

لاحظ "or clear the filters": ممكن الليستة فاضية بسبب الفلتر مش لأن مفيش مهام.

### 3. الفلاتر "controlled"

`Filters` مفيهوش state. بياخد `value` ويبعت object جديد في `onChange`. ده بيخلي `App` هو مصدر الحقيقة الوحيد.

```jsx
function update(field) {
  return (event) => onChange({ ...value, [field]: event.target.value })
}
```

### 4. Debounce للبحث

من غير debounce، كل حرف = request. حل بسيط في `App`:

```js spoiler
// client/src/App.jsx
useEffect(() => {
  const timer = setTimeout(() => load(filters), SEARCH_DEBOUNCE_MS)
  return () => clearTimeout(timer)
}, [filters, load])
```

الـ cleanup function بتلغي الـ timer القديم لو المستخدم كتب حرف تاني قبل 250ms.

### 5. Mobile

جرب الصفحة على عرض 360px (DevTools → device toolbar). الفلاتر لازم تنزل تحت بعض. الـ CSS في الـ starter بيستخدم:

```css
grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
```

## أخطاء شائعة

- **إن الـ error يفضل ظاهر بعد ما تنجح:** صفر الـ error أو اعتمد على `status` بس.
- **Race condition:** لو كتبت بسرعة، response قديم ممكن يوصل بعد الجديد. الـ debounce بيقلل ده. (Stretch: استخدم `AbortController`.)
- **Delete من غير تأكيد:** `window.confirm` بسيط وكافي هنا.

## Stretch goal

استخدم `AbortController` في `fetchTasks` عشان تلغي الـ request القديم لما الفلاتر تتغير.

## Git commit

```bash
git add client/src
git commit -m "feat(ui): handle loading, empty and error states; add filters and search"
```
