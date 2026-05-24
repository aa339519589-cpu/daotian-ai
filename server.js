import http from "node:http";
import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const DATA_DIR = join(ROOT, "data");
const CONFIG_FILE = join(DATA_DIR, "config.json");
const PUBLIC_DIR = ROOT;

const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "change-me-admin-token";
const PUBLIC_CHAT_ENABLED = process.env.PUBLIC_CHAT_ENABLED !== "false";
const PUBLIC_CHAT_DAILY_LIMIT = Number(process.env.PUBLIC_CHAT_DAILY_LIMIT || 100);
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const HOP_BY_HOP = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

let config = null;
const publicChatLimits = new Map();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function nowIso() {
  return new Date().toISOString();
}


function sendSse(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function openSse(res) {
  res.writeHead(200, {
    ...corsHeaders(),
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
}

async function streamOpenAiResponse({ req, res, upstream, model, messages, body, sources }) {
  const controller = new AbortController();
  req.on("close", () => controller.abort());

  const requestPath = upstream.requestPath || "/v1/chat/completions";
  const response = await fetch(buildUpstreamUrl(upstream, requestPath), {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${upstream.apiKey}`
    },
    signal: controller.signal,
    body: JSON.stringify({
      model,
      messages,
      temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
      stream: true
    })
  });

  if (!response.ok) {
    const detailText = await response.text();
    let detail = detailText;
    try { detail = JSON.parse(detailText); } catch {}
    sendSse(res, "error", { message: "模型请求失败", status: response.status, detail });
    sendSse(res, "done", { ok: false });
    res.end();
    return { status: response.status, usage: null };
  }

  sendSse(res, "sources", { sources });

  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of response.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;

      let data = null;
      try { data = JSON.parse(payload); } catch { continue; }
      const content =
        data?.choices?.[0]?.delta?.content ||
        data?.choices?.[0]?.message?.content ||
        data?.choices?.[0]?.text ||
        "";
      if (content) sendSse(res, "content", { content });
    }
  }

  sendSse(res, "done", { ok: true });
  res.end();
  return { status: response.status, usage: null };
}

function sendJson(res, status, data) {
  res.writeHead(status, { ...JSON_HEADERS, ...corsHeaders() });
  res.end(JSON.stringify(data, null, 2));
}

function corsHeaders() {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-api-key,x-admin-token"
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function loadConfig() {
  await mkdir(DATA_DIR, { recursive: true });
  try {
    config = JSON.parse(await readFile(CONFIG_FILE, "utf8"));
  } catch {
    config = {
      apiKeys: [],
      upstreams: [
        {
          id: "openai",
          name: "OpenAI",
          baseUrl: "https://api.openai.com",
          apiKey: "sk-replace-me",
          enabled: false,
          modelPrefixes: ["gpt-", "o"]
        }
      ],
      logs: []
    };
    await saveConfig();
  }

  config.chatModel ||= "deepseek-chat";
  config.upstreams ||= [];
  config.apiKeys ||= [];
  config.logs ||= [];
  for (const upstream of config.upstreams) {
    upstream.requestPath ||= "/v1/chat/completions";
  }
  await saveConfig();
}

async function saveConfig() {
  await writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function publicConfig() {
  return {
    chatModel: config.chatModel || "deepseek-chat",
    apiKeys: config.apiKeys.map(({ keyHash, ...key }) => key),
    upstreams: config.upstreams.map((upstream) => ({
      ...upstream,
      apiKey: upstream.apiKey ? "********" : ""
    })),
    logs: config.logs.slice(-200).reverse()
  };
}

function requireAdmin(req, res) {
  const token = req.headers["x-admin-token"] || "";
  if (token !== ADMIN_TOKEN) {
    sendJson(res, 401, { error: "invalid_admin_token" });
    return false;
  }
  return true;
}

function extractBearer(req) {
  const auth = req.headers.authorization || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function findRelayKey(req) {
  const token = extractBearer(req) || req.headers["x-api-key"] || "";
  if (!token) return null;
  const keyHash = sha256(token);
  return config.apiKeys.find((key) => key.enabled && key.keyHash === keyHash) || null;
}

function selectUpstream(bodyJson) {
  const model = bodyJson?.model || "";
  const enabled = config.upstreams.filter((item) => item.enabled && item.baseUrl && item.apiKey);
  if (enabled.length === 0) return null;

  return (
    enabled.find((item) =>
      (item.modelPrefixes || [])
        .filter(Boolean)
        .some((prefix) => prefix === "*" || model.startsWith(prefix))
    ) ||
    enabled.find((item) => (item.modelPrefixes || []).length === 0) ||
    enabled[0]
  );
}


function shouldUseWebSearch(message, manualEnabled = false) {
  if (manualEnabled) return true;
  const text = String(message || "");
  const keywords = [
    "联网",
    "搜索",
    "查一下",
    "帮我查",
    "最新",
    "今天",
    "现在",
    "实时",
    "价格",
    "官网",
    "新闻",
    "天气",
    "汇率",
    "发布时间",
    "版本",
    "政策",
    "公告"
  ];
  return keywords.some((keyword) => text.includes(keyword));
}

function formatSearchContext(query, sources) {
  if (!sources.length) {
    return `你现在可以参考联网搜索结果回答用户。\n\n用户问题：${query}\n\n搜索结果为空。请明确说明没有搜到可靠结果，不要编造来源。`;
  }

  const sourceText = sources
    .map((item, index) => {
      return `${index + 1}. 标题：${item.title || "无标题"}\n链接：${item.url || ""}\n摘要：${item.content || ""}`;
    })
    .join("\n\n");

  return `你现在可以参考以下联网搜索结果回答用户。请优先基于搜索结果回答；如果搜索结果不足，请明确说明“不确定”。回答中尽量标注来源链接，不要编造来源。\n\n搜索结果：\n${sourceText}\n\n用户问题：\n${query}`;
}

async function searchWeb(query) {
  if (!TAVILY_API_KEY) {
    const error = new Error("联网搜索未配置，请先在 Render 环境变量中添加 TAVILY_API_KEY");
    error.code = "web_search_not_configured";
    throw error;
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TAVILY_API_KEY}`
    },
    body: JSON.stringify({
      query,
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false
    })
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch {
    data = { text };
  }

  if (!response.ok) {
    console.error("Tavily search failed", response.status, data);
    const error = new Error("搜索失败，请稍后再试");
    error.code = "web_search_failed";
    error.status = response.status;
    throw error;
  }

  return (Array.isArray(data.results) ? data.results : [])
    .slice(0, 5)
    .map((item) => ({
      title: String(item.title || "无标题"),
      url: String(item.url || ""),
      content: String(item.content || item.snippet || "").slice(0, 800)
    }))
    .filter((item) => item.title || item.url || item.content);
}

function buildUpstreamUrl(upstream, requestUrl) {
  const base = upstream.baseUrl.replace(/\/+$/, "");
  return `${base}${requestUrl}`;
}

function relayHeaders(req, upstream) {
  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== "host") {
      headers[key] = value;
    }
  }
  headers.authorization = `Bearer ${upstream.apiKey}`;
  return headers;
}

function recordLog(entry) {
  config.logs.push({ id: randomBytes(8).toString("hex"), createdAt: nowIso(), ...entry });
  config.logs = config.logs.slice(-1000);
  saveConfig().catch((err) => console.error("Failed to save logs", err));
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

function checkPublicChatLimit(req) {
  if (PUBLIC_CHAT_DAILY_LIMIT <= 0) return true;
  const day = new Date().toISOString().slice(0, 10);
  const key = `${day}:${clientIp(req)}`;
  const current = publicChatLimits.get(key) || 0;
  if (current >= PUBLIC_CHAT_DAILY_LIMIT) return false;
  publicChatLimits.set(key, current + 1);
  return true;
}

async function handleChat(req, res, sourceName) {
  const started = Date.now();
  const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
  const model = String(body.model || config.chatModel || "").trim();
  const stream = Boolean(body.stream);
  let messages = Array.isArray(body.messages) ? body.messages.slice(-20) : [];
  let sources = [];
  let upstream = null;
  let status = 502;
  let usage = null;

  function fail(statusCode, payload) {
    if (stream) {
      openSse(res);
      sendSse(res, "error", payload);
      sendSse(res, "done", { ok: false });
      res.end();
    } else {
      sendJson(res, statusCode, payload);
    }
  }

  if (!model) {
    fail(400, { error: "model_required", message: "请先填写模型名称" });
    return;
  }

  if (messages.length === 0) {
    fail(400, { error: "message_required", message: "请先输入要发送的话" });
    return;
  }

  const lastUserMessage = [...messages].reverse().find((message) => message?.role === "user")?.content || "";
  const wantsWebSearch = shouldUseWebSearch(lastUserMessage, Boolean(body.webSearch));

  if (wantsWebSearch) {
    try {
      sources = await searchWeb(lastUserMessage);
      messages = [{ role: "system", content: formatSearchContext(lastUserMessage, sources) }, ...messages];
    } catch (error) {
      // 搜索失败不要让聊天整体崩掉，降级为普通模型回答。
      messages = [
        {
          role: "system",
          content: `本轮尝试联网搜索失败：${error.message}。请不要声称已经完成实时搜索；可以基于已有知识回答，并明确说明实时信息未能获取。`
        },
        ...messages
      ];
      sources = [];
      console.error("Web search degraded", error.code || "web_search_failed", error.message);
    }
  }

  upstream = selectUpstream({ model });
  if (!upstream) {
    fail(503, { error: "no_enabled_upstream", message: "请先启用一个上游通道" });
    return;
  }

  try {
    if (stream) {
      openSse(res);
      const result = await streamOpenAiResponse({ req, res, upstream, model, messages, body, sources });
      status = result.status;
      usage = result.usage;
      return;
    }

    const requestPath = upstream.requestPath || "/v1/chat/completions";
    const response = await fetch(buildUpstreamUrl(upstream, requestPath), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${upstream.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: typeof body.temperature === "number" ? body.temperature : 0.7,
        stream: false
      })
    });

    status = response.status;
    const text = await response.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { text };
    }
    usage = data?.usage || null;

    if (!response.ok) {
      sendJson(res, response.status, {
        error: "upstream_error",
        upstream: upstream.name,
        status: response.status,
        detail: data
      });
      return;
    }

    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text || "";

    sendJson(res, 200, {
      upstream: upstream.name,
      model,
      content,
      sources,
      raw: data
    });
  } catch (error) {
    status = 499;
    if (error?.name === "AbortError") {
      try {
        if (!res.writableEnded) {
          sendSse(res, "done", { ok: false, aborted: true });
          res.end();
        }
      } catch {}
      return;
    }
    status = 502;
    if (stream) {
      if (!res.headersSent) openSse(res);
      sendSse(res, "error", { error: "upstream_error", message: error.message });
      sendSse(res, "done", { ok: false });
      res.end();
    } else {
      sendJson(res, 502, { error: "upstream_error", message: error.message });
    }
  } finally {
    if (upstream) {
      recordLog({
        apiKeyId: sourceName,
        apiKeyName: sourceName === "public-chat" ? "公开对话" : "后台测试对话",
        upstreamId: upstream.id,
        model,
        method: "POST",
        path: upstream.requestPath || "/v1/chat/completions",
        status,
        latencyMs: Date.now() - started,
        usage
      });
    }
  }
}

