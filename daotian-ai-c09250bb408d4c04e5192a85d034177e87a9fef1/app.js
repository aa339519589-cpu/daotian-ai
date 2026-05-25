(function(){
  'use strict';
  window.__DAOTIAN_THINKING_VERSION__ = 'v3.5.2-keyboard-render-stable';

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
      try{
        Object.keys(localStorage).forEach(function(k){ if(k.indexOf('daotian')===0) localStorage.removeItem(k); });
      }catch(e){}
      location.reload();
    };
  }

  window.addEventListener('error', function(e){ emergency(e.message || e.error || 'script error'); });
  window.addEventListener('unhandledrejection', function(e){ emergency((e.reason && e.reason.message) || e.reason || 'promise error'); });

  try{
    const $ = (sel, root=document) => root.querySelector(sel);
    const uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

    const KEYS = {
      chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323',
      oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
      v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322'
    };

    const defaultSettings = { providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions' };

    const emptyPrompts = [
      '今天想聊什么',
      '从哪一句开始',
      '现在想说点什么',
      '今天先聊哪件事',
      '随便开个头也行',
      '想到什么就发什么'
    ];

    function safeGet(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
    function readJSON(key, fallback){ try{ const v = safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
    function saveJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
    function setItem(key, value){ try{ localStorage.setItem(key, value); }catch(e){} }

    function slugify(value){
      return String(value || 'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48) || 'x';
    }
    function splitModels(value){
      if(Array.isArray(value)) return value.map(v=>String(v||'').trim()).filter(Boolean);
      return String(value || '')
        .split(/[\n,，;；]+/)
        .map(v=>v.trim())
        .filter(Boolean);
    }
    function makeProviderId(name, baseUrl, i){
      return 'p_' + slugify((name || 'provider') + '_' + (baseUrl || '')) + '_' + i;
    }
    function normalizeProvider(p, i){
      p = p && typeof p === 'object' ? p : {};
      const providerName = String(p.providerName || p.name || p.label || defaultSettings.providerName || 'DeepSeek').trim() || 'DeepSeek';
      const baseUrl = String(p.baseUrl || defaultSettings.baseUrl || '').trim();
      const models = splitModels(p.models || p.modelList || p.model || defaultSettings.model || 'deepseek-chat');
      const id = String(p.id || p.providerId || makeProviderId(providerName, baseUrl, i)).trim();
      return {
        id,
        providerType: String(p.providerType || defaultSettings.providerType || 'openai'),
        providerName,
        baseUrl,
        apiKey: String(p.apiKey || '').trim(),
        path: String(p.path || p.requestPath || defaultSettings.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
        models: models.length ? Array.from(new Set(models)) : [defaultSettings.model || 'deepseek-chat']
      };
    }
    function presetFromProvider(provider, model, index){
      const id = provider.id + '__' + slugify(model);
      return {
        id,
        providerId: provider.id,
        label: (provider.providerName ? provider.providerName + ' ' : '') + model,
        providerType: provider.providerType,
        providerName: provider.providerName,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        path: provider.path
      };
    }
    function providersToPresets(providers){
      const presets = [];
      providers.forEach(function(provider){
        provider.models.forEach(function(model){ presets.push(presetFromProvider(provider, model, presets.length)); });
      });
      return presets;
    }
    function providerKeyFromPreset(p){
      return [p.providerType||'openai', p.providerName||'', p.baseUrl||'', p.apiKey||'', p.path||'/v1/chat/completions'].join('\n');
    }
    function providersFromPresets(presets){
      const groups = [];
      const map = new Map();
      (Array.isArray(presets) ? presets : []).forEach(function(raw, i){
        const p = raw && typeof raw === 'object' ? raw : {};
        const model = String(p.model || '').trim();
        if(!model) return;
        const normalized = {
          providerType: String(p.providerType || defaultSettings.providerType || 'openai'),
          providerName: String(p.providerName || p.name || defaultSettings.providerName || 'DeepSeek').trim() || 'DeepSeek',
          baseUrl: String(p.baseUrl || defaultSettings.baseUrl || '').trim(),
          apiKey: String(p.apiKey || '').trim(),
          path: String(p.path || defaultSettings.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
          model
        };
        const key = providerKeyFromPreset(normalized);
        let item = map.get(key);
        if(!item){
          item = normalizeProvider({
            id: p.providerId || makeProviderId(normalized.providerName, normalized.baseUrl, groups.length),
            providerType: normalized.providerType,
            providerName: normalized.providerName,
            baseUrl: normalized.baseUrl,
            apiKey: normalized.apiKey,
            path: normalized.path,
            models: []
          }, groups.length);
          item.models = [];
          groups.push(item);
          map.set(key, item);
        }
        if(!item.models.includes(model)) item.models.push(model);
      });
      return groups.map(normalizeProvider);
    }
    function legacyProviders(base){
      const provider = normalizeProvider({
        id:'p_legacy_0',
        providerType: base.providerType,
        providerName: base.providerName,
        baseUrl: base.baseUrl,
        apiKey: base.apiKey,
        path: base.path,
        models: splitModels(base.models || base.modelList || base.model || defaultSettings.model)
      }, 0);
      const deepseekLike = /deepseek/i.test(provider.providerName || '') || /deepseek/i.test(provider.baseUrl || '');
      if(deepseekLike && !provider.models.includes('deepseek-reasoner')) provider.models.push('deepseek-reasoner');
      return [provider];
    }
    function ensureSettingsShape(raw){
      const base = Object.assign({}, defaultSettings, raw || {});
      let providers = [];
      if(Array.isArray(base.modelProviders) && base.modelProviders.length){
        providers = base.modelProviders.map(normalizeProvider).filter(p=>p && p.models && p.models.length);
      }else if(Array.isArray(base.modelPresets) && base.modelPresets.length){
        providers = providersFromPresets(base.modelPresets);
      }
      if(!providers.length) providers = legacyProviders(base);
      base.modelProviders = providers;
      base.modelPresets = providersToPresets(providers);
      if(!base.activePresetId || !base.modelPresets.some(p=>p.id===base.activePresetId)){
        const hit = base.modelPresets.find(p=>p.model===base.model && p.baseUrl===base.baseUrl) || base.modelPresets[0];
        base.activePresetId = hit ? hit.id : '';
      }
      return base;
    }

    function normalizeMessage(m){
      if(!m || typeof m !== 'object') return null;
      const role = m.role === 'assistant' || m.role === 'system' || m.role === 'error' ? m.role : 'user';
      const content = typeof m.content === 'string' ? m.content : (m.content == null ? '' : String(m.content));
      const out = {role, content};
      if(typeof m.model === 'string') out.model = m.model;
      if(typeof m.provider === 'string') out.provider = m.provider;
      if(typeof m.modelLabel === 'string') out.modelLabel = m.modelLabel;
      return out;
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

    let theme = safeGet(KEYS.theme) || 'dark';
    let settings = ensureSettingsShape(Object.assign({}, defaultSettings, readJSON(KEYS.settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {}));
    let chats = loadChats();
    let activeId = safeGet(KEYS.active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
    let sidebarOpen = true;
    let searchOn = false;
    let sending = false;
    if(!chats.some(c=>c && c.id===activeId)) activeId = chats[0].id;

    function activeChat(){ return chats.find(c=>c && c.id===activeId) || chats[0]; }
    function modelPresets(){
      settings = ensureSettingsShape(settings);
      return settings.modelPresets || [];
    }
    function activePreset(){
      const presets = modelPresets();
      return presets.find(p=>p.id===settings.activePresetId) || presets[0];
    }
    function syncLegacySettings(){
      const p = activePreset();
      if(!p) return;
      settings.providerType = p.providerType;
      settings.providerName = p.providerName;
      settings.baseUrl = p.baseUrl;
      settings.apiKey = p.apiKey;
      settings.model = p.model;
      settings.path = p.path;
    }
    function persist(){ syncLegacySettings(); saveJSON(KEYS.chats,chats); setItem(KEYS.active,activeId); saveJSON(KEYS.settings,settings); setItem(KEYS.theme,theme); }

    const app = $('#app');
    if(!app) throw new Error('#app not found');
    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><div class="brand">稻田 Ai</div></div>
          <button class="new-chat-btn" id="newChat">＋ 新对话</button>
          <div class="chat-list" id="chatList"></div>
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openProvider">设置 / 模型提供方</button></div>
        </aside>
        <main class="main">
          <button class="floating-menu" id="openSide" title="展开侧边栏">☰</button>
          <div class="top-actions"><button class="icon-btn" id="themeBtn" title="主题">☀</button></div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="search-toggle model-toolbar"><button class="pill" id="searchBtn">○ 联网搜索</button><div class="model-switcher"><button class="pill model-pill" id="modelBtn" title="切换模型">模型 ▾</button><div class="model-menu" id="modelMenu"></div></div></div>
            <div class="composer"><textarea id="input" placeholder="输入消息...（Enter 发送，Shift + Enter 换行）"></textarea><button class="send" id="sendBtn">›</button></div>
          </div>
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="hint">可以保存多个模型提供方；每个提供方下面可以填多个模型。聊天页点“模型”就能切换，下一条消息立即使用选中的模型。</div>
          <div id="presetList" class="preset-list"></div>
          <button class="btn" id="addPreset" type="button">＋ 添加提供方</button>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    function toast(text){ const s=$('#status'); if(!s)return; s.textContent=text; s.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>s.classList.remove('show'),1800); }
    function escapeHTML(s){ return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

    function escapeAttr(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

    function ensureRenderStyle(){
      if(document.getElementById('daotianRenderStyle')) return;
      const style=document.createElement('style');
      style.id='daotianRenderStyle';
      style.textContent = `
        .assistant-render{max-width:min(720px,88%);padding:2px 2px;line-height:1.78;font-size:15px;color:var(--text);background:transparent;border:0;box-shadow:none;word-break:break-word;overflow-wrap:anywhere;}
        .assistant-render p{margin:.25em 0 .72em;}
        .assistant-render p:last-child{margin-bottom:0;}
        .assistant-render h1,.assistant-render h2,.assistant-render h3{margin:1em 0 .45em;line-height:1.35;font-weight:700;}
        .assistant-render h1{font-size:1.28em}.assistant-render h2{font-size:1.18em}.assistant-render h3{font-size:1.08em}
        .assistant-render ul,.assistant-render ol{margin:.45em 0 .8em;padding-left:1.35em;}
        .assistant-render li{margin:.18em 0;}
        .assistant-render blockquote{margin:.65em 0;padding:.2em .9em;border-left:3px solid rgba(127,127,127,.32);color:var(--muted);}
        .assistant-render code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:rgba(127,127,127,.12);border-radius:6px;padding:.08em .32em;}
        .assistant-render pre{margin:.7em 0;padding:12px 13px;border-radius:14px;background:rgba(127,127,127,.10);border:1px solid rgba(127,127,127,.14);overflow:auto;-webkit-overflow-scrolling:touch;white-space:pre;}
        .assistant-render pre code{background:transparent;padding:0;border-radius:0;white-space:pre;}
        .assistant-render a{color:inherit;text-decoration:underline;text-underline-offset:3px;}
        .assistant-render table{border-collapse:collapse;margin:.7em 0;display:block;overflow:auto;max-width:100%;}
        .assistant-render th,.assistant-render td{border:1px solid rgba(127,127,127,.22);padding:6px 9px;}
        .assistant-render .math-block{overflow-x:auto;overflow-y:hidden;margin:.7em 0;padding:.15em 0;}
        .assistant-render .html-preview-frame{width:100%;min-height:240px;border:1px solid rgba(127,127,127,.18);border-radius:14px;background:white;margin:.55em 0;}
        .assistant-render details{margin:.55em 0;}
        .assistant-render summary{cursor:pointer;color:var(--muted);font-size:13px;margin-bottom:.35em;}
        .assistant-render .mermaid{background:rgba(255,255,255,.04);border-radius:14px;padding:12px;overflow:auto;}
        @media (max-width:760px){.assistant-render{max-width:calc(100vw - 36px);font-size:15px}.assistant-render .html-preview-frame{min-height:210px}}
      `;
      document.head.appendChild(style);
    }

    function renderInlineMarkdown(text){
      let html = escapeHTML(text);
      html = html.replace(/`([^`]+)`/g, function(_m, code){ return '<code>' + code + '</code>'; });
      html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
      html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
      html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return html;
    }

    function renderMarkdownText(text){
      const lines = String(text || '').split('\n');
      let out = '';
      let list = null;
      let para = [];
      function flushPara(){
        if(para.length){
          out += '<p>' + renderInlineMarkdown(para.join('\n')).replace(/\n/g,'<br>') + '</p>';
          para = [];
        }
      }
      function closeList(){ if(list){ out += '</' + list + '>'; list = null; } }
      lines.forEach(function(line){
        if(/^\s*$/.test(line)){ flushPara(); closeList(); return; }
        const heading = line.match(/^(#{1,3})\s+(.+)$/);
        if(heading){ flushPara(); closeList(); const level=heading[1].length; out += '<h'+level+'>'+renderInlineMarkdown(heading[2])+'</h'+level+'>'; return; }
        const quote = line.match(/^>\s?(.+)$/);
        if(quote){ flushPara(); closeList(); out += '<blockquote>'+renderInlineMarkdown(quote[1])+'</blockquote>'; return; }
        const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
        if(bullet){ flushPara(); if(list !== 'ul'){ closeList(); list='ul'; out += '<ul>'; } out += '<li>'+renderInlineMarkdown(bullet[1])+'</li>'; return; }
        const ordered = line.match(/^\s*\d+[.)]\s+(.+)$/);
        if(ordered){ flushPara(); if(list !== 'ol'){ closeList(); list='ol'; out += '<ol>'; } out += '<li>'+renderInlineMarkdown(ordered[1])+'</li>'; return; }
        closeList();
        para.push(line);
      });
      flushPara(); closeList();
      return out;
    }

    function renderAssistantContent(raw){
      ensureRenderStyle();
      const text = String(raw || '');
      const re = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
      let out = '';
      let last = 0;
      let match;
      while((match = re.exec(text))){
        out += renderMarkdownText(text.slice(last, match.index));
        const lang = (match[1] || '').trim().toLowerCase();
        const code = match[2] || '';
        const safeCode = escapeHTML(code);
        if(lang === 'mermaid'){
          out += '<pre class="mermaid">' + safeCode + '</pre>';
        }else if(lang === 'html' || lang === 'svg'){
          const srcdoc = lang === 'svg' ? '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;place-items:center;min-height:100vh">' + code + '</body>' : code;
          out += '<iframe class="html-preview-frame" sandbox="allow-scripts allow-same-origin" srcdoc="' + escapeAttr(srcdoc) + '"></iframe>';
          out += '<details><summary>源码</summary><pre><code class="language-' + escapeAttr(lang) + '">' + safeCode + '</code></pre></details>';
        }else{
          out += '<pre><code class="language-' + escapeAttr(lang || 'text') + '">' + safeCode + '</code></pre>';
        }
        last = re.lastIndex;
      }
      out += renderMarkdownText(text.slice(last));
      out = out.replace(/<p>\s*\$\$([\s\S]*?)\$\$\s*<\/p>/g, '<div class="math-block">$$$1$$</div>');
      return out || '';
    }

    let enhanceTimer = null;
    function scheduleEnhanceRender(){
      clearTimeout(enhanceTimer);
      enhanceTimer = setTimeout(function(){
        const box = document.getElementById('messages');
        if(!box) return;
        try{
          if(window.MathJax && window.MathJax.typesetPromise){ window.MathJax.typesetPromise([box]).catch(function(){}); }
        }catch(_e){}
        try{
          if(window.mermaid && window.mermaid.run){ window.mermaid.run({nodes: box.querySelectorAll('.mermaid')}).catch(function(){}); }
        }catch(_e){}
      }, 220);
    }

    function ensureThinkingStyle(){
      if(document.getElementById('daotianThinkingStyle')) return;
      const style=document.createElement('style');
      style.id='daotianThinkingStyle';
      style.textContent = `
        .daotian-thinking{display:inline-flex;align-items:center;gap:8px;max-width:min(720px,88%);padding:2px 2px;line-height:1.75;font-size:15px;color:var(--muted,currentColor);opacity:.72;background:transparent;border:0;box-shadow:none}
        .daotian-thinking-mark{width:18px;height:18px;display:inline-grid;place-items:center;font-size:17px;line-height:1;transform-origin:50% 50%;animation:daotianThinkingSpin 1.25s cubic-bezier(.42,0,.18,1) infinite, daotianThinkingPulse 1.25s ease-in-out infinite}
        .daotian-thinking-text{font-size:14px;letter-spacing:.02em;animation:daotianThinkingText 1.45s ease-in-out infinite}
        @keyframes daotianThinkingSpin{0%{transform:rotate(0deg) scale(.94)}55%{transform:rotate(260deg) scale(1.04)}100%{transform:rotate(360deg) scale(.94)}}
        @keyframes daotianThinkingPulse{0%,100%{opacity:.38}50%{opacity:.95}}
        @keyframes daotianThinkingText{0%,100%{opacity:.52}50%{opacity:.86}}
      `;
      document.head.appendChild(style);
    }

    function ensureModelStyle(){
      if(document.getElementById('daotianModelStyle')) return;
      const style=document.createElement('style');
      style.id='daotianModelStyle';
      style.textContent = `
        .model-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .model-switcher{position:relative;display:inline-flex}
        .model-pill{max-width:190px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .model-menu{display:none;position:absolute;left:0;bottom:calc(100% + 8px);z-index:80;width:min(280px,calc(100vw - 42px));padding:8px;border-radius:18px;background:var(--panel,#15171a);border:1px solid var(--border,rgba(255,255,255,.10));box-shadow:0 18px 50px rgba(0,0,0,.28)}
        .model-menu.show{display:block}
        .model-menu-item{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;border:0;background:transparent;color:var(--text);border-radius:12px;padding:10px 11px;text-align:left;font:inherit;cursor:pointer}
        .model-menu-item:hover,.model-menu-item.active{background:rgba(127,127,127,.12)}
        .model-menu-title{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .model-menu-sub{display:block;font-size:11px;color:var(--muted);margin-top:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .model-menu-check{opacity:.75;flex:0 0 auto}
        .model-menu-manage{margin-top:6px;border-top:1px solid var(--border,rgba(255,255,255,.10));padding-top:6px}
        .preset-list{display:flex;flex-direction:column;gap:12px}
        .preset-card{border:1px solid var(--border,rgba(127,127,127,.18));border-radius:18px;padding:14px;background:rgba(127,127,127,.06)}
        .preset-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;color:var(--text)}
        .preset-card-title{font-weight:600;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .preset-del{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;padding:4px 8px;border-radius:10px}
        .preset-del:hover{background:rgba(127,127,127,.12);color:var(--text)}
        textarea.provider-models{min-height:82px;resize:vertical;line-height:1.45;font-family:inherit}
        @media (max-width:760px){.model-toolbar{gap:7px}.model-pill{max-width:142px}.model-menu{width:min(260px,calc(100vw - 36px))}#providerModal .modal{max-height:88vh}#providerModal .modal-body{max-height:calc(88vh - 112px);overflow:auto;-webkit-overflow-scrolling:touch}.preset-card .row{display:block}.preset-card .field{margin-bottom:10px}}
      `;
      document.head.appendChild(style);
    }

    function ensureMobileKeyboardStyle(){
      if(document.getElementById('daotianMobileKeyboardStyle')) return;
      const style=document.createElement('style');
      style.id='daotianMobileKeyboardStyle';
      style.textContent = `
        @media (max-width:900px){
          body.keyboard-open{overflow:hidden!important;overscroll-behavior:none!important;}
          body.keyboard-open #app{position:fixed!important;left:0!important;top:var(--app-top,0px)!important;width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;transform:none!important;}
          body.keyboard-open .app-shell{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;}
          body.keyboard-open .main{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:0!important;display:flex!important;flex-direction:column!important;overflow:hidden!important;}
          body.keyboard-open .messages{flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:14px 18px 10px!important;scroll-padding-bottom:18px!important;}
          body.keyboard-open .composer-wrap{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;flex:0 0 auto!important;width:100vw!important;z-index:100!important;transform:none!important;padding:8px 14px calc(8px + env(safe-area-inset-bottom))!important;background:linear-gradient(to top,var(--bg) 88%,rgba(0,0,0,0))!important;}
          body.keyboard-open .search-toggle{display:none!important;}
          body.keyboard-open .empty{display:none!important;}
          body.keyboard-open .floating-menu,body.keyboard-open .top-actions{opacity:0!important;pointer-events:none!important;}
          body.keyboard-open .sidebar:not(.closed){transform:translateX(-105%)!important;opacity:0!important;pointer-events:none!important;}
        }
      `;
      document.head.appendChild(style);
    }



    function renderSidebar(){
      const side = $('#sidebar'); if(!side) return;
      side.classList.toggle('closed', !sidebarOpen);
      $('#openSide').style.display = sidebarOpen ? 'none' : 'grid';
      const list = $('#chatList');
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span><button class="delete-chat" data-del="${escapeHTML(c.id)}" title="删除">×</button></div>`).join('');
    }
    function pickEmptyPrompt(){
      const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate();
      return emptyPrompts[seed % emptyPrompts.length];
    }

    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><svg class="empty-logo empty-logo-gamma" viewBox="0 0 120 120" aria-hidden="true"><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(function(m){
        const content = escapeHTML(m.content);
        if(m.role === 'user'){
          return `<div class="message user"><div class="bubble">${content}</div></div>`;
        }
        if(m.role === 'error'){
          return `<div class="message assistant"><div style="max-width:min(720px,88%);padding:12px 14px;border-radius:14px;line-height:1.65;white-space:pre-wrap;font-size:14px;color:#c96f66;background:rgba(196,80,70,.10);border:1px solid rgba(196,80,70,.22)">${content}</div></div>`;
        }
        if(m.thinking && !m.content){
          ensureThinkingStyle();
          return `<div class="message assistant"><div class="daotian-thinking"><span class="daotian-thinking-mark" aria-hidden="true">✺</span><span class="daotian-thinking-text">想一下</span></div></div>`;
        }
        return `<div class="message assistant"><div class="assistant-render">${renderAssistantContent(m.content)}</div></div>`;
      }).join('');
      scheduleEnhanceRender();
      box.scrollTop = box.scrollHeight;
    }
    function renderModelSwitcher(){
      ensureModelStyle();
      const btn = $('#modelBtn');
      const menu = $('#modelMenu');
      const current = activePreset();
      if(btn) btn.textContent = ((current && current.label) || (current && current.model) || '模型') + ' ▾';
      if(menu){
        const presets = modelPresets();
        menu.innerHTML = presets.map(function(p){
          const active = p.id === settings.activePresetId;
          return `<button class="model-menu-item ${active?'active':''}" data-model-preset="${escapeHTML(p.id)}"><span class="model-menu-title">${escapeHTML(p.label || p.model)}<span class="model-menu-sub">${escapeHTML((p.providerName||'') + ' · ' + (p.model||''))}</span></span><span class="model-menu-check">${active?'✓':''}</span></button>`;
        }).join('') + `<div class="model-menu-manage"><button class="model-menu-item" id="manageModels" type="button"><span class="model-menu-title">管理模型配置<span class="model-menu-sub">一个提供方多个模型</span></span><span class="model-menu-check">›</span></button></div>`;
      }
    }

    function closeModelMenu(){ const menu=$('#modelMenu'); if(menu) menu.classList.remove('show'); }

    function renderAll(){
      document.documentElement.setAttribute('data-theme', theme);
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      const themeBtn = $('#themeBtn'); if(themeBtn) themeBtn.textContent = theme === 'dark' ? '☾' : '☀';
      renderSidebar(); renderMessages(); renderModelSwitcher(); persist();
    }

    function createChat(){ const id=uid(); chats.unshift({id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; sidebarOpen=true; renderAll(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      renderAll(); toast('已删除');
    }

    function buildOpenAIURL(preset){ const cfg=preset||activePreset(); const base=(cfg.baseUrl||'').replace(/\/$/,''); const path=cfg.path||'/v1/chat/completions'; if(!base) return '/v1/chat/completions'; if(base.endsWith('/v1') && path.startsWith('/v1/')) return base + path.slice(3); return base + (path.startsWith('/') ? path : '/' + path); }
    function extractDelta(data){
      const choice = data && data.choices && data.choices[0];
      if(choice && choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
      if(choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
      if(data && typeof data.content === 'string') return data.content;
      if(data && Array.isArray(data.content)){
        return data.content.map(function(part){ return part && part.text ? part.text : ''; }).join('');
      }
      return '';
    }

    function extractFullContent(data){
      return data.choices?.[0]?.message?.content ||
        data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ||
        (typeof data.content === 'string' ? data.content : '') ||
        data.content?.[0]?.text ||
        '';
    }

    async function callModel(messages, onDelta, preset){
      const cfg = preset || activePreset();
      if((cfg.providerType||'openai') !== 'openai') throw new Error('Gemini / Anthropic 已保存，但还需要后端转发适配。当前先用 OpenAI 兼容接口。');
      const headers={'Content-Type':'application/json'}; if(cfg.apiKey) headers.Authorization='Bearer '+cfg.apiKey;
      const body={model:cfg.model||'deepseek-chat',messages:messages.map(m=>({role:m.role,content:m.content})),stream:true};
      let targetUrl = buildOpenAIURL(cfg);
      if(searchOn){
        targetUrl = '/chat';
        body.webSearch = true;
        body.search = true;
        body.frontendUpstream = {
          providerType: cfg.providerType || 'openai',
          providerName: cfg.providerName || cfg.label || '当前模型',
          baseUrl: cfg.baseUrl || '',
          apiKey: cfg.apiKey || '',
          requestPath: cfg.path || '/v1/chat/completions',
          path: cfg.path || '/v1/chat/completions',
          model: cfg.model || 'deepseek-chat'
        };
      }
      const fetchHeaders = searchOn ? {'Content-Type':'application/json'} : headers;
      const res=await fetch(targetUrl,{method:'POST',headers:fetchHeaders,body:JSON.stringify(body)});
      if(!res.ok){ const txt=await res.text(); throw new Error(txt.slice(0,400)||('HTTP '+res.status)); }

      if(!res.body){
        const txt=await res.text();
        try{ const data=JSON.parse(txt); return extractFullContent(data) || JSON.stringify(data).slice(0,1000); }catch(e){ return txt; }
      }

      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      let raw='';
      let full='';
      let streamError='';

      function consumeLine(line){
        const trimmed=line.trim();
        if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        const payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{
          const data=JSON.parse(payload);
          const delta=extractDelta(data);
          if(delta){
            full += delta;
            if(onDelta) onDelta(delta, full);
          }else if(data && (data.error || data.message) && !full){
            streamError = String(data.message || data.error || '请求失败');
          }
        }catch(_e){}
        return false;
      }

      while(true){
        const read=await reader.read();
        if(read.done) break;
        const chunk=decoder.decode(read.value,{stream:true});
        raw += chunk;
        buffer += chunk;
        let index;
        while((index=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,index);
          buffer=buffer.slice(index+1);
          if(consumeLine(line)) return full;
        }
      }
      buffer += decoder.decode();
      if(buffer.trim()) consumeLine(buffer);
      if(streamError && !full) throw new Error(streamError);
      if(full) return full;

      try{
        const data=JSON.parse(raw);
        return extractFullContent(data) || JSON.stringify(data).slice(0,1000);
      }catch(_e){
        return raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim();
      }
    }
    async function sendMessage(){
      if(sending) return; const input=$('#input'); const text=(input.value||'').trim(); if(!text) return; const c=activeChat();
      c.messages.push({role:'user',content:text}); if(!c.title || c.title==='新对话') c.title=text.slice(0,28); c.updatedAt=Date.now(); input.value=''; sending=true; $('#sendBtn').disabled=true;
      const cfg = activePreset();
      const requestMessages=c.messages.filter(m=>m.role==='user'||m.role==='assistant'||m.role==='system').map(m=>({role:m.role,content:m.content}));
      const assistant={role:'assistant',content:'',thinking:true,model:cfg.model,provider:cfg.providerName,modelLabel:cfg.label};
      c.messages.push(assistant);
      renderAll();
      try{
        const finalText=await callModel(requestMessages, function(delta){
          if(assistant.thinking) assistant.thinking=false;
          assistant.content += delta;
          c.updatedAt=Date.now();
          renderMessages();
        }, cfg);
        assistant.thinking=false;
        if(!assistant.content.trim()) assistant.content=finalText || '没有返回内容';
      }catch(err){
        assistant.thinking=false;
        assistant.role='error';
        assistant.content='请求失败：'+(err&&err.message?err.message:String(err));
      }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
    }

    function providerTemplate(provider, index){
      provider = normalizeProvider(provider, index);
      return `<div class="preset-card" data-provider-id="${escapeHTML(provider.id)}">
        <div class="preset-card-head"><div class="preset-card-title">${escapeHTML(provider.providerName || '模型提供方')}</div><button class="preset-del" type="button" data-provider-delete="${escapeHTML(provider.id)}">删除</button></div>
        <div class="row"><div class="field"><label>提供方名称</label><input data-provider-field="providerName" value="${escapeHTML(provider.providerName)}" placeholder="DeepSeek / 小米 / OpenAI"></div><div class="field"><label>提供方类型</label><select data-provider-field="providerType"><option value="openai" ${provider.providerType==='openai'?'selected':''}>OpenAI 兼容</option><option value="gemini" ${provider.providerType==='gemini'?'selected':''}>Gemini</option><option value="anthropic" ${provider.providerType==='anthropic'?'selected':''}>Anthropic</option></select></div></div>
        <div class="field"><label>Base URL</label><input data-provider-field="baseUrl" value="${escapeHTML(provider.baseUrl)}" placeholder="https://api.deepseek.com"></div>
        <div class="field"><label>API Key</label><input data-provider-field="apiKey" type="password" value="${escapeHTML(provider.apiKey)}" placeholder="sk-... / AIza... / anthropic key"></div>
        <div class="field"><label>请求路径</label><input data-provider-field="path" value="${escapeHTML(provider.path)}" placeholder="/v1/chat/completions"></div>
        <div class="field"><label>可用模型（一行一个）</label><textarea class="provider-models" data-provider-field="models" placeholder="deepseek-chat\ndeepseek-reasoner">${escapeHTML(provider.models.join('\n'))}</textarea></div>
      </div>`;
    }

    function renderProviderEditor(){
      ensureModelStyle();
      const box = $('#presetList');
      if(!box) return;
      settings = ensureSettingsShape(settings);
      box.innerHTML = settings.modelProviders.map(providerTemplate).join('');
    }

    function collectProviderEditor(){
      const cards = Array.from(document.querySelectorAll('[data-provider-id]'));
      const providers = cards.map(function(card, i){
        function val(name){ const el = card.querySelector('[data-provider-field="'+name+'"]'); return el ? el.value.trim() : ''; }
        return normalizeProvider({
          id: card.getAttribute('data-provider-id') || makeProviderId(val('providerName'), val('baseUrl'), i),
          providerType: val('providerType'), providerName: val('providerName'), baseUrl: val('baseUrl'),
          apiKey: val('apiKey'), path: val('path'), models: splitModels(val('models'))
        }, i);
      }).filter(p=>p.models && p.models.length);
      if(!providers.length) providers.push(normalizeProvider(defaultSettings,0));
      settings.modelProviders = providers;
      settings.modelPresets = providersToPresets(providers);
      if(!settings.activePresetId || !settings.modelPresets.some(p=>p.id===settings.activePresetId)) settings.activePresetId = settings.modelPresets[0].id;
      syncLegacySettings();
    }

    function openSettings(){ settings=ensureSettingsShape(settings); renderProviderEditor(); $('#providerModal').classList.add('show'); }
    function closeSettings(){ $('#providerModal').classList.remove('show'); }
    function saveSettings(){ collectProviderEditor(); persist(); renderModelSwitcher(); closeSettings(); toast('已保存'); }

    document.addEventListener('click', e=>{
      const presetBtn = e.target.closest('[data-model-preset]');
      if(presetBtn){ settings.activePresetId = presetBtn.getAttribute('data-model-preset'); syncLegacySettings(); persist(); renderModelSwitcher(); closeModelMenu(); toast('已切换模型'); return; }
      const manage = e.target.closest('#manageModels');
      if(manage){ closeModelMenu(); openSettings(); return; }
      if(e.target.closest('#modelBtn')){ const menu=$('#modelMenu'); if(menu){ renderModelSwitcher(); menu.classList.toggle('show'); } return; }
      if(!e.target.closest('.model-switcher')) closeModelMenu();
      const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); if(window.innerWidth<760) sidebarOpen=false; renderAll(); }
      const providerDel=e.target.closest('[data-provider-delete]');
      if(providerDel){
        collectProviderEditor();
        const id=providerDel.getAttribute('data-provider-delete');
        settings.modelProviders=settings.modelProviders.filter(p=>p.id!==id);
        if(!settings.modelProviders.length) settings.modelProviders=[normalizeProvider(defaultSettings,0)];
        settings.modelPresets=providersToPresets(settings.modelProviders);
        if(!settings.modelPresets.some(p=>p.id===settings.activePresetId)) settings.activePresetId=settings.modelPresets[0].id;
        renderProviderEditor();
      }
    });
    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();}; $('#openSide').onclick=()=>{sidebarOpen=true;renderAll();}; $('#newChat').onclick=createChat; $('#themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#openProvider').onclick=openSettings; $('#closeProvider').onclick=closeSettings; $('#cancelProvider').onclick=closeSettings; $('#saveProvider').onclick=saveSettings;
    $('#addPreset').onclick=()=>{ collectProviderEditor(); const n=settings.modelProviders.length+1; settings.modelProviders.push(normalizeProvider({id:'p_custom_'+Date.now(),providerType:'openai',providerName:'新提供方 '+n,baseUrl:'',apiKey:'',path:'/v1/chat/completions',models:['']}, n)); renderProviderEditor(); };
    $('#searchBtn').onclick=()=>{searchOn=!searchOn; $('#searchBtn').classList.toggle('active',searchOn); $('#searchBtn').textContent=searchOn?'● 联网搜索':'○ 联网搜索';}; $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });


    function setupMobileViewport(){
      try{
        ensureMobileKeyboardStyle();
        const root = document.documentElement;
        const appEl = document.getElementById('app');
        const input = $('#input');
        const messagesBox = $('#messages');
        if(!root || !appEl || !input || !messagesBox) return;

        let timer = null;
        let keyboardActive = false;
        let lastHeight = 0;
        let lastTop = 0;

        function isMobile(){
          return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 900;
        }

        function metrics(){
          const vv = window.visualViewport;
          const height = vv && vv.height ? vv.height : window.innerHeight;
          const top = vv && typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
          return {height: Math.max(320, Math.round(height)), top: Math.max(0, Math.round(top))};
        }

        function setVars(m){
          lastHeight = m.height;
          lastTop = m.top;
          root.style.setProperty('--app-height', m.height + 'px');
          root.style.setProperty('--app-top', m.top + 'px');
        }

        function scrollLatest(){
          requestAnimationFrame(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} });
          setTimeout(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} }, 80);
          setTimeout(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} }, 260);
          setTimeout(function(){ try{ messagesBox.scrollTop = messagesBox.scrollHeight; }catch(_e){} }, 520);
        }

        function applyViewport(){
          if(!isMobile()){
            keyboardActive = false;
            document.body.classList.remove('keyboard-open');
            root.style.removeProperty('--app-height');
            root.style.removeProperty('--app-top');
            return;
          }

          const focused = document.activeElement === input;
          const m = metrics();
          setVars(m);

          document.body.classList.toggle('keyboard-open', focused);
          keyboardActive = focused;

          if(focused){
            if(sidebarOpen){ sidebarOpen = false; renderSidebar(); }
            try{ window.scrollTo(0, 0); }catch(_e){}
            scrollLatest();
          }
        }

        function schedule(delay){
          clearTimeout(timer);
          timer = setTimeout(applyViewport, delay || 30);
        }

        input.addEventListener('focus', function(){
          schedule(0);
          setTimeout(applyViewport, 80);
          setTimeout(applyViewport, 180);
          setTimeout(applyViewport, 360);
          setTimeout(applyViewport, 650);
        });

        input.addEventListener('blur', function(){
          setTimeout(function(){
            keyboardActive = false;
            document.body.classList.remove('keyboard-open');
            root.style.setProperty('--app-top','0px');
            applyViewport();
          }, 180);
        });

        input.addEventListener('input', function(){ schedule(20); scrollLatest(); });
        window.addEventListener('resize', function(){ schedule(20); }, {passive:true});
        window.addEventListener('orientationchange', function(){ setTimeout(applyViewport, 260); }, {passive:true});

        if(window.visualViewport){
          window.visualViewport.addEventListener('resize', function(){ schedule(keyboardActive ? 5 : 25); }, {passive:true});
          window.visualViewport.addEventListener('scroll', function(){ schedule(keyboardActive ? 5 : 25); }, {passive:true});
        }

        setInterval(function(){
          if(!keyboardActive) return;
          const m = metrics();
          if(Math.abs(m.height - lastHeight) > 2 || Math.abs(m.top - lastTop) > 2) applyViewport();
        }, 180);

        applyViewport();
      }catch(_err){}
    }



    renderAll();
    setupMobileViewport();
  }catch(err){
    emergency(err && err.stack ? err.stack : err);
  }
})();
