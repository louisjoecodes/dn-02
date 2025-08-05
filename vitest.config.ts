import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    onConsoleLog: (log: string, type: "stdout" | "stderr") => {
      // Filter out React act() warnings
      if (
        type === "stderr" &&
        log.includes("Warning: An update to") &&
        log.includes("was not wrapped in act")
      ) {
        return false;
      }
      return true;
    },
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData/*",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
