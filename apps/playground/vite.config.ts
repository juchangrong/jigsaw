import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@jigsaw/core": r("../../packages/core/src/index.ts"),
      "@jigsaw/renderer": r("../../packages/renderer/src/index.ts"),
      "@jigsaw/export": r("../../packages/export/src/index.ts"),
      "@jigsaw/react": r("../../packages/react/src/index.tsx"),
    },
  },
  server: { port: 5173 },
});
