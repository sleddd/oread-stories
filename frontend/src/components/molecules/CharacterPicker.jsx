// Chooses which character the panel below shows or moves.
import { SelectField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

export function CharacterPicker({
  characters,
  selectedCharacterId,
  onSelect,
  label = "Character",
}) {
  const items = characters.map((character) => ({ value: character.id, label: character.name }));
  return (
    <FormField label={label}>
      <SelectField
        accessibilityLabel={label}
        selectedValue={selectedCharacterId ?? ""}
        items={items}
        onValueChange={(characterId) => {
          if (characterId) {
            onSelect(characterId);
          }
        }}
      />
    </FormField>
  );
}
