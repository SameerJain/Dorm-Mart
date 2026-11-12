#!/usr/bin/env node
// Wooden stake for the test garden. Fails when a test checks nothing or locks
// an implementation detail, so weeds cannot grow back unnoticed.
// Usage: node scripts/check-no-useless-tests.js   (run from dorm-mart/)

const fs = require("fs");
const path = require("path");

const TESTS = path.join(__dirname, "..", "src", "__tests__");

function testFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return testFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

function checkFile(file) {
  const source = fs.readFileSync(file, "utf8");
  const problems = [];
  const rel = path.relative(path.join(__dirname, ".."), file).replace(/\\/g, "/");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const lineNo = index + 1;
    // getBy and findBy throw when the element is missing, so wrapping them in
    // toBeTruthy checks nothing. Use toBeInTheDocument instead.
    if (/(getBy|getAllBy|findBy|findAllBy)[A-Za-z]*\(.*\)\)\.toBeTruthy\(\)/.test(line)) {
      problems.push(`${rel}:${lineNo} wraps a getBy/findBy query in toBeTruthy, which checks nothing. Use toBeInTheDocument.`);
    }
    if (/(queryBy[A-Za-z]*\(.*\)\)\.toBeTruthy\(\))/.test(line)) {
      problems.push(`${rel}:${lineNo} wraps a queryBy query in toBeTruthy, which checks nothing. Assert toBeInTheDocument or toBeNull.`);
    }
    // Locking the HTML tag or CSS class makes the test break on redesign
    // without catching a bug. Assert behavior, labels, or text instead.
    if (/\.tagName\)\.toBe\(/.test(line)) {
      problems.push(`${rel}:${lineNo} asserts tagName, which locks markup. Assert behavior or an accessible label instead.`);
    }
    if (/\.className\)\.to(Contain|Be)\(/.test(line)) {
      problems.push(`${rel}:${lineNo} asserts className, which locks CSS. Assert behavior or visible text instead.`);
    }
    if (/\.toHaveClass\(/.test(line)) {
      problems.push(`${rel}:${lineNo} asserts CSS classes, which lock styling. Assert an aria attribute or visible text instead.`);
    }
  });

  // Scroll lock is platform behavior. It is tested once in
  // hooks/useBodyScrollLock.test.js. Dialog tests must not duplicate it.
  if (!/hooks[\\/]useBodyScrollLock\.test\.js$/.test(file)) {
    if (/body\.style\.position/.test(source)) {
      problems.push(`${rel} asserts body.style.position. Scroll lock is tested once in hooks/useBodyScrollLock.test.js.`);
    }
  }

  // Adversarial duplicates were removed because each one repeated the main
  // utils suite with the same malformed inputs. Put new boundary cases in
  // the main suite file instead of a second adversarial file.
  if (/\.adversarial\.test\.(js|jsx)$/.test(file)) {
    problems.push(`${rel} is an adversarial duplicate file. Move the case into the main suite file and delete this file.`);
  }

  return problems;
}

const files = testFiles(TESTS);
const problems = files.flatMap(checkFile);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} useless test pattern(s) found. Fix the assertions before merging.`);
  process.exit(1);
}
console.log("No useless test patterns: queries assert presence, no tag or class locks, no adversarial duplicates.");
