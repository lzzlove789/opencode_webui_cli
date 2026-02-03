export type ToolPartState = {
  input?: Record<string, unknown>;
  output?: string;
  error?: string;
  status?: "running" | "completed" | "error";
  metadata?: Record<string, unknown>;
  time?: {
    start: number;
    end: number;
  };
};

export type ToolPart = {
  type: "tool";
  callID: string;
  tool: string;
  state: ToolPartState;
};

export type Part = {
  type: string;
  text?: string;
  callID?: string;
  tool?: string;
  state?: ToolPartState;
};

export type ClaudeContentItem =
  | { type: "text"; text: string }
  | { type: "thinking"; thinking: string }
  | {
      type: "tool_use";
      id?: string;
      name?: string;
      input?: Record<string, unknown>;
    }
  | {
      type: "tool_result";
      tool_use_id?: string;
      content: string;
      is_error?: boolean;
    };

export type ClaudeMessage = {
  type: "system" | "assistant" | "user" | "result";
  message?: {
    content: ClaudeContentItem[] | string;
  };
  session_id?: string;
  subtype?: string;
  model?: string;
  tools?: string[];
  cwd?: string;
  permissionMode?: string;
  apiKeySource?: string;
  duration_ms?: number;
  total_cost_usd?: number;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  toolUseResult?: unknown;
};

export type TimestampedClaudeMessage = ClaudeMessage & { timestamp: string };

const TOOL_NAME_OVERRIDES: Record<string, string> = {
  todowrite: "TodoWrite",
  todoread: "TodoRead",
  apply_patch: "ApplyPatch",
  webfetch: "WebFetch",
};

function capitalize(input: string): string {
  if (!input) return input;
  return input.charAt(0).toUpperCase() + input.slice(1);
}

export function toClaudeToolName(tool: string): string {
  const normalized = tool.toLowerCase();
  if (normalized in TOOL_NAME_OVERRIDES) return TOOL_NAME_OVERRIDES[normalized];
  return tool
    .split(/[_-]/)
    .map((part) => capitalize(part))
    .join("");
}

export function createInitMessage(options: {
  sessionId: string;
  cwd: string;
  permissionMode: string;
  tools?: string[];
}): ClaudeMessage {
  return {
    type: "system",
    subtype: "init",
    model: "opencode",
    session_id: options.sessionId,
    tools: options.tools ?? [],
    cwd: options.cwd,
    permissionMode: options.permissionMode,
    apiKeySource: "opencode",
  };
}

export function createResultMessage(durationMs: number): ClaudeMessage {
  return {
    type: "result",
    duration_ms: durationMs,
    total_cost_usd: 0,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
    },
  };
}

export function createAssistantMessage(options: {
  sessionId: string;
  content: ClaudeContentItem[];
  timestamp?: string;
}): ClaudeMessage | TimestampedClaudeMessage {
  const message: ClaudeMessage = {
    type: "assistant",
    session_id: options.sessionId,
    message: {
      content: options.content,
    },
  };

  if (options.timestamp) {
    return {
      ...message,
      timestamp: options.timestamp,
    };
  }

  return message;
}

export function createUserMessage(options: {
  sessionId: string;
  content: ClaudeContentItem[] | string;
  timestamp?: string;
  toolUseResult?: unknown;
}): ClaudeMessage | TimestampedClaudeMessage {
  const message: ClaudeMessage = {
    type: "user",
    session_id: options.sessionId,
    message: {
      content: options.content,
    },
    toolUseResult: options.toolUseResult,
  };

  if (options.timestamp) {
    return {
      ...message,
      timestamp: options.timestamp,
    };
  }

  return message;
}

export function createTextItem(text: string): ClaudeContentItem | null {
  if (!text) return null;
  return { type: "text", text };
}

export function createThinkingItem(thinking: string): ClaudeContentItem | null {
  if (!thinking) return null;
  return { type: "thinking", thinking };
}

export function createToolUseItem(part: ToolPart): ClaudeContentItem {
  return {
    type: "tool_use",
    id: part.callID,
    name: toClaudeToolName(part.tool),
    input: part.state.input ?? {},
  };
}

export function createToolResultItem(part: ToolPart): ClaudeContentItem {
  const content =
    part.state.status === "error" ? part.state.error : part.state.output ?? "";
  return {
    type: "tool_result",
    tool_use_id: part.callID,
    content,
    is_error: part.state.status === "error",
  };
}

export function isToolPart(part: Part): part is ToolPart {
  return part.type === "tool";
}

export function getToolResultTimestamp(part: ToolPart): number {
  if (part.state.status === "completed" || part.state.status === "error") {
    return part.state.time.end;
  }
  return part.state.time.start;
}
