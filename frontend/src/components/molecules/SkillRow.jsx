// One skill in a character's skills table: name, level (0–10), a note, and a remove button.
import styled from "styled-components";
import { Row, View } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";
import { ScoreField } from "./ScoreField.jsx";
import { SKILL_LIMITS } from "../../content/story.js";

const Layout = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  padding: 6px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const NameField = styled(TextField)`
  flex: 1 1 140px;
`;

const NoteField = styled(TextField)`
  flex: 2 1 200px;
`;

const Controls = styled(View)`
  flex: none;
`;

export function SkillRow({ skill, onChange, onRemove }) {
  return (
    <Layout>
      <NameField
        accessibilityLabel="Skill name"
        value={skill.name}
        placeholder="Skill"
        onChangeText={(name) => onChange({ ...skill, name })}
      />
      <Controls>
        <ScoreField
          label={skill.name || "skill"}
          score={skill.level}
          minimum={SKILL_LIMITS.minimum}
          maximum={SKILL_LIMITS.maximum}
          onChange={(level) => onChange({ ...skill, level })}
        />
      </Controls>
      <NoteField
        accessibilityLabel={`Note for ${skill.name || "skill"}`}
        value={skill.note}
        placeholder="Note"
        onChangeText={(note) => onChange({ ...skill, note })}
      />
      <Button
        label="Remove"
        size="small"
        variant="ghost"
        accessibilityLabel={`Remove ${skill.name || "skill"}`}
        onPress={onRemove}
      />
    </Layout>
  );
}
