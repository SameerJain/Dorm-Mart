# Dorm Mart Project Handoff

## Comparison scope

This handoff compares the end-of-sprint snapshot from December 2, 2025 with the current code snapshot.

- **December baseline:** `fec6ac5f9ba28f089e045a2168794218c78a5233` (`Merge pull request #198 from cse442-software-engineering-ub/dev`).
- **Current code snapshot:** `28500d5041eeb429a408f349d163750bd55238c8` on `145-Setup-Railway-Deployment-System`.
- **Scale:** 919 tracked files differ when dependency/vendor files are included. Excluding `dorm-mart/vendor` and `package-lock.json`, 617 files differ: 294 added, 164 deleted, 114 modified, and 45 renamed.
- **Purpose:** this is a practical guide to the current architecture and behavior, not a file-by-file diff. Generated dependencies, bulk image cleanup, and fixture churn are summarized.

The current app is still a React frontend with a PHP/MySQL backend. The largest changes since December are the feature-based code reorganization, Railway deployment support, personalized recommendations, expanded notifications, account-security pages, moderation, safer authentication/session handling, and a real automated test suite.

## Start here when returning

- Read this file first, then `README.project_setup.md` for commands and `environment_configuration.md` (next to this file) for environment variables.
- Run npm/PHP commands from `dorm-mart`; the repository root intentionally has no `package.json`.
- Sync the database schema before testing newer features: `php api/database/migrate_schema.php` (it reads `schema/`, one SQL file per table).
- Never load fixtures into shared or production data: `php api/database/migrate_data.php` refuses non-local database hosts, because the fixture accounts have known passwords. Locally it resets only the fixture accounts' data and leaves everyone else's alone.
- Do not assume a December path still exists. Most PHP endpoints and several React page folders were renamed or moved.
- Production chat uses HTTP polling. `README.websocket.md` (next to this file) is explicitly archived documentation for a retired Ratchet experiment.

## Current application structure

The router is `dorm-mart/src/App.jsx` and uses a hash router.

Public routes include:

- `/`, `/login`, `/create-account`, `/forgot-password`, and `/reset-password`.
- `/privacy-policy` and `/terms-of-service`, which now render accessible React legal-document pages from `src/pages/Legal`.

Authenticated routes live under `/app`, including:

- Home, listings/search, listing creation/editing, product and receipt views.
- Purchase history, notifications, chat, wishlist, public profiles, seller dashboard, and scheduled purchases.
- Settings pages for profile, account information, preferences, password changes, logged devices, two-factor authentication, the team page, and account deletion.
- `/app/moderation`, guarded in the UI for moderators and independently protected by role checks in every moderation API.

Unknown routes use `NotFoundPage`. The December raw-loader behavior for unfinished settings pages has been replaced with implemented pages or the normal 404 page.

## Major changes since December

### Authentication, account creation, and password recovery

- Account creation uses a generated temporary password delivered by email. Resend is preferred when configured; SMTP/PHPMailer is the fallback.
- Account-creation requests are rate-limited in both the browser and backend. The backend returns the same generic accepted response for eligible submissions, duplicate accounts, email-policy rejections, and delivery/internal failures to reduce account enumeration; malformed form fields can still return validation errors.
- An account is retained only when the temporary-password email is delivered. If delivery fails, the newly inserted account is removed. This is different from the earlier handoff wording that said account creation would survive email failure.
- Registration requires acceptance of the Terms of Service and records promotional-email preferences.
- `ALLOW_ALL_EMAILS` controls whether registration is restricted to `@buffalo.edu`; login continues to accept any valid email so existing non-UB accounts can sign in.
- Forgot-password responses and reset links were hardened. Current reset links include a user ID plus a hashed, expiring token so validation can target one account instead of scanning all active reset tokens.
- Reset and change-password flows clear reset/remember state, increment `auth_version`, and invalidate other authenticated sessions.
- Password changes require the current password and reject reuse of the current password.
- Login still has rate limiting, but authentication now also checks banned status and session version on protected requests.

