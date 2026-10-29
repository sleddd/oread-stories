// Interface state: start-up, the visible page, the colour scheme, the accent colour and the toast
// notice.
import { ACCENT_PRESETS, DEFAULT_ACCENT_ID } from "../theme/accents.js";

const COLOR_SCHEME_STORAGE_KEY = "oread.colorScheme";
const COLOR_SCHEME_ORDER = ["auto", "light", "dark"];
const ACCENT_STORAGE_KEY = "oread.accent";
// Oread always opens on the chat.
const START_VIEW = "chat";
// The lorebook mixer moved into the character editor on the Stories page.
const RENAMED_VIEWS = { lore: "stories" };
const TOAST_DURATION_MILLISECONDS = 3200;
const ERROR_TOAST_DURATION_MILLISECONDS = 6000;

function isKnownAccent(accentId) {
  return ACCENT_PRESETS.some((preset) => preset.id === accentId);
}

// Read once when the store is made, so the first paint already uses the chosen accent.
function readStoredAccent(platform) {
  const storedAccentId = platform.storage.read(ACCENT_STORAGE_KEY, DEFAULT_ACCENT_ID);
  if (isKnownAccent(storedAccentId)) {
    return storedAccentId;
  }
  return DEFAULT_ACCENT_ID;
}

export function createUiSlice({ api, platform }) {
  let toastTimer = null;

  return (set, get) => ({
    bootStatus: "loading",
    bootError: null,
    view: "chat",
    colorSchemePreference: platform.storage.read(COLOR_SCHEME_STORAGE_KEY, "auto"),
    accentId: readStoredAccent(platform),
    toast: null,
    // The phone layout's menu sheet.
    isMenuOpen: false,

    async boot() {
      try {
        const [controls, settings] = await Promise.all([api.getLoreControls(), api.getSettings()]);
        set({ controls, settings });
        await get().openFirstStory();
        set({ bootStatus: "ready" });
        get().navigate(get().chooseStartView());
      } catch (error) {
        set({ bootStatus: "failed", bootError: error.message });
      }
    },

    // Without a provider key there's nothing to chat with yet, so point the way to Settings.
    chooseStartView() {
      if (!get().hasProviderCredentials()) {
        setTimeout(() => get().showToast("Add a provider key in Settings to start chatting."), 300);
      }
      return START_VIEW;
    },

    navigate(requestedView) {
      const view = RENAMED_VIEWS[requestedView] ?? requestedView;
      set({ view, isMenuOpen: false });
      if (view === "chat") {
        get().showFirstChat();
      }
    },

    cycleColorScheme() {
      const currentIndex = COLOR_SCHEME_ORDER.indexOf(get().colorSchemePreference);
      const nextPreference = COLOR_SCHEME_ORDER[(currentIndex + 1) % COLOR_SCHEME_ORDER.length];
      get().chooseColorScheme(nextPreference);
    },

    // "light", "dark" or "auto" (follow the system).
    chooseColorScheme(preference) {
      if (!COLOR_SCHEME_ORDER.includes(preference)) {
        return;
      }
      platform.storage.write(COLOR_SCHEME_STORAGE_KEY, preference);
      set({ colorSchemePreference: preference });
    },

    openMenu() {
      set({ isMenuOpen: true });
    },

    closeMenu() {
      set({ isMenuOpen: false });
    },

    chooseAccent(accentId) {
      if (!isKnownAccent(accentId)) {
        return;
      }
      platform.storage.write(ACCENT_STORAGE_KEY, accentId);
      set({ accentId });
    },

    showToast(message, kind = "info") {
      clearTimeout(toastTimer);
      set({ toast: { message, kind } });
      const duration =
        kind === "error" ? ERROR_TOAST_DURATION_MILLISECONDS : TOAST_DURATION_MILLISECONDS;
      toastTimer = setTimeout(() => set({ toast: null }), duration);
    },

    showError(error) {
      get().showToast(error.message, "error");
    },
  });
}
