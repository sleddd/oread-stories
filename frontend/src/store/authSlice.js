// Signing in and out. Locally Oread has no accounts ("notRequired"); hosted, nothing loads until
// someone is signed in, and a session that ends sends the interface back to the sign-in screen.
//
// authStatus: "checking" → "notRequired" | "signedOut" | "signedIn"
// authScreen (while signed out): "signIn" | "signUp" | "forgotPassword" | "resetPassword"

const SIGN_IN_SCREEN = "signIn";
const SIGN_UP_SCREEN = "signUp";
const FORGOT_PASSWORD_SCREEN = "forgotPassword";
const RESET_PASSWORD_SCREEN = "resetPassword";

// The emailed reset link opens this page with ?token=… (or ?error=INVALID_TOKEN).
export const RESET_PASSWORD_PATH = "/reset-password";
const HOME_PATH = "/";

const EMAIL_NOT_CONFIRMED_CODE = "EMAIL_NOT_VERIFIED";
const WRONG_PASSWORD_STATUS = 401;

const MESSAGES = {
  emailNotConfirmed: "Confirm your email first. We've sent you a new link.",
  wrongPassword: "That email and password don't match.",
  sessionEnded: "You've been signed out. Sign in again to carry on.",
  resetLinkExpired: "That reset link has expired or was already used. Ask for a new one.",
  passwordChanged: "Your password is changed. Sign in with the new one.",
};

function confirmationSentNotice(email) {
  return `We sent a confirmation link to ${email}. Follow it, then sign in here.`;
}

function resetLinkSentNotice(email) {
  return `If ${email} has an account, a link to reset the password is on its way.`;
}

function signInErrorMessage(error) {
  if (error.code === EMAIL_NOT_CONFIRMED_CODE) {
    return MESSAGES.emailNotConfirmed;
  }
  if (error.status === WRONG_PASSWORD_STATUS) {
    return MESSAGES.wrongPassword;
  }
  return error.message;
}

export function createAuthSlice({ api, platform }) {
  return (set, get) => ({
    authStatus: "checking",
    authScreen: SIGN_IN_SCREEN,
    user: null,
    isAuthBusy: false,
    authError: null,
    // A note shown above the sign-in form, e.g. "check your email".
    authNotice: null,
    // The email to fill in on the sign-in form after signing up or asking for a reset.
    rememberedEmail: "",
    resetToken: null,

    // Decides what the interface shows first, then loads the app when it's allowed in.
    async start() {
      const isAllowedIn = await get().checkSignIn();
      if (isAllowedIn) {
        await get().boot();
        return;
      }
      get().openResetLinkIfPresent();
    },

    async checkSignIn() {
      try {
        const health = await api.getHealth();
        if (!health.requiresSignIn) {
          set({ authStatus: "notRequired" });
          return true;
        }
        const session = await api.getSession();
        if (session?.user) {
          set({ authStatus: "signedIn", user: session.user });
          return true;
        }
        set({ authStatus: "signedOut" });
        return false;
      } catch (error) {
        set({ bootStatus: "failed", bootError: error.message });
        return false;
      }
    },

    // Opened from the emailed reset link: show the new-password form, or say the link expired.
    openResetLinkIfPresent() {
      const { path, parameters } = platform.readCurrentLink();
      if (path !== RESET_PASSWORD_PATH) {
        return;
      }
      platform.replaceCurrentLink(HOME_PATH);
      if (parameters.token) {
        set({ authScreen: RESET_PASSWORD_SCREEN, resetToken: parameters.token, authError: null });
        return;
      }
      set({ authScreen: FORGOT_PASSWORD_SCREEN, authError: MESSAGES.resetLinkExpired });
    },

    showSignIn() {
      set({ authScreen: SIGN_IN_SCREEN, authError: null, authNotice: null });
    },

    showSignUp() {
      set({ authScreen: SIGN_UP_SCREEN, authError: null, authNotice: null });
    },

    showForgotPassword() {
      set({ authScreen: FORGOT_PASSWORD_SCREEN, authError: null, authNotice: null });
    },

    async signIn({ email, password }) {
      set({ isAuthBusy: true, authError: null, authNotice: null });
      try {
        await api.signIn({ email, password });
        const session = await api.getSession();
        set({ authStatus: "signedIn", user: session?.user ?? null, bootStatus: "loading" });
        await get().boot();
      } catch (error) {
        set({ authError: signInErrorMessage(error) });
      } finally {
        set({ isAuthBusy: false });
      }
    },

    async signUp({ name, email, password }) {
      set({ isAuthBusy: true, authError: null });
      try {
        await api.signUp({ name, email, password });
        set({
          authScreen: SIGN_IN_SCREEN,
          authNotice: confirmationSentNotice(email),
          rememberedEmail: email,
        });
      } catch (error) {
        set({ authError: error.message });
      } finally {
        set({ isAuthBusy: false });
      }
    },

    async requestPasswordReset({ email }) {
      set({ isAuthBusy: true, authError: null });
      try {
        await api.requestPasswordReset({ email, redirectTo: RESET_PASSWORD_PATH });
        set({
          authScreen: SIGN_IN_SCREEN,
          authNotice: resetLinkSentNotice(email),
          rememberedEmail: email,
        });
      } catch (error) {
        set({ authError: error.message });
      } finally {
        set({ isAuthBusy: false });
      }
    },

    async resetPassword({ newPassword }) {
      set({ isAuthBusy: true, authError: null });
      try {
        await api.resetPassword({ token: get().resetToken, newPassword });
        set({
          authScreen: SIGN_IN_SCREEN,
          authNotice: MESSAGES.passwordChanged,
          resetToken: null,
        });
      } catch (error) {
        set({ authError: error.message });
      } finally {
        set({ isAuthBusy: false });
      }
    },

    async signOut() {
      try {
        await api.signOut();
      } catch {
        // Signed out locally either way; an expired session can't be ended twice.
      }
      get().leaveForSignIn(null);
    },

    // The API answered 401: the session expired or was ended elsewhere.
    handleSessionEnded() {
      if (get().authStatus !== "signedIn") {
        return;
      }
      get().leaveForSignIn(MESSAGES.sessionEnded);
    },

    // Back to the sign-in screen. Everything is loaded again on the next sign-in, so no one sees
    // the last person's stories.
    leaveForSignIn(message) {
      set({
        authStatus: "signedOut",
        authScreen: SIGN_IN_SCREEN,
        user: null,
        authError: message,
        authNotice: null,
        bootStatus: "loading",
      });
    },
  });
}
