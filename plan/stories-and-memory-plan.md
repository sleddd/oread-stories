# Stories: a cast with identities, a world, and lean prompts

## Context
Oread has one personality and plain chats. The goal is real stories:
- **A story** has a theme, plot, conflict, point of view and world notes. The world notes are lore and history, plus the optional categories: Setting & Geography, Culture & Daily Life, Government & Politics, Economy & Trade, History & Lore, Technology or Magic Systems.
- **A cast:** each character has personality controls, backstory, a D&D-style abilities and skills chart, and a memory.

**Oread's core idea:** memory is identity formed through lived experience, the series of turns.
- **Subjective, one per character:** there is no story-wide memory, only character memory, so three characters can remember the same event differently.
- **What goes in it:** events, places, other characters and facts about them ("Jenny calls me Opy"), significant details of the world, its own traits and decisions, introspection, opinions, and wants. The character can rewrite it over time.
- **Where it lives:** memory belongs to the character, is shared by every chat in the story, and the user can edit it like the rest of the character.

**Decisions:**
- **Who replies:** the model picks who responds each turn.
- **The player:** the user plays one cast member, and the AI never writes for them.
- **Chats:** a story holds several chats.
- **Skills and abilities:** the model judges like a dice check and raises or lowers levels.
- **Two hidden notes per turn, written by the AI in the same reply call:**
  - **updates:** skill and ability changes
  - **memory:** entries for every AI character present, each from its own point of view
- **Recall:** a recall marker lets the character look deeper into its memory.
- **Memory search:** a local meaning-search model, so there are no API calls.
- **Cost:** prompts are tiered and never send all characters or the whole world. The default main speaker is whoever spoke last.
- **No transcript:** the story carries on through what is happening now and what each character remembers, not through a full log of the chat (see the next section).

## Continuity without a transcript
When the old turns fall out of the history window, long-term memory alone keeps each character themselves: who they are, how they feel about each other, promises, grudges, names, and wants. What it loses is the present moment: where everyone is, who is in the room, what was just said, and what someone was halfway through doing. Four layers fill that gap, and none of them is a history log.

| Layer | Holds | Lifetime | Written by |
|---|---|---|---|
| **Scene** | Now: where we are, who's here, what's within reach, the time of day, what was last said, and what's in motion (the hand on the door) | Overwritten every turn; never bigger than one moment | The AI, in the hidden notes |
| **Working memory** | The last few turns, word for word | A rolling window; old turns drop off and are never summarized | Nobody; it is the history window |
| **World state** | Lasting physical facts about places and objects: the window is broken, the letter is on the table | Edited when something changes; never appended to as events | The AI, in the hidden notes; editable by the user |
| **Character memory** | What happened and what it meant, from that character's point of view | Kept, rewritten and softened over time | Each character |

**Why the scene isn't world history:** history accumulates, and the present doesn't. If "where everyone is standing" went into world history, it would become a log of every place everyone ever stood, which rebuilds the transcript piece by piece.

**The record of what happened lives only in the characters.** The world can say the window is broken, but only the characters remember who broke it, and they may not agree. A disagreement between two memories is plot, not an error.

**Open threads carry the plot.** Each AI character keeps one **thread** entry, rewritten in place like the identity entry, saying what they're in the middle of:
- what they're doing
- what they're waiting for
- what they've decided but haven't done yet

Because every character tracks its own threads, the plot is spread across the cast and survives the edge of the history window.

**What keeps the past from fading too far:**
- **More than one witness:** the output protocol asks every present AI character to record events that matter to them, so big events are stored several times, each version a little different.
- **Recall by trigger:** memories are tagged with the people, places and objects they're `about`. When the scene's location, present people or nearby objects match those tags, the matching entries join the scene note without a recall marker.
- **Traces in the world:** world state facts carry keywords. When one is in the scene, it pulls up the memories tied to it: the broken window brings back who broke it.
- **Telling each other:** when one character tells another about the past ("you were there when Marta left"), the listener can write it down with the source `told by Marta`. A shared past gets rebuilt in conversation, the way families rebuild theirs.

**What gets lost:** small details nobody cared about, like the colour of the car or dinner three weeks ago. That is forgetting, and it is part of the design.

