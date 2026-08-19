---
name: dorm-mart-manage-database
description: Create, modify, seed, reset, and verify Dorm Mart MySQL schema and fixture data through its numbered SQL files and CLI migration runners. Use for new tables or columns, indexes and constraints, account or marketplace seed fixtures, migration-runner changes, moderator creation, test-account protection, wipe behavior, or debugging differences between schema migrations and rerunnable data migrations.
---

# Manage the Dorm Mart Database

## Choose the correct migration type

- Put durable schema changes in `dorm-mart/migrations/NNN_description.sql`.
- Put demo, test, and fixture rows in `dorm-mart/data/NNN_description.sql`.
- Find the current highest natural number before choosing the next filename.
- Never place secrets or production credentials in either location.

`api/database/migrate_schema.php` records filenames in `schema_migrations` and applies each schema file once. `api/database/migrate_data.php` executes every data SQL file on every run and updates `data_migrations`. Therefore, every data file must be rerunnable.

## Write safe SQL

- Target the MySQL version used by the project and keep statements compatible with the PHP `mysqli::multi_query` runner.
- Preserve existing column meanings and foreign-key behavior unless the requested change explicitly migrates them.
- Add indexes for new lookup or uniqueness requirements when justified by the access path.
- Make seed rows deterministic with stable lookup keys and `INSERT ... ON DUPLICATE KEY UPDATE`, conditional inserts, or equivalent idempotent logic.
- Use unique fixture names and dates relative to the test where fixed calendar values will expire.
- Keep product, chat, review, and account fixture relationships internally consistent.
- Account for persistent image storage when seed data references files.

## Handle existing migrations carefully

- Prefer a new migration over editing a schema migration that may already be recorded as applied.
- Edit an old migration only when repairing a fresh-install defect and explicitly verify both a fresh database and an already-migrated database path.
- Treat `wipe_data.php` as destructive. Resolve the intended database and environment before running it.
- Keep migration, wipe, and moderator utilities CLI-only.
- Preserve `protect_test_accounts.php` behavior for every account introduced by seed data.

## Apply and verify

Run from `dorm-mart/`:

```powershell
php api\database\migrate_schema.php
php api\database\migrate_data.php
php api\database\db_test.php
```

Run the data migration twice to prove rerunnability. Verify exact rows, keys, constraints, and relationships rather than only trusting the runner's success message. Lint any changed PHP runner with `php -l`.

Create a moderator only through the CLI utility and a user-supplied strong password:

```powershell
php api\database\create_moderator.php moderator@buffalo.edu "strong-password" "Dorm Mart" "Moderator"
```

Do not run a wipe, create a privileged account, or mutate a shared/production database unless the user explicitly requests that external state change.
