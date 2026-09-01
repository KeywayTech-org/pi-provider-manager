import { createRequire } from "node:module";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert";

const require = createRequire(import.meta.url);
const { createJiti } = require("C:/Users/87659/AppData/Roaming/npm/node_modules/@earendil-works/pi-coding-agent/node_modules/jiti");
const jiti = createJiti(import.meta.url);
const mod = await jiti("./provider-manager.ts");
const { configPaths, startServer } = mod;

const dir = mkdtempSync(join(tmpdir(), "pimgr-"));
mkdirSync(dir, { recursive: true });
process.env.PI_PROVIDER_MANAGER_CONFIG_DIR = dir;
const { models, settings } = configPaths(dir);

writeFileSync(models, JSON.stringify({
  providers: {
    deepseek: { baseUrl: "https://x/v1", api: "openai-completions", apiKey: "sk-secret", models: [{ id: "m1", cost: { input: 0.1 } }] },
    free: { baseUrl: "https://y/v1", apiKey: "", models: [{ id: "f1" }] },
  },
}, null, 2));
writeFileSync(settings, JSON.stringify({ theme: "dark", packages: ["npm:x"], defaultProvider: "deepseek" }));

const { server, port } = await startServer();
const base = "http://127.0.0.1:" + port + "/";

let n = 0;
async function t(name, fn) { try { await fn(); n++; console.log("  ✓ " + name); } catch (e) { console.log("  ✗ " + name + " — " + e); process.exitCode = 1; } }

const getc = await (await fetch(base + "api/config")).json();
await t("apiKey 打码，free 为空", () => {
  assert.strictEqual(getc.providers.deepseek.apiKey, "••••••");
  assert.strictEqual(getc.providers.free.apiKey, "");
});
await t("settings 只含已定义项", () => {
  assert.ok("defaultProvider" in getc.settings);
  assert.strictEqual(getc.settings.defaultProvider, "deepseek");
  assert.ok(!("defaultModel" in getc.settings));
});

const putRes = await (await fetch(base + "api/config", {
  method: "PUT", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    providers: { deepseek: { baseUrl: "https://new/v1", api: "openai-completions", apiKey: "", models: [{ id: "m1" }, { id: "m2", reasoning: true, input: ["text"] }] } },
    settings: { defaultProvider: "", defaultModel: "m1", defaultThinkingLevel: "high" },
  }),
})).json();
await t("PUT 返回 ok", () => assert.ok(putRes.ok));

await t("baseUrl 更新、apiKey 保留、free 删除、cost 保留", () => {
  const d = JSON.parse(readFileSync(models, "utf8")).providers;
  assert.strictEqual(d.deepseek.baseUrl, "https://new/v1");
  assert.strictEqual(d.deepseek.apiKey, "sk-secret");
  assert.ok(!("free" in d));
  assert.strictEqual(d.deepseek.models[0].cost.input, 0.1);
  assert.strictEqual(d.deepseek.models[1].id, "m2");
});
await t("默认项更新、其余保留、空值删除", () => {
  const s = JSON.parse(readFileSync(settings, "utf8"));
  assert.ok(!("defaultProvider" in s));
  assert.strictEqual(s.defaultModel, "m1");
  assert.strictEqual(s.defaultThinkingLevel, "high");
  assert.strictEqual(s.theme, "dark");
  assert.deepStrictEqual(s.packages, ["npm:x"]);
});

await t("PUT 已自动备份", () => {
  const bk = join(dir, "models.backups");
  const files = fs.readdirSync(bk).filter(f => f.startsWith("models-"));
  assert.strictEqual(files.length, 1);
  const saved = JSON.parse(fs.readFileSync(join(bk, files[0]), "utf8"));
  assert.strictEqual(saved.providers.free.baseUrl, "https://y/v1"); // 备份是 PUT 前的原始内容
});

const modelFetchMissing = await (await fetch(base + "api/models", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ baseUrl: "" }),
})).json();
await t("POST /api/models 无 baseUrl 时返回错误", () => {
  assert.strictEqual(modelFetchMissing.ok, false);
  assert.match(modelFetchMissing.error, /Base URL/);
});

await t("首页返回 HTML", async () => {
  const r = await fetch(base);
  assert.match(await r.text(), /pi Provider Manager/);
});

server.close();
rmSync(dir, { recursive: true, force: true });
console.log("\n端到端测试完成" + (process.exitCode ? "（有失败）" : "（全部通过 " + n + " 项）"));
