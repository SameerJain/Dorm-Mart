# Dorm Mart Project Handoff

## How to read this

This document is for teammates returning to Dorm Mart after the last main sprint version.

- **Baseline being compared against:** commit `fec6ac5` by IkeSvit.
- **Downloaded baseline folder used for comparison:** `C:\Users\samee\Downloads\Dorm-Mart-fec6ac5f9ba28f089e045a2168794218c78a5233`.
- **Current project version:** branch `192-Refactor-Codebase` at commit `b684fd7`.
- **Important:** this document also includes the current uncommitted local edits in the working tree, not just committed Git history.
- **Scale of change:** the Git diff from `fec6ac5` to `b684fd7`, plus current uncommitted edits, is very large: hundreds of files changed, including frontend pages, backend APIs, migrations, seed data, deployment files, dependencies, and media cleanup.
- **How this is organized:** page-by-page first, then cross-cutting backend, deployment, data, and codebase changes.

This is meant to help you understand the project as it exists now before taking new work. It is not a raw diff dump. Generated files, vendor dependency churn, image files, and bulk media changes are summarized instead of listed one by one.

## Current high-level state

Dorm Mart is still a React frontend plus PHP/MySQL backend marketplace app, but the structure is much cleaner than the sprint baseline.

The **main** app routes now live in `dorm-mart/src/App.jsx`, with route groups under:

- `/` for the welcome/pre-login entry point.
- `/login`, `/create-account`, `/forgot-password`, and `/reset-password` for auth flows.
- `/app` for the signed-in app shell.
- `/app/listings`, `/app/product-listing`, `/app/viewProduct`, `/app/viewReceipt`, `/app/purchase-history`, `/app/chat`, `/app/wishlist`, `/app/profile`, `/app/seller-dashboard`, `/app/setting`, and `/app/faq` for the main user-facing areas.

Compared with the sprint baseline, many old loose files were moved into clearer folders. Many backend endpoints were renamed from dash or camelCase paths to underscore/lowercase paths. If you remember an old path from the sprint, do not assume it still exists.

## Pre-login pages

### What was added

- Better tablet and horizontal-range responsive layouts across the pre-login flow.
- Better reset-password email flow support, especially because the reset page is opened from emailed links.
- Shared pre-login styling pieces were cleaned up through components such as `PreLoginBranding` and `PreLoginNavLinks`.
- The pre-login pages now behave more like normal public pages: you can visit them without being trapped by the old redirect behavior.

### What changed

- The old pre-login redirector behavior was removed. Previously, if you were logged in and wanted to get out of the logged-in flow, you could be forced into awkward navigation where the sign-out button was the only clean path. Now it behaves like a normal website.
- Mobile/tablet spacing was adjusted so pre-login forms are less likely to cut off bottom text on small devices.
- Dark-mode state no longer causes a quick blackout/flicker on the public login email box.
- Password reset pages were polished so they work better from actual email links and not only from local navigation.

### What was removed

- The old forced redirect behavior from public/pre-login pages.
- The temporary forgot-password testing keyword/backdoor was removed in the current uncommitted working tree. Typing `testflow` into forgot password no longer skips straight to confirmation.

### Teammate notes

- Treat pre-login pages as real public pages now, not only as a gate into `/app`.
- The public pages still need to respect theme behavior, but should not flash logged-in dark-mode styling before the page settles.

## Login page

### What was added

- Required-field enforcement was added to the login email and password inputs in the current uncommitted working tree.
- Better frontend error wording was added so login failures explain the problem more clearly.
- PDF behavior for Terms of Service and Privacy Policy was improved for Railway.

### What changed

- Terms of Service and Privacy Policy PDF naming was fixed for Railway.
- PDF links now open in a new tab on Railway.
- The iPhone SE layout was adjusted upward so bottom text does not get cut off.
- The brief dark-mode blackout/flicker on the email field was fixed.
- Login text, spacing, and smaller viewport behavior were polished.

### What was removed

- The broken/awkward PDF behavior where Railway could use odd names or open/download behavior.
- The visual flash where the login email field briefly looked wrong when the logged-in account used dark mode.

### Related backend/API notes

