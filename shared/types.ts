export interface StreamResponse {
  type: "claude_json" | "error" | "done" | "aborted";
  data?: unknown; // SDKMessage object for claude_json type
  error?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  requestId: string;
  allowedTools?: string[];
  workingDirectory?: string;
  permissionMode?: "default" | "plan" | "acceptEdits";
  model?: string;
}

export interface AbortRequest {
  requestId: string;
}

export interface ProjectInfo {
  path: string;
  encodedName: string;
}

export interface ProjectsResponse {
  projects: ProjectInfo[];
}

export interface CreateProjectRequest {
  path: string;
  create?: boolean;
}

export interface CreateProjectResponse {
  success: boolean;
  project?: ProjectInfo;
  error?: string;
}

// Conversation history types
export interface ConversationSummary {
  sessionId: string;
  startTime: string;
  lastTime: string;
  messageCount: number;
  lastMessagePreview: string;
}

export interface HistoryListResponse {
  conversations: ConversationSummary[];
  debug?: {
    count: number;
    newest?: number;
    oldest?: number;
    cwd?: string;
    opencodePath?: string;
    sampleDirs?: string[];
    rawHead?: string;
    stderrHead?: string;
    code?: number;
    parseError?: string;
    dataLen?: number;
    dataType?: string;
    firstKeys?: string;
  };
}

export interface ModelsResponse {
  models: string[];
}

// Conversation history types
// Note: messages are typed as unknown[] to avoid frontend/backend dependency issues
// Frontend should cast to TimestampedSDKMessage[] (defined in frontend/src/types.ts)
export interface ConversationHistory {
  sessionId: string;
  messages: unknown[]; // TimestampedSDKMessage[] in practice, but avoiding frontend type dependency
  metadata: {
    startTime: string;
    endTime: string;
    messageCount: number;
  };
}

// File canvas types
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string;
}

export interface FileContentResponse {
  success: boolean;
  content?: string;
  base64?: string;
  error?: string;
  mimeType: string;
}
