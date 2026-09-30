# Testing and Reliability

How Dorm Mart's automated tests run, the rule every test has to meet, and the record of the last audit for tests that could not fail.

## Suites

For the complete first-party test-file source inventory, open [TEST_CATALOG.md](TEST_CATALOG.md). Every file is enclosed in a collapsed section. Regenerate it after editing tests with `node scripts/generate-test-catalog.js` from `dorm-mart/`; `--check` verifies it is current without rewriting it.

| Command (from `dorm-mart/`) | What it runs |
| --- | --- |
| `npm test -- --watchAll=false` | Jest (react-scripts 5 / Jest 27): frontend tests under `src/__tests__/`, including adversarial tests under `src/__tests__/adversarial/` |
| `npm run test:backend` | Five CLI PHP scripts under `api/tests/` (no database, no network) |
| `npm run test:backend:integration` | `api/tests/purchase_lifecycle_test.php` (needs a database) |
| `npm run test:mutation` | Stryker mutation run over the pure frontend helpers (see below) |

The PHP scripts are plain CLI programs, not PHPUnit. Each one defines a small checker (`expect_same`, `expect_value`, `check_location`, ...) that prints `FAIL: <message>` and exits 1, or prints a `PASS` tally at the end.

## The rule: a test counts once it has been seen to fail

A test is worth having only after it has been **seen red**: break the behavior it claims to pin, in the file the suite actually loads, run it, watch it fail, then restore.

A passing test that has never failed proves nothing about the code. Line coverage cannot tell the two apart.

### How to check one test by hand

1. Name the code change that *ought* to break it: flip the operator, hardcode the return value, swap the value in the message.
2. Make that change in the working-tree source file the test imports. Not a copy, and not a build output.
3. Run just that test and record red or green.
4. Restore exactly what you changed, then rerun to confirm green.

If it stays green, the test doesn't check what its name says. Rewrite the assertion, add the missing fixture, or delete the test with a note.

The working tree here usually has uncommitted work, so don't restore with `git checkout --`. Copy the file aside first, copy it back afterwards, and compare hashes.

### Shapes that produce tests that cannot fail

