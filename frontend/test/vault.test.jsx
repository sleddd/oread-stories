// Encrypted accounts: a signed-in session that is locked until the password opens it, recovery
// after a password reset, starting over, the recovery code shown once, the API's 423, and the
// loading screen shown while it all starts.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createAppStore } from "../src/store/index.js";
import { createApiClient } from "../src/api/createApiClient.js";
import { ApiError } from "../src/api/ApiError.js";
import {
  UnlockForm,
  RecoveryForm,
  RecoveryCodeNotice,
} from "../src/components/organisms/index.js";
import { LoadingTemplate } from "../src/components/templates/index.js";
import { renderWithTheme, createFakeApi, createFakePlatform } from "./helpers.jsx";

const HOSTED = { status: "ok", requiresSignIn: true };
const SIGNED_IN = { user: { id: "user-1", email: "ana@example.com", name: "Ana" } };
const LOCKED = { state: "locked", recoveryCode: null };
const RECOVERY_CODE = "ABCD-EFGH-JKMN-PQRS-TVWX-YZ01-2345-6789";

function signedInApi(overrides = {}) {
  return createFakeApi({
    getHealth: vi.fn().mockResolvedValue(HOSTED),
    getSession: vi.fn().mockResolvedValue(SIGNED_IN),
    ...overrides,
  });
}

function createStore(api, platform = createFakePlatform()) {
  return createAppStore({ api, platform });
}

function needsRecoveryError() {
  return new ApiError({ status: 423, code: "needs_recovery", message: "Recovery needed." });
}

describe("a locked session", () => {
  it("asks for the password before loading anything", async () => {
    const api = signedInApi({ getVaultStatus: vi.fn().mockResolvedValue(LOCKED) });
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().authStatus).toBe("locked");
    expect(store.getState().lockScreen).toBe("unlock");
    expect(api.listStories).not.toHaveBeenCalled();
  });

  it("unlocks with the password, then shows the new recovery code before the app", async () => {
    const getVaultStatus = vi
      .fn()
      .mockResolvedValueOnce(LOCKED)
      .mockResolvedValue({ state: "unlocked", recoveryCode: RECOVERY_CODE });
    const api = signedInApi({ getVaultStatus });
    const store = createStore(api);
    await store.getState().start();

    await store.getState().unlock({ password: "the password" });
    expect(api.unlockVault).toHaveBeenCalledWith({ password: "the password" });
    expect(store.getState().authStatus).toBe("signedIn");
    expect(store.getState().pendingRecoveryCode).toBe(RECOVERY_CODE);

    await store.getState().confirmRecoveryCodeSaved();
    expect(store.getState().pendingRecoveryCode).toBeNull();
    expect(api.markRecoveryCodeSaved).toHaveBeenCalled();
  });

  it("moves to recovery when the password no longer opens the data", async () => {
    const api = signedInApi({
      getVaultStatus: vi.fn().mockResolvedValue(LOCKED),
      unlockVault: vi.fn().mockRejectedValue(needsRecoveryError()),
    });
    const store = createStore(api);
    await store.getState().start();
    await store.getState().unlock({ password: "a new password" });
    expect(store.getState().authStatus).toBe("locked");
    expect(store.getState().lockScreen).toBe("recover");
    expect(store.getState().vaultError).toBeNull();
  });

  it("signing in tries the same password when the session comes back locked", async () => {
    const getVaultStatus = vi
      .fn()
      .mockResolvedValueOnce(LOCKED)
      .mockResolvedValue({ state: "unlocked", recoveryCode: null });
    const api = signedInApi({ getVaultStatus, getSession: vi.fn().mockResolvedValue(SIGNED_IN) });
    const store = createStore(api);
    await store.getState().signIn({ email: "ana@example.com", password: "the password" });
    expect(api.unlockVault).toHaveBeenCalledWith({ password: "the password" });
    expect(store.getState().authStatus).toBe("signedIn");
  });

  it("goes back to the unlock screen when a request finds the session locked", async () => {
    const api = signedInApi();
    const store = createStore(api);
    await store.getState().start();
    expect(store.getState().authStatus).toBe("signedIn");
    store.getState().handleLocked("needs_recovery");
    expect(store.getState().authStatus).toBe("locked");
    expect(store.getState().lockScreen).toBe("recover");
  });
});

