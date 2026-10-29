// The root component: theme, start-up, the app bar and whichever page is selected.
import { useEffect, useState } from "react";
import { ThemeProvider } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/index.js";
import { createTheme, GlobalStyle } from "./theme/index.js";
import { prefersDarkColorScheme, watchColorScheme } from "./platform/index.js";
import { AppShell } from "./components/templates/index.js";
import { AppBar } from "./components/organisms/index.js";
import { Toast } from "./components/molecules/index.js";
import { EmptyState, Heading1, Lede } from "./components/atoms/index.js";
import { View } from "./ui/primitives/index.js";
import { ChatPage } from "./pages/ChatPage.jsx";
import { LorebookPage } from "./pages/LorebookPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { providerName, providerReadiness } from "./content/providers.js";

const VIEWS = [
  { id: "chat", label: "Chat" },
  { id: "lore", label: "Lorebook" },
  { id: "settings", label: "Settings" },
];

const PAGES = { chat: ChatPage, lore: LorebookPage, settings: SettingsPage };

function useColorScheme(preference) {
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDarkColorScheme());
  useEffect(() => watchColorScheme(setSystemPrefersDark), []);
  if (preference === "auto") {
    return systemPrefersDark ? "dark" : "light";
  }
  return preference;
}

function describeModelBadge(settings) {
  const providerId = settings.provider;
  const { hasCredentials, isReady } = providerReadiness(settings);
  const model = settings[providerId]?.model || "no model";
  return {
    label: `${providerName(providerId)} · ${model}`,
    isReady,
    title: hasCredentials ? "Change provider in Settings" : "No credentials yet — open Settings",
  };
}

function BootMessage({ status, error }) {
  if (status === "loading") {
    return <EmptyState>Loading…</EmptyState>;
  }
  return (
    <View style={{ padding: "40px 20px", maxWidth: 600, margin: "0 auto" }}>
      <Heading1>Oread couldn't start</Heading1>
      <Lede>{error}</Lede>
      <Lede>Start the backend with npm start in the backend folder, then reload this page.</Lede>
    </View>
  );
}

function ReadyApp() {
  const { view, settings, toast, colorSchemePreference, navigate, cycleColorScheme } = useAppStore(
    useShallow((state) => ({
      view: state.view,
      settings: state.settings,
      toast: state.toast,
      colorSchemePreference: state.colorSchemePreference,
      navigate: state.navigate,
      cycleColorScheme: state.cycleColorScheme,
    })),
  );
  const CurrentPage = PAGES[view];

  return (
    <AppShell
      header={
        <AppBar
          views={VIEWS}
          currentView={view}
          badge={describeModelBadge(settings)}
          colorSchemePreference={colorSchemePreference}
          onNavigate={navigate}
          onBadgePress={() => navigate("settings")}
          onCycleColorScheme={cycleColorScheme}
        />
      }
      page={<CurrentPage />}
      pageScrolls={view !== "chat"}
      toast={<Toast toast={toast} />}
    />
  );
}

export function App() {
  const { bootStatus, bootError, colorSchemePreference, boot } = useAppStore(
    useShallow((state) => ({
      bootStatus: state.bootStatus,
      bootError: state.bootError,
      colorSchemePreference: state.colorSchemePreference,
      boot: state.boot,
    })),
  );
  const colorScheme = useColorScheme(colorSchemePreference);

  useEffect(() => {
    boot();
  }, [boot]);

  return (
    <ThemeProvider theme={createTheme(colorScheme)}>
      <GlobalStyle />
      {bootStatus === "ready" && <ReadyApp />}
      {bootStatus !== "ready" && <BootMessage status={bootStatus} error={bootError} />}
    </ThemeProvider>
  );
}
