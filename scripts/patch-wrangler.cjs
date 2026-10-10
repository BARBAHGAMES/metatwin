// Patches .output/server/wrangler.json before each Cloudflare deploy:
// 1. Sets compatibility_date to yesterday (Cloudflare rejects today's date in UTC)
// 2. Injects required env vars so process.env works inside the Worker
//
// Adapted from barbah-games-platform's scripts/patch-wrangler.cjs.

const fs = require("fs");
const path = require("path");

function parseEnvFile(filePath) {
  const parsed = {};
  if (!fs.existsSync(filePath)) return parsed;
  fs.readFileSync(filePath, "utf8")
    .split("\n")
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;
      const eq = trimmed.indexOf("=");
      if (eq === -1) return;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      parsed[key] = val;
    });
  return parsed;
}

const envPath = path.resolve(__dirname, "../.env");
const envVars = parseEnvFile(envPath);

// ONLY non-sensitive config belongs here. SUPABASE_SERVICE_ROLE_KEY,
// RESEND_API_KEY and SUPABASE_WEBHOOK_SECRET are true secrets and must be set
// as encrypted wrangler secrets instead (survive deploys untouched):
//   npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY --name metatwin
//   npx wrangler secret put RESEND_API_KEY --name metatwin
//   npx wrangler secret put SUPABASE_WEBHOOK_SECRET --name metatwin
const REQUIRED = ["SUPABASE_URL", "VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
for (const k of REQUIRED) {
  if (process.env[k]) envVars[k] = process.env[k];
}
const missing = REQUIRED.filter((k) => !envVars[k]);
if (missing.length) {
  console.error(
    "✗ patch-wrangler: missing required env var(s): " +
      missing.join(", ") +
      " (set in .env or your deploy environment)",
  );
  process.exit(1);
}

const wranglerPath = path.resolve(__dirname, "../.output/server/wrangler.json");
const config = JSON.parse(fs.readFileSync(wranglerPath, "utf8"));

const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
config.compatibility_date = yesterday.toISOString().slice(0, 10);

// Nitro auto-derives the Worker name from the git remote (ends up
// "barbahgames-metatwin", since the repo lives under the BARBAHGAMES org) —
// pin it to the plain product name instead.
config.name = "metatwin";

// Cloudflare Workers vars are fully replaced (not merged) on every deploy, so
// any plain var not re-injected here disappears silently on the next deploy.
config.vars = {
  ...(config.vars || {}),
  SUPABASE_URL: envVars.SUPABASE_URL,
  VITE_SUPABASE_URL: envVars.VITE_SUPABASE_URL,
  VITE_SUPABASE_PUBLISHABLE_KEY: envVars.VITE_SUPABASE_PUBLISHABLE_KEY,
};

config.upload_source_maps = true;
config.observability = {
  ...(config.observability || {}),
  enabled: true,
  head_sampling_rate: 1,
};

fs.writeFileSync(wranglerPath, JSON.stringify(config, null, 2));
console.log("✓ Patched wrangler.json — compatibility_date:", config.compatibility_date);
console.log("  vars set:", Object.keys(config.vars).join(", "));
