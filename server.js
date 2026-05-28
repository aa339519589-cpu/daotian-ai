import http from "node:http";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { spawn } from "node:child_process";
import { parseUploadedFile, buildFileContext } from "./fileParser.js";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PUBLIC_DIR = ROOT;
const PORT = Number(process.env.PORT || 8787);
const HOST = process.env.HOST || (process.env.RENDER || process.env.RAILWAY_ENVIRONMENT ? "0.0.0.0" : "127.0.0.1");
const TAVILY_API_KEY = process.env.TAVILY_API_KEY || "";
const PUBLIC_CHAT_DAILY_LIMIT = Number(process.env.PUBLIC_CHAT_DAILY_LIMIT || 100);
const publicChatLimits = new Map();
const DATA_DIR = process.env.DATA_DIR || join(ROOT, "data");
const AUTH_FILE = join(DATA_DIR, "auth.json");
const ACCESS_FILE = join(DATA_DIR, "access.json");
const MEMORY_FILE = join(DATA_DIR, "memories.json");
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_DAYS || 30) * 24 * 60 * 60 * 1000;

/* Edge TTS — Microsoft Read Aloud, free, xiaoxiao neural voice */
const EDGE_TTS_URL = "wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4";
const EDGE_TTS_VOICE = "zh-CN-XiaoxiaoNeural";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function nowIso(){ return new Date().toISOString(); }
function corsHeaders(){
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "authorization,content-type,x-api-key,x-admin-token",
    "access-control-allow-credentials": "true"
  };
}
function sendJson(res, status, data, extraHeaders={}){
  res.writeHead(status, { ...JSON_HEADERS, ...corsHeaders(), ...extraHeaders });
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

async function readJsonBody(req){
  const raw = (await readBody(req)).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function normalizeEmail(email){
  return String(email || "").trim().toLowerCase();
}

function cleanUpstreamErrorDetail(status, text, contentType){
  const raw = String(text || '');
  const ct = String(contentType || '').toLowerCase();
  const looksHtml = ct.includes('text/html') || /<!doctype html|<html[\s>]|<title>\s*\d{3}/i.test(raw);
  if(looksHtml) return 'HTML error page suppressed (HTTP ' + status + ')';
  try{ return JSON.parse(raw); }catch{}
  return raw.slice(0,300);
}

/* ── Python edge-tts fallback ── */
function runCommand(cmd, args){
  return new Promise((resolve, reject)=>{
    const proc = spawn(cmd, args, { timeout: 90000 });
    let stderr = "";
    proc.stderr.on("data", c=>{ stderr += String(c); });
    proc.on("close", code=>{
      if(code === 0) resolve();
      else reject(new Error(`exit ${code}: ${stderr.slice(0,200)}`));
    });
    proc.on("error", reject);
  });
}
async function synthesizeEdgeWithPython(text, voice, rate, tmpFile){
  const pythonCmd = process.platform === "win32" ? "python" : "python3";
  const args = ["-m", "edge_tts", "--text", text, "--voice", voice, "--write-media", tmpFile];
  if(rate && rate !== "+0%") args.push("--rate", rate);
  await runCommand(pythonCmd, args);
  const { readFile, unlink } = await import("node:fs/promises");
  const buf = await readFile(tmpFile);
  unlink(tmpFile).catch(()=>{});
  if(buf.length < 100) throw new Error("python tts too small: "+buf.length);
  return buf;
}

function publicUser(user){
  return { id:user.id, email:user.email, createdAt:user.createdAt };
}
function newId(prefix){
  return prefix + "_" + crypto.randomBytes(12).toString("hex");
}
function tokenHash(token){
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}
function emptyAuthStore(){
  return { users:[], sessions:[], userData:{} };
}
function emptyAccessStore(){
  return { packages:[] };
}
async function readAuthStore(){
  try{
    const raw = await readFile(AUTH_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return {
      users:Array.isArray(parsed.users) ? parsed.users : [],
      sessions:Array.isArray(parsed.sessions) ? parsed.sessions : [],
      userData:parsed.userData && typeof parsed.userData === "object" ? parsed.userData : {}
    };
  }catch(e){
    console.error('[auth] readAuthStore failed:', e.message, '| file:', AUTH_FILE);
    return emptyAuthStore();
  }
}
async function readAccessStore(){
  try{
    const raw = await readFile(ACCESS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    return { packages:Array.isArray(parsed.packages) ? parsed.packages : [] };
  }catch{
    return emptyAccessStore();
  }
}
/* ── Memory Store ── */
function hexId(){ return crypto.randomBytes(8).toString("hex"); }
function simpleKeywordScore(query, fact){
  var q = String(query||'').toLowerCase();
  var f = String(fact||'').toLowerCase();
  if(!q||!f) return 0;
  var score = 0;
  var words = q.split(/[\s,，。！？、]+/).filter(function(w){return w.length>=1;});
  for(var i=0;i<words.length;i++){
    if(f.indexOf(words[i])>=0) score += words[i].length >= 3 ? 2 : 1;
  }
  return score;
}
async function readMemoryStore(){
  try{
    var raw = await readFile(MEMORY_FILE, "utf8");
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  }catch(e){ return {}; }
}
async function writeMemoryStore(store){
  await mkdir(DATA_DIR, {recursive:true});
  var tmp = MEMORY_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, MEMORY_FILE);
}
function getUserMemories(store, userId){
  if(!store[userId]) store[userId] = [];
  return store[userId];
}

/* ── Memory API Handlers ── */
async function handleMemoryIngest(req, res, userId){
  var body = await readJsonBody(req);
  var facts = Array.isArray(body.facts) ? body.facts : [];
  if(!facts.length) return sendJson(res, 400, {ok:false, error:"no_facts"});

  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var results = {added:0, updated:0, skipped:0, ids:[]};

  for(var fi=0; fi<facts.length; fi++){
    var fact = facts[fi];
    var factText = String(fact.fact||'').trim();
    if(!factText) continue;

    // Check for similar existing memory (keyword overlap)
    var bestMatch = null; var bestScore = 0;
    for(var mi=0; mi<mems.length; mi++){
      if(mems[mi].status !== 'active') continue;
      var score = simpleKeywordScore(factText, mems[mi].fact);
      if(score > bestScore){ bestScore = score; bestMatch = mems[mi]; }
    }

    if(bestMatch && bestScore >= 3){
      // Update existing
      bestMatch.fact = factText;
      bestMatch.category = fact.category || bestMatch.category;
      bestMatch.confidence = typeof fact.confidence === 'number' ? fact.confidence : bestMatch.confidence;
      bestMatch.updatedAt = nowIso();
      bestMatch.lastUsedAt = nowIso();
      results.updated++;
      results.ids.push(bestMatch.id);
    }else{
      // Add new
      var mem = {
        id: 'mem_'+hexId(),
        userId: userId,
        fact: factText,
        category: fact.category || 'general',
        confidence: typeof fact.confidence === 'number' ? fact.confidence : 0.7,
        status: 'active',
        createdAt: nowIso(),
        updatedAt: nowIso(),
        lastUsedAt: nowIso()
      };
      mems.push(mem);
      results.added++;
      results.ids.push(mem.id);
    }
  }

  await writeMemoryStore(store);
  console.log('[MemAPI] ingest user='+userId+' added='+results.added+' updated='+results.updated);
  return sendJson(res, 200, {ok:true, ...results});
}

async function handleMemoryRetrieve(req, res, userId){
  var body = await readJsonBody(req);
  var query = String(body.query||'').trim();
  if(!query) return sendJson(res, 400, {ok:false, error:"no_query"});
  var limit = Math.min(Number(body.limit)||5, 10);

  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var actives = mems.filter(function(m){return m.status==='active';});

  // Score and rank
  var scored = actives.map(function(m){
    var s = simpleKeywordScore(query, m.fact);
    // Boost by category match
    if(m.category && query.toLowerCase().indexOf(m.category.toLowerCase())>=0) s += 2;
    // Boost by recency
    var daysSince = m.lastUsedAt ? (Date.now()-new Date(m.lastUsedAt).getTime())/(86400000) : 30;
    var recency = Math.max(0, 1 - daysSince/60); // decay over 60 days
    s += recency * 2;
    return {mem:m, score:s};
  });

  scored.sort(function(a,b){return b.score-a.score;});
  var top = scored.slice(0, limit).filter(function(s){return s.score>0;});

  // Mark as used
  for(var ti=0; ti<top.length; ti++){
    top[ti].mem.lastUsedAt = nowIso();
  }
  writeMemoryStore(store).catch(function(){});

  var results = top.map(function(s){return {id:s.mem.id, fact:s.mem.fact, category:s.mem.category, confidence:s.mem.confidence, score:s.score};});
  return sendJson(res, 200, {ok:true, memories:results});
}

async function handleMemoryList(req, res, userId){
  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var urlObj = new URL(req.url, 'http://localhost');
  var statusFilter = urlObj.searchParams.get('status') || 'active';
  var filtered = mems.filter(function(m){return m.status===statusFilter;});
  return sendJson(res, 200, {ok:true, memories:filtered, total:filtered.length});
}

async function handleMemoryPatch(req, res, userId, memoryId){
  var body = await readJsonBody(req);
  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var found = mems.find(function(m){return m.id===memoryId;});
  if(!found) return sendJson(res, 404, {ok:false, error:"not_found"});
  if(body.fact !== undefined) found.fact = String(body.fact);
  if(body.category !== undefined) found.category = String(body.category);
  if(body.status !== undefined) found.status = String(body.status);
  if(typeof body.confidence === 'number') found.confidence = body.confidence;
  found.updatedAt = nowIso();
  await writeMemoryStore(store);
  return sendJson(res, 200, {ok:true, memory:found});
}

async function handleMemoryDelete(req, res, userId, memoryId){
  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var found = mems.find(function(m){return m.id===memoryId;});
  if(!found) return sendJson(res, 404, {ok:false, error:"not_found"});
  found.status = 'deleted';
  found.updatedAt = nowIso();
  await writeMemoryStore(store);
  return sendJson(res, 200, {ok:true});
}

async function handleMemoryMigrate(req, res, userId){
  var body = await readJsonBody(req);
  var oldMemories = Array.isArray(body.memories) ? body.memories : [];
  var store = await readMemoryStore();
  var mems = getUserMemories(store, userId);
  var count = 0;

  for(var oi=0; oi<oldMemories.length; oi++){
    var old = oldMemories[oi];
    var content = String(old.content||old.fact||'').trim();
    if(!content) continue;
    // Skip if similar already exists
    var exists = false;
    for(var mi=0; mi<mems.length; mi++){
      if(simpleKeywordScore(content, mems[mi].fact) >= 3){ exists=true; break; }
    }
    if(!exists){
      mems.push({
        id: 'mem_'+hexId(),
        userId: userId,
        fact: content,
        category: old.tags && old.tags.length ? old.tags[0] : 'migrated',
        confidence: 0.6,
        status: 'active',
        createdAt: old.createdAt ? new Date(old.createdAt).toISOString() : nowIso(),
        updatedAt: nowIso(),
        lastUsedAt: nowIso()
      });
      count++;
    }
  }

  await writeMemoryStore(store);
  console.log('[MemAPI] migrate user='+userId+' imported='+count+' skipped='+(oldMemories.length-count));
  return sendJson(res, 200, {ok:true, imported:count});
}

async function writeAccessStore(store){
  await mkdir(DATA_DIR, { recursive:true });
  const tmp = ACCESS_FILE + "." + process.pid + "." + Date.now() + ".tmp";
  await writeFile(tmp, JSON.stringify(store, null, 2));
  await rename(tmp, ACCESS_FILE);
}
async function writeAuthStore(store){
  try{
    await mkdir(DATA_DIR, { recursive:true });
    const tmp = AUTH_FILE + "." + process.pid + "." + Date.now() + ".tmp";
    await writeFile(tmp, JSON.stringify(store, null, 2));
    await rename(tmp, AUTH_FILE);
  }catch(e){
    console.error('[auth] writeAuthStore failed:', e.message, '| file:', AUTH_FILE, '| users:', store.users.length);
    throw e;
  }
}
function parseCookies(req){
  const out = {};
  String(req.headers.cookie || "").split(";").forEach(part=>{
    const idx = part.indexOf("=");
    if(idx < 0) return;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if(key) out[key] = decodeURIComponent(value);
  });
  return out;
}
function getBearerToken(req){
  const auth = String(req.headers.authorization || "");
  if(auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
  return "";
}
function sessionCookie(req, token, maxAgeSeconds){
  const secure = String(req.headers["x-forwarded-proto"] || "").includes("https") || Boolean(process.env.RENDER);
  const expiresAt = new Date(Date.now() + Math.max(0, Number(maxAgeSeconds || 0)) * 1000).toUTCString();
  return [
    "daotian_session=" + encodeURIComponent(token || ""),
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=" + maxAgeSeconds,
    "Expires=" + expiresAt,
    secure ? "Secure" : ""
  ].filter(Boolean).join("; ");
}
async function createSession(req, store, userId){
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  store.sessions = store.sessions.filter(s=>s && s.expiresAt > now && s.userId !== userId);
  store.sessions.push({ tokenHash:tokenHash(token), userId, createdAt:nowIso(), expiresAt:now + SESSION_TTL_MS });
  return token;
}
async function authFromRequest(req, mutate=false){
  const token = getBearerToken(req) || parseCookies(req).daotian_session || "";
  if(!token) return null;
  const store = await readAuthStore();
  const now = Date.now();
  const hashed = tokenHash(token);
  let changed = false;
  store.sessions = store.sessions.filter(s=>{
    const keep = s && s.expiresAt > now;
    if(!keep) changed = true;
    return keep;
  });
  const session = store.sessions.find(s=>s.tokenHash === hashed);
  if(!session){
    if(changed || mutate) await writeAuthStore(store);
    return null;
  }
  const user = store.users.find(u=>u.id === session.userId);
  if(!user) return null;
  if(changed || mutate) await writeAuthStore(store);
  return { store, user, session, token };
}
async function requireAuth(req, res){
  const auth = await authFromRequest(req);
  if(!auth){
    sendJson(res, 401, { ok:false, error:"unauthorized", message:"请先登录" });
    return null;
  }
  return auth;
}

async function handleRegister(req, res){
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return sendJson(res, 400, { ok:false, error:"invalid_email", message:"邮箱格式不正确" });
  if(password.length < 6) return sendJson(res, 400, { ok:false, error:"weak_password", message:"密码至少 6 位" });

  const store = await readAuthStore();
  if(store.users.some(u=>u.email === email)) return sendJson(res, 409, { ok:false, error:"email_exists", message:"这个邮箱已经注册" });
  const user = { id:newId("u"), email, passwordHash:await bcrypt.hash(password, 12), createdAt:nowIso() };
  store.users.push(user);
  store.userData[user.id] = store.userData[user.id] || {};
  const token = await createSession(req, store, user.id);
  await writeAuthStore(store);
  console.log('[auth] REGISTER OK | email:', email, '| userId:', user.id, '| total users:', store.users.length);
  sendJson(res, 200, { ok:true, user:publicUser(user) }, { "set-cookie":sessionCookie(req, token, Math.floor(SESSION_TTL_MS/1000)) });
}

async function handleLogin(req, res){
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  const store = await readAuthStore();
  const user = store.users.find(u=>u.email === email);
  if(!user || !(await bcrypt.compare(password, user.passwordHash || ""))){
    console.log('[auth] LOGIN FAILED | email:', email, '| users in store:', store.users.length, '| user found:', !!user, '| all emails:', store.users.map(u=>u.email).join(', '));
    return sendJson(res, 401, { ok:false, error:"invalid_credentials", message:"邮箱或密码不正确" });
  }
  store.userData[user.id] = store.userData[user.id] || {};
  const token = await createSession(req, store, user.id);
  await writeAuthStore(store);
  sendJson(res, 200, { ok:true, user:publicUser(user) }, { "set-cookie":sessionCookie(req, token, Math.floor(SESSION_TTL_MS/1000)) });
}

async function handleLogout(req, res){
  const token = getBearerToken(req) || parseCookies(req).daotian_session || "";
  if(token){
    const store = await readAuthStore();
    const hashed = tokenHash(token);
    store.sessions = store.sessions.filter(s=>s.tokenHash !== hashed);
    await writeAuthStore(store);
  }
  sendJson(res, 200, { ok:true }, { "set-cookie":sessionCookie(req, "", 0) });
}

async function handleMe(req, res){
  const auth = await authFromRequest(req);
  if(!auth) return sendJson(res, 401, { ok:false, error:"unauthorized" }, { "set-cookie":sessionCookie(req, "", 0) });
  sendJson(res, 200, { ok:true, user:publicUser(auth.user) });
}

async function handleGetUserData(req, res){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  const data = auth.store.userData[auth.user.id] && typeof auth.store.userData[auth.user.id] === "object" ? auth.store.userData[auth.user.id] : {};
  sendJson(res, 200, { ok:true, data });
}

async function handleSaveUserData(req, res){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const current = auth.store.userData[auth.user.id] && typeof auth.store.userData[auth.user.id] === "object" ? auth.store.userData[auth.user.id] : {};
  if(body.data && typeof body.data === "object" && !Array.isArray(body.data)){
    auth.store.userData[auth.user.id] = body.data;
  }else if(body.items && typeof body.items === "object" && !Array.isArray(body.items)){
    for(const [key, value] of Object.entries(body.items)){
      if(value === null || typeof value === "undefined") delete current[key];
      else current[key] = String(value);
    }
    auth.store.userData[auth.user.id] = current;
  }else if(typeof body.key === "string"){
    if(body.value === null || typeof body.value === "undefined") delete current[body.key];
    else current[body.key] = String(body.value);
    auth.store.userData[auth.user.id] = current;
  }else{
    return sendJson(res, 400, { ok:false, error:"invalid_payload" });
  }
  await writeAuthStore(auth.store);
  sendJson(res, 200, { ok:true, data:auth.store.userData[auth.user.id] || {} });
}

async function handleCreateAccessPackage(req, res){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const packageName = String(body.packageName || "").trim();
  const quotaTotal = Number(body.quotaTotal || 0);
  const expiresInDays = Number(body.expiresInDays || body.expiryDays || 0);
  let items = Array.isArray(body.items) ? body.items : [];
  // Backward compat: single providerId + models → items
  if(!items.length && body.providerId){
    const models = Array.isArray(body.models) ? body.models.map(v=>String(v||"").trim()).filter(Boolean) : [];
    items = [{ providerId: String(body.providerId).trim(), models }];
  }
  if(!packageName) return sendJson(res, 400, { ok:false, error:"package_name_required", message:"请填写接入包名称" });
  if(!items.length) return sendJson(res, 400, { ok:false, error:"items_required", message:"请至少选择一个提供方及模型" });
  // Validate each item has models
  for(const item of items){
    if(!Array.isArray(item.models) || !item.models.length){
      return sendJson(res, 400, { ok:false, error:"models_required", message:"每个提供方至少选择一个模型" });
    }
  }
  const userData = auth.store.userData[auth.user.id] || {};
  const shareProviders = parseShareProviders(userData);
  // Resolve provider info for each item
  for(const item of items){
    const provider = shareProviders.find(p=>p.id === item.providerId);
    if(!provider) return sendJson(res, 404, { ok:false, error:"provider_not_found", message:"未找到提供方: "+item.providerId });
    // Attach provider info for storage
    item._baseUrl = provider.baseUrl;
    item._apiKey = provider.apiKey;
    item._path = provider.path || "/v1/chat/completions";
    item._providerName = provider.providerName;
  }
  const store = await readAccessStore();
  const code = String(body.code || "").trim() || crypto.randomBytes(4).toString("hex").toUpperCase();
  const pkg = normalizeAccessPackage({
    id: newId("pkg"),
    code,
    providerUserId: auth.user.id,
    packageName,
    items: items.map(it=>({ providerId: it.providerId, models: it.models, baseUrl: it._baseUrl, apiKey: it._apiKey, path: it._path, providerName: it._providerName })),
    quotaTotal,
    expiresAt: expiresInDays > 0 ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString() : "",
    quotaUsed: 0,
    enabled: true,
    createdAt: nowIso(),
    updatedAt: nowIso()
  });
  store.packages.push(pkg);
  await writeAccessStore(store);
  sendJson(res, 200, { ok:true, package: {
    id: pkg.id, code: pkg.code, packageName: pkg.packageName,
    items: pkg.items, models: pkg.models,
    enabled: pkg.enabled, quotaTotal: pkg.quotaTotal, quotaUsed: pkg.quotaUsed,
    expiresAt: pkg.expiresAt, createdAt: pkg.createdAt, status: packageStatus(pkg)
  } });
}

async function handleListAccessPackages(req, res){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  const store = await readAccessStore();
  const packages = store.packages.filter(p=>p.providerUserId === auth.user.id).map(p=>{
    const pkg = normalizeAccessPackage(p);
    return {
      id: pkg.id, code: pkg.code, packageName: pkg.packageName,
      models: pkg.models, items: pkg.items, modelCount: pkg.models.length,
      enabled: pkg.enabled, quotaTotal: pkg.quotaTotal, quotaUsed: pkg.quotaUsed,
      expiresAt: pkg.expiresAt, status: packageStatus(pkg),
      createdAt: pkg.createdAt, updatedAt: pkg.updatedAt
    };
  });
  sendJson(res, 200, { ok:true, packages });
}

/* ── Package management ── */
async function handleDeleteAccessPackage(req, res, packageId){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  const store = await readAccessStore();
  const idx = store.packages.findIndex(p=>p.id === packageId && p.providerUserId === auth.user.id);
  if(idx < 0) return sendJson(res, 404, { ok:false, error:"not_found", message:"未找到该接入码" });
  store.packages.splice(idx, 1);
  await writeAccessStore(store);
  sendJson(res, 200, { ok:true });
}
async function handleUpdateAccessPackage(req, res, packageId){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const store = await readAccessStore();
  const idx = store.packages.findIndex(p=>p.id === packageId && p.providerUserId === auth.user.id);
  if(idx < 0) return sendJson(res, 404, { ok:false, error:"not_found", message:"未找到该接入码" });
  const existing = store.packages[idx];
  if(body.enabled !== undefined) existing.enabled = Boolean(body.enabled);
  if(body.packageName !== undefined) existing.packageName = String(body.packageName);
  if(typeof body.quotaTotal === 'number') existing.quotaTotal = Number(body.quotaTotal);
  if(body.expiresAt !== undefined) existing.expiresAt = body.expiresAt ? new Date(body.expiresAt).toISOString() : "";
  if(Array.isArray(body.items)) existing.items = body.items;
  existing.updatedAt = nowIso();
  await writeAccessStore(store);
  const pkg = normalizeAccessPackage(existing);
  sendJson(res, 200, { ok:true, package: {
    id: pkg.id, code: pkg.code, packageName: pkg.packageName,
    models: pkg.models, items: pkg.items, modelCount: pkg.models.length,
    enabled: pkg.enabled, quotaTotal: pkg.quotaTotal, quotaUsed: pkg.quotaUsed,
    expiresAt: pkg.expiresAt, status: packageStatus(pkg), createdAt: pkg.createdAt
  }});
}
async function handleRegenerateAccessCode(req, res, packageId){
  const auth = await requireAuth(req, res);
  if(!auth) return;
  const store = await readAccessStore();
  const idx = store.packages.findIndex(p=>p.id === packageId && p.providerUserId === auth.user.id);
  if(idx < 0) return sendJson(res, 404, { ok:false, error:"not_found", message:"未找到该接入码" });
  const old = store.packages[idx];
  // Generate new code, invalidate old (keep same package)
  const newCode = crypto.randomBytes(4).toString("hex").toUpperCase();
  // Delete old, push new with new code
  const pkg = normalizeAccessPackage({ ...old, code: newCode, updatedAt: nowIso() });
  store.packages.splice(idx, 1);
  store.packages.push(pkg);
  await writeAccessStore(store);
  sendJson(res, 200, { ok:true, package: {
    id: pkg.id, code: pkg.code, packageName: pkg.packageName,
    oldCode: old.code, models: pkg.models, items: pkg.items, modelCount: pkg.models.length,
    enabled: pkg.enabled, quotaTotal: pkg.quotaTotal, quotaUsed: pkg.quotaUsed,
    expiresAt: pkg.expiresAt, status: packageStatus(pkg), createdAt: pkg.createdAt
  }});
}

async function handleClaimAccessCode(req, res){
  let body = {};
  try{ body = await readJsonBody(req); }catch{ return sendJson(res, 400, { ok:false, error:"parse_error" }); }
  const code = String(body.code || "").trim();
  if(!code) return sendJson(res, 400, { ok:false, error:"code_required", message:"请输入接入码" });
  const hit = await findAccessPackageByCode(code);
  if(!hit) return sendJson(res, 404, { ok:false, error:"not_found", message:"接入码不存在或已失效" });
  const pkg = hit.pkg;
  const status = packageStatus(pkg);
  if(status === "disabled") return sendJson(res, 403, { ok:false, error:"disabled", message:"接入码已停用" });
  if(status === "expired") return sendJson(res, 410, { ok:false, error:"expired", message:"接入码已过期" });
  if(status === "quota") return sendJson(res, 429, { ok:false, error:"quota", message:"接入额度已用完" });
  sendJson(res, 200, { ok:true, package:{
    id: pkg.id,
    code: pkg.code,
    packageName: pkg.packageName,
    models: pkg.models,
    providerName: pkg.providerName,
    status: packageStatus(pkg),
    expiresAt: pkg.expiresAt,
    quotaTotal: pkg.quotaTotal,
    quotaUsed: pkg.quotaUsed
  }});
}

function parseUserSettings(userData){
  const raw = userData && typeof userData === "object" ? userData["daotian.settings.v323"] || userData["daotian.settings.v322"] || userData["daotian.settings"] : "";
  if(!raw) return {};
  try{
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }catch{
    return {};
  }
}
function parseProvidersFromSettings(userData, field){
  const parsed = parseUserSettings(userData);
  const providers = Array.isArray(parsed?.[field]) ? parsed[field] : [];
  return providers.map(p=>({
    id:String(p.id || "").trim(),
    providerType:String(p.providerType || "openai").trim(),
    providerName:String(p.providerName || "").trim(),
    baseUrl:String(p.baseUrl || "").trim(),
    apiKey:String(p.apiKey || "").trim(),
    path:String(p.path || p.requestPath || "/v1/chat/completions").trim() || "/v1/chat/completions",
    models:Array.isArray(p.models) ? p.models.map(v=>String(v||"").trim()).filter(Boolean) : []
  })).filter(p=>p.baseUrl && p.apiKey);
}
function parseSelfProviders(userData){
  return parseProvidersFromSettings(userData, "modelProviders");
}
function parseShareProviders(userData){
  return parseProvidersFromSettings(userData, "shareModelProviders");
}
function parseUserProviders(userData){
  return parseSelfProviders(userData).concat(parseShareProviders(userData));
}

function normalizeAccessPackage(pkg){
  const models = Array.isArray(pkg.models) ? pkg.models.map(v=>String(v||"").trim()).filter(Boolean) : [];
  // Migrate old single-provider packages to items format
  let items = Array.isArray(pkg.items) ? pkg.items : [];
  if(!items.length && (pkg.providerId || models.length)){
    items = [{ providerId: String(pkg.providerId||"").trim(), models: Array.from(new Set(models)) }];
  }
  // Deduplicate models within each item
  items = items.map(item=>({
    providerId: String(item.providerId||"").trim(),
    models: Array.from(new Set((Array.isArray(item.models)?item.models:[]).map(v=>String(v||"").trim()).filter(Boolean)))
  })).filter(item=>item.providerId && item.models.length);
  return {
    id:String(pkg.id || "").trim(),
    code:String(pkg.code || "").trim(),
    providerUserId:String(pkg.providerUserId || "").trim(),
    packageName:String(pkg.packageName || pkg.name || "").trim(),
    items,
    // Flattened models for backward compat
    models: Array.from(new Set(items.reduce((acc,it)=>acc.concat(it.models),[]))),
    enabled:pkg.enabled !== false,
    quotaTotal:Number(pkg.quotaTotal || 0),
    quotaUsed:Number(pkg.quotaUsed || 0),
    expiresAt:pkg.expiresAt ? new Date(pkg.expiresAt).toISOString() : "",
    createdAt:pkg.createdAt || nowIso(),
    updatedAt:pkg.updatedAt || nowIso()
  };
}

function packageStatus(pkg){
  if(!pkg.enabled) return "disabled";
  if(pkg.expiresAt && Date.parse(pkg.expiresAt) <= Date.now()) return "expired";
  if(pkg.quotaTotal > 0 && pkg.quotaUsed >= pkg.quotaTotal) return "quota";
  return "active";
}

async function findAccessPackageByCode(code){
  const normalized = String(code || "").trim();
  if(!normalized) return null;
  const store = await readAccessStore();
  const pkg = store.packages.map(normalizeAccessPackage).find(p=>p.code === normalized);
  if(!pkg) return null;
  return { store, pkg };
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

async function resolveUpstreamFromRequest(req, body){
  const accessCode = String(body.accessCode || body.code || "").trim();
  if(accessCode){
    const hit = await findAccessPackageByCode(accessCode);
    if(!hit) return { error: { status:404, message:"接入码不存在或已失效" } };
    const pkg = normalizeAccessPackage(hit.pkg);
    const status = packageStatus(pkg);
    if(status === "disabled") return { error:{ status:403, message:"接入码已停用" } };
    if(status === "expired") return { error:{ status:410, message:"接入码已过期" } };
    if(status === "quota") return { error:{ status:429, message:"接入额度已用完" } };
    // Find the model in items to get the correct provider
    const requestedModel = String(body.model || "").trim();
    let upstream = null;
    for(const item of pkg.items){
      if(item.models.includes(requestedModel) || !requestedModel){
        // If item has stored provider info, use it; otherwise look up from user data
        const baseUrl = item.baseUrl || "";
        const apiKey = item.apiKey || "";
        const path = item.path || "/v1/chat/completions";
        if(baseUrl && apiKey){
          upstream = { id: item.providerId, name: item.providerName || item.providerId, baseUrl, apiKey, requestPath: path };
          break;
        }
      }
    }
    // Fallback: look up provider from share providers
    if(!upstream){
      const auth2 = await authFromRequest(req);
      if(auth2){
        const userData2 = auth2.store.userData[auth2.user.id] || {};
        const shareProviders = parseShareProviders(userData2);
        for(const item of pkg.items){
          const provider = shareProviders.find(pr=>pr.id === item.providerId);
          if(provider && item.models.includes(requestedModel)){
            upstream = { id: provider.id, name: provider.providerName, baseUrl: provider.baseUrl, apiKey: provider.apiKey, requestPath: provider.path || "/v1/chat/completions" };
            break;
          }
        }
      }
    }
    if(!upstream && requestedModel){
      return { error: { status:403, message:"该接入码不允许使用模型: "+requestedModel } };
    }
    if(!upstream){
      // No model requested yet, use first available item's provider
      for(const item of pkg.items){
        if(item.baseUrl && item.apiKey){
          upstream = { id: item.providerId, name: item.providerName || item.providerId, baseUrl: item.baseUrl, apiKey: item.apiKey, requestPath: item.path || "/v1/chat/completions" };
          break;
        }
      }
    }
    if(!upstream) return { error:{ status:500, message:"接入码配置异常，未找到可用提供方" } };
    return { upstream, packageHit: hit };
  }
  const auth = await authFromRequest(req);
  const providerId = String(body.providerId || "").trim();
  const providerScope = String(body.providerScope || "").trim();
  if(auth && providerId){
    const userData = auth.store.userData[auth.user.id] || {};
    const providers = providerScope === "self"
      ? parseSelfProviders(userData)
      : providerScope === "share"
        ? parseShareProviders(userData)
        : parseUserProviders(userData);
    const provider = providers.find(p=>p.id === providerId);
    if(provider && provider.baseUrl && provider.apiKey){
      return {
        upstream: {
          id: provider.id,
          name: provider.providerName || "当前模型",
          baseUrl: provider.baseUrl,
          apiKey: provider.apiKey,
          requestPath: provider.path || "/v1/chat/completions"
        }
      };
    }
    return { error:{ status:404, message:"未找到可用的模型提供方" } };
  }
  const fallback = normalizeFrontendUpstream(body);
  if(fallback) return { upstream:fallback };
  return { error:{ status:400, message:"缺少模型提供方或接入码" } };
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
    const ct = response.headers.get('content-type') || '';
    const detail = cleanUpstreamErrorDetail(response.status, detailText, ct);
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
  const resolved = await resolveUpstreamFromRequest(req, body);
  const upstream = resolved.upstream || null;

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
  if(resolved.error){ fail(resolved.error.status || 400, { error:"upstream_resolution_failed", message: resolved.error.message }); return; }
  if(!upstream){ fail(400, { error:"frontend_upstream_required", message:"请先选择模型提供方或输入接入码" }); return; }
  if(resolved.packageHit && resolved.packageHit.pkg){
    const allowedModels = Array.isArray(resolved.packageHit.pkg.models) ? resolved.packageHit.pkg.models : [];
    if(allowedModels.length && model && !allowedModels.includes(model)){
      fail(403, { error:"model_not_allowed", message:"该接入码不允许使用这个模型" });
      return;
    }
  }

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
      if(resolved.packageHit && resolved.packageHit.store && resolved.packageHit.pkg){
        const store = resolved.packageHit.store;
        const idx = store.packages.findIndex(p=>p.code === resolved.packageHit.pkg.code);
        if(idx >= 0){
          store.packages[idx] = { ...store.packages[idx], quotaUsed: Number(store.packages[idx].quotaUsed || 0) + 1, updatedAt: nowIso() };
          await writeAccessStore(store);
        }
      }
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
    if(!response.ok){ sendJson(res, response.status, { error:"upstream_error", status:response.status, detail:cleanUpstreamErrorDetail(response.status, text, response.headers.get('content-type')||'') }); return; }
    const content = data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || data?.output_text || "";
    if(resolved.packageHit && resolved.packageHit.store && resolved.packageHit.pkg){
      const store = resolved.packageHit.store;
      const idx = store.packages.findIndex(p=>p.code === resolved.packageHit.pkg.code);
      if(idx >= 0){
        store.packages[idx] = { ...store.packages[idx], quotaUsed: Number(store.packages[idx].quotaUsed || 0) + 1, updatedAt: nowIso() };
        await writeAccessStore(store);
      }
    }
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
  const accessCode = String(body.accessCode || "").trim();
  const providerId = String(body.providerId || "").trim();
  const providerScope = String(body.providerScope || "").trim();

  if(accessCode){
    const hit = await findAccessPackageByCode(accessCode);
    if(!hit) return sendJson(res, 200, { ok:false, error:"接入码不存在或已失效" });
    const pkg = normalizeAccessPackage(hit.pkg);
    const status = packageStatus(pkg);
    if(status !== "active") return sendJson(res, 200, { ok:false, error:status === "disabled" ? "接入码已停用" : status === "expired" ? "接入码已过期" : "接入额度已用完" });
    // Build model list from items, each with provider name
    const models = [];
    const seen = new Set();
    for(const item of pkg.items){
      for(const m of item.models){
        if(!seen.has(m)){ seen.add(m); models.push({ id:m, name:m, owned_by: item.providerName || item.providerId || "接入模型" }); }
      }
    }
    return sendJson(res, 200, { ok:true, models, packageName:pkg.packageName, accessCode, itemCount: pkg.items.length });
  }

  /* baseUrl + apiKey 优先于 providerId —— 表单里填的值永远优先于已保存数据 */
  if(baseUrl && apiKey){
    const modelsUrl = buildModelsUrl(baseUrl);
    if(!modelsUrl) return sendJson(res, 400, { ok:false, error:"无法构建模型列表请求地址，请检查 Base URL" });
    try{
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(), 15000);
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: { "authorization": "Bearer " + apiKey, "content-type": "application/json" },
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
          return sendJson(res, 200, { ok:false, error:"获取失败，该 Base URL 未提供 /models 接口（请求地址："+modelsUrl+"），可使用手动添加模型" });
        }
        return sendJson(res, 200, { ok:false, error:"获取失败 (HTTP "+response.status+")，请求地址："+modelsUrl+"，请检查 Base URL / API Key 是否正确" });
      }
      if(!data) return sendJson(res, 200, { ok:false, error:"获取失败，供应商返回格式异常" });
      let modelList = [];
      if(data.data && Array.isArray(data.data)) modelList = data.data;
      else if(Array.isArray(data)) modelList = data;
      else if(data.models && Array.isArray(data.models)) modelList = data.models;
      const models = [];
      const seen = new Set();
      for(const item of modelList){
        const modelId = String(item.id || item.name || "").trim();
        if(!modelId) continue;
        if(seen.has(modelId)) continue;
        seen.add(modelId);
        models.push({ id: modelId, name: modelId, owned_by: String(item.owned_by || item.ownedBy || providerName || "").trim() || "" });
      }
      models.sort((a,b)=>a.id.localeCompare(b.id));
      return sendJson(res, 200, { ok:true, models, providerName, baseUrl, modelsUrl });
    }catch(error){
      if(error?.name === "AbortError"){
        return sendJson(res, 200, { ok:false, error:"获取失败，请求超时（请求地址："+modelsUrl+"），请检查网络或供应商接口状态" });
      }
      return sendJson(res, 200, { ok:false, error:"获取失败: "+((error&&error.message)||'网络错误')+"（请求地址："+modelsUrl+"）" });
    }
  }

  /* 没有实时 baseUrl/apiKey 时，才从已保存 provider 里读 */
  if(providerId){
    const auth = await authFromRequest(req);
    if(!auth) return sendJson(res, 401, { ok:false, error:"unauthorized", message:"请先登录" });
    const userData = auth.store.userData[auth.user.id] || {};
    const providers = providerScope === "self"
      ? parseSelfProviders(userData)
      : providerScope === "share"
        ? parseShareProviders(userData)
        : parseUserProviders(userData);
    const provider = providers.find(p=>p.id === providerId);
    if(!provider) return sendJson(res, 404, { ok:false, error:"not_found", message:"未找到模型提供方" });
    return sendJson(res, 200, { ok:true, models:provider.models.map(id=>({ id, name:id, owned_by: provider.providerName || "" })), providerName:provider.providerName, providerId });
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

  /* Provider: Edge TTS — generate single clean MP3; frontend handles long-text queue */
  if(provider === "edge"){
    // Truncate to first ~450 chars (frontend sends ~400-char chunks; this is a safety net)
    const ttsText = text.length > 500 ? text.slice(0, 450) : text;
    const { readFile, unlink } = await import("node:fs/promises");
    const tmpFile = `/tmp/daotian_tts_${Date.now()}_${Math.random().toString(36).slice(2,8)}.mp3`;
    let buf = null;
    let lastErr = null;

    // node-edge-tts, with 1 retry
    for(let attempt = 0; attempt < 2 && !buf; attempt++){
      try{
        const pkg = await import("node-edge-tts");
        const tts = new pkg.EdgeTTS({ voice, rate });
        await tts.ttsPromise(ttsText, tmpFile);
        const raw = await readFile(tmpFile);
        if(raw.length >= 80){ buf = raw; }
        else { throw new Error("audio too small: "+raw.length); }
      }catch(e){
        lastErr = e;
        if(attempt === 0) console.error("[TTS:edge] node-edge-tts attempt "+(attempt+1)+" failed:", e.message);
      }
    }

    // python edge_tts fallback
    if(!buf){
      try{
        buf = await synthesizeEdgeWithPython(ttsText, voice, rate, tmpFile);
      }catch(e){
        lastErr = e;
        console.error("[TTS:edge] python fallback failed:", e.message);
      }
    }

    unlink(tmpFile).catch(function(){});

    if(!buf){
      console.error("[TTS:edge] FAIL provider="+provider+" voice="+voice+" rate="+rate+" origLen="+text.length+" reason="+(lastErr ? lastErr.message : "unknown"));
      return sendJson(res, 502, { ok:false, error:"语音暂时不可用" });
    }

    console.log("[TTS:edge] "+voice+" rate="+rate+" "+text.length+"c → "+buf.length+"b");
    res.writeHead(200, { ...corsHeaders(), "Content-Type":"audio/mpeg", "Content-Length":String(buf.length) });
    return res.end(buf);
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
    const pathname = new URL(req.url, "http://localhost").pathname;
    if(req.method === "OPTIONS"){ res.writeHead(204, corsHeaders()); res.end(); return; }
    if(req.method === "POST" && pathname === "/api/auth/register") return await handleRegister(req, res);
    if(req.method === "POST" && pathname === "/api/auth/login") return await handleLogin(req, res);
    if(req.method === "POST" && pathname === "/api/auth/logout") return await handleLogout(req, res);
    if(req.method === "GET" && pathname === "/api/auth/me") return await handleMe(req, res);
    if(req.method === "GET" && pathname === "/api/user/data") return await handleGetUserData(req, res);
    if((req.method === "POST" || req.method === "PUT") && pathname === "/api/user/data") return await handleSaveUserData(req, res);
    if(req.method === "POST" && pathname === "/api/access/claim") return await handleClaimAccessCode(req, res);
    if(req.method === "GET" && pathname === "/api/access/packages") return await handleListAccessPackages(req, res);
    if(req.method === "POST" && pathname === "/api/access/packages") return await handleCreateAccessPackage(req, res);
    // Package management: DELETE / PATCH / regenerate
    if(pathname.startsWith("/api/access/packages/")){
      var pkgId = pathname.replace("/api/access/packages/", "").replace("/regenerate-code", "");
      var isRegen = pathname.endsWith("/regenerate-code");
      var isDelete = req.method === "DELETE";
      if(isRegen && req.method === "POST") return await handleRegenerateAccessCode(req, res, pkgId);
      if(isDelete) return await handleDeleteAccessPackage(req, res, pkgId);
      if(req.method === "PATCH") return await handleUpdateAccessPackage(req, res, pkgId);
    }
    if(req.method === "GET" && pathname === "/public/config"){
      return sendJson(res, 200, { chatModel:"deepseek-chat", webSearchConfigured:Boolean(TAVILY_API_KEY), providers:[] });
    }
    if(req.method === "GET" && pathname === "/api/search/status"){
      return sendJson(res, 200, { ok:true, configured:Boolean(TAVILY_API_KEY), provider:"tavily" });
    }
    if(req.method === "POST" && pathname === "/chat") return await handleChat(req, res);
    if(req.method === "POST" && pathname === "/models/list") return await handleModelsList(req, res);
    if(req.method === "POST" && pathname === "/file/parse") return await handleFileParse(req, res);
    if(req.method === "POST" && pathname === "/api/tts") return await handleTts(req, res);
    /* ── Memory API ── */
    if(pathname.startsWith("/api/memory")){
      const auth = await requireAuth(req, res);
      if(!auth) return;
      const uid = auth.user.id;
      if(req.method === "POST" && pathname === "/api/memory/ingest") return await handleMemoryIngest(req, res, uid);
      if(req.method === "POST" && pathname === "/api/memory/retrieve") return await handleMemoryRetrieve(req, res, uid);
      if(req.method === "GET" && pathname === "/api/memory/list") return await handleMemoryList(req, res, uid);
      if(req.method === "POST" && pathname === "/api/memory/migrate") return await handleMemoryMigrate(req, res, uid);
      // PATCH/DELETE with ID
      var memMatch = pathname.match(/^\/api\/memory\/(mem_[a-f0-9]+)$/);
      if(memMatch){
        if(req.method === "PATCH") return await handleMemoryPatch(req, res, uid, memMatch[1]);
        if(req.method === "DELETE") return await handleMemoryDelete(req, res, uid, memMatch[1]);
      }
      return sendJson(res, 404, {ok:false, error:"not_found"});
    }

    if(req.method === "POST" && pathname === "/memories/sync"){
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
    if(req.method === "GET" && pathname === "/memories/export"){
      const token = req.headers["x-admin-token"] || "";
      if(!token || token !== process.env.ADMIN_TOKEN){
        return sendJson(res, 403, { error:"auth_failed", message:"需要x-admin-token头" });
      }
      sendJson(res, 200, { ok:true, message:"服务端存储尚未启用，记忆保存在浏览器本地。后续版本将支持服务端持久化。", time:nowIso() });
      return;
    }
    if(pathname === "/health"){
      try{
        let authExists = false, accessExists = false, dataDirWritable = false;
        try{ await readFile(AUTH_FILE, "utf8"); authExists = true; }catch{}
        try{ await readFile(ACCESS_FILE, "utf8"); accessExists = true; }catch{}
        try{ await mkdir(DATA_DIR, { recursive:true }); const testFile = AUTH_FILE + ".healthcheck"; await writeFile(testFile, "test"); await import("node:fs/promises").then(fs=>fs.unlink(testFile)); dataDirWritable = true; }catch{}
        const store = await readAuthStore();
        const isRender = !!process.env.RENDER;
        const persistentWarning = isRender && (!process.env.DATA_DIR || process.env.DATA_DIR.indexOf('opt/render') === -1)
          ? 'WARNING: DATA_DIR may not be on persistent disk. Auth data may be lost on deploy.'
          : null;
        return sendJson(res, 200, {
          ok:true, time:nowIso(),
          users:store.users.length,
          sessions:store.sessions.length,
          dataDir:DATA_DIR,
          authFileExists:authExists,
          accessFileExists:accessExists,
          dataDirWritable:dataDirWritable,
          persistentWarning:persistentWarning
        });
      }catch(e){
        return sendJson(res, 200, { ok:true, time:nowIso(), error:e.message });
      }
    }
    return serveStatic(req, res);
  }catch(error){
    console.error(error);
    sendJson(res, 500, { error:"internal_server_error", message:error.message });
  }
});
server.listen(PORT, HOST, ()=>{
  const persistentWarning = !process.env.DATA_DIR ? 'WARNING: DATA_DIR not set. Auth data stored in local ./data/ and may be lost on Render restart/deploy. Set DATA_DIR to a persistent disk path.' : null;
  console.log(`稻田 Ai running at http://${HOST}:${PORT}`);
  console.log(`DATA_DIR: ${DATA_DIR}`);
  if(persistentWarning) console.warn(persistentWarning);
});
