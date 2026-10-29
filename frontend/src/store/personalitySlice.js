// The one live personality. Dial changes show at once and are sent to the backend in a batch after a
// short pause; a server reply is applied only when nothing newer is waiting, so a dial never jumps back.
import { debounce } from "../lib/format.js";

const SYNC_DELAY_MILLISECONDS = 150;

function mergeChange(existing, change) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(change)) {
    const isNestedObject = value !== null && typeof value === "object" && !Array.isArray(value);
    if (isNestedObject) {
      merged[key] = { ...(existing[key] ?? {}), ...value };
    } else {
      merged[key] = value;
    }
  }
  return merged;
}

export function createPersonalitySlice({ api }) {
  let pendingChange = {};
  let requestsInFlight = 0;

  return (set, get) => {
    function applyServerView(personalityView) {
      set({ personality: personalityView.personality, derived: personalityView.derived });
      get().afterPersonalityChanged();
    }

    async function sendPendingChange() {
      const change = pendingChange;
      pendingChange = {};
      if (Object.keys(change).length === 0) {
        return;
      }
      requestsInFlight += 1;
      try {
        const personalityView = await api.patchPersonality(change);
        const isLatestRequest = requestsInFlight === 1 && Object.keys(pendingChange).length === 0;
        if (isLatestRequest) {
          applyServerView(personalityView);
        }
      } catch (error) {
        get().showError(error);
        applyServerView(await api.getPersonality());
      } finally {
        requestsInFlight -= 1;
      }
    }

    const scheduleSync = debounce(sendPendingChange, SYNC_DELAY_MILLISECONDS);

    return {
      controls: null,
      personality: null,
      derived: null,

      // change: { name?, values?, mood?, tags?, rules?, metatraits? }
      // Master-dial moves are worked out by the server, so they only show once it replies.
      changePersonality(change) {
        const { metatraits, ...localChange } = change;
        set({ personality: mergeChange(get().personality, localChange) });
        pendingChange = mergeChange(pendingChange, change);
        scheduleSync();
      },

      // For whole-personality actions the server computes: presets, randomize, reset, undo.
      async runPersonalityAction(requestPersonality) {
        scheduleSync.cancel();
        pendingChange = {};
        try {
          applyServerView(await requestPersonality());
        } catch (error) {
          get().showError(error);
        }
      },

      applyPreset: (presetId) => get().runPersonalityAction(() => api.applyPreset(presetId)),
      randomizePersonality: () => get().runPersonalityAction(api.randomizePersonality),
      resetPersonality: () => get().runPersonalityAction(api.resetPersonality),
    };
  };
}
