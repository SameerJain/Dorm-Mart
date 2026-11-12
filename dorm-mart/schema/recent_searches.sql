-- Bounded, private search history for each account.
CREATE TABLE recent_searches (
  user_id BIGINT UNSIGNED NOT NULL,
  search_terms JSON NOT NULL,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_recent_searches_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
