import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      all: false,
      exclude: [
        "**/src/main.tsx",
        "**/src/types.ts",
        "**/src/vite-env.d.ts",
        "**/*.d.ts",
        "**/node_modules/**",
        "**/dist/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/test/**",
      ],
    },
  },
});
