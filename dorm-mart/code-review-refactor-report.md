# Thermo-Nuclear Code Quality Review And Refactor Report

## 2026-08-19 search and wishlist invariants

Before refactoring these flows, the following behavior is fixed:

- `/app/listings` reads the existing search query aliases, sends the same JSON
  filters to `POST api/search/get_search_items.php`, and keeps the current result
  links, filter controls, and loading, error, and empty messages.
- Search remains authenticated. The endpoint keeps its validation, prepared SQL,
  result ordering, status codes, and array-shaped JSON response.
- `/app/wishlist` loads `GET api/wishlist/get_wishlist.php` and removes items with
  `POST api/wishlist/remove_from_wishlist.php` using the existing CSRF flow.
- Wishlist keeps its private authenticated response, category filtering, product
  links, removal confirmation, retry action, and loading, error, and empty states.
- Wishlist removal keeps the same database updates, response fields, and 400, 404,
  and 500 behavior. No endpoint, route, request field, or response field is renamed.

### Implemented refactor

- `SearchResultsPage.jsx` now owns routing and layout. Feature-local hooks own the
  search and category requests, components own filters and results, and pure utils
  own query mapping, validation, URL construction, and result normalization.
- `WishlistPage.jsx` now derives filtered items from one item list. A feature hook
  owns load and removal requests, while feature-local components and utils own the
  confirmation UI, category controls, normalization, and filtering.
- Added `apiPostJson` beside the existing GET and CSRF JSON helpers. Search keeps
  its read-only POST contract without repeating response parsing.
- Both async flows abort stale requests and avoid stale completion updates.
- Nonblank production lines across search, wishlist, and the shared API helper
  fell from 1,331 to 1,301. Tests and the audit are counted separately.

### Regression coverage

- Added adversarial tests for malformed prices, dates, images, list fields, query
  aliases, price errors, URL construction, category filtering, and filter cleanup.
- Added component tests for search loading, error, empty, and navigation states and
  for blocking duplicate wishlist removal submissions.
- Added `scripts/refactor-audit.js` to list large files, direct frontend fetch calls,
  and date construction outside the shared formatter boundary.

### Verification

- Jest: 30 suites and 91 tests passed.
- Backend adversarial validation: 78 checks passed.
- Production build passed. PHP lint passed for all 149 application PHP files.
- Browser verification exercised both routes against their API contracts, including
  the search request body and the CSRF-protected wishlist removal body.

## 2026-08-15 CodeRabbit-Style Security Audit

### Resolved findings

- **P0 — committed production moderator credential:** the repeatable seed no longer
  creates or resets a moderator password. Forward migration `022` disables only an
  account that still has the exposed hash and revokes its authentication state.
- **P1 — password reset overwrote remember-me state:** reset links now use a dedicated
  `reset_token_hash`; validation requires the link's user ID and no longer scans users.
- **P1 — server sessions survived credential changes and bans:** sessions carry an
  `auth_version` checked on every authenticated request. Password changes, resets,
  bans, and moderator reprovisioning increment it and clear persistent tokens.
- **P1 — login throttling was tied to disposable PHP sessions:** failures now use a
  SHA-256 email/client-address key, a ten-minute window, an atomic counter, and a
  three-minute lockout after four failures.
- **P1 — private chat uploads were publicly proxyable:** generic media requests return
  404 for chat paths; participant-authorized delivery remains in the chat endpoint.
- **P1 — hiding a conversation deleted shared purchase records:** the endpoint now
  changes only the requesting participant's existing hide flag and preserves all
  shared messages, purchases, confirmations, participants, and inventory state.
- **P2 — migration failures could be recorded as successful:** both CLI runners enable
  strict MySQL errors, consume every multi-query result, return nonzero on failure,
  and write their ledger only after the SQL file completes.
- **P2 — login-history dates were timezone ambiguous:** the API emits explicit UTC
  ISO-8601 values and the UI treats legacy timezone-less values as UTC.

### Deployment and residual risk

- Schema corrections are forward-only in migrations `021` and `022`; schema files
  `001` through `020` remain unchanged. Migration `023` reconciles installations that
  applied the first local revision of `021`. Railway runs migrations before release.
- The default moderator remains disabled until deliberately reprovisioned with the
  CLI tool. Removing the working-tree secret does not remove it from Git history;
  repository history should be treated as permanently exposed.
- Safe dependency patches are applied. Remaining npm advisories originate from the
  Create React App 5 build chain and require a separately tested build-tool migration;
  `npm audit fix --force` is intentionally not used.

### Verification

- Local XAMPP MySQL applied `021`, `022`, and reconciliation migration `023`; a
  second run applied nothing. Clean-install and failed-migration ledger probes passed.
- Railway production deployment `0a4d7eb8-4369-4946-a086-2f75161046e9` applied the
  same three migrations in its pre-deploy container and reached `SUCCESS`.
- Jest: 22 suites and 57 tests passed. PHP: 306 files linted cleanly. The production
  React build passed, Composer reported no advisories, and npm audit was reduced to
  28 transitive findings (0 critical, 14 high, 5 moderate, 9 low).

## Scope

Reviewed owned Dorm Mart application code: React `src`, PHP `api`, app configuration, migrations, and fixtures where relevant. Excluded third-party `vendor`, `node_modules`, generated `build` output, binary assets, PDFs, and lockfile churn.

## Implemented Refactors

1. **Canonical product normalization**
   - `normalizeProductDetail` now reuses shared formatter boundaries for booleans and dates instead of carrying a local one-off parser.
   - Invalid API date strings now normalize to `null` instead of leaking `Invalid Date` objects into UI code.
   - Seller usernames derived from email are trimmed and blank local parts are rejected.

