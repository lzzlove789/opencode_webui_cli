import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { FolderIcon, PlusIcon, XMarkIcon } from "@heroicons/react/24/outline";
import type {
  CreateProjectResponse,
  ProjectsResponse,
  ProjectInfo,
} from "../types";
import { getCreateProjectUrl, getProjectsUrl } from "../config/api";
import { SettingsButton } from "./SettingsButton";
import { SettingsModal } from "./SettingsModal";

export function ProjectSelector() {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createPath, setCreatePath] = useState("");
  const [createMissing, setCreateMissing] = useState(true);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch(getProjectsUrl());
      if (!response.ok) {
        throw new Error(`Failed to load projects: ${response.statusText}`);
      }
      const data: ProjectsResponse = await response.json();
      setProjects(data.projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  };

  const handleProjectSelect = (projectPath: string) => {
    const normalizedPath = projectPath.startsWith("/")
      ? projectPath
      : `/${projectPath}`;
    navigate(`/projects${normalizedPath}`);
  };

  const handleSettingsClick = () => {
    setIsSettingsOpen(true);
  };

  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };

  const handleCreateOpen = () => {
    setCreateError(null);
    setCreatePath("");
    setCreateMissing(true);
    setIsCreateOpen(true);
  };

  const handleCreateClose = () => {
    setIsCreateOpen(false);
  };

  const handleCreateProject = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = createPath.trim();
    if (!trimmed) {
      setCreateError("Please enter a project path.");
      return;
    }

    try {
      setCreateLoading(true);
      setCreateError(null);
      const response = await fetch(getCreateProjectUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          path: trimmed,
          create: createMissing,
        }),
      });

      const data = (await response.json()) as CreateProjectResponse;
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to create project");
      }

      await loadProjects();
      setIsCreateOpen(false);
    } catch (err) {
      setCreateError(
        err instanceof Error ? err.message : "Failed to create project",
      );
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-slate-600 dark:text-slate-400">
          Loading projects...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-600 dark:text-red-400">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-slate-800 dark:text-slate-100 text-3xl font-bold tracking-tight">
            Select a Project
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateOpen}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
            >
              <PlusIcon className="h-4 w-4" />
              New Project
            </button>
            <SettingsButton onClick={handleSettingsClick} />
          </div>
        </div>

        <div className="space-y-3">
          {projects.length > 0 && (
            <>
              <h2 className="text-slate-700 dark:text-slate-300 text-lg font-medium mb-4">
                Recent Projects
              </h2>
              {projects.map((project) => (
                <button
                  key={project.path}
                  onClick={() => handleProjectSelect(project.path)}
                  className="w-full flex items-center gap-3 p-4 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors text-left"
                >
                  <FolderIcon className="h-5 w-5 text-slate-500 dark:text-slate-400 flex-shrink-0" />
                  <span className="text-slate-800 dark:text-slate-200 font-mono text-sm">
                    {project.path}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Settings Modal */}
        <SettingsModal isOpen={isSettingsOpen} onClose={handleSettingsClose} />

        {/* Create Project Modal */}
        {isCreateOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) handleCreateClose();
            }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl max-w-lg w-full overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
                <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
                  Create Project
                </h2>
                <button
                  onClick={handleCreateClose}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  aria-label="Close create project"
                >
                  <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleCreateProject} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Project path
                  </label>
                  <input
                    type="text"
                    value={createPath}
                    onChange={(event) => setCreatePath(event.target.value)}
                    placeholder="D:\\projects\\my-app"
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-500"
                  />
                </div>

                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={createMissing}
                    onChange={(event) => setCreateMissing(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-slate-900"
                  />
                  Create directory if missing
                </label>

                {createError && (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    {createError}
                  </div>
                )}

                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleCreateClose}
                    className="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createLoading}
                    className="px-4 py-2 rounded-lg bg-slate-900 text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200 transition-colors"
                  >
                    {createLoading ? "Creating..." : "Create"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
