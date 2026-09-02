# Stripe activation checklist

Keep `PAYMENTS_ENABLED=false` until the Sandbox section passes.

## Stripe Dashboard

1. Rotate every API key that was pasted into chat or otherwise exposed. Use only the replacement keys below.
2. Complete the Connect platform profile truthfully for Dorm Mart and enable Accounts v2 early access.
3. Create a Stripe Sandbox. Accounts v2 testing must use Sandbox credentials, not legacy test mode.
4. Under payment methods for connected accounts, create an active parent configuration for Dorm Mart checkout:
   - Cards: on.
   - Link, ACH, bank debits, bank transfers, and every non-card method: blocked.
   - Apple Pay and Google Pay remain available through the card method on supported devices.
5. Register the production checkout domain. The onboarding endpoint also attempts registration for each connected account.

## Event destinations

Create Sandbox and live connected-account webhook destinations for:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `refund.created`, `refund.updated`, `refund.failed`
- `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`

Point them to `/api/payments/webhook_test.php` and `/api/payments/webhook_live.php` respectively.

Create separate Accounts v2 event destinations for:

- `v2.core.account[requirements].updated`
- `v2.core.account[configuration.merchant].capability_status_updated`

Point them to `/api/payments/account_webhook_test.php` and `/api/payments/account_webhook_live.php` respectively.

## Deployment variables

Set these in the deployment secret store, never in git:

- `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_TEST_SECRET_KEY`
- `STRIPE_TEST_WEBHOOK_SECRET`, `STRIPE_TEST_ACCOUNT_WEBHOOK_SECRET`
- `STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION` (the Sandbox parent configuration ID)
- Live equivalents of all five variables
- `FRONTEND_BASE_URL=https://dormmart.me`

Run migration `025_stripe_connect_payments.sql`, deploy with payments disabled, and complete the scenarios in the integration plan. Enable `PAYMENTS_ENABLED=true` only after Sandbox passes and Stripe confirms the direct-charge marketplace responsibility model for live use.
