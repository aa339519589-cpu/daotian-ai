# 稻田 AI

稻田 AI 是一个轻量的聊天工作台，支持：

- 游客直接进入聊天
- 登录后按账号隔离聊天、模型配置、系统 Prompt、语音和外观设置
- 后端代理模型请求，不向前端下发上游 API Key
- 接入码 / 模型提供方系统

## 本地启动

安装依赖并启动：

```bash
npm install
npm start
```

默认地址：

```text
http://127.0.0.1:8787
```

## 账号数据存储

默认情况下，账号、会话和接入码数据保存在：

```text
data/auth.json
data/access.json
```

也可以通过环境变量覆盖数据目录：

```bash
DATA_DIR=/absolute/path/to/data npm start
```

## Render 部署

账号系统要想在 Render 上稳定工作，核心要求只有一条：

`auth.json` 和 `access.json` 必须落在持久存储里。

如果 Web Service 跑在临时磁盘上，实例重启、重新部署或休眠唤醒后，这两个文件可能会丢失，表现出来就是：

- 过一段时间后又被要求重新登录
- 原来注册过的邮箱再次登录时提示“邮箱或密码不正确”

当前仓库里的 [render.yaml](/Users/paopaopaopao/daotian-ai-work/render.yaml) 已经改成：

- `starter` 计划
- 挂载持久盘 `daotian-data`
- `DATA_DIR=/opt/render/project/src/data`

这样 Render 上的账号、session 和接入码文件会写到持久盘里，而不是临时文件系统。

## Render 验证

部署完成后，至少验证这几步：

1. 注册一个新账号。
2. 关闭页面，过一段时间重新打开。
3. 已登录则应自动恢复；如果需要重新登录，输入原邮箱和密码必须成功。
4. 在服务重启或重新部署后，再次登录仍应成功。

## 说明

`session` 现在使用持久 cookie，服务端会同时写入：

- `Max-Age`
- `Expires`

这样在浏览器和 WebView 场景下都更稳一些。

```

Agent PR test 2026-06-24
