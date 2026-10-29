// Reads backend/.env into process.env when the file exists, so `npm start` picks up the database
// and account settings without extra flags. Values already set in the environment win, which is
// how a host like Render passes its own settings.
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const THIS_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const ENVIRONMENT_FILE_PATH = path.join(THIS_DIRECTORY, "../.env");

export function loadEnvironmentFile(filePath = ENVIRONMENT_FILE_PATH) {
  if (!existsSync(filePath)) {
    return false;
  }
  process.loadEnvFile(filePath);
  return true;
}
