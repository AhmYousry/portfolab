# Ahmed & Claude — Portfolio Builder
## Complete Product Requirements, Architecture, Content Plan & Claude Code Master Prompt

**Version:** 1.0  
**Date:** 2026-11-15  
**Status:** Implementation blueprint — not an existing product  
**Primary market:** Arabic-speaking beginner-to-junior developers; Egypt-first pricing  
**Business model:** Free practical starter + one-time paid Pro (test price: EGP 249)  
**Brand:** Ahmed & Claude (comedic Instagram series)  
**Primary promise:** Build, understand, test, deploy and confidently explain real full-stack portfolio projects.

> **Important:** This document is a specification and an instruction set for Claude Code, not a claim that any feature, payment integration, project, or content is already implemented. The 249 EGP price, conversion assumptions, and timelines are hypotheses to validate. Do not claim employment outcomes or guaranteed hiring.

---

# PART A — PRODUCT SPECIFICATION

## 1. Executive summary

Ahmed & Claude — Portfolio Builder is an Arabic-first, mobile-friendly learning product for developers who know HTML/CSS/JavaScript basics and want a portfolio with real projects instead of copied tutorials. The product teaches through guided implementation, checkpoints, practical AI prompts, reference code, tests, deployment, GitHub documentation and interview explanations.

**Core principle:** AI is a mentor and reviewer, not a substitute for understanding. Students should implement and explain what they build.

### Primary goals
1. Deliver a genuinely complete free full-stack project.
2. Capture consented leads from Instagram without gating the entire learning experience behind payment.
3. Validate whether users start, complete, and value the free project.
4. Offer deeper, differentiated Pro projects only when they are built and quality-checked.
5. Keep platform operating costs and implementation complexity low.

### Non-goals for v1
- A general-purpose coding bootcamp or teaching JavaScript from zero.
- A full AI chat service with expensive inference billing.
- Job placement or guaranteed employment.
- Multiple programming stacks, mobile apps, native desktop apps, or social networking.
- A complex CMS, instructor marketplace, or live cohort platform.

## 2. Target audience and evidence

**Primary persona:** 18+ Arabic-speaking learner/junior developer who knows basic JavaScript, HTML/CSS and Git, but lacks end-to-end full-stack projects and confidence discussing technical decisions.

**Secondary persona:** job seeker with basic projects who wants stronger GitHub documentation and interview preparation.

**Not initially targeted:** absolute beginners needing foundational programming education; experienced senior engineers.

**Current account observations (Instagram @skitgonewild, retrieved via Windsor.ai on 2026-11-15):** 929 followers; 6 reels; one reel with 98,019 views; a practical reel with a `setup` CTA had 36,331 views, 433 comments and 1,226 saves. Audience age 18–34 comprised approximately 84% of available age-classified records. These are indicators of attention and free-resource demand, **not evidence of paid purchase intent**. The account-level follower count is a current snapshot, not 30-day follower growth.

## 3. Positioning, tone and brand

**Product name:** Ahmed & Claude — Portfolio Builder  
**Free tier:** Portfolio Starter  
**Paid tier:** Portfolio Builder Pro  
**Tagline:** Stop Watching Tutorials. Start Building.  
**Primary language:** Egyptian-friendly Arabic for guidance, English for technical terms and code.  
**Tone:** helpful, concise, humorous in examples, technically rigorous in instruction.  
**Visual direction:** modern SaaS educational UI, spacious layout, accessible typography, RTL Arabic with correctly isolated LTR code blocks. Do not use copyrighted characters, logos or images without rights. Character artwork can be added later using user-provided licensed assets.

## 4. Offer and entitlement model

| Dimension | Free: Portfolio Starter | Pro: Portfolio Builder Pro |
|---|---|---|
| Price | EGP 0 | EGP 249 one-time **test price** |
| Projects | TaskFlow Lite (complete) | ExpensePilot, TeamBoard, IssueForge |
| Lessons | Complete guided free build | Deeper guided builds and architecture |
| AI prompts | 10 practical prompts | 40+ planned, project-specific |
| Starter repositories | Yes | Yes |
| Reference solutions | Yes, after checkpoints | Yes, after checkpoints |
| Tests and debugging | Basic | Advanced integration, security, edge cases |
| Deployment guidance | Yes | Yes |
| README/portfolio assets | Basic | Advanced templates, interview packs |
| Purchase required for free project | No | N/A |

