// The tenant-isolation checks, shared by the stand-in auth test and the real database test.
// `callAs(user, method, path, body)` sends a request as that signed-in user and returns
// { status, json }.
import assert from "node:assert/strict";

export async function checkTenantIsolation({ callAs, owner, stranger }) {
  const story = (await callAs(owner, "POST", "/stories", { title: "The Flood" })).json;
  const character = (
    await callAs(owner, "POST", `/stories/${story.id}/characters`, { name: "Mara" })
  ).json;
  const memoryPath = `/stories/${story.id}/characters/${character.id}/memory`;
  await callAs(owner, "POST", memoryPath, { kind: "event", text: "The barn burned down." });
  const chat = (await callAs(owner, "POST", `/stories/${story.id}/chats`, {})).json;

  assert.equal((await callAs(owner, "GET", `/stories/${story.id}`)).status, 200);
  assert.equal((await callAs(stranger, "GET", `/stories/${story.id}`)).status, 404);
  assert.equal((await callAs(stranger, "GET", `/chats/${chat.id}`)).status, 404);
  assert.equal((await callAs(stranger, "GET", memoryPath)).status, 404);
  const strangerSearch = await callAs(stranger, "GET", `${memoryPath}/search?query=fire`);
  assert.equal(strangerSearch.status, 404);
  const strangerPatch = await callAs(stranger, "PATCH", `/stories/${story.id}`, { title: "Mine" });
  assert.equal(strangerPatch.status, 404);
  assert.equal((await callAs(stranger, "DELETE", `/chats/${chat.id}`)).status, 404);

  const strangerStories = (await callAs(stranger, "GET", "/stories")).json.stories;
  assert.ok(strangerStories.every((listed) => listed.id !== story.id));
  const strangerExport = (await callAs(stranger, "GET", "/export")).json;
  assert.ok(strangerExport.stories.every((exported) => exported.id !== story.id));
  assert.ok(strangerExport.chats.every((exported) => exported.id !== chat.id));

  const ownerExport = (await callAs(owner, "GET", "/export")).json;
  assert.ok(ownerExport.stories.some((exported) => exported.id === story.id));
  assert.equal((await callAs(owner, "GET", `/stories/${story.id}`)).json.title, "The Flood");
  return { story, character, chat };
}
