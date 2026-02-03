import { Context } from "hono";
import type { HistoryListResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import { getPlatform } from "../utils/os.ts";

/**
 * Handles GET /api/projects/:encodedProjectName/histories requests
 * Fetches conversation history list for a specific project
 * @param c - Hono context object with config variables
 * @returns JSON response with conversation history list
 */
export async function handleHistoriesRequest(c: Context) {
  try {
    const encodedProjectName = c.req.param("encodedProjectName");

    if (!encodedProjectName) {
      return c.json({ error: "Encoded project name is required" }, 400);
    }
    const queryPath = c.req.query("path");
    const filterPath = queryPath ? decodeURIComponent(queryPath) : null;
    const normalize = (value: string) => {
      const normalized = value.replace(/\\/g, "/").replace(/\/+$/, "");
      return getPlatform() === "windows" ? normalized.toLowerCase() : normalized;
    };
    const target = filterPath ? normalize(filterPath) : null;
    const sessionCwd = filterPath ?? process.cwd();

    const { runtime, opencodePath } = c.var.config;
    const result = await runtime.runCommand(
      opencodePath,
      ["session", "list", "--format", "json"],
      { cwd: sessionCwd },
    );

    if (!result.success || !result.stdout.trim()) {
      const response: HistoryListResponse = {
        conversations: [],
        debug: {
          count: 0,
          cwd: sessionCwd,
          opencodePath,
          rawHead: result.stdout.trim().slice(0, 200),
          stderrHead: result.stderr.trim().slice(0, 200),
          code: result.code,
        },
      };
      return c.json(response);
    }

    const cleanOutput = (() => {
      const trimmed = result.stdout.trim().replace(/^\uFEFF/, "");
      const firstBracket = trimmed.indexOf("[");
      const lastBracket = trimmed.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
        return trimmed.slice(firstBracket, lastBracket + 1);
      }
      return trimmed;
    })();

    const parsedOutput = cleanOutput.replace(/,\s*([}\]])/g, "$1");

    const parse = (() => {
      try {
        const parsed = JSON.parse(parsedOutput) as unknown;
        const list = Array.isArray(parsed)
          ? parsed
          : typeof parsed === "object" && parsed !== null && Array.isArray((parsed as { sessions?: unknown }).sessions)
            ? (parsed as { sessions: unknown[] }).sessions
            : [];
        return {
          data: list as Array<Record<string, unknown>>,
          error: undefined as string | undefined,
          type: Array.isArray(parsed) ? "array" : typeof parsed,
        };
      } catch (error) {
        logger.history.error("Failed to parse session list: {error}", { error });
        return {
          data: [] as Array<Record<string, unknown>>,
          error: error instanceof Error ? error.message : String(error),
          type: "error",
        };
      }
    })();

    const sessions = parse.data;

    const mapped = sessions.map((session) => {
      const getValue = (keys: string[]) => {
        for (const key of keys) {
          if (key in session) return session[key] as unknown;
        }
        return undefined;
      };

      const id = getValue(["id", "ID", "会话ID", "会话Id"]);
      const title = getValue(["title", "标题", "名称"]);
      const updated = getValue(["updated", "更新", "更新时间"]);
      const created = getValue(["created", "已创建", "创建", "创建时间"]);
      const directory = getValue(["directory", "目录", "路径", "工作目录"]);
      const projectId = getValue(["projectId", "项目ID", "项目Id"]);

      return {
        id: typeof id === "string" ? id : "",
        title: typeof title === "string" ? title : "",
        updated: typeof updated === "number" ? updated : Number(updated),
        created: typeof created === "number" ? created : Number(created),
        directory: typeof directory === "string" ? directory : undefined,
        projectId: typeof projectId === "string" ? projectId : undefined,
      };
    });

    const hasDirectory = mapped.some((session) => Boolean(session.directory));
    const filtered = target && hasDirectory
      ? mapped.filter((session) => {
          if (!session.directory) return false;
          return normalize(session.directory) === target;
        })
      : mapped;

    const limited = target && hasDirectory ? filtered : mapped;

    const sorted = [...limited]
      .filter((session) => session.id)
      .sort((a, b) => (b.updated || 0) - (a.updated || 0));

    const updatedValues = sorted.map((session) => session.updated).filter((value) => typeof value === "number");
    const newest = updatedValues.length > 0 ? Math.max(...updatedValues) : undefined;
    const oldest = updatedValues.length > 0 ? Math.min(...updatedValues) : undefined;

    const response: HistoryListResponse = {
      conversations: sorted.map((session) => ({
        sessionId: session.id,
        startTime: new Date(session.created).toISOString(),
        lastTime: new Date(session.updated).toISOString(),
        messageCount: 0,
        lastMessagePreview: session.directory
          ? `${session.title} • ${session.directory}`
          : session.title || "",
      })),
      debug: {
        count: sorted.length,
        newest,
        oldest,
        cwd: sessionCwd,
        opencodePath,
        sampleDirs: sorted.slice(0, 5).map((session) => session.directory || ""),
        rawHead: parsedOutput.trim().slice(0, 200),
        stderrHead: result.stderr.trim().slice(0, 200),
        code: result.code,
        parseError: parse.error,
        dataLen: sessions.length,
        dataType: parse.type,
        firstKeys: sessions[0]
          ? Object.keys(sessions[0]).slice(0, 10).join(",")
          : "",
      },
    };
    return c.json(response);
  } catch (error) {
    logger.history.error("Error fetching conversation histories: {error}", {
      error,
    });

    return c.json(
      {
        error: "Failed to fetch conversation histories",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
