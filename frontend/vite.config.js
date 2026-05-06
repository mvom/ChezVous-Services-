import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    plugins: [react()],
    server: {
        port: 5500,
        host: "0.0.0.0",
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        coverage: {
            provider: "v8",
            all: false,
            include: [
                "src/**/*.ts",
                "src/**/*.tsx",
            ],
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
            thresholds: {
                statements: 80,
                branches: 80,
                functions: 80,
                lines: 80,
                perFile: false,
            },
        },
    },
});
