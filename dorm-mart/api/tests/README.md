# Backend tests

This folder is blocked from direct HTTP access (see `router.php`'s `$blockedDirs`
and the local `.htaccess`) — everything here runs from the command line only.

## Automated (no setup required)

Run with `npm run test:backend`, or individually:

- `adversarial_validation_test.php` — boundary/validation checks for request helpers,
  image upload, and payment helpers.
- `login_location_test.php` — IP scope detection and location lookup/caching.
- `promotional_digest_test.php` — promo email send-window and eligibility logic.
- `db_connection_test.php` — one-off manual check that the configured database is
  reachable (`php api/tests/db_connection_test.php`).
- `xss_encoding_test.php` — manual browser check that output encoding is applied;
  open `api/tests/xss_encoding_test.php?test=<script>` from a browser on a local/CLI
  host (blocked everywhere else via `require_local_or_cli_access()`).

## `integration/` (needs a running server + real credentials)

These hit a live API over HTTP, so they need a server running first (`npm run
start:api` or equivalent) and, for anything gated behind a login, real
credentials via environment variables:

```
API_TEST_LOGIN_EMAIL=you@buffalo.edu
API_TEST_LOGIN_PASSWORD=your-password
API_TEST_BASE_URL=http://localhost:8080/api   # optional override
```

Endpoint- or scenario-specific integration checks (reset password, purchase
history, SQL/XSS injection probes, login rate limiting). Not run by `npm run
test:backend` — run them individually as needed.