- Auth endpoints were renamed to underscore paths where appropriate, such as `forgot_password.php`, `reset_password.php`, `validate_reset_token.php`, and `get_csrf_token.php`.
- CSRF handling was expanded across authenticated mutation endpoints.
- Login rate limiting and session lockout behavior moved toward database/session-backed hardening instead of loose lockout files.

## Create Account page

### What was added

- A configurable email policy now exists. `ALLOW_ALL_EMAILS` can allow any valid email address instead of only UB emails.
- Backend account creation can send styled welcome/promo emails through SendGrid on Railway, with PHPMailer fallback locally.
- Welcome-email and promo-email delivery paths log SendGrid/SMTP outcomes server-side for troubleshooting, but these logs are not user-facing.

### What changed

- Desktop layout was polished so the right side no longer scrolls unnecessarily.
- Mobile/small-screen layout bugs were fixed.
- File, field, and backend validation are more consistent with the frontend.
- Create-account error messages now better match the active email policy.

### What was removed

- Hardcoded assumptions that only UB email addresses could be used in every environment.
- Some email logging was cleaned up, but SendGrid/SMTP error and outcome logging remains intentionally available in server logs.

### Related backend/API notes

- Email policy lives under backend config files such as `api/config/email_config.php` and is exposed through an email-policy API.
- Welcome and promotional email HTML was moved toward shared transactional email helpers.
- Account creation still succeeds even if the welcome email fails; the email error is logged instead of blocking the user.

## Home page

### What was added

- Session-based saving for the selected home feed tab.
- A pop-up explaining how to unlock the "For You" feed.
- Disabled/grayed-out state for "For You" when the user has no interested categories set.
- Better placeholder image behavior when an item image cannot be found.

### What changed

- On mobile, the filters button was shifted slightly left for better alignment.
- The "For You" and "Explore More" switch is centered on smaller screens instead of sitting awkwardly on the left.
- The item-card hover effect was removed on mobile because it interfered with touch scrolling.
- Landing banner wording, capitalization, and naming were cleaned up.
- The "New" tag position was adjusted to align better with the "Wishlist" tag.
- Hardcoded image behavior was cleaned up, including removal of the hardcoded taco image.
- Bright blue colors were muted, especially for dark mode accessibility.

### What was removed

- Mobile item-card hover effects that made touch scrolling feel bad.
- Hardcoded taco image usage.
- Confusing enabled-looking "For You" behavior when the user had not configured interests.

### Related backend/API notes

- Home listings moved from the old loose `api/landingListings.php` path to `api/listings/landing_listings.php`.
- Active category fetching moved into `api/categories`.
- Image URLs should go through the media/image handling path when needed, especially on Railway.

## Search page

### What was added

- Cleaner search input wording and positioning.
- More consistent item-card behavior with the home page.

### What changed

- The search placeholder was changed from a more specific phrase like "search name, category, or description" to a simpler "Search" because the full behavior was not implemented yet.
- A stray second period in the search description was removed.
- Layout and positioning were polished.
- Search price filter fields now use the same two-decimal listing-price style input pattern instead of accepting arbitrary decimal strings.

### What was removed

- The "Available" tag was removed because all visible search items were available anyway, so the tag added noise without useful information.

### Related backend/API notes

- Search endpoint naming moved from `api/search/getSearchItems.php` to `api/search/get_search_items.php`.
- Numeric input guards were applied broadly across the app, including search-related numeric fields where relevant.
- The current working tree rejects malformed search `minPrice`/`maxPrice` values and rejects `minPrice > maxPrice` instead of casting bad strings to `0`.

## My Profile page

### What was added

- File type enforcement when selecting a profile picture from the user's computer.
- More consistent frontend boxes matching the rest of the site.
- Button border styling was aligned with home-page buttons.

### What changed

- Save/delete behavior for bio and Instagram text boxes was cleaned up.
- Button text and text sizes were changed for consistency.
- The clear fade-out behavior for the save button was removed.
- The save button no longer shows a spinning animation when deleting bio or Instagram text, because that animation caused bugs.

### What was removed

- Buggy save-button spinner behavior on delete actions.
- The clear fade-out effect for the save button.

### Related backend/API notes

- Profile APIs were organized under `api/profile`, including profile fetch/update, public profile, username lookup, user preferences, and profile photo upload.
- Public profile frontend code moved from the old lower-case folder to `src/pages/PublicProfile`.

