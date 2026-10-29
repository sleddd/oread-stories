// Runtime configuration, read from environment variables with sensible local defaults.
import path from "node:path";
import { fileURLToPath } from "node:url";

const BACKEND_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 4317;
const DEFAULT_HOST = "127.0.0.1";
// Origins allowed to call the API from a browser: the frontend's dev server address.
const DEFAULT_CORS_ORIGINS = "http://127.0.0.1:5173,http://localhost:5173";

function parseOriginList(commaSeparatedOrigins) {
  const origins = commaSeparatedOrigins.split(",");
  const trimmedOrigins = origins.map((origin) => origin.trim());
  return trimmedOrigins.filter(Boolean);
}

export function loadConfig(environment = process.env) {
  return {
    port: Number(environment.PORT) || DEFAULT_PORT,
    host: environment.HOST || DEFAULT_HOST,
    dataDir: environment.OREAD_DATA || path.join(BACKEND_ROOT, "data"),
    lorePath: environment.OREAD_LORE || path.join(BACKEND_ROOT, "lore", "lore.json"),
    corsOrigins: parseOriginList(environment.CORS_ORIGINS || DEFAULT_CORS_ORIGINS),
  };
}
