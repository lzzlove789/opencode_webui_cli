import { useState, useCallback, useEffect } from "react";
import type { FileInfo, FileContentResponse } from "../types";
import {
  normalizeFilePath,
  isAbsoluteFilePath,
  splitFilePath,
} from "../utils/pathUtils";

// API endpoint for file operations
const FILE_API_URL = "/api/file";

/**
 * File information with display state
 */
export interface FileCanvasState {
  files: Map<string, FileInfo>;
  selectedFile: FileInfo | null;
  fileContent: string | null;
  fileBase64: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for managing file canvas state and operations
 */
export function useFileCanvas(workingDirectory: string | undefined) {
  const [files, setFiles] = useState<Map<string, FileInfo>>(new Map());
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileBase64, setFileBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear file content when selected file changes
  useEffect(() => {
    setFileContent(null);
    setFileBase64(null);
    setError(null);
  }, [selectedFile?.path]);

  /**
   * Add a file to the canvas file list
   */
  const addFile = useCallback((filePath: string, fileSize: number) => {
    const normalizedPath = normalizeFilePath(filePath, workingDirectory) || filePath;
    setFiles((prev) => {
      const newMap = new Map(prev);
      const extension = normalizedPath.split(".").pop()?.toLowerCase() || "";

      newMap.set(normalizedPath, {
        path: normalizedPath,
        name: normalizedPath.split(/[\\/]/).pop() || normalizedPath,
        extension: extension.startsWith(".") ? extension : `.${extension}`,
        size: fileSize,
        mimeType: getMimeType(extension),
      });
      return newMap;
    });
  }, [workingDirectory]);

  /**
   * Remove a file from the canvas file list
   */
  const removeFile = useCallback((filePath: string) => {
    setFiles((prev) => {
      const newMap = new Map(prev);
      newMap.delete(filePath);
      return newMap;
    });
    // Clear selection if the removed file was selected
    if (selectedFile?.path === filePath) {
      setSelectedFile(null);
    }
  }, [selectedFile]);

  /**
   * Clear all files from the canvas
   */
  const clearFiles = useCallback(() => {
    setFiles(new Map());
    setSelectedFile(null);
    setFileContent(null);
    setFileBase64(null);
    setError(null);
  }, []);

  /**
   * Select a file to display in the canvas
   */
  const selectFile = useCallback(
    async (fileInfo: FileInfo) => {
      setSelectedFile(fileInfo);
      setIsLoading(true);
      setError(null);

      const normalizedPath = normalizeFilePath(fileInfo.path, workingDirectory) || fileInfo.path;
      let requestPath = normalizedPath;
      let requestWorkingDirectory = workingDirectory;

      if (isAbsoluteFilePath(normalizedPath)) {
        const { directory, fileName } = splitFilePath(normalizedPath);
        requestWorkingDirectory = directory || workingDirectory;
        requestPath = fileName;
      }

      if (!requestWorkingDirectory) {
        setError("No working directory configured");
        setIsLoading(false);
        return;
      }

      console.log("[FileCanvas] Selecting file:", requestPath, fileInfo.name);

      try {
        const params = new URLSearchParams({
          path: requestPath,
          workingDirectory: requestWorkingDirectory,
        });

        const response = await fetch(`${FILE_API_URL}?${params}`);

        if (!response.ok) {
          const errorData = await response.json();
          console.error("[FileCanvas] Error response:", errorData);
          if (response.status === 404) {
            removeFile(normalizedPath);
          }
          throw new Error(errorData.error || `HTTP ${response.status}`);
        }

        const data: FileContentResponse = await response.json();
        console.log("[FileCanvas] File response:", data);

        if (data.success) {
          if (data.content) {
            console.log("[FileCanvas] Setting content, length:", data.content.length);
            setFileContent(data.content);
          }
          if (data.base64) {
            console.log("[FileCanvas] Setting base64, length:", data.base64.length);
            setFileBase64(data.base64);
          }
          // Update fileInfo with correct mimeType from API response
          if (data.mimeType && selectedFile?.mimeType !== data.mimeType) {
            setSelectedFile((prev) => {
              if (!prev) return prev;
              return {
                ...prev,
                mimeType: data.mimeType,
              };
            });
          }
        } else {
          throw new Error(data.error || "Failed to read file");
        }
      } catch (err) {
        console.error("[FileCanvas] Error loading file:", err);
        setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setIsLoading(false);
        console.log("[FileCanvas] selectFile completed, loading:", false);
      }
    },
    [workingDirectory, removeFile],
  );

  /**
   * Get all files as an array
   */
  const getFileList = useCallback((): FileInfo[] => {
    return Array.from(files.values());
  }, [files]);

  return {
    files: getFileList(),
    selectedFile,
    fileContent,
    fileBase64,
    isLoading,
    error,
    addFile,
    removeFile,
    clearFiles,
    selectFile,
  };
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
  };
  return mimeTypes[ext] || "application/octet-stream";
}
