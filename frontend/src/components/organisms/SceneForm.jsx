// Editing the scene by hand: where, when, what's in motion, what was last said, who's here and
// what's within reach. The lists are typed as comma-separated names.
import { useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import { Button, TextField } from "../atoms/index.js";
import { FormField, joinKeywords, splitKeywords } from "../molecules/index.js";

const Toolbar = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
`;

const TEXT_FIELDS = [
  { id: "location", label: "Where" },
  { id: "timeOfDay", label: "Time of day" },
  { id: "inMotion", label: "In motion", placeholder: "e.g. Mara's hand on the cellar door" },
  { id: "lastSaid", label: "Last said" },
];

const LIST_FIELDS = [
  { id: "present", label: "Who's here" },
  { id: "withinReach", label: "Within reach" },
];

export function SceneForm({ scene, onSave, onCancel }) {
  const [draft, setDraft] = useState(() => ({
    ...scene,
    present: joinKeywords(scene.present),
    withinReach: joinKeywords(scene.withinReach),
  }));
  const changeField = (fieldId, value) => setDraft({ ...draft, [fieldId]: value });
  function save() {
    onSave({
      ...draft,
      present: splitKeywords(draft.present),
      withinReach: splitKeywords(draft.withinReach),
    });
  }
  return (
    <View aria-label="Edit scene">
      {TEXT_FIELDS.map((field) => (
        <FormField key={field.id} label={field.label}>
          <TextField
            accessibilityLabel={field.label}
            placeholder={field.placeholder}
            value={draft[field.id]}
            onChangeText={(value) => changeField(field.id, value)}
          />
        </FormField>
      ))}
      {LIST_FIELDS.map((field) => (
        <FormField key={field.id} label={field.label} hint="Separate with commas.">
          <TextField
            accessibilityLabel={field.label}
            value={draft[field.id]}
            onChangeText={(value) => changeField(field.id, value)}
          />
        </FormField>
      ))}
      <Toolbar>
        <Button label="Done" variant="primary" size="small" onPress={save} />
        <Button label="Cancel" size="small" onPress={onCancel} />
      </Toolbar>
    </View>
  );
}
