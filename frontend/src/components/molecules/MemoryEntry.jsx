// One memory: its text, what it is about, how much it matters and where it came from. Pressing
// Edit turns it into a small form.
import { useState } from "react";
import styled from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Button, TextArea, Hint } from "../atoms/index.js";
import { KeywordInput } from "./KeywordInput.jsx";
import { ScoreField } from "./ScoreField.jsx";
import { IMPORTANCE_LIMITS } from "../../content/story.js";

const Card = styled(View)`
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.field};
`;

const MemoryText = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 16.5px;
  line-height: 1.5;
  white-space: pre-wrap;
`;

const Toolbar = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
`;

function describeDetails(entry, sourceLabel) {
  const details = [sourceLabel, `importance ${entry.importance}`];
  if (entry.about?.length) {
    details.push(`about ${entry.about.join(", ")}`);
  }
  return details.join(" · ");
}

function MemoryEntryForm({ entry, onSave, onCancel }) {
  const [text, setText] = useState(entry.text);
  const [about, setAbout] = useState(entry.about ?? []);
  const [importance, setImportance] = useState(entry.importance);
  return (
    <>
      <TextArea accessibilityLabel="Memory text" value={text} onChangeText={setText} rows={3} />
      <KeywordInput label="About" keywords={about} onChange={setAbout} />
      <ScoreField
        label="Importance"
        score={importance}
        minimum={IMPORTANCE_LIMITS.minimum}
        maximum={IMPORTANCE_LIMITS.maximum}
        onChange={setImportance}
      />
      <Toolbar>
        <Button
          label="Save"
          variant="primary"
          size="small"
          disabled={!text.trim()}
          onPress={() => onSave({ text, about, importance })}
        />
        <Button label="Cancel" size="small" onPress={onCancel} />
      </Toolbar>
    </>
  );
}

export function MemoryEntry({ entry, sourceLabel, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);

  if (isEditing) {
    return (
      <Card aria-label="Editing memory">
        <MemoryEntryForm
          entry={entry}
          onCancel={() => setIsEditing(false)}
          onSave={(changes) => {
            setIsEditing(false);
            onSave(changes);
          }}
        />
      </Card>
    );
  }

  return (
    <Card>
      <MemoryText>{entry.text}</MemoryText>
      <Hint>{describeDetails(entry, sourceLabel)}</Hint>
      <Toolbar>
        <Button label="Edit" size="small" variant="ghost" onPress={() => setIsEditing(true)} />
        {onDelete && <Button label="Forget" size="small" variant="ghost" onPress={onDelete} />}
      </Toolbar>
    </Card>
  );
}
