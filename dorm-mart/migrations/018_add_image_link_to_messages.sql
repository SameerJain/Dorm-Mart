ALTER TABLE messages
  ADD COLUMN image_url VARCHAR(255) NULL   -- stores /media/chat-images/… (adjust length if your paths are longer)
  AFTER content;                           -- place next to content for readability