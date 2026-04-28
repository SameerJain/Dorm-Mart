# Environment Configuration

Dorm Mart should get deployment-specific values from env vars, not hardcoded host checks.

## Runtime

- Real `.env.*` files are ignored by git and stay local/secret-bearing.
- PHP uses platform env vars first.
- For local PHP env files, set `APP_ENV=local`, `development`, `production`, or `cattle`.
- `ENV_FILE` can point at a specific env file when needed.
- Without `APP_ENV`, PHP keeps the legacy development-then-local fallback.
- Railway uses service environment variables; this repo does not use `railway.toml`.

## Key Vars

- `PUBLIC_URL`: React build base path.
- `REACT_APP_API_BASE`: frontend API base.
- `FRONTEND_BASE_URL`: backend links into the React app.
- `API_BASE_URL`: backend self-links into `api/`.
- `CORS_ALLOWED_ORIGINS`: comma-separated trusted browser origins.
- `ALLOW_ALL_EMAILS`: account-creation email policy.
- `GMAIL_USERNAME`, `GMAIL_PASSWORD`, `SENDGRID_API_KEY`, `MAIL_FROM_*`, `SUPPORT_EMAIL`, `SMTP_*`: mail settings.
- `DATA_IMAGES_DIR`, `DATA_IMAGES_URL_BASE`: stored image paths.
- `WS_TOKEN_SECRET`: chat WebSocket token signing.
