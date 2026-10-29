// The Stories page's side column: a card with the story dropdown and the cast, a card for
// starting a new story, and deleting the open story (never My story).
import styled from "styled-components";
import { View } from "../../ui/primitives/index.js";
import { Button, Eyebrow } from "../atoms/index.js";
import { Section, StoryPicker } from "../molecules/index.js";
import { NewStoryPanel } from "./NewStoryPanel.jsx";

const DEFAULT_STORY_ID = "my-story";

const CastHeading = styled(Eyebrow)`
  margin: 14px 0 6px;
`;

const DeleteRow = styled(View)`
  align-items: flex-start;
`;

export function StoryChooser({
  stories,
  activeStoryId,
  templates,
  cast,
  onOpen,
  onDelete,
  onCreateBlank,
  onCreateFromTemplate,
}) {
  const activeStory = stories.find((story) => story.id === activeStoryId);
  const canDelete = Boolean(activeStory) && activeStory.id !== DEFAULT_STORY_ID;
  return (
    <View>
      <Section>
        <StoryPicker stories={stories} activeStoryId={activeStoryId} onSelect={onOpen} />
        {cast && (
          <>
            <CastHeading>Cast</CastHeading>
            {cast}
          </>
        )}
      </Section>
      <Section title="New story">
        <NewStoryPanel
          templates={templates}
          onCreateBlank={onCreateBlank}
          onCreateFromTemplate={onCreateFromTemplate}
        />
      </Section>
      {canDelete && (
        <DeleteRow>
          <Button
            label="Delete this story"
            variant="danger"
            size="small"
            accessibilityLabel={`Delete ${activeStory.title}`}
            onPress={() => onDelete(activeStory)}
          />
        </DeleteRow>
      )}
    </View>
  );
}
