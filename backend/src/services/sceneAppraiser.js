// Appraises a scene from its newest event. This is the one place that decides how a scene is
// read; today it uses the local emotion classifier, and other appraisers can replace it later.
import { emotionsToAppraisal } from "../story/emotionsToAppraisal.js";

export function createSceneAppraiser({ classifier, storyConfig }) {
  return {
    async appraise(eventText) {
      const emotionScores = await classifier.classify(eventText);
      return emotionsToAppraisal(storyConfig, emotionScores);
    },
  };
}
