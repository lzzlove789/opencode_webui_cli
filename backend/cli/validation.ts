import type { Runtime } from "../runtime/types.ts";
import process from "node:process";
import type { Runtime } from "../runtime/types.ts";
import { logger } from "../utils/logger.ts";
import { exit } from "../utils/os.ts";

export async function validateOpencodeCli(
  runtime: Runtime,
  opencodePath?: string,
): Promise<string> {
  const candidates = opencodePath
    ? [opencodePath]
    : await runtime.findExecutable("opencode");

  if (candidates.length === 0) {
    logger.cli.error("❌ opencode CLI not found in PATH");
    logger.cli.error("   Please install opencode and ensure it is in PATH.");
    exit(1);
  }

  const normalize = (value: string) => value.replace(/\\/g, "/").toLowerCase();
  const cwd = normalize(process.cwd());
  const preferred = candidates.filter((candidate) => {
    const normalized = normalize(candidate);
    if (normalized.includes("/node_modules/")) return false;
    if (normalized.startsWith(cwd + "/")) return false;
    return true;
  });
  const opencode = (preferred[0] ?? candidates[0]) as string;
  const versionResult = await runtime.runCommand(opencode, ["--version"]);

  if (!versionResult.success) {
    logger.cli.error("❌ opencode CLI check failed");
    logger.cli.error(versionResult.stderr || "Unknown error");
    exit(1);
  }

  logger.cli.info(`✅ opencode CLI found: ${versionResult.stdout.trim()}`);
  return opencode;
}
