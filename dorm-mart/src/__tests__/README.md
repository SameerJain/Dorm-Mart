# Frontend tests

Keep frontend test files here, separate from application components and helpers.
The `pages/`, `context/`, `hooks/`, and `utils/` folders mirror the application
folders. Adversarial tests live in `adversarial/`. Import and mock the application
modules using relative paths.

Run all frontend tests from `dorm-mart/` with `npm test -- --watchAll=false`.
Run one suite with `npm test -- --watchAll=false --runTestsByPath src/__tests__/utils/apiClient.test.js`.

Create React App discovers tests inside `src/`, so this dedicated folder stays
under `src/`. Backend tests and their support files live in `api/tests/`.
SQL seed fixtures and their images live in `data/`; Stripe test-mode webhook
handlers are application endpoints and remain in `api/payments/`.
