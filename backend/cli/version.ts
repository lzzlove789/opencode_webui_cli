import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const packagePath = path.resolve(__dirname, "../../package.json");

let version = "0.0.0";

try {
  const raw = fs.readFileSync(packagePath, "utf-8");
  const data = JSON.parse(raw) as { version?: string };
  if (data.version) {
    version = data.version;
  }
} catch {
  // Keep default version
}

export const VERSION = version;
