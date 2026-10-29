// The story dropdown: chooses which story is open, on the Stories page and in the chat sidebar.
import { SelectField } from "../atoms/index.js";
import { FormField } from "./FormField.jsx";

export function StoryPicker({ stories, activeStoryId, onSelect, label = "Story" }) {
  const items = stories.map((story) => ({ value: story.id, label: story.title }));
  return (
    <FormField label={label}>
      <SelectField
        accessibilityLabel={label}
        selectedValue={activeStoryId ?? ""}
        items={items}
        onValueChange={(storyId) => {
          if (storyId && storyId !== activeStoryId) {
            onSelect(storyId);
          }
        }}
      />
    </FormField>
  );
}
