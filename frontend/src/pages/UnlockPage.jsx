// What a signed-in but locked session sees: the password to open the encrypted stories, or,
// after a password reset, the recovery code (or starting over).
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { AuthTemplate } from "../components/templates/index.js";
import { UnlockForm, RecoveryForm } from "../components/organisms/index.js";

export function UnlockPage() {
  const vault = useAppStore(
    useShallow((state) => ({
      lockScreen: state.lockScreen,
      vaultError: state.vaultError,
      isVaultBusy: state.isVaultBusy,
      unlock: state.unlock,
      recover: state.recover,
      startOver: state.startOver,
      showRecoveryScreen: state.showRecoveryScreen,
      showUnlockScreen: state.showUnlockScreen,
      signOut: state.signOut,
    })),
  );
  if (vault.lockScreen === "recover") {
    return (
      <AuthTemplate key="recover">
        <RecoveryForm
          error={vault.vaultError}
          isBusy={vault.isVaultBusy}
          onRecover={vault.recover}
          onStartOver={vault.startOver}
          onBack={vault.showUnlockScreen}
        />
      </AuthTemplate>
    );
  }
  return (
    <AuthTemplate key="unlock">
      <UnlockForm
        error={vault.vaultError}
        isBusy={vault.isVaultBusy}
        onUnlock={vault.unlock}
        onForgotPassword={vault.showRecoveryScreen}
        onSignOut={vault.signOut}
      />
    </AuthTemplate>
  );
}
