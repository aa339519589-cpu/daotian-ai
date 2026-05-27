import http from "node:http";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { parseUploadedFile, buildFileContext } from "./fileParser.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = ROOT;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const PUBLIC_CHAT_DAILY_LIMIT = Number(process.env.PUBLIC_CHAT_DAILY_LIMIT || 100);
const publicChatLimits = new Map();

/* Edge TTS — Microsoft Read Aloud, free, xiaoxiao neural voice */
const EDGE_TTS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_TTS_VOICE = "zh-CN-XiaoxiaoNeural";

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

/* ── Multipart form parsing (minimal, no external deps) ── */
async function readMultipartBody(req){
  const contentType = String(req.headers["content-type"] || "");
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
  if(!boundaryMatch) return null;
  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const raw = await readBody(req);
  const parts = parseMultipart(raw, boundary);
  if(!parts) return null;

  const fields = {};
  const files = [];

  for(const part of parts){
    const headerEnd = part.indexOf("\r\n\r\n");
    if(headerEnd < 0) continue;
    const headerText = part.slice(0, headerEnd).toString("utf8");
    const bodyStart = headerEnd + 4;
    const body = part.slice(bodyStart, part.length - 2); // strip trailing \r\n

    const nameMatch = headerText.match(/name="([^"]+)"/);
    const filenameMatch = headerText.match(/filename="([^"]+)"/);
    const typeMatch = headerText.match(/Content-Type:\s*([^\r\n]+)/i);

    if(filenameMatch){
      files.push({
        fieldname: nameMatch ? nameMatch[1] : "file",
        filename: filenameMatch[1],
        mimetype: typeMatch ? typeMatch[1].trim() : "application/octet-stream",
        buffer: Buffer.from(body),
        size: body.length
      });
    }else if(nameMatch){
      fields[nameMatch[1]] = body.toString("utf8");
    }
  }

  return { fields, files };
}

