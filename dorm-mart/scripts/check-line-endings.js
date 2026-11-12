#!/usr/bin/env node
// Fails when a first-party text file mixes Windows (CRLF) and Unix (LF) line
// endings line by line. A mixed file renders and diffs unpredictably, so each
// file must pick one ending. Fix with: python3 -c (normalize to the dominant
// ending) or, for a repo-wide pass, git add --renormalize . in its own commit.
// Usage: node scripts/check-line-endings.js   (run from dorm-mart/)

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
// Third-party, generated or binary output is not ours to normalize.
const SKIP_DIRS = new Set([".git", "node_modules", "vendor", "build", "coverage", "stryker-tmp", ".idea", ".vscode"]);
const SKIP_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".ico", ".webp", ".pdf", ".woff", ".woff2", ".ttf", ".eot", ".mp4", ".webm"]);
const SKIP_FILES = new Set(["package-lock.json"]);
// Live env files are gitignored local copies; only the template is policed.
const SKIP_ENV = /^\.env(\..+)?$/;
const TEMPLATE_ENV = ".env.example";

function textFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    const rel = path.relative(root, full).replace(/\\/g, "/");
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : textFiles(full);
    if (entry.name === TEMPLATE_ENV) return [full];
    if (SKIP_ENV.test(entry.name)) return [];
    if (SKIP_FILES.has(entry.name) || SKIP_EXT.has(path.extname(entry.name).toLowerCase())) return [];
    if (entry.name.endsWith(".min.js") || entry.name.endsWith(".min.css")) return [];
    return [full];
  });
}

const problems = [];
for (const file of textFiles(root)) {
  const data = fs.readFileSync(file);
  if (data.includes(0)) continue; // binary
  const crlf = data.toString("binary").split("\r\n").length - 1;
  const lf = data.toString("binary").split("\n").length - 1 - crlf;
  const loneCR = /[^\n]\r[^\n]/.test(data.toString("binary"));
  if ((crlf > 0 && lf > 0) || loneCR) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    problems.push(`${rel}: mixes line endings (CRLF lines: ${crlf}, LF lines: ${lf})`);
  }
}

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} file(s) with mixed line endings. Normalize each file to one ending.`);
  process.exit(1);
}
console.log("Line endings: every first-party text file uses one ending.");
