// Runtime configuration, read from environment variables with sensible local defaults.
// The hosted settings (database, accounts, email) are only used when OREAD_MULTI_TENANT=true and
// DATABASE_URL is set; see tenancy/storageMode.js.
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

function publicUrlFor(environment, host, port) {
  return (environment.OREAD_PUBLIC_URL || `http://${host}:${port}`).replace(/\/+$/, "");
}

export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT) || DEFAULT_PORT;
  const host = environment.HOST || DEFAULT_HOST;
  const corsOrigins = parseOriginList(environment.CORS_ORIGINS || DEFAULT_CORS_ORIGINS);
  const publicUrl = publicUrlFor(environment, host, port);
  return {
    port,
    host,
    dataDir: environment.OREAD_DATA || path.join(BACKEND_ROOT, "data"),
    lorePath: environment.OREAD_LORE || path.join(BACKEND_ROOT, "lore", "lore.json"),
    storyTemplatesDir:
      environment.OREAD_STORY_TEMPLATES || path.join(BACKEND_ROOT, "lore", "storyTemplates"),
    storyConfigPath:
      environment.OREAD_STORY_ENGINE || path.join(BACKEND_ROOT, "lore", "storyEngine.json"),
    // Where the local emotion model is cached after its one-time download.
    modelCacheDir: environment.OREAD_MODEL_CACHE || path.join(BACKEND_ROOT, "models"),
    corsOrigins,
    // Hosted mode.
    databaseUrl: environment.DATABASE_URL || "",
    isMultiTenant: environment.OREAD_MULTI_TENANT === "true",
    // 32 random bytes, base64: encrypts each user's provider keys.
    secretKey: environment.OREAD_SECRET_KEY || "",
    authSecret: environment.BETTER_AUTH_SECRET || "",
    // The address people open Oread at; links in emails point here.
    publicUrl,
    trustedOrigins: [...new Set([publicUrl, ...corsOrigins])],
    useSecureCookies: publicUrl.startsWith("https://"),
    isAuthRateLimited: environment.OREAD_AUTH_RATE_LIMIT !== "false",
    resendApiKey: environment.RESEND_API_KEY || "",
    mailFrom: environment.OREAD_MAIL_FROM || "",
  };
}
