import { getConfig } from "./storage.js";
import { sanitizePayload } from "./security.js";

async function log(level, message, data = null) {
  let debugMode = false;
  try {
    const config = await getConfig();
    debugMode = !!config.debugMode;
  } catch (e) {
    // Fallback if storage not available yet
  }

  if (level === "debug" && !debugMode) {
    return;
  }

  const cleanData = data ? sanitizePayload(data) : "";
  const prefix = `[ExtensionA][${level.toUpperCase()}][${new Date().toISOString()}]`;

  if (level === "error") {
    if (cleanData) {
      console.error(prefix, message, cleanData);
    } else {
      console.error(prefix, message);
    }
  } else if (level === "warn") {
    if (cleanData) {
      console.warn(prefix, message, cleanData);
    } else {
      console.warn(prefix, message);
    }
  } else {
    if (cleanData) {
      console.log(prefix, message, cleanData);
    } else {
      console.log(prefix, message);
    }
  }
}

export const logger = {
  debug: (msg, data) => log("debug", msg, data),
  info: (msg, data) => log("info", msg, data),
  warn: (msg, data) => log("warn", msg, data),
  error: (msg, data) => log("error", msg, data)
};
export default logger;
