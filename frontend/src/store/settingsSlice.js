// Provider credentials, generation settings and data backup.
import { providerReadiness } from "../content/providers.js";

function countOf(count, singular, plural) {
  if (count === 1) {
    return `1 ${singular}`;
  }
  return `${count} ${plural}`;
}

// "Imported 1 story and 0 chats."
function describeImport(imported) {
  const stories = countOf(imported.stories, "story", "stories");
  const chats = countOf(imported.chats, "chat", "chats");
  return `Imported ${stories} and ${chats}.`;
}

export function createSettingsSlice({ api, platform }) {
  return (set, get) => ({
    settings: null,

    hasProviderCredentials() {
      return providerReadiness(get().settings).hasCredentials;
    },

    async patchSettings(change, { announce = true } = {}) {
      try {
        set({ settings: await api.patchSettings(change) });
        if (announce) {
          get().showToast("Saved");
        }
        return true;
      } catch (error) {
        get().showToast(`Couldn't save: ${error.message}`, "error");
        return false;
      }
    },

    listModels: (providerId, search) => api.listModels(providerId, search),

    // Says how a "Fetch models" went: how many there are to choose from, or what went wrong.
    reportFetchedModels({ count, error }) {
      if (error) {
        get().showToast(error.message, "error");
        return;
      }
      let modelWord = "models";
      if (count === 1) {
        modelWord = "model";
      }
      get().showToast(`${count} ${modelWord} available. Type to search, then pick one.`);
    },
    testProvider: (providerId) => api.testProvider(providerId),

    async exportData() {
      try {
        const data = await api.exportData();
        const today = new Date().toISOString().slice(0, 10);
        platform.saveTextFile(`oread-${today}.json`, JSON.stringify(data, null, 2));
      } catch (error) {
        get().showError(error);
      }
    },

    async importData() {
      const text = await platform.pickTextFile("application/json");
      if (!text) {
        return;
      }
      try {
        const result = await api.importData(JSON.parse(text));
        get().showToast(describeImport(result.imported));
        // Personalities belong to characters now, so the stories and the selected character
        // are what to reload.
        await get().loadStories();
        await Promise.all([get().loadSelectedPersonality(), get().loadChats()]);
      } catch (error) {
        const message =
          error instanceof SyntaxError ? "That file isn't valid JSON." : error.message;
        get().showToast(message, "error");
      }
    },
  });
}
