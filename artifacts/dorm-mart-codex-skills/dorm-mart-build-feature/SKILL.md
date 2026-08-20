---
name: dorm-mart-build-feature
description: Implement or extend Dorm Mart features across its React frontend, PHP JSON API, and MySQL schema while preserving existing routes, response contracts, security boundaries, naming conventions, dark theme, and responsive behavior. Use for new pages, settings, marketplace flows, chat behavior, listing and purchase workflows, notifications, moderation, or any change that crosses one or more application layers in the Dorm Mart repository.
---

# Build a Dorm Mart Feature

## Establish the change boundary

1. Work from the repository root, but run npm and PHP application commands from `dorm-mart/`.
2. Read `README.project_setup.md` and only the relevant maps in `dorm-mart/extra-files/`.
3. Trace the existing flow before editing: route in `src/App.jsx`, page or component, API call, PHP endpoint, helpers, tables, and nearby tests.
4. Preserve current URLs, JSON shapes, status codes, and database contracts unless the request explicitly changes them.
5. Touch only the layers the feature needs.

## Follow the frontend pattern

- Name pages, components, and feature folders with `PascalCase`; name hooks and utilities with `camelCase`.
- Keep page files as orchestration shells. Extract reusable display pieces to `components/`, stateful behavior to `hooks/`, and pure transformations to `utils/` within the feature.
- Reuse `src/utils/apiConfig.js`, `apiClient.js`, and `csrfFetch.js`. Do not hardcode deployment hosts or duplicate JSON/error parsing.
- Include credentials for session-backed calls. Use the CSRF wrapper for state-changing requests.
- Normalize API-shaped values at a boundary before JSX consumes them.
- Match nearby Tailwind and component patterns. Verify light and dark themes plus narrow mobile widths; do not introduce horizontal overflow.
- Keep existing user-facing route spellings even when they predate current naming conventions.

## Follow the backend pattern

- Name API folders and PHP files with `snake_case`.
- Prefer `api/helpers/api_bootstrap.php`, `request.php`, and `response.php` for JSON endpoints.
- Enforce the request method, authentication, authorization, and CSRF before mutation.
- Validate types, ranges, ownership, and state transitions server-side even when the frontend also validates them.
- Use prepared statements. Keep transaction boundaries around multi-table state changes.
- Return deliberate JSON and HTTP status codes; avoid leaking SQL, stack, credential, or account-enumeration details.
- Read deployment-specific values from environment-backed config. Never add host checks or secrets to an endpoint.

## Change data safely

- Add schema changes as the next naturally sorted file in `dorm-mart/migrations/`.
- Put repeatable fixture or demo data in `dorm-mart/data/`, not in schema migrations.
- Keep new seed data rerunnable because `migrate_data.php` executes every data file on every run.
- Update all readers and writers affected by a schema change in the same feature.

## Verify the feature

Run the smallest useful checks first, then broaden in proportion to risk:

```powershell
cd dorm-mart
npm test -- --watchAll=false --runInBand
npm run build
php -l path\to\changed.php
php api\database\migrate_schema.php
```

Add focused Jest tests for frontend behavior and PHP/manual integration checks where useful. Exercise success, invalid input, unauthenticated access, unauthorized ownership, repeated actions, empty data, and narrow viewport behavior.

Do not edit generated `build/`, `vendor/`, real `.env.*` files, or lockfiles unless the requested change genuinely requires it.
