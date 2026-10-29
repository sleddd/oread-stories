// Compact dials for steering mid-conversation: mood, the nine traits and voice tags.
import { View } from "../../ui/primitives/index.js";
import { Button, Heading3, Note } from "../atoms/index.js";
import { Dial, ChipGroup, MoodLabel } from "../molecules/index.js";
import { MOOD_AXES, MOOD_NOTE } from "../../content/copy.js";

function allTagItems(controls) {
  return controls.tags.flatMap((group) => group.items);
}

export function SteerPanel({ controls, personality, derived, onChange, onOpenLorebook }) {
  return (
    <View>
      <Heading3>Mood right now</Heading3>
      <Note>{MOOD_NOTE}</Note>
      <MoodLabel mood={derived.mood} isLarge />
      {MOOD_AXES.map((moodAxis) => (
        <Dial
          key={moodAxis.id}
          isCompact
          name={moodAxis.name}
          lowLabel={moodAxis.low}
          highLabel={moodAxis.high}
          value={personality.mood[moodAxis.id]}
          onChange={(value) => onChange({ mood: { [moodAxis.id]: value } })}
        />
      ))}

      <Heading3>Traits</Heading3>
      {controls.axes.map((axis) => (
        <Dial
          key={axis.id}
          isCompact
          name={axis.name}
          lowLabel={axis.low}
          highLabel={axis.high}
          value={personality.values[axis.id]}
          onChange={(value) => onChange({ values: { [axis.id]: value } })}
        />
      ))}

      <Heading3>Voice</Heading3>
      <ChipGroup
        items={allTagItems(controls)}
        selectedIds={personality.tags}
        onChange={(tags) => onChange({ tags })}
      />
      <Button label="Open full lorebook →" isWide onPress={onOpenLorebook} />
    </View>
  );
}
