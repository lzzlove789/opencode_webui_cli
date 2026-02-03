import { Context } from "hono";
import { Context } from "hono";
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  ProjectsResponse,
} from "../../shared/types.ts";
import { addProject, loadProjects } from "../projects/store.ts";
import { logger } from "../utils/logger.ts";

/**
 * Handles GET /api/projects requests
 * Retrieves list of available project directories from opencode server
 * @param c - Hono context object
 * @returns JSON response with projects array
 */
export async function handleProjectsRequest(c: Context) {
  try {
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

    const response: ProjectsResponse = {
      projects: resolved.map((path, index) => ({
        path: path.replace(/\\/g, "/"),
        encodedName: `project-${index + 1}`,
      })),
    };
    return c.json(response);
  } catch (error) {
    logger.api.error("Error reading projects: {error}", { error });
    return c.json({ error: "Failed to read projects" }, 500);
  }
}

export async function handleCreateProjectRequest(c: Context) {
  try {
    const payload = (await c.req.json()) as CreateProjectRequest;
    const path = payload?.path?.trim();
    if (!path) {
      return c.json({ error: "Project path is required" }, 400);
    }

    const createdPath = await addProject({
      path,
      create: payload.create !== false,
    });

    const response: CreateProjectResponse = {
      success: true,
      project: {
        path: createdPath,
        encodedName: "created",
      },
    };

    return c.json(response);
  } catch (error) {
    logger.api.error("Error creating project: {error}", { error });
    return c.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to create project",
      },
      500,
    );
  }
}
