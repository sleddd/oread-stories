// The six ability scores (1–20) with their tabletop modifiers.
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Note } from "../atoms/index.js";
import { ScoreField } from "../molecules/index.js";
import { ABILITIES, ABILITY_LIMITS, ABILITIES_NOTE } from "../../content/story.js";
import { abilityModifier } from "../../lib/describeStory.js";

const AbilityRow = styled(Row)`
  justify-content: space-between;
  gap: 10px;
  padding: 4px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const AbilityName = styled(Text)`
  font-weight: 600;
`;

export function AbilityChart({ abilities, onChange }) {
  return (
    <View>
      <Note>{ABILITIES_NOTE}</Note>
      {ABILITIES.map((ability) => (
        <AbilityRow key={ability.id}>
          <AbilityName>{ability.label}</AbilityName>
          <ScoreField
            label={ability.label}
            score={abilities[ability.id]}
            minimum={ABILITY_LIMITS.minimum}
            maximum={ABILITY_LIMITS.maximum}
            extra={abilityModifier(abilities[ability.id])}
            onChange={(score) => onChange({ [ability.id]: score })}
          />
        </AbilityRow>
      ))}
    </View>
  );
}