| Shape | What it looks like | Fix |
| --- | --- | --- |
| Needle in the haystack's own prose | `toContain("/media/image.php")` is satisfied by the URL's fixed prefix, whichever image it points at | Assert the rendered value (`…?url=%2Fimages%2Flamp.jpg`) |
| Fixture cannot reach the branch | The digest fixture has no `image_url`, so a "no `object-fit` in `<img>`" check never sees an `<img>` | Add a fixture that takes the branch, plus a positive check that it did |
| Only one side of a rule exercised | Every fixture sorts the same way under "Newest" and "Price", or every boolean input is truthy | Add an input where the two options disagree |
| Crash standing in for a failure | A lookup stub that `throw`s: a regression kills the PHP script with an uncaught exception instead of printing `FAIL:` | Record the call and assert on it, so the checker reports which rule broke |
| Mutation delivered to nothing | A green run because the edited file was never loaded (wrong path, a sandbox the runner can't see) | Check delivery: the mutant must change a file the runner imports |

Negative UI checks (`queryBy…` → `toBeNull` / `not.toBeInTheDocument`) are safe only when another test shows the same query *does* match: same text, same accessible name. Otherwise a renamed label makes them pass forever.

## Mutation testing (Stryker)

Configuration: [`stryker.config.json`](../stryker.config.json). Run it with `npm run test:mutation`. The HTML report goes to `reports/mutation/mutation.html`, which is git-ignored.

- **Scope.** The `mutate` list holds only the pure helper modules that have their own unit or adversarial tests. Components are covered by the manual method above. Mutating them under jsdom is slow and mostly produces rendering-only survivors.
- **Timeouts and process cleanup.** `timeoutMS` is 10000 and `timeoutFactor` is 2. When a mutant times out (an infinite loop, say), Stryker kills that worker's whole process tree with `tree-kill` (`taskkill /T /F` on Windows), so no orphaned Jest processes are left. After a run, check that no stray `node` processes remain.
- **Delivery.** Stryker copies the project into `stryker-tmp/` and runs Jest there. It must **not** be the default `.stryker-tmp`: Jest 27 skips dot-directories, finds no tests, and the dry run fails with "No tests were executed". Before trusting a run, check that the dry run reports tests executed and that mutants already killed by hand (see the log below) show as *Killed*.
- **Triage, not a defect list.** Classify every survivor as a **real gap** (fix the test), **equivalent** (the change isn't observable; record it and skip) or **covered elsewhere** (say where).

## Audit log

### 2026-09-30: manual seen-to-fail audit

Starting point: Jest 38 suites and 156 tests. One test was already red at the start (`UserPreferences` "persists the off promotional email frequency"). Backend: 5 scripts, all green.

| # | Test | Shape | Mutation tried | Before | After fix |
| --- | --- | --- | --- | --- | --- |
| B1 | `login_location_test.php` "non-public location" | Crash standing in for a failure | Removed the `login_ip_scope(...) !== 'public'` guard | Red only by an uncaught `RuntimeException` | `FAIL: non-public 127.0.0.1 never sent to lookup` |
| B2 | `login_location_test.php` "history lookup budget bounded" | Crash standing in for a failure | Lookup budget `3` → `300` | Red only by an uncaught `RuntimeException` | `FAIL: history lookup budget bounded` |
| B3 | `adversarial_validation_test.php` "known image rejected" | Fixture could silently skip (`if (is_file(...))`) | `uploaded_image_dimensions_are_safe` always returns false | Red (fixture present) | A missing fixture now fails instead of skipping |
| B4 | `helpers_unit_test.php` "email images do not rely on object-fit" | Fixture cannot reach the branch (no `image_url`) | Added `object-fit:cover` to the email `<img>` | **Green** | Red; also added "item image rendered", seen red when the image is dropped |
| J1 | `UserPreferences.test.jsx` "persists the off promotional email frequency" | Fixture cannot reach the branch: it loaded `"off"` and then selected `"off"`, so it had only passed via the old save-on-load | `preferenceChanges` sends the saved frequency instead of the current one | Red at baseline (save-on-load removed) | Each case now starts from a different frequency; red on the mutation for off, daily and weekly |
| J2 | `userPreferencesUtils.test.js` | Only one side of a rule: no test changes interests alone | Dropped `!sameList(...)` from `changed`; made `sameList` ignore order | **Green** (both) | Red (both), via the new "sends a change to interests alone, including a reorder" |
| J3 | `sellerDashboardUtils.adversarial` sort | Only one side: "Newest First" and "Price: Low to High" gave the same order | Price sort replaced by the newest-first sort; no sort at all; comparator `a + b` | **Green** | Red on all three. A first two-item fix still let "no sort" and `a + b` survive, because the input was already in price order; Stryker caught that. Three listings now make input order, newest-first and cheapest-first all differ |
| J4 | `sellerDashboardUtils.adversarial` image | Needle in the prose | Built the image URL from a different source path | **Green** | Red; asserts the encoded path |
| J5 | `schedulePurchaseFormUtils.adversarial` boolean normalization | Only one side: every input was truthy | `=== true` → constant `true`; `=== true` → `!== false`; snake_case wins over camelCase | **Green** (constant `true`) | Red on all three |
| J6 | `ChatHeader.test.jsx` "hides View Item for a draft" | Suspected unanchored negative | Removed `!isListingDraft` | Red | No change needed |
| J7 | `LoginPage.test.jsx` paste test | Suspect: jsdom never inserts pasted text | Put back the pre-`fa7b7b95` `onPaste` handler that overwrote the field | Red | No change needed (a valid regression guard) |

After the audit: Jest 38 suites, 163 tests, all green. Backend: 5 scripts, all green.

### 2026-09-30: first Stryker run and survivor triage

Full run over the 21 modules in `mutate`: 3,300 mutants in 18.5 minutes with 4 workers. The time is dominated by 186 static mutants, which rerun the whole suite each.

- **Delivery.** The dry run executed 148 tests. The manual kills above (`preferenceChanges`, `normalizeScheduleListing`) also show as Killed.
- **Cleanup.** One timeout (killed by tree-kill), the sandbox was removed, and no stray `node` processes were left.
- **Totals.** Killed 1,372, Timeout 1, Survived 924, NoCoverage 1,003.

**Fixed from survivors** (rerun on the three modules, each new case seen to kill its mutants):

| Module | Score before → after | Survivors fixed (all real gaps) |
| --- | --- | --- |
| `userPreferencesUtils.js` | 89.4% → 97.7% | Regex anchors (`"7165551234x"`, `"x7165551234"`); `every` → `some` (same length, one item different); phone not trimmed; non-string input |
| `schedulePurchaseFormUtils.js` | 73.1% → 88.5% | Blank or padded price; `9999.99` ceiling (`>` → `>=`); success returned a non-empty `error`; `digitsOnly: false` ($4.20 is not the meme "420"); `null` listing; blank `meet_location` |
| `sellerDashboardUtils.js` | 47.9% → 50.0% | Price sort: no sort, `a + b` comparator |

**Recorded as equivalent** (skip):

- `schedulePurchaseFormUtils.js` L41 (`Number.isNaN` / `isFinite` guard) and L50 (`value < 0`). The price regex on L29 already rejects every input that could reach these, so they're unreachable, not untested.
- `userPreferencesUtils.js` L16 (`Array.isArray` guards in `sameList`). The page always passes arrays; `UserPreferences.jsx` normalizes `interests` on load.

**Real gaps left open (backlog).** These exported functions run under **no** test (every mutant NoCoverage):

| Module | Untested functions (mutant count) |
| --- | --- |
| `scheduleDateTimeUtils.js` | `validateScheduleDateTime` (112), `combineScheduleDateTime` (82), `getDateRangeMessage` (41), `getEasternTime` (41), `getScheduleDayOptions` (24), `convertTo24Hour` (20), `getScheduleMonthOptions` (13), `getScheduleYearOptions` (7), `getScheduleWindowBounds` (6). **Highest priority:** this is date and time-zone validation for scheduled purchases. |
| `chatContextUtils.js` | `createMessageApi`, `editLastMessageApi`, `deleteMessageApi`, `createImageMessageApi`, `tickFetchUnreadMessages`, `envBool`, `fetchConversationApi`, `fetchUnreadMessages`, `fetchConversations` |
| `scheduledPurchaseUtils.js` | `compareItemGroups` (67), `loadScheduledPurchases`, `createdAtMs` |
| `homeFeedUtils.js` | `computeExploreLimit`, `readStoredFeedTab`, `writeStoredFeedTab` |
| `searchResultsUtils.js` | `readIncludeDescriptionPreference`, `getSearchTitle` |
| `sellerDashboardUtils.js` | `listingStatusClass`, `truncateProductTitle`, plus the other four sort modes |
| `accountInfoUtils.js` | `isValidPhoneNumber` |
| `formatters.js` / `imageFallback.js` / `listingFormConfig.js` | `humanizeStatus`; `resolveStoredImageUrl`, `onProductImageError`; `getPreviewBoxSize` |

The remaining covered-but-surviving mutants (about 900) aren't individually triaged yet. By mutator: ConditionalExpression 312, StringLiteral 227 (mostly user-facing message text), LogicalOperator 110, MethodExpression 47, EqualityOperator 44, Regex 42, others 142.

The modules with the lowest scores among code that *is* tested: `ongoingPurchaseViewUtils.js` (16.9%), `homeFeedUtils.js` (27.2%), `chatContextUtils.js` (29.5%), `productDetails.js` (33.0%), `formatters.js` (37.6%). Triage them module by module with the per-mutant list in `reports/mutation/mutation.html`.
