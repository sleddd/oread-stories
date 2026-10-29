// Builds the HTTP handler: services wired to routes under /api/v1, with JSON errors,
// CORS and NDJSON streaming. `tenancy` decides whose services answer a request: locally one
// person's (no login), hosted the signed-in user's, with /api/auth/* going to the sign-in
// routes. Without a tenancy, one set of services is built on `store` (local mode and tests).
import { Router } from "./http/router.js";
import { HttpError, errorBody, notFound } from "./http/errors.js";
import { readJson } from "./http/request.js";
import { sendJson, sendResult } from "./http/response.js";
import { applyCorsHeaders } from "./http/cors.js";
import { streamResult, isStreamResult, runEventStream } from "./http/eventStream.js";
import { createServices } from "./services/createServices.js";
import { createLocalTenancy } from "./tenancy/localTenancy.js";
import { loreRoutes } from "./routes/lore.js";
import { personalityRoutes } from "./routes/personality.js";
import { chatRoutes } from "./routes/chats.js";
import { settingsRoutes } from "./routes/settings.js";
import { dataRoutes } from "./routes/data.js";
import { storyRoutes } from "./routes/stories.js";
import { characterRoutes } from "./routes/characters.js";
import { memoryRoutes } from "./routes/memory.js";
import { worldRoutes } from "./routes/world.js";
import { storyTemplateRoutes } from "./routes/storyTemplates.js";

export const API_PREFIX = "/api/v1";

const INTERNAL_ERROR_STATUS = 500;
const HEALTH_PATH = "/health";
const ROUTE_REGISTRARS = [
  loreRoutes,
  personalityRoutes,
  chatRoutes,
  settingsRoutes,
  dataRoutes,
  storyRoutes,
  characterRoutes,
  memoryRoutes,
  worldRoutes,
  storyTemplateRoutes,
];

function createRouter(services) {
  const router = new Router();
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
  tenancy,
  ...rest
}) {
  const resolvedTenancy =
    tenancy ?? createLocalTenancy(createServices({ lore, store, providers, env, ...rest }));
  // One router per set of services: built once locally, once per request when hosted.
  const routersByServices = new WeakMap();

  function routerFor(services) {
    if (!routersByServices.has(services)) {
      routersByServices.set(services, createRouter(services));
    }
    return routersByServices.get(services);
  }

  async function routeRequest(request, response, url) {
    if (request.method === "OPTIONS") {
      response.writeHead(204);
      response.end();
      return;
    }
    if (resolvedTenancy.isAuthRequest(url.pathname)) {
      await resolvedTenancy.handleAuth(request, response);
      return;
    }
    if (!isUnderApiPrefix(url.pathname)) {
      throw notFound("Not found. The API lives under /api/v1.");
    }
    const apiPath = url.pathname.slice(API_PREFIX.length) || "/";
    if (apiPath === HEALTH_PATH && request.method === "GET") {
      // The interface asks this first, to know whether to show the sign-in screen.
      sendResult(response, {
        status: "ok",
        requiresSignIn: Boolean(resolvedTenancy.requiresSignIn),
      });
      return;
    }
    const services = await resolvedTenancy.servicesFor(request);
    const route = routerFor(services).match(request.method, apiPath);
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

  // Local mode only: the one set of services, for tests and scripts.
  handleRequest.services = resolvedTenancy.services;
  return handleRequest;
}
