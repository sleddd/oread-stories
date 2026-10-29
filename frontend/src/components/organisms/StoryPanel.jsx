// The story engine at a glance: whether it's on, stress, how far the scene has moved Stability
// and Plasticity, how the last scene was read, patterns forming, trait drift and recent scenes.
import styled from "styled-components";
import { View, Text } from "../../ui/primitives/index.js";
import { Button, Heading3, Note, Switch, EmptyState } from "../atoms/index.js";
import { MeterRow } from "../molecules/index.js";
import { formatDialValue } from "../../lib/format.js";
import { STORY_ENGINE_NOTE } from "../../content/copy.js";

const DIAL_MAXIMUM = 2;
// Drift moves in hundredths, so it needs more precision than a dial.
const DRIFT_DECIMAL_PLACES = 2;

const ListItem = styled(Text)`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.label};
  padding: 3px 0;
  border-top: 1px solid ${({ theme }) => theme.colors.line};
`;

const SocialMeaning = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: 18px;
  color: ${({ theme }) => theme.colors.accent};
  font-style: italic;
`;

const directionArrow = (direction) => (direction > 0 ? "↑" : "↓");

function describePattern(pattern) {
  const effects = pattern.effects.map(
    (effect) => `${effect.name} ${directionArrow(effect.direction)}`,
  );
  return `${pattern.kind} ×${pattern.repeats} → ${effects.join(", ")}`;
}

function describeScene(scene) {
  return `Scene ${scene.scene} · ${scene.social} · threat ${scene.threat} · safety ${scene.safety}`;
}

function MasterDialRow({ label, masterDial }) {
  const displayValue = `${formatDialValue(masterDial.base)} → ${formatDialValue(masterDial.effective)}`;
  return (
    <MeterRow
      label={label}
      value={masterDial.effective}
      displayValue={displayValue}
      maximum={DIAL_MAXIMUM}
      isSigned
    />
  );
}

function LastScene({ appraisal }) {
  if (!appraisal) {
    return <Note>No scenes yet. The engine reads each message you send.</Note>;
  }
  const emotions = (appraisal.emotions ?? []).map((emotion) => emotion.label).join(", ");
  return (
    <View>
      <SocialMeaning>{appraisal.social}</SocialMeaning>
      {emotions && <Note>{`Emotions read: ${emotions}`}</Note>}
      <MeterRow label="Goal impact" value={appraisal.goal_impact} isSigned />
      <MeterRow label="Novelty" value={appraisal.novelty} />
      <MeterRow label="Control" value={appraisal.control} isSigned />
      <MeterRow label="Threat" value={appraisal.threat} tone="danger" />
      <MeterRow label="Safety" value={appraisal.safety} tone="positive" />
    </View>
  );
}

function EngineDetails({ engine, onReset }) {
  return (
    <View>
      <Heading3>{`Scene ${engine.scene}`}</Heading3>
      <MeterRow label="Stress" value={engine.stress} maximum={engine.stressMaximum} tone="danger" />
      <MasterDialRow label="Stability (base → now)" masterDial={engine.masterDials.stability} />
      <MasterDialRow label="Plasticity (base → now)" masterDial={engine.masterDials.plasticity} />

      <Heading3>Last scene</Heading3>
      <LastScene appraisal={engine.lastAppraisal} />

      <Heading3>Patterns forming</Heading3>
      {engine.patterns.length === 0 && <EmptyState>None yet.</EmptyState>}
      {engine.patterns.map((pattern) => (
        <ListItem key={pattern.kind}>{describePattern(pattern)}</ListItem>
      ))}

      <Heading3>Trait drift so far</Heading3>
      {engine.drift.length === 0 && <EmptyState>No lasting change yet.</EmptyState>}
      {engine.drift.map((entry) => (
        <ListItem key={entry.axis}>
          {`${entry.name} ${formatDialValue(entry.total, DRIFT_DECIMAL_PLACES)}`}
        </ListItem>
      ))}

      <Heading3>Recent scenes</Heading3>
      {engine.recentScenes.map((scene) => (
        <ListItem key={scene.scene}>{describeScene(scene)}</ListItem>
      ))}
      <Button label="Reset story state" onPress={onReset} />
    </View>
  );
}

export function StoryPanel({ engine, isEnabled, onToggleEnabled, onReset }) {
  return (
    <View>
      <Heading3>Story engine</Heading3>
      <Note>{STORY_ENGINE_NOTE}</Note>
      <Switch
        label="Adjust the character as the story unfolds"
        isOn={isEnabled}
        onChange={onToggleEnabled}
      />
      {!engine && <EmptyState>No chat open.</EmptyState>}
      {engine && <EngineDetails engine={engine} onReset={onReset} />}
    </View>
  );
}
