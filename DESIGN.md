# pi Provider Manager — 设计文档（方案 A）

> 日期：2025-08-31　版本：v1

## 目标
做一个 pi 扩展，注册 `/providers` 命令。执行后启动本地 Web 页面，用来**增删改 pi 的自定义供应商/模型**，并设置默认供应商/模型/思考级别。

## 范围（已确认）
- **只管 `~/.pi/agent/models.json`** 中的自定义 API 供应商（`providers` 字段：`baseUrl` / `api` / `apiKey` / `headers` / `compat` / `models[]`）。
- **外加 `~/.pi/agent/settings.json`** 的 `defaultProvider` / `defaultModel` / `defaultThinkingLevel` 三项。
- **不管** `auth.json`（OAuth 登录那几家靠 `/login`）和 `extensions/*.ts` 里注册的供应商（justwoker/xkiro 不显示）。

## 关键事实（决定方案）
- `models.json` 在每次打开 `/model` 时自动重载——**改文件即可生效，无需重启**。
- 扩展可 `pi.registerCommand()`；可用 `node:http` 起本地服务、`node:child_process` 开浏览器；用 `node:fs` 读写配置文件。

## 技术选型：方案 A
- 单文件 `provider-manager.ts`，零 npm 依赖（仅 `node:*` + pi 类型）。
- `node:http` 起 `127.0.0.1` 临时端口，同源 REST 端点读写配置。
- 前端为单页 HTML（内嵌字符串），原生 JS，无框架无构建。
- 绑定 `127.0.0.1` 仅本机可访问；`server.unref()` 不阻塞 pi 退出；`session_shutdown` 关闭服务。

## REST API
| 方法/路径 | 作用 |
|---|---|
| `GET /` | 管理页 HTML |
| `GET /api/config` | 返回 masked 后的 providers + settings 三项 |
| `PUT /api/config` | 写入 `models.json`（providers）与 `settings.json`（三项） |
| `GET /api/test?provider=name` | 请求 `baseUrl/models` 做连通性/鉴权检查 |

### 密钥处理（安全）
- `GET` 读回时 `apiKey` 打码为 `••••••`，真实密钥**不回传**。
- 前端密钥输入框为空 = 保留原密钥；输入新值 = 覆盖。这样打开再保存不会误清密钥。
- 未认证键打码逻辑见 `mergeProviders()` / `maskKey()`。

## 数据流
1. 命令 `/providers` → 起服务（已存在则复用）→ 打开浏览器。
2. 前端 `GET /api/config` → 渲染供应商列表 + 编辑器 + 默认设置项。
3. 保存 → `PUT /api/config` → `mergeProviders()` 合并（保留未知字段、按 id 合并模型、密钥打码回填）→ 写入文件。
4. 提示"打开 /model 或重启生效"。

## 合并策略（关键的、易错的逻辑）
- **供应商层**：`{ ...原对象, ...编辑字段 }`，保留未知字段（如 `oauth`）；`apiKey` 为空/打码→保留原值，非空→覆盖。
- **模型层**：按 `id` 合并，`{ ...原模型, ...编辑字段 }`，保留 `cost`/`compat`/`thinkingLevelMap` 等 UI 不编辑的字段。
- **默认设置**：三项空值=删除该键，非空=写入；其余 settings 字段原样保留。

## 测试
- `test-config.mjs`（用 jiti 导入 `provider-manager.ts` 的纯逻辑）断言 `maskKey` 与 `mergeProviders` 的密钥回填、模型合并、删除行为。
- 手动：把文件接入 `settings.json` 的 `extensions` 数组，`/reload` 后 `/providers` 打开页面。

## 安装
```bash
# 源码位于本项目目录；通过 settings.json 的 extensions 指向它即可热加载
pi 的 ~/.pi/agent/settings.json:
  "extensions": ["D:/Taozhuowei/KeywayTech/projects/demo/pi-provider-manager/provider-manager.ts"]
pi 内运行 /reload，然后 /providers
```
