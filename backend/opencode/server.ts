import type { AppConfig } from "../types.ts";
import type { CommandStream } from "../runtime/types.ts";

const DEFAULT_SERVER_HOST = "127.0.0.1";
const DEFAULT_SERVER_PORT = "4096";
const HEALTH_PATH = "/health";
const START_TIMEOUT_MS = 30000;
const START_POLL_MS = 250;

type ServerState = {
  url: string;
  process?: CommandStream;
  starting?: Promise<string>;
  external: boolean;
};

const host = process.env.OPENCODE_SERVER_HOST || DEFAULT_SERVER_HOST;
const port = process.env.OPENCODE_SERVER_PORT || DEFAULT_SERVER_PORT;
const url = process.env.OPENCODE_SERVER_URL || `http://${host}:${port}`;

const state: ServerState = {
  url,
  external: Boolean(process.env.OPENCODE_SERVER_URL),
};

async function isHealthy(url: string) {
  try {
    const response = await fetch(new URL(HEALTH_PATH, url));
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForHealth(url: string) {
  const start = Date.now();
  while (Date.now() - start < START_TIMEOUT_MS) {
    if (await isHealthy(url)) return true;
    await new Promise((resolve) => setTimeout(resolve, START_POLL_MS));
  }
  return false;
}

async function startServer(config: AppConfig) {
  const args = [
    "serve",
    "--hostname",
    host,
    "--port",
    port,
  ];
  const stream = config.runtime.runCommandStream(config.opencodePath, args, {
    env: process.env as Record<string, string>,
  });
  state.process = stream;
  (async () => {
    for await (const _ of stream.stream) {
      // drain output
    }
  })();
  const ready = await waitForHealth(state.url);
  if (!ready) {
    state.process = undefined;
    throw new Error("opencode server failed to start");
  }
  return state.url;
}

export async function ensureOpencodeServer(config: AppConfig) {
  const url = state.url;
  if (await isHealthy(url)) return url;

  if (state.external) {
    throw new Error("opencode server is not reachable");
  }

  if (state.starting) return state.starting;

  const starter = startServer(config).finally(() => {
    state.starting = undefined;
  });
  state.starting = starter;
  return starter;
}

export async function restartOpencodeServer(config: AppConfig) {
  if (state.external) return;

  if (state.process) {
    try {
      state.process.kill();
    } catch {
      // ignore
    }
    state.process = undefined;
  }

  state.starting = undefined;
  await ensureOpencodeServer(config);
}