## Chat page

### What was added

- A send button on the right side of the composer.
- A better-aligned image upload button beside the text box.
- Special message button states for review-related messages. If a review already exists for a buyer or product, the button text/color updates accordingly.
- Typing indicator support.
- Conversation deletion modal/component support.
- More modular chat components: composer, header, sidebar, message list, message cards, special message cards, image modal, and typing indicator.

### What changed

- The image upload button was moved up so it lines up with the text box.
- Mobile text-box zoom was fixed to avoid horizontal scrolling after tapping the chat input.
- Item title font size was increased without clipping the text.
- On mobile, participant name was shrunk and the item photo was removed from the top chat banner to make room for the item name.
- The mobile back button was renamed to "Chats" while keeping the back arrow.
- Chat blues and special-message colors were muted for dark mode and accessibility.
- Chat state handling was reorganized into `ChatContext.jsx` and `chatContextUtils.js`.

### What was removed

- The old chat context file names and utility structure.
- Mobile top-banner clutter that made long item names harder to read.

### Related backend/API notes

- Chat APIs now include image messages, served chat images, delete conversation, unread/new message polling, typing status, and conversation ensuring/fetching.
- CSRF is used on chat mutations.
- Scheduled purchase expiry updates also surface through chat messages.

## Wishlist page

### What was added

- Truncation for long item names in the removal confirmation popup.
- More consistent item-card layout matching the home page.
- Better positioning for wishlist tags and remove tags.

### What changed

- Mobile hover effects on wishlist item cards were removed because they did not work well with touch scrolling.
- The purple wishlist tag and red X tag were moved inward from the corner.
- The overflow bug in "Are you sure you want to remove (item-name)" was fixed through truncation.

### What was removed

- Mobile hover behavior that interfered with scrolling.
- The older wishlist card frontend layout.

### Related backend/API notes

- Wishlist APIs support add, remove, status checks, unread notification fetch, mark item read, mark all read, and full wishlist fetch.
- Wishlist schema/data was consolidated into the newer migration structure.

## User Preferences page

### What was added

- Dark theme support for the Theme box.
- Safer behavior for setting interested categories.
- Promo email preference logic tied to the styled email system.

### What changed

- Mobile scrolling was fixed so the page does not zoom unexpectedly.
- A rapid-click bug was fixed where interested categories could appear to assign themselves if "set interested categories" was clicked very quickly.
- Button borders were updated to match the newer style.
- A race condition was fixed where switching to dark mode and navigating to user preferences very quickly could leave the page stuck or reset incorrectly.

### What was removed

- The old fragile category-setting behavior that could get out of sync under rapid clicks.

### Related backend/API notes

- User preferences moved under `api/profile/user_preferences.php`.
- Category preferences are constrained to known allowed categories.
- Promo opt-in can send an intro promotional email once, using SendGrid on Railway when configured.

## Change Password page

### What was added

- A password requirement row component for clearer, reusable requirement display.
- Dark-mode-compatible success/error popup styling.

### What changed

- The password-change popup was updated to match the app's theme and work correctly in dark mode.
- Password validation became more consistent between frontend and backend.

### What was removed

- Older popup styling that did not fit the theme and did not behave well in dark mode.

### Related backend/API notes

- `api/auth/change_password.php` now participates in stronger CSRF and input validation behavior.
- Password length and validation constraints are enforced server-side.

## Seller Dashboard page

### What was added

- A backend/frontend cap limiting a user to 25 active listings.
- Cleaner seller-dashboard API organization under `api/seller_dashboard`.
- Set-item-status endpoint support in the organized folder.

### What changed

- The buyer popup title was changed to "Buyer Rating."
- Seller-dashboard related files were moved out of the older mixed folder structure.
- Button designs and active form designs were polished to match the rest of the app.

### What was removed

- Old `api/seller-dashboard` dash-folder paths in favor of underscore paths.
- Some older SellerDashboard page responsibilities were moved into the ScheduledPurchases area.

### Related backend/API notes

- The current uncommitted working tree hardens listing image upload by checking actual MIME type instead of trusting the filename extension.
- Sold items are blocked from being edited on the backend.
- Listing deletion, management, product listing, and status-setting now live under `api/seller_dashboard`.

