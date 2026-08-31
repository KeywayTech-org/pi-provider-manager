export type Model = {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: string[];
  contextWindow?: number;
  maxTokens?: number;
  [k: string]: any;
};

export type Provider = {
  baseUrl?: string;
  api?: string;
  name?: string;
  apiKey?: string;
  headers?: any;
  compat?: any;
  models?: Model[];
  [k: string]: any;
};

export type Settings = {
  defaultProvider?: string;
  defaultModel?: string;
  defaultThinkingLevel?: string;
};

export type Config = {
  providers: Record<string, Provider>;
  settings: Settings;
};

export type SavePayload = {
  providers: Record<string, Provider>;
  settings: Settings;
};

export const API_TYPES = [
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "anthropic-messages",
  "google-generative-ai",
  "google-vertex",
  "mistral-conversations",
  "azure-openai-responses",
  "bedrock-converse-stream",
];

export const THINKING_LEVELS = [
  "off",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
];

export async function getConfig(): Promise<Config> {
  const r = await fetch("/api/config");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

export async function saveConfig(payload: SavePayload): Promise<{ ok: boolean; error?: string }> {
  const r = await fetch("/api/config", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

export async function testProvider(name: string): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  const r = await fetch("/api/test?provider=" + encodeURIComponent(name));
  return r.json();
}
