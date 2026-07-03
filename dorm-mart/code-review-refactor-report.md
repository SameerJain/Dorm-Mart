# Thermo-Nuclear Code Quality Review And Refactor Report

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
   - A broad scan still finds legacy local fetch/date handling in flows such as chat context, login/reset password, search, wishlist, purchase history, profile/settings, product detail hooks, and confirm-purchase UI.
   - Those were left as explicit follow-up debt rather than swept into this architecture pass because they are unrelated user workflows with larger regression surface.
   - Future feature work should continue moving local fetch parsing into `apiClient.js` instead of adding new one-off response branches.

3. **Large page shells are addressed.**
   - `ScheduledPurchases/OngoingPurchasesPage.jsx`: 129 lines.
   - `SellerDashboard/SellerDashboardPage.jsx`: 223 lines.
   - `Home/LandingPage.jsx`: 198 lines.
   - `ScheduledPurchases/SchedulePurchasePage.jsx`: 123 lines.

## Verification

- Latest `npm test -- --watchAll=false --runInBand` passed: 10 suites, 31 tests.
- `npm run build` passed.
- `php -l` passed for `api/scheduled_purchases/helpers.php`, `respond.php`, `cancel.php`, and `create.php`.

## Notes

The temporary breakage-hypotheses scratch file was used to drive the adversarial tests and then removed. The tests themselves remain in the repo.
