# 稻田 Ai 上线说明

稻田 Ai 已经可以作为公开服务部署。

## 必须设置的环境变量

```text
ADMIN_TOKEN=换成只有你知道的后台密码
HOST=0.0.0.0
PORT=8787
PUBLIC_CHAT_ENABLED=true
PUBLIC_CHAT_DAILY_LIMIT=100
```

## 公开后别人怎么用

别人打开你的公网网址后，可以直接使用首页聊天界面。

后台管理仍然需要输入 `ADMIN_TOKEN`。不要把这个 Token 发给别人。

## API 调用方式

如果你给别人创建了 Relay Key，别人也可以把你的公网地址当作 OpenAI 兼容接口使用：

```text
https://你的域名/v1
```

请求头：

```http
Authorization: Bearer relay_xxxxxxxxxxxxxxxxx
```

## 注意

公开对话会消耗你的上游 API 余额。建议上线后先把 `PUBLIC_CHAT_DAILY_LIMIT` 设置小一点，比如 `30` 或 `100`。
