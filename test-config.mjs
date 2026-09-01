import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const { createJiti } = require("C:/Users/87659/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
const jiti = createJiti(import.meta.url);
const mod = await jiti("./provider-manager.ts");
const { maskKey, mergeProviders, normalizeModelItem, buildProviderRequest, default: factory } = mod;

let n = 0;
function t(name, fn) { fn(); n++; console.log("  ✓ " + name); }

const MASK = "••••••";

console.log("maskKey:");
t("未配置 → 空串，已配置 → 打码", () => {
  const out = maskKey({ deepseek: { baseUrl: "x", apiKey: "sk-123" }, free: { baseUrl: "y" } });
  assert.strictEqual(out.deepseek.apiKey, MASK);
  assert.strictEqual(out.free.apiKey, "");
});

console.log("mergeProviders:");
t("apiKey 为空 → 保留原密钥", () => {
  const orig = { a: { baseUrl: "x", apiKey: "secretA", models: [{ id: "m1", cost: { input: 1 } }] } };
  const edited = { a: { baseUrl: "x2", apiKey: "", models: [{ id: "m1" }] } };
  const r = mergeProviders(edited, orig).a;
  assert.strictEqual(r.baseUrl, "x2");
  assert.strictEqual(r.apiKey, "secretA");
  assert.deepStrictEqual(r.models[0].cost, { input: 1 }); // 模型按 id 合并，保留 cost
});
t("apiKey 为打码占位 → 保留原密钥", () => {
  const orig = { a: { apiKey: "secretA" } };
  const r = mergeProviders({ a: { apiKey: MASK } }, orig).a;
  assert.strictEqual(r.apiKey, "secretA");
});
t("apiKey 非空 → 覆盖", () => {
  const r = mergeProviders({ c: { baseUrl: "z", apiKey: "newKey" } }, {}).c;
  assert.strictEqual(r.apiKey, "newKey");
});
t("编辑集合中没有的供应商 → 被删除", () => {
  const orig = { a: { baseUrl: "x" }, b: { baseUrl: "y" } };
  const r = mergeProviders({ a: { baseUrl: "x" } }, orig);
  assert.ok(!("b" in r));
});
t("未知字段（oauth）保留", () => {
  const orig = { a: { baseUrl: "x", oauth: true } };
  const r = mergeProviders({ a: { baseUrl: "x2" } }, orig).a;
  assert.strictEqual(r.oauth, true);
});
t("模型按 id 合并并覆盖编辑字段", () => {
  const orig = { a: { models: [{ id: "m1", cost: { input: 1 }, contextWindow: 1000 }] } };
  const r = mergeProviders({ a: { models: [{ id: "m1", contextWindow: 2000 }] } }, orig).a;
  assert.strictEqual(r.models[0].cost.input, 1);
  assert.strictEqual(r.models[0].contextWindow, 2000);
});

console.log("normalizeModelItem & buildProviderRequest:");
t("Gemini 前缀去除与视觉推断", () => {
  const m = normalizeModelItem({ name: "models/gemini-1.5-pro", displayName: "Gemini 1.5 Pro", inputTokenLimit: 2000000 });
  assert.strictEqual(m.id, "gemini-1.5-pro");
  assert.strictEqual(m.name, "Gemini 1.5 Pro");
  assert.strictEqual(m.contextWindow, 2000000);
  assert.deepStrictEqual(m.input, ["text", "image"]);
});
t("推理模型自动识别 reasoning: true", () => {
  const m = normalizeModelItem("deepseek-r1-distill-qwen-32b");
  assert.strictEqual(m.id, "deepseek-r1-distill-qwen-32b");
  assert.strictEqual(m.reasoning, true);
});
t("Anthropic 鉴权头构建", () => {
  const req = buildProviderRequest("https://api.anthropic.com/v1", "anthropic-messages", "sk-ant-123");
  assert.strictEqual(req.headers["x-api-key"], "sk-ant-123");
  assert.strictEqual(req.headers["anthropic-version"], "2023-06-01");
});
t("OpenAI 鉴权头构建与 URL 备选", () => {
  const req = buildProviderRequest("https://api.example.com", "openai-completions", "sk-test");
  assert.strictEqual(req.headers["Authorization"], "Bearer sk-test");
  assert.deepStrictEqual(req.targetUrls, ["https://api.example.com/v1/models", "https://api.example.com/models"]);
});

console.log("模块:");
t("默认导出是函数（扩展工厂）", () => assert.strictEqual(typeof factory, "function"));

console.log("\n全部通过 (" + n + " 项)");
