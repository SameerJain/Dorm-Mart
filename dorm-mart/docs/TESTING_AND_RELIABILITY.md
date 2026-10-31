# Testing and Reliability

How Dorm Mart's automated tests run, the rule every test has to meet, and the record of the last audit for tests that could not fail.

## Suites

For the complete first-party test-file source inventory, open [TEST_CATALOG.md](TEST_CATALOG.md). Every file is enclosed in a collapsed section. Regenerate it after editing tests with `node scripts/generate-test-catalog.js` from `dorm-mart/`; `--check` verifies it is current without rewriting it.

| Command (from `dorm-mart/`) | What it runs |
| --- | --- |
| `npm test -- --watchAll=false` | Jest (react-scripts 5 / Jest 27): frontend tests under `src/__tests__/`, including adversarial tests under `src/__tests__/adversarial/` |
| `npm run test:backend` | Six CLI PHP scripts under `api/tests/` (no database, no network) |
| `npm run test:backend:integration` | `purchase_lifecycle_test.php` and `card_acceptance_test.php` over real HTTP (needs local MySQL) |
| `npm run test:mutation` | Stryker mutation run over the pure frontend helpers (see below) |
| `npm run lint:php` | `php -l` over every first-party PHP file |

**Jest always runs in UTC.** `scripts/jest-global-setup.js`, wired as Jest's `globalSetup` in `package.json`, sets `TZ` before any worker starts, so it applies to `npm test`, IDE runners and Stryker alike. The team and the scheduling code both use Eastern time. On an Eastern machine, a date missing its offset is read as local time and happens to be right, which hid a broken daylight-time branch (see the 2026-10-01 log). Write expectations as UTC instants or Eastern wall-clock values. Setting `process.env.TZ` in a test file does nothing, because Jest gives each file its own copy of `process.env`.

### HTTP integration suites

Both integration suites share `api/tests/support/integration_harness.php`. It creates a randomly named local database, migrates it, adds fixture users and logs them in, and starts a private `php -S`. It blanks the mail credentials, so no test can send email, and it drops the database on exit, even after an exception. A suite calls `harness_start('name', $users)` and then uses `api()`, `api_multipart()`, `http_get()`, `check()`, `error_is()` and `row()`, ending with `harness_finish()`. Set `HARNESS_KEEP_LOG=1` to keep the test server's PHP error log after a failed run; a 500 in a check is explained there.

`card_acceptance_test.php` turns the acceptance tests on the closed Scrum Board cards into API checks, one block per card. Where a card was written as a manual UI script, the check targets the API rule behind it and tries to break it: boundary values, other users' resources, forged CSRF tokens and origins, repeated requests. Two cards describe behavior that has since changed on purpose. `#60` expected an error for an unknown email, but forgot-password now answers every address the same way. `#37` expected deleting a chat on both sides to erase it, but messages are now kept for records. The suite pins the current contract and says so in a comment.

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
| Passes only in the developer's time zone | The daylight-time case of `combineScheduleDateTime` stayed green with its `-04:00` offset deleted, because a bare date read as local Eastern time landed on the same instant | Run tests in a zone the code does not convert to (now pinned to UTC) |
| Survivor that is really dead code | A mutant survives because the line it changes can never change the outcome: a special case the fallback already handles, or a guard an earlier check makes unreachable | Apply the deletion test. Remove the code instead of recording an equivalent mutant |

Negative UI checks (`queryBy…` → `toBeNull` / `not.toBeInTheDocument`) are safe only when another test shows the same query *does* match: same text, same accessible name. Otherwise a renamed label makes them pass forever.

## Mutation testing (Stryker)

Configuration: [`stryker.config.json`](../stryker.config.json). Run it with `npm run test:mutation`. The HTML report goes to `reports/mutation/mutation.html`, which is git-ignored.