## Individual Item / Active Listing page

### What was added

- Shared detail-row styling and item-detail components.
- More robust product detail hooks and utilities.
- Better long-word handling.
- Standardized back button styling through shared components.

### What changed

- Email text is no longer colored blue when there is no real `mailto` feature.
- Long words now wrap more naturally instead of continuing onto the next line awkwardly.
- The back button was standardized to match other back buttons across the site.
- Image fallback/proxy behavior was improved.
- "sendto" style mobile behavior was removed because it caused visual bugs and did not work as intended.

### What was removed

- Blue email styling that implied clickable email behavior.
- Broken or visually buggy mobile send-to behavior.
- Older item detail files under `src/itemDetails`.

### Related backend/API notes

- Product APIs moved from loose paths like `api/viewProduct.php` and `api/get_item_info.php` to `api/product/view_product.php` and `api/product/get_item_info.php`.
- Product details now include sold/date_sold/sold_to information needed by receipts, reviews, and active listing logic.

## Individual Item Receipt page

### What was added

- Cleaner receipt detail components and helpers.
- Better image display behavior for completed review images.

### What changed

- The receipt page frontend was reverted closer to an older design because the newer design felt too clunky/gummy.
- The bottom "Back to Results" button was removed.
- Completed review image zoom-in was removed so the whole image can be seen.
- Time display and review image wording align better with purchase-history behavior.

### What was removed

- The bottom "Back to Results" button.
- Broken/annoying completed-review image zoom behavior.
- Mobile send-to behavior from receipt pages.

### Related backend/API notes

- Receipt viewing lives under `api/receipt/view_receipt.php`.
- Receipt frontend moved into `src/pages/ItemDetails/ViewReceiptPage.jsx` plus receipt-specific components/utilities.

## Notifications page

### What was added

- Truncation for long item names on wishlist notification cards.
- Mobile hamburger text now uses "Notifications" with the missing "s" fixed.

### What changed

- Notification card text is safer against overflow.
- Navigation wording was polished.

### What was removed

- Long-name overflow behavior that could break notification card layout.

### Related backend/API notes

- Wishlist notification API support includes unread fetch and mark-read behavior.
- Wishlist notification seed data was cleaned up and renumbered with the rest of the data migrations.

## Ongoing Purchases page

### What was added

- A button swap for "Leave a Review" when a review already exists.
- Item photo shown to the left of the item name.
- Automatic cancellation/expiry for scheduled purchase requests when the buyer does not accept in time. This is currently set to 3 days.
- Backend lazy-expiry logic in `api/scheduled_purchases/expire_stale.php`.

### What changed

- Form card coloring was simplified.
- Purchase ordering now groups scheduled purchases as happening now, needing response, upcoming, and past.
- Active form button designs were polished.
- Chat is updated when scheduled purchases expire.
- Ongoing purchases moved out of the SellerDashboard folder into the ScheduledPurchases area.
- Item grouping and scheduled-purchase bucket sorting now live in feature-local helpers instead of being embedded in the page component.

### What was removed

- Older cluttered form-card coloring.
- The old ordering that made active/upcoming/past scheduled purchases harder to scan.

### Related backend/API notes

- Scheduled purchase APIs now live under `api/scheduled_purchases`.
- Buyer/seller list endpoints call stale-expiry logic before returning list data.
- Scheduled purchase frontend pages now live under `src/pages/ScheduledPurchases`.

## Create New Listing page

### What was added

- Image cropper/modal support.
- More modular listing form components, actions, status banners, success modal, safety tips, category hooks, and form config.
- Numeric input guards to block invalid characters such as `e`.
- MIME-based upload validation in the current uncommitted backend edit.

### What changed

- The bottom instruction line for item description was removed.
- Button text was updated.
- Frontend validation was brought closer to backend validation.
- Railway image upload behavior was fixed so file paths can be found.

### What was removed

- The bottom item-description instruction line.
- Extension-trusting image upload behavior. The backend now checks actual file MIME type in the current working tree.

### Related backend/API notes