async function handlePublicChat(req, res) {
  if (!PUBLIC_CHAT_ENABLED) {
    sendJson(res, 403, { error: "public_chat_disabled", message: "公开对话入口没有开启" });
    return;
  }

  if (!checkPublicChatLimit(req)) {
    sendJson(res, 429, {
      error: "rate_limited",
      message: `今天的公开对话次数已用完，每个访问者每天限制 ${PUBLIC_CHAT_DAILY_LIMIT} 次`
    });
    return;
  }

  await handleChat(req, res, "public-chat");
}

async function handleRelay(req, res) {
  const started = Date.now();
  const relayKey = findRelayKey(req);
  if (!relayKey) {
    sendJson(res, 401, { error: { message: "Invalid relay API key", type: "auth_error" } });
    return;
  }

  const requestBody = await readBody(req);
  let bodyJson = null;
  try {
    bodyJson = requestBody.length ? JSON.parse(requestBody.toString("utf8")) : null;
  } catch {
    bodyJson = null;
  }

  const upstream = selectUpstream(bodyJson);
  if (!upstream) {
    sendJson(res, 503, { error: { message: "No enabled upstream configured", type: "relay_error" } });
    return;
  }

  const upstreamUrl = buildUpstreamUrl(upstream, req.url);
  let status = 502;
  let usage = null;

  try {
    const response = await fetch(upstreamUrl, {
      method: req.method,
      headers: relayHeaders(req, upstream),
      body: ["GET", "HEAD"].includes(req.method) ? undefined : requestBody
    });

    status = response.status;
    const headers = {};
    response.headers.forEach((value, key) => {
      if (!HOP_BY_HOP.has(key.toLowerCase())) headers[key] = value;
    });
    Object.assign(headers, corsHeaders());
    res.writeHead(response.status, headers);

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      for await (const chunk of response.body) res.write(Buffer.from(chunk));
      res.end();
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      if (contentType.includes("application/json")) {
        try {
          usage = JSON.parse(buffer.toString("utf8")).usage || null;
        } catch {
          usage = null;
        }
      }
      res.end(buffer);
    }
  } catch (error) {
    status = 502;
    sendJson(res, 502, { error: { message: error.message, type: "upstream_error" } });
  } finally {
    recordLog({
      apiKeyId: relayKey.id,
      apiKeyName: relayKey.name,
      upstreamId: upstream.id,
      model: bodyJson?.model || "",
      method: req.method,
      path: req.url,
      status,
      latencyMs: Date.now() - started,
      usage
    });
  }
}

