// Vite dev server, build and Vitest configuration for the Oread interface.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const DEV_SERVER_PORT = 5173;

export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: DEV_SERVER_PORT, strictPort: true },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.js"],
    include: ["test/**/*.test.{js,jsx}"],
  },
});