function parseMultipart(buffer, boundary){
  const parts = [];
  const sep = Buffer.from("--" + boundary);
  const end = Buffer.from("--" + boundary + "--");
  let start = buffer.indexOf(sep);
  if(start < 0) return null;

  while(start >= 0){
    const nextSep = buffer.indexOf(sep, start + sep.length);
    if(nextSep < 0) break;
    const part = buffer.slice(start + sep.length + 2, nextSep); // +2 for \r\n after boundary
    parts.push(part);
    start = nextSep;
    if(buffer.slice(start, start + end.length).equals(end)) break;
  }
  return parts;
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
  return `你现在可以参考以下联网搜索结果回答用户。请优先基于搜索结果回答；如果搜索结果不足，请明确说明"不确定"。回答中尽量标注来源链接，不要编造来源。\n\n搜索结果：\n${sourceText}\n\n用户问题：\n${query}`;
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
  const requestBody = Object.assign(
    { model, messages, stream: true, stream_options: { include_usage: true } },
    typeof body.temperature === "number" ? { temperature: body.temperature } : {},
    typeof body.top_p === "number" ? { top_p: body.top_p } : {},
    typeof body.max_tokens === "number" && body.max_tokens > 0 ? { max_tokens: body.max_tokens } : {},
    typeof body.presence_penalty === "number" ? { presence_penalty: body.presence_penalty } : {},
    typeof body.frequency_penalty === "number" ? { frequency_penalty: body.frequency_penalty } : {}
  );
  const response = await fetch(safeUrl(upstream.baseUrl, upstream.requestPath), {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${upstream.apiKey}` },
    signal: controller.signal,
    body: JSON.stringify(requestBody)
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
  let lastUsage = null;
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
      if(data.usage) lastUsage = data.usage;
      const content = data?.choices?.[0]?.delta?.content || data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
      if(content) sendSse(res, "content", { content });
    }
  }
  sendSse(res, "done", { ok:true, usage: lastUsage || null });
  res.end();
}

async function handleChat(req, res){
  if(!checkPublicChatLimit(req)){
    sendJson(res, 429, { error:"rate_limited", message:`今天的公开对话次数已用完，每个访问者每天限制 ${PUBLIC_CHAT_DAILY_LIMIT} 次` });
    return;
  }

  /* Parse body: JSON or multipart */
  const contentType = String(req.headers["content-type"] || "");
  let body = {};
  let rawFiles = []; // { filename, mimetype, buffer, size }

  if(contentType.includes("multipart/form-data")){
    const parsed = await readMultipartBody(req);
    if(!parsed){
      sendJson(res, 400, { error:"parse_error", message:"无法解析上传的表单数据" });
      return;
    }
    for(const key of Object.keys(parsed.fields)){
      try{
        const val = JSON.parse(parsed.fields[key]);
        if(key === "body" && val && typeof val === "object"){
          Object.assign(body, val); // merge body fields to top level
        }else{
          body[key] = val;
        }
      }catch{
        body[key] = parsed.fields[key];
      }
    }
    for(const file of parsed.files){
      rawFiles.push({ filename: file.filename, mimetype: file.mimetype, buffer: file.buffer, size: file.size });
    }
  }else{
    body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  }

  const model = String(body.model || body.frontendUpstream?.model || "").trim();
  const stream = Boolean(body.stream);
  const contextMode = String(body.contextMode || "standard").trim();
  let messages = Array.isArray(body.messages) ? body.messages.slice(-50) : [];
  messages = applyContextMode(messages, contextMode);
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
  if(!messages.length && !rawFiles.length){ fail(400, { error:"message_required", message:"请先输入要发送的话" }); return; }
  if(!upstream){ fail(400, { error:"frontend_upstream_required", message:"联网搜索需要使用当前模型配置，请先在设置里填 Base URL 和 API Key" }); return; }

  /* ── Real file parsing pipeline ── */
  if(rawFiles.length > 0){
    const parsedFiles = [];
    console.log(`[fileParser] Parsing ${rawFiles.length} file(s)...`);

    for(const file of rawFiles){
      const result = await parseUploadedFile(file.buffer, file.filename, file.mimetype);
      parsedFiles.push(result);
      const status = result.parseStatus === "ok" ? "OK" : result.parseStatus;
      const textLen = result.text ? result.text.length : 0;
      console.log(`[fileParser] ${file.filename} | type=${result.fileType||'?'} | size=${file.size} | status=${status} | textLen=${textLen}` +
        (result.error ? ` | error=${result.error}` : "") +
        (result.warnings && result.warnings.length ? ` | warnings=${result.warnings.join(';')}` : ""));
    }

    /* Build file context and inject as system message */
    const fileContext = buildFileContext(parsedFiles, "standard");
    const ctxLen = fileContext.length;
    if(fileContext){
      const sysIdx = messages.findIndex(m=>m?.role === "system");
      if(sysIdx >= 0){
        messages[sysIdx] = { role:"system", content: messages[sysIdx].content + "\n\n" + fileContext };
      }else{
        messages.unshift({ role:"system", content: fileContext });
      }
    }
    console.log(`[fileParser] Injected ${ctxLen} chars of file context into messages`);

    /* For images: also add vision content if already in messages */
    const hasImages = parsedFiles.some(f=>f.fileType === "image" || /^image\//.test(f.mimeType||""));
    if(hasImages){
      const lastUserIdx = messages.findLastIndex?.(m=>m?.role==="user") ?? -1;
      const imageFiles = rawFiles.filter(f=>/^image\//.test(f.mimetype));
      if(lastUserIdx >= 0 && imageFiles.length > 0){
        const textContent = typeof messages[lastUserIdx].content === "string"
          ? messages[lastUserIdx].content
          : "请分析这些图片";
        const visionContent = [{ type:"text", text:textContent }];
        for(const img of imageFiles){
          const b64 = img.buffer.toString("base64");
          visionContent.push({ type:"image_url", image_url:{ url:`data:${img.mimetype};base64,${b64}` } });
        }
        messages[lastUserIdx] = { role:"user", content: visionContent };
      }
    }
  }

  const lastUserMessage = [...messages].reverse().find(m=>{
    if(typeof m.content === "string") return m?.role === "user";
    /* For vision messages, extract text */
    if(Array.isArray(m.content)){
      const textPart = m.content.find(p=>p.type === "text");
      return m?.role === "user" && textPart ? textPart.text : "";
    }
    return false;
  });
  const userText = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
  const wantsWebSearch = shouldUseWebSearch(userText, Boolean(body.webSearch || body.search));
  if(wantsWebSearch){
    try{
      sources = await searchWeb(userText);
      messages = [{ role:"system", content:formatSearchContext(userText, sources) }, ...messages];
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
      body:JSON.stringify(Object.assign(
        { model, messages, stream:false },
        typeof body.temperature === "number" ? { temperature: body.temperature } : {},
        typeof body.top_p === "number" ? { top_p: body.top_p } : {},
        typeof body.max_tokens === "number" && body.max_tokens > 0 ? { max_tokens: body.max_tokens } : {},
        typeof body.presence_penalty === "number" ? { presence_penalty: body.presence_penalty } : {},
        typeof body.frequency_penalty === "number" ? { frequency_penalty: body.frequency_penalty } : {}
      ))
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

/* ── buildModelsUrl: universal /models URL builder ── */
function buildModelsUrl(baseUrl){
  let url = String(baseUrl || "").trim();
  if(!url) return "";
  url = url.replace(/\/+$/, ""); // strip trailing slashes
  if(url.endsWith("/models")) return url;
  if(url.endsWith("/v1")) return url + "/models";
  if(url.endsWith("/v1/")) return url.replace(/\/+$/, "") + "/models";
  if(!url.includes("/v1")) return url + "/v1/models";
  // has /v1/ somewhere in path
  if(url.endsWith("/v1/")) return url.replace(/\/+$/, "") + "/models";
  return url + "/models";
}

/* ── handleModelsList: universal model list fetcher ── */
async function handleModelsList(req, res){
  let body = {};
  try{
    body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  }catch{
    return sendJson(res, 400, { ok:false, error:"请求格式错误" });
  }

  const providerName = String(body.providerName || "").trim();
  const baseUrl = String(body.baseUrl || "").trim();
  const apiKey = String(body.apiKey || "").trim();

  if(!baseUrl) return sendJson(res, 400, { ok:false, error:"请先填写 Base URL" });
  if(!apiKey) return sendJson(res, 400, { ok:false, error:"请先填写 API Key" });

  const modelsUrl = buildModelsUrl(baseUrl);
  if(!modelsUrl) return sendJson(res, 400, { ok:false, error:"无法构建模型列表请求地址，请检查 Base URL" });

  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 15000);
    const response = await fetch(modelsUrl, {
      method: "GET",
      headers: {
        "authorization": `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      signal: controller.signal
    });
    clearTimeout(timeout);

    const text = await response.text();
    let data = null;
    try{ data = JSON.parse(text); }catch{}

    if(!response.ok){
      if(response.status === 401 || response.status === 403){
        return sendJson(res, 200, { ok:false, error:"获取失败，API Key 无效或无权限" });
      }
      if(response.status === 404){
        return sendJson(res, 200, { ok:false, error:"获取失败，该 Base URL 未提供 /models 接口，可使用手动添加模型" });
      }
      return sendJson(res, 200, { ok:false, error:`获取失败 (HTTP ${response.status})，请检查 Base URL / API Key / 供应商是否支持 /models` });
    }

    if(!data){
      return sendJson(res, 200, { ok:false, error:"获取失败，供应商返回格式异常" });
    }

    /* Normalize models */
    let modelList = [];

    /* OpenAI format: { object:"list", data:[{id:"gpt-4o"}] } */
    if(data.data && Array.isArray(data.data)){
      modelList = data.data;
    }else if(Array.isArray(data)){
      modelList = data;
    }else if(data.models && Array.isArray(data.models)){
      modelList = data.models;
    }

    const models = [];
    const seen = new Set();

    for(const item of modelList){
      const modelId = String(item.id || item.name || "").trim();
      if(!modelId) continue;
      if(seen.has(modelId)) continue;
      seen.add(modelId);
      models.push({
        id: modelId,
        name: modelId,
        owned_by: String(item.owned_by || item.ownedBy || providerName || "").trim() || ""
      });
    }

    models.sort((a,b)=>a.id.localeCompare(b.id));

    sendJson(res, 200, { ok:true, models, providerName, baseUrl, modelsUrl });
  }catch(error){
    if(error?.name === "AbortError"){
      return sendJson(res, 200, { ok:false, error:"获取失败，请求超时，网络或供应商接口异常" });
    }
    sendJson(res, 200, { ok:false, error:`获取失败，网络或供应商接口异常：${error.message}` });
  }
}