- Product listing endpoint lives under `api/seller_dashboard/product_listing.php`.
- Sold items cannot be edited.
- Active listing count is capped at 25 per user.
- Uploaded images should use the configured image directory/media route for Railway compatibility.

## Purchase History page

### What was added

- Cleaner purchased-item display behavior.
- Better review image presentation.

### What changed

- Time stamps changed from 24-hour format to 12-hour format with AM/PM.
- Text around leaving images/reviews was changed.
- Completed review image zoom-in was removed so the entire image is visible.
- Purchased item components were polished.

### What was removed

- 24-hour timestamp display.
- Image zoom behavior that prevented seeing the full review image.

### Related backend/API notes

- Purchase history APIs moved from dash paths to underscore paths under `api/purchase_history`.
- Purchase/receipt/review data are more connected through migrations and helper APIs.

## FAQ page

### What was added

- Scroll blocker when an FAQ popup/modal is open.
- More FAQ topic pages.
- Page-aware behavior so the popup opens to the info tab matching the page the user is already on.
- Larger question-mark visual treatment.

### What changed

- FAQ text was rewritten to be more succinct and less repetitive.
- Question text size was decreased.
- FAQ files moved from `src/pages/FAQPage` to `src/pages/FAQ`.

### What was removed

- Repetitive older FAQ copy.
- The older FAQPage folder organization.

### Related backend/API notes

- This is mainly frontend, but it matters because routes and imports changed. Use `src/pages/FAQ` now.

## 404 / Not Found behavior

### What was added

- A dedicated 404 page.
- Catch-all routing for unknown app routes.

### What changed

- Settings subroutes that are not implemented now point to `NotFoundPage` instead of throwing raw loader responses.
- Unknown routes are handled more gracefully.

### What was removed

- The older raw/unfriendly missing-route behavior.

## Dark theme and accessibility

### What was added

- Dark theme support was expanded into the User Preferences theme box.
- Muted blue colors replaced brighter blues across the app, especially in chat special messages.
- Dark-mode hover animation was added to better match the app theme.

### What changed

- Dark mode is easier on the eyes sitewide.
- Login/pre-login dark-mode race/flicker behavior was fixed.
- User Preferences dark-mode race condition was fixed.
- Popups, cards, buttons, and message states were made more consistent in dark mode.

### What was removed

- Some overly bright blue visual treatment.
- Fragile theme loading behavior that could race if users changed theme and navigated quickly.

## Mobile and tablet responsiveness

### What was added

- More small-screen polish across pre-login, login, home, chat, wishlist, preferences, item detail, and ongoing purchases.
- Reusable body scroll lock behavior for popups/modals.

### What changed

- Text inputs were adjusted to avoid mobile zoom/horizontal scroll in several places.
- Touch-hostile hover effects were removed from mobile item cards.
- Small devices like iPhone SE received targeted spacing fixes.
- Chat mobile header was simplified to leave more room for item names.

### What was removed

- Several desktop-style hover and spacing behaviors that did not translate well to touch screens.

## Railway, deployment, PDFs, images, and email

### What was added

- Railway deployment support through `dorm-mart/Procfile` and `dorm-mart/router.php`.
- Railway routing that serves API requests to PHP files and React build files for the SPA.
- Static security headers in the Railway router.
- PDF MIME handling and inline PDF content disposition.
- SendGrid mailer support for Railway/custom-domain email.
- App config helpers for public URL, CORS origins, mail sender names, support email, and related environment-driven behavior.
- Image proxy behavior through `api/media/image.php`.

### What changed

- PDFs are treated as PDFs instead of odd downloads/octet-stream files.
- User-uploaded images should be read through the media endpoint instead of assuming raw `/images/...` paths work everywhere.
- Railway custom domain/CORS behavior was updated.
- Build/deploy scripts and README setup docs were updated for Railway, Aptitude, Cattle, and local development.

### What was removed

- Old assumptions that local Apache/XAMPP file paths also work unchanged on Railway.
- Some temporary Railway config files were added during experimentation and later removed from Git.

### Important teammate warning

Railway containers can lose files stored in normal container directories after redeploys/restarts unless a volume is configured. If database rows point at uploaded images but the files are gone, the app will show the placeholder image. The setup docs mention `DATA_UPLOADS_DIR` for persistent upload storage.

## Current run and deploy paths

