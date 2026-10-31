// Keep the Markdown test source catalog reproducible without running any tests.
const fs = require("fs");
const path = require("path");
const root = path.join(__dirname, "..");

function filesUnder(directory) {
  return fs.readdirSync(path.join(root, directory), { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name, "en"))
    .flatMap((entry) => {
      const relative = `${directory}/${entry.name}`;
      return entry.isDirectory() ? filesUnder(relative) : [relative];
    });
}

const groups = [
  ["Frontend Jest tests", filesUnder("src/__tests__").filter((file) => /\.test\.(js|jsx)$/.test(file))],
  ["Backend CLI checks and manual demonstrations", filesUnder("api/tests").filter((file) => !file.includes("/integration/") && file.endsWith(".php") && !file.endsWith("/bootstrap.php"))],
  ["HTTP integration and scenario checks", filesUnder("api/tests/integration").filter((file) => /\.(php|sh)$/.test(file))],
];

let markdown = `# Dorm Mart test catalog

Generated from first-party test files with \`node scripts/generate-test-catalog.js\` from \`dorm-mart/\`. Each test file is enclosed in a collapsed section with its complete source. Edit the original test file, then regenerate this document.

This is an inventory, not a test-run result. See [TESTING_AND_RELIABILITY.md](TESTING_AND_RELIABILITY.md) for execution and test-strength guidance, and [api/tests/README.md](../api/tests/README.md) for backend prerequisites.

## Commands

Run from \`dorm-mart/\`:

| Command | Scope |
| --- | --- |
| \`npm test -- --watchAll=false\` | All frontend Jest tests |
| \`npm test -- --watchAll=false --runTestsByPath src/__tests__/utils/apiClient.test.js\` | One frontend test file; replace the path as needed |
| \`npm run test:backend\` | Five offline PHP scripts named in package.json |
| \`npm run test:backend:integration\` | Disposable local database and HTTP purchase lifecycle |
| \`npm run lint:php\` | PHP syntax checks, not behavioral tests |
| \`npm run test:mutation -- --mutate src/pages/Settings/userPreferencesUtils.js\` | Targeted mutation audit; requires installed Stryker |

HTTP scenario scripts require a running local API and may require \`API_TEST_LOGIN_EMAIL\`, \`API_TEST_LOGIN_PASSWORD\`, and \`API_TEST_BASE_URL\`. Inspect them before execution: some send email or affect lockouts/data, and some report verdicts in JSON/HTML rather than a failing process exit. The Bash rate-limit script prints requests and has historical threshold comments; verify current policy in source. Its output alone is not an automated pass/fail verdict.

The XSS encoding file is a manual HTML demonstration; the router blocks direct HTTP access to \`api/tests\`. Do not weaken that guard to run it. \`db_connection_test.php\` needs the configured database. Neither is part of the five offline checks.

Excluded: vendor tests, SQL seed data, images, test support \`api/tests/bootstrap.php\`, and \`api/payments/*webhook*test.php\` (Stripe test-mode endpoint handlers).

## Inventory

`;
for (const [title, files] of groups) {
  markdown += `### ${title} (${files.length} files)\n\n`;
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n").trimEnd();
    const ticks = Math.max(3, ...Array.from(source.matchAll(/`+/g), (match) => match[0].length + 1));
    const fence = "`".repeat(ticks);
    const language = file.endsWith(".php") ? "php" : file.endsWith(".sh") ? "bash" : file.endsWith(".jsx") ? "jsx" : "javascript";
    markdown += `<details>\n<summary>${file}</summary>\n\n[Open source](../${file})\n\n${fence}${language}\n${source}\n${fence}\n\n</details>\n\n`;
  }
}
const output = path.join(root, "docs", "TEST_CATALOG.md");
if (process.argv.includes("--check")) {
  if (!fs.existsSync(output) || fs.readFileSync(output, "utf8") !== markdown) {
    console.error("Test catalog is stale. Run node scripts/generate-test-catalog.js.");
    process.exit(1);
  }
  console.log("Test catalog matches all current test sources.");
} else {
  fs.writeFileSync(output, markdown);
  console.log(`Wrote ${groups.reduce((count, [, files]) => count + files.length, 0)} test files to docs/TEST_CATALOG.md.`);
}
