-- User ids are nullable so a deleted account leaves the other side's history.

CREATE TABLE conversations (
  conv_id BIGINT NOT NULL AUTO_INCREMENT,
  user1_id BIGINT UNSIGNED NULL,
  user2_id BIGINT UNSIGNED NULL,
  product_id BIGINT UNSIGNED NULL DEFAULT NULL,
  item_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  user1_fname VARCHAR(200) NOT NULL,
  user2_fname VARCHAR(200) NOT NULL,
  user1_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  user2_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (conv_id),
  UNIQUE KEY uq_conv_users_product (user1_id, user2_id, product_id),
  CONSTRAINT fk_conv_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
