# Backlog card tests

Tests to paste into the **Backlog** cards of the Dorm Mart Scrum Board (GitHub Projects, board 3). Written 2026-11-10 from the 59 cards in the Backlog column. **Nothing here has been posted to GitHub.**

## How to use this file

- Each section is one card. Copy the tests under it into the card's body.
- Accounts: `Seller` = testuserschedulered@buffalo.edu, `Buyer` = testuserscheduleyellow@buffalo.edu, `Outsider` = chatuser1@buffalo.edu. Use the seed password from the data fixtures. `Moderator` = an account made with `php api/database/create_moderator.php`.
- Local setup for every test: from `dorm-mart/`, run `php api/database/migrate_schema.php` then `php api/database/migrate_data.php`, and start the app.
- Limits quoted here (4 attempts per 10 minutes, 1 hour, 25 MB, 500 characters, and so on) were read from the code on the date above. Exact button labels were not all checked on screen: where a step says a control by name, confirm the wording when you first run it and correct the card.
- Three kinds of card are marked:
  - **NEW**: the card had no tests.
  - **FILLED**: the card had test titles with no steps.
  - **HAS STEPS**: the card already has full tests; only extra edge cases are added.

## Contents

1. [Feature cards](#feature-cards)
2. [Security and validation cards](#security-and-validation-cards)
3. [DevOps, tooling and docs cards](#devops-tooling-and-docs-cards)
4. [List and discussion cards (no tests)](#list-and-discussion-cards-no-tests)

---

## Feature cards

### #230 (Real Payment Feature) Integrated payment system: NEW

Payments run in demo mode while `PAYMENTS_ENABLED=false`: the whole flow works, labeled as a demo transaction, and no money moves.

**Test 1: A seller can offer built-in payment when scheduling (Happy Path)**
1. Log in as Seller and open a chat with Buyer about one of Seller's active listings.
2. Start a Schedule Purchase and tick **Use built-in payment**.
3. Confirm a **Demo transaction** badge and the text that no real money is charged.
4. Enter an amount, pick a meeting time, and send.
5. Log in as Buyer and accept the request. The chat shows the accepted schedule.

**Test 2: The buyer can pay only during the Payment Window (Alternate Path)**
1. With the accepted schedule from Test 1, log in as Buyer before the meeting time.
2. Confirm there is no way to complete payment yet.
3. At the meeting time, open the chat again. A payment action is now available.
4. Wait until 30 minutes after the meeting time. The payment action is gone and the chat shows that manual confirmation was restored.

**Test 3: Completing the demo transaction completes the purchase (Happy Path)**
1. During the Payment Window, log in as Buyer and open the payment.
2. Confirm the dialog is titled **Demo transaction**, shows the amount Seller entered, and asks for no card details.
3. Press **Complete demo transaction**.
4. The chat shows **Demo Transaction Completed**, the listing is marked sold, and **View receipt** opens a receipt that says no real money moved.
5. Press the button again from a second tab. Still only one purchase and one receipt exist.

**Test 4: The seller can refund and relist (Happy Path)**
1. Log in as Seller and open the receipt from Test 3.
2. Issue a refund and choose to relist the item.
3. The chat shows **Demo Refund Completed** and the listing is active again.
4. Try to refund again. It is refused as already refunded.

**Test 5: Demo payments are not counted as earnings (Alternate Path)**
1. Complete a demo transaction as in Test 3.
2. Log in as Seller and open the Seller Dashboard.
3. Earnings did not increase by the demo amount.

**Test 6: Only the buyer can pay and only the seller can refund (Alternate Path)**
1. Log in as Outsider and try to open the payment for Seller and Buyer's schedule. It is not found.
2. Log in as Seller and try to pay your own schedule. It is not found.
3. Log in as Buyer and try to refund the completed payment. It is not found.

**Test 7: Demo mode can be switched off (Alternate Path)**
1. Set `PAYMENTS_DEMO_MODE=false` and restart the backend.
2. Log in with a non-seed account and start a Schedule Purchase.
3. **Use built-in payment** is disabled with the reason that built-in payment is not enabled yet.
4. Open Settings > Payments. It says real payments are not available yet.

### #232 Correct Scheduled Purchase and Confirm Purchase lifecycle states: FILLED

**Test 1: Successful purchase shows every card in order (Happy Path)**
1. Seller sends a Schedule Purchase; Buyer accepts.
2. Seller sends a Confirm Purchase marked successful; Buyer accepts.
3. The chat shows the schedule card, the accepted status, the confirm card, the completed status, next-step instructions, and a review prompt for Buyer and a rate-buyer prompt for Seller.
4. Buttons on the earlier cards are disabled or relabeled to show the action already happened.

**Test 2: Unsuccessful exchange releases the listing (Alternate Path)**
1. Repeat Test 1 but mark the Confirm Purchase unsuccessful.
2. The listing returns to active and can be scheduled again with another buyer.
3. No review prompt appears.

**Test 3: An unanswered request expires (Alternate Path)**
1. Seller sends a Schedule Purchase and Buyer does not respond.
2. After the meeting time passes (or 3 days after it was sent, whichever is first), open the chat.
3. The request shows as expired, a chat message says so, and neither user can accept it.

**Test 4: Deleting the item closes open actions (Alternate Path)**
1. Seller sends a Schedule Purchase, then deletes the listing.
2. Buyer opens the chat. Accept and Confirm actions are disabled and the card says the item is no longer available.

**Test 5: A decided request cannot be decided twice (Alternate Path)**
1. Buyer accepts a request, then opens the same chat in a second tab and presses Decline on the stale card.
2. The second action is refused and the status stays accepted.

### #227 Redo "View How Sellers Have Rated You" and own-review views: NEW

**Test 1: Received ratings are easy to find (Happy Path)**
1. Log in as Buyer after a seller has rated you.
2. Open the page that shows how sellers rated you from your profile or settings.
3. Each entry shows the rating, the feedback text, the seller's name, and the item.

**Test 2: Reviews of items you sold are shown separately (Happy Path)**
1. Log in as Seller, who has both sold items and bought items.
2. Open your profile. Reviews buyers left on your items and ratings sellers left about you are in clearly labeled, separate sections.

**Test 3: Empty state (Alternate Path)**
1. Log in with an account that has never bought anything.
2. Open the same page. It shows a clear "no ratings yet" message, not a blank page or an error.

**Test 4: Another user's private feedback is not visible (Alternate Path)**
1. Log in as Outsider and open Buyer's public profile.
2. The feedback sellers left about Buyer is not shown.

### #260 (Rate Buyers): NEW

**Test 1: A seller can rate a buyer after a completed purchase (Happy Path)**
1. Complete a purchase between Seller and Buyer.
2. Log in as Seller, open the sold listing, and choose to rate the buyer.
3. Give a rating and optional feedback and submit. A success message appears.

**Test 2: A buyer can be rated only once per item (Alternate Path)**
1. After Test 1, try to rate the same buyer for the same item again.
2. It is refused with "You have already rated this buyer for this product".

**Test 3: Feedback length limit (Alternate Path)**
1. Enter 250 characters of feedback. It is accepted.
2. Enter 251 characters. It is refused with "Review text must be 250 characters or less".

**Test 4: Only the seller of a sold item can rate (Alternate Path)**
1. Log in as Outsider and try to rate Buyer for Seller's item. It is refused.
2. Log in as Seller and try to rate Buyer for an item that is still active. It is refused with "Product must be sold to this buyer".

**Test 5: The chat reminder opens the rating form (Happy Path)**
1. After a completed purchase, log in as Seller and open the chat.
2. The rate-buyer reminder is shown. Pressing it opens the rating form for the right buyer and item.

### #261 (View Buyer Ratings): NEW

**Test 1: A buyer sees ratings sellers left (Happy Path)**
1. Seller rates Buyer as in #260 Test 1.
2. Log in as Buyer and open How Sellers Rated You.
3. The new rating shows its stars, feedback, seller name, and item.

**Test 2: Not logged in (Alternate Path)**
1. Log out and open the page's address directly.
2. You are sent to login and no ratings are shown.

**Test 3: Another user's ratings are private (Alternate Path)**
1. Log in as Outsider.
2. Request Buyer's ratings by changing the user id in the request. Only Outsider's own ratings are returned.

**Test 4: A rating from a deleted seller still displays (Alternate Path)**
1. Seller rates Buyer, then Seller's account is deleted.
2. Buyer opens the page. The rating still shows, with the seller identity removed, and the page does not break.

### #263 (Report Listings) and #251 Listing Reports and Moderator Item Removal: NEW

**Test 1: A user can report a listing (Happy Path)**
1. Log in as Buyer and open one of Seller's listings.
2. Choose to report it. The reasons offered are: Prohibited or illegal item, Scam or fraud, Misleading description or photos, Offensive or inappropriate content, Spam or duplicate listing, Something else.
3. Pick a reason, add details, and submit. A confirmation appears.

**Test 2: "Something else" needs details (Alternate Path)**
1. Pick **Something else** and leave details empty. It is refused with "Please describe the problem".

**Test 3: Details limit (Alternate Path)**
1. Enter 500 characters of details. Accepted.
2. Enter 501 characters. Refused with "Details must be 500 characters or less".

**Test 4: You cannot report your own listing (Alternate Path)**
1. Log in as Seller and try to report your own listing. It is refused with "You cannot report your own listing".

**Test 5: Reporting twice updates one report (Alternate Path)**
1. As Buyer, report the same listing again with a different reason.
2. Log in as Moderator. The dashboard shows one open report from Buyer for that listing, with the newer reason.

**Test 6: A moderator removes the listing (Happy Path)**
1. Log in as Moderator, open the report, and remove the listing with a reason.
2. The listing no longer appears in search or on Seller's profile.
3. Seller has a notification explaining why it was removed. Buyer has a notification with the outcome.

**Test 7: A moderator dismisses a report (Alternate Path)**
1. Report another listing as Buyer, then dismiss it as Moderator.
2. The listing stays active. Buyer is notified of the outcome.

**Test 8: Regular users cannot use moderator actions (Alternate Path)**
1. Log in as Buyer and send the remove-listing request for a report directly. It is refused.

### #259 (Seller Listing Reminders): NEW

**Test 1: A stale listing triggers one reminder (Happy Path)**
1. As Seller, have an active listing whose listed date is at least 14 days ago, with no saves, messages, or purchase requests. (Set `date_listed` in the local database.)
2. Open notifications. A reminder for that listing is shown, saying it had no saves, messages, or purchase requests.

**Test 2: The reminder is sent only once (Alternate Path)**
1. Open notifications again on later days, or reload several times.
2. Still exactly one reminder exists for that listing.

**Test 3: Interest prevents the reminder (Alternate Path)**
1. Prepare three more listings 14 days old: one saved to a wishlist by Buyer, one with a chat message, one with a purchase request.
2. None of them produce a reminder.

**Test 4: A 13-day-old listing gets no reminder (Alternate Path)**
1. Set a listing's listed date to 13 days ago with no interest.
2. No reminder appears. Change it to 14 days and it does.

**Test 5: Sold or removed listings get no reminder (Alternate Path)**
1. Mark a 14-day-old listing sold. No reminder appears for it.

### #222 (TOS + Privacy Policy Access): NEW

**Test 1: Both documents are available before login (Happy Path)**
1. Log out. From the login or create-account page, open Terms of Service, then Privacy Policy.
2. Each opens without asking you to log in.

**Test 2: Both documents are available after login (Happy Path)**
1. Log in, open Settings > Account Info, and open each document from there.

**Test 3: Download or print (Happy Path)**
1. On each document, press **Download or print (PDF)**.
2. The browser's print or save dialog opens with the full document.

**Test 4: The same text is shown in both places (Alternate Path)**
1. Compare the Terms shown before login with the Terms shown from Account Info. The version or date and the text match.

### #152 Combine all TOS and Privacy Policy versions: NEW

**Test 1: One source of text**
1. Search the repository for older Terms or Privacy copies. Only the shared legal documents file is used by the pages.

**Test 2: Required topics are covered**
1. Read both documents. They cover accounts, listings, prohibited items, payments (including that demo payments move no money), moderation and bans, data collected, account deletion, and a support contact.

**Test 3: Pages render the full document**
1. Open both pages on a phone-width screen and in dark mode. Headings, lists, and links are readable and nothing is cut off.

### #132 (Video Uploads to chats and item listings): FILLED

**Test 1: A seller can upload and play a video on a listing (Happy Path)**
1. Log in as Seller and create a listing with at least one photo and one MP4 under 25 MB.
2. Open the listing. The video plays with sound and can be paused and scrubbed.

**Test 2: A listing still needs a photo (Alternate Path)**
1. Create a listing with one video and no photo. It is refused and asks for a photo.

**Test 3: Size and type limits on listings (Alternate Path)**
1. Upload a video over 25 MB. Refused.
2. Upload a `.avi` file, and a text file renamed to `.mp4`. Both refused.
3. Upload a WebM and a MOV under 25 MB. Both accepted.

**Test 4: A buyer or seller can send a video in chat (Happy Path)**
1. In a chat, send an MP4 under 25 MB. Both participants can play it.

**Test 5: Chat media is private (Alternate Path)**
1. Copy the address of the chat video and open it logged in as Outsider, then logged out. It is not served.

**Test 6: Chat image limit is unchanged (Alternate Path)**
1. Send an image over 2 MB in chat. It is refused.

### #164 (Algorithmic For You Page): FILLED

**Test 1: Interests shape the feed (Happy Path)**
1. Log in with a new account and choose two interest categories.
2. Open For You. Most listings shown are in those categories.

**Test 2: Activity shapes the feed (Happy Path)**
1. View and save several listings in a category you did not choose.
2. Reload For You. Listings from that category now appear.

**Test 3: New user with no activity (Alternate Path)**
1. Log in with an account that has no interests or activity.
2. For You shows popular or recent listings, not an empty page.

**Test 4: Your own and unavailable listings are excluded (Alternate Path)**
1. Log in as Seller. None of Seller's own listings appear in For You.
2. Sold and removed listings do not appear.

**Test 5: Explore More gives a different mix (Happy Path)**
1. Open Explore More twice. The selection changes between loads.

### #161 (Promotional Emails): FILLED

**Test 1: A user who opts in receives a digest (Happy Path)**
1. In User Preferences, set promotional emails to daily and save.
2. Run the promotional email script locally. An email is produced for that user with listing links.

**Test 2: Links open the listing (Happy Path)**
1. Click a listing in the email. It opens that listing in the app, after login if needed.

**Test 3: Opting out stops emails (Alternate Path)**
1. Set promotional emails to off and run the script again. No email is produced for that user.

**Test 4: One-click unsubscribe (Happy Path)**
1. Click the unsubscribe link in a digest. A confirmation page appears and the preference is now off.
2. Change one character of the link and open it. It is refused and the preference does not change.

**Test 5: Weekly is not sent daily (Alternate Path)**
1. Set weekly, run the script on two consecutive days. Only one email is produced.

**Test 6: Sold and removed listings are not advertised (Alternate Path)**
1. Mark a listing sold, run the script. It is not in the email.

### #163 (About Us Page): HAS STEPS, add

**Extra Test: Missing photo**
1. Rename one developer photo file locally and open About Us. A placeholder shows and the layout is intact.

**Extra Test: Contact links**
1. Each email link opens a mail draft to the right address. Each external link opens in a new tab.

### #142 (Moderator User with Mod Tools): HAS STEPS, add

**Extra Test: A regular user cannot reach moderator data**
1. Log in as Buyer and open the Safety dashboard address directly. It is refused or redirected.
2. Send each moderator request (ban, clear flag, resolve report, blocked words) directly as Buyer. Each is refused.

**Extra Test: A ban signs the user out**
1. Log in as Outsider in one browser. As Moderator, ban Outsider.
2. Outsider's next action sends them to login, and logging in is refused.

**Extra Test: A moderator cannot ban a moderator or themselves**
1. Try both. Each is refused.

### #169 (Chat Profanity Filter): HAS STEPS, add

**Extra Test: Editing a message is filtered too**
1. Send a clean message, then edit it to include a blocked word. The saved message shows stars.

**Extra Test: Words inside other words are not censored**
1. Send a normal word that contains a blocked word as a fragment (for example "class"). It is not starred.

**Extra Test: Only moderators see the original text**
1. As a participant, the starred text is all you can see, including in the page's network responses.

### #139 (Edit Last Sent Message): HAS STEPS, add

The card's tests point at a personal Postman workspace. Replace them with UI steps:

**Test 1: Edit your latest message (Happy Path)**
1. Send a text message, open its menu, choose edit, change the text, and save.
2. Both users see the new text with an edited label.

**Test 2: Limits (Alternate Path)**
1. Save an empty edit. Refused.
2. Save 501 characters. Refused with the 500 character message.

**Test 3: You cannot edit someone else's or an older message (Alternate Path)**
1. The other user's messages have no edit option.
2. After you send a second message, the first one can no longer be edited.

### #126 (Delete Individual Message): HAS STEPS, add

**Test 1: Delete your latest message (Happy Path)**
1. Send a message, choose delete, and confirm. Both users see a deleted-message note.

**Test 2: Unread count is corrected (Alternate Path)**
1. Send a message the other user has not read, then delete it. Their unread badge does not count it.

**Test 3: You cannot delete someone else's message (Alternate Path)**
1. Send the delete request for the other user's message id directly. It is refused.

### #134 (Logged Devices Manager/History): FILLED

**Test 1: The page lists devices that logged in (Happy Path)**
1. Log in and open Settings > Logged Devices. The current device is listed and marked as this device.

**Test 2: Each record shows device, location, and time (Happy Path)**
1. The entry shows the browser and system, an approximate location (or "local" on a dev machine), and a login time that matches when you logged in.

**Test 3: A new device appears (Happy Path)**
1. Log in from a second browser. Reload the page in the first. The second device is listed.

**Test 4: You cannot see another user's devices (Alternate Path)**
1. Log in as Outsider and request the device history. Only Outsider's devices are returned, whatever user id is sent.

**Test 5: Changing the password signs out other devices (Alternate Path)**
1. With two browsers logged in to a non-seed account, change the password in one.
2. The other is sent to login on its next action.

### #131 (Account Info Page): FILLED

**Test 1: Correct account information (Happy Path)**
1. Log in and open Settings > Account Info. Name, email, graduation date, account creation date, and phone number match the account.

**Test 2 and 3: Legal buttons (Happy Path)**
1. The Terms of Service button opens the Terms. The Privacy Policy button opens the Privacy Policy.

**Test 4: Not logged in (Alternate Path)**
1. Log out and open the page's address. You are sent to login. The account info request returns no data.

**Test 5: No sensitive fields are returned (Alternate Path)**
1. In the browser's network tab, the account info response has no password hash, reset token, or session data.

### #168 (Delete Entire Account): HAS STEPS, add

**Extra Test: Wrong password**
1. Enter a wrong password in the delete dialog. Nothing is deleted.

**Extra Test: Seed accounts cannot be deleted**
1. Try to delete a seed account. It is refused.

**Extra Test: Open purchases**
1. With an accepted Schedule Purchase in progress, delete the account. The other user's chat shows the purchase is no longer available and no action is left enabled.

### #128 (Two Factor Auth via Email): HAS STEPS, add

**Extra Test: Wrong and expired codes**
1. Enter a wrong code. Login is refused and repeated tries are limited.
2. Wait past the code's expiry and enter it. Refused; a new code can be requested.

**Extra Test: A code cannot be reused**
1. Log in with a code, log out, and try the same code again. Refused.

### #127 (Buyer Side Notifications): HAS STEPS, add

**Extra Test: Delete one and clear all**
1. Delete one notification. Only that one is removed. Press clear all. The list is empty and the badge is zero.

**Extra Test: You cannot delete another user's notification**
1. Send the delete request with a notification id that belongs to another user. Nothing is deleted.

**Extra Test: A notification for an unavailable listing**
1. Open a notification whose listing was deleted. You get a clear "no longer available" page.

### #143 (Investor safety data): HAS STEPS, replace

The card describes an investor login that does not exist. The page is public:

**Test 1: The Safety page needs no login (Happy Path)**
1. Log out and open the public Safety page. It shows report totals, how many were resolved, removed, or dismissed, moderator response time, and ban counts.

**Test 2: No personal data (Alternate Path)**
1. In the network tab, the response has only counts and averages: no names, emails, message text, listing titles, or ids.

**Test 3: Numbers match the moderator dashboard (Happy Path)**
1. File one new listing report. The open-report total rises by one on both the Safety page and the moderator dashboard.

### #211 (UI/UX Polish and Minor Changes): NEW

**Test 1: Phone, tablet, desktop**
1. Open home, search, a listing, chat, seller dashboard, and settings at 375 px, 768 px, and 1280 px wide. Nothing overflows sideways and every button is reachable.

**Test 2: Dark mode**
1. Switch to dark mode and repeat Test 1. No white panels, invisible text, or unreadable badges.

**Test 3: Consistent controls**
1. Primary buttons, inputs, and error messages look the same on every form.

**Test 4: Loading and empty states**
1. With an empty wishlist, no chats, and no listings, each page shows a helpful message.

### #229 Achieve WCAG Accessibility Full Completion: NEW

**Test 1: Keyboard only**
1. Using Tab, Shift+Tab, Enter, Space, and Escape only: log in, search, open a listing, send a chat message, and open and close a dialog. Focus is always visible and never trapped.

**Test 2: Screen reader names**
1. With a screen reader, every button, link, input, and image has a meaningful name. Icon-only buttons are announced by purpose.

**Test 3: Contrast**
1. Run an automated checker (axe or Lighthouse) on each main page in light and dark mode. No contrast failures at AA.

**Test 4: Forms**
1. Submit each form empty. Every error is announced and tied to its field.

**Test 5: Zoom**
1. At 200% zoom, all content and controls remain usable without sideways scrolling.

**Test 6: Dialogs**
1. Opening a dialog moves focus into it; closing returns focus to the control that opened it.

---

## Security and validation cards

### #223 Add create account rate limiting: NEW

**Test 1: Normal sign-up works (Happy Path)**
1. Create one account with a new email. It succeeds.

**Test 2: The fifth attempt in ten minutes is blocked (Alternate Path)**
1. From one device, submit the create-account form 4 times in under 10 minutes (any emails).
2. Submit a 5th time. It is refused with a too-many-attempts message and a wait time (HTTP 429).

**Test 3: The block does not reveal whether an email exists (Alternate Path)**
1. Repeat Test 2 once using an email that already has an account and once using a new email. The blocked response is identical.

**Test 4: The limit lifts (Alternate Path)**
1. Wait 10 minutes and submit again. It is accepted.

**Test 5: Invalid submissions also count (Alternate Path)**
1. Submit 4 invalid forms, then a valid one. The valid one is blocked.

### #247 CSRF Enforcement: NEW

**Test 1: A change request without a token is refused**
1. Log in. Using the browser's network tools or curl with your session cookie, repeat a change request (for example add to wishlist) with the `csrf_token` removed. It is refused with 403 and nothing changes.

**Test 2: A forged token is refused**
1. Repeat with `csrf_token` set to `forged`. Refused with 403.

**Test 3: Another session's token is refused**
1. Copy the token from Outsider's session and use it with Buyer's cookie. Refused.

**Test 4: Every change endpoint is covered**
1. Run `npm run test:backend:integration` from `dorm-mart/`. The forged-token checks pass for chat, wishlist, listings, purchases, payments, reviews, profile, and moderation.

**Test 5: Normal use is unaffected (Happy Path)**
1. Use the app normally for each of those features. No action fails with a token error.

**Test 6: Logging out invalidates the token**
1. Copy your token, log out, log in again, and send a request with the old token. Refused.

### #224 Fix all backend and frontend input validation gaps: NEW

**Test 1: Listing form**
1. Try an empty title, a title over the limit, a negative price, a price with three decimals, and a price above the maximum. Each is refused on screen, and refused again when the request is sent directly to the server.

**Test 2: Schedule Purchase form**
1. Try a meeting time in the past, an empty location, and a payment amount of 0.49 and of 10000. Each is refused. 0.50 and 9999.99 are accepted.

**Test 3: Wrong types sent to the server**
1. Send a list where text is expected and text where a number is expected to the listing, chat, and review endpoints. Each answers with a clear 400, never a 500.

**Test 4: Text length limits**
1. Send a chat message of 500 characters (accepted) and 501 (refused). Review feedback of 250 (accepted) and 251 (refused).

**Test 5: Uploads**
1. Upload an image over 2 MB, and a non-image renamed to `.jpg`, as a profile photo and as a listing photo. Refused.

**Test 6: Automated**
1. Run `npm run test:backend`. The adversarial validation suite passes.

### #225 Update Dark Theme, XSS/SQL and other end-of-sprint checks: FILLED

**Test 1: Script text is shown as text**
1. Put `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` in a listing title, description, chat message, review, and profile bio. Each displays as plain text and no alert appears, including in notifications and emails.

**Test 2: SQL-looking input is harmless**
1. Search for `' OR '1'='1` and `"; DROP TABLE user_accounts; --`. Search returns normal results or none, and the app keeps working.
2. Use the same text as a login email. Login is refused normally.

**Test 3: Dark theme**
1. Walk every page in dark mode, including dialogs, receipts, and the payment dialog. No unreadable text.

**Test 4: Automated**
1. Run `php api/tests/xss_encoding_test.php` and the Jest adversarial tests. All pass.

### #221 Setup and fix any "Security and Quality" issues: NEW

**Test 1: CodeQL is clean**
1. Open the repository's Security > Code scanning page. No open high or critical alerts.

**Test 2: Password change signs out other sessions**
1. As in #134 Test 5.

**Test 3: A ban signs the user out**
1. As in #142 Extra Test.

**Test 4: Blocked folders are not reachable**
1. Request a file under `/api/tests/`, `/api/database/`, `/api/helpers/`, `/api/security/`, `/api/utility/`, and `/api/config/` in the browser. Each answers 404.

**Test 5: Another user's resources**
1. As Outsider, request Buyer's receipt, chat, chat image, and scheduled purchase by id. Each is refused or not found.

**Test 6: Secrets**
1. Search the repository and the built frontend for secret keys. Only publishable keys and example placeholders are present.

### #226 Verify password reset email delivery, expired links, and password changes: NEW

**Test 1: Reset email arrives (Happy Path)**
1. Request a reset for a non-seed account. The email arrives with a working link.

**Test 2: Unknown email gets the same answer (Alternate Path)**
1. Request a reset for an address with no account. The page shows the same message and no email is sent.

**Test 3: One request per ten minutes (Alternate Path)**
1. Request a reset twice within 10 minutes. Only one email is sent.

**Test 4: The link expires after one hour (Alternate Path)**
1. Open the link more than 1 hour later (or set `reset_token_expires` to the past locally). The expired-link page appears and the password cannot be changed.

**Test 5: The link works once (Alternate Path)**
1. Reset the password, then open the same link again. It is refused.

**Test 6: New password works and old sessions end (Happy Path)**
1. Log in with the new password. The old password is refused. Any browser that was logged in is signed out.

**Test 7: Password policy (Alternate Path)**
1. Try a password over 64 characters and one that does not meet the policy. Both are refused.

**Test 8: Seed accounts (Alternate Path)**
1. Request a reset for a seed account. No password change is possible.

### #190 Setup new free emailer service for Railway: FILLED

**Test 1: Account email reaches a non-UB address (Happy Path)**
1. On the deployed site, create an account with a non-UB email. The welcome email with the temporary password arrives.

**Test 2: Fallback (Alternate Path)**
1. With the Resend key unset and SMTP configured locally, trigger a reset email. It is sent through SMTP.

**Test 3: No mail configuration (Alternate Path)**
1. With no mail settings, trigger an email. The app reports a clear failure and does not crash.

**Test 4: Shared template**
1. Compare the welcome, reset, two-factor, and security emails. Same header, footer, and support address.

### #234 Configure the Dorm Mart support email: NEW

**Test 1: The address appears in emails**
1. Set `SUPPORT_EMAIL` and trigger a reset email. The footer shows that address.

**Test 2: Mail to the address is received**
1. Send a message to the support address from an outside account. It arrives in the support mailbox.

**Test 3: Process is documented**
1. The repository docs say who can access the mailbox, where the credentials are stored, and how a support or moderation request is handled.

---

## DevOps, tooling and docs cards

### #145 Setup Railway Deployment System and #253 Set Up Local Railway Deployment: NEW

**Test 1: A deploy from `dev` succeeds**
1. Push to `dev`. Railway builds the container, runs schema sync before deploy, and the site loads at dormmart.me.

**Test 2: A failed schema sync blocks the deploy**
1. On a throwaway environment, introduce a schema file error and deploy. The pre-deploy step fails and the previous version stays live.

**Test 3: Uploads survive a redeploy**
1. Upload a listing photo, redeploy, and open the listing. The photo still loads.

**Test 4: API routing**
1. On the deployed site, a normal API call works, `/api/tests/...` answers 404, and an unknown page loads the app.

**Test 5: Local container (#253)**
1. Build and run the Docker image locally with a local database. The app loads and login works on the container's port.

### #228 Improve data migrations and schema sync: NEW

**Test 1: Fresh database**
1. Point at an empty database and run `php api/database/migrate_schema.php`. All tables are created.

**Test 2: Running again changes nothing**
1. Run it a second time. It reports no changes.

**Test 3: A column change is applied**
1. Add a column to one `schema/<table>.sql`, run the sync. The column exists and existing rows are kept.

**Test 4: Fixtures reset only fixture accounts**
1. Create a personal account and listing locally, run `php api/database/migrate_data.php`. Seed accounts are reset; the personal account and listing are untouched.

**Test 5: Fixtures refuse a remote database**
1. Point `DB_HOST` at a non-local host and run `migrate_data.php`. It refuses.

**Test 6: Automated**
1. `php api/tests/schema_sync_test.php` and `php api/tests/database_migrations_test.php` pass.

### #213 Revamp Deployment Scripts and #217 Revamp Code Scripts: NEW

**Test 1: Each script runs clean**
1. Run every script in `build-scripts-win` on Windows and its WSL or Mac equivalent. Each finishes without errors and does what its header says.

**Test 2: A missing setting gives a clear message**
1. Remove a required setting and run the build script. It stops with a message naming the setting.

**Test 3: One command formats and checks the project (#217)**
1. Run the format command, then the lint and PHP lint commands. A clean checkout produces no changes and no errors.

### #258 Add PHPStan and ESLint checks to CI: FILLED

**Test 1: Checks run on a pull request**
1. Open a pull request. PHPStan and ESLint appear as checks and pass on the current code.

**Test 2: A PHP type error fails the check**
1. Push a commit that passes a string to an `int` parameter. PHPStan fails and names the line.

**Test 3: An ESLint error fails the check**
1. Push a commit with an unused import. ESLint fails and names the line.

### #216 Fix dependency issues and set up Dependabot: NEW

**Test 1: Clean install**
1. On a fresh clone, `npm ci` and `composer install` finish without errors.

**Test 2: Audit**
1. `npm audit --omit=dev` and `composer audit` report no high or critical issues, or each remaining one is listed on the card with a reason.

**Test 3: Dependabot is active**
1. The repository's Dependabot page shows it enabled, and recent update pull requests exist.

**Test 4: Nothing broke**
1. `npm test -- --watchAll=false`, `npm run test:backend`, and `npm run build` pass.

### #257 Migrate the frontend build from Create React App to Vite: NEW

**Test 1: Dev server**
1. Start the dev server. The app loads, and editing a component updates the page without a full reload.

**Test 2: Production build**
1. Build and serve the output through `router.php`. Login, search, chat, and images work.

**Test 3: Settings carry over**
1. The API base address and other frontend settings resolve the same as before in local and deployed builds.

**Test 4: Tests still run**
1. The full frontend test suite passes.

**Test 5: Deployed build**
1. Deploy to a test environment. Hash routes (`#/app/...`) and reset-password links open the right pages.

### #218 Redo test suite and Postman tests: FILLED

**Test 1: Every suite runs from one place**
1. From `dorm-mart/`: `npm test -- --watchAll=false`, `npm run test:backend`, and `npm run test:backend:integration` (with local MySQL running) all pass.

**Test 2: The catalog is current**
1. `node scripts/generate-test-catalog.js --check` reports the catalog is up to date.

**Test 3: No dead instructions**
1. Card tests no longer point at personal Postman workspaces (see #139 and #126 above).

### #192 Refactor codebase for readability: HAS STEPS, add

**Extra Test: Behavior is unchanged**
1. Before and after the refactor, all three test commands in #218 Test 1 pass with the same number of tests or more.

### #197 (DevOps Tasks): HAS STEPS

No additions.

### #158 Create developer wiki, #219 Create user wiki, #214 AI instruction files: NEW

**Test 1: A new developer can set up from the docs alone (#158)**
1. On a clean machine, follow only the wiki. The app runs locally and the tests pass. Note every step that was missing.

**Test 2: Links work (#158, #219)**
1. Every link in the wiki opens an existing page or file.

**Test 3: User wiki matches the app (#219)**
1. For each main feature, follow the wiki's steps in the app. Names and steps match what is on screen.

**Test 4: Instruction files are found by each tool (#214)**
1. Start each AI tool the team uses in the repository and ask where setup instructions are. It reads the project's instruction files.

### #215 Research CodeRabbit equivalent and #220 Research actions and agents: NEW

**Test 1: A decision is recorded**
1. The card lists the tools compared, the one chosen, and why.

**Test 2: The chosen tool runs**
1. Open a test pull request. The tool comments or reports a check on it.

**Test 3: Required reviews (#220)**
1. Try to merge a pull request into the protected branch with no approval. It is blocked.

---

## List and discussion cards (no tests)

These cards are lists, notes, or process items. They have nothing to run, so no tests were written:

| Card | Why |
| --- | --- |
| #135 Notes links | Collection of links |
| #147 Build Scrum board on GitHub Projects | Board upkeep |
| #160 Team discussion items | Discussion |
| #172 Development/technical questions | Questions |
| #203 todos | Checklist |
| #235 Update existing cards instead of adding duplicates | Board process |
| #167 Review Figma designs for lost ideas | Produces a document |
| #171 Bug fixes/enhancements not-completed list | Running list; each item is verified when done |
| #166 Sprint 5 completed list | History |
