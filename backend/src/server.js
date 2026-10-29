// Oread API server entry point: loads config, the lorebook, the story engine and storage, then
// listens for HTTP. The local emotion and memory search models warm up in the background.
// Locally (the default) data lives in JSON files and there is no login; hosted mode
// (tenancy/storageMode.js) uses Postgres and accounts, and loads its modules only then.
import http from "node:http";
import { loadConfig } from "./config.js";
import { loadLore } from "./lore/loadLore.js";
import { loadStoryConfig } from "./story/loadStoryConfig.js";
import { loadStoryTemplates } from "./stories/loadStoryTemplates.js";
import { createFileStore } from "./storage/fileStore.js";
import { PROVIDERS } from "./providers/index.js";
import { createEmotionClassifier } from "./services/emotionClassifier.js";
import { createEmbeddingModel } from "./memory/embeddingModel.js";
import { createApp, API_PREFIX } from "./app.js";
import { storageModeFor, HOSTED_MODE } from "./tenancy/storageMode.js";
import { loadEnvironmentFile } from "./loadEnvironmentFile.js";

loadEnvironmentFile();
const config = loadConfig();
const lore = loadLore(config.lorePath);
const storyConfig = loadStoryConfig(config.storyConfigPath);

const emotionClassifier = createEmotionClassifier({
  modelId: storyConfig.emotionModel.id,
  dtype: storyConfig.emotionModel.dtype,
  cacheDirectory: config.modelCacheDir,
});

const embedder = createEmbeddingModel({ cacheDirectory: config.modelCacheDir });

const serviceOptions = {
  storyTemplates: loadStoryTemplates(lore, config.storyTemplatesDir),
  providers: PROVIDERS,
  storyConfig,
  emotionClassifier,
  embedder,
};
const storageMode = storageModeFor(config);

async function createHostedTenancy() {
  const { createPrismaClient } = await import("./storage/prisma/prismaClient.js");
  const { createResendMailer } = await import("./mail/createResendMailer.js");
  const { createHostedSetup } = await import("./tenancy/createHostedSetup.js");
  const hosted = createHostedSetup({
    config,
    lore,
    prisma: createPrismaClient(config.databaseUrl),
    mailer: createResendMailer({ apiKey: config.resendApiKey, from: config.mailFrom }),
    serviceOptions,
  });
  return hosted.tenancy;
}

let tenancy;
let store;
if (storageMode === HOSTED_MODE) {
  tenancy = await createHostedTenancy();
} else {
  store = createFileStore(config.dataDir);
}

const app = createApp({
  lore,
  ...serviceOptions,
  store,
  corsOrigins: config.corsOrigins,
  tenancy,
});

function announceListening() {
  console.log(
    `Oread API (${storageMode} mode) listening on http://${config.host}:${config.port}${API_PREFIX}`,
  );
}

async function warmUpEmotionModel() {
  console.log("Loading the story engine's emotion model (the first run downloads about 125 MB)…");
  const isReady = await emotionClassifier.warmUp();
  if (isReady) {
    console.log("Story engine ready.");
  } else {
    console.log("The emotion model couldn't load; scenes will be skipped until it can.");
  }
}

async function warmUpEmbeddingModel() {
  const isReady = await embedder.warmUp();
  if (isReady) {
    console.log("Memory search ready.");
  } else {
    console.log("The memory search model couldn't load; memory search is unavailable for now.");
  }
}

// One after the other, so the two first-run downloads don't compete.
async function warmUpLocalModels() {
  await warmUpEmotionModel();
  await warmUpEmbeddingModel();
}

http.createServer(app).listen(config.port, config.host, announceListening);
warmUpLocalModels();
