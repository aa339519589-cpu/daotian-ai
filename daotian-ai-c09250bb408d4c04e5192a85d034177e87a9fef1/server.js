import http from "node:http";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = ROOT;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const PUBLIC_CHAT_DAILY_LIMIT = Number(process.env.PUBLIC_CHAT_DAILY_LIMIT || 100);
const publicChatLimits = new Map();

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function nowIso(){ return new Date().toISOString(); }
function corsHeaders(){
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-api-key,x-admin-token"
  };
}
function sendJson(res, status, data){
  res.writeHead(status, { ...JSON_HEADERS, ...corsHeaders() });
  res.end(JSON.stringify(data, null, 2));
}
function openSse(res){
  res.writeHead(200, {
    ...corsHeaders(),
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
}
function sendSse(res, event, data){
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
function readBody(req){
  return new Promise((resolve, reject)=>{
    const chunks=[];
    req.on("data", chunk=>chunks.push(chunk));
    req.on("end", ()=>resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
function clientIp(req){
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown").split(",")[0].trim();
}
function checkPublicChatLimit(req){
  if(PUBLIC_CHAT_DAILY_LIMIT <= 0) return true;
  const day = new Date().toISOString().slice(0,10);
  const key = `${day}:${clientIp(req)}`;
  const current = publicChatLimits.get(key) || 0;
  if(current >= PUBLIC_CHAT_DAILY_LIMIT) return false;
  publicChatLimits.set(key, current + 1);
  return true;
}
function safeUrl(base, requestPath){
  const b = String(base || "").replace(/\/+$/, "");
  const p = String(requestPath || "/v1/chat/completions");
  if(!b) return "";
  if(b.endsWith("/v1") && p.startsWith("/v1/")) return b + p.slice(3);
  return b + (p.startsWith("/") ? p : "/" + p);
}
function normalizeFrontendUpstream(body){
  const raw = body.frontendUpstream || body.upstream || {};
  const providerType = String(raw.providerType || "openai");
  if(providerType !== "openai") return null;
  const baseUrl = String(raw.baseUrl || "").trim();
  const apiKey = String(raw.apiKey || "").trim();
  const requestPath = String(raw.requestPath || raw.path || "/v1/chat/completions").trim() || "/v1/chat/completions";
  if(!baseUrl || !apiKey) return null;
  return {
    id: "frontend-current-model",
    name: String(raw.providerName || raw.label || "当前模型"),
    baseUrl,
    apiKey,
    requestPath
  };
}
function shouldUseWebSearch(message, manualEnabled=false){
  if(manualEnabled) return true;
  const text = String(message || "");
  const keywords = ["联网","搜索","查一下","帮我查","最新","今天","现在","实时","价格","官网","新闻","天气","汇率","发布时间","版本","政策","公告"];
  return keywords.some(k=>text.includes(k));
}
function formatSearchContext(query, sources){
  if(!sources.length){
    return `你现在可以参考联网搜索结果回答用户。\n\n用户问题：${query}\n\n搜索结果为空。请明确说明没有搜到可靠结果，不要编造来源。`;
  }
  const sourceText = sources.map((item, index)=>`${index+1}.\n标题：${item.title || "无标题"}\n链接：${item.url || ""}\n摘要：${item.content || ""}`).join("\n\n");
  return `你现在可以参考以下联网搜索结果回答用户。请优先基于搜索结果回答；如果搜索结果不足，请明确说明“不确定”。回答中尽量标注来源链接，不要编造来源。\n\n搜索结果：\n${sourceText}\n\n用户问题：\n${query}`;
}
async function searchWeb(query){
  if(!TAVILY_API_KEY){
    const error = new Error("联网搜索未配置，请先在 Render 环境变量中添加 TAVILY_API_KEY");
    error.code = "web_search_not_configured";
    throw error;
  }
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TAVILY_API_KEY}` },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 5, include_answer: false, include_raw_content: false })
  });
  const text = await response.text();
  let data = null;
  try{ data = JSON.parse(text); }catch{ data = { text }; }
  if(!response.ok){
    const error = new Error("搜索失败，请稍后再试");
    error.code = "web_search_failed";
    error.status = response.status;
    throw error;
  }
  return (Array.isArray(data.results) ? data.results : [])
    .slice(0,5)
    .map(item=>({ title:String(item.title || "无标题"), url:String(item.url || ""), content:String(item.content || item.snippet || "").slice(0,800) }))
    .filter(item=>item.title || item.url || item.content);
}
async function streamOpenAiResponse({ req, res, upstream, model, messages, body, sources }){
  const controller = new AbortController();
  req.on("close", ()=>controller.abort());
  const response = await fetch(safeUrl(upstream.baseUrl, upstream.requestPath), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${upstream.apiKey}` },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
      stream: true
    })
  });
  if(!response.ok){
    const detailText = await response.text();
    let detail = detailText;
    try{ detail = JSON.parse(detailText); }catch{}
    sendSse(res, "error", { message: "模型请求失败", status: response.status, detail });
    sendSse(res, "done", { ok:false });
    res.end();
    return;
  }
  sendSse(res, "sources", { sources });
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of response.body){
    buffer += decoder.decode(chunk, { stream:true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";
    for(const line of lines){
      const trimmed = line.trim();
      if(!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if(!payload || payload === "[DONE]") continue;
      let data = null;
      try{ data = JSON.parse(payload); }catch{ continue; }
      const content = data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
      if(content) sendSse(res, "content", { content });
    }
  }
  sendSse(res, "done", { ok:true });
  res.end();
}
async function handleChat(req, res){
  if(!checkPublicChatLimit(req)){
    sendJson(res, 429, { error:"rate_limited", message:`今天的公开对话次数已用完，每个访问者每天限制 ${PUBLIC_CHAT_DAILY_LIMIT} 次` });
    return;
  }
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const model = String(body.model || body.frontendUpstream?.model || "").trim();
  const stream = Boolean(body.stream);
  let messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  let sources = [];
  const upstream = normalizeFrontendUpstream(body);

  function fail(statusCode, payload){
    if(stream){
      openSse(res);
      sendSse(res, "error", payload);
      sendSse(res, "done", { ok:false });
      res.end();
    }else{
      sendJson(res, statusCode, payload);
    }
  }

  if(!model){ fail(400, { error:"model_required", message:"请先填写模型名称" }); return; }
  if(!messages.length){ fail(400, { error:"message_required", message:"请先输入要发送的话" }); return; }
  if(!upstream){ fail(400, { error:"frontend_upstream_required", message:"联网搜索需要使用当前模型配置，请先在设置里填 Base URL 和 API Key" }); return; }

  const lastUserMessage = [...messages].reverse().find(m=>m?.role === "user")?.content || "";
  const wantsWebSearch = shouldUseWebSearch(lastUserMessage, Boolean(body.webSearch || body.search));
  if(wantsWebSearch){
    try{
      sources = await searchWeb(lastUserMessage);
      messages = [{ role:"system", content:formatSearchContext(lastUserMessage, sources) }, ...messages];
    }catch(error){
      messages = [{ role:"system", content:`本轮尝试联网搜索失败：${error.message}。请不要声称已经完成实时搜索；可以基于已有知识回答，并明确说明实时信息未能获取。` }, ...messages];
      sources = [];
      console.error("Web search degraded", error.code || "web_search_failed", error.message);
    }
  }

  try{
    if(stream){
      openSse(res);
      await streamOpenAiResponse({ req, res, upstream, model, messages, body, sources });
      return;
    }
    const response = await fetch(safeUrl(upstream.baseUrl, upstream.requestPath), {
      method:"POST",
      headers:{ "content-type":"application/json", authorization:`Bearer ${upstream.apiKey}` },
      body:JSON.stringify({ model, messages, temperature: typeof body.temperature === "number" ? body.temperature : 0.7, stream:false })
    });
    const text = await response.text();
    let data = null;
    try{ data = JSON.parse(text); }catch{ data = { text }; }
    if(!response.ok){ sendJson(res, response.status, { error:"upstream_error", status:response.status, detail:data }); return; }
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text || "";
    sendJson(res, 200, { upstream:upstream.name, model, content, sources, raw:data });
  }catch(error){
    if(error?.name === "AbortError") return;
    if(stream){
      if(!res.headersSent) openSse(res);
      sendSse(res, "error", { error:"upstream_error", message:error.message });
      sendSse(res, "done", { ok:false });
      res.end();
    }else{
      sendJson(res, 502, { error:"upstream_error", message:error.message });
    }
  }
}
function serveStatic(req, res){
  const cleanPath = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const relativePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = join(PUBLIC_DIR, relativePath);
  const contentTypes = { ".html":"text/html; charset=utf-8", ".css":"text/css; charset=utf-8", ".js":"application/javascript; charset=utf-8", ".json":"application/json; charset=utf-8" };
  const stream = createReadStream(filePath);
  stream.on("open", ()=>{ res.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" }); stream.pipe(res); });
  stream.on("error", ()=>sendJson(res, 404, { error:"not_found" }));
}

const server = http.createServer(async (req, res)=>{
  try{
    if(req.method === "OPTIONS"){ res.writeHead(204, corsHeaders()); res.end(); return; }
    if(req.method === "GET" && req.url === "/public/config"){
      return sendJson(res, 200, { chatModel:"deepseek-chat", webSearchConfigured:Boolean(TAVILY_API_KEY), providers:[] });
    }
    if(req.method === "POST" && req.url === "/chat") return await handleChat(req, res);
    if(req.url === "/health") return sendJson(res, 200, { ok:true, time:nowIso() });
    return serveStatic(req, res);
  }catch(error){
    console.error(error);
    sendJson(res, 500, { error:"internal_server_error", message:error.message });
  }
});
server.listen(PORT, HOST, ()=>{
  console.log(`稻田 Ai running at http://${HOST}:${PORT}`);
});
