// Steering mid-conversation: a card with the mood right now and its three dials, the baseline
// mood trait with the other traits folded under it, and voice tags.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Eyebrow, Note } from "../atoms/index.js";
import { Dial, ChipGroup, Disclosure, MoodLabel, Section } from "../molecules/index.js";
import { MOOD_AXES, MOOD_NOTE } from "../../content/copy.js";
import { describeTraitCount } from "../../lib/format.js";

// The trait shown above the fold: baseline mood moves the whole tone of a reply.
const HEADLINE_TRAIT_ID = "valence";

const Label = styled(Eyebrow)`
  margin: 6px 0 4px;
`;

const MoodTitle = styled(Eyebrow)`
  margin-bottom: 4px;
`;

const Spacer = styled(View)`
  height: 12px;
`;

function allTagItems(controls) {
  return controls.tags.flatMap((group) => group.items);
}

function TraitDial({ axis, personality, onChange }) {
  return (
    <Dial
      isCompact
      name={axis.name}
      lowLabel={axis.low}
      highLabel={axis.high}
      value={personality.values[axis.id]}
      onChange={(value) => onChange({ values: { [axis.id]: value } })}
    />
  );
}

function MoodCard({ personality, derived, onChange }) {
  return (
    <Section>
      <MoodTitle>Mood right now</MoodTitle>
      <MoodLabel mood={derived.mood} isLarge />
      <Note>{MOOD_NOTE}</Note>
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
    </Section>
  );
}

export function SteerPanel({ controls, personality, derived, onChange, onEditCharacter }) {
  const headlineAxis = controls.axes.find((axis) => axis.id === HEADLINE_TRAIT_ID);
  const otherAxes = controls.axes.filter((axis) => axis.id !== HEADLINE_TRAIT_ID);
  return (
    <View>
      <MoodCard personality={personality} derived={derived} onChange={onChange} />
      <Label>Traits</Label>
      {headlineAxis && (
        <TraitDial axis={headlineAxis} personality={personality} onChange={onChange} />
      )}
      <Spacer />
      <Disclosure title={describeTraitCount(controls.axes.length)}>
        {otherAxes.map((axis) => (
          <TraitDial key={axis.id} axis={axis} personality={personality} onChange={onChange} />
        ))}
      </Disclosure>
      <Label>Voice</Label>
      <ChipGroup
        items={allTagItems(controls)}
        selectedIds={personality.tags}
        onChange={(tags) => onChange({ tags })}
      />
      <Spacer />
      <Button label="Edit the full personality →" isWide onPress={onEditCharacter} />
    </View>
  );
}
