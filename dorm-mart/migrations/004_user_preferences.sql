-- 004_user_preferences.sql

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id INT NOT NULL PRIMARY KEY,
  promo_emails TINYINT(1) NOT NULL DEFAULT 0,
  interests JSON NULL,
  theme ENUM('light','dark') NOT NULL DEFAULT 'light',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_user_preferences_user
    FOREIGN KEY (user_id) REFERENCES user_accounts(user_id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB;