**Fair value principle:** Do not intentionally cripple the free project or lock required completion steps behind Pro. Paid value comes from additional projects, depth, complexity and convenience.

**Release integrity:** Pro project cards must show `Coming soon` until each project is truly complete. No charging for unavailable content unless a separate, clearly labeled preorder flow is explicitly approved by the owner. Default: **disable checkout until at least the initial Pro deliverable is finished and the exact included content is disclosed**.

## 5. Student journey and UX

### Public journey
1. Visitor lands from Instagram Reel / DM with campaign UTM parameters.
2. Landing page explains target audience, outcomes, Free and Pro differences, sample curriculum, and honest limitations.
3. Visitor clicks **Start Free**; no payment card.
4. Visitor can inspect public curriculum and a sample lesson without an account.
5. For progress tracking and starter assets, visitor signs up/signs in; provide transparent privacy consent.
6. Onboarding asks: experience level, weekly time, and goal (portfolio, learning, job applications), all optional except necessary account fields.
7. Dashboard shows current project, progress, next lesson, and completion checklist.
8. Each lesson provides an objective, prerequisites, instructions, code snippets, expected result, common errors, AI prompt, self-check, and next step.
9. User completes a real project and can optionally share a GitHub link.
10. Only after meaningful free value, user may view a clear Pro offer.

### Pro journey
1. User opens Pro detail page with exact available projects and deliverables.
2. If checkout enabled, user pays through a legitimate supported provider.
3. Payment is verified **server-side** by trusted webhook/provider API, never by browser redirect alone.
4. Entitlement is granted idempotently and appears in dashboard.
5. User accesses purchased content and downloadable materials.
6. If payment pending/failed, show accurate status and support route.

### Essential screens
- `/` landing page
- `/pricing` transparent tier comparison
- `/curriculum` public catalog
- `/login`, `/signup`, `/forgot-password`, `/reset-password`
- `/dashboard` student home
- `/projects/:slug` project overview
- `/projects/:slug/lessons/:lessonSlug` lesson reader
- `/progress` milestones and checklists
- `/resources` templates and downloadable assets
- `/account` profile, preferences, privacy, purchases
- `/checkout` and `/checkout/status` **only after real payment provider integration**
- `/admin` protected admin dashboard
- `/admin/projects`, `/admin/lessons`, `/admin/users`, `/admin/orders`, `/admin/analytics`
- `/privacy`, `/terms`, `/refund-policy`, `/contact`

### Accessibility and localization
- Arabic RTL layout by default; code, URLs, terminal commands, and filenames remain LTR.
- Keyboard navigation, focus states, form labels, color contrast, semantic headings.
- Responsive design for narrow phones, tablets, desktops.
- English technical terms can remain in English; architecture should allow future `en` locale.
- Do not require audio or video for completion; written learning material is primary.

## 6. Technology decisions

**Preferred monorepo:** pnpm workspaces; TypeScript end to end.

| Area | Choice |
|---|---|
| Web | React + Vite + TypeScript |
| UI | Tailwind CSS; accessible component primitives |
| API | Node.js + Express + TypeScript |
| DB | PostgreSQL |
| ORM | Prisma |
| Validation | Zod on client and server |
| Auth | Secure server-side sessions via HttpOnly cookies; Argon2id password hashing |
| Testing | Vitest, React Testing Library, Supertest; Playwright for critical E2E |
| API documentation | OpenAPI generated or maintained with tests |
| Package manager | pnpm |
| Development | Docker Compose for PostgreSQL; `.env.example` |
| CI | GitHub Actions: lint, typecheck, unit/integration tests, build |
| Hosting | Provider-neutral; choose cost-effective supported web/API/Postgres hosting at deployment time |

**Important implementation choices:**
- Use secure, maintained packages; confirm compatibility before installing.
- Store sessions server-side or use a secure managed session store, with expiry, rotation, logout and revocation.
- Cookie flags: `HttpOnly`, `Secure` in production, appropriate `SameSite`; CSRF protection for cookie-authenticated mutations; strict CORS allowlist.
- Never commit secrets; use env vars; redact sensitive logs.
- Rate-limit authentication and public submission endpoints.
- Validate input on the server; authorize access to every protected resource.
- Minimize personal data collection and provide account deletion/export pathways where practical.
- Do not expose paid lesson content via unauthenticated static files or public API responses.
- Avoid building custom card storage or collecting payment card details.

## 7. Data model (initial Prisma entities)

Implement normalized models with appropriate indexes, timestamps and migration history:

