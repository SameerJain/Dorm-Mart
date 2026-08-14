-- Optional seller phone number used by the contact-sharing preference.

ALTER TABLE user_accounts
  ADD COLUMN IF NOT EXISTS phone_number VARCHAR(25) NULL AFTER reveal_contact_info;