/* ── Context mode: apply message trimming rules ── */
function applyContextMode(messages, contextMode){
  const mode = String(contextMode || "standard").trim();
  if(mode === "minimal"){
    return messages.slice(-4);
  }else if(mode === "light"){
    return messages.slice(-10);
  }else if(mode === "deep"){
    return messages.slice(-30);
  }else if(mode === "extreme"){
    return messages.slice(-50);
  }
  // standard: keep what was passed (already limited)
  return messages;
}

/* ── File parsing endpoint ── */
async function handleFileParse(req, res){
  const contentType = String(req.headers["content-type"] || "");
  if(!contentType.includes("multipart/form-data")){
    return sendJson(res, 400, { ok:false, error:"请使用 multipart/form-data 上传文件" });
  }
  const parsed = await readMultipartBody(req);
  if(!parsed || !parsed.files.length){
    return sendJson(res, 400, { ok:false, error:"未收到文件" });
  }

  const results = [];
  for(const file of parsed.files){
    const ext = extname(file.filename).toLowerCase();
    let text = null;
    let error = null;
    let pages = 0;

    /* Text files */
    if([".txt",".md",".json",".csv",".html",".css",".js",".py",".java",".cpp",".c",".h",".rb",".go",".rs",".ts",".tsx",".jsx",".xml",".yaml",".yml",".toml",".ini",".cfg",".log",".sh",".sql",".r",".m",".swift",".kt",".lua",".pl",".php"].includes(ext)){
      text = file.buffer.toString("utf8");
    }
    /* PDF */
    else if(ext === ".pdf"){
      try{
        const pdfParse = (await import("pdf-parse")).default;
        const data = await pdfParse(file.buffer);
        text = data.text;
        pages = data.numpages || 0;
      }catch(e){
        error = "PDF 解析失败，可能是扫描件或加密文件。" + (e.message ? " (" + e.message.slice(0,80) + ")" : "");
      }
    }
    /* DOCX */
    else if(ext === ".docx"){
      try{
        const AdmZip = (await import("adm-zip")).default;
        const zip = new AdmZip(file.buffer);
        const xmlEntry = zip.getEntry("word/document.xml");
        if(xmlEntry){
          const xml = xmlEntry.getData().toString("utf8");
          text = xml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        }else{
          error = "DOCX 解析失败：文件结构异常";
        }
      }catch(e){
        error = "DOCX 解析失败，请确认文件格式正确";
      }
    }
    /* XLSX */
    else if(ext === ".xlsx"){
      try{
        const AdmZip = (await import("adm-zip")).default;
        const zip = new AdmZip(file.buffer);
        const sharedStringsEntry = zip.getEntry("xl/sharedStrings.xml");
        let sharedStrings = [];
        if(sharedStringsEntry){
          const xml = sharedStringsEntry.getData().toString("utf8");
          const matches = xml.match(/<t[^>]*>([^<]+)<\/t>/g);
          if(matches) sharedStrings = matches.map(m=>m.replace(/<\/?t[^>]*>/g,""));
        }
        const sheetEntry = zip.getEntry("xl/worksheets/sheet1.xml");
        if(sheetEntry){
          const sheetXml = sheetEntry.getData().toString("utf8");
          const rows = sheetXml.match(/<row[^>]*>[\s\S]*?<\/row>/g) || [];
          const lines = [];
          for(const row of rows.slice(0,200)){
            const cells = row.match(/<c[^>]*>[\s\S]*?<\/c>/g) || [];
            const cellValues = cells.map(c=>{
              const t = c.match(/t="([^"]*)"/);
              const v = (c.match(/<v[^>]*>([^<]+)<\/v>/) || [])[1];
              if(t && t[1]==="s" && v) return sharedStrings[parseInt(v)] || v;
              return v || "";
            });
            lines.push(cellValues.join("\t"));
          }
          text = lines.join("\n");
        }else{
          error = "XLSX 解析失败：文件结构异常";
        }
      }catch(e){
        error = "XLSX 解析失败，请确认文件格式正确";
      }
    }
    else{
      error = "暂不支持此文件类型（" + ext + "）";
    }

    /* Truncate long text */
    const maxLen = 8000;
    let truncated = false;
    if(text && text.length > maxLen){
      text = text.slice(0, maxLen);
      truncated = true;
    }

    results.push({
      name: file.filename,
      type: file.mimetype,
      size: file.size,
      text: text || "",
      pages,
      error: error || null,
      truncated,
      textLength: text ? text.length : 0
    });
  }

  sendJson(res, 200, { ok:true, files:results });
}

