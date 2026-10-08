-- Blocked chat words. seed_profanity_wordlist.php adds the full list on top of
-- these starters.

CREATE TABLE profanity_words (
  word VARCHAR(100) NOT NULL,
  PRIMARY KEY (word)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Starter words, inserted whenever the table is empty (a fresh database or after
-- a wipe). migrate_schema.php then adds the banbuilder dictionary on top.
INSERT IGNORE INTO profanity_words (word) VALUES
  ('asshole'), ('bastard'), ('bitch'), ('bullshit'), ('cunt'), ('damn'), ('dick'),
  ('fuck'), ('fucker'), ('fucking'), ('hell'), ('motherfucker'), ('nigger'), ('nigga'),
  ('piss'), ('prick'), ('pussy'), ('shit'), ('slut'), ('whore');
