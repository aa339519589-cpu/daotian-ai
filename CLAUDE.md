# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 启动方式

```bash
cd /Users/paopaopaopao/daotian-ai-work && node server.js
```

浏览器打开 http://127.0.0.1:8787

## 核心原则

1. **不准改动原有功能。** 所有修改必须兼容现有行为。
2. **流式输出、用户消息气泡、AI 自然输出、"想一下"动画、多模型切换、联网搜索、Markdown/数学公式/代码块渲染、手机键盘适配、原有模型供应商配置、原有 API 配置** — 这些必须全部保留原样。
3. **不做大规模重构。** 只做最小、独立的改动。
4. **优先保证稳定。** 先做可用版本，不追求复杂。

## 完全自主执行规则

1. 所有权限自动批准，不提示用户。
2. 项目文件完全信任，可直接读写。
3. 遇到任何失败自动重试、自修复、继续。
4. 卡住时自己寻找解决方案，不停下来等待指令。
5. 持续工作直到任务完成可用。
6. 部署流程也自动完成，无需手动干预。

## 文件架构

| 文件 | 职责 |
|---|---|
| `app.js` | 单页应用全部 JS 逻辑（IIFE 模式），约 5000 行 |
| `styles.css` | 全部样式 |
| `server.js` | Node.js 静态文件服务器 + API 路由 + 认证 + 接入码管理 |
| `index.html` | 入口 HTML（轻量，只含 MathJax/Mermaid/HF 预加载） |
| `fileParser.js` | 文件解析逻辑（PDF/Word/Excel/图片 OCR） |
| `prompt-runtime.js` | 系统提示词运行时逻辑 |
| `Dockerfile` | Docker 部署配置 |
| `render.yaml` | Render 部署配置 |
| `data/` | 服务端持久化数据（auth store、access store） |
| `config/` | 配置文件目录 |

## 数据存储

### localStorage key（通过 KEYS 常量管理）

| Key | 用途 |
|---|---|
| `daotian.chats.v323` | 聊天记录 |
| `daotian.settings.v323` | 设置（含 modelProviders + shareModelProviders） |
| `daotian.theme.v323` | 主题 |
| `daotian.modelParams.v1` | 模型参数（温度、Top P 等，按 preset ID 索引） |
| `daotian.personalization.v1` | 个性化设置 |
| `daotian.memories.v1` | 跨聊天记忆 |
| `daotian.memoryCandidates.v1` | 候选记忆 |
| `daotian.autoExtract.v1` | 自动提取开关 |
| `daotian.access.claims` | 已接入的接入码 |

### 登录态 key 隔离

登录后，`saveJSONStrict` 使用 `scopedStorageKey(key)` 写入 `daotian.user.<id>.<key>`。读取时优先读 scoped key，fallback 到 unscoped key。游客模式两个 key 相同。

## 设置系统架构

设置入口在 `#settingsModal`，由 `settingsPage` 状态驱动页面切换：

- `home` — 设置首页
- `providerHub` — **模型提供方**（自己使用 + 分享给别人）
- `access` — 接入码（输入别人的码来获取模型）
- `appearance` / `model` / `memory` / `personalization` / `chatPrefs` / `voiceSettings`

导航函数：`settingsGoTo(page)` 前进、`settingsGoBack()` 后退（有栈）。

### 模型提供方（providerHub）架构

两个独立板块，状态完全分离：

- **自己使用** → `settings.modelProviders` — 自己配置模型自己用
- **分享给别人** → `settings.shareModelProviders` — 配置模型生成接入码给别人用

关键函数：
- `providerHubScopeKey(scope)` → `'modelProviders'` | `'shareModelProviders'`
- `providerHubProviders(scope)` / `setProviderHubProviders(scope, list)` — 读写
- `collectProviderHubSection(scope)` — 从 DOM 收集并保存
- `saveProviderHubSection(scope)` — 收集 + syncLegacySettings + persistModelSettingsStrict
- `renderProviderSection(scope)` — 渲染单个板块 HTML
- `providerTemplate(provider, index)` — 单个提供方卡片 HTML

**注意：** 旧的 `#providerModal` 已废弃，侧边栏「模型提供方」按钮现在走 `openProviderHub()` → `settingsModal` 的 providerHub 页面。旧 `openSettings()` / `saveSettings()` / `collectProviderEditor()` 仍保留但已加 guard，不会污染 providerHub 数据。

### 接入码系统

- **生成**：在 providerHub 的「分享给别人」添加提供方 → 填写模型包信息 → 点击「生成接入码」→ 调用 `POST /api/access/packages`
- **使用**：在「接入码」页面输入码 → 调用 `POST /api/access/claim` → 成功后模型出现在模型切换列表
- 接入码使用者**看不到**提供者的 API Key / Base URL / 请求路径，聊天请求由后端代理

## API 端点

| 方法 | 路径 | 用途 |
|---|---|---|
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录 |
| POST | `/api/auth/logout` | 退出 |
| GET | `/api/auth/me` | 获取当前用户 |
| GET | `/api/user/data` | 获取用户数据（聊天、设置同步） |
| POST | `/api/user/data` | 保存用户数据 |
| POST | `/api/access/packages` | 创建接入码（生成分享包） |
| GET | `/api/access/packages` | 列出我的接入码 |
| POST | `/api/access/claim` | 使用接入码获取模型 |
| POST | `/chat` | 聊天请求（代理转发到模型供应商） |
| POST | `/models/list` | 获取模型列表（从供应商 /models 接口拉取） |
| POST | `/file/parse` | 文件解析 |
| POST | `/api/tts` | 语音合成 |

## 认证系统

- `server.js` 内置用户认证（bcrypt + JSON 文件存储）
- `AUTH_USER` 全局变量保存当前用户状态
- `authFetch(path, options)` — 前端封装 fetch，自动处理认证和序列化
- `queueAuthDataSync(key, str)` — 延迟批量同步数据到服务端
- `flushAuthDataSync()` — 手动刷新同步队列
- 游客模式：数据仅存 localStorage，不登录也能用

## 记忆系统

四阶段流程：摄取 → 存储 → 检索 → 整合

7 类分类体系 + 6 维评分，证据累计 3 次以上自动升级为长期记忆。

## 部署

- 推送代码到 GitHub → Render 自动拉取部署
- `render.yaml` + `Dockerfile` 配置

## Render 持久化存储配置（重要）

账号、接入码、记忆数据存储在 `DATA_DIR` 目录（auth.json / access.json / memories.json）。Render 不使用 Persistent Disk 时，每次部署/重启数据会丢失。

**配置步骤：**
1. Render Dashboard → 选择服务 → Disks → Create Disk
2. 名称：`daotian-data`，挂载路径：`/opt/render/project/data`，大小：1GB
3. Environment → 添加环境变量：`DATA_DIR` = `/opt/render/project/data`
4. 重新部署（Manual Deploy → Deploy latest commit）
5. 访问 `/health` 验证 `persistent: true` + `customDataDir: true`

**验证方法：**
```bash
curl https://daotian-ai.onrender.com/health | jq
# 检查 persistent=true, customDataDir=true, dataDir="/opt/render/project/data"
```
