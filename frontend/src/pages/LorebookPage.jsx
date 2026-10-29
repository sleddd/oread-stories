// Lorebook: the personality mixer and the prompt it produces. The lorebook text itself lives in the backend.
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { LorebookTemplate } from "../components/templates/index.js";
import { TraitMixer, OutputPanel } from "../components/organisms/index.js";
import { Button, SelectField, TextField } from "../components/atoms/index.js";
import { LOREBOOK_INTRO, LOREBOOK_FOOTER } from "../content/copy.js";

function Toolbar({ controls, characterName, actions }) {
  const presetItems = controls.presets.map((preset) => ({ value: preset.id, label: preset.name }));
  return (
    <>
      <TextField
        accessibilityLabel="Character name"
        placeholder="Character name"
        value={characterName}
        onChangeText={(name) => actions.changePersonality({ name })}
      />
      <Button label="Randomize" variant="primary" onPress={actions.randomizePersonality} />
      <SelectField
        accessibilityLabel="Load a preset"
        placeholder="Load a preset…"
        selectedValue=""
        items={presetItems}
        onValueChange={(presetId) => {
          if (presetId) {
            actions.applyPreset(presetId);
          }
        }}
      />
      <Button label="Reset to center" onPress={actions.resetPersonality} />
      <Button label="Back to the story →" variant="primary" onPress={() => actions.navigate("chat")} />
    </>
  );
}

export function LorebookPage() {
  const { controls, personality, derived } = useAppStore(
    useShallow((state) => ({
      controls: state.controls,
      personality: state.personality,
      derived: state.derived,
    })),
  );
  const actions = useAppStore(
    useShallow((state) => ({
      navigate: state.navigate,
      changePersonality: state.changePersonality,
      randomizePersonality: state.randomizePersonality,
      resetPersonality: state.resetPersonality,
      applyPreset: state.applyPreset,
      copyText: state.copyText,
    })),
  );

  return (
    <LorebookTemplate
      title="Personality Lorebook"
      introduction={LOREBOOK_INTRO}
      footer={LOREBOOK_FOOTER}
      toolbar={<Toolbar controls={controls} characterName={personality.name} actions={actions} />}
      controls={
        <TraitMixer
          controls={controls}
          personality={personality}
          derived={derived}
          onChange={actions.changePersonality}
        />
      }
      output={<OutputPanel prompt={derived.prompt} steering={derived.steering} onCopy={actions.copyText} />}
    />
  );
}
