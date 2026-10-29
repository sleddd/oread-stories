// Runtime configuration for the interface.

const DEFAULT_API_BASE_URL = "http://127.0.0.1:4317/api/v1";

// Set VITE_API_BASE_URL when the backend runs somewhere other than the default address.
export const API_BASE_URL = import.meta.env?.VITE_API_BASE_URL || DEFAULT_API_BASE_URL;
