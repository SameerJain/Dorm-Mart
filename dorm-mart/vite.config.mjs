import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { defineConfig, transformWithOxc } from "vite";
import react from "@vitejs/plugin-react";

const packageJson = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8"));

// The app reads its build-time settings as process.env.REACT_APP_*,
// process.env.PUBLIC_URL and process.env.NODE_ENV (see src/utils/apiConfig.js),
// and the Jest tests read the same names from the real process.env. So the
// names stay, and this file resolves them the way Create React App did:
// a variable already in the environment wins (env-cmd in the npm scripts,
// Docker ARGs on Railway), then the first env file that defines it.
function frontendEnv(nodeEnv) {
  const values = { ...process.env };
  const files = [`.env.${nodeEnv}.local`, ".env.local", `.env.${nodeEnv}`, ".env"];
  for (const file of files) {
    const url = new URL(`./${file}`, import.meta.url);
    if (!existsSync(url)) continue;
    for (const [key, value] of Object.entries(parseEnv(readFileSync(url, "utf8")))) {
      if (!(key in values)) values[key] = value;
    }
  }
  return values;
}

// Base path for built assets, with Create React App's rules: PUBLIC_URL if
// set, else "homepage" in package.json, else "/". The dev server always
// serves from the root unless PUBLIC_URL names a sub-path.
function publicBase(isDev, publicUrl, homepage) {
  const withSlash = (value) => (value.endsWith("/") ? value : `${value}/`);
  const pathOf = (value) => new URL(value, "http://localhost").pathname;
  if (publicUrl) {
    const url = withSlash(publicUrl);
    if (!isDev) return url;
    return url.startsWith(".") ? "/" : pathOf(url);
  }
  if (homepage) {
    const url = withSlash(homepage);
    if (url.startsWith(".")) return isDev ? "/" : url;
    return pathOf(url);
  }
  return "/";
}

// Vite only reads JSX in .jsx files. src/index.js (and any other .js file
// under src/ that holds JSX) keeps its name and is compiled here instead.
function jsxInJsFiles() {
  return {
    name: "dorm-mart:jsx-in-js",
    enforce: "pre",
    async transform(code, id) {
      const file = id.split("?")[0].replaceAll("\\", "/");
      if (!file.endsWith(".js") || !file.includes("/src/") || file.includes("/node_modules/")) return null;
      const result = await transformWithOxc(code, file, {
        lang: "jsx",
        jsx: { runtime: "automatic", development: this.environment.mode === "dev" },
      });
      return { code: result.code, map: result.map };
    },
  };
}

export default defineConfig(({ command }) => {
  const isDev = command === "serve";
  const nodeEnv = isDev ? "development" : "production";
  const env = frontendEnv(nodeEnv);
  const base = publicBase(isDev, env.PUBLIC_URL, packageJson.homepage);

  // Only these reach the bundle. Everything else in the env files is a
  // server secret.
  const exposed = { NODE_ENV: nodeEnv, PUBLIC_URL: base.replace(/\/$/, "") };
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("REACT_APP_")) exposed[key] = value;
  }

  return {
    base,
    // Vite must not read the env files itself: they also hold PHP secrets,
    // and its file order differs from the one above.
    envDir: false,
    define: { "process.env": JSON.stringify(exposed) },
    plugins: [jsxInJsFiles(), react()],
    // The dev server's dependency scan: start from the app only (not other
    // HTML such as the Stryker report) and let it read JSX in .js files.
    optimizeDeps: {
      entries: ["index.html"],
      rolldownOptions: { moduleTypes: { ".js": "jsx" } },
    },
    build: {
      // router.php, the Dockerfile and build-scripts-win all serve build/.
      outDir: "build",
      assetsDir: "static",
      sourcemap: false,
    },
    server: {
      port: 3000,
      // BROWSER=none keeps the tab closed, as it did under Create React App.
      open: env.BROWSER !== "none",
      // Same-origin requests for the PHP side go to `npm run start:api`.
      proxy: {
        "^/(api|images|media|data)/": "http://localhost:8080",
      },
    },
  };
});
