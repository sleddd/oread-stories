// The app's Zustand store, assembled from slices. Dependencies (the API client and platform services)
// are passed in, so tests or a native build can supply their own.
import { create } from "zustand";
import { apiClient } from "../api/index.js";
import * as webPlatform from "../platform/index.js";
import { createUiSlice } from "./uiSlice.js";
import { createAuthSlice } from "./authSlice.js";
import { createPanelsSlice } from "./panelsSlice.js";
import { createPersonalitySlice } from "./personalitySlice.js";
import { createChatSlice } from "./chatSlice.js";
import { createReplySlice } from "./replySlice.js";
import { createSettingsSlice } from "./settingsSlice.js";
import { createStoriesSlice } from "./storiesSlice.js";

export function createAppStore({ api, platform }) {
  const dependencies = { api, platform };
  const sliceFactories = [
    createUiSlice(dependencies),
    createAuthSlice(dependencies),
    createPanelsSlice(dependencies),
    createStoriesSlice(dependencies),
    createPersonalitySlice(dependencies),
    createChatSlice(dependencies),
    createReplySlice(dependencies),
    createSettingsSlice(dependencies),
  ];
  const store = create((set, get) => {
    const state = {};
    for (const createSlice of sliceFactories) {
      Object.assign(state, createSlice(set, get));
    }
    return state;
  });
  api.onUnauthenticated?.(() => store.getState().handleSessionEnded());
  return store;
}

export const useAppStore = createAppStore({ api: apiClient, platform: webPlatform });
