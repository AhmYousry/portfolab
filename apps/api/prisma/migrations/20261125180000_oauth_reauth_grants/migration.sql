-- AlterTable
ALTER TABLE "OAuthAttempt" ADD COLUMN     "sessionId" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "ReauthGrant" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "provider" "OAuthProvider" NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReauthGrant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReauthGrant_tokenHash_key" ON "ReauthGrant"("tokenHash");

-- CreateIndex
CREATE INDEX "ReauthGrant_userId_idx" ON "ReauthGrant"("userId");

-- CreateIndex
CREATE INDEX "ReauthGrant_expiresAt_idx" ON "ReauthGrant"("expiresAt");

-- AddForeignKey
ALTER TABLE "ReauthGrant" ADD CONSTRAINT "ReauthGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReauthGrant" ADD CONSTRAINT "ReauthGrant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
