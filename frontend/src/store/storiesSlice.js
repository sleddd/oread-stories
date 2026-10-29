// Stories and their cast: the story list, the pre-built stories, the open story (overview,
// characters, world notes and world state), the selected character, and that character's memory. The selected character is
// the one the editor shows and the steering dials move.

const ACTIVE_STORY_STORAGE_KEY = "oread.story";
const SELECTED_CHARACTER_STORAGE_KEY = "oread.character";
const DEFAULT_STORY_ID = "my-story";
const SEARCH_UNAVAILABLE_STATUS = 503;

function firstAiCharacter(story) {
  return story.characters.find((character) => character.role === "ai") ?? null;
}

function chooseCharacterId(story, preferredCharacterId) {
  const preferred = story.characters.find((character) => character.id === preferredCharacterId);
  if (preferred) {
    return preferred.id;
  }
  return firstAiCharacter(story)?.id ?? story.characters[0]?.id ?? null;
}

function chooseStoryId(stories, rememberedStoryId) {
  const remembered = stories.find((story) => story.id === rememberedStoryId);
  if (remembered) {
    return remembered.id;
  }
  const defaultStory = stories.find((story) => story.id === DEFAULT_STORY_ID);
  return defaultStory?.id ?? stories[0]?.id ?? null;
}

function replaceCharacter(story, updatedCharacter) {
  const characters = story.characters.map((character) => {
    if (character.id === updatedCharacter.id) {
      return { ...character, ...updatedCharacter };
    }
    return character;
  });
  return { ...story, characters };
}

