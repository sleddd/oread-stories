// The selected character's live personality. Dial changes show at once and are sent to the
// backend in a batch after a short pause; a server reply is applied only when nothing newer is
// waiting, so a dial never jumps back. Each batch remembers which character it belongs to, so
// switching characters mid-batch never moves the wrong one.
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

function isSameCharacter(first, second) {
  return first?.storyId === second?.storyId && first?.characterId === second?.characterId;
}

export function createPersonalitySlice({ api }) {
  let pendingChange = {};
  let pendingCharacter = null;
  let requestsInFlight = 0;

  return (set, get) => {
    // Shows a personality the server sent, if it still belongs to the selected character.
    function applyServerView(character, personalityView) {
      get().showCharacterPersonality(character.characterId, personalityView.personality);
      if (!isSameCharacter(character, get().selectedCharacterReference())) {
        return;
      }
      set({ personality: personalityView.personality, derived: personalityView.derived });
      get().afterPersonalityChanged();
    }

    async function sendPendingChange() {
      const change = pendingChange;
      const character = pendingCharacter;
      pendingChange = {};
      pendingCharacter = null;
      if (!character || Object.keys(change).length === 0) {
        return;
      }
      requestsInFlight += 1;
      try {
        const personalityView = await api.patchPersonality(character, change);
        const isLatestRequest = requestsInFlight === 1 && Object.keys(pendingChange).length === 0;
        if (isLatestRequest) {
          applyServerView(character, personalityView);
        }
      } catch (error) {
        get().showError(error);
        applyServerView(character, await api.getPersonality(character));
      } finally {
        requestsInFlight -= 1;
      }
    }

    const scheduleSync = debounce(sendPendingChange, SYNC_DELAY_MILLISECONDS);

    return {
      controls: null,
      personality: null,
      derived: null,

      async loadSelectedPersonality() {
        const character = get().selectedCharacterReference();
        if (!character) {
          return;
        }
        try {
          applyServerView(character, await api.getPersonality(character));
        } catch (error) {
          get().showError(error);
        }
      },

      // Sends any waiting dial changes now (before switching characters).
      async flushPersonalityChanges() {
        scheduleSync.cancel();
        await sendPendingChange();
      },

      // change: { name?, values?, mood?, tags?, rules?, metatraits? }
      // Master-dial moves are worked out by the server, so they only show once it replies.
      changePersonality(change) {
        const character = get().selectedCharacterReference();
        if (!character || !get().personality) {
          return;
        }
        const { metatraits, ...localChange } = change;
        set({ personality: mergeChange(get().personality, localChange) });
        if (change.name !== undefined) {
          get().showCharacterPersonality(character.characterId, get().personality);
        }
        pendingCharacter = character;
        pendingChange = mergeChange(pendingChange, change);
        scheduleSync();
      },

      // For whole-personality actions the server computes: presets, randomize, reset, undo.
      // requestPersonality receives the selected character.
      async runPersonalityAction(requestPersonality) {
        scheduleSync.cancel();
        pendingChange = {};
        pendingCharacter = null;
        const character = get().selectedCharacterReference();
        if (!character) {
          return;
        }
        try {
          applyServerView(character, await requestPersonality(character));
        } catch (error) {
          get().showError(error);
        }
      },

      applyPreset(presetId) {
        return get().runPersonalityAction((character) => api.applyPreset(character, presetId));
      },
      randomizePersonality: () => get().runPersonalityAction(api.randomizePersonality),
      resetPersonality: () => get().runPersonalityAction(api.resetPersonality),
    };
  };
}
