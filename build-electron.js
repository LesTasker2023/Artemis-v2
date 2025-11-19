import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Build IPC handlers first (main.ts depends on it)
await esbuild.build({
  entryPoints: [path.join(__dirname, "src/infra/ipc/handlers.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  outfile: path.join(__dirname, "dist-electron/ipc-handlers.cjs"),
  sourcemap: true,
});

// Build main process
await esbuild.build({
  entryPoints: [path.join(__dirname, "electron/main.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  outfile: path.join(__dirname, "dist-electron/main.cjs"),
  sourcemap: true,
});

// Build preload script
await esbuild.build({
  entryPoints: [path.join(__dirname, "electron/preload.ts")],
  bundle: true,
  platform: "node",
  target: "node18",
  format: "cjs",
  external: ["electron", "better-sqlite3"],
  outfile: path.join(__dirname, "dist-electron/preload.cjs"),
  sourcemap: true,
});

console.log("✓ Electron main, preload, and IPC handlers built successfully");
