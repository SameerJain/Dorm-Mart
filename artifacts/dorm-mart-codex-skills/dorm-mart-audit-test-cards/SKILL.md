---
name: dorm-mart-audit-test-cards
description: Audit Dorm Mart GitHub acceptance-test cards, user-story tests, or manual QA instructions against the current repository and running build. Use to find stale paths, obsolete designs, missing CSRF or session setup, expired dates, fixed-fixture assumptions, unsafe steps, contradictory expectations, subjective responsive criteria, genuine regressions, and product decisions hidden inside old test descriptions.
---

# Audit Dorm Mart Test Cards

## Establish current truth

1. Read the exact card title, description, test number, preconditions, steps, and expected results.
2. Inspect the current route, React implementation, PHP endpoint, migration or fixture, and relevant documentation.
3. Run targeted automated checks and browser/API smoke tests when they materially distinguish a regression from stale documentation.
4. Treat source code and observed current behavior as evidence, not automatically as the intended product requirement.

## Classify every finding

Use one of these outcomes:

- **Passes:** the documented behavior is current and reproducible.
- **Regression:** current behavior violates a still-valid requirement.
- **Outdated instructions:** paths, commands, cookie names, response fields, form structure, or configuration changed.
- **Missing feature/product decision:** the card expects behavior absent from the build and the requirement is not clearly retired.
- **Design-only or historical:** the card tests Figma, an old branch, or a retired workflow rather than the application.
- **Non-repeatable or unsafe:** the test depends on shared fixed data, order, plaintext credentials, destructive database edits, throwaway pushes, or a production backdoor.

Do not modify the application merely to make a stale card pass. Surface the product decision instead.

## Check common Dorm Mart drift

- API paths now live under feature folders such as `api/database/` and `api/seller_dashboard/`.
- Auth uses `PHPSESSID`; state-changing session requests also need CSRF.
- Current endpoints may intentionally omit internal IDs or return generic account-recovery responses.
- Email-domain policy is environment-backed rather than assumed UB-only.
- Fixed calendar dates and statements such as "2026 is invalid" expire.
- Named products and users make tests order-dependent unless each test creates and cleans up a unique fixture.
- Figma navigation, removed `testflow` behavior, old branches, and hardcoded credentials are not current-build test setup.
- Responsive tests need exact viewport sizes and objective overflow, overlap, visibility, and interaction criteria.

## Gather proportional evidence

Prefer targeted checks, then use the broader baseline when needed:

```powershell
cd dorm-mart
npm test -- --watchAll=false --runInBand
npm run build
```

For API tests, record method, URL, session state, CSRF setup, request body, response status, and relevant response fields. For browser tests, record the viewport and observable result. Redact credentials, tokens, cookies, private data, and sensitive environment values.

## Produce the audit

- Cite each finding by card number and exact test/step.
- Separate reproduced product defects from documentation defects.
- Quote only the minimum wording needed to identify a contradiction.
- Recommend a concrete rewrite, archive/label action, security cleanup, or product decision.
- Replace subjective or relative language with measurable expectations.
- End with checks that passed, checks not run, blockers, and prioritized board actions.