export function createStoriesSlice({ api, platform }) {
  return (set, get) => {
    function selectedCharacterReference() {
      const storyId = get().activeStoryId;
      const characterId = get().selectedCharacterId;
      if (!storyId || !characterId) {
        return null;
      }
      return { storyId, characterId };
    }

    // Runs a change that returns the updated story, then shows it.
    async function changeStory(requestStory) {
      try {
        const story = await requestStory();
        set({ activeStory: story });
        return story;
      } catch (error) {
        get().showError(error);
        return null;
      }
    }

    // Runs a change to one part of the story, then reloads the whole story.
    async function changeStoryPart(requestChange) {
      try {
        await requestChange();
        await get().refreshActiveStory();
        return true;
      } catch (error) {
        get().showError(error);
        return false;
      }
    }

    async function showNewStory(story) {
      await get().loadStories();
      await get().openStory(story.id);
      set({ storyEditorTabId: "overview" });
    }

    async function changeMemory(requestChange) {
      const character = selectedCharacterReference();
      if (!character) {
        return;
      }
      try {
        await requestChange(character);
        await get().loadMemory();
      } catch (error) {
        get().showError(error);
      }
    }

    return {
      stories: [],
      storyTemplates: [],
      activeStoryId: null,
      activeStory: null,
      selectedCharacterId: null,
      memoryEntries: [],
      memorySearch: { query: "", status: "idle", results: [] },
      // Which story tab and character section the Stories page shows.
      storyEditorTabId: "overview",
      characterSectionId: "personality",

      selectedCharacterReference,

      showStoryEditorTab: (storyEditorTabId) => set({ storyEditorTabId }),
      showCharacterSection: (characterSectionId) => set({ characterSectionId }),

      // Jumps to a character's section on the Stories page (from the chat's "edit" links).
      async openCharacterEditor(characterId, characterSectionId = "personality") {
        if (characterId && characterId !== get().selectedCharacterId) {
          await get().selectCharacter(characterId);
        }
        set({ storyEditorTabId: "cast", characterSectionId });
        get().navigate("stories");
      },

      selectedCharacter() {
        const story = get().activeStory;
        if (!story) {
          return null;
        }
        return story.characters.find((character) => character.id === get().selectedCharacterId);
      },

      async loadStories() {
        try {
          set({ stories: await api.listStories() });
        } catch (error) {
          get().showError(error);
        }
      },

      // Used at start-up: opens the remembered story, or My story, and lists the pre-built ones.
      async openFirstStory() {
        const stories = await api.listStories();
        set({ stories });
        const rememberedStoryId = platform.storage.read(ACTIVE_STORY_STORAGE_KEY);
        const storyId = chooseStoryId(stories, rememberedStoryId);
        if (storyId) {
          await get().openStory(storyId, { shouldThrow: true });
        }
        await get().loadStoryTemplates();
      },

      // The pre-built stories are a convenience: if they can't load, the app works without them.
      async loadStoryTemplates() {
        try {
          set({ storyTemplates: await api.listStoryTemplates() });
        } catch {
          set({ storyTemplates: [] });
        }
      },

      // Opens a story and its selected character. Chats belong to a story, so the open chat
      // closes and the chat list reloads for the new story.
      async openStory(storyId, { shouldThrow = false } = {}) {
        if (get().isReplyStreaming?.()) {
          get().showToast("Wait for the reply to finish, or stop it first.");
          return;
        }
        try {
          const story = await api.getStory(storyId);
          const isNewStory = get().activeStoryId !== story.id;
          platform.storage.write(ACTIVE_STORY_STORAGE_KEY, story.id);
          set({ activeStoryId: story.id, activeStory: story });
          const rememberedCharacterId = platform.storage.read(SELECTED_CHARACTER_STORAGE_KEY);
          await get().selectCharacter(chooseCharacterId(story, rememberedCharacterId));
          if (isNewStory) {
            await get().leaveChatsOfPreviousStory();
          }
        } catch (error) {
          if (shouldThrow) {
            throw error;
          }
          get().showError(error);
        }
      },

      async refreshActiveStory() {
        const storyId = get().activeStoryId;
        if (!storyId) {
          return;
        }
        try {
          set({ activeStory: await api.getStory(storyId) });
        } catch {
          // Keep the story we have; the next change reloads it.
        }
      },

      async createStory(title) {
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
          return;
        }
        try {
          const story = await api.createStory({ title: trimmedTitle });
          await showNewStory(story);
        } catch (error) {
          get().showError(error);
        }
      },

      // A copy of a pre-built story, with its own cast and memories to change freely.
      async createStoryFromTemplate(templateId) {
        try {
          const story = await api.createStoryFromTemplate(templateId);
          await showNewStory(story);
        } catch (error) {
          get().showError(error);
        }
      },

      async deleteStory(story) {
        const question =
          `Delete “${story.title}” with its cast, world and chats? ` + "This can't be undone.";
        if (!platform.confirmAction(question)) {
          return;
        }
        try {
          await api.deleteStory(story.id);
          await get().loadStories();
          if (get().activeStoryId === story.id) {
            await get().openStory(chooseStoryId(get().stories, DEFAULT_STORY_ID));
          }
        } catch (error) {
          get().showError(error);
        }
      },

      async saveStoryOverview(changes) {
        const storyId = get().activeStoryId;
        const saved = await changeStory(() => api.updateStory(storyId, changes));
        if (saved) {
          await get().loadStories();
        }
      },

      async addCharacter({ name, role }) {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return;
        }
        try {
          const character = await api.createCharacter(get().activeStoryId, {
            name: trimmedName,
            role,
          });
          await get().refreshActiveStory();
          await get().selectCharacter(character.id);
          set({ storyEditorTabId: "cast" });
          await get().loadStories();
        } catch (error) {
          get().showError(error);
        }
      },

      async saveCharacter(changes) {
        const character = selectedCharacterReference();
        if (!character) {
          return;
        }
        try {
          const updatedCharacter = await api.updateCharacter(character, changes);
          set({ activeStory: replaceCharacter(get().activeStory, updatedCharacter) });
          if (changes.name !== undefined) {
            set({ personality: { ...get().personality, name: updatedCharacter.name } });
          }
        } catch (error) {
          get().showError(error);
        }
      },

      async deleteCharacter(character) {
        const question = `Remove ${character.name} and everything they remember from this story?`;
        if (!platform.confirmAction(question)) {
          return;
        }
        const storyId = get().activeStoryId;
        const isRemoved = await changeStoryPart(() => {
          return api.deleteCharacter({ storyId, characterId: character.id });
        });
        if (isRemoved) {
          await get().selectCharacter(chooseCharacterId(get().activeStory, null));
          await get().loadStories();
        }
      },

      // Shows a character in the editor and points the steering dials at it.
      async selectCharacter(characterId) {
        await get().flushPersonalityChanges?.();
        platform.storage.write(SELECTED_CHARACTER_STORAGE_KEY, characterId);
        set({
          selectedCharacterId: characterId,
          memoryEntries: [],
          memorySearch: { query: "", status: "idle", results: [] },
        });
        if (!characterId) {
          return;
        }
        await Promise.all([get().loadSelectedPersonality(), get().loadMemory()]);
      },

      // Keeps the cast in step when the personality API renames a character or moves its dials.
      showCharacterPersonality(characterId, personality) {
        const story = get().activeStory;
        if (!story) {
          return;
        }
        const { name, ...dials } = personality;
        set({
          activeStory: replaceCharacter(story, { id: characterId, name, personality: dials }),
        });
      },

      async loadMemory() {
        const character = selectedCharacterReference();
        if (!character) {
          return;
        }
        try {
          const memoryEntries = await api.listMemory(character);
          if (get().selectedCharacterId === character.characterId) {
            set({ memoryEntries });
          }
        } catch (error) {
          get().showError(error);
        }
      },

      addMemoryEntry: (entry) => changeMemory((character) => api.addMemory(character, entry)),
      saveMemoryEntry: (entryId, changes) => {
        return changeMemory((character) => api.updateMemory(character, entryId, changes));
      },
      deleteMemoryEntry(entry) {
        if (!platform.confirmAction("Forget this memory?")) {
          return Promise.resolve();
        }
        return changeMemory((character) => api.deleteMemory(character, entry.id));
      },

      // Finds memories by meaning. The search model runs on the backend's machine; if it isn't
      // ready yet, the editor says so instead of showing an error.
      async searchMemory(query) {
        const character = selectedCharacterReference();
        const trimmedQuery = query.trim();
        if (!character || !trimmedQuery) {
          set({ memorySearch: { query: "", status: "idle", results: [] } });
          return;
        }
        set({ memorySearch: { query: trimmedQuery, status: "searching", results: [] } });
        try {
          const results = await api.searchMemory(character, trimmedQuery);
          set({ memorySearch: { query: trimmedQuery, status: "done", results } });
        } catch (error) {
          if (error.status === SEARCH_UNAVAILABLE_STATUS) {
            set({ memorySearch: { query: trimmedQuery, status: "unavailable", results: [] } });
            return;
          }
          set({ memorySearch: { query: trimmedQuery, status: "idle", results: [] } });
          get().showError(error);
        }
      },

      clearMemorySearch() {
        set({ memorySearch: { query: "", status: "idle", results: [] } });
      },

      addWorldNote(note) {
        return changeStoryPart(() => api.addWorldNote(get().activeStoryId, note));
      },
      saveWorldNote(noteId, changes) {
        return changeStoryPart(() => api.updateWorldNote(get().activeStoryId, noteId, changes));
      },
      deleteWorldNote(note) {
        if (!platform.confirmAction(`Delete the world note “${note.title}”?`)) {
          return Promise.resolve(false);
        }
        return changeStoryPart(() => api.deleteWorldNote(get().activeStoryId, note.id));
      },

      setWorldFact(fact) {
        return changeStoryPart(() => api.setWorldFact(get().activeStoryId, fact));
      },
      saveWorldFact(factId, changes) {
        return changeStoryPart(() => api.updateWorldFact(get().activeStoryId, factId, changes));
      },
      deleteWorldFact(fact) {
        return changeStoryPart(() => api.deleteWorldFact(get().activeStoryId, fact.id));
      },
    };
  };
}
