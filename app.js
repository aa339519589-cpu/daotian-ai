(function(){
  'use strict';

  const APP_VERSION = 'V3.6.6 Core Restore';
  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
  const uid = () => 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);

  const KEYS = {
    chats:'daotian.chats.v366',
    active:'daotian.activeChat.v366',
    settings:'daotian.settings.v366',
    theme:'daotian.theme.v366'
  };

  const OLD_SETTING_KEYS = [
    'daotian.settings.v366','daotian.settings.v365','daotian.settings.v364','daotian.settings.v363',
    'daotian.settings.v353','daotian.settings.v352','daotian.settings.v350','daotian.settings.v342',
    'daotian.settings.v341','daotian.settings.v323','daotian.settings.v322','daotian.settings'
  ];
  const OLD_CHAT_KEYS = ['daotian.chats.v366','daotian.chats.v323','daotian.chats.v322','daotian.chats'];
  const OLD_ACTIVE_KEYS = ['daotian.activeChat.v366','daotian.activeChat.v323','daotian.activeChat.v322','daotian.activeChat'];

  const defaultProvider = () => ({
    id: uid(),
    type: 'openai',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    path: '/v1/chat/completions',
    models: [
      { id: uid(), name: 'deepseek-chat', label: 'DeepSeek Chat' },
      { id: uid(), name: 'deepseek-reasoner', label: 'DeepSeek Reasoner' }
    ]
  });

  const emptyPrompts = ['今天想聊什么','从哪一句开始','现在想说点什么','今天先聊哪件事','随便开个头也行','想到什么就发什么'];

  function safeGet(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
  function safeSet(key,val){ try{localStorage.setItem(key,val);}catch(e){} }
  function readJSON(key,fallback){ try{ const v=safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
  function saveJSON(key,val){ safeSet(key, JSON.stringify(val)); }
  function escapeHTML(s){ return String(s ?? '').replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }
  function nowTime(){ return new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}); }
  function beijingStamp(d=new Date()){
    const parts = new Intl.DateTimeFormat('zh-CN',{
      timeZone:'Asia/Shanghai', year:'numeric', month:'2-digit', day:'2-digit',
      hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false
    }).formatToParts(d).reduce((a,p)=>{a[p.type]=p.value; return a;},{});
    return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second} 北京时间`;
  }

  function normalizeModel(m){
    if(typeof m === 'string') return {id:uid(), name:m.trim(), label:m.trim()};
    if(!m || typeof m !== 'object') return null;
    const name = String(m.name || m.model || m.id || '').trim();
    if(!name) return null;
    return {id:String(m.id || uid()), name, label:String(m.label || m.displayName || name).trim() || name};
  }
  function normalizeProvider(p){
    if(!p || typeof p !== 'object') return null;
    const modelsRaw = Array.isArray(p.models) ? p.models : (p.model ? [p.model] : []);
    const models = modelsRaw.map(normalizeModel).filter(Boolean);
    const name = String(p.name || p.providerName || 'Provider').trim() || 'Provider';
    return {
      id: String(p.id || uid()),
      type: String(p.type || p.providerType || 'openai'),
      name,
      baseUrl: String(p.baseUrl || '').trim(),
      apiKey: String(p.apiKey || '').trim(),
      path: String(p.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
      models: models.length ? models : [{id:uid(), name:String(p.model || 'deepseek-chat'), label:String(p.model || 'deepseek-chat')}]
    };
  }
  function loadSettings(){
    for(const key of OLD_SETTING_KEYS){
      const raw = readJSON(key, null);
      if(!raw) continue;
      let providers = [];
      if(Array.isArray(raw.providers)) providers = raw.providers.map(normalizeProvider).filter(Boolean);
      else if(raw.baseUrl || raw.model || raw.providerName) providers = [normalizeProvider(raw)].filter(Boolean);
      if(providers.length){
        const activeProviderId = raw.activeProviderId && providers.some(p=>p.id===raw.activeProviderId) ? raw.activeProviderId : providers[0].id;
        const activeP = providers.find(p=>p.id===activeProviderId) || providers[0];
        const activeModel = raw.activeModel || raw.model || activeP.models[0].name;
        return {providers, activeProviderId, activeModel};
      }
    }
    const p = defaultProvider();
    return {providers:[p], activeProviderId:p.id, activeModel:p.models[0].name};
  }
  function normalizeMessage(m){
    if(!m || typeof m !== 'object') return null;
    const role = ['user','assistant','system','error'].includes(m.role) ? m.role : 'user';
    const content = typeof m.content === 'string' ? m.content : String(m.content || '');
    return {
      id: String(m.id || uid()),
      role, content,
      createdAt: Number(m.createdAt) || Date.now(),
      provider: m.provider || '',
      model: m.model || '',
      thinking: !!m.thinking,
      streaming: !!m.streaming
    };
  }
  function normalizeChat(c,i){
    if(!c || typeof c !== 'object') return null;
    const messages = Array.isArray(c.messages) ? c.messages.map(normalizeMessage).filter(Boolean) : [];
    let title = String(c.title || '').trim();
    if(!title && messages[0]) title = messages[0].content.slice(0,28);
    if(!title) title = '新对话';
    return {id:String(c.id || uid()+'_'+i), title, createdAt:Number(c.createdAt)||Date.now(), updatedAt:Number(c.updatedAt)||Date.now(), messages};
  }
  function loadChats(){
    for(const key of OLD_CHAT_KEYS){
      const raw = readJSON(key, null);
      if(Array.isArray(raw)){
        const clean = raw.map(normalizeChat).filter(Boolean);
        if(clean.length) return clean;
      }
    }
    const id=uid();
    return [{id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}];
  }

  let theme = safeGet(KEYS.theme) || safeGet('daotian.theme.v323') || 'dark';
  let settings = loadSettings();
  let chats = loadChats();
  let activeId = OLD_ACTIVE_KEYS.map(safeGet).find(Boolean) || chats[0].id;
  let sidebarOpen = window.innerWidth > 760;
  let searchOn = false;
  let sending = false;
  let modelMenuOpen = false;
  let providerDraft = [];

  if(!chats.some(c=>c.id===activeId)) activeId = chats[0].id;

  function activeChat(){ return chats.find(c=>c.id===activeId) || chats[0]; }
  function activeProvider(){ return settings.providers.find(p=>p.id===settings.activeProviderId) || settings.providers[0] || defaultProvider(); }
  function activeModelObj(){
    const p = activeProvider();
    return p.models.find(m=>m.name===settings.activeModel) || p.models[0] || {name:'',label:'模型'};
  }
  function persist(){
    saveJSON(KEYS.chats, chats);
    safeSet(KEYS.active, activeId);
    saveJSON(KEYS.settings, settings);
    safeSet(KEYS.theme, theme);
  }

  function injectStyles(){
    if($('#daotian-core-style')) return;
    const style = document.createElement('style');
    style.id = 'daotian-core-style';
    style.textContent = `
:root{--app-height:100dvh;--keyboard-inset:0px;--safe-bottom:env(safe-area-inset-bottom,0px);--bg:#111314;--panel:#171a1d;--panel2:#1d2024;--text:#e8e2d7;--muted:#9b968d;--line:rgba(255,255,255,.08);--accent:#a77a57;--user:#2b211c;}
html[data-theme="light"]{--bg:#f4f1ea;--panel:#fbf8f1;--panel2:#fffaf2;--text:#2d2a25;--muted:#827a70;--line:rgba(30,20,10,.1);--user:#efe3d3;}
*{box-sizing:border-box} html,body,#app{margin:0;width:100%;min-height:100%;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif;} body{overflow:hidden}
button,input,textarea,select{font:inherit;color:inherit} button{cursor:pointer}
.app-shell{height:100dvh;background:radial-gradient(circle at 75% 20%,rgba(167,122,87,.12),transparent 34%),var(--bg);display:flex;overflow:hidden}
.sidebar{width:292px;flex:0 0 292px;border-right:1px solid var(--line);background:rgba(18,20,22,.82);backdrop-filter:blur(16px);display:flex;flex-direction:column;transition:.22s ease}
html[data-theme="light"] .sidebar{background:rgba(250,247,240,.82)}
.sidebar.closed{margin-left:-292px}
.sidebar-top{height:62px;display:flex;align-items:center;gap:12px;padding:0 18px;border-bottom:1px solid var(--line)}
.brand{font-weight:700;letter-spacing:.06em}
.icon-btn{width:38px;height:38px;border:1px solid var(--line);border-radius:14px;background:rgba(255,255,255,.04);display:grid;place-items:center}
.new-chat-btn,.side-bottom-btn{margin:16px;border:1px solid var(--line);background:transparent;border-radius:14px;height:44px;padding:0 14px;text-align:left}
.chat-list{flex:1;overflow:auto;padding:0 10px 10px}
.chat-item{height:48px;display:flex;align-items:center;gap:10px;padding:0 10px;border-radius:14px;color:var(--muted)}
.chat-item.active{background:rgba(255,255,255,.06);color:var(--text)}
.chat-dot{width:7px;height:7px;border-radius:50%;border:1px solid currentColor}
.chat-title{flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.chat-time{font-size:12px;color:var(--muted)}
.delete-chat{border:0;background:transparent;color:var(--muted);font-size:18px}
.sidebar-bottom{border-top:1px solid var(--line)}
.main{position:relative;flex:1;height:100dvh;overflow:hidden;display:flex;flex-direction:column}
.mobile-header{display:none}
.floating-menu{position:absolute;z-index:20;left:18px;top:18px;width:44px;height:44px;border-radius:18px;border:1px solid var(--line);background:rgba(255,255,255,.05);color:var(--text)}
.top-actions{position:absolute;right:18px;top:18px;z-index:20}
.messages{flex:1;min-height:0;overflow-y:auto;padding:82px min(9vw,120px) 170px;scroll-behavior:smooth;-webkit-overflow-scrolling:touch}
.empty{height:100%;display:grid;place-items:center}
.empty-center{transform:translateY(4vh);text-align:center;color:var(--muted)}
.empty-logo{width:62px;height:62px;color:var(--accent);opacity:.82}
.empty-prompt{font-size:15px;margin-top:6px}
.message{margin:22px 0;display:flex}
.message.user{justify-content:flex-end}
.message.assistant,.message.error{justify-content:flex-start}
.bubble{max-width:min(78%,760px);line-height:1.8;font-size:17px;white-space:pre-wrap;word-break:break-word}
.message.user .bubble{background:var(--user);border:1px solid var(--line);border-radius:22px;padding:14px 18px}
.message.assistant .bubble{background:transparent;border:0;padding:0;border-radius:0;max-width:min(88%,900px)}
.message.error .bubble{color:#ff8f8f;background:rgba(255,70,70,.08);border:1px solid rgba(255,70,70,.22);border-radius:16px;padding:12px 14px}
.thinking{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:15px}
.thinking-dot{width:8px;height:8px;border-radius:50%;background:var(--accent);animation:daotianPulse 1.15s ease-in-out infinite}
@keyframes daotianPulse{0%,100%{transform:scale(.8);opacity:.35}50%{transform:scale(1.2);opacity:1}}
.rendered p{margin:.4em 0 1em}.rendered pre{overflow:auto;background:rgba(255,255,255,.06);border:1px solid var(--line);padding:12px;border-radius:14px}.rendered code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.rendered hr.daotian-hr{border:0;border-top:1px solid var(--line);margin:22px 0;height:0}.rendered .math-display{overflow-x:auto;overflow-y:hidden}
.composer-wrap{position:absolute;left:50%;bottom:24px;transform:translateX(-50%);width:min(900px,calc(100% - 48px));z-index:30}
.composer-tools{display:flex;gap:10px;margin-bottom:10px;position:relative}
.pill{height:38px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,.04);padding:0 16px;color:var(--muted)}
.pill.active{color:var(--text);border-color:rgba(167,122,87,.55);background:rgba(167,122,87,.14)}
.model-pill{max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.model-menu{position:absolute;left:120px;bottom:48px;width:min(360px,calc(100vw - 44px));background:var(--panel);border:1px solid var(--line);border-radius:18px;padding:8px;box-shadow:0 22px 70px rgba(0,0,0,.28);display:none;z-index:60}
.model-menu.show{display:block}
.model-option{width:100%;border:0;background:transparent;padding:11px 12px;border-radius:12px;text-align:left;color:var(--text);display:flex;flex-direction:column;gap:2px}
.model-option:hover,.model-option.active{background:rgba(255,255,255,.07)}
.model-option small{color:var(--muted);font-size:12px}
.composer{min-height:74px;border:1px solid var(--line);border-radius:24px;background:rgba(28,31,35,.9);display:flex;align-items:center;padding:12px 14px 12px 20px;box-shadow:0 18px 60px rgba(0,0,0,.16)}
html[data-theme="light"] .composer{background:rgba(255,255,255,.78)}
textarea{flex:1;min-height:42px;max-height:160px;background:transparent;border:0;outline:0;resize:none;font-size:16px;line-height:1.55;color:var(--text)}
.send{width:56px;height:56px;border-radius:50%;border:0;background:var(--accent);color:#fff;font-size:32px;line-height:1}
.send:disabled{opacity:.55}
.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);display:none;place-items:center;z-index:100;padding:18px}
.modal-backdrop.show{display:grid}
.modal{width:min(860px,100%);max-height:min(86dvh,760px);background:var(--panel);border:1px solid var(--line);border-radius:24px;overflow:hidden;display:flex;flex-direction:column}
.modal-head{height:58px;border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-weight:700}
.modal-body{padding:16px;overflow:auto}
.modal-foot{border-top:1px solid var(--line);padding:12px 16px;display:flex;gap:10px;justify-content:flex-end}
.btn{height:40px;border-radius:14px;border:1px solid var(--line);background:transparent;padding:0 16px}.btn.primary{background:var(--accent);color:#fff;border-color:transparent}
.provider-card{border:1px solid var(--line);border-radius:18px;padding:14px;margin-bottom:14px;background:rgba(255,255,255,.03)}
.provider-card-head{display:flex;justify-content:space-between;gap:10px;margin-bottom:12px;font-weight:700}
.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.field label{font-size:13px;color:var(--muted)}
.field input,.field select,.field textarea{width:100%;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.04);padding:10px 12px;outline:none}.field textarea{min-height:98px}
.hint{font-size:12px;color:var(--muted);line-height:1.7}.danger{color:#ff9b9b}.status{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(30px);opacity:0;transition:.2s;z-index:200;background:var(--panel);border:1px solid var(--line);border-radius:999px;padding:10px 14px}.status.show{opacity:1;transform:translateX(-50%) translateY(0)}
@media (max-width:760px){
  body{position:fixed;inset:0;overflow:hidden;width:100%}
  .app-shell{position:fixed;inset:0;width:100%;height:100dvh;overflow:hidden}
  .main{height:100dvh;width:100%;padding-top:46px}
  .mobile-header{display:flex;position:absolute;left:0;right:0;top:0;height:46px;z-index:50;align-items:center;justify-content:space-between;padding:0 12px;border-bottom:1px solid var(--line);background:rgba(17,19,20,.82);backdrop-filter:blur(16px)}
  html[data-theme="light"] .mobile-header{background:rgba(244,241,234,.86)}
  .mobile-title{font-size:14px;font-weight:700;letter-spacing:.04em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:56vw}
  .mobile-header .icon-btn{width:34px;height:34px;border-radius:13px}
  .top-actions,.floating-menu{display:none!important}
  .sidebar{position:fixed;z-index:80;top:0;bottom:0;left:0;width:min(82vw,320px);flex-basis:auto;margin-left:0;transform:translateX(-105%);box-shadow:20px 0 60px rgba(0,0,0,.35)}
  .sidebar:not(.closed){transform:translateX(0)}
  .sidebar.closed{margin-left:0}
  .messages{padding:54px 24px calc(170px + var(--keyboard-inset,0px));height:calc(100dvh - 46px);flex:1}
  .empty-center{transform:translateY(-3vh)}
  .empty-logo{width:54px;height:54px}
  .message{margin:20px 0}
  .bubble{font-size:17px;line-height:1.78;max-width:100%}
  .message.user .bubble{max-width:78%;padding:13px 16px;border-radius:20px}
  .composer-wrap{position:fixed;left:0;right:0;bottom:calc(var(--keyboard-inset,0px) + 12px);transform:none;width:auto;padding:0 14px;z-index:70}
  .composer-tools{gap:8px;margin-bottom:9px}
  .pill{height:34px;padding:0 12px;font-size:14px}
  .model-pill{max-width:42vw}
  .model-menu{left:14px;bottom:46px;width:calc(100vw - 28px);max-height:48vh;overflow:auto}
  .composer{min-height:70px;border-radius:22px;padding:10px 10px 10px 16px}
  textarea{font-size:16px;min-height:42px}
  .send{width:54px;height:54px}
  .modal-backdrop{align-items:end;padding:0}
  .modal{width:100%;max-height:88dvh;border-radius:22px 22px 0 0}
  .row{grid-template-columns:1fr}
}
    `;
    document.head.appendChild(style);
  }

  function emergency(message){
    const app = $('#app');
    if(!app) return;
    app.innerHTML = `<div style="min-height:100dvh;display:grid;place-items:center;background:#111314;color:#e8e2d7;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC',sans-serif;padding:24px">
      <div style="max-width:560px;width:100%;background:#171a1d;border:1px solid rgba(255,255,255,.12);border-radius:22px;padding:22px">
      <h2 style="margin:0 0 10px">稻田 Ai 救援模式</h2><p style="line-height:1.7;color:#aaa;margin:0 0 16px">页面没有丢，脚本错误已拦截。</p>
      <pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);border-radius:14px;padding:12px;font-size:12px;max-height:180px;overflow:auto">${escapeHTML(message)}</pre>
      <button id="resetDaotian" style="height:42px;border:0;border-radius:14px;background:#a77a57;color:white;padding:0 16px">清理本地缓存并恢复</button>
      </div></div>`;
    const btn = $('#resetDaotian');
    if(btn) btn.onclick = () => {
      try{ Object.keys(localStorage).forEach(k=>{ if(k.indexOf('daotian')===0) localStorage.removeItem(k); }); }catch(e){}
      location.reload();
    };
  }
  window.addEventListener('error', e => emergency(e.message || e.error || 'script error'));
  window.addEventListener('unhandledrejection', e => emergency((e.reason && e.reason.message) || e.reason || 'promise error'));

  function markdownLite(text){
    let s = escapeHTML(text || '');
    const blocks = [];
    const stash = html => {
      const i = blocks.length;
      blocks.push(html);
      return `\n@@BLOCK${i}@@\n`;
    };

    // 代码块先保护，避免里面的 --- / $ 被当成 Markdown 或数学处理
    s = s.replace(/```(\w+)?\n([\s\S]*?)```/g, (_,lang,code)=>stash(`<pre><code>${code}</code></pre>`));

    // 独立一行的 3 个及以上 - / * / _ 渲染成真正等宽横线；两个短杠不处理
    s = s.replace(/^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/gm, () => stash('<hr class="daotian-hr">'));

    // 数学块保护，交给 MathJax 渲染
    s = s.replace(/\$\$([\s\S]*?)\$\$/g, (_,math)=>stash(`<div class="math-display">$$${math}$$</div>`));
    s = s.replace(/\\\[([\s\S]*?)\\\]/g, (_,math)=>stash(`<div class="math-display">\\[${math}\\]</div>`));
    s = s.replace(/\\\((.*?)\\\)/g, (_,math)=>stash(`\\(${math}\\)`));

    s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
    s = s.replace(/`([^`]+)`/g,'<code>$1</code>');

    s = s.split(/\n{2,}/).map(p=>{
      const t = p.trim();
      if(!t) return '';
      if(/^@@BLOCK\d+@@$/.test(t)) return t;
      return `<p>${p.replace(/\n/g,'<br>')}</p>`;
    }).join('');
    s = s.replace(/@@BLOCK(\d+)@@/g, (_,i)=>blocks[Number(i)] || '');
    return `<div class="rendered">${s}</div>`;
  }
  function runMath(){
    if(window.MathJax && window.MathJax.typesetPromise){
      window.MathJax.typesetClear && window.MathJax.typesetClear();
      window.MathJax.typesetPromise().catch(()=>{});
    }
  }

  function renderSidebar(){
    const side = $('#sidebar');
    if(!side) return;
    side.classList.toggle('closed', !sidebarOpen);
    const list = $('#chatList');
    if(list){
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}">
        <span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span><button class="delete-chat" data-del="${escapeHTML(c.id)}">×</button>
      </div>`).join('');
    }
  }
  function renderMobileTitle(){
    const el = $('#mobileTitle');
    if(!el) return;
    const p = activeProvider();
    const m = activeModelObj();
    el.textContent = `${p.name} · ${m.label || m.name || '模型'}`;
  }
  function pickEmptyPrompt(){
    const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate();
    return emptyPrompts[seed % emptyPrompts.length];
  }
  function renderMessages(){
    const c = activeChat();
    const box = $('#messages');
    if(!box || !c) return;
    const msgs = c.messages || [];
    if(!msgs.length){
      box.innerHTML = `<div class="empty"><div class="empty-center"><svg class="empty-logo" viewBox="0 0 120 120" aria-hidden="true"><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
      return;
    }
    box.innerHTML = msgs.map(m=>{
      if(m.thinking && !m.content) return `<div class="message assistant"><div class="bubble"><div class="thinking"><span class="thinking-dot"></span><span>想一下</span></div></div></div>`;
      const cls = m.role==='user' ? 'user' : (m.role==='error' ? 'error' : 'assistant');
      const body = (m.role==='assistant' && !m.streaming) ? markdownLite(m.content) : escapeHTML(m.content);
      return `<div class="message ${cls}"><div class="bubble">${body}</div></div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
    runMath();
  }
  function renderModelMenu(){
    const menu = $('#modelMenu');
    const btn = $('#modelBtn');
    if(!menu || !btn) return;
    const p = activeProvider();
    const m = activeModelObj();
    btn.textContent = `${p.name} ${m.label || m.name} ▾`;
    menu.classList.toggle('show', modelMenuOpen);
    menu.innerHTML = settings.providers.map(provider =>
      provider.models.map(model => {
        const active = provider.id===settings.activeProviderId && model.name===settings.activeModel;
        return `<button class="model-option ${active?'active':''}" data-pid="${escapeHTML(provider.id)}" data-model="${escapeHTML(model.name)}">
          <span>${escapeHTML(model.label || model.name)}</span><small>${escapeHTML(provider.name)} / ${escapeHTML(model.name)}</small>
        </button>`;
      }).join('')
    ).join('');
  }
  function renderAll(){
    document.documentElement.setAttribute('data-theme', theme);
    const shell = $('.app-shell');
    if(shell) shell.setAttribute('data-theme', theme);
    const themeBtn = $('#themeBtn');
    if(themeBtn) themeBtn.textContent = theme === 'dark' ? '☾' : '☀';
    const mobileTheme = $('#mobileThemeBtn');
    if(mobileTheme) mobileTheme.textContent = theme === 'dark' ? '☾' : '☀';
    renderSidebar();
    renderMessages();
    renderModelMenu();
    renderMobileTitle();
    persist();
  }

  function createChat(){
    const id=uid();
    chats.unshift({id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]});
    activeId=id;
    sidebarOpen = window.innerWidth > 760;
    renderAll();
  }
  function deleteChat(id){
    const idx = chats.findIndex(c=>c.id===id);
    if(idx<0) return;
    chats.splice(idx,1);
    if(!chats.length){
      const nid=uid();
      chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}];
      activeId=nid;
    }else if(activeId===id){
      activeId = chats[Math.max(0, Math.min(idx, chats.length-1))].id;
    }
    renderAll();
    toast('已删除');
  }
  function toast(text){
    const s=$('#status');
    if(!s) return;
    s.textContent=text;
    s.classList.add('show');
    clearTimeout(toast.t);
    toast.t=setTimeout(()=>s.classList.remove('show'),1600);
  }

  function buildOpenAIURL(provider){
    const base = String(provider.baseUrl || '').replace(/\/$/,'');
    const path = provider.path || '/v1/chat/completions';
    if(!base) return '/v1/chat/completions';
    if(base.endsWith('/v1') && path.startsWith('/v1/')) return base + path.slice(3);
    return base + (path.startsWith('/') ? path : '/' + path);
  }
  function extractDelta(data){
    const choice = data && data.choices && data.choices[0];
    if(choice && choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
    if(choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
    if(data && Array.isArray(data.content)) return data.content.map(part=>part && part.text ? part.text : '').join('');
    return '';
  }
  function extractFullContent(data){
    return data?.choices?.[0]?.message?.content ||
      data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ||
      data?.content?.[0]?.text || '';
  }
  async function readSSE(res,onDelta){
    if(!res.body){
      const txt=await res.text();
      try{ return extractFullContent(JSON.parse(txt)) || txt; }catch(e){ return txt; }
    }
    const reader=res.body.getReader();
    const decoder=new TextDecoder();
    let buffer='', full='', raw='';
    function consumeLine(line){
      const trimmed=line.trim();
      if(!trimmed || !trimmed.startsWith('data:')) return false;
      const payload=trimmed.replace(/^data:\s*/,'');
      if(payload==='[DONE]') return true;
      try{
        const data=JSON.parse(payload);
        const delta = data.delta || extractDelta(data);
        if(delta){ full += delta; onDelta(delta, full); }
      }catch(e){}
      return false;
    }
    while(true){
      const r=await reader.read();
      if(r.done) break;
      const chunk=decoder.decode(r.value,{stream:true});
      raw += chunk; buffer += chunk;
      let index;
      while((index=buffer.indexOf('\n'))>=0){
        const line=buffer.slice(0,index);
        buffer=buffer.slice(index+1);
        if(consumeLine(line)) return full;
      }
    }
    buffer += decoder.decode();
    if(buffer.trim()) consumeLine(buffer);
    if(full) return full;
    try{ return extractFullContent(JSON.parse(raw)) || raw; }catch(e){ return raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(); }
  }
  async function callModel(messages,onDelta){
    const provider = activeProvider();
    const modelObj = activeModelObj();
    if((provider.type || 'openai') !== 'openai') throw new Error('当前版本主要支持 OpenAI 兼容接口。Gemini / Anthropic 需要后端适配。');
    const payload = {
      provider: {type:provider.type,name:provider.name,baseUrl:provider.baseUrl,apiKey:provider.apiKey,path:provider.path},
      model: modelObj.name,
      messages,
      stream: true,
      search: searchOn
    };

    try{
      const res = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok) return await readSSE(res,onDelta);
      const txt = await res.text();
      if(!/Cannot|not found|ENOENT|404/i.test(txt)) throw new Error(txt.slice(0,500) || ('HTTP '+res.status));
    }catch(err){
      if(searchOn) throw err;
    }

    const headers={'Content-Type':'application/json'};
    if(provider.apiKey) headers.Authorization='Bearer '+provider.apiKey;
    const body={model:modelObj.name,messages,stream:true};
    if(searchOn) body.web_search = true;
    const res=await fetch(buildOpenAIURL(provider),{method:'POST',headers,body:JSON.stringify(body)});
    if(!res.ok){ const txt=await res.text(); throw new Error(txt.slice(0,500)||('HTTP '+res.status)); }
    return await readSSE(res,onDelta);
  }
  function buildRequestMessages(chatMessages){
    return chatMessages.filter(m=>m.role==='user' || m.role==='assistant' || m.role==='system').map(m=>{
      let content = m.content;
      if(m.role==='user'){
        const stamp = m.createdAt ? beijingStamp(new Date(m.createdAt)) : beijingStamp();
        content = `[用户消息发送时间：${stamp}]\n${content}`;
      }
      return {role:m.role, content};
    });
  }
  async function sendMessage(){
    if(sending) return;
    const input=$('#input');
    const text=(input.value||'').trim();
    if(!text) return;
    const c=activeChat();
    const p=activeProvider();
    const mo=activeModelObj();
    const userMsg={id:uid(),role:'user',content:text,createdAt:Date.now()};
    c.messages.push(userMsg);
    if(!c.title || c.title==='新对话') c.title=text.slice(0,28);
    input.value='';
    sending=true;
    const sendBtn=$('#sendBtn');
    if(sendBtn) sendBtn.disabled=true;
    const assistant={id:uid(),role:'assistant',content:'',createdAt:Date.now(),provider:p.name,model:mo.name,thinking:true,streaming:true};
    c.messages.push(assistant);
    c.updatedAt=Date.now();
    renderAll();

    const requestMessages = buildRequestMessages(c.messages.filter(m=>m.id!==assistant.id));
    try{
      const finalText = await callModel(requestMessages, function(delta){
        assistant.thinking=false;
        assistant.content += delta;
        assistant.streaming=true;
        c.updatedAt=Date.now();
        renderMessages();
      });
      assistant.thinking=false;
      assistant.streaming=false;
      if(!assistant.content.trim()) assistant.content = finalText || '没有返回内容';
    }catch(err){
      const idx = c.messages.findIndex(m=>m.id===assistant.id);
      if(idx>=0) c.messages.splice(idx,1,{id:uid(),role:'error',content:'请求失败：'+(err&&err.message?err.message:String(err)),createdAt:Date.now()});
    }
    sending=false;
    if(sendBtn) sendBtn.disabled=false;
    c.updatedAt=Date.now();
    renderAll();
  }

  function settingsToDraft(){
    providerDraft = JSON.parse(JSON.stringify(settings.providers));
    if(!providerDraft.length) providerDraft = [defaultProvider()];
  }
  function providerCard(p,idx){
    const modelsText = (p.models||[]).map(m=>m.label && m.label!==m.name ? `${m.label} | ${m.name}` : m.name).join('\n');
    return `<div class="provider-card" data-provider-index="${idx}">
      <div class="provider-card-head"><span>提供方 ${idx+1} · ${escapeHTML(p.name||'未命名')}</span><button class="btn danger" data-remove-provider="${idx}">删除</button></div>
      <div class="row">
        <div class="field"><label>提供方类型</label><select data-field="type"><option value="openai" ${p.type==='openai'?'selected':''}>OpenAI 兼容</option><option value="gemini" ${p.type==='gemini'?'selected':''}>Gemini</option><option value="anthropic" ${p.type==='anthropic'?'selected':''}>Anthropic</option></select></div>
        <div class="field"><label>显示名称</label><input data-field="name" value="${escapeHTML(p.name||'')}" placeholder="DeepSeek / 小米 / OpenAI"></div>
      </div>
      <div class="field"><label>Base URL</label><input data-field="baseUrl" value="${escapeHTML(p.baseUrl||'')}" placeholder="https://api.deepseek.com"></div>
      <div class="field"><label>API Key</label><input data-field="apiKey" type="password" value="${escapeHTML(p.apiKey||'')}" placeholder="sk-..."></div>
      <div class="field"><label>请求路径</label><input data-field="path" value="${escapeHTML(p.path||'/v1/chat/completions')}" placeholder="/v1/chat/completions"></div>
      <div class="field"><label>模型列表（一行一个；可写：显示名 | 真实模型名）</label><textarea data-field="models" placeholder="DeepSeek Chat | deepseek-chat&#10;DeepSeek Reasoner | deepseek-reasoner">${escapeHTML(modelsText)}</textarea></div>
    </div>`;
  }
  function renderSettingsDraft(){
    const wrap = $('#providersWrap');
    if(!wrap) return;
    wrap.innerHTML = providerDraft.map(providerCard).join('');
  }
  function openSettings(){
    settingsToDraft();
    renderSettingsDraft();
    $('#providerModal').classList.add('show');
  }
  function closeSettings(){ $('#providerModal').classList.remove('show'); }
  function readProviderDraftFromDOM(){
    providerDraft = $$('.provider-card').map(card=>{
      const get = f => {
        const el = card.querySelector(`[data-field="${f}"]`);
        return el ? el.value.trim() : '';
      };
      const old = providerDraft[Number(card.dataset.providerIndex)] || {};
      const lines = get('models').split(/\n+/).map(s=>s.trim()).filter(Boolean);
      const models = lines.map(line=>{
        let label='', name=line;
        if(line.includes('|')){
          const parts=line.split('|');
          label=parts[0].trim();
          name=parts.slice(1).join('|').trim();
        }
        return name ? {id:uid(), name, label:label || name} : null;
      }).filter(Boolean);
      return {
        id: old.id || uid(),
        type: get('type') || 'openai',
        name: get('name') || 'Provider',
        baseUrl: get('baseUrl'),
        apiKey: get('apiKey'),
        path: get('path') || '/v1/chat/completions',
        models: models.length ? models : [{id:uid(), name:'deepseek-chat', label:'deepseek-chat'}]
      };
    });
  }
  function saveSettings(){
    readProviderDraftFromDOM();
    if(!providerDraft.length) providerDraft=[defaultProvider()];
    settings.providers = providerDraft;
    const activeStill = settings.providers.find(p=>p.id===settings.activeProviderId && p.models.some(m=>m.name===settings.activeModel));
    if(!activeStill){
      settings.activeProviderId=settings.providers[0].id;
      settings.activeModel=settings.providers[0].models[0].name;
    }
    closeSettings();
    renderAll();
    toast('已保存');
  }

  function setupMobileViewport(){
    const root=document.documentElement;
    const input=$('#input');
    const messagesBox=$('#messages');
    if(!input || !messagesBox) return;
    let timer=null;
    const isMobile=()=>window.matchMedia('(max-width:760px)').matches;
    function scrollLatest(){
      requestAnimationFrame(()=>{ try{messagesBox.scrollTop=messagesBox.scrollHeight;}catch(e){} });
      setTimeout(()=>{ try{messagesBox.scrollTop=messagesBox.scrollHeight;}catch(e){} },160);
      setTimeout(()=>{ try{messagesBox.scrollTop=messagesBox.scrollHeight;}catch(e){} },420);
    }
    function apply(){
      if(!isMobile()){
        root.style.removeProperty('--keyboard-inset');
        root.style.removeProperty('--app-height');
        document.body.classList.remove('keyboard-open');
        return;
      }
      const vv=window.visualViewport;
      const inset = vv ? Math.max(0, window.innerHeight - vv.height - vv.offsetTop) : 0;
      root.style.setProperty('--keyboard-inset', Math.round(inset)+'px');
      root.style.setProperty('--app-height', Math.round(vv && vv.height ? vv.height : window.innerHeight)+'px');
      const focused=document.activeElement===input;
      document.body.classList.toggle('keyboard-open', focused);
      if(focused){
        sidebarOpen=false;
        renderSidebar();
        scrollLatest();
      }
    }
    function schedule(delay=30){ clearTimeout(timer); timer=setTimeout(apply,delay); }
    input.addEventListener('focus',()=>{schedule(0); setTimeout(apply,120); setTimeout(apply,320); scrollLatest();});
    input.addEventListener('blur',()=>{setTimeout(()=>{schedule(0);},120);});
    input.addEventListener('input',()=>{schedule(10); scrollLatest();});
    window.addEventListener('resize',()=>schedule(20),{passive:true});
    window.addEventListener('orientationchange',()=>setTimeout(apply,260),{passive:true});
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize',()=>schedule(10),{passive:true});
      window.visualViewport.addEventListener('scroll',()=>schedule(10),{passive:true});
    }
    apply();
  }

  function init(){
    injectStyles();
    const app=$('#app');
    if(!app) throw new Error('#app not found');
    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar ${sidebarOpen?'':'closed'}" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide">☰</button><div class="brand">稻田 Ai</div></div>
          <button class="new-chat-btn" id="newChat">＋ 新对话</button>
          <div class="chat-list" id="chatList"></div>
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openProvider">设置 / 模型提供方</button></div>
        </aside>
        <main class="main">
          <div class="mobile-header"><button class="icon-btn" id="mobileMenuBtn">☰</button><div class="mobile-title" id="mobileTitle">稻田 Ai</div><button class="icon-btn" id="mobileThemeBtn">☾</button></div>
          <button class="floating-menu" id="openSide">☰</button>
          <div class="top-actions"><button class="icon-btn" id="themeBtn">☾</button></div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="composer-tools">
              <button class="pill" id="searchBtn">○ 联网搜索</button>
              <button class="pill model-pill" id="modelBtn">模型 ▾</button>
              <div class="model-menu" id="modelMenu"></div>
            </div>
            <div class="composer"><textarea id="input" placeholder="输入消息...（Enter 发送，Shift + Enter 换行）"></textarea><button class="send" id="sendBtn">›</button></div>
          </div>
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="hint" style="margin-bottom:12px">每个提供方是一个独立板块。一个提供方下面可以填多个模型，一行一个。</div>
          <div id="providersWrap"></div>
          <button class="btn" id="addProvider">＋ 新增提供方</button>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    document.addEventListener('click', e=>{
      const del=e.target.closest('[data-del]');
      if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item');
      if(item){ activeId=item.getAttribute('data-id'); if(window.innerWidth<=760) sidebarOpen=false; renderAll(); return; }
      const modelOpt=e.target.closest('.model-option');
      if(modelOpt){ settings.activeProviderId=modelOpt.dataset.pid; settings.activeModel=modelOpt.dataset.model; modelMenuOpen=false; renderAll(); return; }
      if(!e.target.closest('#modelMenu') && !e.target.closest('#modelBtn')){ modelMenuOpen=false; renderModelMenu(); }
      const remove=e.target.closest('[data-remove-provider]');
      if(remove){ readProviderDraftFromDOM(); providerDraft.splice(Number(remove.dataset.removeProvider),1); if(!providerDraft.length) providerDraft=[defaultProvider()]; renderSettingsDraft(); }
    });

    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();};
    $('#openSide').onclick=()=>{sidebarOpen=true;renderAll();};
    $('#mobileMenuBtn').onclick=()=>{sidebarOpen=!sidebarOpen;renderAll();};
    $('#newChat').onclick=createChat;
    $('#themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#mobileThemeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#openProvider').onclick=openSettings;
    $('#closeProvider').onclick=closeSettings;
    $('#cancelProvider').onclick=closeSettings;
    $('#saveProvider').onclick=saveSettings;
    $('#addProvider').onclick=()=>{readProviderDraftFromDOM(); providerDraft.push(defaultProvider()); renderSettingsDraft();};
    $('#searchBtn').onclick=()=>{searchOn=!searchOn; const b=$('#searchBtn'); b.classList.toggle('active',searchOn); b.textContent=searchOn?'● 联网搜索':'○ 联网搜索';};
    $('#modelBtn').onclick=()=>{modelMenuOpen=!modelMenuOpen; renderModelMenu();};
    $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });

    renderAll();
    setupMobileViewport();
  }

  try{ init(); }catch(err){ emergency(err && err.stack ? err.stack : err); }
})();