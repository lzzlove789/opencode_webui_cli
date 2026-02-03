import { Context } from "hono";
import { logger } from "../utils/logger.ts";
import type { RequestState } from "../opencode/request.ts";

/**
 * Handles POST /api/abort/:requestId requests
 * Aborts an ongoing chat request by request ID
 * @param c - Hono context object with config variables
 * @param requestAbortControllers - Map of request IDs to AbortControllers
 * @returns JSON response indicating success or failure
 */
export function handleAbortRequest(
  c: Context,
  requestAbortControllers: Map<string, RequestState>,
) {
  const requestId = c.req.param("requestId");

  if (!requestId) {
    return c.json({ error: "Request ID is required" }, 400);
  }

  logger.api.debug(`Abort attempt for request: ${requestId}`);
  logger.api.debug(
    `Active requests: ${Array.from(requestAbortControllers.keys())}`,
  );

  const requestState = requestAbortControllers.get(requestId);
  if (!requestState) {
    return c.json({ error: "Request not found or already completed" }, 404);
  }

  requestState.abortController.abort();
  requestState.kill?.();
  requestAbortControllers.delete(requestId);

  logger.api.debug(`Aborted request: ${requestId}`);

  return c.json({ success: true, message: "Request aborted" });
}
