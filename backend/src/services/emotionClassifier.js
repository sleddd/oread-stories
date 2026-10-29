// A local emotion classifier (transformers.js running an ONNX GoEmotions model). It makes no
// network calls once the model is cached: the first use downloads it into the cache folder.
// The library is imported lazily, so code paths that never classify (and tests) don't load it.

const TASK = "text-classification";
// The model reads at most 512 tokens; longer messages are trimmed well before that.
const MAX_CHARACTERS = 2000;

export function createEmotionClassifier({ modelId, dtype, cacheDirectory }) {
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

    // Returns { label: score } for every emotion label.
    async classify(text) {
      const classify = await pipelineReady();
      const results = await classify(text.slice(0, MAX_CHARACTERS), { top_k: null });
      const scores = {};
      for (const result of results) {
        scores[result.label] = result.score;
      }
      return scores;
    },
  };
}
