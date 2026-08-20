const fs = require("fs");
const path = require("path");

const sourceRoots = ["src", "api"];
const sourceExtensions = new Set([".js", ".jsx", ".php"]);

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return sourceExtensions.has(path.extname(entry.name)) ? [entryPath] : [];
  });
}

const files = sourceRoots.flatMap(sourceFiles).map((file) => {
  const source = fs.readFileSync(file, "utf8");
  return {
    file,
    lines: source.split(/\r?\n/).length,
    directFetches: (source.match(/\bfetch\s*\(/g) || []).length,
    dateConstructions: (source.match(/new Date\s*\(/g) || []).length,
  };
});

function printSection(title, rows) {
  console.log(`\n${title}`);
  for (const row of rows) console.log(row);
}

printSection(
  "Files over 300 lines",
  files
    .filter(({ lines }) => lines > 300)
    .sort((a, b) => b.lines - a.lines)
    .map(({ file, lines }) => `${String(lines).padStart(4)}  ${file}`),
);

printSection(
  "Frontend files with direct fetch calls",
  files
    .filter(({ file, directFetches }) => file.startsWith("src") && directFetches)
    .sort((a, b) => b.directFetches - a.directFetches || a.file.localeCompare(b.file))
    .map(({ file, directFetches }) => `${String(directFetches).padStart(4)}  ${file}`),
);

printSection(
  "Frontend files constructing dates outside shared formatters",
  files
    .filter(
      ({ file, dateConstructions }) =>
        file.startsWith("src") &&
        file !== path.join("src", "utils", "formatters.js") &&
        dateConstructions,
    )
    .sort(
      (a, b) =>
        b.dateConstructions - a.dateConstructions || a.file.localeCompare(b.file),
    )
    .map(
      ({ file, dateConstructions }) =>
        `${String(dateConstructions).padStart(4)}  ${file}`,
    ),
);
