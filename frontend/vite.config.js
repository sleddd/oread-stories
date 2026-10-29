// Vite dev server, build and Vitest configuration for the Oread interface.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_SERVER_PORT = 5173;
// The backend's address during development. /api requests go there, so the interface and the API
// share one origin and the sign-in cookie works.
const BACKEND_ADDRESS = process.env.OREAD_BACKEND_URL || "http://127.0.0.1:4317";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: DEV_SERVER_PORT,
    strictPort: true,
    proxy: {
      "/api": { target: BACKEND_ADDRESS },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.{js,jsx}"],
  },
});
