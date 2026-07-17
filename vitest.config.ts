import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Résolution de l'alias "@" → racine du projet (tsconfig: "@/*" → "./*")
const rootDir = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(rootDir),
    },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Workers en process forks : les worker threads (pool par défaut)
    // déclenchent par intermittence l'assertion libuv UV_HANDLE_CLOSING
    // à la sortie du process sous Windows, ce qui casserait le prebuild.
    pool: "forks",
  },
});
