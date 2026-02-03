/**
 * Node.js runtime implementation
 *
 * Simplified implementation focusing only on platform-specific operations.
 */

import { spawn, type SpawnOptions } from "node:child_process";
import process from "node:process";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { CommandResult, CommandStream, CommandStreamChunk, Runtime } from "./types.ts";
import type { MiddlewareHandler } from "hono";
import { serveStatic } from "@hono/node-server/serve-static";
import { getPlatform } from "../utils/os.ts";

export class NodeRuntime implements Runtime {
  async findExecutable(name: string): Promise<string[]> {
    const platform = getPlatform();
    const candidates: string[] = [];

    if (platform === "windows") {
      // Try multiple possible executable names on Windows
      const executableNames = [
        name,
        `${name}.exe`,
        `${name}.cmd`,
        `${name}.bat`,
      ];

      for (const execName of executableNames) {
        const result = await this.runCommand("where", [execName]);
        if (result.success && result.stdout.trim()) {
          // where command can return multiple paths, split by newlines
          const paths = result.stdout
            .trim()
            .split("\n")
            .map((p) => p.trim())
            .filter((p) => p);
          candidates.push(...paths);
        }
      }
    } else {
      // Unix-like systems (macOS, Linux)
      const result = await this.runCommand("which", [name]);
      if (result.success && result.stdout.trim()) {
        candidates.push(result.stdout.trim());
      }
    }

    return candidates;
  }

  runCommand(
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string },
  ): Promise<CommandResult> {
    return new Promise((resolve) => {
      const isWindows = getPlatform() === "windows";
      const spawnOptions: SpawnOptions = {
        stdio: ["ignore", "pipe", "pipe"],
        env: options?.env ? { ...process.env, ...options.env } : process.env,
        cwd: options?.cwd,
      };

      // On Windows, always use cmd.exe /c for all commands
      let actualCommand = command;
      let actualArgs = args;

      if (isWindows) {
        actualCommand = "cmd.exe";
        actualArgs = ["/c", command, ...args];
      }

      const child = spawn(actualCommand, actualArgs, spawnOptions);

      const textDecoder = new TextDecoder();
      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (data: Uint8Array) => {
        stdout += textDecoder.decode(data, { stream: true });
      });

      child.stderr?.on("data", (data: Uint8Array) => {
        stderr += textDecoder.decode(data, { stream: true });
      });

      child.on("close", (code: number | null) => {
        resolve({
          success: code === 0,
          code: code ?? 1,
          stdout,
          stderr,
        });
      });

      child.on("error", (error: Error) => {
        resolve({
          success: false,
          code: 1,
          stdout: "",
          stderr: error.message,
        });
      });
    });
  }

  runCommandStream(
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string; signal?: AbortSignal },
  ): CommandStream {
    const platform = getPlatform();
    const spawnOptions: SpawnOptions = {
      stdio: ["ignore", "pipe", "pipe"],
      env: options?.env ? { ...process.env, ...options.env } : process.env,
      cwd: options?.cwd,
    };

    const commandResult = platform === "windows"
      ? { cmd: "cmd.exe", args: ["/c", command, ...args] }
      : { cmd: command, args };

    const child = spawn(commandResult.cmd, commandResult.args, spawnOptions);
    const decoder = new TextDecoder();
    const queue: CommandStreamChunk[] = [];
    const waiters: Array<(value: IteratorResult<CommandStreamChunk>) => void> = [];
    let ended = false;

    const push = (item: CommandStreamChunk) => {
      const waiter = waiters.shift();
      if (waiter) {
        waiter({ value: item, done: false });
        return;
      }
      queue.push(item);
    };

    const finish = () => {
      ended = true;
      while (waiters.length) {
        const waiter = waiters.shift();
        if (waiter) waiter({ value: undefined as unknown as CommandStreamChunk, done: true });
      }
    };

    child.stdout?.on("data", (data: Uint8Array) => {
      push({ source: "stdout", text: decoder.decode(data, { stream: true }) });
    });

    child.stderr?.on("data", (data: Uint8Array) => {
      push({ source: "stderr", text: decoder.decode(data, { stream: true }) });
    });

    const exit = new Promise<number>((resolve) => {
      child.on("close", (code: number | null) => {
        finish();
        resolve(code ?? 1);
      });
      child.on("error", () => {
        finish();
        resolve(1);
      });
    });

    if (options?.signal) {
      if (options.signal.aborted) child.kill();
      options.signal.addEventListener("abort", () => child.kill(), {
        once: true,
      });
    }

    const stream: AsyncIterable<CommandStreamChunk> = {
      [Symbol.asyncIterator]() {
        return {
          next(): Promise<IteratorResult<CommandStreamChunk>> {
            if (queue.length > 0) {
              return Promise.resolve({ value: queue.shift()!, done: false });
            }
            if (ended) {
              return Promise.resolve({ value: undefined as unknown as CommandStreamChunk, done: true });
            }
            return new Promise((resolve) => {
              waiters.push(resolve);
            });
          },
        };
      },
    };

    return {
      stream,
      kill: () => child.kill(),
      exit,
    };
  }

  serve(
    port: number,
    hostname: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void {
    // Use Hono with Node.js server to handle Web API Request/Response
    const app = new Hono();

    // Route all requests to the provided handler
    app.all("*", async (c) => {
      const response = await handler(c.req.raw);
      return response;
    });

    // Start the server using @hono/node-server
    serve({
      fetch: app.fetch,
      port,
      hostname,
    });

    console.log(`Listening on http://${hostname}:${port}/`);
  }

  createStaticFileMiddleware(options: { root: string }): MiddlewareHandler {
    return serveStatic(options);
  }
}
