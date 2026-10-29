// Provider credentials, generation settings and data backup.
import { providerReadiness } from "../content/providers.js";

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

    listModels: (providerId) => api.listModels(providerId),
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
        const chatCount = result.imported.chats;
        const chatWord = chatCount === 1 ? "chat" : "chats";
        const personalityNote = result.imported.personality ? " and the personality" : "";
        get().showToast(`Imported ${chatCount} ${chatWord}${personalityNote}.`);
        const personalityView = await api.getPersonality();
        set({ personality: personalityView.personality, derived: personalityView.derived });
        await get().loadChats();
      } catch (error) {
        const message =
          error instanceof SyntaxError ? "That file isn't valid JSON." : error.message;
        get().showToast(message, "error");
      }
    },
  });
}
