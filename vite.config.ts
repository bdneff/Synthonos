import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tauri expects a fixed port in dev and a static build in dist/.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: "es2022",
    outDir: "dist",
  },
  worker: {
    // The engine worklet is loaded via audioWorklet.addModule, which treats
    // the script as an ES module; the default iife worker format also works
    // there, but es keeps it honest.
    format: "es",
  },
  test: {
    include: ["test/**/*.test.ts"],
    environment: "node",
  },
});
