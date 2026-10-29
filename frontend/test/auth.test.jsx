// Signing in and out: what start-up shows, the sign-in and sign-up forms, the header's Sign out,
// and a session that ends sending the interface back to the sign-in screen.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { createApiClient } from "../src/api/createApiClient.js";
import { ApiError } from "../src/api/ApiError.js";
import {
  SignInForm,
  SignUpForm,
  ForgotPasswordForm,
  ResetPasswordForm,
  AppBar,
} from "../src/components/organisms/index.js";
import { renderWithTheme, createFakeApi, createFakePlatform } from "./helpers.jsx";

const HOSTED = { status: "ok", requiresSignIn: true };
const SIGNED_IN = { user: { id: "user-1", email: "ana@example.com", name: "Ana" } };

function hostedApi(overrides = {}) {
  return createFakeApi({ getHealth: vi.fn().mockResolvedValue(HOSTED), ...overrides });
}

function createStore(api = createFakeApi()) {
  return createAppStore({ api, platform: createFakePlatform() });
}

describe("starting up", () => {
  it("goes straight in when Oread runs locally", async () => {
    const api = createFakeApi();
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().authStatus).toBe("notRequired");
    expect(store.getState().bootStatus).toBe("ready");
    expect(api.getSession).not.toHaveBeenCalled();
  });

  it("shows the sign-in screen and loads nothing when no one is signed in", async () => {
    const api = hostedApi();
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().authStatus).toBe("signedOut");
    expect(api.getLoreControls).not.toHaveBeenCalled();
    expect(api.listStories).not.toHaveBeenCalled();
  });

  it("loads the app when a session already exists", async () => {
    const api = hostedApi({ getSession: vi.fn().mockResolvedValue(SIGNED_IN) });
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().authStatus).toBe("signedIn");
    expect(store.getState().user.email).toBe("ana@example.com");
    expect(store.getState().bootStatus).toBe("ready");
  });

  it("says Oread couldn't start when the backend can't be reached", async () => {
    const api = createFakeApi({ getHealth: vi.fn().mockRejectedValue(new Error("Offline")) });
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().bootStatus).toBe("failed");
    expect(store.getState().bootError).toBe("Offline");
  });
});

describe("signing in, up and out", () => {
  it("signs in, then loads the app", async () => {
    const api = hostedApi({ getSession: vi.fn().mockResolvedValue(SIGNED_IN) });
    const store = createStore(api);
    store.setState({ authStatus: "signedOut" });
    await store.getState().signIn({ email: "ana@example.com", password: "a long secret" });
    expect(api.signIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "a long secret",
    });
    expect(store.getState().authStatus).toBe("signedIn");
    expect(store.getState().bootStatus).toBe("ready");
  });

  it("explains a wrong password and an unconfirmed email", async () => {
    const wrongPassword = new ApiError({ status: 401, code: "INVALID", message: "Invalid" });
    const notConfirmed = new ApiError({ status: 403, code: "EMAIL_NOT_VERIFIED", message: "x" });
    const signIn = vi.fn().mockRejectedValueOnce(wrongPassword).mockRejectedValueOnce(notConfirmed);
    const store = createStore(hostedApi({ signIn }));
    store.setState({ authStatus: "signedOut" });

    await store.getState().signIn({ email: "ana@example.com", password: "wrong one!" });
    expect(store.getState().authError).toBe("That email and password don't match.");
    expect(store.getState().authStatus).toBe("signedOut");

    await store.getState().signIn({ email: "ana@example.com", password: "a long secret" });
    expect(store.getState().authError).toMatch(/Confirm your email first/);
    expect(store.getState().isAuthBusy).toBe(false);
  });

  it("after creating an account, asks for the emailed link", async () => {
    const api = hostedApi();
    const store = createStore(api);
    store.setState({ authStatus: "signedOut", authScreen: "signUp" });
    await store
      .getState()
      .signUp({ name: "Ana", email: "ana@example.com", password: "long enough!" });
    expect(api.signUp).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      password: "long enough!",
    });
    expect(store.getState().authScreen).toBe("signIn");
    expect(store.getState().authNotice).toMatch(/confirmation link to ana@example.com/);
    expect(store.getState().rememberedEmail).toBe("ana@example.com");
  });

  it("signs out back to the sign-in screen", async () => {
    const api = hostedApi();
    const store = createStore(api);
    store.setState({ authStatus: "signedIn", user: SIGNED_IN.user, bootStatus: "ready" });
    await store.getState().signOut();
    expect(api.signOut).toHaveBeenCalled();
    expect(store.getState().authStatus).toBe("signedOut");
    expect(store.getState().user).toBeNull();
    expect(store.getState().bootStatus).toBe("loading");
  });

  it("goes back to the sign-in screen when the API says the session ended", () => {
    let sessionEnded = null;
    const api = hostedApi({
      onUnauthenticated: vi.fn((listener) => {
        sessionEnded = listener;
        return () => {};
      }),
    });
    const store = createStore(api);
    store.setState({ authStatus: "signedIn", user: SIGNED_IN.user, bootStatus: "ready" });
    sessionEnded();
    expect(store.getState().authStatus).toBe("signedOut");
    expect(store.getState().authError).toMatch(/signed out/);
  });
});

