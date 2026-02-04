// API configuration - uses relative paths with Vite proxy in development
export const API_CONFIG = {
  ENDPOINTS: {
    CHAT: "/api/chat",
    ABORT: "/api/abort",
    PROJECTS: "/api/projects",
    HISTORIES: "/api/projects",
    CONVERSATIONS: "/api/projects",
    MODELS: "/api/models",
    PROVIDERS: "/api/providers",
  },
} as const;

// Helper function to get full API URL
export const getApiUrl = (endpoint: string) => {
  return endpoint;
};

// Helper function to get abort URL
export const getAbortUrl = (requestId: string) => {
  return `${API_CONFIG.ENDPOINTS.ABORT}/${requestId}`;
};

// Helper function to get chat URL
export const getChatUrl = () => {
  return API_CONFIG.ENDPOINTS.CHAT;
};

// Helper function to get projects URL
export const getProjectsUrl = () => {
  return API_CONFIG.ENDPOINTS.PROJECTS;
};

export const getModelsUrl = () => {
  return API_CONFIG.ENDPOINTS.MODELS;
};

export const getProvidersUrl = () => {
  return API_CONFIG.ENDPOINTS.PROVIDERS;
};

export const getProviderApiKeyUrl = (providerID: string) => {
  return `${API_CONFIG.ENDPOINTS.PROVIDERS}/${encodeURIComponent(providerID)}/api-key`;
};

export const getProviderOauthAuthorizeUrl = (providerID: string) => {
  return `${API_CONFIG.ENDPOINTS.PROVIDERS}/${encodeURIComponent(providerID)}/oauth/authorize`;
};

export const getProviderOauthCallbackUrl = (providerID: string) => {
  return `${API_CONFIG.ENDPOINTS.PROVIDERS}/${encodeURIComponent(providerID)}/oauth/callback`;
};

// Helper function to create project URL
export const getCreateProjectUrl = () => {
  return API_CONFIG.ENDPOINTS.PROJECTS;
};

// Helper function to get histories URL
export const getHistoriesUrl = (
  encodedProjectName: string,
  projectPath?: string,
) => {
  const encodedName = encodeURIComponent(encodedProjectName);
  const base = `${API_CONFIG.ENDPOINTS.HISTORIES}/${encodedName}/histories`;
  if (!projectPath) return base;
  return `${base}?path=${encodeURIComponent(projectPath)}`;
};

// Helper function to get conversation URL
export const getConversationUrl = (
  encodedProjectName: string,
  sessionId: string,
  projectPath?: string,
) => {
  const encodedName = encodeURIComponent(encodedProjectName);
  const base = `${API_CONFIG.ENDPOINTS.CONVERSATIONS}/${encodedName}/histories/${sessionId}`;
  if (!projectPath) return base;
  return `${base}?path=${encodeURIComponent(projectPath)}`;
};
