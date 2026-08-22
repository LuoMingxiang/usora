import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/*.test.mjs"],
    testTimeout: 15_000,
  },
});