- **Scope.** The `mutate` list holds only the pure helper modules that have their own unit or adversarial tests. Components are covered by the manual method above. Mutating them under jsdom is slow and mostly produces rendering-only survivors.
- **Timeouts and process cleanup.** `timeoutMS` is 10000 and `timeoutFactor` is 2. When a mutant times out (an infinite loop, say), Stryker kills that worker's whole process tree with `tree-kill` (`taskkill /T /F` on Windows), so no orphaned Jest processes are left. After a run, check that no stray `node` processes remain.
- **Delivery.** Stryker copies the project into `stryker-tmp/` and runs Jest there. It must **not** be the default `.stryker-tmp`: Jest 27 skips dot-directories, finds no tests, and the dry run fails with "No tests were executed". Before trusting a run, check that the dry run reports tests executed and that mutants already killed by hand (see the log below) show as *Killed*.
- **Triage, not a defect list.** Classify every survivor as a **real gap** (fix the test), **equivalent** (the change isn't observable; record it and skip) or **covered elsewhere** (say where).

## Audit log

### 2026-10-01: full Stryker run 3, triage, and card acceptance suite

**Full run** (`reports/mutation/full-run-3.json`): 3,300 mutants, 812 tests in the dry run, 31 m 41 s. Killed 3,022, Survived 253, NoCoverage 13, Timeout 4, RuntimeError 8. Run 2 had 493 survivors and 136 NoCoverage. The reports were written before Stryker exited. Only its cleanup crashed afterwards, with `taskkill` on a worker that had already exited, so the numbers stand. If a run ends that way, check that the log says "Done in" and remove any leftover `stryker-tmp/sandbox-*`.

**Triage, then a targeted rerun** of the seven modules changed (`reports/mutation/targeted-run-after-triage.json`, 172 tests):

| Module | Before → after | What changed |
| --- | --- | --- |
| `ongoingPurchaseViewUtils.js` | 52.8% → 100% | 63 of 67 survivors were Tailwind class text in style tables, now fenced with a reasoned `// Stryker disable StringLiteral,ObjectLiteral` and `restore` pair. The other four came from two dead special cases in `getStatusLabel`, since the generic capitalization already produced "Unsuccessful" and "Completed". Removed |
| `schedulePurchaseFormUtils.js` | 88.5% → 100% | Removed the NaN, infinity and negative guards that this log had recorded as equivalent: the digits-only pattern makes them unreachable |
| `chatPageUtils.js` | 88.5% → 96.8% | The `isVirtualPrompt` tie-break could never change the order, because `sort()` is stable and prompts are appended last. Removed, and the intended rule ("a real message in the same millisecond stays above the prompt") pinned with a test seen to fail when prompts are appended first |
| `scheduledPurchaseUtils.js` | 91.2% → 96.0% | `getScheduleBucket` had a condition the previous `return` already guaranteed, and a branch identical to its fallback. Rewritten to state each case once |
| `homeFeedUtils.js` | 95.0% → 97.2% | `if (width >= 768) return 30` returned the minimum (30) anyway. Removed |
| `scheduleDateTimeUtils.js` | 95.0% → 95.3% | Pinning Jest to UTC killed the daylight-time `-04:00` mutant, which had survived only because this machine runs Eastern time |
| `sellerDashboardUtils.js` | 93.2% → 94.2% | An unknown status taking the "sold" color survived because distinctness checks cannot see two styles trading places. Added "an unknown status looks neutral" |

**Recorded as equivalent** (checked, not tested):

- `scheduleDateTimeUtils.js`: L52 (the en-US formatter always emits `MM/DD/YYYY, HH:MM`); L58–62 (the two offsets differ by one hour, so the hour comparison alone decides); L103 (`<= 1` and `>= 12` still return 31); L177/L180 (dropping the year comparison only matters if a month number repeats within the three-month window, which it cannot).
- `accountCreationRequest.js` L51/L59 (`readRateLimit` has already reset the state at `now === blockedUntil`), and the L23 guards (the surrounding `try/catch` gives the same result).
- `formatters.js` L19/L23/L39/L62/L124: early returns whose fall-through produces the same `null`.
- `sellerDashboardUtils.js` `listingStatusClass` class text. It is not fenced off, because the same lines hold the status comparisons, which *are* behavior.

**Card acceptance suite** (`api/tests/card_acceptance_test.php`, 105 checks across 25 closed cards). All 105 passed on the first run, which proves nothing yet, so each card's main rule was then broken in the source and the matching check watched: 16 of 16 mutations went red (`#64` lockout count and email case, `#34` length and character counting, `#48` review length, `#24` own-listing chat, `#37` outsider delete, `#25` typing expiry, `#72` origin check, `#60` timing floor, upload quota, `#93` terms, `#33` 2 MB image limit, `#47` own-item wishlist, `#55` single-use token, `#23` another buyer's response).

**Schedule proposal rules** (`api/tests/schedule_proposal_test.php`, 48 checks). These cover the time-window, price, trade and meet-location rules that moved out of `scheduled_purchases/create.php` into `proposal.php`, at exact edges with a fixed clock. 8 of 8 mutations went red, including restoring the old byte count (`strlen`), which reproduced a real bug: a 30-character place name with an accent passed the form and was refused by the server.

The 2026-09-30 backlog of untested functions below is superseded. Run 3 left 13 NoCoverage mutants, none of them a whole untested function. Seven were in code removed above. The other six are single branches inside tested functions: a server-side `window` guard (`listingFormConfig` L76), `bestBucketKey`'s unreachable empty fallback (`scheduledPurchaseUtils` L80), the `statusFilter` comparison (`sellerDashboardUtils` L75), the invalid-date label (`accountInfoUtils` L12), and a URL-parse `catch` (`imageFallback` L16–17).

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
