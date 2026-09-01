import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import http from "node:http";
import { promises as fs, appendFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

/** 追加一行到 ~/.pi/agent/pm-debug.log 并同步打印到 stderr。 */
function pmLog(msg: string): void {
  const ts = new Date().toISOString().slice(0, 19).replace("T", " ");
  const line = `[${ts}] ${msg}\n`;
  try { appendFileSync(join(homedir(), ".pi", "agent", "pm-debug.log"), line, "utf8"); } catch {}
  console.error("[provider-manager]", msg);
}

const MASK = "••••••";
const DEFAULT_SETTINGS_KEYS = ["defaultProvider", "defaultModel", "defaultThinkingLevel"];

/** 前端构建产物目录（web/dist）；可用环境变量覆盖（便于测试/自定义）。 */
const WEB_DIST =
	process.env.PI_PROVIDER_MANAGER_WEB_DIR ||
	join(dirname(fileURLToPath(import.meta.url)), "web", "dist");

/** 配置文件路径；可用环境变量覆盖（便于测试 / 自定义位置）。 */
export function configPaths(configDir?: string) {
  const dir =
    configDir || process.env.PI_PROVIDER_MANAGER_CONFIG_DIR || join(homedir(), ".pi", "agent");
  return {
    models: join(dir, "models.json"),
    settings: join(dir, "settings.json"),
  };
}

/* ------------------------------- 纯逻辑 ------------------------------- */

/** GET 读回时把 apiKey 打码，真实密钥不出现在响应里。 */
export function maskKey(providers: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [name, p] of Object.entries(providers || {})) {
    out[name] = { ...p, apiKey: p.apiKey ? MASK : "" };
  }
  return out;
}

export interface NormalizedModel {
  id: string;
  name?: string;
  reasoning?: boolean;
  input?: ("text" | "image")[];
  contextWindow?: number;
  maxTokens?: number;
  [k: string]: any;
}

export function isReasoningModel(id: string): boolean {
  return /o1|o3|r1|reasoner|thinking|deepseek-r1|qwq/i.test(id);
}

export function isVisionModel(id: string): boolean {
  return /4o|vision|vl|omni|claude-3|gemini|pixtral|qwen.*vl|florence|llava|glm-4v/i.test(id);
}

export function normalizeModelItem(m: any): NormalizedModel | null {
  if (!m) return null;
  const rawId = typeof m === "string" ? m : m.id || m.name || "";
  if (!rawId || typeof rawId !== "string") return null;

  // 剔除 Google Gemini 等返回的 "models/" 前缀
  const id = rawId.startsWith("models/") ? rawId.slice(7) : rawId;
  const rawName = typeof m === "object" && (m.displayName || m.name || m.display_name);
  const name = rawName && typeof rawName === "string" && rawName !== rawId ? rawName : undefined;

  const reasoning = typeof m === "object" && m.reasoning !== undefined
    ? Boolean(m.reasoning)
    : isReasoningModel(id);

  let input: ("text" | "image")[] = ["text"];
  if (typeof m === "object" && Array.isArray(m.input)) {
    input = m.input.filter((x: any) => x === "text" || x === "image");
  } else if (isVisionModel(id)) {
    input = ["text", "image"];
  }

  const rawContext = typeof m === "object"
    ? (m.contextWindow || m.context_window || m.context_length || m.inputTokenLimit || m.max_input_tokens || m.max_context_length || m.max_model_len)
    : undefined;
  const contextWindow = typeof rawContext === "number" && !isNaN(rawContext) && rawContext > 0 ? rawContext : undefined;

  const rawMaxTokens = typeof m === "object"
    ? (m.maxTokens || m.max_tokens || m.max_output_tokens || m.outputTokenLimit || m.top_provider?.max_completion_tokens)
    : undefined;
  const maxTokens = typeof rawMaxTokens === "number" && !isNaN(rawMaxTokens) && rawMaxTokens > 0 ? rawMaxTokens : undefined;

  const res: NormalizedModel = { id };
  if (name) res.name = name;
  if (reasoning) res.reasoning = true;
  if (input.length > 0) res.input = input;
  if (contextWindow) res.contextWindow = contextWindow;
  if (maxTokens) res.maxTokens = maxTokens;

  return res;
}

