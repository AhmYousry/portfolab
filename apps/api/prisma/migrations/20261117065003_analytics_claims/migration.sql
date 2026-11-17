-- CreateTable
CREATE TABLE "AnalyticsClaim" (
    "event" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnalyticsClaim_pkey" PRIMARY KEY ("event","userId","subject")
);

-- AddForeignKey
ALTER TABLE "AnalyticsClaim" ADD CONSTRAINT "AnalyticsClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: mark already-happened "once" events as claimed so they never re-fire after deploy.
INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT 'project_started', "userId", "projectId" FROM "Enrollment"
ON CONFLICT DO NOTHING;

INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT 'lesson_started', "userId", "lessonId" FROM "LessonProgress" WHERE "status" <> 'NOT_STARTED'
ON CONFLICT DO NOTHING;

INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT 'lesson_completed', "userId", "lessonId" FROM "LessonProgress" WHERE "status" = 'COMPLETED'
ON CONFLICT DO NOTHING;

INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT 'checkpoint_completed', "userId", "checkpointId" FROM "CheckpointProgress" WHERE "status" = 'COMPLETED'
ON CONFLICT DO NOTHING;

INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT DISTINCT 'project_completed', le."userId", p."id"
FROM "LeadEvent" le JOIN "Project" p ON p."slug" = le."path"
WHERE le."event" IN ('free_project_completed', 'pro_project_completed') AND le."userId" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "AnalyticsClaim" ("event", "userId", "subject")
SELECT 'purchase_refunded', "userId", "id" FROM "Purchase" WHERE "status" = 'REFUNDED'
ON CONFLICT DO NOTHING;