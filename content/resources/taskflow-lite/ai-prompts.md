# TaskFlow Lite — 10 AI mentor prompts

**إزاي تستخدمهم:** الـ AI هنا mentor ومراجع، مش بديل عن فهمك. كل prompt بيطلب أسئلة توضيحية، تعليم بدل كود جاهز، ومراجعة أمان.

**قبل ما تلصق أي كود أو log:** امسح الباسوردات والـ connection strings والـ API keys.

---

## F01 — Scope (Module 1)
```text
Act as a senior full-stack mentor. I know basic JavaScript. Help me scope TaskFlow Lite into a buildable MVP. Ask up to 5 clarifying questions, then give user stories, out-of-scope features, and an acceptance checklist. Don't write the app for me.
```

## F02 — Architecture (Module 1)
```text
Review my TaskFlow Lite requirements and propose a simple React + Express + PostgreSQL architecture. Explain data flow and why each layer exists. Flag unnecessary complexity.
```

## F03 — Data model (Module 3)
```text
Help me design a Prisma Task model with status, priority and due date. Explain field types, defaults, validation and migration risks. Ask me to justify each field.
```

## F04 — API contract (Module 3)
```text
Help me define REST endpoints for task CRUD and filtering. For each endpoint show request, success response, validation errors and HTTP status codes. Don't implement until I approve the contract.
```

## F05 — Frontend decomposition (Module 4)
```text
Break my TaskFlow Lite React UI into small components and state responsibilities. Explain form validation, loading, empty and error states. Give an implementation order.
```

## F06 — Guided implementation (Modules 3–5)
```text
I'm implementing [feature]. Here is my code: [paste]. Give me hints first, then a small targeted example only if necessary. Preserve my existing style and explain every change.
```

## F07 — Debugging (any module)
```text
I'm seeing [error] when [steps]. Here are logs and relevant code: [paste, with secrets removed]. Rank likely causes, suggest minimal reproduction, and tell me what to inspect before changing code.
```

## F08 — Testing (Module 5)
```text
Review my TaskFlow Lite API behavior and propose Vitest/Supertest tests covering success, invalid input, not-found and database failures. Explain what each test proves.
```

## F09 — Security review (Module 6)
```text
Review this small full-stack task app for input validation, injection risks, secret handling, CORS and unsafe error exposure. Separate critical issues from optional hardening.
```

## F10 — Portfolio readiness (Module 6)
```text
Act as a technical interviewer. Review my README, screenshots, tests and architecture notes. Identify gaps, ask me five questions about my design decisions, and help me write an honest project summary without exaggerating my contributions.
```
