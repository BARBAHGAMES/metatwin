import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import tsConfigPaths from "vite-tsconfig-paths";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

// Deliberately separate from vite.config.ts: that config's `tanstackStart`
// and `nitro` plugins exist to build/serve the app (route tree generation,
// Cloudflare Worker output) and pull in the full server entry — including
// the Supabase admin client — as a side effect. Unit tests only need the
// `@` path alias, so this lean config avoids that chain entirely instead of
// eating its startup cost and noise (a CJS/ESM interop crash from
// `@supabase/functions-js` and a lingering dev-server handle that stalled
// Vitest's process exit) on every run.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(rootDir, "src"),
    },
  },
  plugins: [tsConfigPaths({ projects: ["./tsconfig.json"] })],
  test: {
    environment: "node",
  },
});
