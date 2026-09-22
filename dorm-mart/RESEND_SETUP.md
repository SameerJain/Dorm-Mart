# Resend on Railway

1. Create a Resend account and add `dormmart.me` at https://resend.com/domains.
2. Copy the DNS records Resend provides into the DNS provider for `dormmart.me`. Wait until Resend marks the domain verified. Keep existing website and inbox records; receiving email in Resend is not required.
3. Create a sending API key at https://resend.com/api-keys, restricted to this domain.
4. Set these variables on the Railway PHP application service:

   ```dotenv
   RESEND_API_KEY=your_actual_resend_key
   MAIL_FROM_EMAIL=noreply@dormmart.me
   MAIL_FROM_NAME=Dorm Mart
   ```

   Optionally set `MAIL_REPLY_TO_EMAIL` to an inbox you actually read. Store the API key only in Railway variables or an ignored local environment file, never in source control or frontend variables.

5. Deploy the updated application. Composer declares the required PHP cURL extension. When `RESEND_API_KEY` is set, welcome, password-reset, promo opt-in, and daily/weekly product digest emails use Resend over HTTPS, including embedded product images. Otherwise the existing SMTP fallback remains in effect. Resend failures do not fall back to another provider.
6. Create an account with an eligible email address you own, then check the message in your inbox and Resend's Emails page. Also request a password reset and verify its link points to the deployed app. The auth endpoints intentionally return generic responses, so a success message alone does not prove delivery. Check Railway logs for `delivery_failed` or `Resend email failed` if needed.

The sender address does not need its own mailbox. Replies require a working reply-to inbox. A Resend accepted response means the provider accepted the email, not that it reached the inbox.

## Daily and weekly promotional emails

Create a separate Railway service from this repository with root directory `/dorm-mart` and config file `/dorm-mart/railway.promotional.toml`. Keep the web service on its existing `railway.toml`. Set the same database, email-provider, sender, and frontend URL variables as the web service on the scheduled service, plus `API_BASE_URL` (the public URL of the web service, e.g. `https://api.dormmart.me`) so the digest can link to product images.

The job runs at 21:00 and 22:00 UTC; only the run during the 5 p.m. `America/New_York` hour sends mail. This keeps the delivery time at 5 p.m. Eastern through daylight saving changes. Railway can start jobs a few minutes late. See [Railway cron jobs](https://docs.railway.com/cron-jobs).

Daily subscribers are eligible once per Eastern calendar day. Weekly subscribers become eligible seven calendar days after their previous send. New subscribers are eligible at the next 5 p.m. run. Opted-out users receive no digest. Users without selected interests or matching active listings are skipped. The immediate opt-in confirmation is separate from these digests.

Run `php scripts/send_promotional_digests.php --dry-run` in the scheduled service to check database access and see `would_send` without sending or changing send timestamps. Dry runs work outside the send window. A dry run does not verify provider delivery. A real run records a send only after the provider reports success and exits with an error if any delivery fails.

Product images link to the web service's public `/media/image.php` endpoint rather than being embedded as attachments, so the digest job itself does not need access to `DATA_UPLOADS_DIR`. Images are omitted only when `API_BASE_URL` is not set or an item has no photo.

Run `php api/api_test_files/promotional_digest_test.php` to check the send window, daily/weekly eligibility, daylight saving transitions, and email wording.

API reference: https://resend.com/docs/api-reference/emails/send-email
