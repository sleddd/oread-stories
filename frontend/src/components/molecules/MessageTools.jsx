// The actions under a message, as icons. Which appear depends on its role and whether it's the
// last one. Every icon is named (and shows its name on hover), so the row reads the same to a
// screen reader as a row of words.
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { IconButton } from "../atoms/index.js";

const ToolRow = styled(Row)`
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
`;

const VersionCount = styled(Text)`
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.muted};
  font-variant-numeric: tabular-nums;
`;

function VersionSwitcher({ message, isBusy, onSwitchVersion }) {
  const currentVersion = message.alt;
  const lastVersion = message.alts.length - 1;
  return (
    <>
      <IconButton
        icon="chevronLeft"
        label="Previous version"
        disabled={isBusy || currentVersion === 0}
        onPress={() => onSwitchVersion(currentVersion - 1)}
      />
      <VersionCount>{`${currentVersion + 1}/${message.alts.length}`}</VersionCount>
      <IconButton
        icon="chevronRight"
        label="Next version"
        disabled={isBusy || currentVersion === lastVersion}
        onPress={() => onSwitchVersion(currentVersion + 1)}
      />
    </>
  );
}

export function MessageTools({
  message,
  isLast,
  isBusy,
  onSwitchVersion,
  onRequestReply,
  onEdit,
  onCopy,
  onDelete,
}) {
  const hasVersions = message.alts?.length > 1;
  const canRegenerate = message.role === "assistant" && isLast;
  const canAskForReply = message.role === "user" && isLast;
  const regenerateLabel = message.error ? "Retry" : "Regenerate";

  return (
    <ToolRow>
      {hasVersions && (
        <VersionSwitcher message={message} isBusy={isBusy} onSwitchVersion={onSwitchVersion} />
      )}
      {canRegenerate && (
        <IconButton
          icon="regenerate"
          label={regenerateLabel}
          disabled={isBusy}
          onPress={onRequestReply}
        />
      )}
      {canAskForReply && (
        <IconButton icon="reply" label="Get reply" disabled={isBusy} onPress={onRequestReply} />
      )}
      <IconButton icon="edit" label="Edit" disabled={isBusy} onPress={onEdit} />
      <IconButton icon="copy" label="Copy" onPress={onCopy} />
      <IconButton icon="delete" label="Delete" disabled={isBusy} onPress={onDelete} />
    </ToolRow>
  );
}