### Local development

- Use `build-scripts-win/dev.bat`.
- It runs `build-scripts-win/start-local-dev.ps1`.
- That script tries to start XAMPP Apache/MySQL, then opens one PowerShell window for React and one for PHP.
- React is expected at `http://localhost:3000`.
- PHP API is expected at `http://localhost:8080`.

### Local Apache simulation

- Use `build-scripts-win/apache.bat`.
- It runs `build-scripts-win/build-local-apache.ps1`.
- It builds React, clears/copies files into `C:\xampp\htdocs\serve\dorm-mart`, and starts a PHP server.
- Be careful: this script clears the target serve directory before copying.

### Aptitude package

- Use `build-scripts-win/aptitude.bat`.
- It runs `build-scripts-win/build-aptitude.ps1`.
- It builds a `C:\xampp\htdocs\prod-build` folder for upload.
- Be careful: this script clears the target prod-build directory before copying.

### Cattle package

- Use `build-scripts-win/cattle.bat`.
- It runs `build-scripts-win/build-cattle.ps1`.
- It builds a `C:\xampp\htdocs\cattle-build` folder for upload.
- Be careful: this script clears the target cattle-build directory before copying.

### Railway

- Railway uses `dorm-mart/Procfile`.
- The web command runs PHP's built-in server against `dorm-mart/router.php`.
- The router sends `/api/...` requests to PHP files and serves the React build for non-API routes.

## Backend/API reorganization

### What was added

- Shared helpers under `api/helpers`, including API bootstrap, request/response helpers, image upload helpers, and inventory helpers.
- Config files under `api/config`.
- More consistent endpoint grouping:
  - `api/auth`
  - `api/categories`
  - `api/chat`
  - `api/confirm_purchases`
  - `api/listings`
  - `api/media`
  - `api/product`
  - `api/profile`
  - `api/purchase_history`
  - `api/receipt`
  - `api/reviews`
  - `api/scheduled_purchases`
  - `api/search`
  - `api/seller_dashboard`
  - `api/wishlist`

### What changed

- Many old dash-case folders became underscore folders.
- Many old camelCase PHP filenames became lower/underscore names.
- Loose API files were moved into feature folders.
- Frontend calls were updated to use the new paths.

### What was removed

- Old loose endpoint files such as `api/viewProduct.php`, `api/landingListings.php`, `api/userPreferences.php`, and old dash-case endpoint folders.
- Public HTTP access to dev/test/internal backend folders on Railway. The router blocks directories such as API test files, database scripts, helpers, security tools, utility scripts, and config files from being used as normal HTTP endpoints.
- The old lockout folder under `api/utility/lockouts`.

## Security and validation

### What was added

- Broader CSRF token usage for mutation endpoints.
- Missing security headers across code and Railway routing.
- Backend hardening around path traversal in the Railway router.
- CLI-only blocking for dev scripts and internal tools.
- Numeric input key guards to prevent typing `e` into numeric fields.
- Backend validation matching frontend validation more closely.
- MIME-based image upload validation in the current working tree for listing images.

### What changed

- Login/session rate limiting moved away from loose file lockout assumptions and toward more controlled handling.
- API test files were renamed/moved, with quick fixes applied, but they still need future cleanup.
- Input validation was cleaned up across auth, listings, reviews, scheduled purchases, and preferences.

### What was removed

- Some older, looser validation assumptions.
- Direct HTTP access to utility/config/test/helper folders through Railway routes.

## Data migrations and seed data

### What was added

- Consolidated migrations with clearer names:
  - user accounts
  - inventory
  - chat
  - purchases
  - scheduled purchase requests
  - confirm purchase requests
  - wishlist
  - reviews
  - login rate limits
- More test images under `data/test-images`.
- Seed data for realistic marketplace content, wishlist notifications, chat conversations, reviews, ongoing purchases, scheduled purchases, profile/theme testing, and listing/chat test flows.

### What changed

- Migration file numbering was cleaned up so repeat numbers no longer exist.
- Older many-step migrations were consolidated into fewer clearer migrations.
- Seed data numbering was corrected.
- Test seed data stopped hardcoding ID values where possible and moved toward auto-increment-aware inserts.
- Scheduled purchase seed data date bugs were fixed.
- Test seed image paths were changed to use images from `/data/test-images`.
- `migrate_schema.php` and `migrate_data.php` received better error messages while keeping output secure.
- Railway database migration behavior was synced/fixed.

