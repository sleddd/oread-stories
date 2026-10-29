// Stories: the story list and cast on the side; the open story's overview, the selected
// character (personality, backstory, abilities and skills, memory) and the world.
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import {
  StoriesTemplate,
  PersonalityTemplate,
  StoryEditorTemplate,
} from "../components/templates/index.js";
import {
  StoryChooser,
  StoryOverviewForm,
  CastList,
  CharacterEditor,
  AbilityChart,
  SkillTable,
  MemoryEditor,
  WorldNotesEditor,
  WorldStateEditor,
  TraitMixer,
  OutputPanel,
} from "../components/organisms/index.js";
import { Section, SavedField, Tabs } from "../components/molecules/index.js";
import {
  Button,
  Heading2,
  Heading3,
  SelectField,
  TextField,
  EmptyState,
} from "../components/atoms/index.js";
import { View } from "../ui/primitives/index.js";
import { LOREBOOK_FOOTER } from "../content/copy.js";
import { STORIES_INTRO } from "../content/story.js";
import { describeMemorySource } from "../lib/describeStory.js";

const STORY_TABS = [
  { id: "overview", label: "Overview" },
  { id: "cast", label: "Cast" },
  { id: "world", label: "World" },
];

function useStoriesPageState() {
  return useAppStore(
    useShallow((state) => ({
      stories: state.stories,
      storyTemplates: state.storyTemplates,
      activeStoryId: state.activeStoryId,
      activeStory: state.activeStory,
      selectedCharacterId: state.selectedCharacterId,
      memoryEntries: state.memoryEntries,
      memorySearch: state.memorySearch,
      storyEditorTabId: state.storyEditorTabId,
      characterSectionId: state.characterSectionId,
      controls: state.controls,
      personality: state.personality,
      derived: state.derived,
      chats: state.chats,
    })),
  );
}

function useStoriesPageActions() {
  return useAppStore(
    useShallow((state) => ({
      openStory: state.openStory,
      createStory: state.createStory,
      createStoryFromTemplate: state.createStoryFromTemplate,
      deleteStory: state.deleteStory,
      saveStoryOverview: state.saveStoryOverview,
      addCharacter: state.addCharacter,
      saveCharacter: state.saveCharacter,
      deleteCharacter: state.deleteCharacter,
      selectCharacter: state.selectCharacter,
      showStoryEditorTab: state.showStoryEditorTab,
      showCharacterSection: state.showCharacterSection,
      addMemoryEntry: state.addMemoryEntry,
      saveMemoryEntry: state.saveMemoryEntry,
      deleteMemoryEntry: state.deleteMemoryEntry,
      searchMemory: state.searchMemory,
      clearMemorySearch: state.clearMemorySearch,
      addWorldNote: state.addWorldNote,
      saveWorldNote: state.saveWorldNote,
      deleteWorldNote: state.deleteWorldNote,
      setWorldFact: state.setWorldFact,
      saveWorldFact: state.saveWorldFact,
      deleteWorldFact: state.deleteWorldFact,
      changePersonality: state.changePersonality,
      randomizePersonality: state.randomizePersonality,
      resetPersonality: state.resetPersonality,
      applyPreset: state.applyPreset,
      copyText: state.copyText,
    })),
  );
}

function PresetPicker({ presets, onApply }) {
  const presetItems = presets.map((preset) => ({ value: preset.id, label: preset.name }));
  return (
    <SelectField
      accessibilityLabel="Load a preset"
      placeholder="Load a preset…"
      selectedValue=""
      items={presetItems}
      onValueChange={(presetId) => {
        if (presetId) {
          onApply(presetId);
        }
      }}
    />
  );
}

function PersonalityToolbar({ controls, characterName, actions }) {
  return (
    <>
      <TextField
        accessibilityLabel="Character name"
        placeholder="Character name"
        value={characterName}
        onChangeText={(name) => actions.changePersonality({ name })}
      />
      <PresetPicker presets={controls.presets} onApply={actions.applyPreset} />
    </>
  );
}

function PersonalityActions({ actions }) {
  return (
    <>
      <Button label="Reset to center" onPress={actions.resetPersonality} />
      <Button label="Randomize" icon="⤨" variant="primary" onPress={actions.randomizePersonality} />
    </>
  );
}

function PersonalitySection({ state, actions }) {
  if (!state.personality || !state.derived) {
    return <EmptyState>Loading…</EmptyState>;
  }
  return (
    <PersonalityTemplate
      toolbar={
        <PersonalityToolbar
          controls={state.controls}
          characterName={state.personality.name}
          actions={actions}
        />
      }
      toolbarActions={<PersonalityActions actions={actions} />}
      controls={
        <TraitMixer
          controls={state.controls}
          personality={state.personality}
          derived={state.derived}
          onChange={actions.changePersonality}
        />
      }
      output={
        <OutputPanel
          prompt={state.derived.prompt}
          steering={state.derived.steering}
          onCopy={actions.copyText}
        />
      }
      footer={LOREBOOK_FOOTER}
    />
  );
}

