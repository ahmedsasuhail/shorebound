import { fileURLToPath } from "node:url";
import { buildApp } from "./app.js";
import { openDb } from "./db.js";
import { appDataDir } from "./paths.js";
import { join } from "node:path";

const appData = appDataDir();
const db = openDb(join(appData, "shorebound.db"));
const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
const port = Number(process.env.PORT ?? 8787);

const app = buildApp({ db, appData, dataDir });
// Local only: never listen on a public interface.
await app.listen({ port, host: "127.0.0.1" });
console.log(`Shorebound API on http://127.0.0.1:${port}  (data: ${appData})`);