### Two-factor authentication and login history

- Users can enable email-based two-factor authentication at `/app/setting/two-factor-authentication`.
- A successful password check for a 2FA-enabled account starts a six-digit email challenge. Codes last 10 minutes and allow at most five failed attempts.
- Disabling 2FA requires the current password. Enabling it must successfully send the confirmation email before the setting is saved.
- Successful sessions are recorded with browser, operating system, device type, IP address, approximate location, login time, last-seen time, and sign-out time.
- `/app/setting/security-options` is now the Logged Devices page. It is currently a read-only history view; users secure an unknown login by changing their password, which invalidates other sessions.
- Sessions use a server-side session plus a rotated remember token. `auth_version` provides centralized invalidation after password resets, password changes, bans, and other security-sensitive changes.

### Account information, preferences, and deletion

- The former Personal Information placeholder is now a read-only Account Info page showing name, email, graduation date, join date, and links to legal pages.
- User Preferences now includes:
  - up to three interested categories;
  - light/dark theme;
  - promotional email frequency (`off`, `daily`, or `weekly`).
- `scripts/send_promotional_digests.php` is a CLI job for due daily/weekly interest-matched listing emails. On Railway it runs from the cron service defined in `dorm-mart/railway.promotional.toml` (21:00 and 22:00 UTC; the script only sends in the 5 p.m. Eastern hour). Digests include only listings posted since the user's last digest, skip banned sellers, and carry a signed one-click unsubscribe link and `List-Unsubscribe` header when `PROMO_UNSUBSCRIBE_SECRET` is set. The script refuses to send if `FRONTEND_BASE_URL` is not absolute.
- The About Us page is implemented at `/app/setting/about-us` with the current team and contact links.
- Account deletion is implemented and requires both the exact confirmation phrase and current password. It removes the user's owned/private data and listings, closes affected chats, notifies users who wishlisted removed items, anonymizes retained counterpart-facing chat/history records, deletes owned uploads, and signs the user out.
- Protected fixture and moderator accounts cannot be deleted. Seed-account protection is applied after local data migration.

### Home feed and recommendations

- The December category-only home logic has become a ranked recommendation feed.
- `api/helpers/recommendations.php` combines selected interests, listing views, wishlist activity, purchase categories, popularity, recency, and exact-product signals.
- Product views and wishlist changes are stored in `user_listing_behavior`; behavior tracking is best-effort so a missing/new migration does not break the buyer action.
- The home API excludes the current user's own listings and only returns active, unsold listings.
- “For You” remains usable when no interests are selected. In that case it shows popular/recent listings while the system learns behavior; it is no longer disabled as the old handoff stated.
- “Explore More” shows randomized items, with a responsive target of at least 30 when enough listings exist.
- The selected home tab is stored in session storage.
- Image failures consistently fall back to the placeholder asset instead of relying on a hardcoded product image.

### Search

- Search lives under `src/pages/Search` and calls `api/search/get_search_items.php`.
- Current filtering supports query text, one or more allowed categories, condition, location, price range, negotiable/trades flags, and allowed sort modes.
- Search can optionally include descriptions and ranks best-match results using exact/prefix/title/description relevance.
- Search returns only active, unsold listings and enforces a bounded result limit.
- Price fields use strict decimal validation. Malformed values, out-of-range values, and `minPrice > maxPrice` are rejected instead of being silently coerced.

### Listings and seller dashboard

- Listing creation/editing is organized under `src/pages/ItemForms` and `api/seller_dashboard`.
- Sellers can save incomplete listings as drafts and later edit/publish them. Drafts are private to their seller, including direct product URLs.
- Publishing applies full validation, requires at least one image, and counts toward the 25-active-listing limit. Saving a draft is still allowed at that limit.
- Sold listings cannot be edited, reactivated, or deleted through normal listing endpoints.
- A listing with an active accepted scheduled purchase cannot be moved back to Draft until that purchase is cancelled or completed.
- Listing image uploads validate actual MIME type, byte size, and safe pixel dimensions; filenames/extensions are not trusted.
- Published listing views are counted only for non-seller views. Seller dashboard statistics now include view counts.
- The seller dashboard is componentized into filters, metrics, rows, review hooks, and listing hooks. It includes Draft as a filter/status.
- Price changes, added images, Pending/Active/Sold transitions, and deletion can produce notifications for users who wishlisted the item.

