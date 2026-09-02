# Dorm Mart Stripe integration plan

This plan is based on Stripe Implementation Planner guide `iguide_61VFjXLuCdijDkZIu41AovEd70oOb` and the accepted direct-charge recommendation.

## Business and payment model

- Dorm Mart is a US university marketplace for physical goods sold by one student to another.
- A buyer may pay only for an accepted Scheduled Purchase during `[meeting_at, meeting_at + 30 minutes)`.
- The seller is merchant of record. Each payment is a direct charge on the seller's connected account.
- Dorm Mart takes no application fee. Stripe fees, refunds, disputes, negative balances, and payouts belong to the seller/Stripe according to the connected-account agreement.
- Payments are USD $0.50–$9,999.99. Trades, ACH, Link, saved methods, subscriptions, escrow, and split payments are out of scope.

## Connect configuration

Create new sellers with Accounts v2:

- `dashboard: full`
- `defaults.responsibilities.fees_collector: stripe`
- `defaults.responsibilities.losses_collector: stripe`
- `configuration.merchant.capabilities.card_payments.requested: true`
- Stripe-hosted Account Link onboarding for the `merchant` configuration

Full Dashboard gives sellers direct access to payments, payouts, refunds, disputes, and compliance tasks. If Dorm Mart later embeds these surfaces, start with `notification_banner`, `account_management`, `payments`, and `payouts` components.

## Charge and funds flow

```text
Buyer -> direct PaymentIntent on seller account -> seller Stripe balance -> seller bank
                                                   |-> Stripe processing fees
Dorm Mart application fee: $0
```

PaymentIntents use dynamic payment methods with a card-only Payment Method Configuration. This allows cards and eligible Apple Pay/Google Pay wallets while disabling Link and bank methods. Do not pass `payment_method_types`.

## State and webhook rules

- The database is authoritative for the payment window, fallback, completion, and inventory state.
- Webhooks are signature-verified, mode-separated, account-matched, amount/currency/metadata-validated, and idempotent by Stripe event ID.
- A timely verified `payment_intent.succeeded` completes the purchase once.
- Once fallback is recorded, it is irreversible. Any later success receives one full idempotent refund.
- Failure/refund events may advance state but cannot regress terminal states.
- Subscribe connected-account destinations to PaymentIntent, refund, and dispute events. Add Accounts v2 requirement/capability events for prompt seller-readiness updates; the app also refreshes v2 status when Payments settings load.

## Environments and launch gate

- Protected test users use Stripe test/Sandbox credentials; unprotected users use live credentials. Mixed-mode pairs cannot use built-in payments.
- Keep `PAYMENTS_ENABLED=false` until migrations, card-only Payment Method Configurations, webhook secrets, HTTPS, and scenario tests are complete.
- Before enabling live mode, rotate every credential exposed outside the deployment secret store.
- Direct charges with full Dashboard and Stripe collecting fees/losses are supported, but Dorm Mart is a marketplace storefront. Complete the Connect platform profile truthfully and get Stripe confirmation that this responsibility model fits the live business before launch.

## Required scenario tests

1. Seller onboarding incomplete, then ready.
2. Successful card payment and wallet payment during the window.
3. Decline/retry and webhook retry/out-of-order delivery.
4. Window expiry and seller disconnect fallback.
5. Success after fallback or cutoff produces exactly one full refund.
6. Seller refund, interrupted refund retry, dispute notification, and mixed-mode rejection.
