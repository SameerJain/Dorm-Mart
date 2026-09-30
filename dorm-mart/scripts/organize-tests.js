// Consolidate frontend tests without changing the modules they import or mock.
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const root = path.resolve(__dirname, "..");
const src = path.join(root, "src");
const tests = path.join(src, "__tests__");
const slash = (value) => value.replace(/\\/g, "/");

function filesUnder(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(file) : [file];
  });
}

const moves = new Map(filesUnder(src)
  .filter((file) => /\.(test|spec)\.(js|jsx)$/.test(file) && !file.startsWith(tests + path.sep))
  .map((file) => [file, path.join(tests, path.relative(src, file)
    .replace(/^__adversarial_tests__[\\/]/, "adversarial/"))]));

for (const [before, after] of moves) {
  if (fs.existsSync(after)) throw new Error(`Destination already exists: ${after}`);
  let source = fs.readFileSync(before, "utf8");
  const edits = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    let reference;
    if (["ImportDeclaration", "ExportNamedDeclaration", "ExportAllDeclaration"].includes(node.type)) {
      reference = node.source;
    } else if (node.type === "CallExpression") {
      const callee = node.callee;
      if (callee.type === "Import" ||
          (callee.type === "Identifier" && callee.name === "require") ||
          (callee.type === "MemberExpression" && callee.object.name === "jest" &&
            ["mock", "doMock", "unmock", "requireActual", "requireMock"].includes(callee.property.name))) {
        reference = node.arguments[0];
      }
    }
    if (reference?.type === "StringLiteral" && reference.value.startsWith(".")) {
      const target = path.resolve(path.dirname(before), reference.value);
      let relative = slash(path.relative(path.dirname(after), moves.get(target) || target));
      if (!relative.startsWith(".")) relative = `./${relative}`;
      edits.push({ start: reference.start + 1, end: reference.end - 1, value: relative });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === "object") visit(value);
    }
  }
  visit(parser.parse(source, { sourceType: "unambiguous", plugins: ["jsx"] }));
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.value + source.slice(edit.end);
  }
  fs.mkdirSync(path.dirname(after), { recursive: true });
  fs.writeFileSync(after, source);
  fs.unlinkSync(before);
}

// Update references to moved tests in maintained documentation and catalog tools.
for (const file of [...filesUnder(path.join(root, "docs")), path.join(__dirname, "generate-test-catalog.js")]) {
  if (!/\.(md|js)$/.test(file) || file.endsWith("TEST_CATALOG.md")) continue;
  const original = fs.readFileSync(file, "utf8");
  let updated = original;
  for (const [before, after] of moves) {
    updated = updated.split(slash(path.relative(root, before))).join(slash(path.relative(root, after)));
  }
  if (updated !== original) fs.writeFileSync(file, updated);
}
const oldAdversarial = path.join(src, "__adversarial_tests__");
const fixtures = path.join(oldAdversarial, "fixtures");
if (fs.existsSync(fixtures)) {
  const destination = path.join(tests, "adversarial", "fixtures");
  if (fs.existsSync(destination)) throw new Error(`Destination already exists: ${destination}`);
  fs.renameSync(fixtures, destination);
}
if (fs.existsSync(oldAdversarial) && fs.readdirSync(oldAdversarial).length === 0) {
  fs.rmdirSync(oldAdversarial);
}
console.log(`Moved ${moves.size} frontend tests into src/__tests__/.`);
