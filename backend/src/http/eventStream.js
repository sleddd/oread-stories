// Runs an async event generator as an NDJSON response.
// The first event is pulled before any headers are written, so a failure while setting up
// (an unknown chat, a busy chat) still becomes a normal JSON error with the right status.
import { HttpError } from "./errors.js";
import { ndjson } from "./response.js";

export const STREAM = Symbol("stream");

const GENERIC_STREAM_FAILURE = "The reply failed on the server.";
// While a reply waits on the model, a small event keeps hosting proxies from closing the
// connection as idle. The interface ignores events it doesn't know.
export const HEARTBEAT_EVENT = { type: "heartbeat" };
const HEARTBEAT_INTERVAL_MILLISECONDS = 20_000;

// Handlers return this to ask the app to stream; makeEvents(signal) creates the generator.
export function streamResult(makeEvents) {
  return { [STREAM]: makeEvents };
}

export function isStreamResult(result) {
  return Boolean(result?.[STREAM]);
}

// Aborts the generator's work when the client disconnects before the response has finished.
function abortWhenClientLeaves(response) {
  const abortController = new AbortController();
  response.on("close", () => {
    if (!response.writableFinished) {
      abortController.abort();
    }
  });
  return abortController.signal;
}

function streamFailureMessage(error) {
  if (error instanceof HttpError) {
    return error.message;
  }
  return GENERIC_STREAM_FAILURE;
}

export async function runEventStream(
  response,
  streamRequest,
  logger,
  heartbeatIntervalMilliseconds = HEARTBEAT_INTERVAL_MILLISECONDS,
) {
  const signal = abortWhenClientLeaves(response);
  const makeEvents = streamRequest[STREAM];
  const events = makeEvents(signal)[Symbol.asyncIterator]();
  const firstEvent = await events.next();
  const output = ndjson(response);
  const heartbeat = setInterval(() => output.write(HEARTBEAT_EVENT), heartbeatIntervalMilliseconds);
  try {
    if (!firstEvent.done) {
      output.write(firstEvent.value);
    }
    let nextEvent = await events.next();
    while (!nextEvent.done) {
      output.write(nextEvent.value);
      nextEvent = await events.next();
    }
  } catch (error) {
    logger.error?.(error);
    output.write({ type: "error", message: streamFailureMessage(error) });
  } finally {
    clearInterval(heartbeat);
  }
  output.end();
}
