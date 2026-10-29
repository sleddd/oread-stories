// Response helpers. Handlers return a plain value (sent as 200 JSON) or one of these results.
export const RESULT = Symbol("result");

const NO_CONTENT_STATUS = 204;

export function created(body) {
  return { [RESULT]: true, status: 201, body };
}

export function noContent() {
  return { [RESULT]: true, status: NO_CONTENT_STATUS };
}

export function sendJson(response, status, body, headers = {}) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...headers,
  });
  if (body === undefined) {
    response.end(undefined);
    return;
  }
  response.end(JSON.stringify(body));
}

export function sendResult(response, value) {
  const isExplicitResult = Boolean(value?.[RESULT]);
  if (!isExplicitResult) {
    sendJson(response, 200, value);
    return;
  }
  if (value.status === NO_CONTENT_STATUS) {
    response.writeHead(NO_CONTENT_STATUS, { "cache-control": "no-store" });
    response.end();
    return;
  }
  sendJson(response, value.status, value.body);
}

function isResponseOpen(response) {
  return !response.writableEnded && !response.destroyed;
}

// Newline-delimited JSON stream: one event object per line.
export function ndjson(response) {
  response.writeHead(200, {
    "content-type": "application/x-ndjson; charset=utf-8",
    "cache-control": "no-store",
    "x-accel-buffering": "no",
  });
  // Writes are dropped once the client has gone, so the server can finish saving regardless.
  return {
    write(event) {
      if (isResponseOpen(response)) {
        response.write(JSON.stringify(event) + "\n");
      }
    },
    end() {
      if (isResponseOpen(response)) {
        response.end();
      }
    },
  };
}
