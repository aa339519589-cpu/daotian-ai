(function(){
  'use strict';

  const VERSION = 'V3.5.7 Sidebar + Multi Provider Hotfix';

  function emergency(message){
    var app = document.getElementById('app');
    if(!app) return;
    app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f5f2ea;color:#2a2824;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;padding:24px">' +
      '<div style="max-width:520px;width:100%;background:#fff;border:1px solid rgba(90,78,62,.18);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(70,55,35,.12)">' +
      '<h2 style="margin:0 0 10px;font-size:22px">稻田 Ai 已进入救援模式</h2>' +
      '<p style="line-height:1.7;color:#827a70;margin:0 0 16px">页面没有丢。只是旧缓存数据可能损坏，已拦截白屏。</p>' +
      '<pre style="white-space:pre-wrap;background:#f7f3ec;border-radius:14px;padding:12px;font-size:12px;color:#655b52;max-height:160px;overflow:auto">' + String(message||'unknown').replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]);}) + '</pre>' +
      '<button id="resetDaotian" style="height:42px;border:0;border-radius:14px;background:#a77a57;color:white;padding:0 16px;font:inherit;cursor:pointer">清理本地聊天缓存并恢复</button>' +
      '</div></div>';
    var btn = document.getElementById('resetDaotian');
    if(btn) btn.onclick = function(){
      try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf('daotian')===0) localStorage.removeItem(k); }); }catch(e){}
      location.reload();
    };
  }

  window.addEventListener('error', function(e){ emergency(e.message || e.error || 'script error'); });
  window.addEventListener('unhandledrejection', function(e){ emergency((e.reason && e.reason.message) || e.reason || 'promise error'); });

  try{
    const $ = (sel, root=document) => root.querySelector(sel);
    const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
    const uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

    const KEYS = {
      chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323', memory:'daotian.memory.v354',
      oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
      v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322'
    };

    const defaultSettings = {
      providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions',
      providers:null, activeProviderId:'default',
      temperature:0.7, topP:1, contextMode:'recent', contextLimit:24,
      systemPrompt:'', personalityPrompt:'', autoMemory:true, memoryInPrompt:true, markdownRender:true, mathRender:true
    };

    const emptyPrompts = ['今天想聊什么','从哪一句开始','现在想说点什么','今天先聊哪件事','随便开个头也行','想到什么就发什么'];

    function injectStyle(){
      if(document.getElementById('daotian-v354-style')) return;
      const st = document.createElement('style');
      st.id = 'daotian-v354-style';
      st.textContent = `
:root{--app-height:100dvh;--dt-bg:#f6f1e8;--dt-panel:#fffaf3;--dt-text:#25221f;--dt-muted:#81786d;--dt-border:rgba(86,74,60,.16);--dt-soft:rgba(116,92,68,.09);--dt-accent:#a77a57;--dt-user:#2f2d2a;--dt-user-text:#fff;}
html[data-theme="dark"],.app-shell[data-theme="dark"]{--dt-bg:#111315;--dt-panel:#181b1e;--dt-text:#e8e4dc;--dt-muted:#9a968f;--dt-border:rgba(255,255,255,.10);--dt-soft:rgba(255,255,255,.055);--dt-accent:#b58a66;--dt-user:#e7e1d8;--dt-user-text:#141414;}
*{box-sizing:border-box} body{margin:0;background:var(--dt-bg);color:var(--dt-text);font-family:-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",Arial,sans-serif;}
.app-shell{height:var(--app-height);min-height:100dvh;display:grid;grid-template-columns:292px minmax(0,1fr);background:var(--dt-bg);color:var(--dt-text);overflow:hidden;transition:grid-template-columns .22s ease;}.app-shell.sidebar-collapsed{grid-template-columns:0 minmax(0,1fr);}
.sidebar{width:292px;border-right:1px solid var(--dt-border);background:color-mix(in srgb,var(--dt-panel) 92%,transparent);display:flex;flex-direction:column;min-width:0;transition:transform .22s ease, opacity .18s ease;}
.sidebar.closed{transform:translateX(-100%);margin-left:0;opacity:0;pointer-events:none}.sidebar-top{height:58px;display:flex;align-items:center;gap:10px;padding:0 14px}.brand{font-weight:700;letter-spacing:.2px}.icon-btn{width:34px;height:34px;border:1px solid var(--dt-border);border-radius:12px;background:var(--dt-soft);color:var(--dt-text);cursor:pointer}.new-chat-btn{margin:6px 14px 10px;height:40px;border:1px solid var(--dt-border);border-radius:14px;background:var(--dt-soft);color:var(--dt-text);font:inherit;cursor:pointer}.chat-list{flex:1;overflow:auto;padding:0 10px 10px}.chat-item{height:42px;border-radius:13px;display:flex;align-items:center;gap:8px;padding:0 8px;color:var(--dt-muted);cursor:pointer}.chat-item.active,.chat-item:hover{background:var(--dt-soft);color:var(--dt-text)}.chat-dot{width:6px;height:6px;border-radius:999px;background:var(--dt-accent);flex:0 0 auto}.chat-title{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px}.chat-time{font-size:11px;color:var(--dt-muted)}.delete-chat{border:0;background:transparent;color:var(--dt-muted);font-size:18px;cursor:pointer}.sidebar-bottom{padding:10px;border-top:1px solid var(--dt-border);display:grid;grid-template-columns:1fr 1fr;gap:8px}.side-bottom-btn{height:38px;border:1px solid var(--dt-border);border-radius:14px;background:var(--dt-soft);color:var(--dt-text);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap}.main{position:relative;min-width:0;display:flex;flex-direction:column;height:var(--app-height);overflow:hidden}.floating-menu{position:absolute;left:14px;top:14px;z-index:20;width:38px;height:38px;border:1px solid var(--dt-border);border-radius:14px;background:var(--dt-panel);color:var(--dt-text);display:none;place-items:center;cursor:pointer}.top-actions{position:absolute;right:14px;top:14px;z-index:20}.messages{flex:1;overflow:auto;padding:72px max(22px,calc((100vw - 980px)/2)) 180px;scroll-behavior:smooth}.empty{height:100%;display:grid;place-items:center;color:var(--dt-muted)}.empty-center{text-align:center}.empty-logo{width:76px;height:76px;margin-bottom:16px;color:var(--dt-muted);opacity:.55}.empty-prompt{font-size:17px}.message{display:flex;margin:10px 0}.message.user{justify-content:flex-end}.message.assistant{justify-content:flex-start}.bubble{max-width:min(760px,92%);font-size:15.5px;line-height:1.62;overflow-wrap:anywhere}.user .bubble{background:var(--dt-user);color:var(--dt-user-text);padding:10px 14px;border-radius:18px 18px 4px 18px}.assistant .bubble{background:transparent;color:var(--dt-text);border:0;padding:0;border-radius:0}.assistant-content{line-height:1.62}.assistant-content>*:first-child{margin-top:0!important}.assistant-content>*:last-child{margin-bottom:0!important}.assistant-content p{margin:.42em 0}.assistant-content h1,.assistant-content h2,.assistant-content h3,.assistant-content h4{line-height:1.35;margin:.85em 0 .35em;font-weight:750}.assistant-content h1{font-size:1.35em}.assistant-content h2{font-size:1.24em}.assistant-content h3{font-size:1.12em}.assistant-content h4{font-size:1.04em}.assistant-content ul,.assistant-content ol{margin:.35em 0 .5em 1.35em;padding:0}.assistant-content li{margin:.18em 0}.assistant-content blockquote{margin:.55em 0;padding:.1em .9em;border-left:3px solid var(--dt-border);color:var(--dt-muted)}.assistant-content code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--dt-soft);border:1px solid var(--dt-border);border-radius:6px;padding:.08em .35em;font-size:.92em}.assistant-content pre{margin:.65em 0;padding:12px;border-radius:14px;background:var(--dt-soft);border:1px solid var(--dt-border);overflow:auto}.assistant-content pre code{background:transparent;border:0;padding:0}.assistant-content table{border-collapse:collapse;display:block;overflow:auto;max-width:100%;margin:.65em 0}.assistant-content th,.assistant-content td{border:1px solid var(--dt-border);padding:6px 9px}.assistant-content .math,.assistant-content mjx-container{max-width:100%;overflow-x:auto;overflow-y:hidden}.composer-wrap{position:absolute;left:0;right:0;bottom:0;z-index:30;padding:12px max(18px,calc((100vw - 860px)/2)) calc(14px + env(safe-area-inset-bottom));background:linear-gradient(to top,var(--dt-bg) 72%,transparent)}.quick-row{margin:0 0 8px 2px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}.search-toggle{margin:0}.pill{height:34px;border:1px solid var(--dt-border);border-radius:999px;background:var(--dt-panel);color:var(--dt-muted);padding:0 13px;font:inherit;font-size:13px;cursor:pointer}.pill.active{color:var(--dt-text);border-color:color-mix(in srgb,var(--dt-accent) 55%,var(--dt-border));background:color-mix(in srgb,var(--dt-accent) 15%,var(--dt-panel))}.model-select{max-width:220px;min-width:145px;appearance:none;padding-right:28px;background-image:linear-gradient(45deg,transparent 50%,var(--dt-muted) 50%),linear-gradient(135deg,var(--dt-muted) 50%,transparent 50%);background-position:calc(100% - 15px) 14px,calc(100% - 10px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}.composer{display:flex;gap:10px;align-items:flex-end;border:1px solid var(--dt-border);background:color-mix(in srgb,var(--dt-panel) 95%,transparent);border-radius:22px;padding:10px;box-shadow:0 18px 60px rgba(0,0,0,.10)}.composer textarea{flex:1;resize:none;min-height:34px;max-height:150px;border:0;outline:0;background:transparent;color:var(--dt-text);font:inherit;line-height:1.5;padding:6px 4px}.send{width:38px;height:38px;border:0;border-radius:14px;background:var(--dt-accent);color:white;font-size:28px;line-height:1;cursor:pointer}.send:disabled{opacity:.5}.modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.38);display:none;align-items:center;justify-content:center;z-index:80;padding:20px}.modal-backdrop.show{display:flex}.modal{width:min(720px,100%);max-height:min(760px,92dvh);overflow:hidden;display:flex;flex-direction:column;background:var(--dt-panel);color:var(--dt-text);border:1px solid var(--dt-border);border-radius:24px;box-shadow:0 24px 80px rgba(0,0,0,.30)}.modal-head{height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 16px;border-bottom:1px solid var(--dt-border);font-weight:750}.modal-body{padding:16px;overflow:auto}.modal-foot{height:60px;display:flex;align-items:center;justify-content:flex-end;gap:10px;padding:0 16px;border-top:1px solid var(--dt-border)}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}.field{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}.field label{font-size:13px;color:var(--dt-muted)}.field input,.field select,.field textarea{width:100%;border:1px solid var(--dt-border);border-radius:13px;background:var(--dt-soft);color:var(--dt-text);font:inherit;padding:10px 11px;outline:none}.field textarea{min-height:92px;resize:vertical;line-height:1.5}.hint{font-size:12px;color:var(--dt-muted);line-height:1.55}.btn{height:38px;border:1px solid var(--dt-border);border-radius:13px;background:var(--dt-soft);color:var(--dt-text);font:inherit;padding:0 14px;cursor:pointer}.btn.primary{background:var(--dt-accent);border-color:var(--dt-accent);color:white}.settings-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.provider-actions{display:flex;gap:8px;flex-wrap:wrap}.provider-actions .btn{height:38px;padding:0 10px}.memory-list{display:flex;flex-direction:column;gap:8px}.memory-item{display:grid;grid-template-columns:1fr auto;gap:8px;border:1px solid var(--dt-border);border-radius:14px;padding:9px;background:var(--dt-soft)}.memory-item textarea{width:100%;min-height:56px;border:0;background:transparent;color:var(--dt-text);font:inherit;resize:vertical;outline:0}.memory-actions{display:flex;flex-direction:column;gap:6px}.status{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(14px);opacity:0;z-index:99;background:var(--dt-text);color:var(--dt-bg);padding:9px 14px;border-radius:999px;transition:.18s ease;font-size:13px}.status.show{opacity:1;transform:translateX(-50%) translateY(0)}

.message.assistant .bubble{max-width:min(820px,94%)}.assistant-actions{display:flex;align-items:center;gap:6px;margin:.45em 0 0;color:var(--dt-muted);opacity:.75}.assistant-action{width:28px;height:28px;border:0;border-radius:10px;background:transparent;color:var(--dt-muted);cursor:pointer;font-size:14px}.assistant-action:hover{background:var(--dt-soft);color:var(--dt-text)}.assistant-content{font-size:15.5px;letter-spacing:.01em}.assistant-content .math{margin:.5em 0;padding:.2em 0;max-width:100%;overflow-x:auto}.assistant-content table{width:max-content;min-width:min(100%,520px);border-radius:12px;border:1px solid var(--dt-border);background:color-mix(in srgb,var(--dt-panel) 86%,transparent)}.assistant-content th{background:var(--dt-soft);font-weight:650}.assistant-content hr{border:0;border-top:1px solid var(--dt-border);margin:.85em 0}.assistant-content .loose-eq{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;background:var(--dt-soft);border:1px solid var(--dt-border);border-radius:8px;padding:.08em .45em;white-space:nowrap}.message.streaming .assistant-actions{display:none}.settings-grid .field input[type="range"]{padding:0;height:30px}.modal-body{overscroll-behavior:contain}.composer-wrap{pointer-events:none}.composer-wrap>*{pointer-events:auto}
@media(max-width:760px){.app-shell,.app-shell.sidebar-collapsed{grid-template-columns:1fr}.sidebar{position:fixed;left:0;top:0;bottom:0;width:min(82vw,292px);z-index:60;box-shadow:20px 0 60px rgba(0,0,0,.18)}.sidebar.closed{transform:translateX(-105%);margin-left:0;opacity:1;pointer-events:none}.messages{padding:64px 17px 178px}.composer-wrap{padding-left:12px;padding-right:12px}.row,.settings-grid{grid-template-columns:1fr}.bubble{max-width:94%;font-size:15px}.modal-backdrop{padding:10px}.modal{border-radius:20px;max-height:94dvh}.sidebar-bottom{grid-template-columns:1fr 1fr}.side-bottom-btn{font-size:12px;padding:0 8px}}
body.keyboard-open .messages{padding-bottom:210px} body.keyboard-open .composer-wrap{padding-bottom:10px}`;
      document.head.appendChild(st);
    }

    injectStyle();

    function safeGet(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
    function readJSON(key, fallback){ try{ const v = safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
    function saveJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
    function setItem(key, value){ try{ localStorage.setItem(key, value); }catch(e){} }
    function clamp(n,min,max){ n=Number(n); if(!Number.isFinite(n)) return min; return Math.max(min,Math.min(max,n)); }

    function normalizeMessage(m){
      if(!m || typeof m !== 'object') return null;
      const role = m.role === 'assistant' || m.role === 'system' ? m.role : 'user';
      const content = typeof m.content === 'string' ? m.content : (m.content == null ? '' : String(m.content));
      return {role, content};
    }
    function normalizeChat(c, i){
      if(!c || typeof c !== 'object') return null;
      const id = typeof c.id === 'string' && c.id ? c.id : uid() + '_' + i;
      const messages = Array.isArray(c.messages) ? c.messages.map(normalizeMessage).filter(Boolean) : [];
      let title = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : '';
      if(!title && messages[0]) title = messages[0].content.slice(0,28);
      if(!title) title = '新对话';
      return {id, title, createdAt:Number(c.createdAt)||Date.now(), updatedAt:Number(c.updatedAt)||Date.now(), messages};
    }
    function loadChats(){
      const candidates = [readJSON(KEYS.chats,null), readJSON(KEYS.v322Chats,null), readJSON(KEYS.oldChats,null)];
      for(const raw of candidates){
        if(Array.isArray(raw)){
          const clean = raw.map(normalizeChat).filter(Boolean);
          if(clean.length) return clean;
        }
      }
      const id = uid();
      return [{id, title:'新对话', createdAt:Date.now(), updatedAt:Date.now(), messages:[]}];
    }
    function normalizeMemory(raw){
      if(!Array.isArray(raw)) return [];
      return raw.map(function(x){
        if(typeof x === 'string') return {id:uid(), text:x, createdAt:Date.now(), updatedAt:Date.now(), source:'old'};
        if(x && typeof x === 'object' && typeof x.text === 'string') return {id:x.id||uid(), text:x.text, createdAt:x.createdAt||Date.now(), updatedAt:x.updatedAt||Date.now(), source:x.source||'auto'};
        return null;
      }).filter(Boolean).filter(function(x){return x.text.trim();}).slice(0,120);
    }

    let theme = safeGet(KEYS.theme) || 'dark';
    let settings = Object.assign({}, defaultSettings, readJSON(KEYS.settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {});
    settings.temperature = clamp(settings.temperature,0,2);
    settings.topP = clamp(settings.topP,0.01,1);
    settings.contextLimit = clamp(settings.contextLimit,4,80);

    function providerLabel(p){
      if(!p) return '未配置模型';
      const name = (p.providerName || p.name || '模型').trim();
      const model = (p.model || '').trim();
      return model ? (name + ' / ' + model) : name;
    }
    function normalizeProviders(raw, legacy){
      let arr = Array.isArray(raw) ? raw : [];
      arr = arr.map(function(p){
        if(!p || typeof p !== 'object') return null;
        return {
          id: p.id || uid(),
          providerType: p.providerType || p.type || 'openai',
          providerName: p.providerName || p.name || '模型',
          baseUrl: p.baseUrl || p.baseURL || '',
          apiKey: p.apiKey || '',
          model: p.model || '',
          path: p.path || '/v1/chat/completions'
        };
      }).filter(Boolean);
      const hasLegacy = legacy && (legacy.baseUrl || legacy.apiKey || legacy.model || legacy.providerName);
      if(!arr.length && hasLegacy){
        arr.push({id: legacy.activeProviderId || 'default', providerType: legacy.providerType || 'openai', providerName: legacy.providerName || 'DeepSeek', baseUrl: legacy.baseUrl || 'https://api.deepseek.com', apiKey: legacy.apiKey || '', model: legacy.model || 'deepseek-chat', path: legacy.path || '/v1/chat/completions'});
      }
      if(!arr.length){
        arr.push({id:'default', providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions'});
      }
      const seen = new Set();
      arr.forEach(function(p){ if(!p.id || seen.has(p.id)) p.id = uid(); seen.add(p.id); if(!p.path) p.path='/v1/chat/completions'; });
      return arr;
    }
    function getActiveProvider(){
      settings.providers = normalizeProviders(settings.providers, settings);
      let p = settings.providers.find(function(x){return x.id === settings.activeProviderId;});
      if(!p){ p = settings.providers[0]; settings.activeProviderId = p.id; }
      return p;
    }
    function syncProviderToSettings(p){
      if(!p) p = getActiveProvider();
      settings.activeProviderId = p.id;
      settings.providerType = p.providerType || 'openai';
      settings.providerName = p.providerName || '';
      settings.baseUrl = p.baseUrl || '';
      settings.apiKey = p.apiKey || '';
      settings.model = p.model || '';
      settings.path = p.path || '/v1/chat/completions';
    }
    function setActiveProvider(id){
      settings.providers = normalizeProviders(settings.providers, settings);
      const p = settings.providers.find(function(x){return x.id === id;}) || settings.providers[0];
      syncProviderToSettings(p);
      persist();
      renderQuickModelSelect();
    }
    settings.providers = normalizeProviders(settings.providers, settings);
    if(!settings.activeProviderId || !settings.providers.some(function(p){return p.id === settings.activeProviderId;})) settings.activeProviderId = settings.providers[0].id;
    syncProviderToSettings(getActiveProvider());

    let memory = normalizeMemory(readJSON(KEYS.memory,[]));
    let chats = loadChats();
    let activeId = safeGet(KEYS.active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
    let sidebarOpen = true;
    let searchOn = false;
    let sending = false;
    if(!chats.some(c=>c && c.id===activeId)) activeId = chats[0].id;

    function activeChat(){ return chats.find(c=>c && c.id===activeId) || chats[0]; }
    function persist(){ saveJSON(KEYS.chats,chats); setItem(KEYS.active,activeId); saveJSON(KEYS.settings,settings); setItem(KEYS.theme,theme); saveJSON(KEYS.memory,memory); }

    const app = $('#app');
    if(!app) throw new Error('#app not found');
    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><div class="brand">稻田 Ai</div></div>
          <button class="new-chat-btn" id="newChat">＋ 新对话</button>
          <div class="chat-list" id="chatList"></div>
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openSettings">设置</button><button class="side-bottom-btn" id="openProvider">模型提供方</button></div>
        </aside>
        <main class="main">
          <button class="floating-menu" id="openSide" title="展开侧边栏">☰</button>
          <div class="top-actions"><button class="icon-btn" id="themeBtn" title="主题">☀</button></div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="quick-row"><button class="pill" id="searchBtn">○ 联网搜索</button><select class="pill model-select" id="quickModelSelect" title="快速切换模型"></select></div>
            <div class="composer"><textarea id="input" placeholder="输入消息...（Enter 发送，Shift + Enter 换行）"></textarea><button class="send" id="sendBtn">›</button></div>
          </div>
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="row"><div class="field"><label>已保存模型 / 提供方</label><select id="providerSavedSelect"></select></div><div class="field"><label>操作</label><div class="provider-actions"><button class="btn" id="newProvider" type="button">新增模型</button><button class="btn" id="setActiveProvider" type="button">设为当前</button><button class="btn" id="deleteProvider" type="button">删除</button></div></div></div>
          <div class="row"><div class="field"><label>提供方类型</label><select id="providerType"><option value="openai">OpenAI 兼容</option><option value="gemini">Gemini</option><option value="anthropic">Anthropic</option></select></div><div class="field"><label>名称</label><input id="providerName" placeholder="DeepSeek / OpenAI / Gemini / Anthropic"></div></div>
          <div class="field"><label>Base URL</label><input id="baseUrl" placeholder="https://api.deepseek.com"></div>
          <div class="field"><label>API Key</label><input id="apiKey" type="password" placeholder="sk-... / AIza... / anthropic key"></div>
          <div class="row"><div class="field"><label>模型名</label><input id="model" placeholder="deepseek-chat"></div><div class="field"><label>请求路径</label><input id="path" placeholder="/v1/chat/completions"></div></div>
          <div class="hint">原有模型提供方配置完整保留。OpenAI 兼容接口可直接浏览器请求。Gemini / Anthropic 配置先保存，后续需要后端适配转发。</div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="modal-backdrop" id="settingsModal"><div class="modal">
        <div class="modal-head"><span>设置</span><button class="icon-btn" id="closeSettings">×</button></div>
        <div class="modal-body">
          <div class="settings-grid">
            <div class="field"><label>Temperature：<span id="temperatureValue"></span></label><input id="temperature" type="range" min="0" max="2" step="0.05"></div>
            <div class="field"><label>Top P：<span id="topPValue"></span></label><input id="topP" type="range" min="0.01" max="1" step="0.01"></div>
            <div class="field"><label>上下文策略</label><select id="contextMode"><option value="recent">最近消息</option><option value="all">全部消息</option><option value="compact">压缩策略</option></select></div>
            <div class="field"><label>上下文消息数</label><input id="contextLimit" type="number" min="4" max="80" step="1"></div>
          </div>
          <div class="field"><label>个性化 Prompt / 系统提示词</label><textarea id="systemPrompt" placeholder="写入长期生效的系统提示词"></textarea></div>
          <div class="field"><label>回复风格 / 人格补充 Prompt</label><textarea id="personalityPrompt" placeholder="写入你想固定给模型的回复风格"></textarea></div>
          <div class="settings-grid">
            <div class="field"><label>自动跨聊天记忆</label><select id="autoMemory"><option value="true">开启</option><option value="false">关闭</option></select></div>
            <div class="field"><label>把记忆注入模型上下文</label><select id="memoryInPrompt"><option value="true">开启</option><option value="false">关闭</option></select></div>
          </div>
          <div class="field"><label>新增记忆</label><textarea id="newMemory" placeholder="手动添加一条记忆，也支持自动摘取"></textarea><button class="btn" id="addMemory" type="button">添加记忆</button></div>
          <div class="field"><label>跨聊天记忆管理</label><div class="memory-list" id="memoryList"></div></div>
          <div class="hint">自动记忆会从“记住 / 帮我记住 / 以后 / 不准 / 喜欢 / 不喜欢 / 偏好 / 要求”等高价值表达里摘取，保存在本地浏览器，跨当前网页聊天生效。</div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelSettings">取消</button><button class="btn primary" id="saveSettings">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    function toast(text){ const s=$('#status'); if(!s)return; s.textContent=text; s.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>s.classList.remove('show'),1800); }
    function escapeHTML(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

    let mathReady = false;
    function ensureMathJax(){
      if(!settings.mathRender) return Promise.resolve(false);
      if(window.MathJax && window.MathJax.typesetPromise) return Promise.resolve(true);
      if(mathReady) return Promise.resolve(false);
      mathReady = true;
      window.MathJax = {tex:{inlineMath:[['\\(','\\)'],['$','$']],displayMath:[['\\[','\\]'],['$$','$$']],processEscapes:true},svg:{fontCache:'global'}};
      return new Promise(function(resolve){
        const s=document.createElement('script');
        s.src='https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js';
        s.async=true;
        s.onload=function(){resolve(true);};
        s.onerror=function(){resolve(false);};
        document.head.appendChild(s);
      });
    }
    let mathTimer=null;
    function typesetMath(){
      if(!settings.mathRender) return;
      clearTimeout(mathTimer);
      mathTimer=setTimeout(function(){
        ensureMathJax().then(function(ok){ if(ok && window.MathJax && window.MathJax.typesetPromise) window.MathJax.typesetPromise($$('.assistant-content')).catch(function(){}); });
      },80);
    }

    function protectMathAndCode(text, blocks){
      text = String(text||'').replace(/\r\n/g,'\n');
      text = text.replace(/```([\s\S]*?)```/g,function(_,code){
        const token='@@BLOCK'+blocks.length+'@@';
        const lang = (code.match(/^([a-zA-Z0-9_-]+)\n/)||[])[1] || '';
        const body = lang ? code.replace(/^([a-zA-Z0-9_-]+)\n/,'') : code;
        blocks.push('<pre><code>'+escapeHTML(body)+'</code></pre>');
        return token;
      });
      text = text.replace(/\$\$([\s\S]*?)\$\$/g,function(_,math){
        const token='@@BLOCK'+blocks.length+'@@'; blocks.push('<div class="math">\\['+escapeHTML(math.trim())+'\\]</div>'); return token;
      });
      text = text.replace(/\\\[([\s\S]*?)\\\]/g,function(_,math){
        const token='@@BLOCK'+blocks.length+'@@'; blocks.push('<div class="math">\\['+escapeHTML(math.trim())+'\\]</div>'); return token;
      });
      return text;
    }

    function inlineFormat(s){
      const math = [];
      s = String(s||'').replace(/\\\(([\s\S]*?)\\\)/g,function(_,m){ const t='@@MATH'+math.length+'@@'; math.push('\\('+escapeHTML(m.trim())+'\\)'); return t; });
      s = s.replace(/(?<!\$)\$([^\n$]+?)\$(?!\$)/g,function(_,m){ const t='@@MATH'+math.length+'@@'; math.push('\\('+escapeHTML(m.trim())+'\\)'); return t; });
      s = escapeHTML(s);
      s = s.replace(/`([^`]+)`/g,'<code>$1</code>');
      s = s.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
      s = s.replace(/__([^_]+)__/g,'<strong>$1</strong>');
      s = s.replace(/\*([^*]+)\*/g,'<em>$1</em>');
      s = s.replace(/@@MATH(\d+)@@/g,function(_,i){ return math[Number(i)] || ''; });
      return s;
    }

    function compactLooseLines(text){
      const src = String(text||'').replace(/\r\n/g,'\n').split('\n');
      const out = [];
      for(let i=0;i<src.length;i++){
        let a = src[i].trim();
        let b = (src[i+1]||'').trim();
        let c = (src[i+2]||'').trim();
        if(/^[-*+]$/.test(a) && /^(<|>|=|≤|≥|≠|≈|d\s*[<>=]|S\s*[<>=])/.test(b)){
          let line = '- ' + b;
          if(/^→/.test(c)){ line += ' ' + c; i += 2; } else { i += 1; }
          out.push(line);
          continue;
        }
        if(/^(<|>|=|≤|≥|≠|≈|d\s*[<>=]|S\s*[<>=])/.test(a) && /^→/.test(b)){
          out.push(a + ' ' + b); i += 1; continue;
        }
        out.push(src[i]);
      }
      return out.join('\n');
    }

    function renderTable(lines, start){
      if(start + 1 >= lines.length) return null;
      if(!/^\s*\|.*\|\s*$/.test(lines[start])) return null;
      if(!/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[start+1])) return null;
      const rows=[]; let i=start;
      for(; i<lines.length; i++){
        if(!/^\s*\|.*\|\s*$/.test(lines[i])) break;
        if(i===start+1) continue;
        let cells = lines[i].trim().replace(/^\|/,'').replace(/\|$/,'').split('|').map(x=>x.trim());
        rows.push(cells);
      }
      if(!rows.length) return null;
      const head = rows.shift();
      let html = '<table><thead><tr>'+head.map(x=>'<th>'+inlineFormat(x)+'</th>').join('')+'</tr></thead>';
      if(rows.length) html += '<tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+inlineFormat(x)+'</td>').join('')+'</tr>').join('')+'</tbody>';
      html += '</table>';
      return {html, next:i-1};
    }

    function renderMarkdown(text){
      if(!settings.markdownRender) return '<div class="assistant-content"><p>'+escapeHTML(text).replace(/\n/g,'<br>')+'</p></div>';
      const blocks = [];
      text = compactLooseLines(text);
      text = protectMathAndCode(text, blocks);
      const lines = text.split('\n');
      let html = '';
      let list = null;
      let paragraph = [];
      function flushParagraph(){
        if(paragraph.length){
          const joined = paragraph.join('<br>');
          html += '<p>'+inlineFormat(joined)+'</p>';
          paragraph = [];
        }
      }
      function closeList(){ if(list){ html += list === 'ol' ? '</ol>' : '</ul>'; list = null; } }
      for(let i=0;i<lines.length;i++){
        let raw = lines[i];
        let trimmed = raw.trim();
        if(!trimmed){ flushParagraph(); closeList(); continue; }
        const table = renderTable(lines, i);
        if(table){ flushParagraph(); closeList(); html += table.html; i = table.next; continue; }
        if(/^@@BLOCK\d+@@$/.test(trimmed)){ flushParagraph(); closeList(); html += trimmed; continue; }
        if(/^---+$/.test(trimmed)){ flushParagraph(); closeList(); html += '<hr>'; continue; }
        const h = trimmed.match(/^(#{1,4})\s+(.+)$/);
        if(h){ flushParagraph(); closeList(); const n=Math.min(h[1].length+1,4); html += '<h'+n+'>'+inlineFormat(h[2])+'</h'+n+'>'; continue; }
        const quote = trimmed.match(/^>\s?(.*)$/);
        if(quote){ flushParagraph(); closeList(); html += '<blockquote>'+inlineFormat(quote[1])+'</blockquote>'; continue; }
        const ul = trimmed.match(/^[-*+]\s+(.+)$/);
        if(ul){ flushParagraph(); if(list!=='ul'){ closeList(); html+='<ul>'; list='ul'; } html+='<li>'+inlineFormat(ul[1])+'</li>'; continue; }
        const ol = trimmed.match(/^\d+[.)]\s+(.+)$/);
        if(ol){ flushParagraph(); if(list!=='ol'){ closeList(); html+='<ol>'; list='ol'; } html+='<li>'+inlineFormat(ol[1])+'</li>'; continue; }
        closeList();
        if(/^(<|>|=|≤|≥|≠|≈|d\s*[<>=]|S\s*[<>=])/.test(trimmed)){
          flushParagraph(); html += '<p><span class="loose-eq">'+inlineFormat(trimmed)+'</span></p>'; continue;
        }
        paragraph.push(trimmed);
      }
      flushParagraph(); closeList();
      html = html.replace(/@@BLOCK(\d+)@@/g,function(_,i){return blocks[Number(i)] || '';});
      return '<div class="assistant-content">'+html+'</div>';
    }

    function renderSidebar(){
      const side = $('#sidebar'); if(!side) return;
      const shell = $('.app-shell'); if(shell) shell.classList.toggle('sidebar-collapsed', !sidebarOpen);
      side.classList.toggle('closed', !sidebarOpen);
      $('#openSide').style.display = sidebarOpen ? 'none' : 'grid';
      const list = $('#chatList');
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span><button class="delete-chat" data-del="${escapeHTML(c.id)}" title="删除">×</button></div>`).join('');
    }
    function pickEmptyPrompt(){ const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate(); return emptyPrompts[seed % emptyPrompts.length]; }

    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><svg class="empty-logo empty-logo-gamma" viewBox="0 0 120 120" aria-hidden="true"><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(function(m, idx){
        const isAssistant = m.role === 'assistant';
        const content = isAssistant ? renderMarkdown(m.content) : escapeHTML(m.content).replace(/\n/g,'<br>');
        const streamingCls = isAssistant && sending && idx === msgs.length - 1 ? ' streaming' : '';
        const actions = isAssistant ? `<div class="assistant-actions"><button class="assistant-action" data-copy-msg="${idx}" title="复制">⧉</button><button class="assistant-action" data-like-msg="${idx}" title="喜欢">👍</button><button class="assistant-action" data-dislike-msg="${idx}" title="不喜欢">👎</button><button class="assistant-action" data-regen-msg="${idx}" title="重新生成">↻</button></div>` : '';
        return `<div class="message ${m.role==='user'?'user':'assistant'}${streamingCls}"><div class="bubble">${content}${actions}</div></div>`;
      }).join('');
      box.scrollTop = box.scrollHeight;
      typesetMath();
    }
    function renderQuickModelSelect(){
      const sel = $('#quickModelSelect'); if(!sel) return;
      settings.providers = normalizeProviders(settings.providers, settings);
      sel.innerHTML = settings.providers.map(function(p){ return '<option value="'+escapeHTML(p.id)+'">'+escapeHTML(providerLabel(p))+'</option>'; }).join('');
      if(!settings.providers.some(function(p){return p.id===settings.activeProviderId;})) settings.activeProviderId = settings.providers[0].id;
      sel.value = settings.activeProviderId;
    }

    function renderAll(){
      document.documentElement.setAttribute('data-theme', theme);
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      const themeBtn = $('#themeBtn'); if(themeBtn) themeBtn.textContent = theme === 'dark' ? '☾' : '☀';
      renderSidebar(); renderMessages(); renderQuickModelSelect(); persist();
    }

    function createChat(){ const id=uid(); chats.unshift({id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; sidebarOpen=true; renderAll(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      renderAll(); toast('已删除');
    }

    function buildOpenAIURL(){ const p=getActiveProvider(); const base=(p.baseUrl||settings.baseUrl||'').replace(/\/$/,''); const path=p.path||settings.path||'/v1/chat/completions'; if(!base) return '/v1/chat/completions'; if(base.endsWith('/v1') && path.startsWith('/v1/')) return base + path.slice(3); return base + (path.startsWith('/') ? path : '/' + path); }
    function extractDelta(data){
      const choice = data && data.choices && data.choices[0];
      if(choice && choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
      if(choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
      if(data && Array.isArray(data.content)) return data.content.map(function(part){ return part && part.text ? part.text : ''; }).join('');
      return '';
    }
    function extractFullContent(data){ return data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || data.content?.[0]?.text || ''; }

    function memoryText(){
      if(!settings.memoryInPrompt || !memory.length) return '';
      return '跨聊天记忆：\n' + memory.slice(-40).map(function(m,i){return (i+1)+'. '+m.text;}).join('\n');
    }
    function buildRequestMessages(baseMessages){
      let msgs = baseMessages.slice();
      if(settings.contextMode === 'recent') msgs = msgs.slice(-settings.contextLimit);
      if(settings.contextMode === 'compact' && msgs.length > settings.contextLimit){
        const old = msgs.slice(0, -settings.contextLimit).map(m=>m.role+': '+m.content).join('\n').slice(-4000);
        msgs = [{role:'system',content:'较早上下文摘要材料：\n'+old}].concat(msgs.slice(-settings.contextLimit));
      }
      const systemParts = [];
      if(settings.systemPrompt) systemParts.push(settings.systemPrompt);
      if(settings.personalityPrompt) systemParts.push(settings.personalityPrompt);
      const mem = memoryText(); if(mem) systemParts.push(mem);
      if(systemParts.length) msgs.unshift({role:'system',content:systemParts.join('\n\n')});
      return msgs;
    }

    async function callModel(messages, onDelta){
      const activeProvider = getActiveProvider();
      if((activeProvider.providerType||'openai') !== 'openai') throw new Error('Gemini / Anthropic 已保存，但还需要后端转发适配。当前先用 OpenAI 兼容接口。');
      const headers={'Content-Type':'application/json'}; if(activeProvider.apiKey) headers.Authorization='Bearer '+activeProvider.apiKey;
      const body={model:activeProvider.model||'deepseek-chat',messages:buildRequestMessages(messages).map(m=>({role:m.role,content:m.content})),stream:true,temperature:clamp(settings.temperature,0,2),top_p:clamp(settings.topP,0.01,1)};
      if(searchOn) body.web_search=true;
      const res=await fetch(buildOpenAIURL(),{method:'POST',headers,body:JSON.stringify(body)});
      if(!res.ok){ const txt=await res.text(); throw new Error(txt.slice(0,400)||('HTTP '+res.status)); }
      if(!res.body){ const txt=await res.text(); try{ const data=JSON.parse(txt); return extractFullContent(data) || JSON.stringify(data).slice(0,1000); }catch(e){ return txt; } }
      const reader=res.body.getReader(); const decoder=new TextDecoder(); let buffer=''; let raw=''; let full='';
      function consumeLine(line){
        const trimmed=line.trim(); if(!trimmed) return false; if(!trimmed.startsWith('data:')) return false;
        const payload=trimmed.replace(/^data:\s*/, ''); if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{ const data=JSON.parse(payload); const delta=extractDelta(data); if(delta){ full += delta; if(onDelta) onDelta(delta, full); } }catch(_e){}
        return false;
      }
      while(true){ const read=await reader.read(); if(read.done) break; const chunk=decoder.decode(read.value,{stream:true}); raw += chunk; buffer += chunk; let index; while((index=buffer.indexOf('\n'))>=0){ const line=buffer.slice(0,index); buffer=buffer.slice(index+1); if(consumeLine(line)) return full; } }
      buffer += decoder.decode(); if(buffer.trim()) consumeLine(buffer); if(full) return full;
      try{ const data=JSON.parse(raw); return extractFullContent(data) || JSON.stringify(data).slice(0,1000); }catch(_e){ return raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(); }
    }

    function shouldRemember(text){
      if(!settings.autoMemory) return false;
      const t = String(text||'').trim();
      if(t.length < 6) return false;
      return /(记住|帮我记住|以后|之后|从现在|不准|禁止|必须|偏好|喜欢|不喜欢|我希望|我要你|老规矩|保留一切|不要|默认|以后.*回复|以后.*不要|以后.*必须|我的要求|我习惯|我常用|项目.*规则)/.test(t);
    }
    function conciseMemory(text){
      let t = String(text||'').trim().replace(/\s+/g,' ');
      t = t.replace(/^(记住|帮我记住|你记住|请记住)[:：，,\s]*/,'');
      if(t.length > 220) t = t.slice(0,220) + '…';
      return t;
    }
    function addMemoryText(text, source){
      const t = conciseMemory(text);
      if(!t) return false;
      if(memory.some(m=>m.text === t)) return false;
      memory.push({id:uid(), text:t, createdAt:Date.now(), updatedAt:Date.now(), source:source||'auto'});
      if(memory.length > 120) memory = memory.slice(-120);
      persist();
      return true;
    }

    async function sendMessageFromHistory(){
      if(sending) return;
      const c=activeChat();
      const requestMessages=c.messages.map(m=>({role:m.role,content:m.content}));
      const assistant={role:'assistant',content:''}; c.messages.push(assistant); sending=true; $('#sendBtn').disabled=true; renderAll();
      try{
        const finalText=await callModel(requestMessages, function(delta){ assistant.content += delta; c.updatedAt=Date.now(); renderMessages(); });
        if(!assistant.content.trim()) assistant.content=finalText || '没有返回内容';
      }catch(err){ assistant.content='请求失败：'+(err&&err.message?err.message:String(err)); }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
    }

    async function sendMessage(){
      if(sending) return; const input=$('#input'); const text=(input.value||'').trim(); if(!text) return; const c=activeChat();
      c.messages.push({role:'user',content:text}); if(!c.title || c.title==='新对话') c.title=text.slice(0,28); c.updatedAt=Date.now(); input.value=''; sending=true; $('#sendBtn').disabled=true;
      if(shouldRemember(text)) addMemoryText(text, /记住|帮我记住/.test(text) ? 'explicit' : 'auto');
      const requestMessages=c.messages.map(m=>({role:m.role,content:m.content}));
      const assistant={role:'assistant',content:''}; c.messages.push(assistant); renderAll();
      try{
        const finalText=await callModel(requestMessages, function(delta){ assistant.content += delta; c.updatedAt=Date.now(); renderMessages(); });
        if(!assistant.content.trim()) assistant.content=finalText || '没有返回内容';
      }catch(err){ assistant.content='请求失败：'+(err&&err.message?err.message:String(err)); }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
    }

    let editingProviderId = null;
    function providerFromForm(id){
      return {id:id || uid(), providerType:$('#providerType').value || 'openai', providerName:$('#providerName').value.trim() || ($('#model').value.trim() || '模型'), baseUrl:$('#baseUrl').value.trim(), apiKey:$('#apiKey').value.trim(), model:$('#model').value.trim(), path:$('#path').value.trim() || '/v1/chat/completions'};
    }
    function fillProviderForm(p){
      p = p || {providerType:'openai', providerName:'', baseUrl:'', apiKey:'', model:'', path:'/v1/chat/completions'};
      $('#providerType').value=p.providerType||'openai'; $('#providerName').value=p.providerName||''; $('#baseUrl').value=p.baseUrl||''; $('#apiKey').value=p.apiKey||''; $('#model').value=p.model||''; $('#path').value=p.path||'/v1/chat/completions';
    }
    function renderProviderSavedSelect(){
      const sel = $('#providerSavedSelect'); if(!sel) return;
      settings.providers = normalizeProviders(settings.providers, settings);
      sel.innerHTML = settings.providers.map(function(p){ return '<option value="'+escapeHTML(p.id)+'">'+escapeHTML((p.id===settings.activeProviderId?'当前 · ':'') + providerLabel(p))+'</option>'; }).join('');
      sel.value = editingProviderId || settings.activeProviderId || settings.providers[0].id;
    }
    function openProvider(){ settings.providers = normalizeProviders(settings.providers, settings); editingProviderId = settings.activeProviderId || settings.providers[0].id; renderProviderSavedSelect(); fillProviderForm(settings.providers.find(function(p){return p.id===editingProviderId;}) || settings.providers[0]); $('#providerModal').classList.add('show'); }
    function closeProvider(){ $('#providerModal').classList.remove('show'); }
    function saveProvider(){
      settings.providers = normalizeProviders(settings.providers, settings);
      const id = editingProviderId || uid();
      const data = providerFromForm(id);
      const idx = settings.providers.findIndex(function(p){return p.id===id;});
      if(idx>=0) settings.providers[idx] = data; else settings.providers.push(data);
      syncProviderToSettings(data);
      persist(); renderQuickModelSelect(); renderProviderSavedSelect(); closeProvider(); toast('已保存并切换模型');
    }
    function newProvider(){ editingProviderId = null; fillProviderForm({providerType:'openai', providerName:'', baseUrl:'', apiKey:'', model:'', path:'/v1/chat/completions'}); const sel=$('#providerSavedSelect'); if(sel) sel.value=''; }
    function deleteProvider(){
      settings.providers = normalizeProviders(settings.providers, settings);
      const id = editingProviderId || ($('#providerSavedSelect') && $('#providerSavedSelect').value);
      if(settings.providers.length<=1){ toast('至少保留一个模型'); return; }
      settings.providers = settings.providers.filter(function(p){return p.id!==id;});
      if(settings.activeProviderId===id) settings.activeProviderId=settings.providers[0].id;
      editingProviderId=settings.activeProviderId; syncProviderToSettings(getActiveProvider()); persist(); renderProviderSavedSelect(); fillProviderForm(getActiveProvider()); renderQuickModelSelect(); toast('已删除模型');
    }
    function setActiveProviderFromPanel(){
      const id = editingProviderId || ($('#providerSavedSelect') && $('#providerSavedSelect').value);
      if(id){ setActiveProvider(id); editingProviderId=id; renderProviderSavedSelect(); fillProviderForm(getActiveProvider()); toast('已切换当前模型'); }
    }

    function renderMemoryList(){
      const box = $('#memoryList'); if(!box) return;
      if(!memory.length){ box.innerHTML = '<div class="hint">暂无记忆</div>'; return; }
      box.innerHTML = memory.map(function(m){ return `<div class="memory-item" data-mid="${escapeHTML(m.id)}"><textarea data-memory-text="${escapeHTML(m.id)}">${escapeHTML(m.text)}</textarea><div class="memory-actions"><button class="btn" data-memory-save="${escapeHTML(m.id)}" type="button">保存</button><button class="btn" data-memory-del="${escapeHTML(m.id)}" type="button">删除</button></div></div>`; }).join('');
    }
    function openSettingsPanel(){
      $('#temperature').value=clamp(settings.temperature,0,2); $('#temperatureValue').textContent=$('#temperature').value;
      $('#topP').value=clamp(settings.topP,0.01,1); $('#topPValue').textContent=$('#topP').value;
      $('#contextMode').value=settings.contextMode||'recent'; $('#contextLimit').value=settings.contextLimit||24;
      $('#systemPrompt').value=settings.systemPrompt||''; $('#personalityPrompt').value=settings.personalityPrompt||'';
      $('#autoMemory').value=String(settings.autoMemory !== false); $('#memoryInPrompt').value=String(settings.memoryInPrompt !== false);
      $('#newMemory').value=''; renderMemoryList(); $('#settingsModal').classList.add('show');
    }
    function closeSettingsPanel(){ $('#settingsModal').classList.remove('show'); }
    function saveSettingsPanel(){
      settings=Object.assign({},settings,{temperature:clamp($('#temperature').value,0,2),topP:clamp($('#topP').value,0.01,1),contextMode:$('#contextMode').value,contextLimit:clamp($('#contextLimit').value,4,80),systemPrompt:$('#systemPrompt').value.trim(),personalityPrompt:$('#personalityPrompt').value.trim(),autoMemory:$('#autoMemory').value==='true',memoryInPrompt:$('#memoryInPrompt').value==='true'});
      persist(); closeSettingsPanel(); toast('已保存设置');
    }

    document.addEventListener('click', e=>{
      const copyBtn=e.target.closest('[data-copy-msg]'); if(copyBtn){ const c=activeChat(); const m=c.messages[Number(copyBtn.getAttribute('data-copy-msg'))]; if(m){ navigator.clipboard && navigator.clipboard.writeText(m.content).then(()=>toast('已复制')).catch(()=>toast('复制失败')); } return; }
      const likeBtn=e.target.closest('[data-like-msg]'); if(likeBtn){ toast('已记录'); return; }
      const dislikeBtn=e.target.closest('[data-dislike-msg]'); if(dislikeBtn){ toast('已记录'); return; }
      const regenBtn=e.target.closest('[data-regen-msg]'); if(regenBtn){ const c=activeChat(); const idx=Number(regenBtn.getAttribute('data-regen-msg')); if(c && idx>0){ c.messages=c.messages.slice(0,idx); renderAll(); sendMessageFromHistory(); } return; }
      const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); if(window.innerWidth<760) sidebarOpen=false; renderAll(); return; }
      const mdel=e.target.closest('[data-memory-del]'); if(mdel){ const id=mdel.getAttribute('data-memory-del'); memory=memory.filter(m=>m.id!==id); persist(); renderMemoryList(); toast('已删除记忆'); return; }
      const msave=e.target.closest('[data-memory-save]'); if(msave){ const id=msave.getAttribute('data-memory-save'); const ta=$(`[data-memory-text="${CSS.escape(id)}"]`); const obj=memory.find(m=>m.id===id); if(obj&&ta){ obj.text=ta.value.trim(); obj.updatedAt=Date.now(); persist(); renderMemoryList(); toast('已保存记忆'); } return; }
    });

    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();}; $('#openSide').onclick=()=>{sidebarOpen=true;renderAll();}; $('#newChat').onclick=createChat; $('#themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#openProvider').onclick=openProvider; $('#closeProvider').onclick=closeProvider; $('#cancelProvider').onclick=closeProvider; $('#saveProvider').onclick=saveProvider; $('#newProvider').onclick=newProvider; $('#deleteProvider').onclick=deleteProvider; $('#setActiveProvider').onclick=setActiveProviderFromPanel; $('#providerSavedSelect').onchange=function(e){ editingProviderId=e.target.value; fillProviderForm(settings.providers.find(function(p){return p.id===editingProviderId;}) || getActiveProvider()); };
    $('#openSettings').onclick=openSettingsPanel; $('#closeSettings').onclick=closeSettingsPanel; $('#cancelSettings').onclick=closeSettingsPanel; $('#saveSettings').onclick=saveSettingsPanel;
    $('#temperature').addEventListener('input',()=>{$('#temperatureValue').textContent=$('#temperature').value;}); $('#topP').addEventListener('input',()=>{$('#topPValue').textContent=$('#topP').value;});
    $('#addMemory').onclick=function(){ const v=$('#newMemory').value.trim(); if(addMemoryText(v,'manual')){ $('#newMemory').value=''; renderMemoryList(); toast('已添加记忆'); } };
    $('#searchBtn').onclick=()=>{searchOn=!searchOn; $('#searchBtn').classList.toggle('active',searchOn); $('#searchBtn').textContent=searchOn?'● 联网搜索':'○ 联网搜索';}; $('#quickModelSelect').onchange=function(e){ setActiveProvider(e.target.value); toast('已切换模型'); }; $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });
    $('#providerType').addEventListener('change', e=>{ const v=e.target.value; if(v==='openai'){ $('#path').value='/v1/chat/completions'; if(!$('#baseUrl').value) $('#baseUrl').value='https://api.deepseek.com'; } if(v==='gemini'){ $('#providerName').value=$('#providerName').value||'Gemini'; $('#baseUrl').value=$('#baseUrl').value||'https://generativelanguage.googleapis.com'; $('#model').value=$('#model').value||'gemini-1.5-flash'; } if(v==='anthropic'){ $('#providerName').value=$('#providerName').value||'Anthropic'; $('#baseUrl').value=$('#baseUrl').value||'https://api.anthropic.com'; $('#model').value=$('#model').value||'claude-3-5-sonnet-latest'; } });

    function setupMobileViewport(){
      try{
        const root = document.documentElement; const input = $('#input'); const messagesBox = $('#messages'); if(!root || !input || !messagesBox) return; let timer = null;
        function isMobile(){ return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 760; }
        function scrollLatest(){ requestAnimationFrame(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} }); setTimeout(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} }, 120); }
        function applyViewport(){ if(!isMobile()){ document.body.classList.remove('keyboard-open'); root.style.removeProperty('--app-height'); return; } const vv = window.visualViewport; const h = vv && vv.height ? vv.height : window.innerHeight; root.style.setProperty('--app-height', Math.max(320, Math.round(h)) + 'px'); const focused = document.activeElement === input; document.body.classList.toggle('keyboard-open', focused); if(focused){ if(sidebarOpen){ sidebarOpen = false; renderSidebar(); } scrollLatest(); } }
        function schedule(delay){ clearTimeout(timer); timer = setTimeout(applyViewport, delay || 30); }
        input.addEventListener('focus', function(){ schedule(0); setTimeout(applyViewport, 120); setTimeout(applyViewport, 320); });
        input.addEventListener('blur', function(){ setTimeout(function(){ document.body.classList.remove('keyboard-open'); applyViewport(); }, 160); });
        input.addEventListener('input', function(){ schedule(20); scrollLatest(); });
        window.addEventListener('resize', function(){ schedule(20); }, {passive:true}); window.addEventListener('orientationchange', function(){ setTimeout(applyViewport, 260); }, {passive:true});
        if(window.visualViewport){ window.visualViewport.addEventListener('resize', function(){ schedule(20); }, {passive:true}); window.visualViewport.addEventListener('scroll', function(){ schedule(20); }, {passive:true}); }
        applyViewport();
      }catch(_err){}
    }

    renderAll(); setupMobileViewport();
  }catch(err){ emergency(err && err.stack ? err.stack : err); }
})();
