import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/integration/*.test.ts", "test/unit/*.test.ts"],
    testTimeout: 15_000,
  },
});
