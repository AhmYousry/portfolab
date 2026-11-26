# TaskFlow Lite — starter

نقطة البداية لمشروع **TaskFlow Lite** على المنصة. ده **مش** الحل: كل `TODO` في الكود مربوط بدرس. امشي على الدروس بالترتيب، والـ README ده هتستبدله بـ README بتاعك في آخر درس.

## الحالة الحقيقية للـ starter دلوقتي

| الحاجة | شغالة؟ |
|---|---|
| الواجهة على http://localhost:5174 | آه، بتظهر (فورم + فلاتر + `TODO: empty state`)، بس **مش بتحفظ** حاجة. "Add task" بيطبع `TODO save` في الـ Console. |
| http://localhost:3001/api/health | آه، بيرجع `{"status":"ok","database":"up"}` لو الداتابيز شغالة. |
| http://localhost:3001/api/tasks | لأ، بيرجع `501 Not implemented yet` لحد Module 3. |
| `server/test/health.test.js` | آه، بيعدي لو الداتابيز شغالة و`.env.test` مظبوط. |
| `server/test/tasks.test.js` | لأ، بيفشل لحد ما تخلص Module 3. ده متوقع. |
| `client/src/components/TaskForm.test.jsx` | لأ، بيفشل لحد ما تخلص درس الـ components في Module 4. ده متوقع. |

## محتاج متسطب

Node.js 22 LTS، Git، وDocker Desktop (أو PostgreSQL متسطب). كلهم مجانيين.

## أول تشغيل

كل الأوامر من **فولدر المشروع الرئيسي** إلا لو مكتوب غير كده.

**1. الواجهة الأول (مش محتاجة داتابيز):**

```bash
npm install
npm run dev:client        # افتح http://localhost:5174
```

**2. الداتابيز والـ API (في terminal تاني):**

```bash
docker compose up -d db   # PostgreSQL على port 5433، وبيعمل taskflow و taskflow_test

# Windows PowerShell
Copy-Item server/.env.example server/.env
Copy-Item server/.env.example server/.env.test
# macOS / Linux / Git Bash
cp server/.env.example server/.env
cp server/.env.example server/.env.test
```

افتح `server/.env.test` وغير **اسم الداتابيز بس** في آخر `DATABASE_URL` (بعد آخر `/`) من `taskflow` لـ `taskflow_test`. **متغيرش** الـ username اللي قبل `@`، ولا الباسورد، ولا الـ port، ومتعملش replace على كل كلمة `taskflow` في السطر. بعدين:

```bash
npm run dev:server        # افتح http://localhost:3001/api/health
```

**3. أول test (من فولدر `server`):**

```bash
cd server
npx vitest run test/health.test.js
```

## الـ scripts

| من فين | الأمر | بيعمل إيه |
|---|---|---|
| الرئيسي | `npm run dev:client` | Vite على 5174، وبيحول `/api` لـ 3001 |
| الرئيسي | `npm run dev:server` | Express على 3001 (بيقرا `server/.env`) |
| الرئيسي | `npm run db:migrate --workspace server -- --name <name>` | migration جديدة (Module 3) |
| الرئيسي | `npm test` | تستات الـ server والـ client (هتعدي كلها بعد Module 5) |
| الرئيسي | `npm run build` | build للـ client في `client/dist` |

## الملفات اللي هتلمسها

| Module | الملفات |
|---|---|
| 2 — Workspace | `server/.env`، `server/.env.test` (مش بيدخلوا Git) |
| 3 — API | `server/prisma/schema.prisma`، `server/src/tasks/*` |
| 4 — UI | `client/src/App.jsx`، `client/src/components/*` |
| 5 — Integrate & test | `client/src/App.jsx`، `client/src/components/TaskForm.jsx`، `server/test/tasks.test.js` |
| 6 — Ship | `README.md` (استبدل الملف ده بتاعك) |

## أمان

- `server/.env` و`server/.env.test` في `.gitignore`. متعملهمش commit، ومتلصقهمش في أي AI.
- الباسورد اللي في `docker-compose.yml` و`.env.example` (`taskflow_local_only`) للتطوير المحلي بس.
- التستات بتمسح البيانات، وعشان كده بترفض تشتغل غير على داتابيز اسمها فيه `test`.
