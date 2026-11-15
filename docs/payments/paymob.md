# Paymob integration — Portfolab Pro

Status: **implemented and tested against a mocked Paymob API. Never called the real Paymob API. Live payments are blocked in code.** Checkout is closed until all three gates are open (see §5).

Sources used (verify again before go-live, Paymob docs change):
- Create Intention: https://developers.paymob.com/paymob-docs/developers/intention-apis/create-intention
- Unified Checkout: https://developers.paymob.com/paymob-docs/developers/checkout-experiences/unified-checkout-redirection
- HMAC (transaction processed callback): https://developers.paymob.com/paymob-docs/developers/webhook-callbacks-and-hmac/hmac/hmac-transaction-callback
- Transaction inquiry: https://developers.paymob.com/paymob-docs/developers/transaction-inquiry-apis/by-transaction-id

## 1. Flow

```
/checkout (web, logged in)
  └─ POST /api/checkout/session {firstName,lastName,phoneNumber}       (CSRF + rate limit)
       ├─ Purchase(PENDING, 24900 EGP minor, provider=paymob)          price is server-side only
       ├─ POST {PAYMOB_BASE_URL}/v1/intention/  Authorization: Token <secret>
       │     special_reference = Purchase.id
       │     notification_url  = {API_PUBLIC_URL}/api/webhooks/payments/paymob
       │     redirection_url   = {APP_URL}/checkout/status?purchase=<id>
       └─ returns {PAYMOB_BASE_URL}/unifiedcheckout/?publicKey=…&clientSecret=…
customer pays on Paymob
Paymob ─POST→ /api/webhooks/payments/paymob?hmac=…   (no CSRF, own JSON parser, rate limited)
       ├─ HMAC-SHA512 over 20 ordered fields, constant-time compare → 401 if invalid
       ├─ WebhookEvent(provider, "<txId>:<success>:<pending>:<refunded>:<voided>") unique → duplicates acknowledged, not reprocessed
       ├─ amount_cents + currency must equal the Purchase → else no access ("amount_mismatch")
       ├─ success & !pending → PAID + Entitlement(PRO) (DB unique index: one active per user/tier) + audit log
       │                       + purchase_completed once (Purchase.analyticsCapturedAt claim)
       ├─ !success & !pending → FAILED (+ checkout_failed)
       ├─ is_refunded/is_voided/is_refund/is_void → REFUNDED, entitlement revoked, audit log
       └─ pending → no change
/checkout/status polls GET /api/checkout/status/:id (owner only) every 3 s for up to 1 min; after ~15 s it adds
?refresh=1, which reconciles via transaction inquiry once the order is > 1 min old and PAYMOB_API_KEY is set.
The redirect's query string is never trusted.
```

## 2. Environment variables (`apps/api/.env`)

| Variable | Notes |
|---|---|
| `CHECKOUT_ENABLED` | `true` to allow checkout (still gated by config + published Pro content) |
| `API_PUBLIC_URL` | Public HTTPS base URL of the API (Paymob must reach it) |
| `APP_URL` | Public web URL (redirect target) |
| `PAYMOB_BASE_URL` | `https://accept.paymob.com` (Egypt) |
| `PAYMOB_SECRET_KEY` | `sk_test_…` while testing |
| `PAYMOB_PUBLIC_KEY` | `pk_test_…` while testing |
| `PAYMOB_HMAC_SECRET` | Dashboard → Settings → Account Info → HMAC |
| `PAYMOB_INTEGRATION_IDS` | comma-separated integration ids (test integrations while testing) |
| `PAYMOB_API_KEY` | legacy API key, only for reconciliation |
| `PAYMOB_ALLOW_LIVE` | must stay `false` until you approve going live; `sk_live_`/`pk_live_` keys are refused otherwise |

All secrets are server-only. None are exposed to the browser, logged, or returned by any endpoint (admin sees only `mode`, `configured`, and the names of missing variables).

## 3. Merchant dashboard configuration (manual)

1. Create/verify the Paymob merchant account for Egypt (KYC, settlement bank, legal entity) — **owner action**.
2. Create **test** integrations for the payment methods you want (card; wallets optional) in EGP; note their integration IDs.
3. For each integration, set:
   - **Transaction processed callback**: `https://<API_PUBLIC_URL>/api/webhooks/payments/paymob`
   - **Transaction response callback**: `https://<APP_URL>/checkout/status` (the app ignores its query params and asks the API)
   (The intention also sends `notification_url`/`redirection_url`; set both places so behavior is consistent.)
4. Copy secret key, public key, HMAC secret and integration IDs into `apps/api/.env` (never into git).
5. Use Paymob's published **test cards** from their docs for sandbox runs. Do not use real cards in test mode.

## 4. Operations

- Reconcile stuck pending orders (e.g. cron every 10 min): `pnpm --filter @pb/api payments:reconcile [olderThanMinutes=10] [limit=50]`. Pending orders with no Paymob transaction after 24 h become `FAILED (expired_without_payment)`.
- Refunds/voids: perform them in the Paymob dashboard; the resulting callback sets the purchase to `REFUNDED` and revokes Pro.
- Logs contain only `purchase=<id> <status> via <source>`; payloads are stored as SHA-256 digests only.
- Retention: `pnpm --filter @pb/api analytics:purge` removes webhook records and first-party analytics older than `ANALYTICS_RETENTION_DAYS`.

## 5. Go-live gates (all required)

1. `CHECKOUT_ENABLED=true`
2. Paymob configured (all variables above) and, for live keys, `PAYMOB_ALLOW_LIVE=true` — **requires your explicit approval**
3. At least one Pro project `PUBLISHED` (all are `COMING_SOON` today, so checkout is closed regardless)

Before flipping live: run the sandbox checklist below, publish final terms/refund policy, confirm Paymob payout settings.

### Sandbox checklist

- [ ] Successful test card → `/checkout/status` shows PAID; DB `Purchase.status = PAID`; entitlement active; one `purchase_completed` in PostHog.
- [ ] Declined test card → FAILED; no entitlement.
- [ ] Replay the same callback (Paymob dashboard "resend" if available) → response `duplicate: true`; no second entitlement/event.
- [ ] Refund in dashboard → REFUNDED; Pro lesson returns 403.
- [ ] Stop the API during payment, restart, run `payments:reconcile` → PAID.
- [ ] Confirm the HMAC field list still matches the current Paymob doc (sample vector is in `apps/api/test/payments.test.ts`).

## 6. Known limitations / risks

- The `transaction_inquiry` response shape is not fully documented by Paymob; the code validates it against the same schema as callbacks and ignores anything else. Verify in sandbox.
- Two simultaneous pending purchases by the same user that both succeed: both become PAID, one entitlement exists (tied to the first). Refunding the first would revoke access while the second is still paid. Checkout refuses to start when an active entitlement exists, so this needs two parallel tabs; handle manually if it happens.
- Phone number is sent to Paymob (required by their billing_data) and not stored by Portfolab.