## Prompt design (cost-aware)
1. **System prefix (stable, cached):**
   - the roleplay preamble, generalized: "you voice every character except {player}"
   - the story core: theme, plot, conflict and point of view
   - the cast roster, one line per character: name, role, summary, current mood, and the first line of their identity memory
   - pinned world notes
   - the output protocol
2. **Working memory:** the last few turns (the history window). Older turns are never resent or summarized.
3. **Scene note (per turn, after the latest user message):**
   - the **current scene** snapshot
   - the **thread** entry of every present AI character
   - the **main speaker's sheet:** lorebook personality prompt from their effective dials, backstory, abilities and skills, their **identity memory**, and their **most relevant memories** within a budget, each with its short id. Memories are chosen by:
     - a meaning search over the working memory
     - trigger matches on the scene's location, people and objects
     - the most recent few
   - the **world state** facts and **world notes** whose keywords appear in the scene or recent messages, up to a budget

**Output protocol** (the model writes this; the user sees only the reply text):
```
[[speaker: Mara]]                      ← required first line (hidden)
[[recall: what I'm trying to remember]] ← optional second line (hidden)
…the visible reply…
<<updates>>{"skills":[{"character":"Mara","name":"Lockpicking","change":1,"reason":"…"}],"abilities":[…]}<</updates>>
<<memory>>{"Mara":[{"op":"add","kind":"person","about":["Jenny"],"text":"Jenny calls me Opy. I secretly like it.","importance":3},{"op":"update","id":"m12","text":"…"},{"op":"thread","text":"Reaching for the cellar door. Waiting for Brann's answer. I've decided to tell Jenny tonight."}],"Brann":[…]}<</memory>>
<<world>>{"scene":{"location":"the farmhouse kitchen","present":["Mara","Brann","Jenny"],"withinReach":["the lantern","the letter"],"timeOfDay":"late evening","lastSaid":"Brann: \"Not tonight.\"","inMotion":"Mara's hand on the cellar door"},"state":[{"op":"set","subject":"kitchen window","fact":"broken, glass on the floor","keywords":["window","glass"]}]}<</world>>
```
- **Speaker switch:** if the header names a different AI character than the one loaded, the backend cancels and re-prompts once with that character's sheet. The prefix is unchanged, so it's mostly cached.
- **Recall:** if a recall line appears, the backend cancels, runs a meaning search over that character's whole memory for the query, and re-prompts once with the results added to the scene note.
- **Limits:** at most two re-prompts per turn (one switch plus one recall).
- **Hiding the notes:** streaming filters remove the header lines and hold back everything from `<<updates>>`. All three notes (updates, memory and world) are parsed, validated and applied after the stream ends.

**Memory operations:**
- `add`, `update` (by id, so the character can rewrite), `remove`, and two special entries, one each per character, rewritten in place:
  - `identity`: who I am, who I want to be and who I was
  - `thread`: what I'm doing, waiting for, and have decided but not done yet
- Kinds: identity, thread, self, introspection, person, event, place, world, goal, opinion.
- `source` can be `told by <character>` when the memory came from what someone else said.
- Entries are validated: known characters present in the scene, text length capped, importance 1–5, and at most N operations per character per turn.

**World operations:**
- `scene` replaces the chat's scene snapshot whole. If the note is missing or invalid, the previous scene is kept.
- `state` ops are `set` (by subject; it replaces any existing fact about that subject) and `remove`. Facts are capped in number and length, so world state can't grow into a log.

**Caching:**
- **Claude:** `cache_control` on the system prefix and on the last history message.
- **Bedrock:** a `cachePoint`.
- **OpenAI and Gemini:** they cache stable prefixes automatically.

## Data model (backend/data)
- **`stories.json`:** `[{id, title, theme, plot, conflict, pointOfView, characters[], worldNotes[], worldState[], created, updated}]`
  - **character:** `{id, name, role: "ai"|"player", summary, backstory, personality: {values, mood, tags, rules}, abilities: {strength, dexterity, constitution, intelligence, wisdom, charisma} (1–20), skills: [{id, name, level 0–10, note}], memory: [{id, kind, text, about[], importance, source: {chatId, turn} | {toldBy: characterId} | "user", created, updated}]}`
  - **world note:** `{id, category, title, text, keywords[], pinned}`. Written by the user; the AI never changes it.
  - **world state fact:** `{id, subject, fact, keywords[], updated}`. Shared by every chat in the story, like memory.