- `User`: id, email (unique), passwordHash, displayName, locale, role (`STUDENT`, `ADMIN`), createdAt, updatedAt, deletedAt optional.
- `Session`: id, userId, sessionTokenHash, expiresAt, revokedAt, createdAt, userAgent optional.
- `Project`: id, slug (unique), title, description, level, tier (`FREE`, `PRO`), status (`DRAFT`, `COMING_SOON`, `PUBLISHED`), estimatedHours, order, createdAt, updatedAt.
- `Module`: id, projectId, title, description, order, status.
- `Lesson`: id, moduleId, slug, title, contentMarkdown (or validated structured content), order, durationMinutes, publishedAt, status.
- `Resource`: id, projectId optional, lessonId optional, title, type, storageKey/url, tier, status.
- `Enrollment`: id, userId, projectId, createdAt, unique(userId, projectId).
- `LessonProgress`: id, userId, lessonId, status, completedAt, updatedAt, unique(userId, lessonId).
- `Checkpoint`: id, lessonId, title, instructions, order.
- `CheckpointProgress`: id, userId, checkpointId, status, updatedAt, unique(userId, checkpointId).
- `Purchase`: id, userId, provider, providerOrderId (unique where present), status (`PENDING`, `PAID`, `FAILED`, `REFUNDED`), amountMinor, currency, createdAt, paidAt.
- `Entitlement`: id, userId, tier, purchaseId optional, grantedAt, revokedAt; ensure no duplicate active entitlements.
- `WebhookEvent`: id, provider, providerEventId (unique), payloadDigest, processedAt, processingStatus; never log full sensitive payloads.
- `CampaignVisit` / `LeadEvent`: anonymous or consented identifiers, UTM fields, event type, timestamp; avoid collecting unnecessary personal data.
- `AuditLog`: admin actions and sensitive entitlement changes, actorId, action, objectType, objectId, timestamp.

Use indexes for lesson order, project slug, purchase status and user progress. Define cascade/restrict delete behavior deliberately. Prefer soft deletion/anonymization for account deletion where payment records must be retained for legal compliance.

## 8. API design (illustrative)

### Public
- `GET /api/health` → JSON service status (no secrets)
- `GET /api/projects` → published projects, availability and tiers
- `GET /api/projects/:slug` → public overview only
- `GET /api/projects/:slug/curriculum` → public lesson titles, not paid lesson bodies
- `GET /api/pricing` → current offer and availability
- `POST /api/analytics/events` → allowlisted event types, rate-limited, privacy-conscious

### Authentication
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

### Student (authenticated)
- `GET /api/me/dashboard`
- `GET /api/me/enrollments`
- `POST /api/projects/:slug/enroll`
- `GET /api/projects/:slug/lessons/:lessonSlug` → enforce tier entitlement
- `PUT /api/lessons/:id/progress`
- `PUT /api/checkpoints/:id/progress`
- `GET /api/me/progress`
- `GET /api/resources/:id/download` → authorized signed download or controlled response
- `GET /api/me/purchases`

### Commerce (phase-gated)
- `POST /api/checkout/session` → authenticated; amount and product derived server-side
- `GET /api/checkout/status/:orderId` → owner only
- `POST /api/webhooks/payments/:provider` → verify signature/raw body and idempotency

### Admin (role-checked)
- CRUD projects/modules/lessons/resources with draft/publish workflow
- User list with least-privilege exposure
- Purchase and entitlement views, audited manual corrections
- Aggregate funnel metrics and course progress

**Response convention:** stable `{ data, error, meta }` structure, correct HTTP status codes, sanitized error messages, pagination for lists. Never send password hashes or secret tokens.

## 9. Learning product: Free — TaskFlow Lite

**Project:** Full-stack personal task manager.  
**Time target:** 8–12 hours for someone with JS fundamentals; validate with beta users.  
**Scope:** single-user task CRUD; no authentication needed inside this teaching project (the education platform itself has auth).  
**Outcome:** working frontend, REST API, PostgreSQL persistence, tests, deployable architecture, professional README.

### Required features
- Create task with title, optional description, status, priority, due date.
- List tasks, search by title, filter by status/priority, sort by due date/created date.
- Edit task and mark complete.
- Delete task with confirmation.
- Loading, empty, validation and API-error states.
- Mobile-responsive UI.
- Backend request validation, safe error handling, database migrations.
- Unit/API tests for happy and failure paths.
- Deployment guide and `.env.example`.

