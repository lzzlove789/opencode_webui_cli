import { Context } from "hono";
import { Context } from "hono";
import type { ChatRequest, StreamResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";
import type { RequestState } from "../opencode/request.ts";
import {
  createAssistantMessage,
  createInitMessage,
  createResultMessage,
  createTextItem,
  createToolResultItem,
  createToolUseItem,
  createUserMessage,
} from "../opencode/claudeFormat.ts";

type CliEvent = {
  type?: string;
  timestamp?: number;
  sessionID?: string;
  part?: any;
  error?: unknown;
};

const PERMISSION_ALLOW_ALL = JSON.stringify({ "*": "allow" });

const encoder = new TextEncoder();

function getEventSession(event: CliEvent, fallback?: string) {
  if (event.sessionID && typeof event.sessionID === "string") return event.sessionID;
  return fallback;
}

function createToolUseResult(part: any) {
  const output = part?.state?.status === "error"
    ? part?.state?.error ?? ""
    : part?.state?.output ?? "";
  if (part?.tool === "bash") {
    return {
      stdout: output,
      stderr: "",
      interrupted: false,
      isImage: false,
    };
  }
  if (part?.state?.metadata) return part.state.metadata;
  return { output };
}

function enqueueResponse(
  controller: ReadableStreamDefaultController,
  payload: StreamResponse,
) {
  controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
}

/**
 * Handles POST /api/chat requests with streaming responses
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Shared map of abort controllers
 * @returns Response with streaming NDJSON
 */
export async function handleChatRequest(
  c: Context,
  requestAbortControllers: Map<string, RequestState>,
) {
  const chatRequest: ChatRequest = await c.req.json();
  const { opencodePath, runtime } = c.var.config;
  const { opencodeModel } = c.var.config;

  logger.chat.debug(
    "Received chat request {*}",
    chatRequest as unknown as Record<string, unknown>,
  );

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const workingDirectory = chatRequest.workingDirectory;
        const abortController = new AbortController();
        const requestState: RequestState = {
          abortController,
          workingDirectory,
        };
        requestAbortControllers.set(chatRequest.requestId, requestState);

        const args = ["run", "--format", "json"];
        if (opencodeModel) {
          args.push("--model", opencodeModel);
        }
        if (chatRequest.sessionId) {
          args.push("--session", chatRequest.sessionId);
        }
        args.push(chatRequest.message);

        const env = {
          OPENCODE_PERMISSION: PERMISSION_ALLOW_ALL,
          OPENCODE_CLIENT: "cli",
        };

        const process = runtime.runCommandStream(opencodePath, args, {
          env,
          cwd: workingDirectory,
          signal: abortController.signal,
        });

        requestState.kill = process.kill;

        let sessionId = chatRequest.sessionId;
        let initSent = false;
        const startTime = Date.now();
        let errorText = "";
        let stderrText = "";

        const sendInit = (resolvedSessionId: string) => {
          if (initSent) return;
          enqueueResponse(controller, {
            type: "claude_json",
            data: createInitMessage({
              sessionId: resolvedSessionId,
              cwd: workingDirectory ?? "",
              permissionMode: chatRequest.permissionMode ?? "default",
              tools: [],
            }),
          });
          initSent = true;
        };

        const handleEvent = (event: CliEvent) => {
          const resolvedSessionId = getEventSession(event, sessionId);
          if (resolvedSessionId && !sessionId) {
            sessionId = resolvedSessionId;
            requestState.sessionId = resolvedSessionId;
          }
          if (resolvedSessionId) sendInit(resolvedSessionId);

          if (event.type === "text") {
            const text = event.part?.text;
            if (!text || !resolvedSessionId) return;
            const item = createTextItem(text);
            if (!item) return;
            enqueueResponse(controller, {
              type: "claude_json",
              data: createAssistantMessage({
                sessionId: resolvedSessionId,
                content: [item],
              }),
            });
            return;
          }

          if (event.type === "tool_use") {
            const part = event.part;
            if (!part || !resolvedSessionId) return;
            enqueueResponse(controller, {
              type: "claude_json",
              data: createAssistantMessage({
                sessionId: resolvedSessionId,
                content: [createToolUseItem(part)],
              }),
            });
            enqueueResponse(controller, {
              type: "claude_json",
              data: createUserMessage({
                sessionId: resolvedSessionId,
                content: [createToolResultItem(part)],
                toolUseResult: createToolUseResult(part),
              }),
            });
            return;
          }

          if (event.type === "error") {
            const errorMessage =
              typeof event.error === "string"
                ? event.error
                : JSON.stringify(event.error ?? "Unknown error");
            errorText = errorText ? `${errorText}\n${errorMessage}` : errorMessage;
            enqueueResponse(controller, {
              type: "error",
              error: errorMessage,
            });
          }
        };

        let buffer = "";
        for await (const chunk of process.stream) {
          if (chunk.source === "stderr") {
            if (chunk.text.trim().length > 0) {
              stderrText += chunk.text;
              logger.chat.debug("opencode stderr: {text}", { text: chunk.text });
            }
            continue;
          }

          buffer += chunk.text;
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const event = JSON.parse(trimmed) as CliEvent;
              handleEvent(event);
            } catch (parseError) {
              logger.chat.debug("Failed to parse opencode JSON line", {
                line: trimmed,
                error: parseError,
              });
            }
          }
        }

        const code = await process.exit;
        if (code !== 0 && !errorText) {
          const fallbackError = stderrText.trim() || `opencode exited with code ${code}`;
          enqueueResponse(controller, {
            type: "error",
            error: fallbackError,
          });
        }

        if (sessionId) {
          sendInit(sessionId);
          enqueueResponse(controller, {
            type: "claude_json",
            data: createResultMessage(Date.now() - startTime),
          });
        }

        enqueueResponse(controller, { type: "done" });
        controller.close();
      } catch (error) {
        const errorResponse: StreamResponse = {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
        enqueueResponse(controller, errorResponse);
        controller.close();
      } finally {
        if (requestAbortControllers.has(chatRequest.requestId)) {
          requestAbortControllers.delete(chatRequest.requestId);
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
