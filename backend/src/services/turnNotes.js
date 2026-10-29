// Acts on a reply's three hidden notes once it has been written: skill and ability changes,
// each AI character's memories, and the world (the scene snapshot and world state). Everything
// applied is written to the chat's turn log with its before and after values, so the interface
// can show what changed and a regenerated reply can undo the old version's notes before the new
// ones are applied. Nothing here can fail the turn: bad notes are skipped.
import { readHiddenNotes } from "../stream/hiddenNotes.js";
import { isLengthLimitStop, LENGTH_LIMIT_STOP } from "../stream/stopReasons.js";
import { parseUpdatesNote } from "../story/updatesNoteParser.js";
import { applyStoryUpdates, revertStoryUpdates } from "../story/applyStoryUpdates.js";
import { parseMemoryNote } from "../memory/memoryNoteParser.js";
import { applyMemoryOperations, revertMemoryChanges } from "../memory/applyMemoryOperations.js";
import { parseWorldNote } from "../world/worldNoteParser.js";
import { applySceneSnapshot } from "../world/applySceneSnapshot.js";
import {
  applyWorldStateOperations,
  revertWorldStateChanges,
} from "../world/applyWorldStateOperations.js";
import { playerCharacterOf } from "../prompt/systemPrefix.js";
import { describeStory } from "./storyView.js";

// The turn log keeps one entry per reply; the oldest drop off past this many.
const MAX_TURN_LOG_ENTRIES = 500;

function findLogEntry(chat, messageId) {
  return (chat.turnLog ?? []).find((entry) => entry.messageId === messageId) ?? null;
}

function replaceLogEntry(chat, logEntry) {
  const otherEntries = (chat.turnLog ?? []).filter((entry) => {
    return entry.messageId !== logEntry.messageId;
  });
  chat.turnLog = [...otherEntries, logEntry].slice(-MAX_TURN_LOG_ENTRIES);
}

function revertPreviousNotes(story, previousEntry) {
  if (!previousEntry) {
    return [];
  }
  revertWorldStateChanges(story, previousEntry.worldState);
  const removedEntryIds = revertMemoryChanges(story, previousEntry.memory);
  revertStoryUpdates(story, previousEntry.updates);
  return removedEntryIds;
}

// Who the updates note may touch: the AI characters present and the player's character.
function charactersInScene(story, presentCharacterIds) {
  const player = playerCharacterOf(story);
  if (!player) {
    return presentCharacterIds;
  }
  return [...presentCharacterIds, player.id];
}

function nameOf(story, characterId) {
  return story.characters.find((character) => character.id === characterId)?.name ?? "";
}

function withNames(story, changes) {
  return changes.map((change) => ({ ...change, characterName: nameOf(story, change.characterId) }));
}

function memoryIdsToForget(memoryChanges, revertedEntryIds) {
  const removedIds = memoryChanges.filter((change) => !change.after);
  return [...revertedEntryIds, ...removedIds.map((change) => change.before.id)];
}

export function createTurnNotes({ storyRepository, repository, memoryIndex, now, newId }) {
  // Applies the story-side notes (updates, memory, world state) in one story write.
  async function applyToStory({ chat, parsed, previousEntry, turnSource, timestamp }) {
    return storyRepository.updateStory(chat.storyId, (story) => {
      const revertedEntryIds = revertPreviousNotes(story, previousEntry);
      const updates = applyStoryUpdates({
        story,
        allowedCharacterIds: charactersInScene(story, chat.presentCharacterIds),
        parsedUpdates: parsed.updates,
        newId,
      });
      const memory = applyMemoryOperations({
        story,
        presentCharacterIds: chat.presentCharacterIds,
        characterNotes: parsed.memory,
        shortIds: turnSource.shortIds,
        turnSource: { chatId: chat.id, turn: turnSource.turn },
        timestamp,
        newId,
      });
      const worldState = applyWorldStateOperations({
        story,
        operations: parsed.world.stateOperations,
        timestamp,
        newId,
      });
      return {
        story,
        updates: withNames(story, updates),
        memory: withNames(story, memory.changes),
        worldState,
        revertedEntryIds,
      };
    });
  }

  // Embeds new and rewritten memories and drops the embeddings of removed ones. A failure here
  // only means search finds them later, when they are embedded on demand.
  async function refreshMemoryIndex(memoryChanges, revertedEntryIds) {
    if (!memoryIndex?.isAvailable()) {
      return;
    }
    try {
      const writtenEntries = memoryChanges.filter((change) => change.after);
      await memoryIndex.refresh(writtenEntries.map((change) => change.after));
      await memoryIndex.forget(memoryIdsToForget(memoryChanges, revertedEntryIds));
    } catch {
      // Search embeds missing entries itself.
    }
  }

  // Returns { updates, memory, world: { scene, isSceneReplaced, changes }, story, isCutOff }.
  // `turn` = { replyId, turn, speakerId, shortIds, stop }, where `stop` is the provider's stop
  // reason. A reply cut off at the length limit is still applied as far as its notes are whole,
  // and its log entry is marked so the cut is visible.
  async function apply({ chatId, hiddenText, turn }) {
    const isCutOff = isLengthLimitStop(turn.stop);
    const notes = readHiddenNotes(hiddenText);
    const parsed = {
      updates: parseUpdatesNote(notes.updates),
      memory: parseMemoryNote(notes.memory),
      world: parseWorldNote(notes.world),
    };
    const chat = await repository.findChat(chatId);
    const previousEntry = findLogEntry(chat, turn.replyId);
    const timestamp = now();
    const storyResult = await applyToStory({
      chat,
      parsed,
      previousEntry,
      turnSource: turn,
      timestamp,
    });
    let sceneResult;
    await repository.updateChat(chatId, (chatToChange) => {
      const sceneBefore = previousEntry?.sceneBefore ?? chatToChange.scene;
      sceneResult = applySceneSnapshot(sceneBefore, parsed.world.scene);
      chatToChange.scene = sceneResult.scene;
      const logEntry = {
        messageId: turn.replyId,
        turn: turn.turn,
        speakerId: turn.speakerId,
        at: timestamp,
        sceneBefore,
        isSceneReplaced: sceneResult.isReplaced,
        updates: storyResult.updates,
        memory: storyResult.memory,
        worldState: storyResult.worldState,
      };
      if (isCutOff) {
        logEntry.stop = LENGTH_LIMIT_STOP;
      }
      replaceLogEntry(chatToChange, logEntry);
    });
    await refreshMemoryIndex(storyResult.memory, storyResult.revertedEntryIds);
    return {
      updates: storyResult.updates,
      memory: storyResult.memory,
      world: {
        scene: sceneResult.scene,
        isSceneReplaced: sceneResult.isReplaced,
        changes: storyResult.worldState,
      },
      story: describeStory(storyResult.story),
      isCutOff,
    };
  }

  return { apply };
}
