# Frontend tests

Keep frontend test files here, separate from application components and helpers.
The `pages/`, `context/`, `hooks/`, and `utils/` folders mirror the application
folders. Import and mock the application modules using relative paths.

Run all frontend tests from `dorm-mart/` with `npm test`.
Run one suite with `npm test -- --runTestsByPath src/__tests__/utils/apiClient.test.js`.
Run the weed check with `npm run check:no-useless-tests`.

Jest only looks for tests inside `src/` (`roots` in `package.json`), so this dedicated folder stays
under `src/`. Backend tests and their support files live in `api/tests/`.
SQL seed fixtures and their images live in `data/`; Stripe test-mode webhook
handlers are application endpoints and remain in `api/payments/`.

## Garden rules

Tests must check behavior a user or caller can see. Do not add tests that only
restate the code.

1. Never wrap `getBy` or `findBy` in `toBeTruthy`. Those queries throw when the
   element is missing, so the assertion checks nothing. Use `toBeInTheDocument`.
2. Never assert `tagName` or `className`. Those lock markup and CSS and break on
   redesign without catching bugs.
3. Test scroll lock once in `hooks/useBodyScrollLock.test.js`. Do not repeat
   `body.style.position` checks in dialog tests.
4. Do not add `*.adversarial.test.js` files. They duplicated the main utils
   suites with the same malformed inputs. Put a new boundary case in the main
   suite file for that util.
5. Do not test static copy such as team bios or legal wording. Those break on
   every edit and catch no bug.
6. Before adding an edge case, ask what bug it would have caught. If the answer
   is none, do not add it.
