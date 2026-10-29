// Serves the built interface (frontend/dist) from the API server, so a hosted Oread is one address:
// the app and its API share an origin, and the sign-in cookie travels with every request.
// Paths that aren't files (like /reset-password) get index.html, so the app's own pages load.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const INDEX_FILE = "index.html";
// Vite names built assets by their content, so they can be cached for good.
const HASHED_ASSETS_PREFIX = "/assets/";
const CACHE_FOREVER = "public, max-age=31536000, immutable";
const ALWAYS_REVALIDATE = "no-cache";
const SERVABLE_METHODS = ["GET", "HEAD"];

const CONTENT_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};
const DEFAULT_CONTENT_TYPE = "application/octet-stream";

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? DEFAULT_CONTENT_TYPE;
}

// The file a URL path points at, or null when it would step outside the folder.
function resolveInside(rootDirectory, urlPath) {
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const filePath = path.join(rootDirectory, path.normalize(decodedPath));
  if (filePath !== rootDirectory && !filePath.startsWith(rootDirectory + path.sep)) {
    return null;
  }
  return filePath;
}

async function isFile(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

function looksLikeAFile(urlPath) {
  return path.extname(urlPath) !== "";
}

async function sendFile(request, response, filePath, cacheControl) {
  const body = await readFile(filePath);
  response.writeHead(200, {
    "content-type": contentTypeFor(filePath),
    "content-length": body.length,
    "cache-control": cacheControl,
  });
  response.end(request.method === "HEAD" ? undefined : body);
}

// Returns handleStaticRequest(request, response, urlPath) → true when it answered.
export function createStaticFileHandler(rootDirectory) {
  const root = path.resolve(rootDirectory);
  const indexPath = path.join(root, INDEX_FILE);

  return async function handleStaticRequest(request, response, urlPath) {
    if (!SERVABLE_METHODS.includes(request.method)) {
      return false;
    }
    const filePath = resolveInside(root, urlPath);
    if (filePath && (await isFile(filePath))) {
      const isHashedAsset = urlPath.startsWith(HASHED_ASSETS_PREFIX);
      await sendFile(
        request,
        response,
        filePath,
        isHashedAsset ? CACHE_FOREVER : ALWAYS_REVALIDATE,
      );
      return true;
    }
    // A missing script or image is a real 404; anything else is one of the app's pages.
    if (looksLikeAFile(urlPath)) {
      return false;
    }
    await sendFile(request, response, indexPath, ALWAYS_REVALIDATE);
    return true;
  };
}
