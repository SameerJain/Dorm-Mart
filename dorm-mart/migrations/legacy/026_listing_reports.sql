-- Reports that a listing should be taken down, filed from the item page and
-- handled on the moderator dashboard. The title is snapshotted because a
-- removal deletes the INVENTORY row the report points at.

CREATE TABLE IF NOT EXISTS listing_reports (
  report_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  product_id BIGINT UNSIGNED NULL,
  seller_id BIGINT UNSIGNED NULL,
  reporter_id BIGINT UNSIGNED NULL,
  listing_title VARCHAR(255) NOT NULL,
  reason VARCHAR(32) NOT NULL,
  details VARCHAR(500) NULL,
  status ENUM('open', 'removed', 'dismissed') NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL DEFAULT NULL,
  resolved_by BIGINT UNSIGNED NULL,

  PRIMARY KEY (report_id),
  UNIQUE KEY uq_listing_reporter (product_id, reporter_id),
  INDEX idx_listing_reports_status_created (status, created_at),
  CONSTRAINT fk_listing_report_product
    FOREIGN KEY (product_id) REFERENCES INVENTORY(product_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_seller
    FOREIGN KEY (seller_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_reporter
    FOREIGN KEY (reporter_id) REFERENCES user_accounts(user_id) ON DELETE SET NULL,
  CONSTRAINT fk_listing_report_resolver
    FOREIGN KEY (resolved_by) REFERENCES user_accounts(user_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