### Teaching project schema
`Task(id, title, description?, status: TODO|IN_PROGRESS|DONE, priority: LOW|MEDIUM|HIGH, dueDate?, createdAt, updatedAt)`.

### Teaching project API
- `GET /api/tasks?status=&priority=&search=&sort=`
- `GET /api/tasks/:id`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`
- `DELETE /api/tasks/:id`

### Free modules and acceptance checkpoints
1. **Define the problem:** user stories, feature scope, wireframe, architecture sketch. Checkpoint: student can explain client/API/DB responsibilities.
2. **Set up workspace:** frontend/backend/database, scripts, environment. Checkpoint: both services run and health check passes.
3. **Build the API:** CRUD, Zod validation, Prisma. Checkpoint: API requests succeed and invalid input returns 400.
4. **Build the UI:** React forms, task list, filters, state. Checkpoint: UI handles empty/loading/error states.
5. **Integrate and test:** connect frontend to API, add tests. Checkpoint: task survives page refresh; tests pass.
6. **Ship and explain:** deployment, README, screenshots, demo, limitations. Checkpoint: public repository with safe configuration and reproducible setup.

### Free downloadable assets
- Project brief (Markdown/PDF export later).
- Student starter repository with TODO markers (not full solution).
- 10 practical prompts (below).
- API contract and data model worksheet.
- README template and deployment checklist.
- Reference implementation accessible after checkpoints, with clear spoiler labeling.

### Ten free AI prompts (student-facing)
Each prompt must remind the AI to ask clarifying questions where needed, teach rather than blindly generate everything, and check security.

**F01 — Scope:** "Act as a senior full-stack mentor. I know basic JavaScript. Help me scope TaskFlow Lite into a buildable MVP. Ask up to 5 clarifying questions, then give user stories, out-of-scope features, and an acceptance checklist. Don't write the app for me."

**F02 — Architecture:** "Review my TaskFlow Lite requirements and propose a simple React + Express + PostgreSQL architecture. Explain data flow and why each layer exists. Flag unnecessary complexity."

**F03 — Data model:** "Help me design a Prisma Task model with status, priority and due date. Explain field types, defaults, validation and migration risks. Ask me to justify each field."

**F04 — API contract:** "Help me define REST endpoints for task CRUD and filtering. For each endpoint show request, success response, validation errors and HTTP status codes. Don't implement until I approve the contract."

**F05 — Frontend decomposition:** "Break my TaskFlow Lite React UI into small components and state responsibilities. Explain form validation, loading, empty and error states. Give an implementation order."

**F06 — Guided implementation:** "I'm implementing [feature]. Here is my code: [paste]. Give me hints first, then a small targeted example only if necessary. Preserve my existing style and explain every change."

**F07 — Debugging:** "I'm seeing [error] when [steps]. Here are logs and relevant code: [paste, with secrets removed]. Rank likely causes, suggest minimal reproduction, and tell me what to inspect before changing code."

**F08 — Testing:** "Review my TaskFlow Lite API behavior and propose Vitest/Supertest tests covering success, invalid input, not-found and database failures. Explain what each test proves."

**F09 — Security review:** "Review this small full-stack task app for input validation, injection risks, secret handling, CORS and unsafe error exposure. Separate critical issues from optional hardening."

**F10 — Portfolio readiness:** "Act as a technical interviewer. Review my README, screenshots, tests and architecture notes. Identify gaps, ask me five questions about my design decisions, and help me write an honest project summary without exaggerating my contributions."

## 10. Pro curriculum — three differentiated projects

### Pro 1: ExpensePilot — Personal Finance Tracker (Junior)
**Features:** accounts; secure login/logout; personal transactions; categories; monthly budget; filters; charts; accessible responsive dashboard; export CSV (safe formatting); owner-only access to financial records.  
**Skills:** auth, authorization, relational DB, aggregation, charts, validation, testing.  
**Milestones:** product scope → data model → auth → transactions → reporting → tests → deployment → interview pack.  
**Security:** never use real financial credentials or bank integrations; use synthetic data only.  
**Estimated student effort:** 18–25 hours (hypothesis).

### Pro 2: TeamBoard — Collaborative Project Manager (Intermediate)
**Features:** teams, invitations, roles (owner/member), projects, tasks, assignees, comments, Kanban, pagination, activity stream.  
**Skills:** RBAC, multi-tenant authorization, relational queries, concurrency basics, integration tests.  
**Milestones:** permissions matrix → relational model → team membership → CRUD → collaboration → tests → deploy → interview pack.  
**Security:** ensure no cross-team data access, including guessed IDs.  
**Estimated student effort:** 25–35 hours (hypothesis).

### Pro 3: IssueForge — Bug & Issue Tracker (Advanced Junior)
**Features:** issue lifecycle, severity/priority, assignments, search/filter, comments, audit trail, attachments (optional phase 2), reporting.  
**Skills:** indexing, audit logs, pagination, safe filtering, access control, performance testing, security review.  
**Milestones:** domain model → APIs → filters → audit log → tests → performance → deploy → interview pack.  
**Security:** protect file uploads if implemented; default to no uploads in first release.  
**Estimated student effort:** 30–45 hours (hypothesis).

### Required Pro deliverables per project
- Problem statement, persona, user stories, requirements, scope boundaries.
- Architecture diagram, schema, API contract and key tradeoffs.
- Starter repository and step-by-step guided lessons.
- Project-specific AI prompts (target total 40+ across Pro).
- Tested reference solution and seed/demo data.
- Security, validation, failure-case and integration test checklist.
- Deployment and operational README.
- GitHub portfolio presentation pack.
- 10–15 interview questions with explanation-oriented answer guidance.
- Rubric: correctness, maintainability, security, testing, UX, communication.

**Content release rule:** Never auto-generate and publish unreviewed large codebases as final reference solutions. Verify every example, dependency, migration and command. Mark all unbuilt content `COMING_SOON`.

## 11. Content authoring and learning design

Lesson template:
```
Title
Outcome (what the learner will build)
Prerequisites
Time estimate
Problem context
Step-by-step implementation
Code examples with file paths
Expected behavior / screenshots
Common mistakes and debugging hints
AI mentor prompt
Checkpoint (observable acceptance criteria)
Stretch goal
Git commit suggestion
```

Teaching rules:
- Explain **why** before **how**.
- Avoid full copy/paste solutions as the primary instruction.
- Provide progressive hints and explicit spoiler reveal for reference code.
- Require a written explanation of one technical tradeoff per module.
- Use synthetic test data; no user secrets in examples.
- Do not falsely label generated material as human-reviewed.

## 12. Admin and content operations

Minimum admin capabilities:
- Create/edit projects, modules, lessons, resources.
- Preview draft lessons without exposing them publicly.
- Publish/unpublish with confirmation and audit logging.
- Mark Pro projects as `COMING_SOON`, `PUBLISHED`.
- View anonymized/aggregate funnel and course completion metrics.
- View payment statuses and entitlements once payment integration is enabled.
- Export aggregated metrics as CSV without exposing unnecessary personal data.

For the first iteration, content can be seeded from version-controlled Markdown/MDX files with metadata and imported to DB. A full rich-text editor is optional and should not block MVP.

## 13. Instagram marketing and acquisition

**Primary Instagram account:** `@skitgonewild`  
**Series:** Ahmed & Claude  
**Primary CTA test keyword:** `BUILD`  
**Message:** A short comedic story highlights a real developer pain point; CTA offers the complete free starter project.

### Initial Reel concepts
1. "Ahmed has 17 calculator apps" → portfolio originality → free planning template.
2. "Frontend without backend" → full-stack architecture → free TaskFlow Lite.
3. "Claude wrote it; Ahmed can't explain it" → code understanding → AI mentor prompts.
4. "Ahmed pushed `.env` to GitHub" → security checklist → free project checklist.
5. "Ahmed freezes in a job interview" → explanation and documentation → portfolio readiness.

### Funnel
Reel → comment `BUILD` → approved compliant DM automation → free landing page → optional account → first project milestone → transparent Pro offer.

**Implementation note:** Instagram DM automation is an external integration, not required for platform MVP. Do not assume Meta Graph API permits all comment-to-DM actions, follow-checking, or file attachments. Verify current permissions and policies. Never fabricate follow status. Prefer sending a link to the free resource over an unsupported PDF attachment. Require user authorization before publishing or sending messages from accounts.

### Tracking events
- `landing_view`
- `free_cta_click`
- `signup_complete`
- `project_enrolled`
- `lesson_started`
- `checkpoint_completed`
- `free_project_completed`
- `pro_offer_view`
- `checkout_started`
- `purchase_confirmed`

Use UTM source/campaign/content; define consent, retention, deduplication, and privacy controls. Do not count comments as verified leads or purchases.

## 14. Pricing, payments, and policy

**Test offer:** EGP 249 one-time, not subscription. Payment provider selection must be verified for actual Egyptian merchant eligibility, fees, settlement, webhook support, and legal requirements. No specific provider is assumed approved or integrated.

### Checkout requirements (later phase)
- Show exact deliverables and available/coming-soon status.
- Server-authoritative price and currency.
- Provider-hosted or approved payment checkout; never store card details.
- Verify webhook signatures and payment status; idempotent fulfillment.
- Record refunds and revoke entitlements when policy requires.
- Publish clear terms, privacy and refund policy reviewed by the business owner and local counsel where necessary.
- Never activate paid purchase buttons before payment flow has been tested end-to-end.

## 15. Metrics and validation

**North-star for Free:** users completing and explaining a working project.  
**North-star for Pro:** paid users completing a differentiated project and reporting value.

Track:
- Reel views → unique landing sessions (with privacy limits)
- Landing → Free CTA rate
- Free CTA → account signup rate
- Signup → first lesson started
- First lesson → first checkpoint
- First checkpoint → completed free project
- Completed free project → Pro offer view
- Offer view → checkout start
- Checkout start → confirmed purchase
- Refunds, support issues, lesson drop-off

**Experiment design:** Test free offer with 3–5 Reels and 5–10 beta learners. Interview both finishers and drop-offs. Treat all conversion-rate forecasts as hypothetical. If people request the free resource but don't start, fix onboarding/content before expanding paid scope.

## 16. Delivery phases and gates

### Phase 0 — Repository discovery and plan
- Inspect current repository and tools; do not overwrite unrelated work.
- Produce architecture, dependency audit, backlog, risks and delivery plan.
- Confirm business decisions and unknowns before integrating paid services.

### Phase 1 — Foundation
- Monorepo, lint/format/typecheck, Docker Compose PostgreSQL, Prisma migrations, CI, env example, documentation.
- Responsive RTL design system and app shell.

### Phase 2 — Free learning platform MVP
- Public landing/pricing/catalog.
- Auth, dashboard, published project/lesson reading, enrollments, progress/checkpoints.
- TaskFlow Lite content and downloadable resources.
- Admin seed/import and protected preview.
- Privacy/terms/contact placeholders explicitly marked for owner review.
- Unit, integration and E2E smoke tests.

### Phase 3 — Validate acquisition and learning
- UTM attribution and privacy-respecting events.
- Real beta testing; fix onboarding, content and broken steps.
- Link-based DM flow outside platform if approved.

### Phase 4 — Pro MVP
- Finish ExpensePilot content, reference implementation and QA.
- Add entitlements and gated lessons; keep checkout disabled until provider approved and ready.
- Implement payment integration only with credentials and explicit owner approval.

### Phase 5 — Expand Pro
- Build/QA TeamBoard, then IssueForge; release individually after acceptance.
- Improve analytics, support, accessibility and reliability.

**Rough schedule:** Free MVP ~2–3 weeks, validation ~1–2 weeks, first Pro deliverable ~3–5 additional weeks for a capable focused team using AI tools; not a commitment. Re-estimate after repository inspection.

## 17. Definition of Done

A feature is done only when:
1. Behavior matches written acceptance criteria.
2. Typecheck, lint, relevant tests and build pass.
3. Input validation, authorization and error states are covered.
4. UI works in RTL and mobile layout and is keyboard usable.
5. Documentation, migration and `.env.example` are updated.
6. No credentials, fake metrics or placeholder payment success flows ship as real.
7. New paid content is inaccessible without a verified entitlement.
8. Release status reflects reality (`COMING_SOON` until reviewed and complete).
9. Developer provides a concise implementation summary, files changed, commands run, test results, and known limitations.

## 18. Acceptance tests / critical scenarios

**Public:** visitor can browse catalog and pricing without logging in; paid lesson bodies not exposed.  
**Auth:** signup, login, logout, wrong password, session expiry, password reset, rate limiting.  
**Free:** new user enrolls, opens lesson, completes checkpoint, resumes progress after logout/login, downloads authorized resource.  
**Permissions:** anonymous and Free users cannot fetch Pro content by guessing API paths, asset URLs or IDs.  
**Admin:** student cannot reach admin endpoints; admin drafts remain private.  
**Learning:** TaskFlow Lite project runs from documented clean install; API tests and frontend smoke tests pass.  
**Payments (only when enabled):** forged webhook rejected; duplicate valid webhook does not duplicate entitlement; failed payment grants no access; refunds handled correctly.  
**Privacy:** no plaintext passwords, leaked tokens, or sensitive logging; delete/export pathway documented.  
**Accessibility:** RTL readable, keyboard navigable, semantic labels, contrast, mobile viewport.  
**Deployment:** production migrations and environment validation succeed; health check is JSON, not SPA fallback.

## 19. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Freebie seekers but no buyers | Validate offer and price before building all Pro projects |
| Too much scope | Phase gates; one free project and one Pro project first |
| Copy-paste AI learning | Checkpoints, hints, explanations, interview questions |
| Security/payment mistakes | Server-side auth, authorization, webhook verification, tests |
| Weak learning quality | Real beta learners, tested reference solutions, revision loop |
| Instagram API limitations | Treat DM automation as optional, verify permissions |
| Copyright/brand confusion | Original content/assets, no misleading affiliation claims |
| Unexpected hosting costs | Avoid always-on AI inference, use low-cost services and budgets |

---

# PART B — MASTER PROMPT FOR CLAUDE CODE

> Copy the entire prompt below into Claude Code **together with this file**, or put this file at the repository root and ask Claude Code to read it. The prompt intentionally requires a plan and phased implementation rather than one giant unreviewed code dump.

```text
You are Claude Code, acting as the lead product engineer, full-stack architect, instructional designer, QA engineer, and technical project manager for the project:

