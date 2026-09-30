# Refactoring Plan

Last assessed: 2026-09-30, on branch `145-Setup-Railway-Deployment-System`.

This plan lists code smells and technical debt in Dorm Mart. Each item has a priority score, and the plan says in what order to fix them. The status column shows what has been fixed. For earlier refactors, see [`code-review-refactor-report.md`](../code-review-refactor-report.md).

## Codebase snapshot

| Area | Files | Lines | Notes |
|---|---|---|---|
| React (`src/`, CRA 5, React 19) | 236 `.js`/`.jsx` | ~30.9k | 38 Jest suites, 156 tests |
| PHP API (`api/`, PHP 8, mysqli) | 172 `.php` | ~23.5k | One file per endpoint; no framework |
| Backend tests | 5 CLI suites | — | 101 adversarial, 40 helper, and 34 profanity checks, plus login-location and promo-digest tests |

The largest files are the most likely to need splitting:

| File | Lines | Threshold band |
|---|---|---|
| `src/pages/ItemForms/ProductListingPage.jsx` | 893 | Needs refactoring (501–1000) |
| `src/pages/Settings/MyProfile.jsx` | 829 | Needs refactoring |
| `src/context/ChatContext.jsx` | 824 | Needs refactoring |
| `api/security/security.php` | 741 | Needs refactoring: 6 unrelated responsibilities |
| `api/confirm_purchases/helpers.php` | 671 | Needs refactoring |
| `api/payments/webhook_processor.php` | 528 | Needs refactoring |

At the start, one Jest test was failing: `UserPreferences › persists the off frequency`. The test was stale, not the component. The page autosaves only fields that differ from the loaded values. The test loaded `off` and then selected `off`, so nothing was saved. The test is fixed, and the suite passes before any refactoring starts.

## Scoring

`Priority = (Tech debt × 2 + Business impact × 3) / Effort`. Each input is scored from 1 to 10. The formula favors cheap items, so the strategic items further down are also ranked with effort ignored.

## Quick wins (done in this pass)

| # | Finding | Where | Smell | TD | BI | E | Score | Status |
|---|---|---|---|---|---|---|---|---|
| Q1 | A `SHOW COLUMNS` schema probe ran on every review submit for a column the baseline migration guarantees. Rating-update failures were silently ignored. | `api/reviews/submit_review.php` | Dead code, swallowed error | 4 | 4 | 1 | 20.0 | Fixed |
| Q2 | The rate-limit status check hard-coded `INTERVAL 10 MINUTE` instead of using `LOGIN_ATTEMPT_WINDOW_MINUTES`. If the window changed, the dashboards would silently disagree with the limiter. | `api/security/security.php` | Magic number | 4 | 4 | 1 | 20.0 | Fixed |
| Q3 | Catch blocks returned 500 without logging. `change_password` also called `close()` on statements it had already closed, which throws in PHP 8 and hides the original error. | `auth/change_password.php`, `auth/reset_password.php`, `chat/typing_status.php` | Swallowed exceptions | 5 | 7 | 2 | 15.5 | Fixed |
| Q4 | `tickFetchNewMessages` dropped `conversationStatus` on one early-return path. | `src/context/chatContextUtils.js` | Inconsistent return shape | 3 | 3 | 1 | 15.0 | Fixed |
| Q5 | Dead code: `sanitize_number` and `sanitize_email` have no callers. The `auth_token` cookie is cleared in two places but is never set anywhere. There was also a stray duplicate docblock. | `security.php`, `change_password.php`, `delete_account.php` | Dead code | 4 | 2 | 1 | 14.0 | Fixed |
| Q6 | The remember-me cookie options were copy-pasted three times (issue, rotate, clear). A change to one flag could miss a copy and leave a weaker cookie. | `api/auth/auth_handle.php` | Duplicate code | 4 | 6 | 2 | 13.0 | Fixed |
| Q7 | HTTPS detection was implemented four times, and the CSP string twice (`security.php` and `router.php`). The router's copy can drift from the API's copy. | `security.php`, `auth_handle.php`, `router.php` | Duplicate code | 5 | 5 | 2 | 12.5 | Fixed |
| Q8 | The same review lookup was written out twice. The component could also set state after it unmounted. | `src/components/Products/PurchasedItem.jsx` | Duplicate code | 4 | 4 | 2 | 10.0 | Fixed |
| Q9 | Five near-identical GET wrappers. | `src/context/chatContextUtils.js` | Duplicate code | 5 | 3 | 2 | 9.5 | Fixed |
| Q10 | The "try again in N minute(s)" message was copy-pasted three times. | `login.php`, `security.php` | String duplication | 4 | 3 | 2 | 8.5 | Fixed |
| Q11 | Auth endpoints hand-rolled their bootstrap (HTTPS, headers, CORS, OPTIONS, method) and their error responses instead of using `init_json_endpoint` and `json_response`. As a result they did not send `Cache-Control: no-store` on errors. | `login.php`, `change_password.php`, `reset_password.php` | Shotgun surgery | 6 | 6 | 4 | 7.5 | Fixed |
| Q12 | When the database was unreachable, `db()` called `die()` and answered HTTP 200 with a different envelope (`message` instead of `error`). This skipped every endpoint's `catch`, so outages looked like successful responses in logs and metrics. Found while smoke-testing Q11. | `api/database/db_connect.php` | Error handling | 5 | 7 | 2 | 15.5 | Fixed: `db()` throws, and the caller returns a logged 500 |
| Q13 | After Q12, a database outage on login or signup reached the rate limiter first. The limiter fails closed, so users were told "Too many failed attempts." | `security.php`, `login.php`, `create_account.php` | Misleading error | 3 | 6 | 2 | 12.0 | Fixed: the limiter now reports `unavailable`, and these endpoints return 503 |
| T1 | No one-command PHP lint. Only a manual `find … php -l` loop existed. | `package.json` | Tooling gap | 3 | 4 | 1 | 18.0 | Added `npm run lint:php` |

