import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import http from "node:http";
import { promises as fs } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

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

  if (req.method === "GET" && url.pathname === "/api/test") {
    const { models: modelsFile } = configPaths();
    const name = url.searchParams.get("provider") || "";
    const models = await readJson(modelsFile);
    const p = (models.providers || {})[name];
    if (!p || !p.baseUrl) return sendJson(res, 404, { ok: false, error: "供应商不存在或无 baseUrl" });
    const target = p.baseUrl.replace(/\/+$/, "") + "/models";
    const headers: Record<string, string> = { ...(p.headers || {}) };
    if (p.apiKey) headers["Authorization"] = "Bearer " + p.apiKey;
    try {
      const r = await fetch(target, { headers, signal: AbortSignal.timeout(8000) });
      const text = await r.text();
      return sendJson(res, 200, { ok: r.ok, status: r.status, body: text.slice(0, 600) });
    } catch (e) {
      return sendJson(res, 200, { ok: false, error: String((e as Error)?.message || e) });
    }
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

