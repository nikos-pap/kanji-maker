import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  base: "./",
  publicDir: false,
  build: { outDir: "docs", emptyOutDir: true, assetsInlineLimit: 0 },
  test: { include: ["tests/unit/**/*.test.ts"] },
});