### What was removed

- Old duplicate/renumbered migration files from the baseline.
- Some old seed files that were replaced by cleaner combined files.
- Duplicate or unused images in `/images`.

## Frontend/codebase cleanup

### What was added

- `src/App.jsx` replaced the older `src/App.js`.
- More page files use `.jsx`.
- Shared utility files were added for API config, CSRF fetch, formatting, auth handling, image fallback, input validation, theme loading, logging, numeric input key handling, password policy, price validation, and product details.
- Shared components were added for detail rows, error boundaries, page back buttons, profile links, and password requirement rows.

### What changed

- Frontend folders were reorganized so fewer unrelated files sit in `SellerDashboard` or loose `src` folders.
- Item details moved into `src/pages/ItemDetails`.
- Home moved into `src/pages/Home`.
- Search moved into `src/pages/Search`.
- Public profile moved into `src/pages/PublicProfile`.
- Scheduled purchase pages moved into `src/pages/ScheduledPurchases`.
- FAQ moved into `src/pages/FAQ`.
- Old snake_case utility files were replaced with camelCase utility names where the frontend already followed that convention.

### What was removed

- Duplicate/unused frontend files.
- Old public files and unused assets.
- Old `src/itemDetails` files.
- Old `src/pages/FAQPage` files.
- Old `src/pages/public_profile` files.
- Old `src/utils/auth.js`, `handle_auth.js`, and `load_theme.js` style files.

## Generated/vendor/media-heavy changes

This comparison includes a lot of dependency, vendor, generated, and media churn. Do not read too much product meaning into every one of these file-level changes.

### Summary

- Composer dependencies changed, including SendGrid and PHPMailer-related vendor files.
- Some Symfony/PSR vendor files disappeared while SendGrid/Starkbank files appeared.
- Image folders were cleaned up heavily.
- Test images were added under `data/test-images`.
- Duplicate images and unused image files were deleted or replaced.
- Build artifacts and generated dependency files should be treated as support changes unless you are specifically debugging deployment or Composer behavior.

## Current uncommitted local edits included in this handoff

At the time this document was updated, the working tree includes these local edits:

- Removed the redundant XSS blacklist helpers and their direct API call sites.
- Kept normal validation, prepared statements, security headers, URL allowlists, and HTML output encoding in place.
- Updated the XSS demo/test files so they focus on escaped output and unsafe HTML reflection, not rejecting every suspicious string.
- Removed the stale frontend validation helper documentation entry.
- Defined the missing `overflow-wrap-anywhere` CSS utility and applied it to high-risk user-generated text displays such as chat messages, reviews, receipt notes, scheduled purchase notes, and profile review text.
- Tightened search price filters on both the React form and the search API so malformed decimal strings are rejected instead of silently accepted/coerced.
- Reduced large frontend files by moving scheduled-purchase sorting/fetch helpers, schedule date/time helpers, chat username lookup, and chat typing-status handling into feature-local helper modules. No current frontend/backend source file is over 1,000 physical lines.
- Consolidated the live promo opt-in email sender into `api/helpers/promo_email.php`; `profile/user_preferences.php` now uses that shared helper, and the stale duplicate in account creation was removed.
- Rechecked recent refactors with production React builds and PHP syntax checks. The repo still has no matching frontend test files for Jest's default test command.
- Updated forgot-password and create-account email confirmation copy to remind users to check their spam folder.
- Hardened the password-reset email HTML with a visible copy/paste reset URL fallback because some mail clients de-click styled buttons on unauthenticated messages.
- Fixed unsuccessful Confirm Purchase handling so a seller-marked unsuccessful exchange does not behave like a completed sale after buyer acceptance or auto-acceptance. Unsuccessful accepted confirmations no longer mark inventory sold, write purchase history, trigger review/rating prompts, or block the seller from sending another Confirm Purchase or Schedule Purchase form.
- Brought chat conversation deletion cleanup into the same unsuccessful-confirm rule, so deleting a conversation does not keep an item blocked by an accepted schedule whose latest confirmation was unsuccessful.
- Removed stale Seller Dashboard comments and corrected the listing image-upload comment to match MIME-based validation.