/* ── Volcengine TTS handler ── */
async function handleTts(req, res){
  let body = {};
  try{ body = JSON.parse((await readBody(req)).toString("utf8") || "{}"); }catch(e){
    return sendJson(res, 400, { ok:false, error:"parse_error" });
  }
  let text = String(body.text || "").trim();
  if(!text) return sendJson(res, 400, { ok:false, error:"text_required" });

  /* Clean markdown/code for speech */
  text = text.replace(/```[\s\S]*?```/g,' ').replace(/`[^`]+`/g,' ');
  text = text.replace(/https?:\/\/\S+/g,' ').replace(/[#$%&*+<=>@\\^_|~]+/g,' ');
  text = text.replace(/\s+/g,' ').trim();
  if(!text) return sendJson(res, 400, { ok:false, error:"text_empty" });

  const provider = String(body.provider || "edge").trim();
  const voice = String(body.voice || EDGE_TTS_VOICE).trim();
  const rate = String(body.rate || "+0%").trim();

  /* Provider: Edge TTS — node-edge-tts (pure JS, no Python) */
  if(provider === "edge"){
    try{
      const pkg = await import("node-edge-tts");
      const tts = new pkg.EdgeTTS({ voice, rate });
      const tmpFile = `/tmp/daotian_tts_${Date.now()}.mp3`;
      await tts.ttsPromise(text, tmpFile);
      const { readFile, unlink } = await import("node:fs/promises");
      const buf = await readFile(tmpFile);
      unlink(tmpFile).catch(()=>{});
      if(buf.length < 100) throw new Error("audio small: "+buf.length);
      console.log(`[TTS:edge] ${voice} rate=${rate} ${text.length}c → ${buf.length}b`);
      res.writeHead(200, { ...corsHeaders(), "Content-Type":"audio/mpeg", "Content-Length":String(buf.length) });
      return res.end(buf);
    }catch(e){
      console.error("[TTS:edge]", e.message);
      return sendJson(res, 502, { ok:false, error:"语音暂时不可用" });
    }
  }

  /* Provider: Fish Audio */
  if(provider === "fish"){
    const apiKey = String(body.fishAudioApiKey || "").trim();
    const refId = String(body.fishAudioReferenceId || "").trim();
    if(!apiKey || !refId) return sendJson(res, 400, { ok:false, error:"Fish Audio 未配置完整" });
    try{
      const fishRes = await fetch("https://api.fish.audio/v1/tts", {
        method:"POST",
        headers: { "Authorization":"Bearer "+apiKey, "Content-Type":"application/json" },
        body: JSON.stringify({ text, reference_id: refId, format: "mp3" })
      });
      if(!fishRes.ok){
        const et = await fishRes.text();
        console.error("[TTS:fish] HTTP", fishRes.status, et.slice(0,200));
        return sendJson(res, 502, { ok:false, error:"Fish Audio 请求失败" });
      }
      const fishBuf = Buffer.from(await fishRes.arrayBuffer());
      console.log(`[TTS:fish] ref=${refId} ${text.length}c → ${fishBuf.length}b`);
      res.writeHead(200, { ...corsHeaders(), "Content-Type":"audio/mpeg", "Content-Length":String(fishBuf.length) });
      return res.end(fishBuf);
    }catch(e){
      console.error("[TTS:fish]", e.message);
      return sendJson(res, 502, { ok:false, error:"语音暂时不可用" });
    }
  }

  return sendJson(res, 400, { ok:false, error:"未知语音服务: "+provider });
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
    if(req.method === "POST" && req.url === "/models/list") return await handleModelsList(req, res);
    if(req.method === "POST" && req.url === "/file/parse") return await handleFileParse(req, res);
    if(req.method === "POST" && req.url === "/api/tts") return await handleTts(req, res);
    if(req.method === "POST" && req.url === "/memories/sync"){
      try{
        const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
        const memories = Array.isArray(body.memories) ? body.memories : [];
        const token = String(body.token || req.headers["x-admin-token"] || "");
        if(token && token !== process.env.ADMIN_TOKEN){
          return sendJson(res, 403, { error:"auth_failed", message:"令牌无效" });
        }
        sendJson(res, 200, { ok:true, received: memories.length, time:nowIso() });
      }catch(e){
        sendJson(res, 400, { error:"parse_error", message:e.message });
      }
      return;
    }
    if(req.method === "GET" && req.url === "/memories/export"){
      const token = req.headers["x-admin-token"] || "";
      if(!token || token !== process.env.ADMIN_TOKEN){
        return sendJson(res, 403, { error:"auth_failed", message:"需要x-admin-token头" });
      }
      sendJson(res, 200, { ok:true, message:"服务端存储尚未启用，记忆保存在浏览器本地。后续版本将支持服务端持久化。", time:nowIso() });
      return;
    }
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
