// Jest transform for everything that is not JavaScript or JSON (wired in
// package.json "jest"). A stylesheet becomes an empty object and any other
// asset (image, PDF, font) becomes its file name, so `import logo from
// "./logo.png"` gives a test the string "logo.png".
const path = require("node:path");

module.exports = {
  process(_source, filename) {
    if (/\.css$/i.test(filename)) {
      return { code: "module.exports = {};" };
    }
    return { code: `module.exports = ${JSON.stringify(path.basename(filename))};` };
  },
  getCacheKey(_source, filename) {
    return `asset:${filename}`;
  },
};
