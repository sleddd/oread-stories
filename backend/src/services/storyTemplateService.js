// The pre-built stories: listing them and starting a new story from one. The templates are
// read-only; each new story is an independent copy with its own ids.
import { randomUUID } from "node:crypto";
import { notFound } from "../http/errors.js";
import { storyFromBlueprint } from "../stories/storyFromBlueprint.js";
import { describeStory } from "./storyView.js";

function summarizeTemplate(template) {
  const { blueprint, ...summary } = template;
  return structuredClone(summary);
}

function allMemoryEntries(story) {
  const entries = [];
  for (const character of story.characters) {
    entries.push(...character.memory);
  }
  return entries;
}

export function createStoryTemplateService({
  templates = [],
  storyRepository,
  memoryIndex,
  now = Date.now,
  newId = randomUUID,
}) {
  function findTemplate(templateId) {
    const template = templates.find((candidate) => candidate.id === templateId);
    if (!template) {
      throw notFound(`There is no story template "${templateId}".`);
    }
    return template;
  }

  function list() {
    return templates.map(summarizeTemplate);
  }

  // The seed memories are embedded in the background so memory search is ready sooner; the
  // story doesn't wait for it, and search embeds anything still missing on its own.
  function indexSeedMemories(story) {
    if (!memoryIndex.isAvailable()) {
      return;
    }
    memoryIndex.refresh(allMemoryEntries(story)).catch(() => {});
  }

  async function createStory(templateId) {
    const template = findTemplate(templateId);
    const story = storyFromBlueprint({ blueprint: template.blueprint, newId, timestamp: now() });
    await storyRepository.addStory(story);
    indexSeedMemories(story);
    return describeStory(story);
  }

  return { list, createStory };
}
