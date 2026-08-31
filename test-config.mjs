import { createRequire } from "node:module";
import assert from "node:assert";
const require = createRequire(import.meta.url);
const { createJiti } = require("C:/Users/87659/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
const jiti = createJiti(import.meta.url);
const mod = await jiti("./provider-manager.ts");
const { maskKey, mergeProviders, default: factory } = mod;

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

console.log("模块:");
t("默认导出是函数（扩展工厂）", () => assert.strictEqual(typeof factory, "function"));

console.log("\n全部通过 (" + n + " 项)");
