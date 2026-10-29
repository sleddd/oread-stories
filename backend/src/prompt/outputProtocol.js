// How the model writes every reply: a hidden header naming the speaker (and, rarely, what they
// are trying to remember), the visible reply, then three hidden notes the app acts on but never
// shows: skill and ability changes, the world, and each AI character's memories.
// The world note comes before the memory note on purpose: the scene is short and needed every
// turn, while memories run long, so if a reply hits the length limit it is memories that are cut.
// The tags here must match the stream filters (stream/headerFilter.js, stream/hiddenNotes.js).

const NOTE_EXAMPLE = [
  "[[speaker: Mara]]",
  "*Mara sets the lantern down and doesn't look at him.* Not tonight, Brann. Ask me again " +
    "tomorrow.",
  '<<updates>>{"skills":[{"character":"Mara","name":"Lockpicking","change":1,' +
    '"reason":"opened the cellar lock under pressure"}],"abilities":[]}<</updates>>',
  '<<world>>{"scene":{"location":"the farmhouse kitchen","present":["Mara","Brann","Jenny"],' +
    '"withinReach":["the lantern","the letter"],"timeOfDay":"late evening",' +
    '"lastSaid":"Mara: Not tonight, Brann.","inMotion":"Mara\'s hand on the cellar door"},' +
    '"state":[{"op":"set","subject":"kitchen window","fact":"broken, glass on the floor",' +
    '"keywords":["window","glass"]}]}<</world>>',
  '<<memory>>{"Mara":[{"op":"add","kind":"person","about":["Jenny"],' +
    '"text":"Jenny calls me Opy. I secretly like it.","importance":3},' +
    '{"op":"thread","text":"Reaching for the cellar door. Waiting for Brann\'s answer. ' +
    'I\'ve decided to tell Jenny tonight."}],"Brann":[{"op":"add","kind":"event",' +
    '"about":["Mara","cellar"],"text":"Mara shut me out again. She\'s hiding something down ' +
    'there.","importance":2}]}<</memory>>',
];

function speakerSteps(playerName) {
  let neverPlayer = "";
  if (playerName) {
    neverPlayer = ` Never name ${playerName}.`;
  }
  let seenBy = "the person you're writing with";
  if (playerName) {
    seenBy = playerName;
  }
  return [
    "1. The first line is always [[speaker: Name]], naming the one character who speaks in this " +
      "reply. Usually that is the main speaker in the scene note, but if another character " +
      `present would naturally answer, name them instead and you'll get their sheet.${neverPlayer}`,
    "2. Only if the speaker is reaching for something from their past that isn't in the scene " +
      "note, the second line is [[recall: what they're trying to remember]]. You'll be given " +
      "what they find. Use it rarely.",
    `3. Then the reply itself. It is the only part ${seenBy} sees.`,
    "4. Then three hidden notes, each on its own line and holding JSON, in this order: " +
      "<<updates>>, <<world>>, <<memory>>. Write all three every time, with {} when a note has " +
      "nothing to say.",
  ];
}

const UPDATES_NOTE =
  "<<updates>> holds skill and ability changes, judged like a dice check: when a character " +
  "tries something that tests a skill or ability and clearly succeeds or fails in a way that " +
  "should teach or cost them, raise or lower it by 1, with a short reason. Most turns change " +
  'nothing. Shape: {"skills":[{"character","name","change","reason"}],"abilities":[...]}. ' +
  "Abilities are strength, dexterity, constitution, intelligence, wisdom and charisma.";

function memoryNote(playerName) {
  let neverPlayer = "";
  if (playerName) {
    neverPlayer = ` Never write memories for ${playerName}.`;
  }
  return [
    "<<memory>> holds what each AI character present takes from this turn, keyed by name, " +
      "written by that character in the first person from their own point of view. Every AI " +
      "character present records what matters to them, and only that; two of them may remember " +
      `the same moment differently.${neverPlayer} Operations:`,
    '- {"op":"add","kind":"event","about":["Jenny","the barn"],"text":"…","importance":3}. ' +
      "Kinds: self, introspection, person, event, place, world, goal, opinion. About names the " +
      "people, places and things it concerns. Importance runs from 1 (passing) to 5 " +
      "(life-changing).",
    '- {"op":"update","id":"m3","text":"…"} or {"op":"remove","id":"m3"} rewrites or lets go ' +
      "of a memory shown in the scene note, by its id.",
    '- {"op":"identity","text":"…"} rewrites who they are, who they want to be and who they ' +
      "were, only when that has changed.",
    '- {"op":"thread","text":"…"} rewrites what they are in the middle of: what they are doing, ' +
      "what they are waiting for, and what they have decided but not done yet. Keep it current.",
    '- When another character tells them about the past, add it with "toldBy":"Name".',
    "Keep it short: one or two operations per character, each a sentence or two. Record what " +
      "matters, not everything that happened.",
  ].join("\n");
}

const WORLD_NOTE =
  '<<world>> holds the world. "scene" is a snapshot of right now (location, present, ' +
  'withinReach, timeOfDay, lastSaid, inMotion), replaced whole every turn. "state" lists ' +
  "lasting changes to places and objects, things that stay changed after the moment passes, " +
  'never events: {"op":"set","subject","fact","keywords"} or {"op":"remove","subject"}.';

export function outputProtocol(playerName) {
  const lines = [
    "How every reply is written:",
    ...speakerSteps(playerName),
    UPDATES_NOTE,
    WORLD_NOTE,
    memoryNote(playerName),
    "For example:",
    ...NOTE_EXAMPLE,
  ];
  return lines.join("\n");
}
