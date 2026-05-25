V3.5.7 Sidebar + Multi Provider Hotfix

只上传 app.js 覆盖。

修复点：
1. 修复桌面端侧边栏收起/展开后主区域宽度和位置异常。
2. 模型提供方恢复为多模型/多提供方管理，不再只有一个。
3. 输入框上方、联网搜索旁边恢复快速模型切换下拉框。
4. 当前模型切换会同步到请求参数，发送消息时使用当前选择的 provider/model/apiKey/baseUrl/path。
5. 保留 V3.5.5/3.5.6 已有功能：流式输出、联网搜索、设置、记忆管理、渲染修复、键盘适配。

上传流程：
下载 ZIP → 解压 → 上传 app.js 到 GitHub 仓库根目录覆盖 → Commit changes → 等 Render 部署 → 刷新测试。
