import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import {
  getProvidersUrl,
  getProviderApiKeyUrl,
  getProviderOauthAuthorizeUrl,
  getProviderOauthCallbackUrl,
} from "../config/api";
import type {
  ProviderAuthMethod,
  ProviderInfo,
  ProvidersResponse,
} from "../types/providers";

interface ConnectProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type OAuthInfo = {
  url: string;
  method: "auto" | "code";
  instructions?: string;
};

const POPULAR_PROVIDERS = [
  "opencode",
  "anthropic",
  "openai",
  "google",
  "github-copilot",
  "openrouter",
  "modelscope",
  "moonshot",
  "moonshot-ai",
  "moonshot-ai-china",
  "qwen",
  "zai-coding-plan",
];

const POPULAR_SET = new Set(POPULAR_PROVIDERS);

const PROVIDER_HINTS: Record<string, string> = {
  opencode: "Create an API key at https://opencode.ai/auth",
  openai: "Use your OpenAI API key",
  anthropic: "Use your Anthropic API key",
  google: "Use your Google AI Studio API key",
  openrouter: "Use your OpenRouter API key",
  vercel: "Create a token at https://vercel.link/ai-gateway-token",
};

export function ConnectProviderModal({
  isOpen,
  onClose,
}: ConnectProviderModalProps) {
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [connected, setConnected] = useState<string[]>([]);
  const [authMethods, setAuthMethods] = useState<
    Record<string, ProviderAuthMethod[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [methodIndex, setMethodIndex] = useState(0);
  const [apiKey, setApiKey] = useState("");
  const [oauthInfo, setOauthInfo] = useState<OAuthInfo | null>(null);
  const [oauthCode, setOauthCode] = useState("");
  const [actionState, setActionState] = useState<
    "idle" | "working" | "success" | "error"
  >("idle");

  const loadProviders = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(getProvidersUrl());
      const payload = (await response.json().catch(() => ({}))) as ProvidersResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load providers (${response.status})`);
      }
      const data = payload;
      setProviders(data.providers || []);
      setConnected(data.connected || []);
      setAuthMethods(data.authMethods || {});
      if (!selectedId && data.providers?.length) {
        setSelectedId(data.providers[0].id);
      }
    } catch (err) {
      console.error("Failed to load providers:", err);
      setError("Failed to load providers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    loadProviders();
  }, [isOpen]);

  useEffect(() => {
    setMethodIndex(0);
    setApiKey("");
    setOauthInfo(null);
    setOauthCode("");
    setActionState("idle");
  }, [selectedId]);

  useEffect(() => {
    setOauthInfo(null);
    setOauthCode("");
    setActionState("idle");
  }, [methodIndex]);

  const filteredProviders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return providers;
    return providers.filter((provider) => {
      const name = provider.name?.toLowerCase() || "";
      const id = provider.id.toLowerCase();
      return name.includes(query) || id.includes(query);
    });
  }, [providers, search]);

  const [popularProviders, otherProviders] = useMemo(() => {
    const popular: ProviderInfo[] = [];
    const other: ProviderInfo[] = [];
    const list = filteredProviders.slice().sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id),
    );
    for (const provider of list) {
      if (POPULAR_SET.has(provider.id)) {
        popular.push(provider);
        continue;
      }
      other.push(provider);
    }
    return [popular, other];
  }, [filteredProviders]);

  const selectedProvider = useMemo(() => {
    if (!selectedId) return undefined;
    return providers.find((p) => p.id === selectedId);
  }, [providers, selectedId]);

  const providerMethods = useMemo(() => {
    if (!selectedProvider) return [] as ProviderAuthMethod[];
    const methods = authMethods[selectedProvider.id] || [];
    if (methods.length > 0) return methods;
    return [{ type: "api", label: "API key" }];
  }, [authMethods, selectedProvider]);
  const selectedMethod = providerMethods[methodIndex];
  const isConnected = selectedProvider
    ? connected.includes(selectedProvider.id)
    : false;

  const handleApiKeySave = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setActionState("working");
    try {
      const response = await fetch(
        getProviderApiKeyUrl(selectedProvider.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: apiKey.trim() }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to save key (${response.status})`);
      }
      setActionState("success");
      setApiKey("");
      await loadProviders();
    } catch (err) {
      console.error("Failed to save api key:", err);
      setActionState("error");
    }
  };

  const handleOauthStart = async () => {
    if (!selectedProvider) return;
    setActionState("working");
    try {
      const response = await fetch(
        getProviderOauthAuthorizeUrl(selectedProvider.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ method: methodIndex }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to start oauth (${response.status})`);
      }
      const data = (await response.json()) as OAuthInfo | null;
      if (!data?.url) {
        throw new Error("Missing oauth url");
      }
      setOauthInfo(data);
      setActionState("idle");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      console.error("Failed to start oauth:", err);
      setActionState("error");
    }
  };

  const handleOauthComplete = async () => {
    if (!selectedProvider || !oauthInfo) return;
    if (oauthInfo.method === "code" && !oauthCode.trim()) return;
    setActionState("working");
    try {
      const response = await fetch(
        getProviderOauthCallbackUrl(selectedProvider.id),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            method: methodIndex,
            code: oauthInfo.method === "code" ? oauthCode.trim() : undefined,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`Failed to complete oauth (${response.status})`);
      }
      setActionState("success");
      setOauthInfo(null);
      setOauthCode("");
      await loadProviders();
    } catch (err) {
      console.error("Failed to complete oauth:", err);
      setActionState("error");
    }
  };

  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">
              Connect a Provider
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Add API keys or complete OAuth to unlock models
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            aria-label="Close connect modal"
          >
            <XMarkIcon className="w-5 h-5 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="flex h-[70vh]">
          <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 p-4 flex flex-col gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search providers"
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1 overflow-y-auto">
              {loading && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Loading providers...
                </div>
              )}
              {!loading && filteredProviders.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No providers found
                </div>
              )}
              <ul className="space-y-4">
                {popularProviders.length > 0 && (
                  <li>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                      Popular
                    </div>
                    <ul className="space-y-1">
                      {popularProviders.map((provider) => (
                        <li key={provider.id}>
                          <button
                            onClick={() => setSelectedId(provider.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              provider.id === selectedId
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{provider.name || provider.id}</span>
                              {connected.includes(provider.id) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                  Connected
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {provider.id}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
                {otherProviders.length > 0 && (
                  <li>
                    <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500 mb-2">
                      Other
                    </div>
                    <ul className="space-y-1">
                      {otherProviders.map((provider) => (
                        <li key={provider.id}>
                          <button
                            onClick={() => setSelectedId(provider.id)}
                            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                              provider.id === selectedId
                                ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200"
                                : "hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span>{provider.name || provider.id}</span>
                              {connected.includes(provider.id) && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                                  Connected
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-500">
                              {provider.id}
                            </div>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </li>
                )}
              </ul>
            </div>
            <div className="text-xs text-slate-400 dark:text-slate-500">
              {error || "Select a provider to connect"}
            </div>
          </div>

          <div className="flex-1 p-6 overflow-y-auto">
            {!selectedProvider && (
              <div className="text-sm text-slate-500 dark:text-slate-400">
                Choose a provider to continue.
              </div>
            )}
            {selectedProvider && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {selectedProvider.name || selectedProvider.id}
                    </h3>
                    <div className="text-sm text-slate-500 dark:text-slate-400">
                      Provider ID: {selectedProvider.id}
                    </div>
                  </div>
                  {isConnected && (
                    <div className="text-xs px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-200">
                      Connected
                    </div>
                  )}
                </div>

                {providerMethods.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Auth method
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {providerMethods.map((method, index) => (
                        <button
                          key={`${method.label}-${index}`}
                          onClick={() => setMethodIndex(index)}
                          className={`px-3 py-1 text-xs rounded-full border ${
                            index === methodIndex
                              ? "border-blue-500 text-blue-600 dark:text-blue-300"
                              : "border-slate-300 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {method.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!selectedMethod && (
                  <div className="text-sm text-slate-500 dark:text-slate-400">
                    This provider does not expose an interactive auth method.
                  </div>
                )}

                {selectedProvider && PROVIDER_HINTS[selectedProvider.id] && (
                  <div className="text-xs text-slate-400 dark:text-slate-500">
                    {PROVIDER_HINTS[selectedProvider.id]}
                  </div>
                )}

                {selectedMethod?.type === "api" && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      API key
                    </label>
                    <input
                      type="password"
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Paste your API key"
                      className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleApiKeySave}
                        disabled={!apiKey.trim() || actionState === "working"}
                        className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                      >
                        Save API Key
                      </button>
                      {actionState === "success" && (
                        <span className="text-xs text-emerald-600 dark:text-emerald-400">
                          Saved
                        </span>
                      )}
                      {actionState === "error" && (
                        <span className="text-xs text-red-500">Failed</span>
                      )}
                    </div>
                  </div>
                )}

                {selectedMethod?.type === "oauth" && (
                  <div className="space-y-4">
                    <button
                      onClick={handleOauthStart}
                      disabled={actionState === "working"}
                      className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                    >
                      Start OAuth
                    </button>
                    {oauthInfo && (
                      <div className="space-y-3 rounded-lg border border-slate-200 dark:border-slate-600 p-4">
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {oauthInfo.instructions || "Open the link to authorize."}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={oauthInfo.url}
                            className="flex-1 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg"
                          />
                          <button
                            onClick={() =>
                              window.open(oauthInfo.url, "_blank", "noopener,noreferrer")
                            }
                            className="px-3 py-2 text-xs rounded-lg border border-slate-300 dark:border-slate-600"
                          >
                            Open
                          </button>
                        </div>
                        {oauthInfo.method === "code" && (
                          <input
                            value={oauthCode}
                            onChange={(e) => setOauthCode(e.target.value)}
                            placeholder="Paste authorization code"
                            className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        )}
                        <button
                          onClick={handleOauthComplete}
                          disabled={
                            actionState === "working" ||
                            (oauthInfo.method === "code" && !oauthCode.trim())
                          }
                          className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed"
                        >
                          Complete OAuth
                        </button>
                        {actionState === "success" && (
                          <span className="text-xs text-emerald-600 dark:text-emerald-400">
                            Connected
                          </span>
                        )}
                        {actionState === "error" && (
                          <span className="text-xs text-red-500">Failed</span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