async function handleAdmin(req, res) {
  if (!requireAdmin(req, res)) return;

  if (req.method === "GET" && req.url === "/admin/config") {
    sendJson(res, 200, publicConfig());
    return;
  }

  if (req.method === "POST" && req.url === "/admin/chat") {
    await handleChat(req, res, "admin-chat");
    return;
  }

  if (req.method === "PATCH" && req.url === "/admin/chat-settings") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    if (typeof body.chatModel === "string") config.chatModel = body.chatModel.trim();
    await saveConfig();
    sendJson(res, 200, publicConfig());
    return;
  }

  if (req.method === "POST" && req.url === "/admin/keys") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const rawKey = `relay_${randomBytes(24).toString("hex")}`;
    const item = {
      id: randomBytes(8).toString("hex"),
      name: body.name || "Default key",
      prefix: `${rawKey.slice(0, 12)}...`,
      keyHash: sha256(rawKey),
      enabled: true,
      createdAt: nowIso()
    };
    config.apiKeys.push(item);
    await saveConfig();
    sendJson(res, 201, { ...item, keyHash: undefined, secret: rawKey });
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/admin/keys/")) {
    const id = req.url.split("/").pop();
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const item = config.apiKeys.find((key) => key.id === id);
    if (!item) return sendJson(res, 404, { error: "key_not_found" });
    if (typeof body.name === "string") item.name = body.name;
    if (typeof body.enabled === "boolean") item.enabled = body.enabled;
    await saveConfig();
    sendJson(res, 200, publicConfig());
    return;
  }

  if (req.method === "POST" && req.url === "/admin/upstreams") {
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const item = {
      id: randomBytes(8).toString("hex"),
      name: body.name || "New upstream",
      baseUrl: body.baseUrl || "",
      apiKey: body.apiKey || "",
      enabled: Boolean(body.enabled),
      modelPrefixes: Array.isArray(body.modelPrefixes) ? body.modelPrefixes : [],
      requestPath: body.requestPath || "/v1/chat/completions"
    };
    config.upstreams.push(item);
    await saveConfig();
    sendJson(res, 201, publicConfig());
    return;
  }

  if (req.method === "PATCH" && req.url.startsWith("/admin/upstreams/")) {
    const id = req.url.split("/").pop();
    const body = JSON.parse((await readBody(req)).toString("utf8") || "{}");
    const item = config.upstreams.find((upstream) => upstream.id === id);
    if (!item) return sendJson(res, 404, { error: "upstream_not_found" });
    for (const field of ["name", "baseUrl", "apiKey", "requestPath"]) {
      if (typeof body[field] === "string" && body[field] !== "********") item[field] = body[field];
    }
    if (typeof body.enabled === "boolean") item.enabled = body.enabled;
    if (Array.isArray(body.modelPrefixes)) item.modelPrefixes = body.modelPrefixes;
    await saveConfig();
    sendJson(res, 200, publicConfig());
    return;
  }

  sendJson(res, 404, { error: "not_found" });
}