### Product and receipt pages

- Product and receipt code moved from `src/itemDetails` into `src/pages/ItemDetails` with shared hooks, normalizers, fact rows, action panels, and image galleries.
- Product endpoints moved to `api/product/view_product.php` and `api/product/get_item_info.php`.
- Product responses carry listing/sold/final-price information used by receipts, reviews, scheduled purchases, and seller actions.
- The image gallery supports multiple images with thumbnail and previous/next controls.
- Receipt price presentation now distinguishes listing price, negotiated/final price, and trades.
- Legacy purchase-history rows deliberately use their stored title/seller/image snapshots. They are not joined to inventory by unrelated auto-increment IDs.

### Chat

- Production chat is polling-based. `ChatContext.jsx` polls `fetch_new_messages.php` for messages, edits, deletions, typing state, and listing/conversation status.
- Chat is split into composer, header, sidebar, list, message cards, special purchase/review cards, image modal, typing hooks, and utilities.
- Users can send text and image messages, see typing indicators, delete a conversation from their own list, and report another user's message.
- A sender can edit only their latest eligible text message in a conversation. Image/system/deleted messages cannot be edited.
- The sender can delete their latest non-card message from its chat menu (`api/chat/delete_message.php`, soft delete). System cards cannot be deleted, and neither edits nor deletes are allowed once the chat is closed. Editing keeps the pre-edit text in `messages.original_content` for moderators and is refused while the message has an open report.
- Chat polls every 1.5 s and skips a tick while the previous poll is still running. Read-only chat/media endpoints release the PHP session lock early. Hiding a conversation clears its unread count; any message or system card that adds to a user's unread count un-hides it for that user (`chat_unhide_for_user()`).
- Deleted messages are retained as records and rendered as “This message was deleted”; their content/media no longer count toward unread badges.
- Profanity matches are stored as flagged raw messages for moderators, while normal chat readers receive filtered text.
- Item or account deletion closes the affected chat and shows a system message. Private chat media is served only through `serve_chat_image.php` after participant authorization.
- Scheduled-purchase, confirmation, review, and buyer-rating cards are integrated into the message stream.

### Moderation

- Users can report messages directly from chat. One reporter/message pair is kept unique; reporting the same message again reopens/updates that report.
- Moderator accounts have a safety dashboard showing flagged messages, reports, and banned-user statistics.
- Moderators can resolve/dismiss reports, ban/unban non-moderators, and maintain the profanity word/phrase list (add/remove words live from the Moderator Dashboard — no deploy needed).
- Banning invalidates the target's sessions and authentication tokens. All protected APIs also reject banned users, so the React route guard is not the security boundary.
- Moderator accounts must be provisioned from the CLI, for example:

  ```powershell
  php api/database/create_moderator.php moderator@example.com "Dorm Mart" "Moderator"
  # prompts for the password (or pipe it in); it is never passed as an argument
  ```

- The old committed default moderator credential was revoked by migration `legacy/022_revoke_default_moderator.sql`; `data/029_moderator_account.sql` no longer seeds a password.

### Scheduled and confirmed purchases

- Scheduled purchase frontend code moved from `SellerDashboard` into `src/pages/ScheduledPurchases`.
- Ongoing purchases are grouped into actionable/time-based buckets with feature-local hooks, form utilities, cards, and modals.
- Stale unanswered schedule requests expire lazily when related list/chat flows run; the current expiry window remains three days.
- Accepted schedules can create timed 24-hour/1-hour buyer reminders and a seller Confirm Purchase reminder.
- Wishlist users are notified when an item becomes pending, returns to sale, is sold, or is removed.
- An accepted confirmation counts as a completed sale only when `is_successful = 1`. An unsuccessful accepted outcome does not sell inventory, write purchase history, create review prompts, or keep the item locked from another schedule/confirmation.
- Purchase-history insertion uses an atomic JSON append to avoid lost updates from simultaneous completions.
- The December `scheduled-purchases/report-issue/:requestId` route and `ReportIssuePage.jsx` were removed. Safety reporting now centers on individual chat-message reports.

