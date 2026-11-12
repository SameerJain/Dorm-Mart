// Jest transform for source and test files (wired in package.json "jest").
// The Babel options live here rather than in a babel.config.js so that only
// Jest uses them: Vite compiles the app itself and must not pick them up.
const babelJest = require("babel-jest");

module.exports = babelJest.createTransformer({
  babelrc: false,
  configFile: false,
  presets: [
    [require.resolve("@babel/preset-env"), { targets: { node: "current" } }],
    [require.resolve("@babel/preset-react"), { runtime: "automatic" }],
  ],
});
