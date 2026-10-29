// The story engine as the chat flow uses it: play one scene, work out the personality a character
// is operating from right now, describe a character's engine for the interface, and reset a
// chat's engine state.
// A scene is appraised once by the local emotion model, then played for every AI character
// present, each with its own personality and its own engine state in the chat.
import { runScene } from "../story/runScene.js";
import { effectivePersonality } from "../story/effectivePersonality.js";
import { describeEngine } from "../story/describeEngine.js";
import { engineStateOf, setEngineState } from "../stories/chatEngines.js";
import { presentAiCharacters } from "../stories/predictSpeaker.js";

export function createStoryEngineService({
  lore,
  storyConfig,
  appraiser,
  settings,
  repository,
  storyRepository,
  characterPersonalities,
  now,
}) {
  async function isEnabled() {
    const savedSettings = await settings.load();
    return Boolean(savedSettings.engine?.enabled) && Boolean(appraiser);
  }

  function describe(basePersonality, engineState) {
    return describeEngine({ lore, storyConfig, personality: basePersonality, engineState });
  }

  // Runs the scene for one character and saves its moved personality. Returns its outcome.
  async function playSceneFor({ chat, storyId, character, appraisal }) {
    const personality = characterPersonalities.forCharacter(storyId, character.id);
    const outcome = runScene({
      lore,
      storyConfig,
      personality: await personality.get(),
      engineState: engineStateOf(chat, character.id),
      appraisal,
      timestamp: now(),
    });
    const personalityView = await personality.set(outcome.personality);
    return {
      characterId: character.id,
      name: character.name,
      personality: personalityView.personality,
      personalityView,
      engineState: outcome.engineState,
      engine: describe(personalityView.personality, outcome.engineState),
    };
  }

  // Appraises the scene's newest event and applies it to every AI character present. Throws if
  // appraisal fails; the caller decides what a failed scene means for the reply.
  // Returns [{ characterId, name, personality, personalityView, engine }].
  async function playScene({ chatId, eventText }) {
    const appraisal = await appraiser.appraise(eventText);
    const chat = await repository.findChat(chatId);
    const story = await storyRepository.findStory(chat.storyId);
    const played = [];
    for (const character of presentAiCharacters(story, chat)) {
      played.push(await playSceneFor({ chat, storyId: story.id, character, appraisal }));
    }
    await repository.updateChat(chatId, (chatToChange) => {
      for (const { characterId, engineState } of played) {
        setEngineState(chatToChange, characterId, engineState);
      }
    });
    return played.map(({ engineState, ...result }) => result);
  }

  function effectiveFor(chat, characterId, basePersonality) {
    const engineState = engineStateOf(chat, characterId);
    return effectivePersonality(lore, storyConfig, basePersonality, engineState);
  }

  // Clears every character's stress and scene ledger in the chat. Drift that already happened
  // stays in the dials.
  async function reset(chatId) {
    return repository.updateChat(chatId, (chatToChange) => {
      chatToChange.engines = {};
    });
  }

  return { isEnabled, playScene, effectiveFor, describe, reset };
}