describe("forgetting a password", () => {
  it("asks for a reset link that comes back to the reset page", async () => {
    const api = hostedApi();
    const store = createStore(api);
    store.setState({ authStatus: "signedOut", authScreen: "forgotPassword" });
    await store.getState().requestPasswordReset({ email: "ana@example.com" });
    expect(api.requestPasswordReset).toHaveBeenCalledWith({
      email: "ana@example.com",
      redirectTo: "/reset-password",
    });
    expect(store.getState().authScreen).toBe("signIn");
    expect(store.getState().authNotice).toMatch(/link to reset the password/);
  });

  it("opens the new-password form from the emailed link, and clears the token from the address", async () => {
    const api = hostedApi();
    const platform = createFakePlatform({
      readCurrentLink: vi.fn().mockReturnValue({
        path: "/reset-password",
        parameters: { token: "token-123" },
      }),
    });
    const store = createAppStore({ api, platform });
    await store.getState().start();
    expect(store.getState().authScreen).toBe("resetPassword");
    expect(platform.replaceCurrentLink).toHaveBeenCalledWith("/");

    await store.getState().resetPassword({ newPassword: "a brand new one" });
    expect(api.resetPassword).toHaveBeenCalledWith({
      token: "token-123",
      newPassword: "a brand new one",
    });
    expect(store.getState().authScreen).toBe("signIn");
    expect(store.getState().authNotice).toMatch(/password is changed/);
  });

  it("says when a reset link has expired", async () => {
    const platform = createFakePlatform({
      readCurrentLink: vi.fn().mockReturnValue({
        path: "/reset-password",
        parameters: { error: "INVALID_TOKEN" },
      }),
    });
    const store = createAppStore({ api: hostedApi(), platform });
    await store.getState().start();
    expect(store.getState().authScreen).toBe("forgotPassword");
    expect(store.getState().authError).toMatch(/expired/);
  });
});

