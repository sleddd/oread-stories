// World notes by category. Each note has a title, text, keywords that bring it into a reply,
// and a pin that sends it with every reply. Fields save when they lose focus.
import { useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import {
  Button,
  Heading3,
  Note,
  EmptyState,
  Switch,
  SelectField,
  TextField,
} from "../atoms/index.js";
import { SavedField, KeywordInput, FormField } from "../molecules/index.js";
import { WORLD_NOTE_CATEGORIES, WORLD_NOTES_NOTE } from "../../content/story.js";

const NoteCard = styled(View)`
  padding: 10px 12px;
  margin-bottom: 8px;
  border: 1px solid ${({ theme }) => theme.colors.line};
  border-radius: ${({ theme }) => theme.radii.small};
  background: ${({ theme }) => theme.colors.field};
`;

const Toolbar = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
`;

const AddRow = styled(Row)`
  gap: 6px;
  flex-wrap: wrap;
  margin-top: 10px;
`;

const TitleField = styled(TextField)`
  flex: 1 1 180px;
`;

const categoryItems = WORLD_NOTE_CATEGORIES.map((category) => ({
  value: category.id,
  label: category.label,
}));

function WorldNoteCard({ note, onSave, onDelete }) {
  return (
    <NoteCard aria-label={`World note ${note.title}`}>
      <SavedField label="Title" value={note.title} onSave={(title) => onSave({ title })} />
      <SavedField label="Text" value={note.text} isMultiline onSave={(text) => onSave({ text })} />
      <KeywordInput keywords={note.keywords} onChange={(keywords) => onSave({ keywords })} />
      <FormField label="Category">
        <SelectField
          accessibilityLabel="Category"
          selectedValue={note.category}
          items={categoryItems}
          onValueChange={(category) => onSave({ category })}
        />
      </FormField>
      <Toolbar>
        <Switch
          label="Pinned: goes with every reply"
          isOn={note.pinned}
          onChange={(pinned) => onSave({ pinned })}
        />
        <Button
          label="Delete"
          size="small"
          variant="ghost"
          accessibilityLabel={`Delete ${note.title}`}
          onPress={onDelete}
        />
      </Toolbar>
    </NoteCard>
  );
}

function AddWorldNoteForm({ onAdd }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("setting");
  function add() {
    if (title.trim()) {
      onAdd({ title: title.trim(), category });
      setTitle("");
    }
  }
  return (
    <AddRow>
      <TitleField
        accessibilityLabel="New world note title"
        placeholder="New note title"
        value={title}
        onChangeText={setTitle}
      />
      <SelectField
        accessibilityLabel="New world note category"
        selectedValue={category}
        items={categoryItems}
        onValueChange={setCategory}
      />
      <Button label="Add note" variant="primary" disabled={!title.trim()} onPress={add} />
    </AddRow>
  );
}

// handlers: { onAdd(note), onSave(noteId, changes), onDelete(note) }
export function WorldNotesEditor({ notes, handlers }) {
  const categoriesInUse = WORLD_NOTE_CATEGORIES.filter((category) => {
    return notes.some((note) => note.category === category.id);
  });
  return (
    <View>
      <Note>{WORLD_NOTES_NOTE}</Note>
      {notes.length === 0 && <EmptyState>No world notes yet.</EmptyState>}
      {categoriesInUse.map((category) => (
        <View key={category.id}>
          <Heading3>{category.label}</Heading3>
          {notes
            .filter((note) => note.category === category.id)
            .map((note) => (
              <WorldNoteCard
                key={note.id}
                note={note}
                onSave={(changes) => handlers.onSave(note.id, changes)}
                onDelete={() => handlers.onDelete(note)}
              />
            ))}
        </View>
      ))}
      <AddWorldNoteForm onAdd={handlers.onAdd} />
    </View>
  );
}
