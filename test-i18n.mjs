import assert from "node:assert";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url);
const i18n = await jiti("./web/src/i18n/locale.ts");
const { MESSAGES, LOCALES, interpolate, resolveLocale, translate } = i18n;

const { en } = MESSAGES;
const enKeys = Object.keys(en).sort();

let n = 0;
let failed = 0;
function t(name, fn) {
  try {
    fn();
    n++;
    console.log("  ✓ " + name);
  } catch (e) {
    failed++;
    console.log("  ✗ " + name + " — " + e.message);
    process.exitCode = 1;
  }
}

function placeholders(s) {
  return [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

console.log("dictionaries:");
t("en and zh are the registered locales", () => {
  assert.deepStrictEqual([...LOCALES].sort(), ["en", "zh"]);
});

t("every locale defines the same keys", () => {
  for (const locale of LOCALES) {
    assert.deepStrictEqual(Object.keys(MESSAGES[locale]).sort(), enKeys, "locale: " + locale);
  }
});

t("no empty values", () => {
  for (const locale of LOCALES) {
    for (const key of enKeys) {
      assert.ok(String(MESSAGES[locale][key]).trim().length > 0, locale + " " + key + " is empty");
    }
  }
});

t("{placeholders} match across locales", () => {
  for (const locale of LOCALES) {
    for (const key of enKeys) {
      assert.deepStrictEqual(
        placeholders(MESSAGES[locale][key]),
        placeholders(en[key]),
        locale + " " + key + ": " + JSON.stringify(MESSAGES[locale][key])
      );
    }
  }
});

t("keys are named <area>.<camelCase>", () => {
  for (const key of enKeys) assert.match(key, /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z0-9]*$/, key);
});

console.log("\ninterpolate:");
t("substitutes provided variables", () => {
  assert.strictEqual(interpolate("Saved {count} of {total}", { count: 3, total: 5 }), "Saved 3 of 5");
});

t("keeps unknown placeholders untouched", () => {
  assert.strictEqual(interpolate("Hello {name}", {}), "Hello {name}");
});

t("is a no-op without vars", () => {
  assert.strictEqual(interpolate("plain text"), "plain text");
});

t("translate() picks the requested locale", () => {
  assert.strictEqual(translate("en", "editor.save"), "Save provider");
  assert.strictEqual(translate("zh", "editor.save"), "保存供应商");
});

t("translate() interpolates vars", () => {
  assert.ok(translate("en", "app.deleteDescription", { name: "deepseek" }).startsWith("This will delete deepseek"));
});

console.log("\nresolveLocale:");
t("?lang= wins over everything", () => {
  assert.strictEqual(resolveLocale({ search: "?lang=zh", stored: "en", languages: ["en-US"] }), "zh");
});

t("stored choice wins over navigator", () => {
  assert.strictEqual(resolveLocale({ search: "", stored: "en", languages: ["zh-CN"] }), "en");
});

t("navigator.languages detects Chinese", () => {
  assert.strictEqual(resolveLocale({ search: "", stored: null, languages: ["zh-Hans-CN", "en"] }), "zh");
});

t("unknown languages fall back to English", () => {
  assert.strictEqual(resolveLocale({ search: "", stored: null, languages: ["de-DE", "fr"] }), "en");
});

t("garbage in ?lang= is ignored", () => {
  assert.strictEqual(resolveLocale({ search: "?lang=de", stored: null, languages: ["en-GB"] }), "en");
});

console.log("\nkey usage in the code:");
const sources = walk("web/src").filter((f) => !f.includes(join("i18n", "")));
const used = new Set();
for (const file of sources) {
  const text = readFileSync(file, "utf8");
  for (const m of text.matchAll(/\bt\("([a-zA-Z0-9_.]+)"/g)) used.add(m[1]);
}

t('every t("...") key exists in the dictionary', () => {
  const missing = [...used].filter((k) => !(k in en));
  assert.deepStrictEqual(missing, [], "unknown keys: " + missing.join(", "));
});

t("no unused keys", () => {
  const unused = enKeys.filter((k) => !used.has(k));
  assert.deepStrictEqual(unused, [], "unused: " + unused.join(", "));
});

console.log("\nserver error codes:");
const serverSource = readFileSync("provider-manager.ts", "utf8");
const codes = [...serverSource.matchAll(/code: "([A-Z_]+)"/g)].map((m) => m[1]);
t("every server code has a UI translation", () => {
  const map = {
    BASE_URL_REQUIRED: "editor.serverBaseUrlRequired",
    REQUEST_FAILED: "editor.serverRequestFailed",
    CONNECTION_FAILED: "editor.serverConnectionFailed",
  };
  assert.ok(codes.length > 0, "no code found in provider-manager.ts");
  for (const code of new Set(codes)) {
    assert.ok(map[code], "code without a translation: " + code);
    for (const locale of LOCALES) assert.ok(MESSAGES[locale][map[code]], locale + " " + map[code]);
  }
});

console.log("\n" + (failed ? "✗ failures: " + failed : "all passed (" + n + " checks)"));
