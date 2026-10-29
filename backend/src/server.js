// Oread API server entry point: loads config, the lorebook and storage, then listens for HTTP.
import http from "node:http";
import { loadConfig } from "./config.js";
import { loadLore } from "./lore/loadLore.js";
import { createFileStore } from "./storage/fileStore.js";
import { PROVIDERS } from "./providers/index.js";
import { createApp, API_PREFIX } from "./app.js";

const config = loadConfig();

const app = createApp({
  lore: loadLore(config.lorePath),
  store: createFileStore(config.dataDir),
  providers: PROVIDERS,
  corsOrigins: config.corsOrigins,
});

function announceListening() {
  console.log(`Oread API listening on http://${config.host}:${config.port}${API_PREFIX}`);
}

http.createServer(app).listen(config.port, config.host, announceListening);
