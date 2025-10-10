ALTER TABLE transacted_items
  ADD COLUMN image_url VARCHAR(500) DEFAULT NULL,
  ADD KEY idx_image_url (image_url);