# Dorm Mart agent workflows

Use this reference only in `f25-no-brainers` / Dorm Mart. Verify paths and commands against the checkout before changing code. This file supports the existing `code-review`, `diagnosing-bugs`, `tdd`, and `principle-prove-it-works` skills.

## Working preferences

- Make the smallest complete change that solves the requested problem. Follow nearby code; avoid adding a framework, abstraction, or dependency for a one-off fix.
- Use available code and history to resolve routine choices. Continue authorized work without repeated confirmations. Ask only when missing information changes the outcome or an action needs authorization.
- Preserve existing work. Inspect `git status` before edits. Restore only your own changes; never use a whole-file Git restore to undo a temporary experiment over user edits.
- Keep short answers short. For substantial findings, use headings or a table, exact file references, and the evidence that supports each conclusion.

## Locate the real implementation

Run application commands from `dorm-mart/`. The frontend is JavaScript/JSX React with react-scripts, Tailwind, and a hash router in `src/App.jsx`. The backend uses plain PHP and MySQL/mysqli. Do not assume TypeScript, Next.js, Laravel, PHPUnit, MongoDB, Elixir, or PostgreSQL from a pasted prompt.

Read `CONTEXT.md` at the repository root for domain language. Consult `PROJECT_HANDOFF.md` for architecture, `README.project_setup.md` at the root for setup, and `environment_configuration.md` for environment selection. These documents are snapshots; source code decides current behavior. `README.websocket.md` describes a retired experiment; trace current chat polling in `src/context/` and `api/chat/`.

Frontend features live in `src/pages/<feature>/`, with feature components and utilities nearby. Shared request behavior lives in `src/utils/apiClient.js` and `csrfFetch.js`. PHP JSON setup is in `api/helpers/api_bootstrap.php`; inspect request, response, security, and authentication helpers before introducing another wrapper. Preserve endpoint payload shapes, credentials, CSRF handling, statuses, and visible error behavior unless the task changes their contract.

## Review and security audits

Choose scope from the request: working-tree changes, a supplied comparison ref, a feature, or the whole application. Never substitute a branch diff for a requested whole-application audit. Use the user's prompt as the spec when no issue exists; a missing issue-tracker setup is not a blocker. Verify refs before using them and include unstaged/staged/untracked changes when reviewing work in progress.

For each finding, identify the trigger, affected file/line, observed or traceable behavior, severity, and smallest fix. Separate confirmed defects from unverified concerns and non-applicable checklist items. A pasted vulnerability title is not proof it exists. Trace guards through includes before calling an endpoint unprotected.

For endpoint audits, build a table of first-party callable endpoints: method, public/authenticated/moderator/local-only access, resource ownership check, CSRF requirement, evidence, and verdict. Distinguish helper files and signed Stripe callbacks from ordinary browser endpoints. Check access to another user's resource with separate buyer, seller, outsider, and moderator fixtures where applicable. Login alone does not prove ownership. A request rejected for missing auth, CSRF, wrong content type, or invalid field shape does not test later SQL or authorization logic.

Inspect session invalidation, remember tokens, password-reset expiry, rate-limit failure behavior, and webhook signature verification in their actual implementations. Use prepared statements for user-controlled SQL values and explicit allowlists for dynamic identifiers. Redact secret values in reports; distinguish demo fixtures and publishable keys from credentials. For dependency/advisory claims, record the audit date and current registry or advisory evidence; never apply a force-upgrade as a generic fix.

## Debugging

Capture the user's exact symptom with the smallest useful failing command or UI flow. Follow input through frontend request, router, PHP guard, query, response, and rendering until the cause is located. Use this to distinguish a stale environment/schema, request-contract mismatch, and a real logic defect. A simple demonstrated bug does not need a fixed quota of hypotheses or a new harness.

For purchase scheduling and payment changes, preserve buyer/seller roles, state transitions, pending-listing visibility, duplicate/retry behavior, and the 30-minute Payment Window. For Eastern-time scheduling, cover boundaries and daylight-saving transitions with a fixed clock; do not rely on the machine timezone. Validate the original scenario after fixing the cause.

## Test selection and evidence

Read [TESTING_AND_RELIABILITY.md](TESTING_AND_RELIABILITY.md) for commands and mutation guidance, and [TEST_CATALOG.md](TEST_CATALOG.md) for all current test sources in collapsed sections. Regenerate the catalog with `node scripts/generate-test-catalog.js` whenever test files change.

Extend the existing Jest/Testing Library tests beside frontend features or the existing adversarial tests. Backend tests are CLI PHP programs with explicit checks, not PHPUnit. Reuse their conventions. Use the established public seam without another approval round when the request or existing tests already establish it.

For meaningful logic regressions, demonstrate that the test fails for the old behavior and passes for the fix. Give fixtures a path into the claimed branch; use independent expected values and inputs that distinguish outcomes. Anchor negative UI assertions with a positive case using the same query. Assert status and response semantics, not merely a substring or absence of a crash. Missing credentials, fixtures, or skipped checks must not count as passing.

Run a focused test first, then relevant existing suites and PHP lint for changed PHP. Build when imports, bundling, routing, or configuration require it. Use targeted mutation testing for test-strength audits; do not run every mutant after a documentation edit. Keep `stryker-tmp` non-hidden for Jest 27 and preserve rooted ignore patterns. Confirm tests executed before interpreting scores. Classify survivors as a gap, equivalent, or covered elsewhere with evidence.

The lifecycle integration test creates and drops a randomly named local database and starts its own HTTP server. Check local MySQL access and permissions before running it. `api/database/migrate_data.php` loads the local fixtures and resets the fixture accounts' data (never other users'); it is for hand-testing a local database, not test setup, which should build its own scratch database as the harness does. HTTP integration scripts can send emails, lock accounts, or change data: use disposable local fixtures and inspect the script first. `api/payments/*webhook*test.php` are real Stripe test-mode handlers, not automated tests.

Report exactly what ran, passed, failed, or remained untested. Distinguish existing baseline failures from regressions. Never copy historical suite counts or mutation scores into a new run result. For documentation-only work, validate referenced paths, catalog completeness, and skill structure; application suites are not required.

## Basis and maintenance

Updated September 30, 2026 from the user’s current instructions, the accessible chats “Audit authentication and API” and “Organize Dormart Sprint 5 Scrumboard,” and this checkout’s code and testing guide. This is a scoped sample of history, not a claim to have read every conversation. The audit prompt includes unrelated technology examples; match intent to this repository before acting. Keep historical audit results in the testing guide and current execution results separate.
