# TaskFlow Lite — reference solution

> **Spoiler:** this is the complete reference implementation for the free *Portfolio Starter* project.
> Build your own version from `../starter` first. Use this to compare, not to copy.

A small full-stack personal task manager: **React (Vite) + Express + PostgreSQL (Prisma) + Zod**.

## Features

- Create tasks with title, optional description, status, priority and due date
- List, search by title, filter by status/priority, sort by created/due date
- Edit, mark complete, delete with confirmation
- Loading, empty, validation and API-error states
- Server-side validation (Zod), safe error responses, database migrations
- API integration tests (Vitest + Supertest) and a frontend component test

## Architecture

```
client (React, :5174) --fetch /api--> server (Express, :3001) --Prisma--> PostgreSQL (:5433)
```

| Layer | Responsibility |
|---|---|
| `client/` | UI state, form validation for fast feedback, calling the API |
| `server/src/tasks/task.routes.js` | HTTP: parse + validate input, choose status codes |
| `server/src/tasks/task.service.js` | Data access with Prisma |
| `server/src/http.js` | Validation helper and the single error handler |
| PostgreSQL | Source of truth; survives refresh and restarts |

## API

| Method | Path | Success | Errors |
|---|---|---|---|
| GET | `/api/health` | 200 `{status, database}` | 503 if DB down |
| GET | `/api/tasks?status=&priority=&search=&sort=` | 200 `{data: Task[]}` | 400 invalid filter |
| GET | `/api/tasks/:id` | 200 `{data: Task}` | 404 |
| POST | `/api/tasks` | 201 `{data: Task}` | 400 validation |
| PATCH | `/api/tasks/:id` | 200 `{data: Task}` | 400, 404 |
| DELETE | `/api/tasks/:id` | 204 | 404 |

`sort` is one of `createdAt`, `-createdAt` (default), `dueDate`, `-dueDate`. Errors look like
`{ "error": { "message": "Validation failed", "details": [{ "field": "title", "message": "..." }] } }`.

## Run locally

Requirements: Node 20.19+, Docker (or your own PostgreSQL 14+).

```bash
docker compose up -d db
cp server/.env.example server/.env
cp server/.env.example server/.env.test   # then change the DB name to taskflow_test
npm install
npm run db:migrate --workspace server
npm run dev:server     # http://localhost:3001/api/health
npm run dev:client     # http://localhost:5174
```

## Tests

```bash
npm test
```

Server tests run against the `taskflow_test` database (the config refuses to run against a DB whose
name does not contain `test`, so you can't wipe your dev data by accident).

## Deployment notes

- Set `DATABASE_URL` and `CLIENT_ORIGIN` as environment variables on your host. Never commit `.env`.
- Run `npm run db:deploy --workspace server` during release, not `migrate dev`.
- Build the client with `VITE_API_URL=https://your-api.example.com npm run build` and serve `client/dist` as static files.
- Health check path: `/api/health` (returns JSON, not HTML).

## Known limitations

- Single user, no authentication (out of scope for this project).
- No pagination; fine for a personal list, not for thousands of tasks.
- Times are stored as dates only (`dueDate` is a calendar date, no time zone handling).
