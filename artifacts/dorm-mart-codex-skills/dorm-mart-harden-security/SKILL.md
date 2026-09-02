---
name: dorm-mart-harden-security
description: Review, fix, or test Dorm Mart security boundaries across React requests, PHP endpoints, sessions, CSRF, authorization, SQL, uploads, email, rate limits, moderation, and environment configuration. Use for security audits, authentication or account changes, state-changing APIs, file and image handling, exposed utilities, or fixes involving XSS, injection, ownership, information leakage, or production hardening.
---

# Harden Dorm Mart Security

## Trace the trust boundary

1. Identify the actor, protected object, accepted input, state change, and expected response contract.
2. Read the endpoint and its callers together. Inspect `api/security/security.php`, `api/auth/auth_handle.php`, and the relevant helper before adding another security mechanism.
3. Check adjacent endpoints for a consistent policy; do not secure one route while leaving an equivalent route open.

## Review in this order

### Request and transport

- Initialize JSON endpoints through `api/helpers/api_bootstrap.php` where compatible.
- Enforce HTTPS/security headers/CORS through shared helpers.
- Accept only the intended HTTP method and handle `OPTIONS` deliberately.
- Parse malformed or non-object JSON as an explicit client error when the endpoint requires JSON.

### Authentication and authorization

- Use the existing session and `require_login()` flow.
- For every object ID, verify ownership or the required moderator role on the server.
- Protect test accounts and privileged operations without committing privileged credentials.
- Keep administrative and migration utilities CLI-only unless browser access is an explicit product requirement.

### CSRF and frontend calls

- Require CSRF on session-authenticated mutations.
- Use `src/utils/csrfFetch.js` or `csrfPostJson()` so token fetch and one retry after HTTP 403 stay consistent.
- Do not treat a valid session cookie as sufficient authorization for a mutation.

### Input, SQL, and state

- Validate required fields, types, lengths, ranges, enum-like values, and legal state transitions.
- Use prepared statements for values. Allow-list identifiers that cannot be parameterized.
- Use a transaction for related writes and re-check mutable state inside it when races matter.
- Make retry-sensitive actions idempotent or reject duplicates predictably.

### Output and information disclosure

- Return controlled JSON through `json_response()`.
- Escape values for their output context; avoid corrupting canonical stored data as a substitute for output encoding.
- Do not expose SQL errors, filesystem paths, reset tokens, secrets, internal IDs that are not part of the contract, or whether an account exists.

### Files, images, and email

- Validate file type, size, filename, and ownership server-side.
- Resolve uploads beneath `DATA_UPLOADS_DIR`; never trust a client path or permit traversal.
- Serve local uploads through the existing media endpoints. Leave safe external absolute URLs external.
- Keep mail credentials and origins in environment configuration. Preserve certificate verification except for an explicitly trusted local self-signed server.

## Verify adversarially

Test valid use plus malformed JSON, missing session, missing or stale CSRF, cross-user IDs, duplicate requests, boundary lengths, SQL/XSS strings, disallowed file types, traversal attempts, and forbidden web access to CLI tools.

Run relevant Jest tests, manual PHP API scripts under `api/api_test_files/`, `php -l` on every changed PHP file, and a production build when frontend request behavior changes. Preserve deliberate status codes such as 400, 401, 403, 405, 409, and generic account-recovery responses.
