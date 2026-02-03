/**
 * Utility functions for extracting file paths from tool results
 */

/**
 * Check if a file type is renderable in the canvas
 */
export function isRenderableFile(extension: string): boolean {
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
    ".jsx",
    ".tsx",
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

/**
 * Extract file paths from tool result content
 * This analyzes Write tool results to find created file paths
 */
export function extractFilePathsFromToolResult(
  toolName: string,
  content: string,
): string[] {
  const filePaths: string[] = [];
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
    ".jsx",
    ".tsx",
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
  const extPattern = renderableExtensions
    .map((ext) => ext.replace(".", ""))
    .join("|");

  // Extract file paths from Write tool output
  if (toolName === "Write") {
    // Match common file path patterns in tool output
    // Patterns for various ways file paths might appear:
    // 1. "Created file at: path/to/file.ext"
    // 2. "File: path/to/file.ext"
    // 3. Just the path itself if it looks like a file
    // 4. JSON format with "file_path" or "path"
    const filePatterns = [
      // Pattern: "Created file at: /path/to/file.ext"
      /Created file at:\s*([^\s\n]+)/gi,
      // Pattern: "Wrote file at: /path/to/file.ext"
      /Wrote file at:\s*([^\s\n]+)/gi,
      // Pattern: "Updated file at: /path/to/file.ext"
      /Updated file at:\s*([^\s\n]+)/gi,
      // Pattern: "Created /path/to/file.ext"
      /Created\s+([^\s\n]+\.(?:[a-zA-Z0-9]+))(?:\s|$)/gi,
      // Pattern: "Wrote /path/to/file.ext"
      /Wrote\s+([^\s\n]+\.(?:[a-zA-Z0-9]+))(?:\s|$)/gi,
      // Pattern: "Updated /path/to/file.ext"
      /Updated\s+([^\s\n]+\.(?:[a-zA-Z0-9]+))(?:\s|$)/gi,
      // Pattern: "File: /path/to/file.ext"
      /File:\s+([^\s\n]+\.(?:[a-zA-Z0-9]+))(?:\s|$)/gi,
      // Pattern: "Writing to: /path/to/file.ext"
      /Writing to:\s*([^\s\n]+)/gi,
      // Pattern: JSON file_path
      /"file_path"\s*:\s*["']([^"']+)["']/gi,
      // Pattern: JSON path
      /"path"\s*:\s*["']([^"']+\.(?:[a-zA-Z0-9]+))["']/gi,
      // Pattern: "File created successfully at: /path/to/file.ext"
      /File created successfully at:\s*([^\s\n]+)/gi,
    ];

    for (const pattern of filePatterns) {
      // Reset regex lastIndex for global patterns
      pattern.lastIndex = 0;

      let match;
      while ((match = pattern.exec(content)) !== null) {
        const filePath = match[1].trim();
        // Remove any trailing punctuation, quotes, or whitespace
        const cleanPath = filePath.replace(/[\'\"\;:.,\s]+$/, "").replace(/^['"]+|['"]+$/g, "");
        // Check if path looks like a file path and has a valid extension
        if (cleanPath && cleanPath.length > 0 && isRenderableFile(getFileExtension(cleanPath))) {
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
      if (filePath && isRenderableFile(getFileExtension(filePath))) {
        filePaths.push(filePath);
      }
    }
  }

  // Generic extraction from any tool output
  const genericPatterns = [
    new RegExp(`(?:[A-Za-z]:[\\/]|\\/)[^\s"'<>]+\\.(?:${extPattern})`, "gi"),
    new RegExp(`[^\s"'<>]+\\.(?:${extPattern})`, "gi"),
  ];

  for (const pattern of genericPatterns) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const filePath = match[0].trim();
      const cleanPath = filePath.replace(/[\'\"\;:.,\s]+$/, "").replace(/^["']+|["']+$/g, "");
      if (cleanPath && isRenderableFile(getFileExtension(cleanPath))) {
        filePaths.push(cleanPath);
      }
    }
  }

  // Remove duplicates while preserving order
  const uniquePaths: string[] = [];
  const seen = new Set<string>();
  for (const path of filePaths) {
    if (!seen.has(path)) {
      seen.add(path);
      uniquePaths.push(path);
    }
  }
  return uniquePaths;
}

/**
 * Extract file paths from tool use input (for Write tool)
 * When OpenCode calls Write, the file path is in the input
 */
export function extractFilePathsFromToolInput(
  toolName: string,
  input: Record<string, unknown> | undefined,
): string[] {
  const filePaths: string[] = [];

  if (!input) {
    return filePaths;
  }

  // Extract from Write tool input
  if (toolName === "Write") {
    const inputRecord = input as Record<string, unknown>;

    // Check for file_path in input
    const filePath = inputRecord.file_path;
    if (typeof filePath === "string" && filePath.length > 0) {
      const cleanPath = filePath.trim();
      if (isRenderableFile(getFileExtension(cleanPath))) {
        filePaths.push(cleanPath);
      }
    }

    // Also check for path in input
    const altFilePath = inputRecord.path;
    if (typeof altFilePath === "string" && altFilePath.length > 0) {
      const cleanPath = altFilePath.trim();
      if (isRenderableFile(getFileExtension(cleanPath)) && !filePaths.includes(cleanPath)) {
        filePaths.push(cleanPath);
      }
    }
  }

  return filePaths;
}

/**
 * Get file extension from path
 */
export function getFileExtension(path: string): string {
  const parts = path.split(/[\\/]/);
  const fileName = parts[parts.length - 1];
  const lastDotIndex = fileName.lastIndexOf(".");
  const ext = lastDotIndex > 0 ? fileName.slice(lastDotIndex) : "";
  return ext.startsWith(".") ? ext : `.${ext}`;
}

/**
 * Get file name from path
 */
export function getFileName(path: string): string {
  const parts = path.split(/[\\/]/);
  return parts[parts.length - 1] || path;
}

/**
 * Get MIME type based on file extension
 */
export function getMimeType(extension: string): string {
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
 * Check if file is an image
 */
export function isImageFile(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Check if file is HTML
 */
export function isHtmlFile(mimeType: string): boolean {
  return mimeType === "text/html" || mimeType === "application/xhtml+xml";
}

/**
 * Check if file is Markdown
 */
export function isMarkdownFile(mimeType: string): boolean {
  return mimeType === "text/markdown";
}

/**
 * Check if file is Excel/CSV
 */
export function isExcelFile(mimeType: string): boolean {
  return (
    mimeType.includes("excel") ||
    mimeType.includes("spreadsheet") ||
    mimeType === "text/csv"
  );
}

/**
 * Check if file is text-based
 */
export function isTextFile(mimeType: string): boolean {
  return mimeType.startsWith("text/") || mimeType === "application/json";
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  } else if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  } else {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
}
