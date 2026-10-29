import { describe, it, expect, vi } from "vitest";
import { createApiClient, ApiError } from "../src/api/index.js";
import { readEventStream } from "../src/api/readEventStream.js";

const BASE_URL = "http://api.test/api/v1";

function jsonResponse(status, body) {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function streamResponse(chunks) {
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
  return new Response(body, { status: 200 });
}

describe("createApiClient", () => {
  it("sends JSON bodies to the right URL and returns the parsed reply", async () => {
    const fetchFunction = vi
      .fn()
      .mockResolvedValue(jsonResponse(200, { personality: {}, derived: {} }));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    await api.patchPersonality(
      { storyId: "my-story", characterId: "rowan" },
      { values: { valence: 1 } },
    );

    const [url, options] = fetchFunction.mock.calls[0];
    expect(url).toBe(`${BASE_URL}/stories/my-story/characters/rowan/personality`);
    expect(options.method).toBe("PATCH");
    expect(options.headers["content-type"]).toBe("application/json");
    expect(JSON.parse(options.body)).toEqual({ values: { valence: 1 } });
  });

  it("encodes ids in paths and drafts in the query string", async () => {
    const fetchFunction = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    await api.getContext("chat/1", "hello there");

    expect(fetchFunction.mock.calls[0][0]).toBe(
      `${BASE_URL}/chats/chat%2F1/context?draft=hello%20there`,
    );
  });

  it("returns null for 204 No Content", async () => {
    const fetchFunction = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    expect(await api.deleteChat("chat-1")).toBeNull();
  });

  it("turns the server's error body into an ApiError", async () => {
    const errorBody = {
      error: {
        code: "bad_request",
        message: "values.agency must be a number.",
        details: { field: "values.agency" },
      },
    };
    const fetchFunction = vi.fn().mockResolvedValue(jsonResponse(400, errorBody));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    const character = { storyId: "my-story", characterId: "rowan" };
    const failure = await api.patchPersonality(character, {}).catch((error) => error);

    expect(failure).toBeInstanceOf(ApiError);
    expect(failure.status).toBe(400);
    expect(failure.code).toBe("bad_request");
    expect(failure.message).toBe("values.agency must be a number.");
    expect(failure.details).toEqual({ field: "values.agency" });
  });

  it("reports an unreachable backend as a network error", async () => {
    const fetchFunction = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    const failure = await api.getSettings().catch((error) => error);

    expect(failure.code).toBe("network_error");
    expect(failure.message).toMatch(/Is the backend running/);
  });

  it("streams reply events in order", async () => {
    const lines = [
      '{"type":"chat"}\n{"type":"start"}\n',
      '{"type":"delta","text":"Hi"}\n',
      '{"type":"done"}\n',
    ];
    const fetchFunction = vi.fn().mockResolvedValue(streamResponse(lines));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });
    const received = [];

    await api.sendMessage("chat-1", "Hello", { onEvent: (event) => received.push(event.type) });

    expect(received).toEqual(["chat", "start", "delta", "done"]);
    expect(JSON.parse(fetchFunction.mock.calls[0][1].body)).toEqual({ content: "Hello" });
  });

  it("throws before streaming when the server refuses the request", async () => {
    const fetchFunction = vi
      .fn()
      .mockResolvedValue(jsonResponse(409, { error: { code: "conflict", message: "Busy." } }));
    const api = createApiClient({ baseUrl: BASE_URL, fetchFunction });

    await expect(api.requestReply("chat-1", { onEvent: vi.fn() })).rejects.toMatchObject({
      status: 409,
      message: "Busy.",
    });
  });
});

describe("readEventStream", () => {
  it("joins lines split across chunks and reads a final line without a newline", async () => {
    const received = [];
    const response = streamResponse(['{"type":"del', 'ta","text":"a"}\n{"ty', 'pe":"done"}']);

    await readEventStream(response, (event) => received.push(event));

    expect(received).toEqual([{ type: "delta", text: "a" }, { type: "done" }]);
  });
});
