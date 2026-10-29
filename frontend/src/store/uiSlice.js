// Interface state: start-up, the visible page, the colour scheme and the toast notice.

const VIEW_STORAGE_KEY = "oread.view";
const COLOR_SCHEME_STORAGE_KEY = "oread.colorScheme";
const COLOR_SCHEME_ORDER = ["auto", "light", "dark"];
const VIEWS = ["chat", "lore", "settings"];
const TOAST_DURATION_MILLISECONDS = 3200;
const ERROR_TOAST_DURATION_MILLISECONDS = 6000;

export function createUiSlice({ api, platform }) {
  let toastTimer = null;

  return (set, get) => ({
    bootStatus: "loading",
    bootError: null,
    view: "chat",
    colorSchemePreference: platform.storage.read(COLOR_SCHEME_STORAGE_KEY, "auto"),
    toast: null,

    async boot() {
      try {
        const [controls, personalityView, settings, chats] = await Promise.all([
          api.getLoreControls(),
          api.getPersonality(),
          api.getSettings(),
          api.listChats(),
        ]);
        set({
          controls,
          personality: personalityView.personality,
          derived: personalityView.derived,
          settings,
          chats,
          bootStatus: "ready",
        });
        get().navigate(get().chooseStartView());
      } catch (error) {
        set({ bootStatus: "failed", bootError: error.message });
      }
    },

    // Without a provider key there's nothing to chat with yet, so start in Settings.
    chooseStartView() {
      if (!get().hasProviderCredentials()) {
        setTimeout(() => get().showToast("Add a provider key to start chatting."), 300);
        return "settings";
      }
      const rememberedView = platform.storage.read(VIEW_STORAGE_KEY, "chat");
      if (VIEWS.includes(rememberedView)) {
        return rememberedView;
      }
      return "chat";
    },

    navigate(view) {
      set({ view });
      platform.storage.write(VIEW_STORAGE_KEY, view);
      if (view === "chat") {
        get().showFirstChat();
      }
    },

    cycleColorScheme() {
      const currentIndex = COLOR_SCHEME_ORDER.indexOf(get().colorSchemePreference);
      const nextPreference = COLOR_SCHEME_ORDER[(currentIndex + 1) % COLOR_SCHEME_ORDER.length];
      platform.storage.write(COLOR_SCHEME_STORAGE_KEY, nextPreference);
      set({ colorSchemePreference: nextPreference });
    },

    showToast(message, kind = "info") {
      clearTimeout(toastTimer);
      set({ toast: { message, kind } });
      const duration = kind === "error" ? ERROR_TOAST_DURATION_MILLISECONDS : TOAST_DURATION_MILLISECONDS;
      toastTimer = setTimeout(() => set({ toast: null }), duration);
    },

    showError(error) {
      get().showToast(error.message, "error");
    },
  });
}
