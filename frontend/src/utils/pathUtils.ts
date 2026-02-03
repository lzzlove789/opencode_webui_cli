/**
 * Windows path normalization utilities
 */

/**
 * Normalize Windows paths for cross-platform compatibility
 * - Remove leading slash from Windows absolute paths like /C:/...
 * - Convert backslashes to forward slashes
 */
export function normalizeWindowsPath(path: string): string {
  return path.replace(/^\/([A-Za-z]:)/, "$1").replace(/\\/g, "/");
}

export function toWindowsPath(path: string): string {
  if (!path) return path;
  return normalizeWindowsPath(path).replace(/\//g, "\\");
}

export function normalizeFilePath(
  filePath: string,
  workingDirectory?: string,
): string {
  let normalized = filePath.trim();
  if (!normalized) return normalized;

  normalized = normalized.replace(/^file:\/\//i, "");
  normalized = normalized.replace(/^\/?([A-Za-z]:)/, "$1");
  normalized = normalized.replace(/^["']+|["']+$/g, "");
  normalized = normalized.replace(/\\/g, "/");

  if (workingDirectory) {
    const normalizedWorking = workingDirectory.replace(/\\/g, "/").replace(/\/+$/, "");
    const normalizedLower = normalized.toLowerCase();
    const workingLower = normalizedWorking.toLowerCase();
    if (normalizedLower.startsWith(`${workingLower}/`)) {
      normalized = normalized.slice(normalizedWorking.length + 1);
    }
  }

  return normalized;
}

export function isAbsoluteFilePath(path: string): boolean {
  return /^[A-Za-z]:\//.test(path) || path.startsWith("//");
}

export function splitFilePath(path: string): {
  directory: string;
  fileName: string;
} {
  const lastSlash = path.lastIndexOf("/");
  if (lastSlash === -1) {
    return { directory: "", fileName: path };
  }

  const directory = path.slice(0, lastSlash);
  const fileName = path.slice(lastSlash + 1);
  return { directory, fileName: fileName || path };
}
