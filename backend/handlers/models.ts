import { Context } from "hono";
import type { ModelsResponse } from "../../shared/types.ts";
import { logger } from "../utils/logger.ts";

function parseModels(output: string): string[] {
  const lines = output.split("\n");
  const models = new Set<string>();
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) continue;
    const token = trimmed.split(/\s+/)[0];
    if (!token || !token.includes("/")) continue;
    models.add(token);
  }
  return [...models].sort((a, b) => a.localeCompare(b));
}

/**
 * Handles GET /api/models requests
 * Retrieves list of available models from opencode CLI
 * @param c - Hono context object with config variables
 * @returns JSON response with models array
 */
export async function handleModelsRequest(c: Context) {
  try {
    const { runtime, opencodePath } = c.var.config;
    const result = await runtime.runCommand(opencodePath, ["models"], {
      cwd: process.cwd(),
    });

    if (!result.success || !result.stdout.trim()) {
      logger.api.error("Failed to list models: {error}", {
        error: result.stderr || "No output",
      });
      return c.json({ models: [] } as ModelsResponse);
    }

    const models = parseModels(result.stdout);
    return c.json({ models } as ModelsResponse);
  } catch (error) {
    logger.api.error("Error fetching models: {error}", { error });
    return c.json({ models: [] } as ModelsResponse, 500);
  }
}