export function buildProviderRequest(
  baseUrl: string,
  api?: string,
  apiKey?: string,
  customHeaders?: Record<string, string>
): { targetUrls: string[]; headers: Record<string, string> } {
  const cleanBase = baseUrl.trim().replace(/\/+$/, "");
  const headers: Record<string, string> = { ...(customHeaders || {}) };

  const key = apiKey?.trim();
  if (key && key !== MASK) {
    if (api === "anthropic-messages") {
      headers["x-api-key"] = key;
      if (!headers["anthropic-version"]) headers["anthropic-version"] = "2023-06-01";
    } else if (api === "google-generative-ai" || cleanBase.includes("googleapis.com")) {
      headers["x-goog-api-key"] = key;
    } else if (api === "azure-openai-responses") {
      headers["api-key"] = key;
    } else {
      headers["Authorization"] = "Bearer " + key;
    }
  }

  const targetUrls: string[] = [];
  if (cleanBase.includes(":11434") || cleanBase.includes("ollama")) {
    targetUrls.push(`${cleanBase}/v1/models`, `${cleanBase}/api/tags`, `${cleanBase}/models`);
  } else if (api === "google-generative-ai" || cleanBase.includes("googleapis.com")) {
    targetUrls.push(`${cleanBase}/models`, `${cleanBase}/v1beta/models`);
  } else {
    // 大多数 OpenAI-compatible 供应商通过 /v1/models，先试它；/models 作为备选
    if (!cleanBase.endsWith("/v1")) {
      targetUrls.push(`${cleanBase}/v1/models`);
    }
    targetUrls.push(`${cleanBase}/models`);
  }

  return { targetUrls, headers };
}

/**
 * 从供应商拉取模型列表，支持传入草稿参数（baseUrl/apiKey/headers/api）或按 provider 查磁盘。
 */
export async function fetchRemoteModels(params: {
  provider?: string;
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}): Promise<{ ok: boolean; models?: NormalizedModel[]; error?: string; attempts?: string[] }> {
  const { models: modelsFile } = configPaths();
  const diskModels = await readJson(modelsFile);
  const diskProvider = params.provider ? (diskModels.providers || {})[params.provider] : undefined;

  let baseUrl = params.baseUrl || diskProvider?.baseUrl;
  if (!baseUrl) return { ok: false, error: "请提供 Base URL" };
  baseUrl = baseUrl.trim();

  const api = params.api || diskProvider?.api || "openai-completions";
  let apiKey = params.apiKey;
  if (apiKey === undefined || apiKey === "" || apiKey === MASK) {
    apiKey = diskProvider?.apiKey || "";
  }
  const headers = { ...(diskProvider?.headers || {}), ...(params.headers || {}) };

  const { targetUrls, headers: reqHeaders } = buildProviderRequest(baseUrl, api, apiKey, headers);

  pmLog(`fetchRemoteModels start: urls=${JSON.stringify(targetUrls)} api=${api}`);
  const attempts: string[] = [];
  let lastError = "";
  let lastStatus = 0;

  for (const target of targetUrls) {
    try {
      pmLog(`  → trying: ${target}`);
      const r = await fetch(target, { headers: reqHeaders, signal: AbortSignal.timeout(15000) });
      lastStatus = r.status;
      const attemptBase = `GET ${target} → ${r.status}`;
      if (r.status === 404 && targetUrls.length > 1) {
        attempts.push(attemptBase + " (404, skipped)");
        pmLog(`  ← ${attemptBase} (404, try next)`);
        continue;
      }
      if (!r.ok) {
        const errText = (await r.text().catch(() => "")).slice(0, 300);
        lastError = `HTTP ${r.status}${errText ? ": " + errText : ""}`;
        attempts.push(`${attemptBase} (${errText.slice(0, 80)})`);
        pmLog(`  ✗ ${attemptBase}: ${errText.slice(0, 80)}`);
        continue;
      }
      const json = await r.json();
      const rawList = Array.isArray(json)
        ? json
        : Array.isArray(json.data)
        ? json.data
        : Array.isArray(json.models)
        ? json.models
        : Array.isArray(json.result)
        ? json.result
        : [];

      const list = rawList.map(normalizeModelItem).filter(Boolean) as NormalizedModel[];
      attempts.push(`${attemptBase} ✓ (${list.length} models)`);
      pmLog(`  ✓ ${target}: got ${list.length} models`);
      return { ok: true, models: list, attempts };
    } catch (e) {
      lastError = String((e as Error)?.message || e);
      attempts.push(`GET ${target} → ERROR: ${lastError}`);
      pmLog(`  ✗ ${target}: ${lastError}`);
    }
  }

  pmLog(`fetchRemoteModels failed: ${lastError || lastStatus}`);
  return { ok: false, error: lastError || (lastStatus ? `HTTP ${lastStatus}` : "请求失败"), attempts };
}

