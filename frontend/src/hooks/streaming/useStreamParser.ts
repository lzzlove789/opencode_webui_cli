import { useCallback, useMemo } from "react";
import type {
  StreamResponse,
  SDKMessage,
  SystemMessage,
  AbortMessage,
} from "../../types";
import {
  isSystemMessage,
  isAssistantMessage,
  isResultMessage,
  isUserMessage,
} from "../../utils/messageTypes";
import type { StreamingContext } from "./useMessageProcessor";
import {
  UnifiedMessageProcessor,
  type ProcessingContext,
} from "../../utils/UnifiedMessageProcessor";

export function useStreamParser() {
  // Create a single unified processor instance
  const processor = useMemo(() => new UnifiedMessageProcessor(), []);

  // Convert StreamingContext to ProcessingContext
  const adaptContext = useCallback(
    (context: StreamingContext): ProcessingContext => {
      return {
        // Core message handling
        addMessage: context.addMessage,
        updateLastMessage: context.updateLastMessage,

        // Current assistant message state
        currentAssistantMessage: context.currentAssistantMessage,
        setCurrentAssistantMessage: context.setCurrentAssistantMessage,

        // Session handling
        onSessionId: context.onSessionId,
        hasReceivedInit: context.hasReceivedInit,
        setHasReceivedInit: context.setHasReceivedInit,

        // Init message handling
        shouldShowInitMessage: context.shouldShowInitMessage,
        onInitMessageShown: context.onInitMessageShown,

        // Permission/Error handling
        onPermissionError: context.onPermissionError,
        onAbortRequest: context.onAbortRequest,
      };
    },
    [],
  );

  const processOpenCodeData = useCallback(
    (openCodeData: SDKMessage, context: StreamingContext) => {
      const processingContext = adaptContext(context);

      // Validate message types before processing
      switch (openCodeData.type) {
        case "system":
          if (!isSystemMessage(openCodeData)) {
            console.warn("Invalid system message:", openCodeData);
            return;
          }
          break;
        case "assistant":
          if (!isAssistantMessage(openCodeData)) {
            console.warn("Invalid assistant message:", openCodeData);
            return;
          }
          break;
        case "result":
          if (!isResultMessage(openCodeData)) {
            console.warn("Invalid result message:", openCodeData);
            return;
          }
          break;
        case "user":
          if (!isUserMessage(openCodeData)) {
            console.warn("Invalid user message:", openCodeData);
            return;
          }
          break;
        default:
          console.log("Unknown OpenCode message type:", openCodeData);
          return;
      }

      // Process the message using the unified processor
      processor.processMessage(openCodeData, processingContext, {
        isStreaming: true,
      });
    },
    [processor, adaptContext],
  );

  const processStreamLine = useCallback(
    (line: string, context: StreamingContext) => {
      try {
        const data: StreamResponse = JSON.parse(line);

        if (data.type === "claude_json" && data.data) {
          // data.data is already an SDKMessage object, no need to parse
          const openCodeData = data.data as SDKMessage;
          processOpenCodeData(openCodeData, context);
        } else if (data.type === "error") {
          const errorMessage: SystemMessage = {
            type: "error",
            subtype: "stream_error",
            message: data.error || "Unknown error",
            timestamp: Date.now(),
          };
          context.addMessage(errorMessage);
        } else if (data.type === "aborted") {
          const abortedMessage: AbortMessage = {
            type: "system",
            subtype: "abort",
            message: "Operation was aborted by user",
            timestamp: Date.now(),
          };
          context.addMessage(abortedMessage);
          context.setCurrentAssistantMessage(null);
        }
      } catch (parseError) {
        console.error("Failed to parse stream line:", parseError);
      }
    },
    [processOpenCodeData],
  );

  return {
    processStreamLine,
  };
}
