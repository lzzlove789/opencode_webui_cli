import { Context } from "hono";
import { readTextFile, readBinaryFile, exists, stat, readDir } from "../utils/fs.ts";
import { extname, basename, join, resolve, relative } from "node:path";
import { logger } from "../utils/logger.ts";
import type { StreamResponse } from "../../shared/types.ts";

/**
 * File information interface
 */
export interface FileInfo {
  path: string;
  name: string;
  extension: string;
  size: number;
  mimeType: string;
}

/**
 * File content response interface
 */
export interface FileContentResponse {
  success: boolean;
  content?: string;
  base64?: string;
  error?: string;
  mimeType: string;
}

interface RecentFilesResponse {
  files: FileInfo[];
}

/**
 * Get MIME type based on file extension
 */
function getMimeType(extension: string): string {
  const ext = extension.toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".html": "text/html",
    ".htm": "text/html",
    ".css": "text/css",
    ".js": "text/javascript",
    ".ts": "text/typescript",
    ".json": "application/json",
    ".md": "text/markdown",
    ".txt": "text/plain",
    ".xml": "application/xml",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ico": "image/x-icon",
    ".bmp": "image/bmp",
    ".pdf": "application/pdf",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".xls": "application/vnd.ms-excel",
    ".csv": "text/csv",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".doc": "application/msword",
    ".py": "text/x-python",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Check if file type is renderable
 */
function isRenderableFile(extension: string): boolean {
  const ext = extension.toLowerCase();
  const renderableExtensions = [
    ".html",
    ".htm",
    ".md",
    ".txt",
    ".json",
    ".xml",
    ".css",
    ".js",
    ".ts",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".webp",
    ".bmp",
    ".xlsx",
    ".xls",
    ".csv",
    ".py",
  ];
  return renderableExtensions.includes(ext);
}

async function collectRecentFiles(
  baseDirectory: string,
  currentDirectory: string,
  sinceMs: number,
  maxDepth: number,
  currentDepth = 0,
  results: FileInfo[] = [],
): Promise<FileInfo[]> {
  if (currentDepth > maxDepth || results.length >= 200) {
    return results;
  }

  const ignoredDirectories = new Set([
    ".git",
    "node_modules",
    "dist",
    "build",
    "out",
    ".next",
    ".cache",
  ]);

  for await (const entry of readDir(currentDirectory)) {
    if (results.length >= 200) break;

    if (entry.isDirectory) {
      if (ignoredDirectories.has(entry.name)) continue;
      const nextDirectory = join(currentDirectory, entry.name);
      await collectRecentFiles(
        baseDirectory,
        nextDirectory,
        sinceMs,
        maxDepth,
        currentDepth + 1,
        results,
      );
      continue;
    }

    if (!entry.isFile) continue;

    const filePath = join(currentDirectory, entry.name);
    const stats = await stat(filePath);
    const modifiedTime = stats.mtime?.getTime() ?? 0;
    if (modifiedTime < sinceMs) continue;

    const extension = extname(filePath);
    if (!isRenderableFile(extension)) continue;

    const mimeType = getMimeType(extension);
    const relativePath = relative(baseDirectory, filePath);

    results.push({
      path: relativePath,
      name: basename(filePath),
      extension,
      size: stats.size,
      mimeType,
    });
  }

  return results;
}

/**
 * Extract file paths from tool result content
 * This analyzes Write tool results to find created file paths
 */
export function extractFilePathsFromToolResult(
  toolName: string,
  content: string,
  workingDirectory?: string,
): string[] {
  const filePaths: string[] = [];

  // Extract file paths from Write tool output
  // Pattern: "Created file at: path/to/file.ext" or similar
  if (toolName === "Write") {
    // Match common file path patterns in tool output
    const filePatterns = [
      /(?:Created|Wrote|Updated) file(?: at)?:?\s+([^\s\n]+\.(?:[a-zA-Z0-9]+))/g,
      /(?:Created|Wrote|Updated)\s+([^\s\n]+(?:\.[a-zA-Z0-9]+))/g,
      /Writing\s+to\s+([^\s\n]+(?:\.[a-zA-Z0-9]+))/g,
      /File:\s+([^\s\n]+(?:\.[a-zA-Z0-9]+))/g,
    ];

    for (const pattern of filePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const filePath = match[1].trim();
        // Remove any trailing punctuation or quotes
        const cleanPath = filePath.replace(/[\'\"\;:.,\s]+$/, "");
        if (cleanPath && isRenderableFile(extname(cleanPath))) {
          filePaths.push(cleanPath);
        }
      }
    }
  }

  // Also check for file paths in result-like formats
  if (toolName === "result" || content.includes("tool_result")) {
    const filePattern = /(?:file_path|filePath|path):\s*[\'\"]?([^\s\'\"\n]+\.[a-zA-Z0-9]+)/g;
    let match;
    while ((match = filePattern.exec(content)) !== null) {
      const filePath = match[1].trim();
      if (filePath && isRenderableFile(extname(filePath))) {
        filePaths.push(filePath);
      }
    }
  }

  return filePaths;
}

/**
 * Validate and resolve file path to prevent directory traversal
 */
function resolveFilePath(
  requestedPath: string,
  workingDirectory?: string,
): string | null {
  if (!workingDirectory) {
    logger.files.warn("No working directory provided for file access");
    return null;
  }

  try {
    const cleanedPath = normalizeRequestedPath(requestedPath);
    // Resolve the requested path relative to working directory
    const resolvedPath = resolve(workingDirectory, cleanedPath);

    // Verify the resolved path is within working directory
    const normalizedWorking = resolve(workingDirectory);
    const normalizedResolved = resolve(resolvedPath);

    if (!normalizedResolved.startsWith(normalizedWorking)) {
      logger.files.warn(
        "Attempted directory traversal: {requestedPath} -> {resolvedPath}",
        { requestedPath, resolvedPath },
      );
      return null;
    }

    return normalizedResolved;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.files.error("Error resolving file path:", errorMessage);
    return null;
  }
}

function normalizeRequestedPath(requestedPath: string): string {
  let cleaned = requestedPath.trim();
  cleaned = cleaned.replace(/^file:\/\//i, "");
  cleaned = cleaned.replace(/^\/?([A-Za-z]:)/, "$1");
  cleaned = cleaned.replace(/^["']+|["']+$/g, "");
  cleaned = cleaned.replace(/\0/g, "");
  return cleaned;
}

/**
 * Handle GET /api/file requests
 *
 * Query parameters:
 * - path: Relative file path from working directory (required)
 * - workingDirectory: Base directory for resolving relative paths (required)
 *
 * Returns: FileContentResponse with content or base64-encoded binary
 */
export async function handleFileRequest(c: Context): Promise<Response> {
  try {
    const requestedPath = c.req.query("path");
    const workingDirectory = c.req.query("workingDirectory");

    if (!requestedPath || !workingDirectory) {
      return c.json<FileContentResponse>(
        {
          success: false,
          error: "Missing required parameters: path and workingDirectory",
          mimeType: "application/json",
        },
        400,
      );
    }

    // Resolve and validate path
    const resolvedPath = resolveFilePath(requestedPath, workingDirectory);
    if (!resolvedPath) {
      return c.json<FileContentResponse>(
        {
          success: false,
          error: "Invalid file path or path outside working directory",
          mimeType: "application/json",
        },
        403,
      );
    }

    // Check if file exists
    const fileExists = await exists(resolvedPath);
    if (!fileExists) {
      return c.json<FileContentResponse>(
        {
          success: false,
          error: "File not found",
          mimeType: "application/json",
        },
        404,
      );
    }

    // Get file stats
    const stats = await stat(resolvedPath);
    if (!stats.isFile) {
      return c.json<FileContentResponse>(
        {
          success: false,
          error: "Path is not a file",
          mimeType: "application/json",
        },
        400,
      );
    }

    const extension = extname(resolvedPath);
    const mimeType = getMimeType(extension);
    const name = basename(resolvedPath);

    // Get file size
    const size = stats.size;

    // Check file size limit (10MB max for safety)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (size > MAX_FILE_SIZE) {
      return c.json<FileContentResponse>(
        {
          success: false,
          error: `File too large (${(size / 1024 / 1024).toFixed(2)}MB). Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          mimeType: "application/json",
        },
        413,
      );
    }

    logger.files.debug(
      "Reading file: {path} ({mime}, {size} bytes)",
      { path: resolvedPath, mime: mimeType, size },
    );

    // Read file based on type
    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      // Text files - return as plain text
      const content = await readTextFile(resolvedPath);
      logger.files.debug("Returning text file content for: {path}", { path: resolvedPath, contentLength: content.length });
      return c.json<FileContentResponse>({
        success: true,
        content,
        mimeType,
      });
    } else if (mimeType.startsWith("image/")) {
      // Image files - return as base64
      const buffer = await readBinaryFile(resolvedPath);
      const base64 = btoa(
        Array.from(buffer)
          .map((byte) => String.fromCharCode(byte))
          .join(""),
      );
      return c.json<FileContentResponse>({
        success: true,
        base64,
        mimeType,
      });
    } else if (
      mimeType.includes("excel") ||
      mimeType.includes("spreadsheet") ||
      mimeType === "text/csv"
    ) {
      // Excel/CSV files - try to read as text for basic rendering
      try {
        const content = await readTextFile(resolvedPath);
        logger.files.debug("Returning excel file content for: {path}", { path: resolvedPath, contentLength: content.length });
        return c.json<FileContentResponse>({
          success: true,
          content,
          mimeType,
        });
      } catch {
        // If text reading fails, try binary
        const buffer = await readBinaryFile(resolvedPath);
        const base64 = btoa(
          Array.from(buffer)
            .map((byte) => String.fromCharCode(byte))
            .join(""),
        );
        return c.json<FileContentResponse>({
          success: true,
          base64,
          mimeType,
        });
      }
    } else {
      // Other file types - return as base64
      const buffer = await readBinaryFile(resolvedPath);
      const base64 = btoa(
        Array.from(buffer)
          .map((byte) => String.fromCharCode(byte))
          .join(""),
      );
      return c.json<FileContentResponse>({
        success: true,
        base64,
        mimeType,
      });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to read file";
    logger.files.error("Error reading file:", errorMessage);
    return c.json<FileContentResponse>(
      {
        success: false,
        error: errorMessage,
        mimeType: "application/json",
      },
      500,
    );
  }
}

/**
 * Handle GET /api/file/info requests
 *
 * Returns: File information without content
 */
export async function handleFileInfoRequest(c: Context): Promise<Response> {
  try {
    const requestedPath = c.req.query("path");
    const workingDirectory = c.req.query("workingDirectory");

    if (!requestedPath || !workingDirectory) {
      return c.json<FileInfo | { error: string }>(
        { error: "Missing required parameters: path and workingDirectory" },
        400,
      );
    }

    const resolvedPath = resolveFilePath(requestedPath, workingDirectory);
    if (!resolvedPath) {
      return c.json<FileInfo | { error: string }>(
        { error: "Invalid file path" },
        403,
      );
    }

    const fileExists = await exists(resolvedPath);
    if (!fileExists) {
      return c.json<FileInfo | { error: string }>(
        { error: "File not found" },
        404,
      );
    }

    const stats = await stat(resolvedPath);
    const extension = extname(resolvedPath);
    const mimeType = getMimeType(extension);
    const name = basename(resolvedPath);

    const fileInfo: FileInfo = {
      path: requestedPath,
      name,
      extension,
      size: stats.size,
      mimeType,
    };

    return c.json(fileInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.files.error("Error getting file info:", errorMessage);
    return c.json<FileInfo | { error: string }>(
      { error: "Failed to get file info" },
      500,
    );
  }
}

/**
 * Handle GET /api/files/recent requests
 *
 * Query parameters:
 * - workingDirectory: Base directory for scanning (required)
 * - since: Unix timestamp in milliseconds (optional)
 * - maxDepth: Maximum directory depth to scan (optional, default 4)
 */
export async function handleRecentFilesRequest(c: Context): Promise<Response> {
  try {
    const workingDirectory = c.req.query("workingDirectory");
    if (!workingDirectory) {
      return c.json<RecentFilesResponse>(
        { files: [] },
        400,
      );
    }

    const resolvedWorking = resolve(workingDirectory);
    const workingStats = await stat(resolvedWorking);
    if (!workingStats.isDirectory) {
      return c.json<RecentFilesResponse>(
        { files: [] },
        400,
      );
    }

    const sinceParam = c.req.query("since");
    const maxDepthParam = c.req.query("maxDepth");
    const sinceMs = sinceParam ? Number(sinceParam) : Date.now() - 5 * 60 * 1000;
    const maxDepth = maxDepthParam ? Number(maxDepthParam) : 4;

    if (Number.isNaN(sinceMs) || Number.isNaN(maxDepth)) {
      return c.json<RecentFilesResponse>(
        { files: [] },
        400,
      );
    }

    const files = await collectRecentFiles(
      resolvedWorking,
      resolvedWorking,
      sinceMs,
      Math.max(0, Math.min(maxDepth, 8)),
    );

    return c.json<RecentFilesResponse>({ files });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.files.error("Error listing recent files:", errorMessage);
    return c.json<RecentFilesResponse>(
      { files: [] },
      500,
    );
  }
}