### Security and correctness fixes (post-sprint)

**Password reset table scan fixed (`api/auth/`)**

`validate_reset_token.php` and `reset_password.php` previously fetched every user with an unexpired token and ran `password_verify()` on each one to find the matching user. With many users this gets progressively slower, and response timing leaks information about how many active reset requests exist.

Fix: the reset link now includes `uid=USER_ID` as a URL parameter (`forgot_password.php`, `redirects/handle_password_reset_token_redirect.php`). Both endpoints accept `uid` in the request body and look up the specific user directly (`WHERE user_id = ? AND reset_token_expires > NOW()`). A fallback full-scan path is kept for any old-style links already in flight since they expire within 1 hour. `validate_reset_token.php` no longer returns `user_id` in its response since the frontend does not use it.

**Purchase history race condition fixed (`api/confirm_purchases/helpers.php`)**

`record_purchase_history()` previously did a SELECT to read the current JSON array, appended the new entry in PHP, then wrote it back. Two simultaneous purchase completions for the same buyer could each read the same original array and one would overwrite the other's entry.

Fix: replaced with a single atomic `INSERT ... ON DUPLICATE KEY UPDATE` using MySQL's `JSON_ARRAY_APPEND`, which eliminates the read-modify-write window entirely.

**Legacy purchase history metadata bug fixed (`api/purchase_history/purchase_history.php`)**

`load_legacy_purchased_items()` was passing `purchased_items.item_id` values (the table's own auto-increment PK) to `load_inventory_metadata()` as if they were `INVENTORY.product_id` values. These are unrelated sequential integers from different tables with no foreign key relationship, so the metadata lookup was silently returning data for wrong or nonexistent products.

Fix: removed the metadata lookup for legacy items entirely. The `purchased_items` table already stores `title`, `sold_by`, and `image_url` as a snapshot at purchase time. `categories` and `price` are returned as empty/null for legacy items since there is no `inventory_product_id` column to join on.

**Unsuccessful confirm-purchase retry flow fixed (`api/confirm_purchases`, `api/scheduled_purchases`, chat)**

The confirm-purchase flow stored `is_successful`, but several completion checks treated any accepted or auto-accepted confirmation as a final completed sale. That meant a seller could mark a meet-up as unsuccessful, the buyer could accept that outcome, and the app would still block another confirmation/schedule attempt as if the item had completed safely.

Fix: completion checks now require both an accepted status and `is_successful = 1`. Unsuccessful accepted confirmations are terminal for that specific Confirm Purchase card, but they do not sell the item, write purchase history, show review prompts, or keep the schedule/confirm buttons locked. Scheduled-purchase cancellation, response, active checks, seller listing flags, and chat conversation deletion now use the same "active accepted schedule" rule so unsuccessful confirmations release the item flow consistently. Git history suggests the root behavior was introduced with `01f82dc` (`save state 2`) on April 28, 2026, when the confirm-purchase APIs and active scheduled-purchase check were added. The seller-dashboard accepted-schedule flag picked up the same assumption in `d2f59d0` (`web cli blocks`) on May 12, 2026.

## Things to know before working again

- Old paths may be wrong. Check current imports and API calls before editing from memory.
- Railway behavior is not the same as local XAMPP behavior, especially for images, PDFs, routing, and environment variables.
- Many UI changes were small polish fixes, but they touched many pages. Before editing a page, check its current component folder and related API path.
- The app now has more consistent modal/button styling. New popups should follow the newer rounded-button/modal approach.
- Sold listings are protected more strongly now; do not reintroduce edit paths for sold items.
- Scheduled purchase expiry is lazy and tied into list/chat flows. Be careful when changing scheduled purchase status logic, especially around unsuccessful accepted confirm-purchase outcomes, which should release the flow for a new schedule instead of acting like a completed sale.
- API test files were quick-fixed and moved, but they are not fully cleaned up.
- Build scripts can clear target folders under `C:\xampp\htdocs`; do not run package scripts casually unless you intend to rebuild those folders.
- The README and setup docs were updated, but this handoff is the best first read for understanding what changed since the sprint baseline.