/**
 * 测试供应商连通性，支持草稿参数。
 */
export async function testRemoteProvider(params: {
  provider?: string;
  baseUrl?: string;
  api?: string;
  apiKey?: string;
  headers?: Record<string, string>;
}): Promise<{ ok: boolean; status?: number; body?: string; error?: string }> {
  const { models: modelsFile } = configPaths();
  const diskModels = await readJson(modelsFile);
  const diskProvider = params.provider ? (diskModels.providers || {})[params.provider] : undefined;

  let baseUrl = params.baseUrl || diskProvider?.baseUrl;
  if (!baseUrl) return { ok: false, error: "请提供 Base URL" };
  baseUrl = baseUrl.trim();

  const api = params.api || diskProvider?.api || "openai-completions";
  let apiKey = params.apiKey;
  if (apiKey === undefined || apiKey === "" || apiKey === MASK) {
    apiKey = diskProvider?.apiKey || "";
  }
  const headers = { ...(diskProvider?.headers || {}), ...(params.headers || {}) };

  const { targetUrls, headers: reqHeaders } = buildProviderRequest(baseUrl, api, apiKey, headers);

  pmLog(`testRemoteProvider start: urls=${JSON.stringify(targetUrls)} api=${api}`);
  let lastResult: { ok: boolean; status?: number; body?: string; error?: string } = {
    ok: false,
    error: "连接失败",
  };

  for (const target of targetUrls) {
    try {
      pmLog(`  → trying: ${target}`);
      const r = await fetch(target, { headers: reqHeaders, signal: AbortSignal.timeout(8000) });
      const text = await r.text();
      pmLog(`  ← ${target} → ${r.status}`);
      if (r.status === 404 && targetUrls.length > 1) {
        lastResult = { ok: false, status: r.status, body: text.slice(0, 600) };
        continue;
      }
      return { ok: r.ok, status: r.status, body: text.slice(0, 600) };
    } catch (e) {
      lastResult = { ok: false, error: String((e as Error)?.message || e) };
      pmLog(`  ✗ ${target}: ${lastResult.error}`);
    }
  }

  return lastResult;
}

/**
 * 把前端传来的【目标 providers】合并到【磁盘上的原始 providers】。
 * - 只保留前端出现的供应商（未出现 = 被删除）
 * - 供应商层 spread 原对象，覆盖已知编辑字段，保留未知字段（oauth 等）
 * - apiKey：空/打码 → 保留原值；非空 → 覆盖
 * - 模型层按 id 合并，保留 UI 不编辑的字段（cost/compat/thinkingLevelMap）
 */
