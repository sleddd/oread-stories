// The root component: theme, start-up, the app bar and whichever page is selected. When Oread is
// hosted, a signed-out visitor gets the sign-in screen instead.
import { useEffect, useMemo, useState } from "react";
import { ThemeProvider } from "styled-components";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "./store/index.js";
import { createTheme, GlobalStyle } from "./theme/index.js";
import { prefersDarkColorScheme, watchColorScheme } from "./platform/index.js";
import { AppShell, MenuSheet } from "./components/templates/index.js";
import { AppBar, MobileAppBar, MobileMenu } from "./components/organisms/index.js";
import { useIsScreenAtMost } from "./lib/useIsScreenAtMost.js";
import { PHONE_LAYOUT_WIDTH } from "./theme/breakpoints.js";
import { Toast } from "./components/molecules/index.js";
import { EmptyState, Heading1, Lede } from "./components/atoms/index.js";
import { View } from "./ui/primitives/index.js";
import { ChatPage } from "./pages/ChatPage.jsx";
import { StoriesPage } from "./pages/StoriesPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { AuthPage } from "./pages/AuthPage.jsx";
import { providerName, providerReadiness } from "./content/providers.js";

const VIEWS = [
  { id: "chat", label: "Chat", icon: "chat" },
  { id: "stories", label: "Stories", icon: "book" },
  { id: "settings", label: "Settings", icon: "settings" },
];

const PAGES = { stories: StoriesPage, chat: ChatPage, settings: SettingsPage };

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
  const modelName = settings[providerId]?.model || "no model";
  return {
    label: `${providerName(providerId)} · ${modelName}`,
    providerName: providerName(providerId),
    modelName,
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

function useReadyAppState() {
  return useAppStore(
    useShallow((state) => ({
      view: state.view,
      settings: state.settings,
      toast: state.toast,
      colorSchemePreference: state.colorSchemePreference,
      authStatus: state.authStatus,
      user: state.user,
      isMenuOpen: state.isMenuOpen,
      navigate: state.navigate,
      cycleColorScheme: state.cycleColorScheme,
      chooseColorScheme: state.chooseColorScheme,
      openMenu: state.openMenu,
      closeMenu: state.closeMenu,
      signOut: state.signOut,
    })),
  );
}

function ReadyApp() {
  const app = useReadyAppState();
  const isPhone = useIsScreenAtMost(PHONE_LAYOUT_WIDTH);
  const CurrentPage = PAGES[app.view];
  const isSignedIn = app.authStatus === "signedIn";
  const badge = describeModelBadge(app.settings);
  const signedInAs = isSignedIn ? `Signed in as ${app.user?.email}` : undefined;
  const signOut = isSignedIn ? app.signOut : undefined;

  const desktopHeader = (
    <AppBar
      views={VIEWS}
      currentView={app.view}
      badge={badge}
      colorSchemePreference={app.colorSchemePreference}
      onNavigate={app.navigate}
      onBadgePress={() => app.navigate("settings")}
      onCycleColorScheme={app.cycleColorScheme}
      signedInAs={signedInAs}
      onSignOut={signOut}
    />
  );
  const phoneMenu = (
    <MenuSheet isOpen={isPhone && app.isMenuOpen} onClose={app.closeMenu}>
      <MobileMenu
        views={VIEWS}
        currentView={app.view}
        model={badge}
        colorSchemePreference={app.colorSchemePreference}
        signedInAs={signedInAs}
        onNavigate={app.navigate}
        onOpenSettings={() => app.navigate("settings")}
        onChooseColorScheme={app.chooseColorScheme}
        onSignOut={signOut}
        onClose={app.closeMenu}
      />
    </MenuSheet>
  );

  return (
    <AppShell
      header={isPhone ? <MobileAppBar onOpenMenu={app.openMenu} /> : desktopHeader}
      page={<CurrentPage />}
      pageScrolls={app.view !== "chat"}
      toast={<Toast toast={app.toast} />}
      overlay={phoneMenu}
    />
  );
}

function Screen({ authStatus, bootStatus, bootError }) {
  if (authStatus === "signedOut") {
    return <AuthPage />;
  }
  if (bootStatus === "ready") {
    return <ReadyApp />;
  }
  return <BootMessage status={bootStatus} error={bootError} />;
}

export function App() {
  const { authStatus, bootStatus, bootError, colorSchemePreference, accentId, start } = useAppStore(
    useShallow((state) => ({
      authStatus: state.authStatus,
      bootStatus: state.bootStatus,
      bootError: state.bootError,
      colorSchemePreference: state.colorSchemePreference,
      accentId: state.accentId,
      start: state.start,
    })),
  );
  const colorScheme = useColorScheme(colorSchemePreference);
  const theme = useMemo(() => createTheme(colorScheme, accentId), [colorScheme, accentId]);

  useEffect(() => {
    start();
  }, [start]);

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyle />
      <Screen authStatus={authStatus} bootStatus={bootStatus} bootError={bootError} />
    </ThemeProvider>
  );
}
