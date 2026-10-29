// A chat remembers, for each character, the personality profile that character last replied
// with. Shift markers and the pending shift compare against it. Chats from before stories kept a
// single `profile`; it belonged to the chat's last speaker.

export function profilesOf(chat) {
  if (chat.profiles) {
    return chat.profiles;
  }
  if (chat.profile && chat.lastSpeakerId) {
    return { [chat.lastSpeakerId]: chat.profile };
  }
  return {};
}

export function profileFor(chat, characterId) {
  return profilesOf(chat)[characterId] ?? null;
}

export function setProfile(chat, characterId, profile) {
  chat.profiles = { ...profilesOf(chat), [characterId]: profile };
  delete chat.profile;
}
