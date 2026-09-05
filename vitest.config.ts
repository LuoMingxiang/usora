import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@usora/integration": fileURLToPath(new URL("./packages/integration/src/index.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/integration/*.test.ts"],
    testTimeout: 15_000,
  },
});
