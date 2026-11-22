import { homedir } from "node:os";
import { join } from "node:path";

/** Per-user app-data folder. Never inside the repo. Override with SHOREBOUND_HOME. */
export function appDataDir(env: NodeJS.ProcessEnv = process.env, platform = process.platform): string {
  if (env.SHOREBOUND_HOME) return env.SHOREBOUND_HOME;
  if (platform === "win32") return join(env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Shorebound");
  if (platform === "darwin") return join(homedir(), "Library", "Application Support", "Shorebound");
  return join(env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), "shorebound");
}
