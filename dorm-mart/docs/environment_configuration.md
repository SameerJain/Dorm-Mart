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

## Frontend build (Vite)

The frontend is built by Vite (`vite.config.mjs`). The variable names are the ones Create React App used, so no deployment variable changed.

- Only `PUBLIC_URL` and variables starting with `REACT_APP_` reach the bundle. They are public. The app reads them as `process.env.<NAME>`, which Vite replaces at build time, together with `process.env.NODE_ENV`.
- A value already in the environment wins: `env-cmd -f .env.<name>` in the `start-local-*` and `build-*-*` npm scripts, or the `ARG`s in the Dockerfile on Railway. A new `REACT_APP_*` variable must be declared as an `ARG` there too.
- Otherwise the first file that defines the variable is used: `.env.<mode>.local`, `.env.local`, `.env.<mode>`, `.env`, where the mode is `development` for `npm start` and `production` for a build. Note that `.env.local` comes before `.env.development`, which is why local development uses `npm run start-local-win` or `start-local-mac`.
- Base path for built assets: `PUBLIC_URL` if set, otherwise `homepage` in `package.json` (`"."`, relative paths, so the build works from any sub-folder such as `/serve/dorm-mart` or the Aptitude and Cattle paths). The Dockerfile sets `PUBLIC_URL=/` for Railway. The dev server serves from `/`.
- The build goes to `build/`, with hashed files in `build/static/` and no source maps. `router.php`, the Dockerfile and `build-scripts-win/` all read `build/`.
- The dev server listens on port 3000 and forwards `/api`, `/images`, `/media` and `/data` to the PHP server on `http://localhost:8080`. Set `BROWSER=none` to stop it opening a browser tab.

## Key Vars

- `PUBLIC_URL`: React build base path.
- `REACT_APP_API_BASE`: frontend API base.
- `REACT_APP_CHAT_NOTIFICATION_ON`: turns chat notifications on in the frontend.
- `FRONTEND_BASE_URL`: backend links into the React app.
- `API_BASE_URL`: backend self-links into `api/`.
- `CORS_ALLOWED_ORIGINS`: comma-separated trusted browser origins.
- `ALLOW_ALL_EMAILS`: account-creation email policy.
- `GMAIL_USERNAME`, `GMAIL_PASSWORD`, `RESEND_API_KEY`, `MAIL_FROM_*`, `SUPPORT_EMAIL`, `SMTP_*`: mail settings. SMTP certificates are verified by default; set `SMTP_ALLOW_SELF_SIGNED=true` only for a trusted local development mail server using a self-signed certificate.
- `DATA_UPLOADS_DIR`: upload storage root. The app derives `images/` and `media/` below this path. On Railway, point it at a mounted volume; when it is unset there, the API logs a warning because uploads would be lost on the next deploy.
- `PROMO_UNSUBSCRIBE_SECRET`: long random string used to sign one-click unsubscribe links (`api/email/unsubscribe.php`) in promotional digests and their `List-Unsubscribe` header. Without it, digests still send but only link to User Preferences.
- `TRUSTED_PROXY_IPS`: comma-separated immediate proxy IP addresses or IPv4/IPv6 CIDRs. Blank (the default) ignores forwarding headers. Configure this on a proxy deployment before release so rate limits and HTTPS detection use the real client rather than the ingress address. Only allow ingress peers that append/overwrite `X-Forwarded-For` and overwrite `X-Forwarded-Proto`; do not allow all private networks or all addresses. Direct local PHP needs no setting.
  - **Railway production requires** `TRUSTED_PROXY_IPS=100.64.0.0/10,::ffff:100.64.0.0/106`. Railway's edge connects to Apache from `100.64.0.x`, and because Apache listens on IPv6 those peers can appear as IPv4-mapped addresses, so both forms are listed. If this is unset, the API never sees HTTPS and redirects every call to itself (`ERR_TOO_MANY_REDIRECTS`, login shows "Failed to fetch") while the home page still loads. Set it on every new Railway environment or web service before its first deploy. To re-check the range, run `railway ssh --service dorm-mart` and read the peer addresses on port 8080 in `/proc/net/tcp6` while requests are coming in; never infer it from a client-supplied header.
- `TRUST_PROXY_GEO_HEADERS`: requires a peer allowed by `TRUSTED_PROXY_IPS`; set to `true` only behind a proxy that overwrites Cloudflare/Vercel geo headers (`CF-IPCity`, `X-Vercel-IP-City`, ...). Off by default, because on Railway those headers come straight from the client; login locations then come from the IP lookup instead.

## Stripe payments

Seed accounts use local mock transactions without any Stripe keys or onboarding.
If either participant is protected, the server chooses mock mode. Checkout,
receipts, and refunds are labeled as mock transactions, and no Stripe request or
money transfer is made. Mock payments do not count toward earnings.

Real payments are off by default. Enable them only after Stripe Connect, HTTPS,
payment-domain registration, and webhooks are configured. Run schema sync before
using either payment flow so the database accepts the mock payment mode.

- `PAYMENTS_ENABLED`: Enables real Stripe payments. Defaults to `false`.
- `PAYMENTS_DEMO_MODE`: Defaults to `true`. While `PAYMENTS_ENABLED` is `false`, every account (not only seed accounts) uses mock transactions, so scheduling, checkout, receipts, and refunds all work with no Stripe keys and no money moving. Set `false` to hide built-in payment from real accounts until Stripe is live. It has no effect once `PAYMENTS_ENABLED=true`; schedules accepted in demo mode then return to manual confirmation.
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

## Browser push

See [Browser push setup](BROWSER_PUSH.md) for VAPID keys, browser requirements,
and the background worker. The server needs `PUSH_VAPID_PUBLIC_KEY`,
`PUSH_VAPID_PRIVATE_KEY`, and `PUSH_VAPID_SUBJECT`. Users enable alerts in
User Preferences; granting permission alone does not subscribe another account.