2. **Safer shared number coercion**
   - `coerceNumber` now accepts normal numeric and currency-shaped values such as `$1,234.50`.
   - It no longer extracts numbers from prose such as `abc123` or `12 dollars`.
   - Non-finite numbers such as `Infinity` are rejected.

3. **Image URL boundary cleanup**
   - Product photo resolution now proxies only locally stored image paths through `api/media/image.php`.
   - External absolute image URLs remain external instead of being routed into an endpoint that only reliably serves local files.
   - Object-shaped malformed photo entries are dropped instead of stringifying to `"[object Object]"`.

4. **CSRF request preparation hardening**
   - Malformed JSON request bodies now fail with an explicit `Invalid JSON request body` error.
   - Non-object JSON payloads no longer get spread into odd request shapes.
   - Existing 403 token refresh behavior remains covered by tests.

5. **Shared frontend API boundary**
   - Added `src/utils/apiClient.js` for JSON parsing, API error extraction, GET JSON calls, and CSRF JSON posts.
   - Newly touched hooks now use that boundary instead of repeating `fetch`, `response.json`, and ad-hoc `throw new Error` branches.

6. **Large page decomposition**
   - `OngoingPurchasesPage.jsx` was split into a scheduled-purchases hook, bucket section, purchase card, cancel modal, and view utilities.
   - `SellerDashboardPage.jsx` was split into listing/review hooks, filter/stat/listing-row/delete-modal components, and seller dashboard utilities.
   - `LandingPage.jsx` was split into a home feed hook, feed utilities, top bar, tabs, For You section, Explore section, and hint modal.
   - `SchedulePurchasePage.jsx` was split into a schedule form hook, meet-location field, date-time field, negotiation field, close modal, and form utilities.

7. **Backend scheduled-purchase helper extraction**
   - Added `api/scheduled_purchases/helpers.php`.
   - `create.php`, `respond.php`, and `cancel.php` now reuse helpers for active accepted schedule checks, UTC response formatting, display names, conversation participants, and schedule chat-message insertion.
   - Request validation, auth checks, SQL schema, and JSON response shapes were kept unchanged.

8. **Review and rating modal boundary cleanup**
   - `BuyerRatingModal` now uses the shared API client and formatter boundary instead of local `fetch`, `response.json`, and raw `new Date(...)` display formatting.
   - `ReviewModal` now uses `csrfPostJson` for JSON submission and shared JSON/error readers for multipart review-image uploads.
   - Buyer-rating display now normalizes rating payloads through `sellerDashboardUtils` instead of reaching into API-shaped objects from JSX.

9. **Seller dashboard orchestration cleanup**
   - Product-review and buyer-rating lookups now run in parallel per sold listing.
   - Abort signals prevent stale review/rating batches from overwriting state after the listings input changes.
   - Touched API-client callers now handle empty JSON responses with optional success checks.

10. **Schedule form date helper extraction**
   - Month day-limit calculation moved from the date input component into `scheduleDateTimeUtils`.
   - The component now stays focused on UI state and delegates date math to the schedule date boundary.

## Adversarial Tests Added

Added kept Jest tests under `src/__adversarial_tests__/` covering:

- formatter coercion and invalid dates
- product detail boolean/date/email normalization
- image URL proxying, malformed photo entries, and fallback sanitization
- CSRF malformed JSON and retry-on-403 behavior
- integer and decimal numeric key guards
- shared API client JSON/error behavior
- date timestamp comparators
- seller dashboard filtering, sorting, metrics, and listing normalization
- home feed normalization, grouping, quick filters, and fallback behavior
- scheduled purchase grouping, state/tone helpers, and bucket ordering
- schedule purchase form utility validation
- buyer-rating payload normalization
- schedule month day-limit calculation

## Remaining Structural Findings

1. **Backend endpoint workflows are still script-oriented.**
   - Scheduled-purchase helper extraction improved repeated logic, but endpoint files still own validation and orchestration directly.
   - A deeper service-layer rewrite was intentionally avoided to preserve behavior and database contracts.

2. **Some untargeted pages still have local fetch/date handling.**
   - The major touched flows now use shared API/date helpers.
   - A broad scan still finds legacy local fetch/date handling in flows such as chat context, login/reset password, purchase history, profile/settings, product detail hooks, and confirm-purchase UI.
   - Those were left as explicit follow-up debt rather than swept into this architecture pass because they are unrelated user workflows with larger regression surface.
   - Future feature work should continue moving local fetch parsing into `apiClient.js` instead of adding new one-off response branches.

3. **Large page shells are addressed.**
   - `ScheduledPurchases/OngoingPurchasesPage.jsx`: 129 lines.
   - `SellerDashboard/SellerDashboardPage.jsx`: 223 lines.
   - `Home/LandingPage.jsx`: 198 lines.
   - `ScheduledPurchases/SchedulePurchasePage.jsx`: 123 lines.
   - `Search/SearchResultsPage.jsx`: 141 lines.
   - `Wishlist/WishlistPage.jsx`: 247 lines.

## Verification

- Latest `npm test -- --watchAll=false --runInBand` passed: 10 suites, 31 tests.
- `npm run build` passed.
- `php -l` passed for `api/scheduled_purchases/helpers.php`, `respond.php`, `cancel.php`, and `create.php`.

## Notes

The temporary breakage-hypotheses scratch file was used to drive the adversarial tests and then removed. The tests themselves remain in the repo.
