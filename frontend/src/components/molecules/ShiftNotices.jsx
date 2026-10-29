// Personality-shift notices: the marker in the transcript, and the pending change above the composer.
import styled from "styled-components";
import { Row, Text } from "../../ui/primitives/index.js";
import { Button } from "../atoms/index.js";

const MarkerRow = styled(Row)`
  max-width: 820px;
  width: 100%;
  margin: 2px auto;
  gap: 10px;
  color: ${({ theme }) => theme.colors.accent};
  font-size: 14.5px;
  &::before,
  &::after {
    content: "";
    flex: 1;
    border-top: 1px solid ${({ theme }) => theme.colors.accent};
    opacity: 0.45;
  }
`;

const MarkerText = styled(Text)`
  max-width: 80%;
  text-align: center;
`;

const CharacterShifts = styled(Text)`
  font-family: ${({ theme }) => theme.fonts.serif};
  font-style: italic;
  font-weight: 600;
`;

export function ShiftMarker({ characterName, summary }) {
  return (
    <MarkerRow role="note">
      <MarkerText>
        <CharacterShifts>{`${characterName} shifts`}</CharacterShifts>
        {` — ${summary}`}
      </MarkerText>
    </MarkerRow>
  );
}

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
