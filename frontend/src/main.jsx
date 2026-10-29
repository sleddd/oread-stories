// Web entry point: mounts the app into the page. In the built app it also installs the service
// worker, so Oread can be installed and opens offline; development skips it, where it would get
// in the way of live reloading.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.jsx";
import { registerServiceWorker } from "./platform/index.js";

const SERVICE_WORKER_PATH = "/sw.js";

if (import.meta.env.PROD) {
  registerServiceWorker(SERVICE_WORKER_PATH);
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