- **`memoryIndex.json`:** an embedding per memory entry `{entryId: {textHash, vector}}`, rebuilt for any entry whose text changed, including user edits.
- **Chats** gain:
  - `storyId`
  - `presentCharacterIds` (default: all AI characters)
  - `lastSpeakerId`
  - `scene: {location, present[], withinReach[], timeOfDay, lastSaid, inMotion}`, overwritten every turn
  - per-character engine state `engine: {[characterId]: state}`
  - `turnLog` (applied updates and memory operations per turn, so the user can see what changed)

  The assistant message records `speakerId`.
- **Migration on load:**
  - "My story" is created with one AI character built from `personality.json`, keeping its name.
  - All existing chats are assigned to it, and each chat's `engine` moves under that character.

## Backend changes
- **Stories:** `services/storyRepository.js` and `storyService.js` for CRUD on stories, characters, world notes and memory entries, with validation. Character personality reuses `services/personalityPatch.js` and `lore/personality.js normalizePersonality`.
- **Per-character personality:** `/personality` routes move to `/stories/:sid/characters/:cid/personality`. `lore/describePersonality.js` and `lore/promptRules.js` are reused per character.
- **New `prompt/` module:** `buildSystemPrefix`, `buildRoster`, `buildCharacterSheet` (reusing `promptRules`), `selectWorldNotes`, `selectWorldState`, `selectMemories` (meaning search plus trigger matches), `describeScene`, `buildSceneNote`, and `outputProtocol`. The preamble moves here from `lore/prompt.js`.
- **New `memory/` module:**
  - `embeddingModel.js`: transformers.js `feature-extraction` with `Xenova/all-MiniLM-L6-v2` (q8, about 25 MB), cached in `backend/models/`, lazy-loaded and warmed up at start, the same pattern as `services/emotionClassifier.js`.
  - `memoryIndex.js`: embed, cache by text hash, cosine search.
  - `applyMemoryOperations.js`
  - `memoryNoteParser.js`
  - `triggeredMemories.js`: finds entries whose `about` tags match the scene's location, people and objects, or a world state fact in the scene
- **New `world/` module:** `worldNoteParser.js`, `applySceneSnapshot.js` and `applyWorldStateOperations.js`.
- **Stream protocol:** `stream/headerFilter.js` (speaker and recall lines) and `stream/hiddenNotesFilter.js` (`<<updates>>`, `<<memory>>` and `<<world>>`), both safe across chunk splits.
- **Updates:** `story/applyStoryUpdates.js` makes bounded changes: ±1 per item per turn, clamped to range.
- **`services/replyGenerator.js`:**
  - predict the speaker
  - build the prefix and scene note
  - stream through the filters
  - handle a switch or recall re-prompt (at most two)
  - save `speakerId` and `lastSpeakerId`
  - apply the updates, memory, scene and world state operations
  - write the `turnLog`
  - emit `speaker`, `recall`, `updates`, `memory`, `world` and `story` events
- **Story engine per character:** one local emotion appraisal per scene, run for each present AI character with its own personality and engine state. This reuses `story/runScene.js` and `story/effectivePersonality.js` unchanged.
- **Routes:**
  - `/stories` (GET, POST)
  - `/stories/:id` (GET, PATCH, DELETE)
  - `/stories/:id/characters[/:cid]`
  - `/stories/:id/characters/:cid/memory[/:mid]`: GET, POST, PATCH, DELETE, for user edits
  - `/stories/:id/world-notes[/:nid]`
  - `/stories/:id/world-state[/:fid]`: GET, POST, PATCH, DELETE, for user edits
  - `/stories/:id/chats` (GET, POST)
  - `/chats/:id` gains PATCH `presentCharacterIds` and `scene`

  Existing `/chats/:id/*` routes stay.
- **Providers:** an optional `cache` hint on the request, implemented for Anthropic and Bedrock.

