import {
  createAssistantMessage,
  createTextItem,
  createThinkingItem,
  createToolResultItem,
  createToolUseItem,
  createUserMessage,
  getToolResultTimestamp,
  isToolPart,
  type ClaudeContentItem,
  type TimestampedClaudeMessage,
} from "./claudeFormat.ts";

type ExportMessage = {
  info: {
    role: "user" | "assistant";
    sessionID?: string;
    time?: { created: number };
  };
  parts: Array<Record<string, unknown>>;
};

type ToolPart = {
  type: "tool";
  callID: string;
  tool: string;
  state: {
    status: "completed" | "error" | "running";
    input?: Record<string, unknown>;
    output?: string;
    error?: string;
    metadata?: Record<string, unknown>;
    time: { start: number; end: number };
  };
};

type Part = { type: string; text?: string } | ToolPart;

function toIso(timestampMs: number) {
  return new Date(timestampMs).toISOString();
}

function buildUserMessage(sessionId: string, parts: Part[], createdAt: number) {
  const content = parts
    .filter((part) => part.type === "text")
    .map((part) => createTextItem(part.text ?? ""))
    .filter((item): item is { type: "text"; text: string } => Boolean(item));

  return createUserMessage({
    sessionId,
    content,
    timestamp: toIso(createdAt),
  }) as TimestampedClaudeMessage;
}

function buildToolResultMessage(sessionId: string, part: ToolPart) {
  const timestamp = toIso(getToolResultTimestamp(part));
  const toolUseResult = {
    output: part.state.status === "error" ? part.state.error : part.state.output ?? "",
    metadata: part.state.metadata,
  };

  return createUserMessage({
    sessionId,
    content: [createToolResultItem(part)],
    timestamp,
    toolUseResult,
  }) as TimestampedClaudeMessage;
}

function buildAssistantMessages(
  sessionId: string,
  parts: Part[],
  createdAt: number,
): TimestampedClaudeMessage[] {
  const messages: TimestampedClaudeMessage[] = [];
  let content: ClaudeContentItem[] = [];
  let hasContent = false;

  const flush = () => {
    if (!hasContent) return;
    messages.push(
      createAssistantMessage({
        sessionId,
        content,
        timestamp: toIso(createdAt),
      }) as TimestampedClaudeMessage,
    );
    content = [];
    hasContent = false;
  };

  for (const part of parts) {
    if (part.type === "text") {
      const item = createTextItem(part.text ?? "");
      if (item) {
        content.push(item);
        hasContent = true;
      }
      continue;
    }

    if (part.type === "reasoning") {
      const item = createThinkingItem(part.text ?? "");
      if (item) {
        content.push(item);
        hasContent = true;
      }
      continue;
    }

    if (isToolPart(part as any)) {
      const toolPart = part as ToolPart;
      content.push(createToolUseItem(toolPart));
      hasContent = true;

      if (toolPart.state.status === "completed" || toolPart.state.status === "error") {
        flush();
        messages.push(buildToolResultMessage(sessionId, toolPart));
      }
    }
  }

  flush();
  return messages;
}

export function convertExportMessages(messages: ExportMessage[]): TimestampedClaudeMessage[] {
  const output: TimestampedClaudeMessage[] = [];

  for (const item of messages) {
    const createdAt = item.info.time?.created ?? Date.now();
    const sessionId = item.info.sessionID ?? "unknown";
    const parts = item.parts as Part[];

    if (item.info.role === "user") {
      output.push(buildUserMessage(sessionId, parts, createdAt));
      continue;
    }

    output.push(...buildAssistantMessages(sessionId, parts, createdAt));
  }

  return output;
}
