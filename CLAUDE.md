# 稻田 Ai — 项目规则

## 启动方式

```bash
cd /Users/paopaopaopao/Desktop/dao\ tian && node server.js
```

浏览器打开 http://127.0.0.1:8787

也可双击 `Claude Code DeepSeek.command` 启动 Claude Code。

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

- `app.js` — 单页应用全部 JS 逻辑（IIFE 模式）
- `styles.css` — 全部样式
- `server.js` — Node.js 静态文件服务器 + API 转发
- `index.html` — 入口 HTML
- `package.json` — 项目配置
- `Dockerfile` — Docker 部署配置
- `render.yaml` — Render 部署配置
- `.claude/settings.json` — 项目级 Claude Code 设置（acceptEdits 模式）

## 数据存储

key 通过 KEYS 常量管理：
- `daotian.chats.v323` — 聊天记录
- `daotian.settings.v323` — 设置
- `daotian.theme.v323` — 主题
- `daotian.modelParams.v1` — 模型参数
- `daotian.personalization.v1` — 个性化设置
- `daotian.memories.v1` — 跨聊天记忆（含证据计数、分类、评分）
- `daotian.memoryCandidates.v1` — 候选记忆
- `daotian.autoExtract.v1` — 自动提取开关

## 记忆系统架构

四阶段流程：摄取（Ingestion）→ 存储（Storage）→ 检索（Retrieval）→ 整合（Synthesis）

### 分层存储
- 工作记忆：当前会话聊天历史
- 候选记忆池：自动提取的潜在记忆，含 evidence 计数
- 长期记忆库：确认后的重要记忆
- 证据累计：同一内容出现 3 次以上自动升级

### 分类体系（7 类）
1. explicit_memory_request — 明确要求记住
2. correction_rule — 纠错规则
3. project_rule — 项目规则
4. long_term_background — 长期背景
5. stable_preference — 稳定偏好
6. temporary_state — 临时状态（不记录）
7. casual_chat — 闲聊（不记录）

### 评分维度
6 维评分 + 决策阈值：长期价值、未来复用、稳定性、具体性、敏感度风险、琐碎度

## 部署

- Render 部署：项目根目录 render.yaml 配置
- GitHub 需要先推送代码，Render 自动拉取部署
- Docker 部署：Dockerfile 配置