Ahmed & Claude — Portfolio Builder.

SOURCE OF TRUTH:
Read the entire file `Ahmed_Claude_Portfolio_Builder_Claude_Code.md` at the repository root before writing code. The complete Product Requirements, curriculum, architecture, security, acceptance tests and phase gates in that document are binding unless I explicitly approve a change.

MISSION:
Build a production-minded, Arabic-first, RTL-friendly, mobile-responsive Full Stack educational product that offers a complete FREE project (TaskFlow Lite) and a future paid PRO tier (ExpensePilot, TeamBoard, IssueForge). The target user knows basic programming but needs real portfolio projects and guided AI-assisted implementation.

NON-NEGOTIABLE RULES:
1. Inspect the repository first. Do not assume it is empty, delete existing files, overwrite user work, or run destructive commands without approval.
2. Start by summarizing what exists, identifying missing requirements, and producing an incremental implementation plan with milestones and acceptance criteria.
3. Ask only essential blocking questions. For nonblocking choices, state sensible defaults and proceed.
4. Use React + Vite + TypeScript + Tailwind on the web; Node.js + Express + TypeScript on the API; PostgreSQL + Prisma; pnpm workspaces. If the existing repo has a conflicting architecture, explain tradeoffs before changing it.
5. Keep TypeScript strict; use Zod for validation; implement secure server-side sessions with HttpOnly cookies, Argon2id, CSRF protection, rate limits, role-based authorization, and least-privilege data access.
6. Never invent successful integrations, payment transactions, test results, customer data, analytics, or completed lesson content.
7. No fake checkout. Paid checkout remains disabled until a real approved provider is integrated, webhook signatures verified, and owner approval received. Do not request or paste credentials into source files or chat.
8. No paid lessons or private assets exposed through public API/static paths. All entitlements checked on server side.
9. Make all student-facing guidance Arabic-first; preserve LTR for code and commands. Use accessible, responsive components.
10. Avoid heavy infrastructure and paid APIs in the MVP. No live AI chatbot is required; the AI prompts are educational text resources.
11. Implement tests for critical paths, especially auth, progress, paid access, admin permissions, input validation, and migrations. Never claim tests passed unless you ran them and saw results.
12. After each milestone, provide changed files, commands run, test results, risks, and exact next steps. Maintain `IMPLEMENTATION_STATUS.md` and `DECISIONS.md`.
13. Never publish, send Instagram DMs, or charge customers without explicit owner authorization.
14. Follow the release rule: incomplete Pro projects are `COMING_SOON`, never represented as available or sold as completed.
15. Do not copy copyrighted tutorials or third-party paid course content; write original explanations and examples.