function serveStatic(req, res) {
  const cleanPath = normalize(decodeURIComponent(req.url.split("?")[0])).replace(/^(\.\.[/\\])+/, "");
  const relativePath = cleanPath === "/" ? "/index.html" : cleanPath;
  const filePath = join(PUBLIC_DIR, relativePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };
  const stream = createReadStream(filePath);
  stream.on("open", () => {
    res.writeHead(200, { "content-type": contentTypes[extname(filePath)] || "application/octet-stream" });
    stream.pipe(res);
  });
  stream.on("error", () => sendJson(res, 404, { error: "not_found" }));
}

await loadConfig();

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders());
      res.end();
      return;
    }
    if (req.method === "GET" && req.url === "/public/config") {
      return sendJson(res, 200, {
        chatModel: config.chatModel || "deepseek-chat",
        webSearchConfigured: Boolean(TAVILY_API_KEY),
        providers: config.upstreams
          .filter((item) => item.enabled)
          .map((item) => ({ name: item.name, modelPrefixes: item.modelPrefixes || [] }))
      });
    }
    if (req.method === "POST" && req.url === "/chat") return await handlePublicChat(req, res);
    if (req.url.startsWith("/admin/")) return await handleAdmin(req, res);
    if (req.url.startsWith("/v1/")) return await handleRelay(req, res);
    if (req.url === "/health") return sendJson(res, 200, { ok: true, time: nowIso() });
    return serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { error: "internal_server_error", message: error.message });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`稻田 Ai running at http://${HOST}:${PORT}`);
  console.log(`Admin token: ${ADMIN_TOKEN}`);
});
