# 稻田 Ai

这是一个轻量、安静的 OpenAI 兼容模型中转与聊天工作台，包含：

- 公开网页对话入口，访客打开网址即可使用
- `/v1/*` 透明转发到上游 API
- Relay Key 管理，客户端只拿中转 Key
- 多上游配置，可按模型前缀选择上游
- 模型提供方弹窗里管理 Key、上游和最近调用记录
- 支持普通 JSON 响应和 SSE 流式响应

## 启动

新手推荐：双击项目里的 `open-api-relay.command`。它会自动启动稻田 Ai，并自动打开 `http://127.0.0.1:8787`。

如果你只想启动服务、不自动打开浏览器，也可以双击 `start.command`。

也可以在终端运行：

```bash
ADMIN_TOKEN="your-admin-token" PORT=8787 node src/server.js
```

打开：

```text
http://localhost:8787
```

默认管理 Token 是 `change-me-admin-token`，正式使用时一定要通过环境变量覆盖。

公开上线时请使用：

```bash
ADMIN_TOKEN="your-admin-token" HOST=0.0.0.0 PORT=8787 node src/server.js
```

## 使用方式

1. 点击右上角“模型提供方”。
2. 输入管理 Token。
3. 添加并启用上游：例如 `https://api.openai.com` 和你的上游 API Key。
4. 设置默认聊天模型。
5. 回到聊天界面直接发送消息。
6. 如需开放 API 调用，可以新建 Relay Key，并立即保存生成出来的 Key。
7. 客户端把 Base URL 改成稻田 Ai 地址：

```text
http://localhost:8787/v1
```

请求头使用中转 Key：

```http
Authorization: Bearer relay_xxxxxxxxxxxxxxxxx
```

## 数据文件

配置和调用记录保存在：

```text
data/config.json
```

生产环境建议接入数据库、限流、配额、用户系统和 HTTPS。
