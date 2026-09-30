# Environment Configuration

Dorm Mart should get deployment-specific values from env vars, not hardcoded host checks.

## Runtime

- Real `.env.*` files are ignored by git and stay local/secret-bearing.
- PHP uses platform env vars first.
- For local PHP env files, set `APP_ENV=local`, `development`, `production`, or `cattle`.
- `ENV_FILE` can point at a specific env file when needed.
- Without `APP_ENV`, PHP keeps the legacy development-then-local fallback.
- Railway uses service environment variables and runs schema migrations through the
  `railway.toml` pre-deploy command. Fixture/data migrations are local-only.

## Key Vars

- `PUBLIC_URL`: React build base path.
- `REACT_APP_API_BASE`: frontend API base.
- `FRONTEND_BASE_URL`: backend links into the React app.
- `API_BASE_URL`: backend self-links into `api/`.
- `CORS_ALLOWED_ORIGINS`: comma-separated trusted browser origins.
- `ALLOW_ALL_EMAILS`: account-creation email policy.
- `GMAIL_USERNAME`, `GMAIL_PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM_*`, `SUPPORT_EMAIL`, `SMTP_*`: mail settings. SMTP certificates are verified by default; set `SMTP_ALLOW_SELF_SIGNED=true` only for a trusted local development mail server using a self-signed certificate.
- `DATA_UPLOADS_DIR`: upload storage root. The app derives `images/` and `media/` below this path. On Railway, point it at a mounted volume; when it is unset there, the API logs a warning because uploads would be lost on the next deploy.
- `PROMO_UNSUBSCRIBE_SECRET`: long random string used to sign one-click unsubscribe links (`api/email/unsubscribe.php`) in promotional digests and their `List-Unsubscribe` header. Without it, digests still send but only link to User Preferences.
- `TRUST_PROXY_GEO_HEADERS`: set to `true` only behind a proxy that overwrites Cloudflare/Vercel geo headers (`CF-IPCity`, `X-Vercel-IP-City`, ...). Off by default, because on Railway those headers come straight from the client; login locations then come from the IP lookup instead.
- `WS_TOKEN_SECRET`: chat WebSocket token signing.

## Stripe payments

Electronic payments are currently switched off in code: `dm_payments_enabled()` in
`api/config/app_config.php` returns `false` regardless of `PAYMENTS_ENABLED`, and migration
`025` is skipped while it does. Turning payments on means changing that function back to
read the variable. Keep it off until Stripe Connect, HTTPS, payment-domain registration,
and both webhook modes are configured.

- `PAYMENTS_ENABLED`: Enables Scheduled Purchase electronic payments (ignored while the function above is hard-coded off).
- `STRIPE_TEST_PUBLISHABLE_KEY`, `STRIPE_TEST_SECRET_KEY`: Stripe Sandbox API keys.
- `STRIPE_LIVE_PUBLISHABLE_KEY`, `STRIPE_LIVE_SECRET_KEY`: Stripe live-mode API keys.
- `STRIPE_TEST_WEBHOOK_SECRET`: Signing secret for `api/payments/webhook_test.php`.
- `STRIPE_LIVE_WEBHOOK_SECRET`: Signing secret for `api/payments/webhook_live.php`.
- `STRIPE_TEST_ACCOUNT_WEBHOOK_SECRET`: Signing secret for `api/payments/account_webhook_test.php`.
- `STRIPE_LIVE_ACCOUNT_WEBHOOK_SECRET`: Signing secret for `api/payments/account_webhook_live.php`.
- `STRIPE_TEST_PAYMENT_METHOD_CONFIGURATION`: Sandbox card-only Payment Method Configuration ID.
- `STRIPE_LIVE_PAYMENT_METHOD_CONFIGURATION`: Live card-only Payment Method Configuration ID.

Live payments require an HTTPS `FRONTEND_BASE_URL`. Never commit real Stripe keys or
webhook secrets to the repository.