### Reviews and ratings

- Product review and buyer-rating APIs use shared lookup/authorization helpers and stricter validation.
- Review stars can be edited interactively through `EditableStarRating`.
- Review prompts in chat and purchase history reflect whether a review/rating already exists.
- Review uploads validate MIME, size, and image dimensions and use the configured media storage path.
- Review images are displayed without the old forced zoom behavior so the full image remains visible.

### Notifications and wishlist

- The legacy wishlist notification counter was migrated into a general `notifications` table with type, severity, destination, metadata, availability time, read state, and idempotency key.
- Notifications now cover wishlist saves; item price/image/status changes; schedule requests, responses, cancellations, expiry, and reminders; confirm-purchase requests; review reminders; item deletion; and sold/back-on-sale events.
- Destinations are restricted to internal `/app` paths before insertion and checked again before frontend navigation.
- The Notifications page supports opening/marking read, deleting one notification, and clearing all notifications.
- Wishlist add/remove operations also update recommendation behavior and continue to maintain item wishlist counts.

### Legal pages, responsive UI, and accessibility

- Privacy Policy and Terms of Service are now React pages under `src/pages/Legal`, linked from login, account creation, account information, and moderation.
- Static PDF copies still exist under `public/pdfs`, but no current source code links to them; treat them as legacy assets unless a deployment still needs them.
- Public/pre-login pages are grouped under a layout that suppresses authenticated dark-mode state and avoids theme flicker.
- Modal body-scroll locking, mobile touch targets, small-screen spacing, long-word wrapping, image fallbacks, and dark-mode colors were improved across the app.
- A shared error boundary, page back button, confirmation dialog, API client, CSRF wrapper, formatting utilities, and feature-specific utility modules replaced many one-off implementations.

## Backend and security architecture

### Endpoint organization

Current feature folders include:

- `api/auth`, `api/categories`, `api/chat`, `api/confirm_purchases`, `api/listings`;
- `api/media`, `api/moderation`, `api/product`, `api/profile`, `api/purchase_history`;
- `api/receipt`, `api/reviews`, `api/scheduled_purchases`, `api/search`;
- `api/seller_dashboard`, and `api/wishlist`.

Shared code lives under `api/config`, `api/helpers`, `api/security`, `api/utility`, and `api/database`. These are libraries or CLI tools, not public HTTP endpoints.

### Important security behavior

- Authenticated mutations use CSRF tokens and prepared SQL statements.
- Request helpers strictly parse JSON, integers, decimals, booleans, ISO dates, and maximum request sizes.
- Authentication checks session version and banned state on each protected request.
- Password reset tokens and remember-me tokens have separate storage/state.
- Uploads use MIME inspection, safe dimension limits, randomized user-scoped filenames, and path-containment checks.
- Product/profile/review media use `api/media/image.php`; private chat media requires conversation membership.
- The Railway router rejects traversal/null bytes, non-PHP API targets, raw `/media` access, and HTTP access to config, helper, database, utility, security, and test directories.
- Static responses include content-type, frame, referrer, permissions, opener, HSTS-on-HTTPS, and HTML CSP headers.
- CORS origins and notification destinations are allowlisted rather than reflected blindly.
- Legacy blacklist-style XSS input rejection was removed. The current approach preserves normal text, uses prepared statements for SQL, validates data shapes/URLs, and escapes output.

## Database schema and development data

