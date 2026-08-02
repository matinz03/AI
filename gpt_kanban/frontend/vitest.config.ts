import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    exclude: ["e2e/**", "node_modules/**"],
  },
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
