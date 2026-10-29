// The chat page's two side panels: chats on the left, steering on the right. On a wide window a
// panel is a column that can be collapsed out of the way (remembered on this device); on a
// narrow one it slides in over the conversation and starts closed. One toggle per panel does
// whichever fits the window right now.
import {
  CHATS_PANEL_SLIDES_IN_WIDTH,
  STEERING_PANEL_SLIDES_IN_WIDTH,
} from "../theme/breakpoints.js";

const COLLAPSED = "collapsed";
const CHATS_PANEL_STORAGE_KEY = "oread.chatsPanel";
const STEERING_PANEL_STORAGE_KEY = "oread.steeringPanel";

function readIsCollapsed(platform, storageKey) {
  return platform.storage.read(storageKey, null) === COLLAPSED;
}

function rememberIsCollapsed(platform, storageKey, isCollapsed) {
  platform.storage.write(storageKey, isCollapsed ? COLLAPSED : null);
}

export function createPanelsSlice({ platform }) {
  return (set, get) => ({
    isChatsPanelCollapsed: readIsCollapsed(platform, CHATS_PANEL_STORAGE_KEY),
    isSteeringPanelCollapsed: readIsCollapsed(platform, STEERING_PANEL_STORAGE_KEY),
    isChatsPanelSlidIn: false,
    isSteeringPanelSlidIn: false,

    toggleChatsPanel() {
      if (platform.isScreenAtMost(CHATS_PANEL_SLIDES_IN_WIDTH)) {
        set({ isChatsPanelSlidIn: !get().isChatsPanelSlidIn });
        return;
      }
      const isCollapsed = !get().isChatsPanelCollapsed;
      set({ isChatsPanelCollapsed: isCollapsed });
      rememberIsCollapsed(platform, CHATS_PANEL_STORAGE_KEY, isCollapsed);
    },

    toggleSteeringPanel() {
      if (platform.isScreenAtMost(STEERING_PANEL_SLIDES_IN_WIDTH)) {
        set({ isSteeringPanelSlidIn: !get().isSteeringPanelSlidIn });
        return;
      }
      const isCollapsed = !get().isSteeringPanelCollapsed;
      set({ isSteeringPanelCollapsed: isCollapsed });
      rememberIsCollapsed(platform, STEERING_PANEL_STORAGE_KEY, isCollapsed);
    },

    // Tapping the conversation, or opening a chat, puts slid-in panels away.
    closeSlidInPanels() {
      set({ isChatsPanelSlidIn: false, isSteeringPanelSlidIn: false });
    },
  });
}
