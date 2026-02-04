import { Context } from "hono";
import { ensureOpencodeServer, restartOpencodeServer } from "../opencode/server.ts";
import { setApiKey } from "../opencode/auth.ts";
import { logger } from "../utils/logger.ts";

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Request failed (${response.status}): ${text}`);
  }
  return response.json();
}

export async function handleProvidersRequest(c: Context) {
  try {
    const baseUrl = await ensureOpencodeServer(c.var.config);
    const [providers, authMethods] = await Promise.all([
      fetchJson(new URL("/provider", baseUrl).toString()),
      fetchJson(new URL("/provider/auth", baseUrl).toString()),
    ]);

    return c.json({
      providers: providers.all,
      defaults: providers.default,
      connected: providers.connected,
      authMethods,
    });
  } catch (error) {
    logger.api.error("Failed to load providers: {error}", { error });
    const message = error instanceof Error ? error.message : "Failed to load providers";
    return c.json(
      {
        providers: [],
        defaults: {},
        connected: [],
        authMethods: {},
        error: message,
      },
      500,
    );
  }
}

export async function handleProviderApiKey(c: Context) {
  const providerID = c.req.param("providerID");
  const body = await c.req.json().catch(() => ({} as { key?: string }));
  const key = typeof body.key === "string" ? body.key.trim() : "";

  if (!providerID || !key) {
    return c.json({ ok: false, error: "Missing provider or key" }, 400);
  }

  try {
    await setApiKey(providerID, key);
    await restartOpencodeServer(c.var.config);
    return c.json({ ok: true });
  } catch (error) {
    logger.api.error("Failed to store api key: {error}", { error });
    return c.json({ ok: false, error: "Failed to store key" }, 500);
  }
}

export async function handleProviderOauthAuthorize(c: Context) {
  const providerID = c.req.param("providerID");
  const body = await c.req.json().catch(() => ({} as { method?: number }));
  const method = typeof body.method === "number" ? body.method : -1;

  if (!providerID || method < 0) {
    return c.json({ error: "Missing provider or method" }, 400);
  }

  try {
    const baseUrl = await ensureOpencodeServer(c.var.config);
    const result = await fetchJson(
      new URL(`/provider/${providerID}/oauth/authorize`, baseUrl).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      },
    );
    return c.json(result);
  } catch (error) {
    logger.api.error("Failed to authorize oauth: {error}", { error });
    return c.json({ error: "Failed to authorize" }, 500);
  }
}

export async function handleProviderOauthCallback(c: Context) {
  const providerID = c.req.param("providerID");
  const body = await c.req.json().catch(() => ({} as { method?: number; code?: string }));
  const method = typeof body.method === "number" ? body.method : -1;
  const code = typeof body.code === "string" ? body.code.trim() : undefined;

  if (!providerID || method < 0) {
    return c.json({ error: "Missing provider or method" }, 400);
  }

  try {
    const baseUrl = await ensureOpencodeServer(c.var.config);
    await fetchJson(
      new URL(`/provider/${providerID}/oauth/callback`, baseUrl).toString(),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, code }),
      },
    );
    await restartOpencodeServer(c.var.config);
    return c.json({ ok: true });
  } catch (error) {
    logger.api.error("Failed to complete oauth: {error}", { error });
    return c.json({ error: "Failed to complete oauth" }, 500);
  }
}
