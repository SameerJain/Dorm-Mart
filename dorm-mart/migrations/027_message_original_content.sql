-- Keep the text a message had before its first edit. Editing overwrites
-- `content`, so without this a user could rewrite a reported or flagged
-- message and the moderator would only ever see the clean version.
-- NULL means the message was never edited.

ALTER TABLE messages
  ADD COLUMN original_content TEXT NULL DEFAULT NULL AFTER content;
