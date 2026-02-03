import path from "node:path";
import { exists, mkdirp, readTextFile, stat, writeTextFile } from "../utils/fs.ts";
import { getHomeDir } from "../utils/os.ts";

const STORE_DIR = ".opencode-webui";
const STORE_FILE = "projects.json";

function getStorePath() {
  const home = getHomeDir();
  if (home) return path.join(home, STORE_DIR, STORE_FILE);
  return path.join(process.cwd(), STORE_FILE);
}

function parseProjects(raw: string) {
  return raw
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function normalizeProjectPath(input: string) {
  return path.resolve(input).replace(/\\/g, "/");
}

export async function loadProjects(): Promise<string[]> {
  const fromEnv = parseProjects(process.env.OPENCODE_PROJECTS || "").map(
    normalizeProjectPath,
  );
  const storePath = getStorePath();
  if (!(await exists(storePath))) return fromEnv;

  const content = await readTextFile(storePath).catch(() => "");
  if (!content) return fromEnv;

  const stored = (() => {
    try {
      const data = JSON.parse(content) as { projects?: string[] };
      return Array.isArray(data.projects) ? data.projects : [];
    } catch {
      return [];
    }
  })();

  const combined = [...fromEnv, ...stored.map(normalizeProjectPath)];
  return Array.from(new Set(combined));
}

export async function resolveProjectPath(encodedName: string): Promise<string | null> {
  const projects = await loadProjects();
  const fallback = (() => {
    if (typeof process !== "undefined" && typeof process.cwd === "function") {
      return process.cwd();
    }
    if (typeof Deno !== "undefined" && typeof Deno.cwd === "function") {
      return Deno.cwd();
    }
    return "/";
  })();
  const resolved = projects.length > 0 ? projects : [fallback];
  if (!encodedName) return null;
  const match = /^project-(\d+)$/.exec(encodedName);
  if (!match) return null;
  const index = Number(match[1]);
  if (!Number.isFinite(index) || index <= 0) return null;
  return resolved[index - 1] ?? null;
}

export async function addProject(options: {
  path: string;
  create: boolean;
}): Promise<string> {
  const target = normalizeProjectPath(options.path);
  const info = await exists(target) ? await stat(target) : null;

  if (!info && options.create) {
    await mkdirp(target);
  }

  if (!info && !options.create) {
    throw new Error("Project path does not exist");
  }

  if (info && !info.isDirectory) {
    throw new Error("Project path is not a directory");
  }

  const storePath = getStorePath();
  const storeDir = path.dirname(storePath);
  if (!(await exists(storeDir))) {
    await mkdirp(storeDir);
  }

  const projects = await loadProjects();
  const updated = projects.includes(target) ? projects : [...projects, target];
  await writeTextFile(storePath, JSON.stringify({ projects: updated }, null, 2));
  return target;
}
