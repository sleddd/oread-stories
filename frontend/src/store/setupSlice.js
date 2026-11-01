// The first-run setup: three short steps that connect a model provider before anything else,
// for someone who has none ready yet. Choose a provider, add its key and model, check the
// connection. It opens once the app has loaded and stays open until it is finished or skipped,
// even after the provider becomes ready halfway through. Skipping is remembered on this device;
// Settings has the same provider cards for later.
//
// setupStep: "provider" → "connect" → "test"
import { providerName, providerReadiness } from "../content/providers.js";

const SETUP_SKIPPED_STORAGE_KEY = "oread.setupSkipped";
const SKIPPED_VALUE = "1";
export const SETUP_STEPS = ["provider", "connect", "test"];
const SKIPPED_MESSAGE = "You can connect a provider any time in Settings.";

export function createSetupSlice({ platform }) {
  return (set, get) => ({
    isSetupOpen: false,
    setupStep: "provider",
    setupProviderId: null,

    // After loading: opens the setup when no provider is ready and it wasn't skipped here.
    // Returns whether it opened.
    openSetupIfNeeded() {
      const isReady = providerReadiness(get().settings).isReady;
      const wasSkipped = platform.storage.read(SETUP_SKIPPED_STORAGE_KEY) === SKIPPED_VALUE;
      if (isReady || wasSkipped) {
        return false;
      }
      set({ isSetupOpen: true, setupStep: "provider", setupProviderId: get().settings.provider });
      return true;
    },

    async chooseSetupProvider(providerId) {
      const isSaved = await get().patchSettings({ provider: providerId }, { announce: false });
      if (isSaved) {
        set({ setupProviderId: providerId, setupStep: "connect" });
      }
    },

    goToSetupStep(setupStep) {
      set({ setupStep });
    },

    // One step back; the first step has nowhere to go back to.
    goBackInSetup() {
      const stepIndex = SETUP_STEPS.indexOf(get().setupStep);
      if (stepIndex > 0) {
        set({ setupStep: SETUP_STEPS[stepIndex - 1] });
      }
    },

    skipSetup() {
      platform.storage.write(SETUP_SKIPPED_STORAGE_KEY, SKIPPED_VALUE);
      set({ isSetupOpen: false });
      get().showToast(SKIPPED_MESSAGE);
    },

    finishSetup() {
      set({ isSetupOpen: false });
      get().showToast(`Writing with ${providerName(get().settings.provider)}`);
    },
  });
}