IMPLEMENTATION WORKFLOW:

STEP 0 — DISCOVERY AND PLAN
- Inspect project files, package manifests, git status, toolchain and environment.
- Identify any preexisting code to preserve.
- Write `docs/architecture.md`, `docs/roadmap.md`, `docs/acceptance-criteria.md`, `DECISIONS.md`, and `IMPLEMENTATION_STATUS.md`.
- Provide a prioritized backlog for Phase 1 and Phase 2 with estimated effort and dependencies.
- Explain any blocker requiring my approval.

STEP 1 — FOUNDATION
- Set up monorepo: `apps/web`, `apps/api`, `packages/shared`, `packages/config`, `content`, `docs`.
- Configure pnpm workspaces, strict TS, ESLint, Prettier, scripts, environment validation, `.env.example`, `.gitignore`.
- Add PostgreSQL Docker Compose, Prisma schema/migrations, DB seed scripts.
- Add CI for lint, typecheck, tests, build.
- Build an Arabic RTL design system with accessible UI primitives.
- Create a README with reproducible local setup and troubleshooting.

STEP 2 — PLATFORM FREE MVP
- Public landing, pricing, curriculum catalog, project detail pages.
- Secure signup/login/logout/reset flow, dashboard, account settings.
- Published lesson reader, enrollments, lesson progress, checkpoints, free resource downloads.
- Server-side role and entitlement enforcement.
- Admin-only content import/preview and publish controls (a simple version-controlled content workflow is acceptable initially).
- Add privacy-conscious UTM attribution and funnel event collection.
- Add honest `Coming soon` Pro cards; do not enable payment.