export function mergeProviders(edited: Record<string, any>, original: Record<string, any>): Record<string, any> {
  const orig = original || {};
  const out: Record<string, any> = {};
  for (const name of Object.keys(edited || {})) {
    const e = edited[name] || {};
    const o = orig[name] || {};
    const merged: Record<string, any> = {
      ...o,
      ...(e.baseUrl !== undefined ? { baseUrl: e.baseUrl } : {}),
      ...(e.name !== undefined ? { name: e.name } : {}),
      ...(e.api !== undefined ? { api: e.api } : {}),
      ...(e.headers !== undefined ? { headers: e.headers } : {}),
      ...(e.compat !== undefined ? { compat: e.compat } : {}),
    };
    if (e.apiKey !== undefined && e.apiKey !== "" && e.apiKey !== MASK) merged.apiKey = e.apiKey;
    else if (o.apiKey !== undefined && o.apiKey !== "") merged.apiKey = o.apiKey;
    else delete merged.apiKey;

    if (e.models !== undefined) {
      const origById: Record<string, any> = {};
      for (const m of o.models || []) origById[m.id] = m;
      merged.models = e.models.map((m: any) => ({ ...(origById[m.id] || {}), ...m }));
    }
    out[name] = merged;
  }
  return out;
}

/* ------------------------------- 文件工具 ------------------------------- */

async function readJson(file: string): Promise<any> {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return {};
  }
}

