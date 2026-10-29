// The world state: a short list of standing facts about places and things. Setting a fact about
// a subject that already has one replaces it.
import { useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import { Button, Note, EmptyState, TextField } from "../atoms/index.js";
import { WorldFact } from "../molecules/index.js";
import { WORLD_STATE_NOTE } from "../../content/story.js";

const AddRow = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

const SubjectField = styled(TextField)`
  flex: 1 1 140px;
`;

const FactField = styled(TextField)`
  flex: 2 1 220px;
`;

function AddFactForm({ onAdd }) {
  const [subject, setSubject] = useState("");
  const [fact, setFact] = useState("");
  const isComplete = subject.trim() && fact.trim();
  function add() {
    if (isComplete) {
      onAdd({ subject: subject.trim(), fact: fact.trim() });
      setSubject("");
      setFact("");
    }
  }
  return (
    <AddRow>
      <SubjectField
        accessibilityLabel="New fact subject"
        placeholder="Subject, e.g. kitchen window"
        value={subject}
        onChangeText={setSubject}
      />
      <FactField
        accessibilityLabel="New fact"
        placeholder="Fact, e.g. broken, glass on the floor"
        value={fact}
        onChangeText={setFact}
      />
      <Button label="Add fact" variant="primary" disabled={!isComplete} onPress={add} />
    </AddRow>
  );
}

// handlers: { onAdd(fact), onSave(factId, changes), onDelete(fact) }
export function WorldStateEditor({ facts, handlers }) {
  return (
    <View>
      <Note>{WORLD_STATE_NOTE}</Note>
      {facts.length === 0 && <EmptyState>Nothing has changed in the world yet.</EmptyState>}
      {facts.map((fact) => (
        <WorldFact
          key={fact.id}
          fact={fact}
          onSave={(changes) => handlers.onSave(fact.id, changes)}
          onDelete={() => handlers.onDelete(fact)}
        />
      ))}
      <AddFactForm onAdd={handlers.onAdd} />
    </View>
  );
}
