import type { FileInfo } from "../types";
import { formatFileSize } from "../utils/fileExtractor";

interface FileListProps {
  files: FileInfo[];
  selectedFile: FileInfo | null;
  onFileSelect: (file: FileInfo) => void;
  onClearFiles: () => void;
}

export function FileList({
  files,
  selectedFile,
  onFileSelect,
  onClearFiles,
}: FileListProps) {
  if (files.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-center text-slate-400 dark:text-slate-600">
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
              d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm">No files generated yet</p>
          <p className="text-xs mt-1 opacity-60">
            Files created by OpenCode will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-slate-200 dark:border-slate-700 p-3 bg-slate-50/50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-slate-600 dark:text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-200">
              Generated Files ({files.length})
            </span>
          </div>
          <button
            onClick={onClearFiles}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-200 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-700 transition-colors"
            title="Clear all files"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.map((file) => (
          <FileListItem
            key={file.path}
            file={file}
            isSelected={selectedFile?.path === file.path}
            onClick={() => onFileSelect(file)}
          />
        ))}
      </div>
    </div>
  );
}

interface FileListItemProps {
  file: FileInfo;
  isSelected: boolean;
  onClick: () => void;
}

function FileListItem({ file, isSelected, onClick }: FileListItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-2.5 rounded-lg border transition-all duration-200 ${
        isSelected
          ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 shadow-sm"
          : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm"
      }`}
    >
      <div className="flex items-start gap-2.5">
        <FileIcon extension={file.extension} isSelected={isSelected} />
        <div className="flex-1 min-w-0">
          <p
            className={`text-sm font-medium truncate ${
              isSelected
                ? "text-blue-800 dark:text-blue-200"
                : "text-slate-800 dark:text-slate-200"
            }`}
          >
            {file.name}
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <FileBadge extension={file.extension} />
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {formatFileSize(file.size)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

interface FileIconProps {
  extension: string;
  isSelected?: boolean;
}

function FileIcon({ extension, isSelected = false }: FileIconProps) {
  const ext = extension.toLowerCase();
  let icon = "📄";
  let bgClass = "bg-slate-100 dark:bg-slate-700";

  if ([".html", ".htm"].includes(ext)) {
    icon = "🌐";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-orange-100 dark:bg-orange-900/30";
  } else if ([".css"].includes(ext)) {
    icon = "🎨";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-pink-100 dark:bg-pink-900/30";
  } else if ([".js", ".ts", ".tsx", ".jsx"].includes(ext)) {
    icon = "📜";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-yellow-100 dark:bg-yellow-900/30";
  } else if ([".json"].includes(ext)) {
    icon = "📋";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-amber-100 dark:bg-amber-900/30";
  } else if ([".md"].includes(ext)) {
    icon = "📝";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-purple-100 dark:bg-purple-900/30";
  } else if (
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp"].includes(ext)
  ) {
    icon = "🖼️";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-green-100 dark:bg-green-900/30";
  } else if ([".xlsx", ".xls", ".csv"].includes(ext)) {
    icon = "📊";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-emerald-100 dark:bg-emerald-900/30";
  } else if ([".pdf"].includes(ext)) {
    icon = "📕";
    bgClass = isSelected
      ? "bg-blue-100 dark:bg-blue-800"
      : "bg-red-100 dark:bg-red-900/30";
  }

  return (
    <div
      className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center text-base ${bgClass}`}
    >
      {icon}
    </div>
  );
}

interface FileBadgeProps {
  extension: string;
}

function FileBadge({ extension }: FileBadgeProps) {
  const ext = extension.toLowerCase().replace(".", "");
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
      {ext}
    </span>
  );
}
