/**
 * Deno runtime implementation
 *
 * Simplified implementation focusing only on platform-specific operations.
 */

import type {
  CommandResult,
  CommandStream,
  CommandStreamChunk,
  Runtime,
} from "./types.ts";
import type { MiddlewareHandler } from "hono";
import { serveStatic } from "hono/deno";
import { getPlatform } from "../utils/os.ts";

export class DenoRuntime implements Runtime {
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

  async runCommand(
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string },
  ): Promise<CommandResult> {
    const platform = getPlatform();

    // On Windows, always use cmd.exe /c for all commands
    let actualCommand = command;
    let actualArgs = args;

    if (platform === "windows") {
      actualCommand = "cmd.exe";
      actualArgs = ["/c", command, ...args];
    }

    const cmd = new Deno.Command(actualCommand, {
      args: actualArgs,
      stdout: "piped",
      stderr: "piped",
      env: options?.env,
      cwd: options?.cwd,
    });

    const result = await cmd.output();

    return {
      success: result.success,
      code: result.code,
      stdout: new TextDecoder().decode(result.stdout),
      stderr: new TextDecoder().decode(result.stderr),
    };
  }

  runCommandStream(
    command: string,
    args: string[],
    options?: { env?: Record<string, string>; cwd?: string; signal?: AbortSignal },
  ): CommandStream {
    const platform = getPlatform();
    const commandResult = platform === "windows"
      ? { cmd: "cmd.exe", args: ["/c", command, ...args] }
      : { cmd: command, args };

    const proc = new Deno.Command(commandResult.cmd, {
      args: commandResult.args,
      stdout: "piped",
      stderr: "piped",
      env: options?.env,
      cwd: options?.cwd,
    }).spawn();

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

    const pump = async (reader: ReadableStreamDefaultReader<Uint8Array>, source: "stdout" | "stderr") => {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        if (result.value) push({ source, text: decoder.decode(result.value, { stream: true }) });
      }
    };

    void pump(proc.stdout.getReader(), "stdout");
    void pump(proc.stderr.getReader(), "stderr");

    const exit = proc.status.then((status) => {
      finish();
      return status.code;
    });

    if (options?.signal) {
      if (options.signal.aborted) proc.kill();
      options.signal.addEventListener("abort", () => proc.kill(), { once: true });
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
      kill: () => proc.kill(),
      exit,
    };
  }

  serve(
    port: number,
    hostname: string,
    handler: (req: Request) => Response | Promise<Response>,
  ): void {
    Deno.serve({ port, hostname }, handler);
  }

  createStaticFileMiddleware(options: { root: string }): MiddlewareHandler {
    return serveStatic(options);
  }
}
