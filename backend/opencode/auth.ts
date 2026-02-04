import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";

type AuthInfo =
  | { type: "api"; key: string }
  | { type: "oauth"; access: string; refresh: string; expires: number }
  | { type: "wellknown"; key: string; token: string };

function resolveDataHome() {
  if (process.env.XDG_DATA_HOME) return process.env.XDG_DATA_HOME;
  if (process.platform === "win32") {
    return process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming");
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support");
  }
  return path.join(os.homedir(), ".local", "share");
}

function getAuthPath() {
  const dataHome = resolveDataHome();
  return path.join(dataHome, "opencode", "auth.json");
}

async function readAuthFile() {
  const filepath = getAuthPath();
  try {
    const data = await fs.readFile(filepath, "utf8");
    return JSON.parse(data) as Record<string, AuthInfo>;
  } catch {
    return {} as Record<string, AuthInfo>;
  }
}

async function writeAuthFile(data: Record<string, AuthInfo>) {
  const filepath = getAuthPath();
  await fs.mkdir(path.dirname(filepath), { recursive: true });
  await fs.writeFile(filepath, JSON.stringify(data, null, 2), { mode: 0o600 });
}

export async function setApiKey(providerID: string, key: string) {
  const data = await readAuthFile();
  data[providerID] = { type: "api", key };
  await writeAuthFile(data);
}
