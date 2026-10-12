import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";
import { nitro } from "nitro/vite";
import tsConfigPaths from "vite-tsconfig-paths";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => {
  const loadedEnv = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(loadedEnv)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  return {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: {
        "@": path.resolve(rootDir, "src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
    server: {
      host: "::",
      port: 8080,
    },
    build: {
      sourcemap: "hidden",
      // `cloudflare:workers` is a Workers-runtime built-in (used server-side
      // to reach the env.AI binding reliably) — it doesn't exist as an npm
      // package, so it must be externalized rather than bundled.
      rolldownOptions: {
        external: [/^cloudflare:/],
      },
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
      }),
      nitro({
        // Deploys as a Cloudflare Worker — keeps `npm run deploy` ->
        // .output/server/wrangler.json working.
        defaultPreset: "cloudflare-module",
      }),
      viteReact(),
    ],
  };
});
