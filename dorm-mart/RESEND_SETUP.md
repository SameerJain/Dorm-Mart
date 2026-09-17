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

5. Deploy the updated application. Composer declares the required PHP cURL extension. When `RESEND_API_KEY` is set, welcome, password-reset, promo opt-in, and daily/weekly product digest emails use Resend over HTTPS, including embedded product images. Otherwise the existing SendGrid/SMTP selection remains in effect. Resend failures do not fall back to another provider.
6. Create an account with an eligible email address you own, then check the message in your inbox and Resend's Emails page. Also request a password reset and verify its link points to the deployed app. The auth endpoints intentionally return generic responses, so a success message alone does not prove delivery. Check Railway logs for `delivery_failed` or `Resend email failed` if needed.

The sender address does not need its own mailbox. Replies require a working reply-to inbox. A Resend accepted response means the provider accepted the email, not that it reached the inbox.

If `scripts/send_promotional_digests.php` runs in a separate Railway scheduled service, set the same email variables there and deploy the updated code there too. The script still needs to be scheduled; changing the email provider does not create a schedule.

API reference: https://resend.com/docs/api-reference/emails/send-email
