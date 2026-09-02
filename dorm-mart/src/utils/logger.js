const isDev = process.env.NODE_ENV !== "production";

const logger = {
  error: isDev ? console.error.bind(console) : () => {},
  warn:  isDev ? console.warn.bind(console)  : () => {},
  log:   isDev ? console.log.bind(console)   : () => {},
};

export default logger;
