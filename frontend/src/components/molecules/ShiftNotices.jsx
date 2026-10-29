// The pending personality shift, shown above the composer with a way to undo it.
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";

const PendingRow = styled(Row)`
  gap: 8px;
  align-items: baseline;
  flex-wrap: wrap;
  font-size: 14.5px;
  color: ${({ theme }) => theme.colors.accent};
  margin-bottom: 6px;
`;

const PendingTitle = styled(Text)`
  font-weight: 700;
`;

export function ShiftPending({ summary, onUndo }) {
  return (
    <PendingRow>
      <PendingTitle>Shift on next reply:</PendingTitle>
      <Text>{summary}</Text>
      <Button
        label="Undo"
        variant="ghost"
        size="small"
        title="Put the dials back where they were at the last reply"
        onPress={onUndo}
      />
    </PendingRow>
  );
}
