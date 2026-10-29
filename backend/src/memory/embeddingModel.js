// A local sentence-embedding model (transformers.js running all-MiniLM-L6-v2) that turns text
// into vectors for meaning search over memories. It makes no network calls once the model is
// cached: the first use downloads it (about 25 MB) into the cache folder. The library is
// imported lazily, so code paths that never search (and tests) don't load it.

const TASK = "feature-extraction";
export const DEFAULT_EMBEDDING_MODEL_ID = "Xenova/all-MiniLM-L6-v2";
export const DEFAULT_EMBEDDING_DTYPE = "q8";
// The model reads at most 256 word pieces; longer text is trimmed well before that.
const MAX_CHARACTERS = 1500;

export function createEmbeddingModel({
  modelId = DEFAULT_EMBEDDING_MODEL_ID,
  dtype = DEFAULT_EMBEDDING_DTYPE,
  cacheDirectory,
} = {}) {
  let loadingPipeline = null;

  async function loadPipeline() {
    const transformers = await import("@huggingface/transformers");
    if (cacheDirectory) {
      transformers.env.cacheDir = cacheDirectory;
    }
    return transformers.pipeline(TASK, modelId, { dtype });
  }

  // Loads once and shares the result; a failed load is forgotten so the next call retries.
  function pipelineReady() {
    if (!loadingPipeline) {
      loadingPipeline = loadPipeline();
      loadingPipeline.catch(() => {
        loadingPipeline = null;
      });
    }
    return loadingPipeline;
  }

  return {
    // Resolves to true once the model is ready, or false if it couldn't load.
    async warmUp() {
      try {
        await pipelineReady();
        return true;
      } catch {
        return false;
      }
    },

    // Returns one unit-length vector (a plain array of numbers) per text.
    async embed(texts) {
      const extractFeatures = await pipelineReady();
      const trimmedTexts = texts.map((text) => text.slice(0, MAX_CHARACTERS));
      const output = await extractFeatures(trimmedTexts, { pooling: "mean", normalize: true });
      return output.tolist();
    },
  };
}
