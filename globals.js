'use strict';

/* ==============================================================
   globals.js — 全局基础设施
   从 app.js 提取，所有变量/函数在 app.js 之前加载
   ============================================================== */

var EMPTY_PROMPT = '​';

/* ── DOM / 工具简写（原 app.js try 块内 const） ── */
try {
  var $ = (sel, root) => (root || document).querySelector(sel);
  var uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
  var nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
} catch(e) {}

/* ── 认证状态 ── */
var AUTH_USER = null;
var AUTH_DATA = {};
var AUTH_SYNC_QUEUE = {};
var AUTH_SYNC_TIMER = null;

/* ── localStorage Key 常量 ── */
const KEYS = {
  chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323',
  oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
  v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322',
  modelParams:'daotian.modelParams.v1',
  accessPackages:'daotian.accessPackages.v1',
  accessClaims:'daotian.accessClaims.v1',
  personalization:'daotian.personalization.v1',
  memories:'daotian.memories.v1',
  memoryCandidates:'daotian.memoryCandidates.v1',
  autoExtract:'daotian.autoExtract.v1',
  memoryGlobal:'daotian.memoryGlobal.v1',
  tokenDisplay:'daotian.tokenDisplay.v2',
  autoScroll:'daotian.autoScroll.v1',
  themeMode:'daotian.themeMode.v1',
  fontSize:'daotian.fontSize.v1',
  voiceSettings:'daotian.voiceSettings.v1',
};

/* ── 语音数据 ── */
var EDGE_VOICES = [
  {id:'zh-CN-XiaoxiaoNeural',label:'小小',desc:'女声 · 普通话'},
  {id:'zh-CN-XiaoyiNeural',label:'晓伊',desc:'女声 · 普通话'},
  {id:'zh-CN-YunxiNeural',label:'云希',desc:'男声 · 普通话'},
  {id:'zh-CN-YunjianNeural',label:'云健',desc:'男声 · 普通话'},
  {id:'zh-CN-YunyangNeural',label:'云扬',desc:'男声 · 普通话'},
  {id:'zh-TW-HsiaoChenNeural',label:'台湾晓臻',desc:'女声 · 台湾普通话'},
  {id:'zh-TW-HsiaoYuNeural',label:'台湾晓雨',desc:'女声 · 台湾普通话'},
  {id:'zh-TW-YunJheNeural',label:'台湾云哲',desc:'男声 · 台湾普通话'}
];
var defaultVoiceSettings = {enabled:true,provider:'edge',edgeVoice:'zh-CN-XiaoxiaoNeural',edgeVoiceLabel:'小小',rate:'+25%',voiceSpeedVersion:2,fishAudioApiKey:'',fishAudioReferenceId:'',fishAudioVoiceName:''};

/* ── 模型默认参数 ── */
const defaultModelParams = { temperature:0.7, top_p:1, max_tokens:0, presence_penalty:0, frequency_penalty:0, stream:true, systemPrompt: EMPTY_PROMPT, memoryInjection:false };
const DEFAULT_SYSTEM_PROMPT = defaultModelParams.systemPrompt;

/* ── 滚动状态 ── */
var autoScrollManualUntil = 0;
var _scrollDetectInited = false;
var _thinkingObserver = null;
var _attachments = [];

/* ── 认证存储工具 ── */
function scopedStorageKey(key){
  return AUTH_USER && AUTH_USER.id ? ('daotian.user.' + AUTH_USER.id + '.' + key) : key;
}
function queueAuthDataSync(key, value){
  if(!AUTH_USER || !AUTH_USER.id) return;
  AUTH_DATA[key] = String(value);
  AUTH_SYNC_QUEUE[key] = String(value);
  clearTimeout(AUTH_SYNC_TIMER);
  AUTH_SYNC_TIMER = setTimeout(flushAuthDataSync, 120);
}
async function flushAuthDataSync(){
  if(!AUTH_USER || !AUTH_USER.id) return;
  var items = AUTH_SYNC_QUEUE;
  AUTH_SYNC_QUEUE = {};
  if(!Object.keys(items).length) return;
  try{
    await authFetch('/api/user/data', {method:'POST', body:JSON.stringify({items:items})});
  }catch(err){
    console.error('[auth data] sync failed:', err);
  }
}
function safeGet(key){ try{ if(AUTH_USER && Object.prototype.hasOwnProperty.call(AUTH_DATA, key)) return AUTH_DATA[key]; return localStorage.getItem(scopedStorageKey(key)); }catch(e){return null;} }
function readJSON(key, fallback){ try{ const v = safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function saveJSON(key, value){ try{ var str = JSON.stringify(value); localStorage.setItem(scopedStorageKey(key), str); queueAuthDataSync(key, str); }catch(e){} }
function setItem(key, value){ try{ var str = String(value); localStorage.setItem(scopedStorageKey(key), str); queueAuthDataSync(key, str); }catch(e){} }
function saveJSONStrict(key, value){ var str = JSON.stringify(value); localStorage.setItem(scopedStorageKey(key), str); queueAuthDataSync(key, str); }
function setItemStrict(key, value){ var str = String(value); localStorage.setItem(scopedStorageKey(key), str); queueAuthDataSync(key, str); }

/* ── 认证 fetch 封装 ── */
async function authFetch(path, options){
  options = options || {};
  var headers = Object.assign({'Content-Type':'application/json'}, options.headers || {});
  var res = await fetch(path, Object.assign({credentials:'same-origin'}, options, {headers:headers}));
  var text = await res.text();
  var data = {};
  try{ data = text ? JSON.parse(text) : {}; }catch(_e){ data = { message:text }; }
  if(!res.ok){
    var err = new Error(data.message || data.error || ('HTTP ' + res.status));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

/* ── Toast 提示 ── */
function toast(text){ const s=$('#status'); if(!s)return; s.textContent=text; s.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>s.classList.remove('show'),1800); }

/* ── 运行时状态（由 app.js 初始化） ── */
let settings, activeId, sidebarOpen, searchOn, sending, generatingChatId;
