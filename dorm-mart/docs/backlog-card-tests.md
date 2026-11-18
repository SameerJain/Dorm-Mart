# Backlog card tests

Tests to paste into the **Backlog** cards of the Dorm Mart Scrum Board (GitHub Projects, board 3). Written 2026-11-10 from the 59 cards in the Backlog column. **Nothing here has been posted to GitHub.**

## How to use this file

- Each section is one card. Copy the tests under it into the card's body.
- Each section starts with the card's title and its description, copied word for word from the board on 2026-11-13, so pasting a section does not leave the description blank. Paste the description, then everything under **Tests:**. Test names that came from the card use the card's wording.
- Accounts: `Seller` = testuserschedulered@buffalo.edu, `Buyer` = testuserscheduleyellow@buffalo.edu, `Outsider` = chatuser1@buffalo.edu. Use the seed password from the data fixtures. `Moderator` = an account made with `php api/database/create_moderator.php`.
- Local setup for every test: from `dorm-mart/`, run `php api/database/migrate_schema.php` then `php api/database/migrate_data.php`, and start the app.
- Limits quoted here (4 attempts per 10 minutes, 1 hour, 25 MB, 500 characters, and so on) were read from the code on the date above. Exact button labels were not all checked on screen: where a step says a control by name, confirm the wording when you first run it and correct the card.
- Three kinds of card are marked:
  - **NEW**: the card had no tests.
  - **FILLED**: the card had test titles with no steps.
  - **HAS STEPS**: the card already has full tests; only extra edge cases are added.
- 2026-11-13: the tests already on each card were copied in, so a section holds everything the card should end up with. They were updated to match the current app (accounts, menu paths, error text), and steps were written for card tests that only had a title. A card test that matched one already in this file was not copied again.

## Contents

