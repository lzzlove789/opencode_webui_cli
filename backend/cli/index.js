#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

function run() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const tsxCli = path.resolve(
    __dirname,
    "../../node_modules/tsx/dist/cli.mjs",
  );
  const entry = path.resolve(__dirname, "node.ts");
  const args = [tsxCli, entry, ...process.argv.slice(2)];

  const child = spawn(process.execPath, args, { stdio: "inherit" });

  child.on("exit", (code) => {
    process.exit(code ?? 1);
  });

  child.on("error", (error) => {
    console.error("Failed to start opencode webui:", error);
    process.exit(1);
  });
}

run();