- **The rules.** (1) `schema/` is the only description of the database: one file per table, named after it, and only tables the code needs. (2) The schema changes by editing a file and re-running `migrate_schema.php`; never by adding a numbered migration or hand-editing a database. (3) Every run is a full re-run that converges and is safe on a database holding real data: it never deletes rows. (4) Test fixtures are separate (`data/`, local only) and reset on demand without touching real users' data. Everything below follows from these four.
- **One SQL file per table in `schema/`** (`schema/wishlist.sql`, `schema/INVENTORY.sql`, ...). Each file declares what the table should look like now; there are no numbered migrations and no ledger table.
- **To change the database, edit the table's file and run `php api/database/migrate_schema.php`.** It builds the declared tables in a scratch database on the same server, diffs each one against the live table, and applies only the difference: new tables, added/changed/dropped columns, indexes, foreign keys and CHECK constraints. Running it again changes nothing. Removing a column from a file drops it from the database.
- `php api/database/migrate_schema.php --dry-run` prints the plan without changing anything (it still creates and drops its scratch database, `<db>__schema`, so it needs permission to create databases). `--prune` also drops tables that no file declares; without it they are only listed as `unmanaged`. `--reseed-profanity` re-runs the word-list import.
- To add a table, add `schema/<table>.sql` that starts with `CREATE TABLE <table> (...)`. The file name must match the table, tables may `REFERENCES` each other (creation order is worked out automatically), and `INSERT IGNORE` statements after the `CREATE` are starter rows, inserted whenever the table is empty.
- Name every CHECK constraint, so it keeps one identity across servers and edits.
- `purchased_items` is still there: nothing writes to it, but Purchase History and account deletion still read it. The Stripe tables (`connected_payment_accounts`, `electronic_payments`, `stripe_webhook_events`) and the `payment_*` columns on `scheduled_purchase_requests` / `confirm_purchase_requests` are part of the normal schema; the scheduling and confirm code writes them even while `dm_payments_enabled()` is false.
- **First sync of an older database** (production was built by the retired migration chain): run `migrate_schema.php --dry-run` against a copy first and read the plan. Redundant indexes and renamed CHECK constraints are expected; a `[destructive]` line means a column exists in that database that no file declares. The old ledger table `schema_migrations` (and `data_migrations`, `wishlist_notification`, `account_creation_rate_limits` if present) show up as `unmanaged` until someone runs `--prune`.
- Railway runs `php api/database/migrate_schema.php` before deployment through `dorm-mart/railway.toml`.
- Declare nullability on every `TIMESTAMP` column (`TIMESTAMP NOT NULL DEFAULT ...`): MySQL and MariaDB read a bare `TIMESTAMP` differently depending on `explicit_defaults_for_timestamp`, so the same file would build two different tables.
- **Starter rows vs fixtures.** `INSERT IGNORE` rows inside `schema/<table>.sql` are *starter rows*: part of the schema, inserted wherever the table is empty (production included; the profanity list is the example). Rows in `data/*.sql` are *fixtures*: fake users and listings for testing, loaded only locally.
- `migrate_data.php` is CLI-only and local-only. A seed account is any email written in `data/*.sql`. Every run deletes everything those accounts own (their chats, schedules, listings, reports and the account itself, plus whatever cascades from those), replays every `data/*.sql` file, copies the fixture images, and marks the seed accounts protected. Anything a tester added while logged in as a seed account is therefore reset too, while real users, their data and moderators are never touched. Which tables and columns count as "owned by a seed account" is the `SEED_OWNED_ROWS` list at the top of the script; add to it when a new table points at users without a cascading foreign key.
- `api/tests/database_migrations_test.php` covers all of this against a scratch database: the full `schema/` directory builds and converges, and a real user, moderator, listing, chat and wishlist entry survive two fixture runs that leave every table the same size.
- `api/database/wipe_data.php` is intentionally destructive and requires `--confirm-wipe` (truncate every table) or `--confirm-rebuild` (drop every table); run `migrate_schema.php` afterwards to restore the schema and the profanity list.

### Profanity word list