function BackstorySection({ character, onSave }) {
  return (
    <View>
      <SavedField
        label="Summary"
        hint="One or two lines. Everyone's summary goes with every reply."
        value={character.summary}
        isMultiline
        rows={2}
        onSave={(summary) => onSave({ summary })}
      />
      <SavedField
        label="Backstory"
        hint="Sent only when this character is the one speaking."
        value={character.backstory}
        isMultiline
        rows={8}
        onSave={(backstory) => onSave({ backstory })}
      />
    </View>
  );
}

function AbilitiesSection({ character, onSave }) {
  return (
    <View>
      <Heading3>Abilities</Heading3>
      <AbilityChart
        abilities={character.abilities}
        onChange={(changedAbility) => onSave({ abilities: changedAbility })}
      />
      <Heading3>Skills</Heading3>
      <SkillTable skills={character.skills} onSave={(skills) => onSave({ skills })} />
    </View>
  );
}

function createSourceLabeler(story, chats) {
  const lookups = {
    characterNameFor(characterId) {
      const character = story.characters.find((candidate) => candidate.id === characterId);
      return character?.name ?? "someone";
    },
    chatTitleFor(chatId) {
      const chat = chats.find((candidate) => candidate.id === chatId);
      return chat?.title ?? "A chat";
    },
  };
  return (source) => describeMemorySource(source, lookups);
}

function CastTab({ state, actions }) {
  const story = state.activeStory;
  const character = story.characters.find((candidate) => {
    return candidate.id === state.selectedCharacterId;
  });
  if (!character) {
    return <EmptyState>Add a character to the cast to begin.</EmptyState>;
  }
  const hasOtherPlayer = story.characters.some((candidate) => {
    return candidate.role === "player" && candidate.id !== character.id;
  });
  const sections = {
    personality: <PersonalitySection state={state} actions={actions} />,
    backstory: <BackstorySection character={character} onSave={actions.saveCharacter} />,
    abilities: <AbilitiesSection character={character} onSave={actions.saveCharacter} />,
    memory: (
      <MemoryEditor
        characterName={character.name}
        entries={state.memoryEntries}
        search={state.memorySearch}
        sourceLabelFor={createSourceLabeler(story, state.chats)}
        handlers={{
          onAdd: actions.addMemoryEntry,
          onSave: actions.saveMemoryEntry,
          onDelete: actions.deleteMemoryEntry,
          onSearch: actions.searchMemory,
          onClearSearch: actions.clearMemorySearch,
        }}
      />
    ),
  };
  return (
    <CharacterEditor
      character={character}
      storyTitle={story.title}
      canBePlayer={!hasOtherPlayer}
      selectedSectionId={state.characterSectionId}
      sections={sections}
      onSelectSection={actions.showCharacterSection}
      onChangeRole={(role) => actions.saveCharacter({ role })}
      onDelete={() => actions.deleteCharacter(character)}
    />
  );
}

function WorldTab({ story, actions }) {
  return (
    <View>
      <Section title="World notes">
        <WorldNotesEditor
          notes={story.worldNotes}
          handlers={{
            onAdd: actions.addWorldNote,
            onSave: actions.saveWorldNote,
            onDelete: actions.deleteWorldNote,
          }}
        />
      </Section>
      <Section title="World state">
        <WorldStateEditor
          facts={story.worldState}
          handlers={{
            onAdd: actions.setWorldFact,
            onSave: actions.saveWorldFact,
            onDelete: actions.deleteWorldFact,
          }}
        />
      </Section>
    </View>
  );
}

function StoryEditor({ state, actions }) {
  const story = state.activeStory;
  const tabContent = {
    overview: (
      <Section>
        <StoryOverviewForm story={story} onSave={actions.saveStoryOverview} />
      </Section>
    ),
    cast: <CastTab state={state} actions={actions} />,
    world: <WorldTab story={story} actions={actions} />,
  };
  return (
    <StoryEditorTemplate
      title={<Heading2>{story.title}</Heading2>}
      tabs={
        <Tabs
          tabs={STORY_TABS}
          selectedId={state.storyEditorTabId}
          onSelect={actions.showStoryEditorTab}
          accessibilityLabel="Story sections"
        />
      }
      body={tabContent[state.storyEditorTabId]}
    />
  );
}

function SideColumn({ state, actions }) {
  const cast = state.activeStory && (
    <CastList
      characters={state.activeStory.characters}
      selectedCharacterId={state.selectedCharacterId}
      onSelect={(characterId) => {
        actions.selectCharacter(characterId);
        actions.showStoryEditorTab("cast");
      }}
      onAdd={actions.addCharacter}
    />
  );
  return (
    <StoryChooser
      stories={state.stories}
      activeStoryId={state.activeStoryId}
      templates={state.storyTemplates}
      cast={cast}
      onOpen={actions.openStory}
      onDelete={actions.deleteStory}
      onCreateBlank={actions.createStory}
      onCreateFromTemplate={actions.createStoryFromTemplate}
    />
  );
}

export function StoriesPage() {
  const state = useStoriesPageState();
  const actions = useStoriesPageActions();
  return (
    <StoriesTemplate
      title="Stories"
      introduction={STORIES_INTRO}
      side={<SideColumn state={state} actions={actions} />}
      main={
        state.activeStory ? (
          <StoryEditor state={state} actions={actions} />
        ) : (
          <EmptyState>Open or create a story.</EmptyState>
        )
      }
    />
  );
}
