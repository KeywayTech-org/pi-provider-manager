# pi Provider Manager

一个 pi 扩展：执行 `/providers` 启动本地 Web 页面，增删改 `~/.pi/agent/models.json` 里的自定义供应商/模型，并设置默认供应商/模型/思考级别。

- **零依赖**：仅用 `node:*` + pi 类型，单文件即插即用。
- **只写 `models.json` + `settings.json` 三项**，不改 `auth.json`（OAuth 登录那几家靠 `/login`）。
- 改完 `models.json`，`/model` 或重启 pi 即生效（pi 每次打开 `/model` 自动重载该文件）。
- **每次保存前自动备份** `models.json` 到 `~/.pi/agent/models.backups/`，保留最近 10 份，误操作可回滚。
- 服务只绑定 `127.0.0.1`，本机可访问；`apiKey` 读取时打码，真实密钥不随 `GET` 回传，留空保存则保留原值。
- 现代浅色界面，无原生浏览器弹窗（新增/删除用页内 Modal 确认，反馈用 toast）。

## 安装

### 方式一（推荐，单源）：接入 settings.json
在 `~/.pi/agent/settings.json` 的顶层加一个数组（没有就新增）：

```json
{
  "extensions": ["D:/Taozhuowei/KeywayTech/projects/demo/pi-provider-manager/provider-manager.ts"]
}
```

pi 内执行 `/reload`，然后 `/providers`。

### 方式二：复制到自动发现目录
把 `provider-manager.ts` 复制到 `~/.pi/agent/extensions/`，然后 `/reload`。

## 使用

1. pi 内输入 `/providers`。
2. 浏览器自动打开管理页（或手动访问终端打印的 `http://127.0.0.1:<port>/`）。
3. 左侧列出 `models.json` 的供应商；点选编辑，右侧填 `baseUrl` / `api` / `apiKey` / `headers` / `compat` / 模型列表。
4. 「保存供应商」写入 `models.json`；「保存默认设置」写入 `settings.json` 的 `defaultProvider` / `defaultModel` / `defaultThinkingLevel`。
5. 「测试连接」请求 `baseUrl/models` 做连通性与鉴权检查。

## API

| 方法/路径 | 作用 |
|---|---|
| `GET /` | 管理页 HTML |
| `GET /api/config` | 返回打码后的 providers + 三项默认设置 |
| `PUT /api/config` | 写入 `models.json` 与 `settings.json` |
| `GET /api/test?provider=name` | 连通性/鉴权检查 |

## 配置环境变量（可选）

- `PI_PROVIDER_MANAGER_CONFIG_DIR`：指定配置目录（默认 `~/.pi/agent`）。主要用于测试或自定义路径。

## 测试

```bash
# 纯逻辑（maskKey / mergeProviders）
node test-config.mjs

# 端到端（真实起服务器 + 临时配置目录，验证读/写/打码/合并/删除）
node test-server.mjs
```

测试通过 jiti 加载 `provider-manager.ts`，需要本机装有 pi（其 `node_modules` 里有 `jiti`）。若 jiti 路径因 pi 升级而变，改两个测试文件顶部的 jiti 绝对路径即可。

## 说明 / 限制

- 只管 `models.json`。`extensions/*.ts` 里注册的供应商（如 justwoker / xkiro）**不会**出现在页面里。
- API Key 留空 = 保留原值；输入新值 = 覆盖。想清空某个 key 不在 UI 暴露（避免误删），需手动编辑 `models.json`。
- 页面按 `127.0.0.1` 仅本机可见；服务生命周期随 pi 会话（`session_shutdown` 关闭，`server.unref()` 不阻塞退出）。