- The base list lives at the bottom of `schema/profanity_words.sql` (a small, intentionally short set — this file is public).
- A much larger English word list is seeded separately by `migrate_schema.php`, which calls `seed_profanity_wordlist()` (`api/database/seed_profanity_wordlist.php`). That function pulls words from the `snipe/banbuilder` Composer package and inserts them into `profanity_words`. The sync does this whenever the table is empty (a new database, or after `wipe_data.php`), or on request with `--reseed-profanity`.
- The upstream dictionary is broader than we want (clinical/anatomical terms, generic words like "cornhole"/"fanny"/"screw"/"killer" that collide with normal marketplace chat, and violent/political terms better handled by human moderation). `PROFANITY_WORDLIST_EXCLUDED` in that file filters those out before insert, and also deletes them if an older seed run already added them. Adjust that array and run `php api/database/migrate_schema.php --reseed-profanity` if the list needs further tuning. Matching tolerates look-alike characters (`sh1t`, `$hit`), stretched letters, punctuation or zero-width characters inside a word, and common endings, so variants do not need their own entries.
- **`dorm-mart/vendor/snipe/banbuilder/src/dict/` is gitignored on purpose** — the rest of `vendor/` is committed as usual in this repo, but that one folder holds the raw word-list data, and keeping an explicit slur list out of a public repo's git history is the point (it's still fully public code-wise, just not baked into commits forever). If your local `vendor/` doesn't have it, run `composer install` from `dorm-mart/` once — Composer re-downloads the package, dict files included, from the upstream source (the gitignore only stops us from re-committing it, it doesn't stop Composer from fetching it).
- If those files are missing, `migrate_schema.php` does **not** fail — it reports `banbuilder skipped` under `seeded` in its JSON output and leaves the rest of the sync alone. Railway's build always runs `composer install` automatically, so production is unaffected either way.
- New words can always be added/removed live from the Moderator Dashboard regardless of any of the above — that path never touches git.

## Run, test, and deploy

### Local development on Windows

From the repository root, run:

```powershell
build-scripts-win\dev.bat
```

The launcher starts XAMPP Apache/MySQL when their ports are free, then opens React on port 3000 and PHP on port 8080. It resolves paths relative to the repository, so it need not be launched from a specific working directory.

Manual equivalent from `dorm-mart`:

```powershell
npm install
npm run start-local-win
npm run start:api
```

### Tests and build

The old handoff statement that Jest had no matching tests is no longer true. The current tree has 37 frontend test files, including adversarial utility coverage and component tests for account creation, chat, moderation, notifications, listing actions, scheduled purchases, settings, and 2FA.

From `dorm-mart`:

```powershell
npm test -- --watchAll=false
npm run test:backend
npm run build
```

`test:backend` runs the CLI adversarial validation, login-location, and promotional-digest checks under `api/tests/`. Credential-gated integration scripts live in `api/tests/integration/`; they are not part of that command and are blocked from HTTP access.

### Apache, Aptitude, and Cattle packages

- `build-scripts-win\apache.bat` builds and replaces `C:\xampp\htdocs\serve`.
- `build-scripts-win\aptitude.bat` builds and replaces `C:\xampp\htdocs\prod-build`.
- `build-scripts-win\cattle.bat` builds and replaces `C:\xampp\htdocs\cattle-build`.
- These scripts deliberately clear their named target directories. Review the script and target before running it.

### Railway

