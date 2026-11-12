#!/usr/bin/env node
// Fails when a file that may hold real secrets is tracked by git. History
// already contains dorm-mart/.env.cattle and dorm-mart/.env.local (their old
// values must be treated as burned), so this guard keeps new secret files
// from being committed on top. Local untracked copies are fine.
// Usage: node scripts/check-no-secrets.js   (run from dorm-mart/)

const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.join(__dirname, "..", "..");

// Any tracked file whose name looks like a live secret, never a template.
// .env.example is the only env file that may be tracked.
const TRACKED_NAME = /(^|\/)\.env(\..+)?$|(^|\/)\.env\..*\.local$|\.pem$|\.key$|(^|\/)id_rsa([^.]*)$|(^|\/)cookies.*\.txt$/;
const ALLOWED = new Set(["dorm-mart/.env.example"]);

const result = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "buffer" });
if (result.error) {
  console.error(`Unable to run git: ${result.error.message}`);
  process.exit(2);
}
if (result.status !== 0) {
  console.error((result.stdout || "") + (result.stderr || ""));
  process.exit(2);
}

const tracked = result.stdout.toString("utf8").split("\0").filter(Boolean);
const problems = tracked
  .map((file) => file.replace(/\\/g, "/"))
  .filter((file) => TRACKED_NAME.test(file) && !ALLOWED.has(file))
  .map((file) => `${file}: secret-bearing file is tracked; git rm --cached it and use an untracked local copy`);

if (problems.length > 0) {
  console.error(problems.join("\n"));
  console.error(`\n${problems.length} tracked secret file(s).`);
  process.exit(1);
}
console.log(`Secrets: ${tracked.length} tracked files, none look like live secret files.`);
