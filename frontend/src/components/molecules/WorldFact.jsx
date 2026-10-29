// One lasting fact about the world ("kitchen window: broken"), editable in place.
import { useState } from "react";
import styled from "styled-components";
import { Row, View, Text } from "../../ui/primitives/index.js";
import { Button, TextField, Hint } from "../atoms/index.js";
import { KeywordInput, joinKeywords } from "./KeywordInput.jsx";

const Card = styled(View)`
  gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const Subject = styled(Text)`
  font-weight: 700;
`;

const Toolbar = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
`;

function WorldFactForm({ fact, onSave, onCancel }) {
  const [subject, setSubject] = useState(fact.subject);
  const [factText, setFactText] = useState(fact.fact);
  const [keywords, setKeywords] = useState(fact.keywords ?? []);
  const isComplete = subject.trim() && factText.trim();
  return (
    <>
      <TextField accessibilityLabel="Subject" value={subject} onChangeText={setSubject} />
      <TextField accessibilityLabel="Fact" value={factText} onChangeText={setFactText} />
      <KeywordInput keywords={keywords} onChange={setKeywords} />
      <Toolbar>
        <Button
          label="Save"
          variant="primary"
          size="small"
          disabled={!isComplete}
          onPress={() => onSave({ subject, fact: factText, keywords })}
        />
        <Button label="Cancel" size="small" onPress={onCancel} />
      </Toolbar>
    </>
  );
}

export function WorldFact({ fact, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  if (isEditing) {
    return (
      <Card>
        <WorldFactForm
          fact={fact}
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
      <Text>
        <Subject>{fact.subject}</Subject>
        {`: ${fact.fact}`}
      </Text>
      {fact.keywords?.length > 0 && <Hint>{`Keywords: ${joinKeywords(fact.keywords)}`}</Hint>}
      <Toolbar>
        <Button label="Edit" size="small" variant="ghost" onPress={() => setIsEditing(true)} />
        <Button
          label="Remove"
          size="small"
          variant="ghost"
          accessibilityLabel={`Remove ${fact.subject}`}
          onPress={onDelete}
        />
      </Toolbar>
    </Card>
  );
}
