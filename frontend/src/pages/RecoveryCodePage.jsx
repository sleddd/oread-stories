// Shown before the app whenever a new recovery code is waiting: on the account's first unlock,
// after recovering, after starting over, and after asking for a new code in Settings.
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { AuthTemplate } from "../components/templates/index.js";
import { RecoveryCodeNotice } from "../components/organisms/index.js";

export function RecoveryCodePage() {
  const vault = useAppStore(
    useShallow((state) => ({
      pendingRecoveryCode: state.pendingRecoveryCode,
      copyRecoveryCode: state.copyRecoveryCode,
      confirmRecoveryCodeSaved: state.confirmRecoveryCodeSaved,
    })),
  );
  return (
    <AuthTemplate>
      <RecoveryCodeNotice
        recoveryCode={vault.pendingRecoveryCode}
        onCopy={vault.copyRecoveryCode}
        onSaved={vault.confirmRecoveryCodeSaved}
      />
    </AuthTemplate>
  );
}
