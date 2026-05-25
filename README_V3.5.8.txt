V3.5.8 Multi Provider Multi Model Streaming Fix

只上传 app.js。

修复点：
1. 模型提供方恢复为“多个供应商 + 每个供应商多个模型”。
2. 保存新供应商不会覆盖旧供应商。
3. 同一供应商可在模型列表里一行一个保存多个模型。
4. 联网搜索旁边的快速模型切换恢复为“供应商 / 模型”下拉。
5. 请求仍然使用 stream:true，保留流式输出。
6. 继续只改 app.js，不动 index.html / server.js。
