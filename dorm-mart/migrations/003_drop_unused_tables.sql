-- Remove the two tables the baseline left out, from databases built by the
-- legacy chain (production and older local copies). On a database created
-- from 001_baseline.sql they never existed, so this does nothing there.
--
--   wishlist_notification         write-only counter; notifications replaced it
--                                 and no code reads or writes it any more
--   account_creation_rate_limits  its throttle now shares login_rate_limits
--                                 (consume_account_creation_attempt), so any
--                                 rows here are expired lockouts nobody reads

DROP TABLE IF EXISTS wishlist_notification;
DROP TABLE IF EXISTS account_creation_rate_limits;
