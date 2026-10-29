// What a signed-out visitor sees: signing in, creating an account, asking for a reset link, or
// choosing a new password after following one.
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { AuthTemplate } from "../components/templates/index.js";
import {
  SignInForm,
  SignUpForm,
  ForgotPasswordForm,
  ResetPasswordForm,
} from "../components/organisms/index.js";

const FORMS = {
  signIn: (auth) => (
    <SignInForm
      error={auth.authError}
      notice={auth.authNotice}
      initialEmail={auth.rememberedEmail}
      isBusy={auth.isAuthBusy}
      onSignIn={auth.signIn}
      onShowSignUp={auth.showSignUp}
      onForgotPassword={auth.showForgotPassword}
    />
  ),
  signUp: (auth) => (
    <SignUpForm
      error={auth.authError}
      isBusy={auth.isAuthBusy}
      onSignUp={auth.signUp}
      onShowSignIn={auth.showSignIn}
    />
  ),
  forgotPassword: (auth) => (
    <ForgotPasswordForm
      error={auth.authError}
      initialEmail={auth.rememberedEmail}
      isBusy={auth.isAuthBusy}
      onRequestReset={auth.requestPasswordReset}
      onShowSignIn={auth.showSignIn}
    />
  ),
  resetPassword: (auth) => (
    <ResetPasswordForm
      error={auth.authError}
      isBusy={auth.isAuthBusy}
      onResetPassword={auth.resetPassword}
      onShowSignIn={auth.showSignIn}
    />
  ),
};

export function AuthPage() {
  const auth = useAppStore(
    useShallow((state) => ({
      authScreen: state.authScreen,
      authError: state.authError,
      authNotice: state.authNotice,
      rememberedEmail: state.rememberedEmail,
      isAuthBusy: state.isAuthBusy,
      signIn: state.signIn,
      signUp: state.signUp,
      requestPasswordReset: state.requestPasswordReset,
      resetPassword: state.resetPassword,
      showSignIn: state.showSignIn,
      showSignUp: state.showSignUp,
      showForgotPassword: state.showForgotPassword,
    })),
  );
  const renderForm = FORMS[auth.authScreen] ?? FORMS.signIn;
  // Keyed by screen so each form starts with fresh fields.
  return <AuthTemplate key={auth.authScreen}>{renderForm(auth)}</AuthTemplate>;
}