- Railway builds `dorm-mart/Dockerfile` (selected in `dorm-mart/railway.toml`): a Node stage builds the React app without source maps, a Composer stage installs PHP dependencies, and the runtime is PHP 8.3 under Apache with every request rewritten to `router.php`. Apache and PHP hardening lives in `dorm-mart/docker/`. The Procfile's `php -S` is PHP's development server and is no longer used in production.
- The container hands `DATA_UPLOADS_DIR` to `www-data` at start-up; the code itself stays root-owned and read-only to the web server. `REACT_APP_*` service variables reach the build because the Dockerfile declares them as `ARG`s; declare any new one there too.
- `dorm-mart/railway.toml` applies schema migrations in the pre-deploy phase and health-checks `/` before switching traffic. It does not load fixture data.
- Set `FRONTEND_BASE_URL` and `API_BASE_URL` on the service. Without them, links in emails fall back to Railway's own domain (`RAILWAY_PUBLIC_DOMAIN`), never to request headers.
- To deploy the current local snapshot without merging it first, install/link Railway CLI 4.30.5 or newer and run `build-scripts-win\railway.bat`.
- The deployment script reports the branch, commit, and dirty files; use `-RequireClean` to reject a dirty worktree and `-Detach` only when intentionally queueing without waiting.
- Railway filesystems are ephemeral. Set `DATA_UPLOADS_DIR` to a mounted persistent volume or uploaded product/profile/chat/review files will disappear after redeploy/restart while database references remain.

Key environment variables are documented in `environment_configuration.md` (next to this file). They include database credentials, frontend/API/public URLs, allowed CORS origins, mail credentials, `ALLOW_ALL_EMAILS`, `DATA_UPLOADS_DIR`, and the legacy WebSocket token secret.

## Removed, renamed, or retired since December

- `src/App.js` was replaced by `src/App.jsx`.
- `src/pages/HomePage`, `src/itemDetails`, `src/pages/public_profile`, `src/pages/FAQPage`, and scheduled-purchase files under `SellerDashboard` were replaced by feature folders under `src/pages`.
- Dash-case API folders/files such as `seller-dashboard`, `scheduled-purchases`, `forgot-password.php`, `get-csrf-token.php`, and `validate-reset-token.php` were replaced by underscore names.
- Loose APIs such as `api/viewProduct.php`, `api/landingListings.php`, `api/userPreferences.php`, and `api/get_item_info.php` were removed after their feature-folder replacements were wired in.
- The file-based `api/utility/lockouts` implementation was removed.
- `input_sanitizer.php` and the old blacklist XSS behavior were removed in favor of typed validation plus output escaping.
- `ReportIssuePage.jsx` and its scheduled-purchase route were removed.
- Old duplicate migrations, fixture files, copied product images, unused icons, and default Create React App assets were removed or replaced.
- Root `README.websocket.md` was removed; the remaining WebSocket guide is archived under `dorm-mart/docs` and is not the production architecture.

## Developer-support artifacts

`artifacts/dorm-mart-codex-skills` and its ZIP contain optional Codex workflow skills for feature building, security hardening, database work, deployment, audits, and refactor/test tasks. They are documentation/tooling artifacts and are not loaded by the React/PHP runtime.

## Current cautions and follow-up notes

- The generic media endpoint intentionally refuses chat media. Do not “fix” chat images by routing them through the public product-image endpoint.
- Uploaded files require persistent Railway storage; a placeholder with a valid database row often means the volume/path is missing, not that the React component is broken.
- `send_promotional_digests.php` runs from the Railway cron service in `railway.promotional.toml`; a deployment without that service sends no digests.
- Logged Devices does not currently provide per-device remote sign-out. Password change/reset is the available revoke-all path.
- Moderator decisions (report resolutions, listing removals, flag clears, word-list edits) are written to `moderation_actions` (created in the baseline; originally migration `028`) and shown as "Recent moderator actions" on the dashboard. Logging is best effort and never blocks the action.
- Static legal PDFs remain in `public/pdfs` even though the current UI uses native legal pages.
- Some historical/ad hoc API tests remain for reference. Use the npm scripts and the current `.test.js/.test.jsx` suite as the normal automated checks.
- The app has compatibility aliases for both `viewProduct`/`viewproduct` and `viewReceipt`/`viewreceipt`; prefer the canonical mixed-case routes already used by current navigation.
- Preserve the unsuccessful-confirmation rule: an accepted but unsuccessful exchange must not sell the item or block a retry.
- Before changing status, deletion, notification, or account-removal logic, check its effects across inventory, wishlist, chat, scheduled purchases, confirmation requests, reviews, and retained history. These flows now intentionally coordinate with each other.
