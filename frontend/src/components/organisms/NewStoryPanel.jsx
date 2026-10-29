// Starting a new story: blank, with just a title, or from one of the pre-built stories, which
// come with a cast, a setting, rules and an opening scene.
import { useState } from "react";
import styled from "styled-components";
import { View, Row, Text } from "../../ui/primitives/index.js";
import { Button, TextField, SelectField } from "../atoms/index.js";
import { FormField } from "../molecules/index.js";
import { BLANK_STORY_LABEL } from "../../content/story.js";
import { describeTemplateOption, describeCastNames } from "../../lib/describeStory.js";

const BLANK_STORY_VALUE = "blank";

const Column = styled(View)`
  gap: 8px;
`;

const TitleRow = styled(Row)`
  gap: 6px;
`;

const TitleField = styled(TextField)`
  flex: 1;
`;

const Description = styled(Text)`
  display: block;
  color: ${({ theme }) => theme.colors.muted};
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

const CastLine = styled(Text)`
  display: block;
  font-size: ${({ theme }) => theme.fontSizes.small};
`;

function BlankStoryForm({ onCreate }) {
  const [title, setTitle] = useState("");
  function create() {
    if (title.trim()) {
      onCreate(title);
      setTitle("");
    }
  }
  return (
    <FormField label="Title">
      <TitleRow>
        <TitleField
          accessibilityLabel="New story title"
          placeholder="New story title"
          value={title}
          onChangeText={setTitle}
          onKeyPress={(keyEvent) => {
            if (keyEvent.key === "Enter") {
              create();
            }
          }}
        />
        <Button label="Create" disabled={!title.trim()} onPress={create} />
      </TitleRow>
    </FormField>
  );
}

function TemplatePreview({ template, onCreate }) {
  return (
    <Column>
      <Description>{template.description}</Description>
      <CastLine>{describeCastNames(template.characterNames)}</CastLine>
      <Button
        label={`Create “${template.title}”`}
        variant="primary"
        onPress={() => onCreate(template.id)}
      />
    </Column>
  );
}

export function NewStoryPanel({ templates = [], onCreateBlank, onCreateFromTemplate }) {
  const [choice, setChoice] = useState(BLANK_STORY_VALUE);
  const items = [
    { value: BLANK_STORY_VALUE, label: BLANK_STORY_LABEL },
    ...templates.map((template) => ({
      value: template.id,
      label: describeTemplateOption(template),
    })),
  ];
  const chosenTemplate = templates.find((template) => template.id === choice);
  return (
    <Column>
      <FormField label="Start from">
        <SelectField
          accessibilityLabel="Start from"
          selectedValue={choice}
          items={items}
          onValueChange={(value) => setChoice(value || BLANK_STORY_VALUE)}
        />
      </FormField>
      {chosenTemplate ? (
        <TemplatePreview
          template={chosenTemplate}
          onCreate={(templateId) => {
            onCreateFromTemplate(templateId);
            setChoice(BLANK_STORY_VALUE);
          }}
        />
      ) : (
        <BlankStoryForm onCreate={onCreateBlank} />
      )}
    </Column>
  );
}
