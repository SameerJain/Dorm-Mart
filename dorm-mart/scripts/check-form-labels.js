#!/usr/bin/env node
// Fails when a text field, dropdown or textarea has no name a screen reader can
// read: no aria-label, no aria-labelledby, no <label htmlFor> pointing at its
// id, and no <label> wrapped around it. The jsx-a11y lint checks that labels
// have controls; this checks the opposite direction, which it does not cover.
// Usage: node scripts/check-form-labels.js   (run from dorm-mart/)

const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const SELF_NAMED_TYPES = /type=["'](hidden|file|checkbox|radio|submit|button|range)["']/;

function jsxFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : jsxFiles(full);
    return entry.name.endsWith(".jsx") ? [full] : [];
  });
}

/** Text of the opening tag starting at `start`, honouring braces so `=>` is not read as the end. */
function openingTag(source, start) {
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return source.slice(start, i + 1);
  }
  return source.slice(start);
}

function findUnlabeled(file) {
  const source = fs.readFileSync(file, "utf8");
  const problems = [];
  const tagStart = /<(input|select|textarea)\b/g;
  let match;
  while ((match = tagStart.exec(source))) {
    const tag = openingTag(source, match.index);
    if (SELF_NAMED_TYPES.test(tag)) continue;
    if (/aria-label(ledby)?=/.test(tag)) continue;
    // {...props} may carry the id and label wiring from the caller.
    if (/\{\.\.\./.test(tag)) continue;

    const id = /\bid=(?:"([^"]+)"|'([^']+)'|\{([^}]+)\})/.exec(tag);
    if (id) {
      const key = (id[1] || id[2] || id[3]).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      if (new RegExp(`htmlFor=(?:"${key}"|'${key}'|\\{${key}\\})`).test(source)) continue;
    }

    const before = source.slice(0, match.index);
    if (before.lastIndexOf("<label") > before.lastIndexOf("</label>")) continue;

    const line = before.split("\n").length;
    problems.push(`${path.relative(path.join(SRC, ".."), file).replace(/\\/g, "/")}:${line} <${match[1]}> has no accessible name`);
  }
  return problems;
}

const problems = jsxFiles(SRC).flatMap(findUnlabeled);
if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} form field(s) without a label. Add a <label htmlFor>, wrap the field in a <label>, or give it an aria-label.`);
  process.exit(1);
}
console.log("Form labels: every text field, dropdown and textarea has an accessible name.");