describe("the API client", () => {
  function lockedResponse(code) {
    const body = JSON.stringify({ error: { code, message: "Locked." } });
    return new Response(body, { status: 423, headers: { "content-type": "application/json" } });
  }

  it("tells listeners when a request finds the session locked, except the vault's", async () => {
    const fetchFunction = vi.fn().mockImplementation(async () => lockedResponse("locked"));
    const api = createApiClient({ baseUrl: "http://api.test/api/v1", fetchFunction });
    const onLocked = vi.fn();
    api.onLocked(onLocked);

    await expect(api.listStories()).rejects.toMatchObject({ status: 423 });
    expect(onLocked).toHaveBeenCalledWith("locked");

    onLocked.mockClear();
    await expect(api.unlockVault({ password: "x" })).rejects.toMatchObject({ status: 423 });
    expect(onLocked).not.toHaveBeenCalled();
  });
});

describe("UnlockForm", () => {
  it("unlocks with what was typed and offers recovery", async () => {
    const onUnlock = vi.fn();
    const onForgotPassword = vi.fn();
    renderWithTheme(
      <UnlockForm
        error={null}
        isBusy={false}
        onUnlock={onUnlock}
        onForgotPassword={onForgotPassword}
        onSignOut={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Password"), "the password{Enter}");
    expect(onUnlock).toHaveBeenCalledWith({ password: "the password" });
    await userEvent.click(screen.getByRole("button", { name: "Use your recovery code" }));
    expect(onForgotPassword).toHaveBeenCalled();
  });
});

describe("RecoveryForm", () => {
  function renderForm() {
    const props = { onRecover: vi.fn(), onStartOver: vi.fn(), onBack: vi.fn() };
    renderWithTheme(<RecoveryForm error={null} isBusy={false} {...props} />);
    return props;
  }

  it("recovers with the password and the recovery code", async () => {
    const { onRecover } = renderForm();
    await userEvent.type(screen.getByLabelText("Your current password"), "new password");
    await userEvent.type(screen.getByLabelText("Recovery code"), RECOVERY_CODE);
    await userEvent.click(screen.getByRole("button", { name: "Recover my stories" }));
    expect(onRecover).toHaveBeenCalledWith({
      password: "new password",
      recoveryCode: RECOVERY_CODE,
    });
  });

  it("starts over only once 'erase' is typed", async () => {
    const { onStartOver } = renderForm();
    await userEvent.type(screen.getByLabelText("Your current password"), "new password");
    const startOver = screen.getByRole("button", { name: "Erase everything and start over" });
    expect(startOver).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Type erase to confirm"), "erase");
    expect(startOver).toBeEnabled();
    await userEvent.click(startOver);
    expect(onStartOver).toHaveBeenCalledWith({ password: "new password" });
  });
});

describe("RecoveryCodeNotice", () => {
  it("shows the code, copies it, and goes on once it's saved", async () => {
    const onCopy = vi.fn().mockResolvedValue(true);
    const onSaved = vi.fn();
    renderWithTheme(
      <RecoveryCodeNotice recoveryCode={RECOVERY_CODE} onCopy={onCopy} onSaved={onSaved} />,
    );
    expect(screen.getByText(RECOVERY_CODE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Copy the code" }));
    expect(onCopy).toHaveBeenCalledWith(RECOVERY_CODE);
    expect(screen.getByText("Copied.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "I've saved it" }));
    expect(onSaved).toHaveBeenCalled();
  });
});

describe("LoadingTemplate", () => {
  it("shows the starting message as a status, with the mark", () => {
    renderWithTheme(<LoadingTemplate message="Opening Oread…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Opening Oread…");
  });
});
