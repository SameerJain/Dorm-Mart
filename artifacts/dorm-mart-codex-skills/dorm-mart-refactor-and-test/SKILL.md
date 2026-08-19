---
name: dorm-mart-refactor-and-test
description: Simplify and reorganize Dorm Mart React or PHP code without changing user-visible behavior, API contracts, routes, database semantics, or security guarantees. Use for large page decomposition, extracting hooks/components/utilities or PHP helpers, consolidating frontend API and formatting boundaries, removing duplication, reviewing code quality, and adding focused or adversarial regression tests.
---

# Refactor and Test Dorm Mart

## Define invariants first

- Record the route, inputs, visible states, API requests, JSON responses, status codes, database changes, and security checks that must remain unchanged.
- Read existing tests and `dorm-mart/code-review-refactor-report.md` before touching an area already refactored.
- Exclude generated output, dependencies, binaries, media, PDFs, and lockfile churn from architecture work.

## Choose a narrow seam

For React feature areas:

- Keep the page responsible for composition and routing.
- Move reusable presentation to feature-local `components/`.
- Move state, effects, and request orchestration to `hooks/`.
- Move normalization, sorting, grouping, validation, date math, and view-state decisions to pure `utils/`.
- Reuse shared `apiClient.js`, `csrfFetch.js`, formatters, product normalization, and image fallback boundaries instead of adding another local variant.
- Use abort handling when asynchronous batches can become stale.
- Parallelize independent lookups when the existing contract permits it.

For PHP endpoints:

- Extract duplicated domain operations into a nearby `helpers.php`.
- Leave request validation, authentication, authorization, and response orchestration explicit in the endpoint.
- Preserve prepared statements, transaction boundaries, response shapes, and HTTP codes.
- Avoid a service-layer rewrite unless the request requires a larger architecture change.

## Add tests at the extracted boundary

- Put pure utility edge cases under `src/__adversarial_tests__/` when they protect shared boundaries.
- Keep focused component tests near their components.
- Cover malformed and API-shaped input, null and empty values, coercion boundaries, invalid dates, stable ordering, duplicate actions, CSRF retry behavior, and loading/error/empty UI states.
- Prefer observable behavior over implementation-detail assertions.
- Reproduce a suspected bug before fixing it; keep the regression case afterward.

## Keep the change reviewable

- Avoid mixing formatting churn with behavior changes.
- Do not rename established routes or response fields for aesthetic consistency.
- Do not broaden a refactor into unrelated legacy fetch/date cleanup.
- Update concise architecture documentation only when ownership or paths materially change.

## Verify

From `dorm-mart/`, run targeted tests during iteration, then:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
php -l path\to\each_changed.php
```

Compare the final diff against the invariants. Treat unexplained behavior, contract, schema, dependency, and generated-file changes as regressions until proven intentional.