1. [Feature cards](#feature-cards)
2. [Security and validation cards](#security-and-validation-cards)
3. [DevOps, tooling and docs cards](#devops-tooling-and-docs-cards)
4. [List and discussion cards (no tests)](#list-and-discussion-cards-no-tests)

---

## Feature cards

### #230 (Real Payment Feature) Integrated payment system: NEW

**Card title:** (Real Payment Feature) As an app user, I want an integrated payment system, so that transactions can happen within the app

**Card description (verbatim from the board):**

Current Implementation: Stripe connection, checkout, and refunds are built, but payments are currently disabled. When enabled, buyers pay from chat during the Payment Window and sellers can refund from the receipt.

**Tests:**

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

**Card title:** Correct Scheduled Purchase and Confirm Purchase Lifecycle States For Edge Cases

**Card description (verbatim from the board):**

Current Implementation: Chat cards show purchase requests, replies, completion, and next steps. Failed exchanges release the listing, unanswered requests can expire, and review prompts appear after successful purchases.

Add Schedule Purchase status cards.
Add Confirm Purchase status cards.
Add next-steps instructions.
Add review and buyer-rating cards.
Update button text and colors after actions are completed.
Close or disable transaction actions when an item is deleted.
Test successful, unsuccessful, expired, reviewed, and deleted-item states.

**Tests:**

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

**Test 6: The review card shows when a review is done (Happy Path)**
1. After a successful purchase as in Test 1, Buyer opens the chat. The card reads **Next Steps: Leave a Review** with a **Leave a Review** button.
2. Buyer leaves a review from that button and returns to the chat.
3. The same card now reads **Review Completed** and the button is **View Review**, which opens the review Buyer left.

### #227 Redo "View How Sellers Have Rated You" and own-review views: NEW

**Card title:** Redo "View How Sellers Have Rated You" and how you see your own reviews with the profile so it is more clear

**Card description (verbatim from the board):**

Current Implementation: How Sellers Rated You shows the feedback sellers left about your purchases. Reviews of items you sold appear separately on your profile, so this card covers making those views clearer.

**Tests:**

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

**Card title:** (Rate Buyers) As an item seller, I want to rate a buyer after a completed purchase, so that I can share feedback about the exchange.

**Card description (verbatim from the board):**

Current Implementation: Sellers can rate buyers and leave optional feedback after a completed purchase. The action is available on sold listings and through a chat reminder.

**Tests:**

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

**Card title:** (View Buyer Ratings) As a buyer, I want to view ratings and feedback sellers have left about me, so that I can understand how they experienced our purchases.

**Card description (verbatim from the board):**

Current Implementation: How Sellers Rated You shows your received ratings, feedback, seller names, and related items. Only the signed-in buyer can view their own feedback.

**Tests:**

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

**Card #263 title:** (Report Listings) As a Dorm Mart user, I want to report unsafe or misleading listings and receive the outcome, so that I can help keep the marketplace safe.

**Card #263 description (verbatim from the board):**

Current Implementation: Users can report unsafe or misleading listings with a reason and optional details. They receive a notification after a moderator reviews the report.

**Card #251 title:** Implement Listing Reports and Moderator Item Removal

**Card #251 description (verbatim from the board):**

Current Implementation: Users can report listings with a reason and details. Moderators can dismiss reports or remove the listing, with notifications for the seller and reporters.

**Tests:**

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

**Card title:** (Seller Listing Reminders) As a seller, I want a reminder when my listing gets no interest for two weeks, so that I can improve it.

**Card description (verbatim from the board):**

Current Implementation: Sellers get a reminder when an active listing is at least two weeks old and has no saves, messages, or purchase requests. Each listing receives this reminder once.

**Tests:**

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

**Card title:** (TOS + Privacy Policy Access) As an app user, I want access to the latest Terms of Service and Privacy Policy before and after login, with the option to download them, so I understand the terms of using the app.

**Card description (verbatim from the board):**

Current Implementation: Terms of Service and Privacy Policy pages are available before login and from Account Info. The current pages do not provide a download button.

**Tests:**

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

**Card title:** Combine all TOS and Privacy Policy Versions then expand and make them more thorough.

**Card description (verbatim from the board):**

Current Implementation: The legal pages use shared text for the Terms of Service and Privacy Policy. Both are available before login and from settings; this card covers reviewing and consolidating their content.

**Tests:**

**Test 1: One source of text**
1. Search the repository for older Terms or Privacy copies. Only the shared legal documents file is used by the pages.

**Test 2: Required topics are covered**
1. Read both documents. They cover accounts, listings, prohibited items, payments (including that demo payments move no money), moderation and bans, data collected, account deletion, and a support contact.

**Test 3: Pages render the full document**
1. Open both pages on a phone-width screen and in dark mode. Headings, lists, and links are readable and nothing is cut off.

### #132 (Video Uploads to chats and item listings): FILLED

**Card title:** (Video Uploads to chats & item listings) As an item seller, I want to upload videos to my chats and to my product postings, so that I can communicate detailed information about my product's quality to buyers.

**Card description (verbatim from the board):**

Current Implementation: Sellers can upload videos to listings, and buyers and sellers can send them in chat. Uploads have file-type and size checks, and listings still require a photo.

### **Notes:**
Buyers can send video in chats too. 

Check that a seller cannot upload a ew product listing while only uploading 1 video

**Tests:**

**Test 1: Verify that a seller can upload and play a valid video on a product listing (Happy Path)**
1. Log in as Seller and create a listing with at least one photo and one MP4 under 25 MB.
2. Open the listing. The video plays with sound and can be paused and scrubbed.
3. Check each control: play and pause, mute and unmute (sound is heard when unmuted), drag the seek bar back and forward, and **Toggle fullscreen** in and out.
4. The picture keeps the shape and sharpness of the original file: not stretched, cropped, or blurred.

**Test 2: Verify that a buyer or seller can upload and play a valid video in chat (Happy Path)**
1. In a chat, send an MP4 under 25 MB. Both participants can play it.
2. Repeat Test 1 steps 3 and 4 with the chat video's player.

**Test 3: Check that uploading an unsupported video file results in an error (Alternate Path)**
1. Upload a `.avi` file, and a text file renamed to `.mp4`. Both refused.
2. Upload a WebM and a MOV under 25 MB. Both accepted.

**Test 4: Check that uploading a video above the file-size limit results in an error (Alternate Path)**
1. Upload a video over 25 MB. Refused.

There is no limit on a video's length, only on its file size. The card's note about a video "greater than the max length" is covered by this check.

**Test 5: A listing still needs a photo (Alternate Path)**
1. Create a listing with one video and no photo. It is refused and asks for a photo.

**Test 6: Chat media is private (Alternate Path)**
1. Copy the address of the chat video and open it logged in as Outsider, then logged out. It is not served.

**Test 7: Chat image limit is unchanged (Alternate Path)**
1. Send an image over 2 MB in chat. It is refused.

### #164 (Algorithmic For You Page): FILLED

**Card title:** (Algorithmic For You Page) As a buyer, I want to be able to see a customized and optimized for you page based off my user behavior, so that I can view products that I am most likely to engage with.

**Card description (verbatim from the board):**

Current Implementation: For You uses chosen interests and activity such as views, saves, and purchases. New users receive popular or recent listings, while Explore More offers a randomized mix.

### **Notes:**

- We could keep the filter-based "for you" page as well, but the term for you implies an algorithmic and focused feed due to TikTok.

**Tests:**

**Test 1: Verify that the For You page displays listings related to the buyer's interests and activity (Happy Path)**
1. Log in with a new account and choose two interest categories.
2. Open For You. Most listings shown are in those categories.

**Test 2: Verify that the For You page updates after the buyer interacts with a different product category (Happy Path)**
1. View and save several listings in a category you did not choose.
2. Reload For You. Listings from that category now appear.

**Test 3: Check that a buyer with no activity receives clear instructions instead of an empty or broken page (Alternate Path)**
1. Log in with an account that has no interests or activity.
2. For You shows popular or recent listings, not an empty page.

**Test 4: Check that sold or inactive listings do not appear on the For You page (Alternate Path)**
1. Log in as Seller. None of Seller's own listings appear in For You.
2. Sold and removed listings do not appear.

**Test 5: Explore More gives a different mix (Happy Path)**
1. Open Explore More twice. The selection changes between loads.

### #161 (Promotional Emails): FILLED

**Card title:** (Promotional Emails) As an app user, I want to recieve promotional emails, so that I can view items that might interest me to buy and click on them within the email for streamlined access.

**Card description (verbatim from the board):**

Current Implementation: Users can choose daily, weekly, or no promotional emails. The sending script and Railway schedule are configured in the repository; delivery depends on the deployed email service and scheduled job.

### **Notes:**

- Right now, the checkmark for emails in user preferences is purely frontend

**Tests:**

**Test 1: Verify that a user who enables promotional emails receives a promotional email (Happy Path)**
1. In User Preferences, set promotional emails to daily and save.
2. Run the promotional email script locally. An email is produced for that user with listing links.

**Test 2: Verify that clicking an item in a promotional email opens the correct Dorm Mart listing (Happy Path)**
1. Click a listing in the email. It opens that listing in the app, after login if needed.

**Test 3: Check that a user who disables promotional emails does not receive promotional emails (Alternate Path)**
1. Set promotional emails to off and run the script again. No email is produced for that user.

**Test 4: Check that a promotional email does not direct the user to a listing that is no longer available (Alternate Path)**
1. Mark a listing sold, run the script. It is not in the email.

**Test 5: One-click unsubscribe (Happy Path)**
1. Click the unsubscribe link in a digest. A confirmation page appears and the preference is now off.
2. Change one character of the link and open it. It is refused and the preference does not change.

**Test 6: Weekly is not sent daily (Alternate Path)**
1. Set weekly, run the script on two consecutive days. Only one email is produced.

### #163 (About Us Page): HAS STEPS, add

**Card title:** (About Us Page) As an app user, I want to view a page that shows the names , pictures, and contact information about the developers, so that I can easily reach out and give contact information to them.

**Card description (verbatim from the board):**

Current Implementation: About Us shows Sameer, Anish, and Chris with photos, contribution summaries, and contact links. The page also handles missing photos.

The About Us page will be a meet-the-team page that exists in settings. It is going to have a photo of me, Anish, and Chris, as well as a photo of each of us. There are going to be buttons for directly contacting our email address, as well as our LinkedIn accounts and any other social media accounts. We can also have stuff like Twitter handles, and then information about us on what we did and the stuff we like. A good example is the slippi about us; it could tell us what we did in the photos that will exist in the codebase. 

Reference: https://slippi.gg/about

**Tests:**

**Test 1: Verify that the About Us page displays each developer's name, picture, and contact information (Happy Path)**
1. Log in and open Settings > About Us.
2. There is one card each for Sameer Jain, Anish Banerjee, and Chris (Sooseok) Kim.
3. Each card has a photo, a summary of what that person built, their email address, and **Email**, **LinkedIn**, and **GitHub** links.

**Test 2: Verify that each contact link opens the correct contact destination (Happy Path)**
1. Each email link opens a mail draft to the right address. Each external link opens in a new tab.

**Test 3: Check that all About Us information remains visible and readable on a mobile screen (Alternate Path)**
1. Open About Us at 375 px wide (browser device mode, or a phone).
2. The cards stack in one column. Photos, text, and links are all visible, nothing is cut off, and the page does not scroll sideways.
3. Switch to dark mode. All text stays readable.

**Extra Test: Missing photo**
1. Rename one developer photo file locally and open About Us. A placeholder shows and the layout is intact.

### #142 (Moderator User with Mod Tools): HAS STEPS, add

**Card title:** (Moderator User with Mod Tools) As a Dorm Mart Moderator, I want to login to a special account with moderation features and unique pages, so that I can view access to ban and report features to keep the platform safe.

**Card description (verbatim from the board):**

Current Implementation: Moderators can review message and listing reports, remove listings, ban users, and manage blocked words. Listing removal tells the seller why it happened and notifies the reporters.

**Implemented so far:**

- Moderator accounts can open the Safety dashboard from the navigation menu. Regular users cannot access the page or its tools.
- The dashboard shows flagged messages, open/total reports, and banned user counts, with links to TOS and Privacy Policy.
- Users can report chat messages. Moderators can read the message and report reason, then Resolve or Dismiss the report.
- Moderators can ban/unban users from reports or flagged messages. Banning invalidates their sessions; moderator accounts cannot be banned here.
- Moderators can add/remove profanity words. Chat filters matching words, while the dashboard shows the uncensored flagged messages.

Still needs testing for reporting, bans, and regular-user access restrictions.

**Notes:** 

- Create a Moderator User with unique pages and features, can see stats on reported issues, ban ability, and access to TOS/Privacy Policy.

**Tests:**

**Test 1: A moderator can read the Terms of Service and Privacy Policy (Happy Path)**
1. Log in as Moderator and open the Safety dashboard from the navigation menu.
2. Click **Privacy Policy**, then go back and click **Terms of Service**.
3. Both documents open in full.
4. Read both. They describe what personal data is collected and how it is used, and nothing in them allows the data to be used against users.

**Test 2: Verify that a moderator can review a report and use the available moderation tools (Happy Path)**
1. Log in as Buyer, open a chat with Outsider, open the options on one of Outsider's messages, choose **Report message**, give a reason, and send.
2. Log in as Moderator and open the Safety dashboard. The report is listed with the message text and the reason, and the open-report count went up by one.
3. Press **Resolve**. The report leaves the open list and the count goes down by one.
4. From the same report, ban Outsider and confirm **Ban this user?** with **Ban**. The banned-users count goes up by one.
5. Unban Outsider the same way. The count goes back down.
6. Add a word to the blocked-word list and remove it again. The list updates each time.

**Test 3: Check that a regular user cannot access moderator pages or moderation tools (Alternate Path)**
1. Log in as Buyer and open the Safety dashboard address directly. It is refused or redirected.
2. Send each moderator request (ban, clear flag, resolve report, blocked words) directly as Buyer. Each is refused.

**Extra Test: A ban signs the user out**
1. Log in as Outsider in one browser. As Moderator, ban Outsider.
2. Outsider's next action sends them to login, and logging in is refused.

**Extra Test: A moderator cannot ban a moderator or themselves**
1. Try both. Each is refused.

### #169 (Chat Profanity Filter): HAS STEPS, add

**Card title:** (Chat Profanity Filter) As a chat user, I want chat messages that contain offensive language to be flagged, so that I see stars instead of the actual word on the chat page.

**Card description (verbatim from the board):**

Current Implementation: Messages are checked against the blocked-word list when sent or edited, and matching words appear as stars. Moderators can see the original text and maintain the list.

The Chat Profanity Filter automatically detects and censors offensive language — including racial slurs, profanity, and other harmful terms — in real time as messages are sent. Flagged words are replaced with asterisks matching the word's character length (e.g., "hell" → "\*\*\*\*"), so the sentence structure remains readable while the offensive content is obscured.

The filter operates at the display layer: the original message is preserved in the database, but censored when rendered for general users. This allows the moderation system to function on top of the filter — moderators have access to a view that surfaces the original, uncensored messages alongside metadata (which user sent it, in which chat, and at what time), enabling them to take further action such as warnings or bans.

**Scope:**

*   Racial slurs, curses, and other offensive language
    
*   Censorship displayed as stars proportional to word length
    
*   Moderation dashboard integration: mods see raw messages with user/location context

**Package recommendation:** Skip a third-party PHP library — there aren't great maintained ones, and your use case is simple enough that a custom PHP helper (~20 lines) querying the DB table is the right call. For seeding the initial word list, pull the curated list from the bad-words npm package (JavaScript) as a one-time data source to populate your profanity\_words table. After that, the DB owns the list.

**Implementation spec:**

**Database:** Add a profanity\_words table — just word VARCHAR(100) PRIMARY KEY. Add an is\_flagged TINYINT(1) DEFAULT 0 column to the existing messages table.

**On message send** (create\_message.php): Run profanity detection against the raw content before insert. If any word matches, set is\_flagged = 1 on the row. The raw content is always what gets stored — never censor what's in the DB.

**On message fetch** (fetch\_new\_messages.php, fetch\_conversation.php, fetch\_conversations.php): Apply a filter to the content field before returning it in the JSON response. The filter loads the word list from the DB (cache it in a PHP static variable so it's only queried once per request), then replaces each matched word with stars of the same length using a case-insensitive regex. Non-mod users always get the filtered version.

**Mod access:** Mods get a separate endpoint (or a ?raw=1 param gated behind a role check) that returns content unfiltered. The mod view surfaces messages where is\_flagged = 1 with the sender ID, conversation ID, and timestamp already on the messages row — no extra joins needed for the core moderation display.

**Word list management:** A simple admin-only API endpoint to INSERT/DELETE from profanity\_words. The mod panel can have a basic UI for this — same place mods review flagged messages.

**Tests:**

Pick a test word from the blocked-word list (the moderator dashboard, or the `profanity_words` table).

**Test 1: Verify that an offensive word in a chat message is replaced with stars (Happy Path)**
1. Log in as Buyer and send Seller a message that contains the test word.
2. Buyer and Seller both see the word as stars, one star per letter. The rest of the sentence is unchanged.

**Test 2: Verify that a chat message without offensive language is displayed without changes (Happy Path)**
1. Send a message with no blocked words.
2. Both users see it exactly as typed, and it does not appear among the moderator's flagged messages.

**Test 3: Check that capitalization and punctuation do not allow an offensive word to bypass the filter (Alternate Path)**
1. Send the test word in capitals, with a `!` after it, with dots between its letters, and with look-alike characters (`1` for `i`, `$` for `s`, `0` for `o`), one message each.
2. Each one is starred.
3. Known gap: a star typed in place of a letter is not caught. Note it on the card if it matters.

**Test 4: Check that filtering one word does not hide the allowed words in the same message (Alternate Path)**
1. Send a sentence with the test word in the middle of several normal words.
2. Only the test word is starred. Every other word can be read.

**Test 5: Verify that an edited chat message is checked by the profanity filter again (Happy Path)**
1. Send a clean message, then edit it to include a blocked word. The saved message shows stars.

**Extra Test: Words inside other words are not censored**
1. Send a normal word that contains a blocked word as a fragment (for example "class"). It is not starred.

**Extra Test: Only moderators see the original text**
1. As a participant, the starred text is all you can see, including in the page's network responses.

### #139 (Edit Last Sent Message): HAS STEPS, add

**Card title:** (Edit Last Sent Message In Chat) As a chat user, I want to quickly edit the last message I sent in a chat, so that if there is a typo I can correct it.

**Card description (verbatim from the board):**

Current Implementation: You can edit your latest eligible text message from its chat menu. Both participants see the saved text and an edited label.

**Tests:**

The card's tests point at a personal Postman workspace (Chris Kim's). They are kept here as API tests, followed by the same checks in the UI.

Every request goes to `api/chat/edit_last_message.php` with `message_id`, `content`, and `csrf_token` in the JSON body, from a logged-in session. Get the token from `api/auth/get_csrf_token.php` first. Without it the server answers `CSRF token validation failed` (403) before any check below, so the old saved requests fail until they send it. The expected messages are the server's current wording, which changed since the card was written.

**Test 1 - success when a valid message is sent**
1. Open Postman (the desktop app) and open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-2bfdf105-c2c6-4370-8c36-216dbf2f8cd0
2. Send the **updating-message** request for your latest text message.
3. The response has `"success": true` and the new text.

**Test 2 - finds bug if message exceeds 500 characters**
1. Open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-ee053ae8-387b-403f-bfde-77ae42005796
2. Send the **updating-message-exceeding-500** request.
3. You receive `Message cannot exceed 500 characters` (400).

**Test 3 - finds bug if request contains no message content**
1. Open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-c2158fc7-42d4-49f3-b250-21ffe3d12453
2. Send the **updating-message-without-content** request.
3. You receive `Message cannot be empty` (400).

**Test 4 - finds bug if message sender is not authenticated**
1. Open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-731cf3eb-d416-4be2-9f6d-a99e20d31048
2. Send the **updating-message-unauthenticated** request.
3. You receive `Not authenticated` (401).

**Test 5 - finds bug if message doesn't exist**
1. Open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-6c1b21d8-3603-450d-bac7-f4244d43085c
2. Send the **updating-message-doesnt-exist** request.
3. You receive `Message not found` (404).

**Test 6: Verify that a user can edit their last sent chat message and see the updated text (Happy Path)**
1. Send a text message, open its menu, choose edit, change the text, and save.
2. Both users see the new text with an edited label.

**Test 7: Check that logging out and logging back in will show the updated message**
1. Edit your latest message as in Test 6.
2. Log out, log back in, and open the same chat.
3. The message shows the edited text and the edited label. Log in as the other user: they see the same.

**Test 8: Check that a user cannot edit a chat message sent by another user (Alternate Path)**
1. The other user's messages have no edit option.
2. After you send a second message, the first one can no longer be edited.

**Extra Test: Limits (Alternate Path)**
1. Save an empty edit. Refused.
2. Save 501 characters. Refused with the 500 character message.

### #126 (Delete Individual Message): HAS STEPS, add

**Card title:** (Delete Individual Message) Implement Delete Individual Chat Message Backend API

**Card description (verbatim from the board):**

Current Implementation: You can delete your latest eligible sent message after confirmation. Both participants see a deleted-message note, and unread counts are updated.

**Tests:**

The card's tests point at a personal Postman workspace (Chris Kim's). They are kept here as API tests, followed by the same checks in the UI.

Every request goes to `api/chat/delete_message.php` with `message_id` and `csrf_token` in the JSON body, from a logged-in session. Get the token from `api/auth/get_csrf_token.php` first; without it the server answers `CSRF token validation failed` (403). The card numbered two tests "Test 2"; they are Tests 2 and 3 here.

**Test 1 - success when the user is authenticated**
1. Open Postman (the desktop app) and open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-3126b56d-cbb1-4e53-837c-bac488630411
2. Send the **deleting-message** request for your latest text message.
3. The response has `"success": true` and `"message": "success"`.

**Test 2 - finds bug if the user is not authenticated**
1. Open https://hello-its-sooseok-2166365.postman.co/workspace/Chris-Kim's-Workspace~5b86f3f0-c563-4d00-89df-701ce22b6fb1/request/48975015-1ccbe1b0-3c13-457f-a40e-1add7fe2f341
2. Send the **deleting-message-unauthenticated** request.
3. You receive `Not authenticated` (401).

**Test 3 - finds bug if the message ID doesn't exist**
1. In the same workspace, open the **deleting-invalid-message** request. (The card links it to the same address as Test 2, so find it by name.)
2. Send it.
3. You receive `message ID doesn't exist` (404).

**Test 4: Verify that an authenticated user can delete their own individual chat message (Happy Path)**
1. Send a message, choose delete, and confirm. Both users see a deleted-message note.

**Test 5: Check that a user cannot delete an individual chat message sent by another user (Alternate Path)**
1. Send the delete request for the other user's message id directly. It is refused.

**Extra Test: Unread count is corrected (Alternate Path)**
1. Send a message the other user has not read, then delete it. Their unread badge does not count it.

### #134 (Logged Devices Manager/History): FILLED

**Card title:** (Logged Devices Manager/History) As an app user, I want to view what devices have logged into my account and from where, so that I can identify if someone is malicously using my account.

**Card description (verbatim from the board):**

Current Implementation: Logged Devices shows sign-in devices, times, and approximate locations, and the app recognizes new devices for alerts. Changing your password signs out other sessions.

### **Notes:**

- View Figma Pages for this view

**Tests:**

**Test 1: Verify that the Logged Devices page displays the devices that have logged into the user's account (Happy Path)**
1. Log in and open Settings > Logged Devices. The current device is listed and marked as this device.

**Test 2: Verify that each login record displays the correct device, location, and login time (Happy Path)**
1. The entry shows the browser and system, an approximate location (or "local" on a dev machine), and a login time that matches when you logged in.

**Test 3: Check that a newly used device appears in the login history (Happy Path)**
1. Log in from a second browser. Reload the page in the first. The second device is listed.

**Test 4: Check that a user cannot view another user's logged-device history (Alternate Path)**
1. Log in as Outsider and request the device history. Only Outsider's devices are returned, whatever user id is sent.

**Test 5: Changing the password signs out other devices (Alternate Path)**
1. With two browsers logged in to a non-seed account, change the password in one.
2. The other is sent to login on its next action.

### #131 (Account Info Page): FILLED

**Card title:** (Account Info Page) As a user, I want to view my account info page in settings, so that I can see my accounts first/last name, graduation date, and other information tied to the account, as well as buttons to view Privacy Policy/TOS.

**Card description (verbatim from the board):**

Current Implementation: Account Info shows your name, email, graduation date, account creation date, and saved phone number. It also links to the Terms of Service and Privacy Policy.

**Tests:**

**Test 1: Verify that the Account Info page displays the user's correct account information (Happy Path)**
1. Log in and open Settings > Account Info. Name, email, graduation date, account creation date, and phone number match the account.

**Test 2: Verify that the Terms of Service button opens the Terms of Service document (Happy Path)**
1. On Account Info, press the Terms of Service button. It opens the Terms.

**Test 3: Verify that the Privacy Policy button opens the Privacy Policy document (Happy Path)**
1. On Account Info, press the Privacy Policy button. It opens the Privacy Policy.

**Test 4: Check that a user who is not logged in cannot view account information (Alternate Path)**
1. Log out and open the page's address. You are sent to login. The account info request returns no data.

**Test 5: No sensitive fields are returned (Alternate Path)**
1. In the browser's network tab, the account info response has no password hash, reset token, or session data.

### #168 (Delete Entire Account): HAS STEPS, add

**Card title:** (Delete Entire Account) As a user, I want to be able to go into the settings section and delete my account, so that none of the information about the account is saved anywhere.

**Card description (verbatim from the board):**

Current Implementation: Account deletion asks for your password and confirmation, then removes your account and listings. Shared records needed by the other participant are kept with your identity removed.

**General Description & Spec:**

Account deletion performs a true hard delete — the user's row in user\_accounts is permanently removed. Because other tables reference the deleted user's ID as a foreign key, records that belong to other users (purchase history, scheduled purchases, chat messages) must be handled before the row is dropped. Everything owned solely by the deleted user is destroyed outright.

**Confirmation UI:**

A multi-step modal in the settings page. The first screen shows a plain-language list of consequences: listings will be removed, active chats will be closed, wishlisted items will be removed, and the account cannot be recovered. The second screen requires two checks before the confirm button activates — the user must type DELETE MY ACCOUNT exactly into a text field, and must enter their current password. Both must pass before the request is sent.

**Test Account Guard:**

Add is\_protected TINYINT(1) NOT NULL DEFAULT 0 to user\_accounts. The delete endpoint checks this column first and rejects immediately if it is set. This replaces and generalizes the hardcoded testuser@buffalo.edu check currently in change\_password.php — that file should be updated to use this column as well.

To keep the guard dynamic as new seed files are added over time, write a standalone maintenance script (protect\_test\_accounts.php) that scans every file in data/\*.sql, extracts all email addresses using a regex, and runs a single UPDATE user\_accounts SET is\_protected = 1 WHERE email IN (...) for the full list. This script is re-run as part of DB setup or whenever a new seed file is added — no manual is\_protected = 1 needed in individual seed files, and no hardcoded list in application code. The runtime check remains a single column lookup.

**Backend deletion sequence:**

**1\. Guard check** — load the requesting user's is\_protected flag. Reject with a generic error if set.

**2\. Close all listings and their associated chats** — for each product owned by the user, run the same pattern as delete\_listing.php: find all conversations linked to that product, insert a system message into each with metadata.type = "account\_deleted" and copy: _"This user's account has been deleted. This chat has been closed."_, set item\_deleted = TRUE on those conversations, then hard delete the listing from inventory.

**3\. Wishlist notifications** — for each of the deleted user's listings that appear in any other user's wishlist, send that user a notification that the item has been removed. Then delete all wishlist entries referencing those products. Also delete any wishlist entries the deleted user themselves had saved.

**4\. Preserve the other user's purchase and scheduled purchase history** — do not touch these tables. The records belong to the counterparty, not the deleted user. Optionally null out the deleted user's name fields in those rows for consistency, but the records themselves stay intact.

**5\. Anonymize the deleted user's presence in shared records** — before dropping the row, update tables that reference the user but must be kept for other participants:

*   In messages: set sender\_fname = "Deleted User", null out sender\_id where it matches. Message content is preserved since it belongs to the other participant's conversation history.
    
*   In any purchase or scheduled purchase columns that reference the deleted user's ID: null those fields out so the FK constraint is satisfied on row deletion.
    

**6\. Delete owned records** — hard delete conversation\_participants entries for this user, typing\_status entries, password reset tokens, session records, profile/preference rows, and anything else solely owned by this user.

**7\. Delete the user row** — DELETE FROM user\_accounts WHERE user\_id = ?. All FK references have been nulled in prior steps so this completes cleanly.

**8\. Destroy session** — same pattern as change\_password.php: regenerate session ID, destroy session, clear auth cookies. Client redirects to the home/login page.

**Tests:**

Seed accounts cannot be deleted, so Tests 1-3 and 5 use an account you create first. The card says the user types `DELETE MY ACCOUNT`; the app asks for the account's email address instead.

**Test 1: Verify that a user can permanently delete their account and can no longer log in (Happy Path)**
1. Create an account and log in with it.
2. Open Settings > Delete Account and press **Delete my account**.
3. The first screen lists what will happen: listings removed, active chats closed, wishlisted items removed, and the account cannot be recovered. Press **Continue** once its countdown ends.
4. Type the account's email address and current password, then press **Delete my account** once its countdown ends.
5. You are signed out. Logging in with that email and password is refused.

**Test 2: Verify that canceling the delete-account confirmation keeps the account active (Alternate Path)**
1. Start as in Test 1 and press **Cancel** on the first screen.
2. Start again, go to the second screen, and close it without pressing **Delete my account**.
3. You are still logged in, and after logging out you can log in again with the same password.

**Test 3: Check that entering incorrect confirmation information prevents the account from being deleted (Alternate Path)**
1. On the second screen, type an email address that is not the account's, and the correct password.
2. **Delete my account** stays disabled.
3. If the request is sent directly with the wrong email, it is refused with `Invalid account deletion confirmation`. (A wrong password is the first extra test below.)

**Test 4: Check that a protected test account cannot be deleted (Alternate Path)**
1. Try to delete a seed account. It is refused.

**Test 5: Verify that deleted account information is no longer visible elsewhere in Dorm Mart (Happy Path)**
1. Before deleting, give the new account a listing, and have Buyer save that listing and message the account about it.
2. Delete the account as in Test 1.
3. The listing is gone from search and from Buyer's wishlist, and Buyer has a notification that it was removed because the seller deleted their account.
4. Buyer's chat shows the other person as **Deleted User** and the message "This user's account has been deleted. This chat has been closed."

**Extra Test: Wrong password**
1. Enter a wrong password in the delete dialog. Nothing is deleted.

**Extra Test: Open purchases**
1. With an accepted Schedule Purchase in progress, delete the account. The other user's chat shows the purchase is no longer available and no action is left enabled.

### #128 (Two Factor Auth via Email): HAS STEPS, add

**Card title:** (Two Factor Auth Via Email - 2FA) As a user, I want to enable two-factor authentication so that I see another security question every time I login

**Card description (verbatim from the board):**

Current Implementation: You can enable or disable email-based two-factor authentication in settings. When enabled, sign-in requires a temporary emailed code after your password.

**Tests:**

The card's tests were written for codes sent by text to a phone, on the old cattle server, with accounts that no seed file creates. Codes now go to the account's email, and seed accounts cannot turn 2FA on, so create an account for Tests 1-4. Their pass and fail checks are kept, updated to the current screens.

**Test 1: Ensure Enabling Two Factor Authentication is functional (Happy Path)**
1. Log in with the account you created and open Settings > Two-Factor Authentication. Status says **Disabled**.
2. Press **Enable 2FA**. The dialog **Enable email verification?** appears. Press **Confirm**.
3. Expected:
   - The message **Two-Factor Authentication Enabled Successfully.** appears.
   - Status says **Enabled** and the button changes to **Disable 2FA**.
   - A confirmation email arrives at the account's address.
4. Fails if 2FA is not enabled, no message appears, the button does not change, or no email arrives.

**Test 2: Test logging in with 2 factor authentication (Happy Path)**
1. With 2FA on from Test 1, log out and log in with the same email and password.
2. Instead of logging in, the page asks for the one-time passcode sent to your email, with a **Verification code** box.
3. Enter the code from the email and press **Verify**.
4. Expected: you are logged in and taken into the app.
5. Fails if no code step appears, a valid code is refused, or the page loops back to login or shows an error.

**Test 3: Ensure Disabling Two Factor Authentication is functional (Happy Path)**
1. Open Settings > Two-Factor Authentication and press **Disable 2FA**.
2. The dialog **Confirm your password** appears. Enter the current password and press **Confirm**.
3. Expected:
   - The message **Two-Factor Authentication Disabled Successfully.** appears.
   - Status says **Disabled** and the button changes back to **Enable 2FA**.
   - The next login asks for no code.
4. Fails if 2FA stays on, no message appears, the button does not change, or a login still asks for a code.

**Test 4: Test Disabling Two Factor Authentication when it is already Implemented Results in an error (Alternate Path)**
1. Turn 2FA on, then open Settings > Two-Factor Authentication in two tabs.
2. In the first tab, disable 2FA as in Test 3.
3. In the second tab (still showing **Disable 2FA**), press it, enter the password, and press **Confirm**.
4. Expected: the error **Two-Factor Authentication is not enabled for this account.** appears and nothing changes.
5. Fails if the request goes through anyway, or the page shows an unhandled error or goes blank.

**Test 5: A shared demo account cannot turn 2FA on (Alternate Path)**
1. The card's Test 5 ("Test Trying to Enable 2FA without having a phone number tied to the account results in an error") checked that 2FA needs a phone number on file. Codes now go by email, so no phone number is needed and that check no longer exists. This test covers the rule that replaced it.
2. Log in as Buyer (a seed account), open Settings > Two-Factor Authentication, press **Enable 2FA**, and press **Confirm**.
3. Expected: the error **Two-Factor Authentication can't be turned on for this shared demo account.** appears and Status stays **Disabled**.

**Extra Test: Wrong and expired codes**
1. Enter a wrong code. Login is refused and repeated tries are limited.
2. Wait past the code's expiry and enter it. Refused; a new code can be requested.

**Extra Test: A code cannot be reused**
1. Log in with a code, log out, and try the same code again. Refused.

### #127 (Buyer Side Notifications): HAS STEPS, add

**Card title:** (Buyer Side Notifications) As a UB student buyer, I want to get a notification, so that I can see the notification on the notifications page.

**Card description (verbatim from the board):**

Current Implementation: Notifications cover saved items, purchases, reviews, reports, and account activity. You can open them, mark them read, delete one, or clear all.

**Tests:**

The card's tests used `testusernotification@buffalo.edu`, `testuser@buffalo.edu`, and a rubber duck, SpongeBob DVD, and golden egg listing, none of which the seed files create any more. They use Seller's seeded **Britta Filter Box** ($25) and **TECKNET Red Mouse** ($15) here, with Buyer as the one saving them. Neither is on Buyer's wishlist after a fresh `migrate_data.php`.

**Test 1: Test that a notification can be received for deleting the item**
1. Log in as Buyer, add **Britta Filter Box** to your wishlist, and log out.
2. Log in as Seller, delete **Britta Filter Box** from the Seller Dashboard, and log out.
3. Log in as Buyer and open Notifications. There is one saying "Britta Filter Box was deleted and is no longer available."

**Test 2: Test that no notification is received if a product is not in your wishlist**
1. Make sure **TECKNET Red Mouse** is not on Buyer's wishlist.
2. Log in as Seller, change the mouse's price, save, and log out.
3. Log in as Buyer. There is no notification about the mouse.

**Test 3: Test that a notification can be received for a price reduction**
1. Log in as Buyer, add **TECKNET Red Mouse** to your wishlist, and log out.
2. Log in as Seller, edit the mouse, lower the price to $10, save, and log out.
3. Log in as Buyer. There is a notification for the mouse saying "Price reduced from $15.00 to $10.00."

**Test 4: Test that a notification can be received when an item is sold**
1. With the mouse still on Buyer's wishlist, log in as Seller, mark **TECKNET Red Mouse** as sold, and log out.
2. Log in as Buyer. There is a notification saying "TECKNET Red Mouse has been sold."

**Test 5: that clicking a notification takes you to the individual item card**
1. Run `migrate_data.php` again to restore the listings, then repeat Test 3 so Buyer has a price notification for the mouse.
2. As Buyer, click that notification. The **TECKNET Red Mouse** listing page opens.

**Test 6: Test that a notification can be deleted from the notifications page**
1. Delete one notification. Only that one is removed. Press clear all. The list is empty and the badge is zero.

**Test 7: Verify that clicking an available notification opens the correct listing (Happy Path)**
1. This is the same check as Test 5: the listing that opens is the one the notification names.

**Test 8: Check that opening a notification for an unavailable listing displays a clear message (Alternate Path)**
1. Open a notification whose listing was deleted. You get a clear "no longer available" page.

**Extra Test: You cannot delete another user's notification**
1. Send the delete request with a notification id that belongs to another user. Nothing is deleted.

### #143 (Investor safety data): HAS STEPS, replace

**Card title:** As an interested investor, I want to view data on the site’s reported safety issues moderation output, so that I know I am investing in a law abiding platform that prioritizes user safety.

**Card description (verbatim from the board):**

Current Implementation: The app has a public Safety page that needs no login. It shows report totals, moderator response times, removals, and bans without sharing names or report contents.

**Tests:**

The card describes an investor login that does not exist. The page is public:

**Test 1: The Safety page needs no login (Happy Path)**
1. Log out and open the public Safety page. It shows report totals, how many were resolved, removed, or dismissed, moderator response time, and ban counts.

**Test 2: The page breaks the numbers down by kind (Happy Path)**
1. Open the Safety page logged out.
2. Message reports show reports received, action taken, and no violation found. Listing reports show reports received, listings removed, and no violation found.
3. It also shows the most common listing report reasons with a count for each, messages flagged by the language filter, accounts currently banned, reports waiting for review, and the average time to a moderator decision.
4. Report one message and one listing, have Moderator act on both, and reload. Each number moves the way it should.

**Test 3: Verify that an investor can view summarized moderation and safety statistics without seeing personal user information (Happy Path)**
1. In the network tab, the response has only counts and averages: no names, emails, message text, listing titles, or ids.

**Test 4: Check that an investor cannot open private details from an individual user report (Alternate Path)**
1. On the Safety page, no number, reason, or row links to a report, user, message, or listing.
2. Logged out, open the moderator dashboard address (`#/app/moderation`). You are sent to login, not shown any report.

**Extra Test: Numbers match the moderator dashboard (Happy Path)**
1. File one new listing report. The open-report total rises by one on both the Safety page and the moderator dashboard.

The card's Tests 1 and 2 had no names; Tests 1 and 2 here cover what their steps checked, on the public page in place of an investor login.

### #211 (UI/UX Polish and Minor Changes): NEW

**Card title:** (UI/UX Polish+Minor Changes) As a Dorm Mart user, I want a consistent, responsive, and polished experience across the application, so that every feature feels complete and easy to use

**Card description (verbatim from the board):**

Current Implementation: Shared controls, mobile layouts, dark-mode styles, and clearer purchase messages are already in place. This card covers the remaining consistency and usability checks.

**Tests:**

**Test 1: Phone, tablet, desktop**
1. Open home, search, a listing, chat, seller dashboard, and settings at 375 px, 768 px, and 1280 px wide. Nothing overflows sideways and every button is reachable.

**Test 2: Dark mode**
1. Switch to dark mode and repeat Test 1. No white panels, invisible text, or unreadable badges.

**Test 3: Consistent controls**
1. Primary buttons, inputs, and error messages look the same on every form.

**Test 4: Loading and empty states**
1. With an empty wishlist, no chats, and no listings, each page shows a helpful message.

### #229 Achieve WCAG Accessibility Full Completion: NEW

**Card title:** Achieve WCAG Accessibility Full Completion

**Card description (verbatim from the board):**

Current Implementation: The app has labeled controls, keyboard focus styles, and some keyboard support. A complete accessibility check across all pages still needs to be done.

**Tests:**

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

**Card title:** Add create account rate limiting

**Card description (verbatim from the board):**

Current Implementation: Account creation limits repeated attempts from the same client before checking the email address. Users who reach the limit must wait before trying again.

**Tests:**

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

**Card title:** CSRF Enforcement

**Card description (verbatim from the board):**

Current Implementation: The app uses a session token to protect requests that change data, and the frontend sends it through shared helpers. This card covers checking protection across the remaining endpoints.

**Tests:**

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

**Card title:** fix all backend and frontend input validation gaps

**Card description (verbatim from the board):**

Current Implementation: Forms and server endpoints check required fields, prices, dates, and uploaded files. Shared checks reject invalid values, but the remaining forms still need a complete review.

**Tests:**

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

**Card title:** Update Dark Theme, XSS/SQL And Other End Of Sprint Checks

**Card description (verbatim from the board):**

Current Implementation: Dark mode is used across the app, and the code includes protection and tests for unsafe text and database inputs. This card covers the remaining visual and security checks.

**Tests:**

**Test 1: Script text is shown as text**
1. Put `<script>alert(1)</script>` and `<img src=x onerror=alert(1)>` in a listing title, description, chat message, review, and profile bio. Each displays as plain text and no alert appears, including in notifications and emails.

**Test 2: SQL-looking input is harmless**
1. Search for `' OR '1'='1` and `"; DROP TABLE user_accounts; --`. Search returns normal results or none, and the app keeps working.
2. Use the same text as a login email. Login is refused normally.

**Test 3: Dark theme**
1. Walk every page in dark mode, including dialogs, receipts, and the payment dialog. No unreadable text.

**Test 4: Automated**
1. Run `npm run test:backend:integration` with local MySQL running. `input_fuzz_test.php` sends script and SQL text to every endpoint. All pass.

### #221 Setup and fix any "Security and Quality" issues: NEW

**Card title:** Setup and Fix Any "Security and Quality" Issues

**Card description (verbatim from the board):**

Current Implementation: The app checks sessions, permissions, requests, uploads, and server paths, and GitHub has CodeQL enabled. Password changes and bans invalidate existing sessions.

**Tests:**

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

**Card title:** Verify Password Reset Email Delivery, Expired Links, and Password Changes

**Card description (verbatim from the board):**

Current Implementation: Password reset uses emailed links with dedicated, expiring tokens. The reset pages and email guidance are in place; this card covers rechecking delivery and the full reset flow.

- Current progress: Reset password token handling and email guidance have been updated. Recheck delivery, expired links, and changing the password.

**Tests:**

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

**Card title:** Setup New Free Emailer Service For Railway and Update Code

**Card description (verbatim from the board):**

Current Implementation: Email sending uses Resend with an SMTP fallback, and setup instructions are in the repository. Account, password, and security emails share templates.

Currently emails use resend

**Tests:**

**Test 1: Check that create account works via namecheap and railway on a non-ub email**
1. On the deployed site, create an account with a non-UB email. The welcome email with the temporary password arrives.

**Test 2: Fallback (Alternate Path)**
1. With the Resend key unset and SMTP configured locally, trigger a reset email. It is sent through SMTP.

**Test 3: No mail configuration (Alternate Path)**
1. With no mail settings, trigger an email. The app reports a clear failure and does not crash.

**Test 4: Shared template**
1. Compare the welcome, reset, two-factor, and security emails. Same header, footer, and support address.

### #234 Configure the Dorm Mart support email: NEW

**Card title:** Configure the Dorm Mart Support Email and Document the Support Process

**Card description (verbatim from the board):**

Current Implementation: Emails can show a configured support address. Mailbox access and the support process are handled outside the app and still need documenting.

Finish creating or configuring the support mailbox.
Configure the production SUPPORT_EMAIL value.
Store credentials in an approved private password manager.
Document who can access the mailbox.
Document the support and moderation workflow.
Verify transactional email templates display the correct address.

**Tests:**

**Test 1: The address appears in emails**
1. Set `SUPPORT_EMAIL` and trigger a reset email. The footer shows that address.

**Test 2: Mail to the address is received**
1. Send a message to the support address from an outside account. It arrives in the support mailbox.

**Test 3: Process is documented**
1. The repository docs say who can access the mailbox, where the credentials are stored, and how a support or moderation request is handled.

---

## DevOps, tooling and docs cards

### #145 Setup Railway Deployment System and #253 Set Up Local Railway Deployment: NEW

**Card #145 title:** Setup Railway Deployment System

**Card #145 description (verbatim from the board):**

Current Implementation: Railway uses an Apache/PHP Docker container and runs schema sync before deployment. The code supports configured upload storage, which still needs checking across redeploys.

**Card #253 title:** Set Up Local Railway Deployment

**Card #253 description (verbatim from the board):**

Current Implementation: Railway runs the app in an Apache/PHP Docker container, with schema sync before deployment. Local development currently starts React and PHP separately.

**Tests:**

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

**Card title:** Improve Data Migrations and Migrate Schema work and document it

**Card description (verbatim from the board):**

Current Implementation: Schema sync compares the table definitions with the database and applies the differences. Separate local scripts reset sample accounts and their data while preserving other users' records.

**Tests:**

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

**Card #213 title:** Revamp Deployment Scripts

**Card #213 description (verbatim from the board):**

Current Implementation: Windows scripts cover local development and deployment, and Mac commands and a shell build script also exist. The workflows across operating systems still need checking together.

- Recheck and improve all of the Windows PowerShell scripts to be better
- Add a script for Aptitude and Cattle where you can decide which pieces of the build can be replaced and swapped in and out.
- Create the necessary scripts for Railway. 
- Set up all of the same scripts for WSL.

**Card #217 title:** Revamp Code Scripts Such As Auto Formatting

**Card #217 description (verbatim from the board):**

Current Implementation: Scripts already cover development, builds, deployment, and code checks, and editor formatter choices are documented. There is no single package command that formats the whole project.

See what other scripts you can automate in development processes that don't require AI.

**Tests:**

**Test 1: Each script runs clean**
1. Run every script in `build-scripts-win` on Windows and its WSL or Mac equivalent. Each finishes without errors and does what its header says.

**Test 2: A missing setting gives a clear message**
1. Remove a required setting and run the build script. It stops with a message naming the setting.

**Test 3: One command formats and checks the project (#217)**
1. Run the format command, then the lint and PHP lint commands. A clean checkout produces no changes and no errors.

### #258 Add PHPStan and ESLint checks to CI: FILLED

**Card title:** Add PHPStan and ESLint Checks to CI

**Card description (verbatim from the board):**

Current Implementation: Frontend tests, PHP checks, CodeQL, and Dependabot already exist. PHPStan and the additional ESLint quality checks are not yet set up as CI checks.

**Tests:**

**Test 1: Checks run on a pull request**
1. Open a pull request. PHPStan and ESLint appear as checks and pass on the current code.

**Test 2: A PHP type error fails the check**
1. Push a commit that passes a string to an `int` parameter. PHPStan fails and names the line.

**Test 3: An ESLint error fails the check**
1. Push a commit with an unused import. ESLint fails and names the line.

### #216 Fix dependency issues and set up Dependabot: NEW

**Card title:** Fix Dependancy Issues And Set Up Dependabot

**Card description (verbatim from the board):**

Current Implementation: Dependency versions and overrides have been updated, and Dependabot Updates is active. This card covers reviewing and applying the remaining dependency changes.

**Tests:**

**Test 1: Clean install**
1. On a fresh clone, `npm ci` and `composer install` finish without errors.

**Test 2: Audit**
1. `npm audit --omit=dev` and `composer audit` report no high or critical issues, or each remaining one is listed on the card with a reason.

**Test 3: Dependabot is active**
1. The repository's Dependabot page shows it enabled, and recent update pull requests exist.

**Test 4: Nothing broke**
1. `npm test -- --watchAll=false`, `npm run test:backend`, and `npm run build` pass.

### #257 Migrate the frontend build from Create React App to Vite: NEW

**Card title:** Migrate the Frontend Build from Create React App to Vite

**Card description (verbatim from the board):**

Current Implementation: The frontend still uses Create React App and react-scripts, with dependency overrides and a custom start script. Vite is not part of the current build.

**Tests:**

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

**Card title:** Redo Test Suite and Postman Tests

**Card description (verbatim from the board):**

Current Implementation: The project has Jest frontend tests, PHP checks, and separate purchase integration tests. Test guides and older Postman instructions still need to stay consistent with the app.

Theres test files and jest tests all of that needs to be standardized 
Find way to automatically run API tests for scrum board
Fix all php file testing files in api-test-files to be correct and working properly

**Tests:**

**Test 1: Every suite runs from one place**
1. From `dorm-mart/`: `npm test -- --watchAll=false`, `npm run test:backend`, and `npm run test:backend:integration` (with local MySQL running) all pass.

**Test 2: No dead instructions**
1. Card tests no longer point at personal Postman workspaces (see #139 and #126 above).

### #192 Refactor codebase for readability: HAS STEPS, add

**Card title:** Refactor Codebase For Readability and Proper Scope

**Card description (verbatim from the board):**

Current Implementation: The code is grouped by feature, with shared helpers for requests, notifications, and common controls. Further cleanup should preserve the existing user flows.

### Explanation: 
Use a mix of Claude Code, Chatgpt, and Coderabbit to reduce lines of code, mainly via helper functions for repetitive lines.

**Tests:**

**Test 1:  Run through user stories and ux flow to make sure project works**
1. After the refactor, go through each of these in the app and confirm it works as it did before: Login, Create Account, Forgot/Reset Password, FAQ, Create New Listing, Seller Dashboard, Chat, Schedule Purchase, Confirm Purchase, Search, Home Page, Buyer Reviews, Profile Pages, User Preferences, Seller Reviews, Receipts, Wishlists, Notifications.

**Extra Test: Behavior is unchanged**
1. Before and after the refactor, all three test commands in #218 Test 1 pass with the same number of tests or more.

### #197 (DevOps Tasks): HAS STEPS

**Card title:** (DevOps Tasks) As a developer, I want the codebase and infrastructure to be maintainable and automated, so that the team can ship reliably and efficiently

**Card description (verbatim from the board):**

Current Implementation: Local development commands, deployment configuration, schema sync, and frontend and backend tests are in place. This card covers the remaining maintenance and automation work.

**Tests:**

The card's own tests, with the steps tidied. No extra tests were added.

**Test 1: Verify that the Scrum Board is remade and properly maintained on GitHub projects**
1. Open the GitHub Projects board.
2. Sprint 1-4 cards exist with the correct branch, tags, blocking relationships, assignees, and comments.
3. The Backlog is the same.
4. The board's rules are being followed.

**Test 2: Refactor and cleanup codebase to reduce complexity and bloat**
1. All user story tests still pass on Railway.
2. File organization has improved, repeated code is in helper functions, and variables have clear names.

**Test 3: Deploy Website to Railway, a cloud app deployment platform**
1. Uploaded images persist on Railway storage after a redeploy.

**Test 4: Get access to the custom domain name dormmart.me**
1. https://dormmart.me opens the app.

**Test 5: Set up a new emailer for Railway**
1. Emails send from the deployed site (see #190).

**Test 6: Create automation scripts to save time**
1. A script deploys to Railway.

**Test 7: Set up any AI tools with custom skills, instructions, and files for the project**
1. Custom instructions cover the tech stack and files.

**Test 8: Set up Coderabbit, if possible, to see if any tools could be worth it**
1. If none is worth it, that is fine (see #215).

**Test 9: Look at Dependabot and dependencies in the project**
1. See #216.

**Test 10: Set up a script for auto-formatting and update any documentation relevant to that**
1. See #217.

### #158 Create developer wiki, #219 Create user wiki, #214 AI instruction files: NEW

**Card #158 title:** Create Developer Wiki Section + Necessary Docs For Onboarding

**Card #158 description (verbatim from the board):**

Current Implementation: The repository has setup, architecture, and development guides, and GitHub has the wiki enabled. This card covers organizing and maintaining developer-facing guides.

Once all DevOps tasks are done, documentation for onboarding developers and how everything works will be set up, as well as its placement in the GitHub wiki section feature.

**Card #219 title:** Create User Wiki

**Card #219 description (verbatim from the board):**

Current Implementation: The app has FAQ pages and a help popup for its main features. This card covers organizing those instructions into a separate user wiki.

**Card #214 title:** Setup AI Custom Instructions Files For Specific Repo And Skills, used prompts

**Card #214 description (verbatim from the board):**

Current Implementation: Project-specific guidance is documented in CONTEXT.md and the agent workflow guide. This card covers a consistent setup for instructions and skills across the AI tools.

all md files for project specific instructions and skills will be in its own file and version numbers that get improved and added over time
Setup repo so multiple llms can have skills

**Tests:**

**Test 1: A new developer can set up from the docs alone (#158)**
1. On a clean machine, follow only the wiki. The app runs locally and the tests pass. Note every step that was missing.

**Test 2: Links work (#158, #219)**
1. Every link in the wiki opens an existing page or file.

**Test 3: User wiki matches the app (#219)**
1. For each main feature, follow the wiki's steps in the app. Names and steps match what is on screen.

**Test 4: Instruction files are found by each tool (#214)**
1. Start each AI tool the team uses in the repository and ask where setup instructions are. It reads the project's instruction files.

### #215 Research CodeRabbit equivalent and #220 Research actions and agents: NEW

**Card #215 title:** Explore and Research Coderabbit Equivalent, Setup if possible

**Card #215 description (verbatim from the board):**

Current Implementation: The repository has a code-structure review script and CodeQL checks. This card covers comparing and choosing an automated pull-request review tool.

change info and title of card if something exists

**Card #220 title:** Research Actions and Agents

**Card #220 description (verbatim from the board):**

Current Implementation: CodeQL and Dependabot Updates are active on GitHub. This card still contains no recorded plan for additional actions or agents.

Required code reviews on pull requests

**Tests:**

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
