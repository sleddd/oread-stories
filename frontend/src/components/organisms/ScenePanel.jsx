// The scene the story keeps, turn by turn: where everyone is, the time of day, who's here, what's
// within reach, what's in motion and what was last said. The AI rewrites it every turn; your own
// changes wait, marked as pending, until your next message carries them into the story.
import { useState } from "react";
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button, Eyebrow, Note } from "../atoms/index.js";
import { Section } from "../molecules/index.js";
import { PresentCastBar } from "./PresentCastBar.jsx";
import { SceneForm } from "./SceneForm.jsx";
import { EMPTY_SCENE_NOTE, PENDING_SCENE_NOTE, SCENE_NOTE } from "../../content/story.js";

const DETAIL_FIELDS = [
  { id: "location", label: "Where" },
  { id: "timeOfDay", label: "Time of day" },
  { id: "withinReach", label: "Within reach" },
  { id: "inMotion", label: "In motion" },
  { id: "lastSaid", label: "Last said" },
];

const Title = styled(Eyebrow)`
  margin-bottom: 4px;
`;

const Detail = styled(View)`
  gap: 2px;
  margin-top: 12px;
`;

const DetailValue = styled(Text)`
  display: block;
  font-family: ${({ theme }) => theme.fonts.serif};
  font-size: ${({ theme }) => theme.fontSizes.body};
  color: ${({ theme }) => theme.colors.ink};
`;

const CastArea = styled(View)`
  margin-top: 12px;
`;

const Toolbar = styled(Row)`
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  margin-top: 14px;
`;

const PendingNotice = styled(Row).attrs({ role: "status" })`
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
  margin-top: 12px;
  padding: 8px 12px;
  border-radius: ${({ theme }) => theme.radii.medium};
  border: 1px solid ${({ theme }) => theme.colors.accentBorder};
  background: ${({ theme }) => theme.colors.accentSoft};
  font-size: ${({ theme }) => theme.fontSizes.label};
  color: ${({ theme }) => theme.colors.ink};
`;

function emptyScene() {
  return { location: "", present: [], withinReach: [], timeOfDay: "", lastSaid: "", inMotion: "" };
}

function displayValue(value) {
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return value ?? "";
}

function isSceneEmpty(scene) {
  return DETAIL_FIELDS.every((field) => displayValue(scene[field.id]) === "");
}

// The turn whose AI note last rewrote the scene, or null if none has.
export function lastSceneTurnOf(turnLog) {
  const sceneTurns = (turnLog ?? []).filter((entry) => entry.isSceneReplaced);
  return sceneTurns.at(-1)?.turn ?? null;
}

function SceneDetails({ scene }) {
  const filledFields = DETAIL_FIELDS.filter((field) => displayValue(scene[field.id]) !== "");
  return filledFields.map((field) => (
    <Detail key={field.id}>
      <Eyebrow>{field.label}</Eyebrow>
      <DetailValue>{displayValue(scene[field.id])}</DetailValue>
    </Detail>
  ));
}

export function ScenePanel({
  scene,
  characters,
  presentCharacterIds,
  speakingCharacterId,
  updatedOnTurn,
  hasPendingChanges,
  isDisabled,
  onChangePresent,
  onChangeScene,
  onDiscard,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const currentScene = { ...emptyScene(), ...(scene ?? {}) };

  if (isEditing) {
    return (
      <Section aria-label="Scene">
        <Title>Right now</Title>
        <SceneForm
          scene={currentScene}
          onCancel={() => setIsEditing(false)}
          onSave={(changedScene) => {
            setIsEditing(false);
            onChangeScene(changedScene);
          }}
        />
      </Section>
    );
  }

  return (
    <Section aria-label="Scene">
      <Title>Right now</Title>
      <Note>{SCENE_NOTE}</Note>
      {isSceneEmpty(currentScene) ? (
        <Note>{EMPTY_SCENE_NOTE}</Note>
      ) : (
        <SceneDetails scene={currentScene} />
      )}
      <CastArea>
        <PresentCastBar
          characters={characters}
          presentCharacterIds={presentCharacterIds}
          speakingCharacterId={speakingCharacterId}
          isDisabled={isDisabled}
          onChange={onChangePresent}
        />
      </CastArea>
      {hasPendingChanges && (
        <PendingNotice>
          <Text>{PENDING_SCENE_NOTE}</Text>
          <Button label="Discard" size="small" onPress={onDiscard} />
        </PendingNotice>
      )}
      <Toolbar>
        <Button
          label="Edit scene"
          size="small"
          disabled={isDisabled}
          onPress={() => setIsEditing(true)}
        />
        {updatedOnTurn !== null && <Note>{`Updated on turn ${updatedOnTurn}`}</Note>}
      </Toolbar>
    </Section>
  );
}
