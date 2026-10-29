// A small method + path router. Patterns use :name segments, e.g. /chats/:id/messages/:messageId.
import { badRequest } from "./errors.js";

const PARAMETER_SEGMENT = /\/:([A-Za-z]+)/g;

// A malformed escape like "%E0%A4%A" is the caller's mistake: a 400, not a server error.
function decodePathSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    throw badRequest("The URL has a malformed %-escape.");
  }
}

function compilePattern(pattern) {
  const parameterNames = [];
  const regexSource = pattern.replace(PARAMETER_SEGMENT, (_wholeMatch, parameterName) => {
    parameterNames.push(parameterName);
    return "/([^/]+)";
  });
  return { regex: new RegExp(`^${regexSource}/?$`), parameterNames };
}

function extractParams(parameterNames, match) {
  const params = {};
  parameterNames.forEach((parameterName, index) => {
    params[parameterName] = decodePathSegment(match[index + 1]);
  });
  return params;
}

export class Router {
  #routes = [];

  add(method, pattern, handler) {
    const { regex, parameterNames } = compilePattern(pattern);
    this.#routes.push({ method, pattern, regex, parameterNames, handler });
    return this;
  }

  get(pattern, handler) {
    return this.add("GET", pattern, handler);
  }

  post(pattern, handler) {
    return this.add("POST", pattern, handler);
  }

  put(pattern, handler) {
    return this.add("PUT", pattern, handler);
  }

  patch(pattern, handler) {
    return this.add("PATCH", pattern, handler);
  }

  delete(pattern, handler) {
    return this.add("DELETE", pattern, handler);
  }

  // Returns {handler, params} on a match, or {allowed} listing the methods the path supports
  // (empty when the path is unknown).
  match(method, pathname) {
    const allowed = [];
    for (const route of this.#routes) {
      const match = route.regex.exec(pathname);
      if (!match) {
        continue;
      }
      if (route.method === method) {
        return { handler: route.handler, params: extractParams(route.parameterNames, match) };
      }
      allowed.push(route.method);
    }
    return { allowed };
  }
}
