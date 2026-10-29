// Starts the backend API and the frontend dev server together. Ctrl+C stops both.
import { spawn } from "node:child_process";

const SERVICES = [
  { label: "api", directory: "backend", script: "src/server.js" },
  { label: "web", directory: "frontend", script: "node_modules/vite/bin/vite.js" },
];

function prefixOutput(label, stream) {
  stream.on("data", (chunk) => process.stdout.write(`[${label}] ${chunk}`));
}

function startService(service) {
  const workingDirectory = new URL(`../${service.directory}/`, import.meta.url);
  const child = spawn(process.execPath, [service.script], {
    cwd: workingDirectory,
    stdio: ["ignore", "pipe", "pipe"],
  });
  prefixOutput(service.label, child.stdout);
  prefixOutput(service.label, child.stderr);
  child.on("exit", (exitCode) => {
    console.log(`[${service.label}] exited (${exitCode})`);
    process.exit(exitCode ?? 0);
  });
  return child;
}

const children = SERVICES.map(startService);

process.on("SIGINT", () => {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
});
