import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@alphatrace/shared": new URL("./packages/shared/src/index.ts", import.meta.url).pathname,
      "@alphatrace/db": new URL("./packages/db/src/index.ts", import.meta.url).pathname
    }
  }
});
