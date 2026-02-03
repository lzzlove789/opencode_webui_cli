import { Context } from "hono";
import { convertExportMessages } from "../opencode/history.ts";
import { logger } from "../utils/logger.ts";

/**
 * Handles GET /api/projects/:encodedProjectName/histories/:sessionId requests
 * Retrieves detailed conversation history for a specific session
 * @param c - Hono context object with config variables
 * @returns JSON response with conversation details
 */
export async function handleConversationRequest(c: Context) {
  try {
    const encodedProjectName = c.req.param("encodedProjectName");
    const sessionId = c.req.param("sessionId");

    if (!encodedProjectName) {
      return c.json({ error: "Encoded project name is required" }, 400);
    }

    if (!sessionId) {
      return c.json({ error: "Session ID is required" }, 400);
    }

    const queryPath = c.req.query("path");
    const sessionCwd = queryPath ? decodeURIComponent(queryPath) : process.cwd();
    const { runtime, opencodePath } = c.var.config;
    const result = await runtime.runCommand(
      opencodePath,
      ["export", sessionId],
      { cwd: sessionCwd },
    );

    if (!result.success || !result.stdout.trim()) {
      return c.json({ error: "Conversation not found", sessionId }, 404);
    }

    const exportData = JSON.parse(result.stdout) as {
      info: { time?: { created?: number; updated?: number } };
      messages: Array<{ info: { sessionID?: string; time?: { created?: number } }; parts: any[] }>;
    };

    const messages = convertExportMessages(exportData.messages as any[]);
    const startTime = exportData.info.time?.created
      ? new Date(exportData.info.time.created).toISOString()
      : new Date().toISOString();
    const endTime = exportData.info.time?.updated
      ? new Date(exportData.info.time.updated).toISOString()
      : new Date().toISOString();

    const conversationHistory = {
      sessionId,
      messages,
      metadata: {
        startTime,
        endTime,
        messageCount: messages.length,
      },
    };

    return c.json(conversationHistory);
  } catch (error) {
    logger.history.error("Error fetching conversation details: {error}", {
      error,
    });

    return c.json(
      {
        error: "Failed to fetch conversation details",
        details: error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
