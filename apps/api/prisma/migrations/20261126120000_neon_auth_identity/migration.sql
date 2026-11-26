-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "neonSessionId" TEXT;

-- CreateTable
CREATE TABLE "NeonAuthIdentity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoginAt" TIMESTAMP(3),

    CONSTRAINT "NeonAuthIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NeonAuthIdentity_userId_key" ON "NeonAuthIdentity"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NeonAuthIdentity_subject_key" ON "NeonAuthIdentity"("subject");

-- CreateIndex
CREATE INDEX "Session_neonSessionId_idx" ON "Session"("neonSessionId");

-- AddForeignKey
ALTER TABLE "NeonAuthIdentity" ADD CONSTRAINT "NeonAuthIdentity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