STEP 3 — TASKFLOW LITE EDUCATIONAL CONTENT
- Create a separate, fully working teaching example under `examples/taskflow-lite/reference` and a starter under `examples/taskflow-lite/starter`.
- Build the Task CRUD frontend/backend/Postgres example per the specification.
- Write six Arabic learning modules with objectives, step-by-step tasks, expected results, debugging tips, checkpoint tests, and 10 prompts F01–F10.
- Create README, API contract, schema worksheet, portfolio checklist and deployment instructions.
- Run the reference project tests and verify clean setup.
- Seed the lessons/resources into the learning platform and ensure free users can finish the complete project.

STEP 4 — QA AND DEMO
- Run lint, typecheck, unit/integration tests, production builds and E2E smoke tests.
- Verify anonymous/student/admin and Free/Pro permission boundaries.
- Test RTL and mobile layouts; audit keyboard and form accessibility.
- Provide a demo walkthrough with realistic seed data, never fake production metrics.
- Document any remaining known issues and prioritized fixes.

STEP 5 — PRO PREPARATION, NOT AUTOMATIC LAUNCH
- Design the ExpensePilot curriculum, project specification and implementation backlog.
- Add Pro entitlement data model and access tests, but leave checkout disabled.
- Mark TeamBoard and IssueForge as Coming Soon.
- Ask me before starting real payment integration, publishing paid content, or beginning large Pro implementation.

