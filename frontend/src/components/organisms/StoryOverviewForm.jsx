// A story's overview: title, theme, plot, conflict, point of view, how replies are written,
// the story's rules and its opening scene. Text fields save when they lose focus; the reply
// style saves when it's chosen.
import { View } from "../../ui/primitives/index.js";
import { SelectField } from "../atoms/index.js";
import { FormField, SavedField } from "../molecules/index.js";

const OVERVIEW_FIELDS = [
  { id: "theme", label: "Theme", hint: "What the story is about underneath." },
  { id: "plot", label: "Plot", hint: "Where the story is heading." },
  { id: "conflict", label: "Conflict", hint: "What stands in the way." },
  { id: "pointOfView", label: "Point of view", hint: "Whose eyes the story is told through." },
];
const REPLY_STYLE_OPTIONS = [
  { value: "conversation", label: "Conversation: short, spoken replies" },
  { value: "narration", label: "Narration: story prose, a few paragraphs" },
];
const REPLY_STYLE_HINT =
  "Conversation reads like talking with someone in the room. Narration tells the scene as a story.";
const RULES_ROWS = 6;
const OPENING_SCENE_ROWS = 6;

// Rules are edited one per line.
function rulesFromText(text) {
  const lines = text.split("\n");
  const trimmedLines = lines.map((line) => line.trim());
  return trimmedLines.filter(Boolean);
}

export function StoryOverviewForm({ story, onSave }) {
  return (
    <View>
      <SavedField
        label="Title"
        value={story.title}
        onSave={(title) => {
          if (title.trim()) {
            onSave({ title });
          }
        }}
      />
      {OVERVIEW_FIELDS.map((field) => (
        <SavedField
          key={field.id}
          label={field.label}
          hint={field.hint}
          value={story[field.id]}
          isMultiline
          onSave={(value) => onSave({ [field.id]: value })}
        />
      ))}
      <FormField label="Reply style" hint={REPLY_STYLE_HINT}>
        <SelectField
          accessibilityLabel="Reply style"
          selectedValue={story.replyStyle ?? "conversation"}
          items={REPLY_STYLE_OPTIONS}
          onValueChange={(replyStyle) => onSave({ replyStyle })}
        />
      </FormField>
      <SavedField
        label="Rules"
        hint="One per line. Every reply follows them."
        value={(story.rules ?? []).join("\n")}
        isMultiline
        rows={RULES_ROWS}
        onSave={(text) => onSave({ rules: rulesFromText(text) })}
      />
      <SavedField
        label="Opening scene"
        hint="Starts every new chat in this story, as narration."
        value={story.openingScene ?? ""}
        isMultiline
        rows={OPENING_SCENE_ROWS}
        onSave={(openingScene) => onSave({ openingScene })}
      />
    </View>
  );
}
