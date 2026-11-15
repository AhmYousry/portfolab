-- At most one active (non-revoked) entitlement per user and tier.
CREATE UNIQUE INDEX "Entitlement_active_user_tier_key" ON "Entitlement"("userId", "tier") WHERE "revokedAt" IS NULL;