async function writeJson(file: string, data: any): Promise<void> {
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

/* ------------------------------- HTTP ------------------------------- */

function send(res: http.ServerResponse, status: number, type: string, body: string): void {
  res.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store" });
  res.end(body);
}
function sendJson(res: http.ServerResponse, status: number, data: any): void {
  send(res, status, "application/json; charset=utf-8", JSON.stringify(data));
}

function mimeType(file: string): string {
  if (file.endsWith(".html")) return "text/html; charset=utf-8";
  if (file.endsWith(".js")) return "text/javascript";
  if (file.endsWith(".css")) return "text/css";
  if (file.endsWith(".svg")) return "image/svg+xml";
  if (file.endsWith(".json")) return "application/json";
  if (file.endsWith(".png")) return "image/png";
  if (file.endsWith(".woff2")) return "font/woff2";
  if (file.endsWith(".woff")) return "font/woff";
  if (file.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

/** 从 web/dist 同步静态资源（index.html / assets/*），不做缓存以便开发迭代。 */
async function serveFile(res: http.ServerResponse, file: string): Promise<void> {
  try {
    const data = await fs.readFile(file);
    res.writeHead(200, { "Content-Type": mimeType(file), "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    send(res, 404, "text/plain; charset=utf-8", "not found");
  }
}
function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => {
      data += c;
      if (data.length > 5_000_000) req.destroy();
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

/** 写入 models.json 前自动备份，保留最近 10 份。 */
async function backupModels(file: string): Promise<void> {
  try {
    const data = await fs.readFile(file, "utf8");
    const dir = join(file, "..", "models.backups");
    await fs.mkdir(dir, { recursive: true });
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    await fs.writeFile(join(dir, "models-" + ts + ".json"), data);
    const files = (await fs.readdir(dir)).filter((f) => f.startsWith("models-")).sort();
    while (files.length > 10) await fs.rm(join(dir, files.shift() as string), { force: true });
  } catch {
    /* 备份失败不阻断保存 */
  }
}

async function handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  const url = new URL(req.url || "/", "http://127.0.0.1");

  if (req.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/assets/"))) {
    const rel = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = join(WEB_DIST, rel);
    if (!file.startsWith(WEB_DIST)) return sendJson(res, 403, { ok: false, error: "forbidden" });
    return serveFile(res, file);
  }

  if (req.method === "GET" && url.pathname === "/api/config") {
    const { models: modelsFile, settings: settingsFile } = configPaths();
    const models = await readJson(modelsFile);
    const settings = await readJson(settingsFile);
    return sendJson(res, 200, {
      providers: maskKey(models.providers || {}),
      settings: {
        defaultProvider: settings.defaultProvider,
        defaultModel: settings.defaultModel,
        defaultThinkingLevel: settings.defaultThinkingLevel,
      },
    });
  }

  if (req.method === "PUT" && url.pathname === "/api/config") {
    const { models: modelsFile, settings: settingsFile } = configPaths();
    const body = JSON.parse((await readBody(req)) || "{}");
    const current = await readJson(modelsFile);
    const merged = mergeProviders(body.providers || {}, current.providers || {});
    await backupModels(modelsFile);
    await writeJson(modelsFile, { ...current, providers: merged });

    if (body.settings) {
      const cur = await readJson(settingsFile);
      const next = { ...cur };
      for (const k of DEFAULT_SETTINGS_KEYS) {
        const v = body.settings[k];
        if (v === undefined) continue;
        if (v === "" || v === null) delete next[k];
        else next[k] = v;
      }
      await writeJson(settingsFile, next);
    }
    return sendJson(res, 200, { ok: true });
  }

  if ((req.method === "GET" || req.method === "POST") && url.pathname === "/api/models") {
    let params: any = {};
    if (req.method === "POST") {
      params = JSON.parse((await readBody(req)) || "{}");
    } else {
      params = {
        provider: url.searchParams.get("provider") || undefined,
        baseUrl: url.searchParams.get("baseUrl") || undefined,
        api: url.searchParams.get("api") || undefined,
        apiKey: url.searchParams.get("apiKey") || undefined,
      };
    }
    const result = await fetchRemoteModels(params);
    return sendJson(res, result.ok ? 200 : 400, result);
  }

  if ((req.method === "GET" || req.method === "POST") && url.pathname === "/api/test") {
    let params: any = {};
    if (req.method === "POST") {
      params = JSON.parse((await readBody(req)) || "{}");
    } else {
      params = {
        provider: url.searchParams.get("provider") || undefined,
        baseUrl: url.searchParams.get("baseUrl") || undefined,
        api: url.searchParams.get("api") || undefined,
        apiKey: url.searchParams.get("apiKey") || undefined,
      };
    }
    const result = await testRemoteProvider(params);
    return sendJson(res, 200, result);
  }

  if (req.method === "GET" && url.pathname === "/api/log") {
    const logPath = join(homedir(), ".pi", "agent", "pm-debug.log");
    let content = "";
    try { content = readFileSync(logPath, "utf8"); } catch {}
    const lines = content.split("\n");
    const tail = lines.slice(-200).join("\n");
    return sendJson(res, 200, { ok: true, content: tail });
  }

  return sendJson(res, 404, { ok: false, error: "not found" });
}

export function startServer(): Promise<{ server: http.Server; port: number }> {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      handle(req, res).catch((e) => sendJson(res, 500, { ok: false, error: String(e) }));
    });
    server.unref();
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === "object" && addr ? addr.port : 0 });
    });
    server.on("error", (e) => console.error("[provider-manager]", e));
  });
}

function openBrowser(url: string): void {
  try {
    if (process.platform === "win32") spawn("cmd", ["/c", "start", "", url], { stdio: "ignore", detached: true }).unref();
    else if (process.platform === "darwin") spawn("open", [url], { stdio: "ignore", detached: true }).unref();
    else spawn("xdg-open", [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    /* ignore */
  }
}

/* ------------------------------- 扩展入口 ------------------------------- */

export default function (pi: ExtensionAPI) {
  let server: http.Server | null = null;
  let port = 0;

  pi.on("session_shutdown", () => {
    if (server) {
      try {
        server.close();
      } catch {
        /* ignore */
      }
      server = null;
    }
  });

  pi.registerCommand("providers", {
    description: "启动供应商/模型管理 Web 页面（编辑 models.json + 默认设置）",
    handler: async (_args, ctx) => {
      if (!server) {
        const started = await startServer();
        server = started.server;
        port = started.port;
      }
      const url = "http://127.0.0.1:" + port + "/";
      openBrowser(url);
      ctx.ui.notify("Provider Manager: " + url, "info");
    },
  });
}

