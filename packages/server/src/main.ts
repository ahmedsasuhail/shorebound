/**
 * Starts the local Shorebound server.
 * Development: `npm run dev` (Vite serves the UI on :5173 and proxies /api here).
 * Production:  `npm run build && npm start` (this server also serves the built UI on :8787).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { openDb } from "./db.js";
import { appDataDir } from "./paths.js";

const appData = appDataDir();
const db = openDb(join(appData, "shorebound.db"));
// Same depth from src/ (dev, via tsx) and dist/ (production build).
const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
const webDir = fileURLToPath(new URL("../../../apps/web/dist", import.meta.url));
const port = Number(process.env.PORT ?? 8787);

const app = buildApp({ db, appData, dataDir, webDir: existsSync(webDir) ? webDir : undefined });

const shutdown = async () => {
  await app.close();
  db.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Local only: never listen on a public interface.
await app.listen({ port, host: "127.0.0.1" });
console.log(`Shorebound running on http://127.0.0.1:${port}`);
console.log(`  data folder: ${appData}`);
if (!existsSync(webDir)) console.log("  (API only: run `npm run dev` for the UI, or `npm run build` first)");
