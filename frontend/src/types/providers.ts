export type ProviderAuthMethod = {
  type: "api" | "oauth";
  label: string;
};

export type ProviderInfo = {
  id: string;
  name?: string;
  description?: string;
  models?: Record<string, { id: string; name?: string }>;
};

export type ProvidersResponse = {
  providers: ProviderInfo[];
  defaults: Record<string, string>;
  connected: string[];
  authMethods: Record<string, ProviderAuthMethod[]>;
  error?: string;
};
