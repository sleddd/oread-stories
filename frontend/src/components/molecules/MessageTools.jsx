// The actions under a message. Which appear depends on its role and whether it's the last one.
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";

const ToolRow = styled(Row)`
  gap: 2px;
  margin-top: 6px;
  flex-wrap: wrap;
  & button {
    font-size: 14px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.muted};
    padding: 2px 8px;
  }
`;

const VersionCount = styled(Text)`
  font-size: 14px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant-numeric: tabular-nums;
`;

function VersionSwitcher({ message, isBusy, onSwitchVersion }) {
  const currentVersion = message.alt;
  const lastVersion = message.alts.length - 1;
  return (
    <>
      <Button
        label="‹"
        variant="ghost"
        title="Previous version"
        accessibilityLabel="Previous version"
        disabled={isBusy || currentVersion === 0}
        onPress={() => onSwitchVersion(currentVersion - 1)}
      />
      <VersionCount>{`${currentVersion + 1}/${message.alts.length}`}</VersionCount>
      <Button
        label="›"
        variant="ghost"
        title="Next version"
        accessibilityLabel="Next version"
        disabled={isBusy || currentVersion === lastVersion}
        onPress={() => onSwitchVersion(currentVersion + 1)}
      />
    </>
  );
}

export function MessageTools({ message, isLast, isBusy, onSwitchVersion, onRequestReply, onEdit, onCopy, onDelete }) {
  const hasVersions = message.alts?.length > 1;
  const canRegenerate = message.role === "assistant" && isLast;
  const canAskForReply = message.role === "user" && isLast;
  const regenerateLabel = message.error ? "Retry" : "Regenerate";

  return (
    <ToolRow>
      {hasVersions && <VersionSwitcher message={message} isBusy={isBusy} onSwitchVersion={onSwitchVersion} />}
      {canRegenerate && <Button label={regenerateLabel} variant="ghost" disabled={isBusy} onPress={onRequestReply} />}
      {canAskForReply && <Button label="Get reply" variant="ghost" disabled={isBusy} onPress={onRequestReply} />}
      <Button label="Edit" variant="ghost" disabled={isBusy} onPress={onEdit} />
      <Button label="Copy" variant="ghost" onPress={onCopy} />
      <Button label="Delete" variant="ghost" disabled={isBusy} onPress={onDelete} />
    </ToolRow>
  );
}
