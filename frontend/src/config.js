// Runtime configuration for the interface.

// Same address as the interface: in development Vite passes /api through to the backend
// (vite.config.js), and in production the backend serves the interface itself. Keeping one
// address lets the sign-in cookie travel with every request.
const DEFAULT_API_BASE_URL = "/api/v1";
const DEFAULT_AUTH_BASE_URL = "/api/auth";

// Set these when the backend runs somewhere other than the interface's own address.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
export const AUTH_BASE_URL = import.meta.env?.VITE_AUTH_BASE_URL || DEFAULT_AUTH_BASE_URL;
