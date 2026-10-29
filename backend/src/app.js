// Builds the HTTP handler: services wired to routes under /api/v1, with JSON errors,
// CORS and NDJSON streaming.
import { Router } from "./http/router.js";
import { HttpError, errorBody, notFound } from "./http/errors.js";
import { readJson } from "./http/request.js";
import { sendJson, sendResult } from "./http/response.js";
import { applyCorsHeaders } from "./http/cors.js";
import { streamResult, isStreamResult, runEventStream } from "./http/eventStream.js";
import { createServices } from "./services/createServices.js";
import { loreRoutes } from "./routes/lore.js";
import { personalityRoutes } from "./routes/personality.js";
import { chatRoutes } from "./routes/chats.js";
import { settingsRoutes } from "./routes/settings.js";
import { dataRoutes } from "./routes/data.js";

export const API_PREFIX = "/api/v1";

const INTERNAL_ERROR_STATUS = 500;
const ROUTE_REGISTRARS = [loreRoutes, personalityRoutes, chatRoutes, settingsRoutes, dataRoutes];

function createRouter(services) {
  const router = new Router();
  router.get("/health", () => ({ status: "ok" }));
  for (const registerRoutes of ROUTE_REGISTRARS) {
    registerRoutes(router, services);
  }
  return router;
}

function isUnderApiPrefix(pathname) {
  return pathname.startsWith(API_PREFIX + "/") || pathname === API_PREFIX;
}

function sendMethodNotAllowed(request, response, allowedMethods) {
  const body = {
    error: { code: "method_not_allowed", message: `${request.method} isn't supported here.` },
  };
  sendJson(response, 405, body, { allow: allowedMethods.join(", ") });
}

// The context object every route handler receives. The body is parsed at most once, on demand.
function createHandlerContext(request, response, route, url) {
  let parsedBody;
  return {
    req: request,
    res: response,
    params: route.params,
    query: url.searchParams,
    body: () => {
      parsedBody ??= readJson(request);
      return parsedBody;
    },
    stream: streamResult,
  };
}

function sendError(response, error, logger) {
  let status = INTERNAL_ERROR_STATUS;
  if (error instanceof HttpError) {
    status = error.status;
  }
  if (status === INTERNAL_ERROR_STATUS) {
    logger.error?.(error);
  }
  if (response.headersSent) {
    response.end();
    return;
  }
  sendJson(response, status, errorBody(error));
}

export function createApp({
  lore,
  store,
  providers,
  env = process.env,
  corsOrigins = [],
  logger = console,
  ...rest
}) {
  const services = createServices({ lore, store, providers, env, ...rest });
  const router = createRouter(services);

  async function routeRequest(request, response, url) {
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (!isUnderApiPrefix(url.pathname)) {
      throw notFound("Not found. The API lives under /api/v1.");
    }
    const apiPath = url.pathname.slice(API_PREFIX.length) || "/";
    const route = router.match(request.method, apiPath);
    if (!route.handler) {
      if (route.allowed.length) {
        sendMethodNotAllowed(request, response, route.allowed);
        return;
      }
      throw notFound(`No endpoint at ${request.method} ${url.pathname}.`);
    }
    const result = await route.handler(createHandlerContext(request, response, route, url));
    if (isStreamResult(result)) {
      await runEventStream(response, result, logger);
      return;
    }
    sendResult(response, result);
  }

  async function handleRequest(request, response) {
    const url = new URL(request.url, "http://localhost");
    applyCorsHeaders(request, response, corsOrigins);
    try {
      await routeRequest(request, response, url);
    } catch (error) {
      sendError(response, error, logger);
    }
  }

  handleRequest.services = services;
  return handleRequest;
}
