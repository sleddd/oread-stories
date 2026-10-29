import { API_BASE_URL } from "../config.js";
import { createApiClient } from "./createApiClient.js";

export { ApiError } from "./ApiError.js";
export { createApiClient };

export const apiClient = createApiClient({ baseUrl: API_BASE_URL });
