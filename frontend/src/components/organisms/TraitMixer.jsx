// The full lorebook mixer: master dials and warnings, trait groups, mood, voice tags and situational rules.
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import {
  Dial,
  ChipGroup,
  Disclosure,
  MoodLabel,
  RuleBuilder,
  RuleItem,
  Section,
  WarningNote,
} from "../molecules/index.js";
import {
  MOOD_AXES,
  MOOD_NOTE,
  GROUP_NOTES,
  MASTER_DIALS_NOTE,
  VOICE_TAGS_NOTE,
  SITUATIONAL_SHIFTS_NOTE,
} from "../../content/copy.js";

const TraitGroups = styled(View)`
  margin-bottom: 16px;
`;

function describeRule(controls, rule) {
  const axis = controls.axes.find((candidate) => candidate.id === rule.axis);
  const situation = controls.situations.find((candidate) => candidate.id === rule.situation);
  const shift = controls.shifts.find((candidate) => candidate.id === rule.amount);
  if (!axis || !situation) {
    return "";
  }
  const pole = rule.dir === "high" ? axis.high : axis.low;
  const amountWord = shift ? shift.word : rule.amount;
  return `When ${situation.text}: ${amountWord} more ${pole.toLowerCase()}`;
}

function describeBand(derived, axisId) {
  const band = derived.bands[axisId];
  return `${band.pole}. ${band.text}`;
}

function MasterDials({ controls, derived, onChange }) {
  return (
    <Section title="Master dials" note={MASTER_DIALS_NOTE}>
      {controls.metatraits.map((metatrait) => (
        <Dial
          key={metatrait.id}
          name={metatrait.name}
          lowLabel={metatrait.low}
          highLabel={metatrait.high}
          description={metatrait.note}
          value={derived.metatraits[metatrait.id] ?? 0}
          onChange={(value) => onChange({ metatraits: { [metatrait.id]: value } })}
        />
      ))}
      {derived.warnings.map((warning) => (
        <WarningNote key={warning}>{warning}</WarningNote>
      ))}
    </Section>
  );
}

function TraitGroup({ groupName, controls, personality, derived, onChange }) {
  const axesInGroup = controls.axes.filter((axis) => axis.group === groupName);
  return (
    <Disclosure title={groupName} count={axesInGroup.length} note={GROUP_NOTES[groupName]}>
      {axesInGroup.map((axis) => (
        <Dial
          key={axis.id}
          nativeID={`trait-${axis.id}`}
          name={axis.name}
          lowLabel={axis.low}
          highLabel={axis.high}
          description={describeBand(derived, axis.id)}
          value={personality.values[axis.id]}
          onChange={(value) => onChange({ values: { [axis.id]: value } })}
        />
      ))}
    </Disclosure>
  );
}

function MoodDials({ personality, derived, onChange }) {
  return (
    <Section title="Mood right now" note={MOOD_NOTE}>
      <MoodLabel mood={derived.mood} isLarge />
      {MOOD_AXES.map((moodAxis) => (
        <Dial
          key={moodAxis.id}
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

function VoiceTags({ controls, personality, onChange }) {
  return (
    <Section title="Voice tags" note={VOICE_TAGS_NOTE}>
      {controls.tags.map((group) => (
        <ChipGroup
          key={group.group}
          title={group.group}
          items={group.items}
          selectedIds={personality.tags}
          onChange={(tags) => onChange({ tags })}
        />
      ))}
    </Section>
  );
}

function SituationalRules({ controls, personality, onChange }) {
  const rules = personality.rules;
  function removeRule(positionToRemove) {
    const remainingRules = rules.filter((_rule, position) => position !== positionToRemove);
    onChange({ rules: remainingRules });
  }
  return (
    <Section title="Situational shifts" note={SITUATIONAL_SHIFTS_NOTE}>
      <RuleBuilder
        situations={controls.situations}
        axes={controls.axes}
        shifts={controls.shifts}
        onAdd={(rule) => onChange({ rules: [...rules, rule] })}
      />
      {rules.map((rule, position) => (
        <RuleItem
          key={position}
          description={describeRule(controls, rule)}
          onRemove={() => removeRule(position)}
        />
      ))}
    </Section>
  );
}

export function TraitMixer({ controls, personality, derived, onChange }) {
  const sharedProps = { controls, personality, derived, onChange };
  return (
    <View>
      <MasterDials {...sharedProps} />
      <TraitGroups>
        {controls.groups.map((groupName) => (
          <TraitGroup key={groupName} groupName={groupName} {...sharedProps} />
        ))}
      </TraitGroups>
      <MoodDials {...sharedProps} />
      <VoiceTags {...sharedProps} />
      <SituationalRules {...sharedProps} />
    </View>
  );
}
