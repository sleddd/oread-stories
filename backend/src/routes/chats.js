// Chat endpoints: the chat list, single chats (title, present cast and scene), transcript edits,
// the model context preview, and the two streaming endpoints that write replies.
import { created, noContent } from "../http/response.js";
import {
  requireObject,
  optionalString,
  requireString,
  optionalInteger,
  optionalStringList,
  rejectUnknownFields,
  requireSomeField,
} from "../http/validate.js";
import { badRequest } from "../http/errors.js";
import { readScene } from "../stories/sceneInput.js";

const MAX_TITLE_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 100_000;
const MAX_PRESENT_CHARACTERS = 50;
const MAX_ID_LENGTH = 100;
const CHANGEABLE_CHAT_FIELDS = ["title", "presentCharacterIds", "scene"];

function readChatChanges(body) {
  const input = requireObject(body);
  rejectUnknownFields(input, CHANGEABLE_CHAT_FIELDS);
  requireSomeField(input, CHANGEABLE_CHAT_FIELDS);
  const changes = {
    title: optionalString(input.title, "title", { max: MAX_TITLE_LENGTH }),
    presentCharacterIds: optionalStringList(input.presentCharacterIds, "presentCharacterIds", {
      maxItems: MAX_PRESENT_CHARACTERS,
      maxLength: MAX_ID_LENGTH,
    }),
  };
  if (input.scene !== undefined) {
    changes.scene = readScene(input.scene);
  }
  return changes;
}

export function chatRoutes(router, { chats }) {
  router.get("/chats", async () => ({ chats: await chats.list() }));

  router.post("/chats", async ({ body }) => {
    const input = requireObject(await body());
    const title = optionalString(input.title, "title", { max: MAX_TITLE_LENGTH });
    return created(await chats.create({ title }));
  });

  router.get("/chats/:chatId", ({ params }) => chats.get(params.chatId));

  router.patch("/chats/:chatId", async ({ params, body }) => {
    return chats.update(params.chatId, readChatChanges(await body()));
  });

  router.delete("/chats/:chatId", async ({ params }) => {
    await chats.remove(params.chatId);
    return noContent();
  });

  router.get("/chats/:chatId/context", ({ params, query }) => {
    return chats.context(params.chatId, query.get("draft") || "");
  });

  router.post("/chats/:chatId/clear", ({ params }) => chats.clear(params.chatId));

  router.post("/chats/:chatId/shift/undo", ({ params }) => chats.undoShift(params.chatId));

  router.post("/chats/:chatId/engine/reset", ({ params }) => chats.resetEngine(params.chatId));

  router.patch("/chats/:chatId/messages/:messageId", async ({ params, body }) => {
    const input = requireObject(await body());
    const content = optionalString(input.content, "content", { max: MAX_MESSAGE_LENGTH });
    const alt = optionalInteger(input.alt, "alt", { min: 0 });
    if (content === undefined && alt === undefined) {
      throw badRequest("Send content, alt, or both.");
    }
    return chats.editMessage(params.chatId, params.messageId, { content, alt });
  });

  router.delete("/chats/:chatId/messages/:messageId", ({ params }) => {
    return chats.deleteMessage(params.chatId, params.messageId);
  });

  // Both of these stream NDJSON events while the reply is written.
  router.post("/chats/:chatId/messages", async ({ params, body, stream }) => {
    const input = requireObject(await body());
    const content = requireString(input.content, "content", {
      max: MAX_MESSAGE_LENGTH,
      allowEmpty: false,
    }).trim();
    return stream((signal) => chats.send(params.chatId, content, { signal }));
  });

  router.post("/chats/:chatId/reply", ({ params, stream }) => {
    return stream((signal) => chats.reply(params.chatId, { signal }));
  });
}
