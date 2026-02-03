import type { FileInfo } from "../types";
import {
  isImageFile,
  isHtmlFile,
  isMarkdownFile,
  isExcelFile,
  isTextFile,
  formatFileSize,
} from "../utils/fileExtractor";

interface FileCanvasProps {
  fileInfo: FileInfo | null;
  content: string | null;
  base64: string | null;
  isLoading: boolean;
  error: string | null;
}

export function FileCanvas({
  fileInfo,
  content,
  base64,
  isLoading,
  error,
}: FileCanvasProps) {
  console.log("[FileCanvas] Render called with:", {
    fileInfo: fileInfo ? { path: fileInfo.path, mimeType: fileInfo.mimeType } : null,
    contentLength: content?.length,
    contentPreview: content?.substring(0, 50),
    base64Length: base64?.length,
    error,
    isLoading,
  });

  if (!fileInfo) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-600">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-4 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">No file selected</p>
          <p className="text-xs mt-1 opacity-60">
            Select a file from the list to preview
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Loading file...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 118 0z"
              />
            </svg>
          </div>
          <p className="text-sm text-red-600 dark:text-red-400 mb-2">Error</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  if (!content && !base64) {
    console.warn("[FileCanvas] Both content and base64 are null, cannot display file");
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <svg
            className="w-16 h-16 mx-auto mb-3 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            No content available
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* File header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-start gap-2">
          <FileIcon extension={fileInfo.extension} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
              {fileInfo.name}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {formatFileSize(fileInfo.size)}
              </span>
              <span className="text-xs text-slate-400 dark:text-slate-600">
                •
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {fileInfo.extension}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* File content */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        {renderFileContent(fileInfo, content, base64)}
      </div>
    </div>
  );
}

function renderFileContent(
  fileInfo: FileInfo | null,
  content: string | null,
  base64: string | null,
): React.ReactNode | null {
  const mimeType = fileInfo?.mimeType || "";
  const contentValue = content ?? "";
  const base64Value = base64 ?? "";
  const hasContent = !!contentValue;
  const hasBase64 = !!base64Value;

  console.log("[FileCanvas] renderFileContent called:", { mimeType, hasContent, hasBase64 });

  // Image files - render as base64 image
  if (isImageFile(mimeType) && hasBase64) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <img
          src={`data:${mimeType};base64,${base64Value}`}
          alt={fileInfo?.name || ""}
          className="max-w-full max-h-full object-contain"
        />
      </div>
    );
  }

  // HTML files - render in iframe
  if (isHtmlFile(mimeType) && hasContent) {
    return (
      <iframe
        title={fileInfo?.name || ""}
        srcDoc={contentValue}
        className="w-full h-full border-0"
        sandbox="allow-same-origin allow-scripts allow-forms"
      />
    );
  }

  // Markdown files - render as pre-formatted text
  if (isMarkdownFile(mimeType) && hasContent) {
    return (
      <div className="p-4">
        <pre className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed">
          {contentValue}
        </pre>
      </div>
    );
  }

  // Excel/CSV files - render as text with warning
  if (isExcelFile(mimeType) && hasContent) {
    return (
      <div className="p-4">
        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Excel/CSV preview - displaying as text
          </p>
        </div>
        <pre className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed overflow-auto">
          {contentValue}
        </pre>
      </div>
    );
  }

  // Text files - render as pre-formatted text
  if (isTextFile(mimeType) && hasContent) {
    return (
      <div className="p-4">
        <pre className="text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap font-mono leading-relaxed overflow-auto">
          {contentValue}
        </pre>
      </div>
    );
  }

  // Base64 files (other types) - show warning
  if (hasBase64) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center">
          <svg
            className="w-12 h-12 mx-auto mb-3 opacity-30"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01.2 2z"
            />
          </svg>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Binary file preview not available
          </p>
        </div>
      </div>
    );
  }

  return null;
}

interface FileIconProps {
  extension: string;
}

function FileIcon({ extension }: FileIconProps) {
  const ext = extension.toLowerCase();
  let icon = "📄";
  let bgClass = "bg-slate-100 dark:bg-slate-800";

  if ([".html", ".htm"].includes(ext)) {
    icon = "🌐";
    bgClass = "bg-orange-100 dark:bg-orange-900/30";
  } else if ([".css"].includes(ext)) {
    icon = "🎨";
    bgClass = "bg-pink-100 dark:bg-pink-900/30";
  } else if ([".js", ".ts", ".tsx", ".jsx"].includes(ext)) {
    icon = "📜";
    bgClass = "bg-yellow-100 dark:bg-yellow-900/30";
  } else if ([".json"].includes(ext)) {
    icon = "📋";
    bgClass = "bg-amber-100 dark:bg-amber-900/30";
  } else if ([".md"].includes(ext)) {
    icon = "📝";
    bgClass = "bg-purple-100 dark:bg-purple-900/30";
  } else if ([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(ext)) {
    icon = "🖼️";
    bgClass = "bg-green-100 dark:bg-green-900/30";
  } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
    icon = "📊";
    bgClass = "bg-emerald-100 dark:bg-emerald-900/30";
  }

  return (
    <div className={`w-10 h-10 flex-shrink-0 ${bgClass} rounded-lg flex items-center justify-center text-lg`}>
      {icon}
    </div>
  );
}
