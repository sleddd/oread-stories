// Who is in the scene: one chip per AI character, with the one speaking now marked. At least one
// has to stay, or nobody could answer.
import styled from "styled-components";
import { Row, Pressable } from "../../ui/primitives/index.js";
import { Avatar, Eyebrow } from "../atoms/index.js";

const Bar = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
`;

const Label = styled(Eyebrow)`
  margin-right: 4px;
`;

// The speaker's chip carries the accent; someone stepped out of the scene is dashed and faded.
function chipBorder({ $isSpeaking, $isPresent, theme }) {
  if ($isSpeaking) {
    return `1px solid ${theme.colors.accent}`;
  }
  if ($isPresent) {
    return `1px solid ${theme.colors.lineStrong}`;
  }
  return `1px dashed ${theme.colors.lineStrong}`;
}

const CastChip = styled(Pressable)`
  display: inline-flex;
  align-items: center;
  gap: 7px;
  font: inherit;
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ $isPresent, theme }) => ($isPresent ? theme.colors.ink : theme.colors.muted)};
  padding: 3px 14px 3px 4px;
  border-radius: ${({ theme }) => theme.radii.pill};
  border: ${chipBorder};
  background: ${({ $isSpeaking, theme }) => ($isSpeaking ? theme.colors.accentSoft : theme.colors.panel)};
  opacity: ${({ $isPresent }) => ($isPresent ? 1 : 0.7)};
  cursor: pointer;
  &:hover {
    border-color: ${({ theme }) => theme.colors.accent};
  }
`;

function toggledIds(presentIds, characterId, isOn) {
  if (isOn) {
    return [...presentIds, characterId];
  }
  return presentIds.filter((presentId) => presentId !== characterId);
}

export function PresentCastBar({
  characters,
  presentCharacterIds,
  speakingCharacterId,
  isDisabled,
  onChange,
}) {
  if (characters.length === 0) {
    return null;
  }
  return (
    <Bar role="group" aria-label="In the scene">
      <Label>In the scene</Label>
      {characters.map((character) => {
        const isPresent = presentCharacterIds.includes(character.id);
        const isLastPresent = isPresent && presentCharacterIds.length === 1;
        return (
          <CastChip
            key={character.id}
            isPressed={isPresent}
            title={isLastPresent ? "Someone has to stay in the scene" : undefined}
            $isPresent={isPresent}
            $isSpeaking={isPresent && character.id === speakingCharacterId}
            onPress={() => {
              if (isDisabled || isLastPresent) {
                return;
              }
              onChange(toggledIds(presentCharacterIds, character.id, !isPresent));
            }}
          >
            <Avatar name={character.name} size="small" />
            {character.name}
          </CastChip>
        );
      })}
    </Bar>
  );
}
