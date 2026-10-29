// Downloads the two local models (the story engine's emotion model and the memory search model)
// into the model cache, so a deploy ships with them and never downloads them while starting up.
// Run during the build: `npm run models:fetch`. Fails the build if either can't be fetched.
import { loadConfig } from "../src/config.js";
import { loadEnvironmentFile } from "../src/loadEnvironmentFile.js";
import { loadStoryConfig } from "../src/story/loadStoryConfig.js";
import { createEmotionClassifier } from "../src/services/emotionClassifier.js";
import { createEmbeddingModel } from "../src/memory/embeddingModel.js";

async function fetchModel(name, model) {
  console.log(`Fetching the ${name}…`);
  const isReady = await model.warmUp();
  if (!isReady) {
    throw new Error(`The ${name} couldn't be downloaded or loaded.`);
  }
  console.log(`The ${name} is ready.`);
}

async function main() {
  loadEnvironmentFile();
  const config = loadConfig();
  const storyConfig = loadStoryConfig(config.storyConfigPath);
  console.log(`Model cache: ${config.modelCacheDir}`);
  const emotionClassifier = createEmotionClassifier({
    modelId: storyConfig.emotionModel.id,
    dtype: storyConfig.emotionModel.dtype,
    cacheDirectory: config.modelCacheDir,
  });
  const embedder = createEmbeddingModel({ cacheDirectory: config.modelCacheDir });
  await fetchModel("emotion model", emotionClassifier);
  await fetchModel("memory search model", embedder);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
