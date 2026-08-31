# Launch / Promotion Copy — pi Provider Manager

> 用于发布与推广 pi Provider Manager 的现成文案。发布前请替换方括号中的占位内容。

---

## 1. 远程仓库设置（在 GitHub 上创建/编辑时填写）

### Description
A pi-coding-agent extension to manage custom LLM API providers & models via a local web UI. Edit models.json + default provider/model/thinking-level, auto-backup, localhost-only.

### Topics
`pi-coding-agent` `llm` `llm-provider` `openai-compatible` `model-config` `extension` `nodejs` `typescript` `react` `vite`

> Topics 用于 `topic:` 搜索与 github.com/topics/ 分类；Description 出现在仓库列表与搜索。

---

## 2. 一句话标签（Tagline / elevator pitch，中英文）

- EN: **Manage your pi-coding-agent LLM providers & models from a local web UI — no more hand-editing models.json.**
- 中文: **用本地网页可视化配置 pi 的多模型供应商与默认模型，不再手改 models.json。**

---

## 3. Hacker News（Show HN，英文）

**Title**
Show HN: pi-provider-manager – a local web UI to manage pi's LLM providers

**Text**

I built a small extension for [pi-coding-agent](https://github.com/earendil-works/pi-coding-agent) that gives you a visual way to edit `~/.pi/agent/models.json`.

Why: hand-editing the provider/model JSON gets error-prone once you have several providers. This adds a `/providers` command that starts a localhost-only web UI to:

- Add / edit / delete providers (baseUrl, api, apiKey, headers, compat, models)
- Set the default provider, model, and thinking level
- Auto-backup `models.json` before every save (last 10 kept)
- Mask API keys so real keys never go back to the client
- Test a provider's connectivity/auth against `baseUrl/models`

Stack: a single-file `node:http` backend (zero extra deps) + a React/Vite/shadcn-ui frontend, served from `web/dist`.

The UI only binds to `127.0.0.1`, and it never touches `auth.json` (OAuth logins still go through `/login`).

Feedback welcome. Thanks for reading.

---

## 4. Reddit（r/opensource, 英文）

**Title**
[OC] I made a UI to manage pi-coding-agent's model providers — feedback appreciated

**Text**

I kept messing up `~/.pi/agent/models.json` by hand, so I built `pi-provider-manager`. Type `/providers` in pi and it opens a local web UI for editing providers/models and defaults.

Highlights:
- editable providers + models, with a "test connection" check
- auto-backup before save (keeps 10)
- API keys are masked, never returned to the browser
- localhost-only, no external calls

It's a single TS file (node:http) + a React frontend. Would love feedback on the UX and the merge/backup behavior.

Repo: [link to your repo]

---

## 5. X / Twitter（英文，短贴 + 截图）

1/ I made a tiny extension so you can manage pi-coding-agent's LLM providers visually.

2/ Add tons of providers, set the default model, hit "test connection" — all from a localhost-only page. No more editing models.json by hand.

3/ API keys are masked, and it auto-backs up the config before saves. Localhost only.

[attach screenshots]

---

## 6. 掘金（中文，技术向）

**标题**
pi-coding-agent 多模型供应商管理：用一张网页搞定 models.json

**正文**

背景：pi 把自定义 LLM 供应商放在 `~/.pi/agent/models.json`，供应商一多，手改 JSON 很容易漏字段或写错，默认模型/思考级别也不直观。

我做了个扩展 `pi-provider-manager`，在 pi 里输入 `/providers` 就会打开一个仅本机可访问的网页，用来：

- 增删改供应商/模型（baseUrl、api、apiKey、headers、compat、models）
- 设置默认供应商 / 默认模型 / 思考级别
- 保存前自动备份 models.json（保留最近 10 份，可回滚）
- API Key 打码，真实密钥不回传
- 提供“测试连接”做连通性与鉴权检查

技术点：后端是零额外依赖的单文件 `node:http`，前端用 React + Vite + shadcn/ui，构建产物由后端直接托管。服务只绑定 127.0.0.1，且不改 auth.json。

安装与使用见 README（[repo 链接]）。欢迎提意见。

---

## 7. 知乎（中文）

**标题**
如何优雅地管理 pi-coding-agent 的多个 LLM 供应商？

**正文**

用 pi 的朋友应该知道，自定义模型都配在 `~/.pi/agent/models.json`。供应商一多，手改 JSON 就难受。

我自己做了个顺手的工具 `pi-provider-manager`：一个 `/providers` 命令打开本地网页，可视化增删改供应商/模型，还能设默认供应商/模型/思考级别、测试连接、保存前自动备份。密钥打码，仅本机访问。

核心就一个 TS 文件 + 一个 React 前端，没有额外依赖。装法很简单（见 README）。如果你是重度多模型用户，可以试试。有任何想法欢迎交流。

---

## 8. V2EX（中文，论坛风）

**标题**
分享：给 pi-coding-agent 做了个可视化模型管理（/providers 网页）

**正文**

平时要维护一堆 LLM 供应商和模型，手改 models.json 太容易错。就写了个小扩展：`/providers` 打开本机网页，加供应商、改模型、设默认项、测试连接，保存前自动备份，API key 打码，只绑 127.0.0.1。

后端零依赖（node:http），前端 React。欢迎大家试用/拍砖，也可以直接提 issue。

[repo 链接]

---

## 9. 发布 Checklist

- [ ] 替换文案中的仓库链接 / 截图
- [ ] 先在 GitHub 创建远程仓库，填写 Description + Topics（见第 1 节）
- [ ] 发布 `v0.1.0` Release + 简短 changelog
- [ ] README 顶部已有 badges；可补“一行安装”命令与使用示例
- [ ] Hacker News 用 Show HN；Reddit 选对子版且遵守版规；中文平台注意广告尺度
- [ ] 各平台错峰发布，保留提问/反馈入口