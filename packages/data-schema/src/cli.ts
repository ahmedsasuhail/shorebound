import { fileURLToPath } from "node:url";
import { loadData } from "./load.js";

const dataDir = fileURLToPath(new URL("../../../data", import.meta.url));
try {
  const { countries } = loadData(dataDir);
  console.log(`data OK (${countries.size} countries: ${[...countries.keys()].join(", ")})`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
