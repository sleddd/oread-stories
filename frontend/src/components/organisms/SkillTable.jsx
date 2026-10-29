// A character's skills. Edits stay local until saved, so typing a name doesn't send a request
// per keystroke; the story's own changes arrive when the table isn't being edited.
import { useEffect, useState } from "react";
import styled from "styled-components";
import { View, Row } from "../../ui/primitives/index.js";
import { Button, EmptyState } from "../atoms/index.js";
import { SkillRow } from "../molecules/index.js";

const Toolbar = styled(Row)`
  gap: 6px;
  margin-top: 8px;
`;

let nextDraftNumber = 0;

function newDraftSkill() {
  nextDraftNumber += 1;
  return { draftKey: `draft-${nextDraftNumber}`, name: "", level: 1, note: "" };
}

function keyOf(skill) {
  return skill.id ?? skill.draftKey;
}

function withoutDraftKeys(skills) {
  const namedSkills = skills.filter((skill) => skill.name.trim());
  return namedSkills.map(({ draftKey, ...skill }) => ({ ...skill, name: skill.name.trim() }));
}

export function SkillTable({ skills, onSave }) {
  const [draftSkills, setDraftSkills] = useState(skills);
  const [hasChanges, setHasChanges] = useState(false);
  useEffect(() => {
    if (!hasChanges) {
      setDraftSkills(skills);
    }
  }, [skills, hasChanges]);

  function changeSkills(nextSkills) {
    setDraftSkills(nextSkills);
    setHasChanges(true);
  }

  function replaceSkill(changedSkill) {
    changeSkills(
      draftSkills.map((skill) => (keyOf(skill) === keyOf(changedSkill) ? changedSkill : skill)),
    );
  }

  function removeSkill(removedSkill) {
    changeSkills(draftSkills.filter((skill) => keyOf(skill) !== keyOf(removedSkill)));
  }

  return (
    <View>
      {draftSkills.length === 0 && <EmptyState>No skills yet.</EmptyState>}
      {draftSkills.map((skill) => (
        <SkillRow
          key={keyOf(skill)}
          skill={skill}
          onChange={replaceSkill}
          onRemove={() => removeSkill(skill)}
        />
      ))}
      <Toolbar>
        <Button label="Add skill" onPress={() => changeSkills([...draftSkills, newDraftSkill()])} />
        {hasChanges && (
          <>
            <Button
              label="Save skills"
              variant="primary"
              onPress={() => {
                setHasChanges(false);
                onSave(withoutDraftKeys(draftSkills));
              }}
            />
            <Button
              label="Discard"
              onPress={() => {
                setHasChanges(false);
                setDraftSkills(skills);
              }}
            />
          </>
        )}
      </Toolbar>
    </View>
  );
}
