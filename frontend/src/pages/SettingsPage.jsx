// Settings: model providers, generation limits, the conversation window, your name, and data backup.
import { useEffect, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../store/index.js";
import { SettingsTemplate, ProviderGrid, FieldGrid } from "../components/templates/index.js";
import { ProviderCard } from "../components/organisms/index.js";
import { AccentPicker, FormField, Section, WarningNote } from "../components/molecules/index.js";
import { Button, Note, Switch, TextField } from "../components/atoms/index.js";
import { PROVIDERS, providerName } from "../content/providers.js";
import { STORY_ENGINE_NOTE, ACCENT_NOTE } from "../content/copy.js";
import { MAX_TOKENS_WARNING } from "../content/story.js";
import { ACCENT_PRESETS } from "../theme/index.js";
import { Row } from "../ui/primitives/index.js";

const MODEL_DOWNLOAD_NOTE =
  "The emotion model (about 125 MB) downloads once, the first time the backend starts, and then " +
  "runs offline. No AI provider is called to read scenes.";

const DEFAULT_MAX_TOKENS = 2048;
// Below this, a story turn's hidden notes (updates, world, memory) can be cut off.
const STORY_TURN_MIN_TOKENS = 2048;
const DEFAULT_HISTORY_WINDOW = 24;
const MIN_HISTORY_WINDOW = 2;

// A text field that saves when it loses focus, and only if the value changed.
function SavedField({ label, hint, value, placeholder, keyboardType, onSave }) {
  const [typedValue, setTypedValue] = useState(String(value ?? ""));
  useEffect(() => {
    setTypedValue(String(value ?? ""));
  }, [value]);
  return (
    <FormField label={label} hint={hint}>
      <TextField
        accessibilityLabel={label}
        value={typedValue}
        placeholder={placeholder}
        keyboardType={keyboardType}
        onChangeText={setTypedValue}
        onBlur={() => {
          if (typedValue !== String(value ?? "")) {
            onSave(typedValue);
          }
        }}
      />
    </FormField>
  );
}

function wholeNumberOr(text, fallback) {
  const number = Number.parseInt(text, 10);
  if (Number.isNaN(number)) {
    return fallback;
  }
  return number;
}

function ProviderSettings({ settings, actions }) {
  async function useProvider(providerId) {
    const saved = await actions.patchSettings({ provider: providerId }, { announce: false });
    if (saved) {
      actions.showToast(`Using ${providerName(providerId)}`);
    }
  }

  function reportFetchedModels({ count, error }) {
    if (error) {
      actions.showToast(error.message, "error");
      return;
    }
    const modelWord = count === 1 ? "model" : "models";
    actions.showToast(`${count} ${modelWord} available. Click the model field to choose.`);
  }

  return (
    <ProviderGrid>
      {PROVIDERS.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          settings={settings}
          onUse={useProvider}
          onSaveField={(providerId, fieldKey, value) =>
            actions.patchSettings({ [providerId]: { [fieldKey]: value } })
          }
          onFetchModels={actions.listModels}
          onFetched={reportFetchedModels}
          onTest={actions.testProvider}
        />
      ))}
    </ProviderGrid>
  );
}

function AppearanceSettings() {
  const { accentId, chooseAccent } = useAppStore(
    useShallow((state) => ({ accentId: state.accentId, chooseAccent: state.chooseAccent })),
  );
  return (
    <Section title="Appearance" note={ACCENT_NOTE}>
      <AccentPicker
        presets={ACCENT_PRESETS}
        selectedId={accentId}
        onSelect={chooseAccent}
        accessibilityLabel="Accent colour"
      />
    </Section>
  );
}

export function SettingsPage() {
  const settings = useAppStore((state) => state.settings);
  const actions = useAppStore(
    useShallow((state) => ({
      patchSettings: state.patchSettings,
      listModels: state.listModels,
      testProvider: state.testProvider,
      exportData: state.exportData,
      importData: state.importData,
      showToast: state.showToast,
    })),
  );

  return (
    <SettingsTemplate
      title="Settings"
      introduction="Connect a model provider. Keys are stored by the Oread backend on this machine and never sent to the browser."
    >
      <ProviderSettings settings={settings} actions={actions} />

      <AppearanceSettings />

      <Section title="Generation">
        <FieldGrid>
          <SavedField
            label="Max reply tokens"
            hint="Upper limit per reply."
            keyboardType="numeric"
            value={settings.generation.maxTokens}
            onSave={(text) =>
              actions.patchSettings({
                generation: { maxTokens: wholeNumberOr(text, DEFAULT_MAX_TOKENS) },
              })
            }
          />
          <SavedField
            label="Temperature"
            hint="Blank uses the provider default. Some reasoning models reject a custom temperature."
            placeholder="provider default"
            value={settings.generation.temperature}
            onSave={(text) => actions.patchSettings({ generation: { temperature: text.trim() } })}
          />
        </FieldGrid>
        {Number(settings.generation.maxTokens) < STORY_TURN_MIN_TOKENS && (
          <WarningNote>{MAX_TOKENS_WARNING}</WarningNote>
        )}
      </Section>

      <Section title="Conversation">
        <FieldGrid>
          <SavedField
            label="Context window (messages)"
            hint="How many recent messages are sent with the lorebook prompt."
            keyboardType="numeric"
            value={settings.memory.historyWindow}
            onSave={(text) => {
              const historyWindow = Math.max(
                MIN_HISTORY_WINDOW,
                wholeNumberOr(text, DEFAULT_HISTORY_WINDOW),
              );
              actions.patchSettings({ memory: { historyWindow } });
            }}
          />
        </FieldGrid>
      </Section>

      <Section title="Story engine" note={STORY_ENGINE_NOTE}>
        <Switch
          label="Adjust the character as the story unfolds"
          isOn={Boolean(settings.engine?.enabled)}
          onChange={(enabled) => actions.patchSettings({ engine: { enabled } })}
        />
        <Note>{MODEL_DOWNLOAD_NOTE}</Note>
      </Section>

      <Section title="You">
        <SavedField
          label="Your name"
          hint="Shown on your messages. It isn't sent to the model."
          value={settings.user.name}
          onSave={(text) => actions.patchSettings({ user: { name: text.trim() || "You" } })}
        />
      </Section>

      <Section
        title="Data"
        note="The personality and chats are saved by the backend. Export makes a single file you can back up or move to another machine. API keys are never included."
      >
        <Row style={{ gap: 6 }}>
          <Button label="Export everything" onPress={actions.exportData} />
          <Button label="Import…" onPress={actions.importData} />
        </Row>
      </Section>
    </SettingsTemplate>
  );
}
