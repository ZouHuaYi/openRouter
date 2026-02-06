# OpenAI 兼容聚合网关

对外**只暴露一个模型**：客户端始终用同一个 base URL 和同一个模型名调用。网关按配置的**后端优先级**转发；若某家限流（429）或服务异常（5xx），自动切到下一家重试，**调用方无感知**。

## 使用方式

客户端配置：

- `baseURL = http://localhost:3333/v1`
- `apiKey = 你的网关 Key`（若设置了 `GATEWAY_API_KEY`）
- **model**：使用网关暴露的**唯一模型 id**（由配置里的 `defaultModel` 决定，例如 `chat`）

调用方式与直连 OpenAI 一致；无需关心背后是哪家服务商。

### 示例（OpenAI SDK）

```js
const OpenAI = require('openai');
const client = new OpenAI({
  apiKey: process.env.GATEWAY_API_KEY || 'sk-your-gateway-key',
  baseURL: 'http://localhost:3333/v1',
});
const r = await client.chat.completions.create({
  model: 'chat',   // 固定用配置的 defaultModel，背后自动选/切换服务商
  messages: [{ role: 'user', content: 'Hello' }],
});
```

## 配置

### 环境变量

- `PORT`：服务端口，默认 3333
- `GATEWAY_API_KEY`：网关鉴权 Key；不设则不对客户端做鉴权
- 各厂商 Key：在 `config/providers.json` 的 `providers` 里用 `${OPENAI_API_KEY}` 等形式引用

### config/providers.json

- **providers**：各服务商的 `baseUrl`、`apiKey`（可 `${ENV_VAR}` 从环境变量读取）
- **defaultModel**：对外暴露的**唯一模型 id**，客户端请求时填的 `model`（如 `chat`）
- **backends**：**按优先级排列**的后端列表；请求时从第一个开始调，若返回 **429（限流）或 5xx** 则自动换下一个重试，直到成功或全部失败

示例：豆包优先，被限流或挂掉时自动用 OpenAI。

```json
{
  "providers": {
    "doubao": { "baseUrl": "https://ark.cn-beijing.volces.com/api/v3", "apiKey": "${DOUBAO_API_KEY}" },
    "openai": { "baseUrl": "https://api.openai.com", "apiKey": "${OPENAI_API_KEY}" }
  },
  "defaultModel": "chat",
  "backends": [
    { "provider": "doubao", "model": "doubao-seed-1-8-251228" },
    { "provider": "openai", "model": "gpt-4o-mini" }
  ]
}
```

## 端点

| 端点 | 说明 |
|------|------|
| `POST /v1/chat/completions` | 对话补全（支持 stream），自动按 backends 重试 |
| `POST /v1/embeddings` | 向量化，自动按 backends 重试 |
| `GET /v1/models` | 只返回一个模型（即 defaultModel） |

## 运行

```bash
cp .env.example .env
# 编辑 .env 填入 GATEWAY_API_KEY 和各厂商 API Key
npm install
npm start
```

开发时可用 `npm run dev`（带 --watch）。

### 图形界面（Electron）

在页面上配置服务商、后端顺序、环境变量，并一键启动/停止网关。前端为 **Vue 3 + Vite + UnoCSS**，源码在 `electron/ui-src`，构建输出到 `electron/ui`。

```bash
npm install
npm run ui
```

（`npm run ui` 会先执行 `build:ui` 再启动 Electron。仅改 UI 源码时执行 `npm run build:ui` 后重新打开界面即可。）

- **状态**：查看网关是否运行、端口，启动/停止按钮，以及网关进程的日志输出。
- **服务商**：增删改各厂商的 baseUrl、apiKey（可填 `${ENV_VAR}`）、chatPath。
- **后端顺序**：增删改后端列表，拖拽调整优先级；**限流/停用**的模型会单独标记，可设解封时间（1 小时 / 1 天 / 1 周 / 1 月），到期后自动重新参与轮询；收到 429 时网关也会自动为该后端写入 1 小时 cooldown。
- **环境变量**：配置 PORT、GATEWAY_API_KEY 以及各厂商 Key，保存后写入 `.env`。

配置与 `.env` / `config/providers.json` 互通，用命令行或 bat 启动时同样读取这些文件。修改配置后若网关已在运行，需在界面点击「停止」再「启动」使新配置生效。

### 快速启动 / 关闭

| 系统 | 启动 | 关闭 |
|------|------|------|
| **Windows** | 双击 `start.bat`（无窗口后台启动，由 `start.vbs` 执行） | 双击 `stop.bat`（按端口结束进程） |
| **Mac / Linux** | `./start.sh`（首次请 `chmod +x start.sh stop.sh`） | `./stop.sh` |

- Windows：双击 `start.bat` 会调用 `start.vbs` 在**无窗口**下启动网关；需看日志时可在项目目录执行 `npm start`。`stop.bat` 通过 PowerShell 按端口 3333 查找并结束进程。若修改了 `.env` 中的 `PORT`，请编辑 `stop.bat` 中的 `set PORT=3333`。
- Mac/Linux：`start.sh` 在后台运行并将 PID 写入 `.gateway.pid`；`stop.sh` 按该 PID 或端口 3333 结束进程。若修改了 `.env` 中的 `PORT`，停止时可执行 `PORT=你的端口 ./stop.sh`。

## 在openclaw 中使用的配置

```
{
  "models": {
    "providers": {
      "local": {
        "baseUrl": "http://127.0.0.1:3333/v1",  
        "apiKey": "sk-1234567890",                     
        "api": "openai-completions",
        "models": [
          {
            "id": "my-chat",                   
            "name": "My Local Model",
            "contextWindow": 128000,               
            "maxTokens": 8192,
            "reasoning": false                 
          }
        ]
      }
    }
  },
  "agents": {
    "defaults": {
      "model": {
        "primary": "local/my-chat"
      }
    }
  }
}
```