After this pass: PHP lint passes for 174 of 174 files, all 5 backend suites pass, and Jest passes all 38 suites (157 tests). The rewritten auth endpoints were smoke-tested over HTTP for OPTIONS, wrong method, malformed and invalid input, and the database-down case. Each returns the same status and body as before, plus `Cache-Control: no-store`. The database-backed success paths were not exercised because local MySQL was not running.

## Medium refactors (next)

| # | Finding | TD | BI | E | Score | Approach |
|---|---|---|---|---|---|---|
| M1 | `create_account.php` and `forgot_password.php` hand-rolled their bootstrap and responses (22 inline `http_response_code` calls). Each also had its own copy of the SMTP sender; `send_promo_welcome_email` held a third. The auth copies' vendor fallback path (`vendor/PHPMailer/src`) could never load, and each file had unreachable validation branches. | 6 | 6 | 3 | 10.0 | **Done.** Both files use `init_json_endpoint` and `json_response`. One sender, `dm_send_email()`, now lives in `helpers/email.php`. The 2-second anti-enumeration floor is one helper, `json_response_after()`. |
| M2 | `api/confirm_purchases/helpers.php` (671 lines) and `scheduled_purchases/helpers.php` duplicated display-name lookup (a third copy was in chat), system chat-message insertion, and UTC formatting. The copies had drifted: confirm skipped the unread update if its statement failed to prepare, and schedule didn't check `json_encode`. | 5 | 5 | 5 | 5.0 | **Done.** `chat_display_names()`, `chat_insert_system_message()` and `dm_utc_atom()` each have one implementation. The two files shrank by 166 lines combined. |
| M3 | `security.php` combined headers, CORS, sanitizing, rate limiting, Turnstile, and password hashing. | 6 | 4 | 5 | 4.8 | **Done.** Split into `headers.php`, `input.php`, `rate_limit.php` and `password.php`. `security.php` is a facade, so no caller changed. A line-by-line check confirmed every line of the original body appears exactly once. |
| M4 | Two response envelopes: some endpoints return `ok`, others `success`, and the global exception handler emits both. | 6 | 5 | 6 | 4.5 | Standardize new code on `success`. Emit both keys for one release, then remove `ok` flow by flow. |
| M5 | God components: `ProductListingPage` (893 lines), `MyProfile` (829), `ChatContext` (824). | 7 | 5 | 7 | 4.1 | Same pattern as the earlier `SellerDashboardPage` split: page shell, feature hooks, and pure utils. Add tests first. |
| M6 | 26 frontend files still call `fetch` directly instead of `apiClient.js`. | 6 | 4 | 6 | 4.0 | Migrate one flow per PR. `node scripts/refactor-audit.js` tracks the count. |

## Major and infrastructure work (strategic)

Ranked with effort ignored:

| # | Finding | TD | BI | Approach |
|---|---|---|---|---|
| X1 | `db()` opens a new MySQL connection on every call, and every caller closes its own. One login request opens about 6 to 8 connections, which puts connection-limit pressure on Railway MySQL. | 6 | 7 | Hold one connection per request in `db()`. First remove per-helper `close()` calls so a helper cannot close a connection someone else is using. This is high risk: it touches almost every endpoint, so land it behind the integration test. |
| X2 | CRA 5 is frozen. The remaining npm advisories all come from its build chain. | 5 | 6 | Migrate to Vite. The `REACT_APP_*` environment variables and the `proxy` setting need equivalents. |
| X3 | No static analysis gate: no PHPStan, no ESLint complexity rules, no CI quality gate. | 5 | 5 | Add PHPStan at level 3 with a baseline file and ESLint `complexity` and `max-lines` rules as warnings. Run both, plus `lint:php` and the test suites, in CI. |
| X4 | Endpoints are scripts that own validation, SQL, and orchestration. | 7 | 4 | Use the Strangler Fig pattern, one flow at a time (purchases first), behind the existing endpoint paths. Do not split into services. |

## Safety rules for every item

- Run the full Jest suite and `npm run test:backend` before and after each change, and run `npm run lint:php`.
- Keep endpoint paths, request fields, and response fields unchanged unless the item says otherwise.
- Railway runs migrations before the release, so schema changes must be forward-only.
