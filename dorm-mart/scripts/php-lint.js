// Syntax-check every first-party PHP file with `php -l`.
// Usage: npm run lint:php   (set PHP_BINARY to use a php that is not on PATH)
const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const sourceRoots = ["api", "scripts", "router.php"];
const php = process.env.PHP_BINARY || "php";

function phpFiles(target) {
  const stat = fs.statSync(target);
  if (stat.isFile()) return target.endsWith(".php") ? [target] : [];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === "vendor" || entry.name === "node_modules") return [];
    return phpFiles(path.join(target, entry.name));
  });
}

const files = sourceRoots
  .map((entry) => path.join(root, entry))
  .filter((entry) => fs.existsSync(entry))
  .flatMap(phpFiles);

const failures = files.filter((file) => {
  const result = spawnSync(php, ["-l", file], { encoding: "utf8" });
  if (result.error) {
    console.error(`Unable to run "${php}": ${result.error.message}`);
    process.exit(2);
  }
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    return true;
  }
  return false;
});

console.log(`php -l: ${files.length - failures.length}/${files.length} files passed`);
process.exit(failures.length ? 1 : 0);