DELIVERY STANDARDS:
- Make changes in small, reviewable commits or coherent batches.
- Prefer simple, maintainable code over overengineering.
- For every endpoint include validation, correct status codes, and security tests.
- Keep documentation synchronized with actual code.
- If tools, network, or external credentials are unavailable, implement the local/testable portion and clearly report the limitation; do not claim completion.
- Avoid unnecessary dependencies and API costs.

START NOW:
1. Read the specification file completely.
2. Inspect the repository and report findings.
3. Present the Phase 1/2 plan, assumptions and any truly blocking questions.
4. If the repository is suitable and there are no blockers, begin Phase 1 foundation and Phase 2 Free MVP in small tested increments.
5. Stop before any real payments, publishing, messaging, or irreversible external action and request explicit approval.
```

---

# PART C — QUICK START FOR THE OWNER

1. Create a repository/folder, e.g. `ahmed-claude-portfolio-builder`.
2. Place **this Markdown file at the repository root** with the exact filename `Ahmed_Claude_Portfolio_Builder_Claude_Code.md`.
3. Open the folder in Claude Code.
4. Paste the **Master Prompt** from Part B, or say: `Read Ahmed_Claude_Portfolio_Builder_Claude_Code.md fully and execute PART B step by step.`
5. Review the architecture/roadmap before authorizing payment providers or external integrations.
6. Request working screenshots, test logs and a clean-install walkthrough at each milestone.
7. Start beta testing with real users before expanding the Pro curriculum.

## Owner decisions still open
- Confirm public-facing brand/name and domain.
- Confirm whether to require signup for progress (recommended) while allowing sample browsing anonymously.
- Choose actual hosting and deployment budgets.
- Choose payment provider and approve policies **later**.
- Supply original/authorized character artwork if desired.
- Decide the support email, legal business identity, privacy policy and refund terms.
- Confirm content review and publishing ownership.

**Final principle:** Ship one useful, secure, fully tested free experience before scaling the paid product. Measure learning completion and actual purchase intent—not only views or comments.
