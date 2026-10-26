import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@shared": path.resolve(__dirname, "src/shared") },
  },
  test: {
    include: ["src/**/*.test.ts", "web/src/**/*.test.ts"],
    setupFiles: ["test/setup.ts"],
    environment: "node",
  },
});
