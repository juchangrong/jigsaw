import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@jigsaw/core": r("./packages/core/src/index.ts"),
      "@jigsaw/renderer": r("./packages/renderer/src/index.ts"),
      "@jigsaw/export": r("./packages/export/src/index.ts"),
      "@jigsaw/react": r("./packages/react/src/index.tsx"),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 60000,
  },
});