describe("ForgotPasswordForm and ResetPasswordForm", () => {
  it("sends the reset link to the email typed", async () => {
    const onRequestReset = vi.fn();
    renderWithTheme(
      <ForgotPasswordForm
        error={null}
        isBusy={false}
        onRequestReset={onRequestReset}
        onShowSignIn={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(onRequestReset).toHaveBeenCalledWith({ email: "ana@example.com" });
  });

  it("saves a new password only when it's long enough and typed the same twice", async () => {
    const onResetPassword = vi.fn();
    renderWithTheme(
      <ResetPasswordForm
        error={null}
        isBusy={false}
        onResetPassword={onResetPassword}
        onShowSignIn={vi.fn()}
      />,
    );
    const saveButton = screen.getByRole("button", { name: "Save new password" });
    await userEvent.type(screen.getByLabelText("New password"), "a brand new one");
    await userEvent.type(screen.getByLabelText("New password again"), "a brand new on");
    expect(screen.getByText("The two passwords don't match yet.")).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("New password again"), "e");
    await userEvent.click(saveButton);
    expect(onResetPassword).toHaveBeenCalledWith({ newPassword: "a brand new one" });
  });
});

describe("the API client and sessions", () => {
  function respondWith(status, body) {
    return vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  }

  it("tells listeners when an API call answers 401", async () => {
    const fetchFunction = respondWith(401, { error: { code: "unauthenticated", message: "x" } });
    const api = createApiClient({ baseUrl: "/api/v1", fetchFunction });
    const listener = vi.fn();
    api.onUnauthenticated(listener);
    await expect(api.listStories()).rejects.toThrow();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("doesn't treat a wrong password as the session ending", async () => {
    const fetchFunction = respondWith(401, { code: "INVALID_EMAIL_OR_PASSWORD", message: "x" });
    const api = createApiClient({ baseUrl: "/api/v1", authBaseUrl: "/api/auth", fetchFunction });
    const listener = vi.fn();
    api.onUnauthenticated(listener);
    await expect(api.signIn({ email: "a@b.c", password: "nope" })).rejects.toMatchObject({
      status: 401,
      code: "INVALID_EMAIL_OR_PASSWORD",
    });
    expect(listener).not.toHaveBeenCalled();
    expect(fetchFunction).toHaveBeenCalledWith("/api/auth/sign-in/email", expect.anything());
  });
});

describe("SignInForm", () => {
  function renderForm(overrides = {}) {
    const props = {
      error: null,
      isBusy: false,
      onSignIn: vi.fn(),
      onShowSignUp: vi.fn(),
      onForgotPassword: vi.fn(),
    };
    renderWithTheme(<SignInForm {...props} {...overrides} />);
    return { ...props, ...overrides };
  }

  it("signs in with the email and password typed", async () => {
    const props = renderForm();
    const signInButton = screen.getByRole("button", { name: "Sign in" });
    expect(signInButton).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Email"), "  ana@example.com ");
    await userEvent.type(screen.getByLabelText("Password"), "a long secret");
    await userEvent.click(signInButton);
    expect(props.onSignIn).toHaveBeenCalledWith({
      email: "ana@example.com",
      password: "a long secret",
    });
  });

  it("shows a notice, any error, and the remembered email", () => {
    renderForm({
      notice: "We sent a confirmation link to ana@example.com.",
      initialEmail: "ana@example.com",
      error: "That email and password don't match.",
    });
    expect(screen.getByText(/confirmation link to ana@example.com/)).toBeInTheDocument();
    expect(screen.getByText("That email and password don't match.")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
  });

  it("switches to creating an account, or to resetting the password", async () => {
    const props = renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Create an account" }));
    expect(props.onShowSignUp).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(props.onForgotPassword).toHaveBeenCalled();
  });
});

describe("SignUpForm", () => {
  it("needs a password of at least ten characters", async () => {
    const onSignUp = vi.fn();
    renderWithTheme(
      <SignUpForm error={null} isBusy={false} onSignUp={onSignUp} onShowSignIn={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText("Name"), "Ana");
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "too short");
    const createButton = screen.getByRole("button", { name: "Create account" });
    expect(createButton).toBeDisabled();

    await userEvent.type(screen.getByLabelText("Password"), "!");
    await userEvent.click(createButton);
    expect(onSignUp).toHaveBeenCalledWith({
      name: "Ana",
      email: "ana@example.com",
      password: "too short!",
    });
  });
});

describe("AppBar sign out", () => {
  function renderBar(overrides = {}) {
    const props = {
      views: [{ id: "chat", label: "Chat" }],
      currentView: "chat",
      badge: { label: "Claude", isReady: true, title: "" },
      colorSchemePreference: "auto",
      onNavigate: vi.fn(),
      onBadgePress: vi.fn(),
      onCycleColorScheme: vi.fn(),
      ...overrides,
    };
    renderWithTheme(<AppBar {...props} />);
    return props;
  }

  it("offers Sign out when signed in", async () => {
    const props = renderBar({ signedInAs: "Signed in as ana@example.com", onSignOut: vi.fn() });
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(props.onSignOut).toHaveBeenCalled();
  });

  it("has no Sign out when Oread runs locally", () => {
    renderBar();
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
