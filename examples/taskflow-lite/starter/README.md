# TaskFlow Lite — starter

Your starting point for the free **Portfolio Starter** project. Follow the lessons on the platform;
every `TODO` in the code is linked to a module.

| Module | Files you'll touch |
|---|---|
| 2 — Workspace | `.env`, run `npm install`, health check |
| 3 — API | `server/prisma/schema.prisma`, `server/src/tasks/*` |
| 4 — UI | `client/src/components/*` |
| 5 — Integrate & test | `client/src/App.jsx`, `server/test/*` |
| 6 — Ship | `README.md` (replace this file with your own) |

## First run

```bash
docker compose up -d db
cp server/.env.example server/.env
cp server/.env.example server/.env.test   # change the DB name to taskflow_test
npm install
npm run dev:server        # open http://localhost:3001/api/health
npm run dev:client        # open http://localhost:5174
npx vitest run test/health.test.js --root server
```

`server/test/tasks.test.js` is the acceptance test suite for the API. It fails until you finish Module 3 — that's expected.
