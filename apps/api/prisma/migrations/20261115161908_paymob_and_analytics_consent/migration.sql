-- AlterTable
ALTER TABLE "Purchase" ADD COLUMN     "analyticsCapturedAt" TIMESTAMP(3),
ADD COLUMN     "failedAt" TIMESTAMP(3),
ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "intentionId" TEXT,
ADD COLUMN     "providerTransactionId" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "analyticsConsent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "analyticsConsentAt" TIMESTAMP(3);