## Frontend changes
- **Top tabs:** **Stories**, **Chat** and **Settings**. The Lorebook mixer becomes the character editor's Personality section.
- **Stories page:** the story list, then the story editor:
  - **Overview:** title, theme, plot, conflict and point of view.
  - **Cast:** the character list (AI or player). The character editor has these sections:
    - **Personality:** `TraitMixer` and `OutputPanel`
    - **Backstory and summary**
    - **Abilities and Skills:** six score fields plus a skills table
    - **Memory:**
      - the identity and thread entries at the top
      - entries grouped by kind, each showing its source (which chat and turn, or "you")
      - edit, delete and add (user-written entries)
      - search by meaning
  - **World:** notes by category, each with title, text, keywords and a pinned toggle; then the world state, a short list of standing facts the user can edit or remove.
- **Chat:**
  - **Sidebar:** the story's chats and a story switcher.
  - **Present cast:** chips for the AI characters in the scene.
  - **Scene card:** a small card showing the current scene (where, who, what's in reach, what's in motion), editable so the user can set or fix the opening moment.
  - **Messages:** show the speaker's name and avatar.
  - **Steer and Story tabs:** gain a character picker.
  - **Under each reply:** an expandable "what changed" note listing skill and ability changes, the memories written per character (e.g. "Mara remembered: Jenny calls me Opy"), and world state changes.
- **Store:** new `storiesSlice` (stories, active story, characters, world notes, memory editing). The personality slice becomes per-character, and the chat slice is scoped to the story.
- **Components:**
  - organisms: `StoryOverviewForm`, `CastList`, `CharacterEditor`, `AbilityChart`, `SkillTable`, `MemoryEditor`, `WorldNotesEditor`, `WorldStateEditor`, `PresentCastBar`, `SceneCard` and `TurnChanges`
  - molecules: `KeywordInput`, `ScoreField`, `SkillRow`, `MemoryEntry` and `WorldFact`

  All follow CLAUDE.md, build on the primitives and take props only.

## Build order
1. Data model, migration, and story, character, world and memory CRUD: the API plus the Stories page, including the memory editor and the local embedding search.
2. Tiered prompts, speaker prediction, the header and re-prompt, caching, and the per-character engine.
3. The hidden notes: updates and memory applied; recall; "what changed" under replies.
4. Continuity: the scene snapshot, world state, thread entries, trigger recall and the scene card.

## Verification
- **Backend unit tests:**
  - migration from today's data
  - validation of stories, characters, world notes and memory
  - `selectWorldNotes` and `selectMemories` (budget, pinned, identity always included)
  - `predictSpeaker`
  - header and hidden-notes filters across chunk splits
  - updates and memory parsing and bounded application (add, update, remove, identity rewrite, unknown or absent characters rejected)
  - memory index invalidation on edit
  - the scene is replaced whole each turn and kept when the note is missing
  - world state `set` replaces by subject, and the caps hold, so it never grows into a log
  - the thread entry is rewritten in place, one per character
  - trigger recall: a memory about "the old house" joins the scene note when the scene moves there
  - a `told by` memory keeps its source
  - the prefix staying byte-identical when only the speaker changes
  - a fake embedder in tests, never the real model
- **Chat-flow tests with a scripted fake provider:**
  - a correct header gives one call
  - a mismatched speaker gives one re-prompt with the new sheet
  - a recall line gives a search and a re-prompt with the results
  - both notes are stripped from the text and applied to the right characters
  - memory written in chat A appears in chat B
  - the player character is never the speaker and never gets memory written by the AI
- **Frontend tests:** the new components, `storiesSlice`, the memory editor, and the chat speaker and changes display.
- **Real-model check (manual script):** the embedding search finds "the barn burned down" from "the night of the fire".
- **Long-run continuity check (manual script, real provider):**
  - play a story well past the history window, so the first chapter is long gone from working memory
  - stop mid-scene, then check that the next reply still knows where everyone is and what they were halfway through doing
  - ask each character what happened in the first chapter and compare the answers
  - it works if the important events come back, even in different versions, and only small details are lost
- **End to end:** a Playwright run against the mock provider. Create a story with two AI characters, a player character and world notes. Chat, then check that memories appear in both characters' memory editors from their own points of view, that a user edit is used in the next prompt, and that prompts carry only the main sheet. Confirm there are no console errors.
