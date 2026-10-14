// Keep CRA's startup flow while adapting its dev-server options to webpack-dev-server 5.
const { createRequire } = require("node:module");
const serverPath = require.resolve("webpack-dev-server");
const WebpackDevServer = require(serverPath);
const express = createRequire(serverPath)("express");

class CraDevServer extends WebpackDevServer {
  constructor(options, compiler) {
    const {
      https,
      onBeforeSetupMiddleware,
      onAfterSetupMiddleware,
      ...config
    } = options;

    config.server = https
      ? { type: "https", options: typeof https === "object" ? https : {} }
      : "http";
    // CRA's wildcard CORS headers disable part of the dev server's origin protection.
    config.headers = {};
    // Let v5 validate hosts without treating CRA's detected LAN IP as a CORS exception.
    config.allowedHosts = "auto";
    config.setupMiddlewares = (middlewares, devServer) => {
      const before = express.Router();
      const after = express.Router();
      const context = Object.create(devServer);

      context.app = before;
      onBeforeSetupMiddleware(context);
      context.app = after;
      onAfterSetupMiddleware(context);

      // Preserve CRA's hooks without placing source/proxy access ahead of security checks.
      const index = middlewares.findIndex(
        (middleware) => middleware.name === "webpack-dev-middleware"
      );
      middlewares.splice(index, 0, { name: "cra-before", middleware: before });
      middlewares.push({ name: "cra-after", middleware: after });
      return middlewares;
    };

    super(config, compiler);
  }

  // CRA's source overlay still reads the dev server's old stats property.
  get _stats() {
    return this.stats;
  }

  close(callback) {
    this.stopCallback(callback);
  }
}

require.cache[serverPath].exports = CraDevServer;
require("react-scripts/scripts/start");
