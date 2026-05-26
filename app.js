(function(){
  'use strict';
  window.__DAOTIAN_THINKING_VERSION__ = 'v3.6.0-semantic-memory';

  function emergency(message){
    var app = document.getElementById('app');
    if(!app) return;
    app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f5f2ea;color:#2a2824;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;padding:24px">' +
      '<div style="max-width:520px;width:100%;background:#fff;border:1px solid rgba(90,78,62,.18);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(70,55,35,.12)">' +
      '<h2 style="margin:0 0 10px;font-size:22px">稻田 Ai 已进入救援模式</h2>' +
      '<p style="line-height:1.7;color:#827a70;margin:0 0 16px">页面没有丢。只是旧缓存数据可能损坏，已拦截白屏。</p>' +
      '<pre style="white-space:pre-wrap;background:#f7f3ec;border-radius:14px;padding:12px;font-size:12px;color:#655b52;max-height:160px;overflow:auto">' + String(message||'unknown').replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]);}) + '</pre>' +
      '<button id="resetDaotian" style="height:42px;border:0;border-radius:14px;background:#DC8062;color:white;padding:0 16px;font:inherit;cursor:pointer">清理本地聊天缓存并恢复</button>' +
      '</div></div>';
    var btn = document.getElementById('resetDaotian');
    if(btn) btn.onclick = function(){
      try{
        Object.keys(localStorage).forEach(function(k){ if(k.indexOf('daotian')===0) localStorage.removeItem(k); });
      }catch(e){}
      location.reload();
    };
  }

  var NON_FATAL_PATTERNS = [
    /showAttachPreview/i, /attachPreview/i, /_attachments/i, /addAttachment/i,
    /openPlusMenu/i, /closePlusMenu/i, /togglePlusMenu/i, /attach/i,
    /preview/i, /file preview/i, /image preview/i
  ];
  function isNonFatalError(msg){
    var s = String(msg || '');
    for(var i=0; i<NON_FATAL_PATTERNS.length; i++){
      if(NON_FATAL_PATTERNS[i].test(s)) return true;
    }
    return false;
  }
  window.addEventListener('error', function(e){
    var msg = e.message || e.error || 'script error';
    if(isNonFatalError(msg)){ console.warn('[non-fatal]', msg); return; }
    emergency(msg);
  });
  window.addEventListener('unhandledrejection', function(e){
    var msg = (e.reason && e.reason.message) || e.reason || 'promise error';
    if(isNonFatalError(msg)){ console.warn('[non-fatal promise]', msg); return; }
    emergency(msg);
  });

  try{
    const $ = (sel, root=document) => root.querySelector(sel);
    const uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

    const KEYS = {
      chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323',
      oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
      v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322',
      modelParams:'daotian.modelParams.v1',
      personalization:'daotian.personalization.v1',
      memories:'daotian.memories.v1',
      memoryCandidates:'daotian.memoryCandidates.v1',
      autoExtract:'daotian.autoExtract.v1',
      memoryGlobal:'daotian.memoryGlobal.v1',
      tokenDisplay:'daotian.tokenDisplay.v1',
      autoScroll:'daotian.autoScroll.v1',
      themeMode:'daotian.themeMode.v1',
      thinkingDepth:'daotian.thinkingDepth.v1'
    };

    const defaultSettings = { providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions' };
    const defaultModelParams = { temperature:0.7, top_p:1, max_tokens:0, presence_penalty:0, frequency_penalty:0, stream:true, systemPrompt:'', memoryInjection:true };
    const defaultPersonalization = { enabled:false, content:'' };

    function loadModelParamsMap(){
      const m = readJSON(KEYS.modelParams, {});
      if(typeof m !== 'object' || !m) return {};
      Object.keys(m).forEach(function(k){ if(!m[k] || typeof m[k] !== 'object') delete m[k]; });
      return m;
    }
    function getModelParams(presetId){
      const map = loadModelParamsMap();
      return map[presetId] ? Object.assign({}, defaultModelParams, map[presetId]) : Object.assign({}, defaultModelParams);
    }
    function setModelParams(presetId, params){
      const map = loadModelParamsMap();
      map[presetId] = Object.assign({}, defaultModelParams, params || {});
      saveJSON(KEYS.modelParams, map);
    }
    function loadPersonalization(){
      return Object.assign({}, defaultPersonalization, readJSON(KEYS.personalization, {}));
    }
    function savePersonalization(p){
      saveJSON(KEYS.personalization, { enabled:!!p.enabled, content:String(p.content||'') });
    }
    function loadMemories(){
      const arr = readJSON(KEYS.memories, []);
      return Array.isArray(arr) ? arr.filter(function(m){ return m && typeof m.content === 'string'; }) : [];
    }
    function saveMemories(arr){
      saveJSON(KEYS.memories, Array.isArray(arr) ? arr : []);
    }
    function loadMemoryGlobal(){
      var v = readJSON(KEYS.memoryGlobal, null);
      if(v === true || v === false) return v;
      return true;
    }
    function saveMemoryGlobal(v){
      saveJSON(KEYS.memoryGlobal, v === true);
    }
    function loadAutoExtract(){
      return readJSON(KEYS.autoExtract, true) === true;
    }
    function saveAutoExtract(v){
      saveJSON(KEYS.autoExtract, v === true);
    }
    function loadTokenDisplay(){
      return readJSON(KEYS.tokenDisplay, true) === true;
    }
    function saveTokenDisplay(v){
      saveJSON(KEYS.tokenDisplay, v === true);
    }
    function loadAutoScroll(){
      return readJSON(KEYS.autoScroll, true) === true;
    }
    function saveAutoScroll(v){
      saveJSON(KEYS.autoScroll, v === true);
    }
    function loadThinkingDepth(){
      var v = safeGet(KEYS.thinkingDepth);
      if(v === 'off' || v === 'low' || v === 'medium' || v === 'high' || v === 'extreme') return v;
      return 'medium';
    }
    function saveThinkingDepth(v){ setItem(KEYS.thinkingDepth, v); }
    function loadThemeMode(){
      var v = safeGet(KEYS.themeMode);
      if(v === 'light' || v === 'dark' || v === 'system') return v;
      return 'system';
    }
    function saveThemeMode(m){ setItem(KEYS.themeMode, m); }
    function resolveTheme(){
      var mode = loadThemeMode();
      if(mode === 'light') return 'light';
      if(mode === 'dark') return 'dark';
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    function loadMemoryCandidates(){
      const arr = readJSON(KEYS.memoryCandidates, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveMemoryCandidates(arr){
      saveJSON(KEYS.memoryCandidates, Array.isArray(arr) ? arr : []);
    }
    function exportModelParamsBody(presetId, existingBody){
      const p = getModelParams(presetId);
      if(typeof existingBody !== 'object' || !existingBody) existingBody = {};
      if(p.temperature !== undefined && p.temperature !== null) existingBody.temperature = p.temperature;
      if(p.top_p !== undefined && p.top_p !== null) existingBody.top_p = p.top_p;
      if(p.max_tokens > 0) existingBody.max_tokens = p.max_tokens;
      if(p.presence_penalty !== undefined && p.presence_penalty !== null) existingBody.presence_penalty = p.presence_penalty;
      if(p.frequency_penalty !== undefined && p.frequency_penalty !== null) existingBody.frequency_penalty = p.frequency_penalty;
      return existingBody;
    }

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

    let theme = resolveTheme();
    let settings = ensureSettingsShape(Object.assign({}, defaultSettings, readJSON(KEYS.settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {}));
    let chats = loadChats();
    let activeId = safeGet(KEYS.active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
    let sidebarOpen = true;
    let searchOn = false;
    let sending = false;
    let thinkingDepth = loadThinkingDepth();
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
    function persist(){ syncLegacySettings(); saveJSON(KEYS.chats,chats); setItem(KEYS.active,activeId); saveJSON(KEYS.settings,settings); }

    const app = $('#app');
    if(!app) throw new Error('#app not found');
    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><span style="font-size:14px;color:var(--muted)">历史对话</span></div>
          <div class="chat-list" id="chatList"></div>
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openProvider">设置 / 模型提供方</button><button class="side-bottom-btn" id="openAdvanced">高级设置</button></div>
        </aside>
        <main class="main">
          <div class="chat-topbar" id="chatTopbar">
            <button class="home-menu-button" id="openSide" title="展开侧边栏"><span></span><span></span><span></span></button>
            <button class="model-top-trigger" id="modelTopTrigger" title="切换模型"><span id="modelTopLabel">...</span><span class="chevron">▾</span></button>
            <div class="model-popover" id="modelPopover"></div>
            <button class="top-new-chat-btn" id="topNewChatBtn" title="新建对话"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="composer">
              <button class="plus-btn" id="plusBtn" title="添加附件">+</button>
              <textarea id="input" placeholder="输入消息..."></textarea>
              <button class="send" id="sendBtn">›</button>
            </div>
            <div class="attach-preview" id="attachPreview" style="display:none"></div>
          </div>
          <div class="plus-menu" id="plusMenu" style="display:none">
            <button class="plus-menu-item" data-action="camera"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照</button>
            <button class="plus-menu-item" data-action="image"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>添加图片</button>
            <button class="plus-menu-item" data-action="file"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>添加文件</button>
            <button class="plus-menu-item" data-action="search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg>联网搜索</button>
            <div class="plus-menu-item thinking-depth-row" data-action="thinking">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <span>思考深度</span>
              <span class="thinking-depth-val" id="thinkingDepthVal">中</span>
              <span class="thinking-depth-arrow">▾</span>
            </div>
            <div class="thinking-depth-pills" id="thinkingDepthPills" style="display:none">
              <button class="td-pill" data-depth="off">关</button>
              <button class="td-pill" data-depth="low">低</button>
              <button class="td-pill active" data-depth="medium">中</button>
              <button class="td-pill" data-depth="high">高</button>
              <button class="td-pill" data-depth="extreme">极限</button>
            </div>
          </div>
          <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none">
          <input type="file" id="imageInput" accept="image/*" style="display:none">
          <input type="file" id="fileInput" style="display:none">
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="hint">可以保存多个模型提供方；每个提供方下面可以填多个模型。聊天页点"模型"就能切换，下一条消息立即使用选中的模型。</div>
          <div id="presetList" class="preset-list"></div>
          <button class="btn" id="addPreset" type="button">＋ 添加提供方</button>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="modal-backdrop" id="advancedModal"><div class="modal" style="max-width:780px">
        <div class="modal-head"><span>高级设置</span><button class="icon-btn" id="closeAdvanced">×</button></div>
        <div class="modal-body" id="advancedBody"></div>
        <div class="modal-foot"><button class="btn" id="closeAdvancedBtn">关闭</button></div>
      </div></div>
      <div class="modal-backdrop" id="memoryEditModal"><div class="modal" style="max-width:520px">
        <div class="modal-head"><span id="memoryEditTitle">编辑记忆</span><button class="icon-btn" id="closeMemoryEdit">×</button></div>
        <div class="modal-body">
          <div class="field"><label>记忆内容</label><textarea id="memoryEditContent" rows="4" style="resize:vertical;min-height:80px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit;width:100%"></textarea></div>
          <div class="field"><label>标签（逗号分隔）</label><input id="memoryEditTags" placeholder="学习, 项目, 偏好, 生活, 人格" style="height:46px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:0 14px;outline:0;font:inherit;width:100%"></div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelMemoryEdit">取消</button><button class="btn primary" id="saveMemoryEdit">保存</button></div>
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
        .assistant-render{max-width:min(720px,88%);padding:2px 2px;line-height:1.65;font-size:15px;font-weight:400;color:var(--text);background:transparent;border:0;box-shadow:none;word-break:break-word;overflow-wrap:anywhere;}
        .assistant-render p{margin:.4em 0 .65em;}
        .assistant-render p:last-child{margin-bottom:0;}
        .assistant-render h1,.assistant-render h2,.assistant-render h3{margin:1em 0 .45em;line-height:1.35;font-weight:700;}
        .assistant-render h1{font-size:1.28em}.assistant-render h2{font-size:1.18em}.assistant-render h3{font-size:1.08em}
        .assistant-render ul,.assistant-render ol{margin:.45em 0 .8em;padding-left:1.35em;}
        .assistant-render li{margin:.18em 0;}
        .assistant-render blockquote{margin:.65em 0;padding:.2em .9em;border-left:3px solid rgba(127,127,127,.32);color:var(--muted);}
        .assistant-render code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.92em;background:rgba(127,127,127,.12);border-radius:6px;padding:.08em .32em;}
        .assistant-render pre{margin:.7em 0;padding:12px 13px;border-radius:14px;background:rgba(127,127,127,.10);border:1px solid rgba(127,127,127,.14);overflow:auto;-webkit-overflow-scrolling:touch;white-space:pre;}
        .assistant-render pre code{background:transparent;padding:0;border-radius:0;white-space:pre;}
        .assistant-render hr{border:0;height:1px;background:var(--line);margin:1em 0;opacity:.6}
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
        if(/^\s{0,3}([-*_])\s*\1\s*\1[\s\1]*$/.test(line)){ flushPara(); closeList(); out += '<hr>'; return; }
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
        .daotian-thinking-mark{width:8px;height:8px;border-radius:50%;background:var(--accent);display:inline-block;animation:daotianDotPulse 1.6s ease-in-out infinite}
        .daotian-thinking-text{font-size:14px;letter-spacing:.02em;animation:daotianThinkingText 1.45s ease-in-out infinite}
        @keyframes daotianDotPulse{0%,100%{opacity:.3;transform:scale(.8)}50%{opacity:.95;transform:scale(1.25)}}
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
        .preset-list{display:flex;flex-direction:column;gap:12px}
        .preset-card{border:1px solid var(--border,rgba(127,127,127,.18));border-radius:18px;padding:14px;background:rgba(127,127,127,.06)}
        .preset-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;color:var(--text)}
        .preset-card-title{font-weight:600;font-size:14px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .preset-del{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;padding:4px 8px;border-radius:10px}
        .preset-del:hover{background:rgba(127,127,127,.12);color:var(--text)}
        textarea.provider-models{min-height:82px;resize:vertical;line-height:1.45;font-family:inherit}
        @media (max-width:760px){.model-menu{width:min(260px,calc(100vw - 36px))}#providerModal .modal{max-height:88vh}#providerModal .modal-body{max-height:calc(88vh - 112px);overflow:auto;-webkit-overflow-scrolling:touch}.preset-card .row{display:block}.preset-card .field{margin-bottom:10px}}
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
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span>${(c.messages&&c.messages.length)?'<button class="delete-chat" data-del="'+escapeHTML(c.id)+'" title="删除">×</button>':''}</div>`).join('');
    }
    function pickEmptyPrompt(){
      const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate();
      return emptyPrompts[seed % emptyPrompts.length];
    }

    function formatTokens(n){
      if(n >= 1000){ var v = (n/1000).toFixed(1); if(v.endsWith('.0')) v = v.slice(0,-2); return v + 'k'; }
      return String(n);
    }
    function renderTokenUsage(m){
      if(!loadTokenDisplay()) return '';
      if(m.role !== 'assistant' || !m.content) return '';
      var usage = m.usage;
      if(!usage){
        return '<div class="usage-footer">Token：API 未返回</div>';
      }
      var parts = [];
      var input = usage.prompt_tokens || usage.input_tokens || 0;
      if(input) parts.push('输入 ' + formatTokens(input));
      var output = usage.completion_tokens || usage.output_tokens || 0;
      if(output) parts.push('输出 ' + formatTokens(output));
      var cache = usage.cache_read_input_tokens || usage.cache_creation_input_tokens || usage.cached_tokens || 0;
      if(cache) parts.push('缓存 ' + formatTokens(cache));
      var total = usage.total_tokens || (input + output) || 0;
      if(!parts.length && total) parts.push('总计 ' + formatTokens(total));
      var text = parts.length ? 'Tokens：' + parts.join('｜') : 'Token：API 未返回';
      return '<div class="usage-footer">' + text + '</div>';
    }

    function formatMsgTime(ts){
      if(!ts) return '';
      var d = new Date(ts);
      var h = d.getHours(), m = d.getMinutes();
      return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
    }
    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><div class="brand-main-row"><svg class="empty-logo" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="3"/><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="brand-name">稻田 AI</div></div><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(function(m){
        const content = escapeHTML(m.content);
        var timeHtml = m.time ? '<div class="msg-time">'+formatMsgTime(m.time)+'</div>' : '';
        if(m.role === 'user'){
          return '<div class="message user"><div class="bubble">'+timeHtml+content+'</div></div>';
        }
        if(m.role === 'error'){
          return '<div class="message assistant"><div style="max-width:min(720px,88%);padding:12px 14px;border-radius:14px;line-height:1.65;white-space:pre-wrap;font-size:14px;color:#c96f66;background:rgba(196,80,70,.10);border:1px solid rgba(196,80,70,.22)">'+content+'</div></div>';
        }
        if(m.thinking && !m.content){
          ensureThinkingStyle();
          var label = m.memoryNotice ? '记忆已更新' : '想一下';
          return '<div class="message assistant"><div class="daotian-thinking"><span class="daotian-thinking-mark memory-dot" aria-hidden="true"></span><span class="daotian-thinking-text">'+label+'</span></div></div>';
        }
        return '<div class="message assistant"><div><div class="assistant-render">'+renderAssistantContent(m.content)+'</div>'+renderTokenUsage(m)+timeHtml+'</div></div>';
      }).join('');
      scheduleEnhanceRender();
      if(loadAutoScroll()) box.scrollTop = box.scrollHeight;
    }
    function friendlyModelName(model){
      if(!model) return '...';
      var map={'deepseek-chat':'DeepSeek Chat','deepseek-v4-flash':'DeepSeek Flash','deepseek-reasoner':'DeepSeek Reasoner','gemini-2.5-flash':'Gemini Flash','gemini-2.5-pro':'Gemini Pro','gpt-4o':'GPT-4o','gpt-4o-mini':'GPT-4o Mini','claude-sonnet-4-6':'Claude Sonnet','claude-opus-4-7':'Claude Opus'};
      return map[model] || model;
    }
    function hasUsableModelConfig(){
      var current = activePreset();
      if(!current) return false;
      if(!current.apiKey || !current.apiKey.trim()) return false;
      if(!current.baseUrl || !current.baseUrl.trim()) return false;
      if(!current.model || !current.model.trim()) return false;
      return true;
    }

    /* Model capability detection */
    var VISION_MODEL_PATTERNS = [
      /gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /gpt-4-vision/i,
      /claude/i, /gemini/i, /vision/i, /vl/i, /multimodal/i,
      /qwen-vl/i, /glm-4v/i, /yi-vision/i, /llava/i,
      /pixtral/i, /llama.*vision/i, /bakllava/i, /cogvlm/i
    ];
    var TEXT_ONLY_MODEL_PATTERNS = [
      /deepseek/i, /qwen(?!.*vl)/i, /glm(?!.*4v)/i, /yi(?!.*vision)/i,
      /llama(?!.*vision)/i, /mistral/i, /mixtral/i, /phi/i,
      /gemma/i, /command/i, /openchat/i, /zephyr/i
    ];

    function modelSupportsVision(modelName){
      if(!modelName) return false;
      for(var i=0; i<VISION_MODEL_PATTERNS.length; i++){
        if(VISION_MODEL_PATTERNS[i].test(modelName)) return true;
      }
      for(var j=0; j<TEXT_ONLY_MODEL_PATTERNS.length; j++){
        if(TEXT_ONLY_MODEL_PATTERNS[j].test(modelName)) return false;
      }
      return false; // default: no vision
    }

    /* Text file extensions readable by FileReader */
    var TEXT_EXTENSIONS = ['txt','md','csv','json','js','html','css','py','java','cpp','c','h','rb','go','rs','ts','tsx','jsx','xml','yaml','yml','toml','ini','cfg','log','sh','bash','zsh','sql','r','m','swift','kt','scala','lua','pl','php'];
    var IMAGE_EXTENSIONS = ['png','jpg','jpeg','webp','gif','bmp'];
    var SUPPORTED_BINARY = ['pdf','docx','xlsx'];
    function renderModelSwitcher(){
      ensureModelStyle();
      var current = activePreset();
      var label = $('#modelTopLabel');
      var usable = hasUsableModelConfig();
      var hasModel = current && current.model;
      if(label){ label.textContent = usable ? friendlyModelName(current.model) : '请先添加模型'; label.title = usable ? ((current && current.label) || current.model) : '请先添加模型'; }
      var popover = $('#modelPopover');
      if(popover){
        var presets = modelPresets();
        if(!presets.length || !usable){
          popover.innerHTML = '<div style="padding:16px 12px;text-align:center;font-size:14px;opacity:.56">尚未配置模型，请先在设置中添加模型提供方</div><div class="model-popover-divider"></div><button class="model-option" id="manageModels"><span class="model-option-check">›</span><span><div class="model-option-title">管理模型配置</div><div class="model-option-subtitle">添加模型提供方</div></span></button>';
        }else{
          popover.innerHTML = presets.map(function(p){
            var active = p.id === settings.activePresetId;
            return '<button class="model-option'+(active?' selected':'')+'" data-model-preset="'+escapeHTML(p.id)+'"><span class="model-option-check">'+(active?'✓':'')+'</span><span><div class="model-option-title">'+escapeHTML(p.label||p.model)+'</div><div class="model-option-subtitle">'+escapeHTML((p.providerName||'')+' · '+(p.model||''))+'</div></span></button>';
          }).join('') + '<div class="model-popover-divider"></div><button class="model-option" id="manageModels"><span class="model-option-check">›</span><span><div class="model-option-title">管理模型配置</div><div class="model-option-subtitle">一个提供方多个模型</div></span></button>';
        }
      }
    }

    function openModelPopover(){ var p=$('#modelPopover'); if(p){ renderModelSwitcher(); p.classList.add('open'); } var t=$('#modelTopTrigger'); if(t) t.setAttribute('aria-expanded','true'); }
    function closeModelPopover(){ var p=$('#modelPopover'); if(p) p.classList.remove('open'); var t=$('#modelTopTrigger'); if(t) t.setAttribute('aria-expanded','false'); }
    function toggleModelPopover(){ if(!hasUsableModelConfig()){ openSettings(); return; } var p=$('#modelPopover'); if(p && p.classList.contains('open')) closeModelPopover(); else openModelPopover(); }
    function closeModelMenu(){ closeModelPopover(); }

    function renderAll(){
      theme = resolveTheme();
      document.documentElement.setAttribute('data-theme', theme);
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      if(sidebarOpen) closeModelPopover();
      renderSidebar(); renderMessages(); renderModelSwitcher(); persist();
    }

    function createChat(){ var empty=chats.find(function(c){ return !c.messages || !c.messages.length; }); if(empty){ activeId=empty.id; }else{ var id=uid(); chats.unshift({id:id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; } safeClearAttachments(); sidebarOpen=false; renderAll(); }
    function startNewChat(){ createChat(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      safeClearAttachments(); renderAll(); toast('已删除');
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
      const body={model:cfg.model||'deepseek-chat',messages:messages.map(m=>({role:m.role,content:m.content})),stream:true,stream_options:{include_usage:true}};
      exportModelParamsBody(cfg.id, body);
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
        try{ const data=JSON.parse(txt); var nc = extractFullContent(data) || JSON.stringify(data).slice(0,1000); return { content: nc, usage: data.usage || null }; }catch(e){ return { content: txt, usage: null }; }
      }

      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      let raw='';
      let full='';
      let streamError='';
      let capturedUsage = null;

      function consumeLine(line){
        const trimmed=line.trim();
        if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        const payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{
          const data=JSON.parse(payload);
          if(data.usage) capturedUsage = data.usage;
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
          if(consumeLine(line)) return { content: full, usage: capturedUsage };
        }
      }
      buffer += decoder.decode();
      if(buffer.trim()) consumeLine(buffer);
      if(streamError && !full) throw new Error(streamError);
      if(full) return { content: full, usage: capturedUsage };

      try{
        const data=JSON.parse(raw);
        return { content: extractFullContent(data) || JSON.stringify(data).slice(0,1000), usage: capturedUsage || (data.usage || null) };
      }catch(_e){
        return { content: raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(), usage: capturedUsage };
      }
    }
    async function sendMessage(){
      if(sending) return; var input=$('#input'); var text=(input.value||'').trim();
      var hasAttachments = _attachments && _attachments.length > 0;
      if(!text && !hasAttachments) return;
      if(!hasUsableModelConfig()){ toast('请先添加模型'); openSettings(); return; }
      var cfg = activePreset();

      /* Check image attachments vs model capability */
      if(hasAttachments){
        var hasImages = false;
        for(var ai=0; ai<_attachments.length; ai++){
          if(isImageFile(_attachments[ai].name)){ hasImages = true; break; }
        }
        if(hasImages && !modelSupportsVision(cfg.model)){
          toast('当前模型不支持图片阅读，请切换支持图片的模型');
          return;
        }
      }

      var c=activeChat();
      /* Build display text with file content */
      var fileContentText = '';
      var displayText = text || '';
      if(hasAttachments){
        var fileNames = [];
        for(var afi=0; afi<_attachments.length; afi++){
          var a = _attachments[afi];
          fileNames.push(a.name);
          if(a.content && isTextFile(a.name)){
            var contentPreview = a.content;
            var maxLen = a.name.match(/\.(csv|json)$/i) ? 4000 : 2000;
            if(contentPreview.length > maxLen){ contentPreview = contentPreview.slice(0,maxLen) + '\n...（文件较大，已截断）'; }
            fileContentText += '\n\n--- 附件：' + a.name + ' ---\n' + contentPreview;
          }else if(a.dataUrl && isImageFile(a.name)){
            fileContentText += '\n[图片：' + a.name + ']';
          }else if(isBinaryFile(a.name)){
            fileContentText += '\n[文件：' + a.name + '（将在服务器端解析）]';
          }else{
            fileContentText += '\n[文件：' + a.name + ']';
          }
        }
        if(!displayText) displayText = '请查看以下文件内容';
        displayText += fileContentText;
      }
      c.messages.push({role:'user',content:displayText,time:Date.now(),files:hasAttachments?_attachments.slice():undefined}); if(!c.title || c.title==='新对话') c.title=(text||'文件对话').slice(0,28); c.updatedAt=Date.now(); input.value=''; input.style.height='44px'; input.style.overflowY='hidden'; sending=true; $('#sendBtn').disabled=true;
      try{ if(!window.__MEMORY_V3_INIT__) MEMORY_V3.init(); }catch(_e){}
      var cfg = activePreset();
      var params = getModelParams(cfg.id);
      var sysParts = [];
      if(params && params.systemPrompt && params.systemPrompt.trim()){
        sysParts.push(params.systemPrompt.trim());
      }
      var personalization = loadPersonalization();
      if(personalization.enabled && personalization.content.trim()){
        sysParts.push('【用户偏好】\n' + personalization.content.trim());
      }
      if(params && params.memoryInjection !== false && loadMemoryGlobal()){
        var memories = loadMemories().filter(function(m){ return m.enabled !== false; });
        if(memories.length){
          var sorted = memories.slice().sort(function(a,b){ return (b.updatedAt||0) - (a.updatedAt||0); });
          var memTexts = sorted.map(function(m, i){ return (i+1)+'. '+(m.content||'').slice(0,500); }).filter(Boolean);
          if(memTexts.length){
            var memJoined = memTexts.join('\n');
            if(memJoined.length > 4000) memJoined = memJoined.slice(0,4000) + '\n...（部分记忆因长度限制未注入）';
            sysParts.push('【长期记忆】\n以下是跨聊天保存的长期记忆：\n' + memJoined);
          }
        }
      }
      var systemText = sysParts.join('\n\n');
      if(systemText.trim()){
        systemText = systemText.trim();
        if(systemText.length > 6000) systemText = systemText.slice(0,6000);
      }
      var requestMessages=c.messages.filter(m=>m.role==='user'||m.role==='assistant'||m.role==='system').map(m=>({role:m.role,content:m.content}));

      /* Handle vision: convert last user message to content array if we have images */
      if(hasAttachments){
        var imageAtts = [];
        for(var ai2=0; ai2<_attachments.length; ai2++){
          if(_attachments[ai2].dataUrl && isImageFile(_attachments[ai2].name)) imageAtts.push(_attachments[ai2]);
        }
        if(imageAtts.length > 0 && modelSupportsVision(cfg.model)){
          var lastUserIdx = -1;
          for(var ri=requestMessages.length-1; ri>=0; ri--){
            if(requestMessages[ri].role === 'user'){ lastUserIdx = ri; break; }
          }
          if(lastUserIdx >= 0){
            var visionContent = [{type:'text', text: text || '请分析以下图片'}];
            for(var vi=0; vi<imageAtts.length; vi++){
              visionContent.push({type:'image_url', image_url:{url:imageAtts[vi].dataUrl}});
            }
            requestMessages[lastUserIdx] = {role:'user', content:visionContent};
          }
        }
      }
      if(systemText.trim()){
        requestMessages.unshift({role:'system', content:systemText});
      }
      var willExtract = loadAutoExtract() && quickExtract(text);
      var assistant={role:'assistant',content:'',thinking:true,model:cfg.model,provider:cfg.providerName,modelLabel:cfg.label,usage:null,time:Date.now(),memoryNotice:!!willExtract};
      c.messages.push(assistant);
      renderAll();
      var memoryNoticeTimer = null;

      /* Inject thinking depth as system prompt (works for both direct API and /chat proxy) */
      if(thinkingDepth !== 'off'){
        var tdMap = {
          low:'【思考深度：低】请快速判断，直接回答，减少展开。',
          medium:'【思考深度：中】请在准确性和简洁性之间平衡。',
          high:'【思考深度：高】请更仔细地分析问题，检查关键条件，避免遗漏。',
          extreme:'【思考深度：极限】请在回答前充分分析任务、约束、边界情况和潜在错误，给出更稳妥的结果。'
        };
        var tdPrompt = tdMap[thinkingDepth] || '';
        if(tdPrompt){
          var sysIdx = -1;
          for(var si=0; si<requestMessages.length; si++){
            if(requestMessages[si].role === 'system'){ sysIdx = si; break; }
          }
          if(sysIdx >= 0){
            requestMessages[sysIdx] = {role:'system', content: requestMessages[sysIdx].content + '\n\n' + tdPrompt};
          }else{
            requestMessages.unshift({role:'system', content: tdPrompt});
          }
        }
      }

      /* Build request body */
      var body={model:cfg.model||'deepseek-chat',messages:requestMessages,stream:true,stream_options:{include_usage:true},thinkingDepth:thinkingDepth};
      exportModelParamsBody(cfg.id, body);
      if(searchOn){
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

      try{
        var result=await callModelWithBody(requestMessages, body, cfg, function(delta){
          if(assistant.thinking){
            assistant.thinking=false;
            if(assistant.memoryNotice){
              renderMessages();
              memoryNoticeTimer = setTimeout(function(){
                assistant.memoryNotice = false;
                renderMessages();
              }, 1800);
            }
          }
          assistant.content += delta;
          c.updatedAt=Date.now();
          if(!assistant.memoryNotice) renderMessages();
        });
        /* Clear attachments after sending */
        _attachments = [];
        safeShowAttachPreview();
        clearTimeout(memoryNoticeTimer);
        assistant.memoryNotice = false;
        assistant.thinking=false;
        if(!assistant.content.trim()) assistant.content=result.content || '没有返回内容';
        assistant.usage = result.usage || null;
      }catch(err){
        _attachments = [];
        safeShowAttachPreview();
        clearTimeout(memoryNoticeTimer);
        assistant.memoryNotice = false;
        assistant.thinking=false;
        assistant.role='error';
        var errMsg = err&&err.message?err.message:String(err);
        /* Humanize common errors */
        if(errMsg.indexOf('model_required')>=0) errMsg = '请先选择模型后再发送';
        else if(errMsg.indexOf('Authentication')>=0||errMsg.indexOf('401')>=0) errMsg = '认证失败，请检查 API Key 或模型提供方配置';
        else if(errMsg.indexOf('rate_limit')>=0||errMsg.indexOf('429')>=0) errMsg = '请求太频繁，请稍后再试';
        else if(errMsg.indexOf('Failed to fetch')>=0||errMsg.indexOf('NetworkError')>=0) errMsg = '网络连接失败，请检查网络后重试';
        else if(errMsg.length > 200) errMsg = errMsg.slice(0,200) + '...';
        assistant.content = errMsg;
      }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
      if(willExtract){
        try{
          var _extracted = quickExtract(text);
          if(_extracted){
            var _mems = loadMemories();
            _mems.unshift({ id: uid(), content: _extracted, tags: [], createdAt: Date.now(), updatedAt: Date.now(), enabled: true });
            if(_mems.length > 200) _mems = _mems.slice(0,200);
            saveMemories(_mems);
          }
        }catch(_e){}
      }
    }

    async function callModelWithBody(requestMessages, body, cfg, onDelta){
      var fetchBody, fetchHeaders;
      if(searchOn){
        fetchBody = JSON.stringify(body);
        fetchHeaders = {'Content-Type':'application/json'};
      }else{
        fetchHeaders = {'Content-Type':'application/json'};
        if(cfg.apiKey) fetchHeaders.Authorization = 'Bearer '+cfg.apiKey;
        fetchBody = JSON.stringify(body);
      }
      var targetUrl = searchOn ? '/chat' : buildOpenAIURL(cfg);

      var res=await fetch(targetUrl,{method:'POST',headers:fetchHeaders,body:fetchBody});
      if(!res.ok){ var txt=await res.text(); throw new Error(txt.slice(0,400)||('HTTP '+res.status)); }

      if(!res.body){
        var txt2=await res.text();
        try{ var data2=JSON.parse(txt2); var nc = extractFullContent(data2) || JSON.stringify(data2).slice(0,1000); return { content: nc, usage: data2.usage || null }; }catch(e){ return { content: txt2, usage: null }; }
      }

      var reader=res.body.getReader();
      var decoder=new TextDecoder();
      var buffer='';
      var raw='';
      var full='';
      var streamError='';
      var capturedUsage = null;

      function consumeLine(line){
        var trimmed=line.trim();
        if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        var payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{
          var data=JSON.parse(payload);
          if(data.usage) capturedUsage = data.usage;
          var delta=extractDelta(data);
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
        var read=await reader.read();
        if(read.done) break;
        var chunk=decoder.decode(read.value,{stream:true});
        raw += chunk;
        buffer += chunk;
        var index;
        while((index=buffer.indexOf('\n'))>=0){
          var line=buffer.slice(0,index);
          buffer=buffer.slice(index+1);
          if(consumeLine(line)) return { content: full, usage: capturedUsage };
        }
      }
      buffer += decoder.decode();
      if(buffer.trim()) consumeLine(buffer);
      if(streamError && !full) throw new Error(streamError);
      if(full) return { content: full, usage: capturedUsage };

      try{
        var data3=JSON.parse(raw);
        return { content: extractFullContent(data3) || JSON.stringify(data3).slice(0,1000), usage: capturedUsage || (data3.usage || null) };
      }catch(_e2){
        return { content: raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(), usage: capturedUsage };
      }
    }

    /* ── 简化记忆提取：分类 → 直接存，不评分、不候选 ── */
    function quickExtract(text){
      var t = String(text||'').trim();
      if(t.length < 6) return null;
      if(/[?？]$/.test(t) || /^(?:什么|谁|哪|怎么|为什么|何时|如何)/.test(t)) return null;
      try{
        var cls = MEMORY_V3.classify(t);
        if(cls.is_trash || cls.is_sensitive || cls.is_temporary) return null;
        if(cls.explicit_request || cls.category === 'explicit_memory_request'){
          var cleaned = t.replace(/^(?:记住[这那我]?[条句话个]?|记[一着]?下[来]?|请[你]?[把]?)[!！。,\s]*/i, '').trim();
          return cleaned || t;
        }
        if(cls.category === 'stable_preference' || cls.category === 'instruction' || cls.category === 'boundary' || cls.category === 'project' || cls.category === 'dislike'){
          var obj = cls.subcategory === 'dislike' ? '用户不喜欢' : cls.subcategory === 'preference' ? '用户喜欢' : '';
          return obj ? obj + '：' + t : t;
        }
      }catch(_e){}
      return null;
    }

    /*
      语义化记忆系统（纯前端，不耗 token）
      核心：关键词是弱信号。语义分类 + 多维度评分决定是否写入。
      流程：分类 → 评分 → 决策（正式写入 / 候选 / 丢弃）
    */

    /* ── 强信号：用户明确要求记忆 ── */
    var EXPLICIT_MEMORY_PATTERNS = [
      /记住[这那]|记好[了]?|牢[记固][这那]/i,
      /以后[都就请要](?:按照|遵照|依据|根据|用|按着|按)/i,
      /以后[都就请要][别不]要[再又]/i,
      /加入记忆|写入记忆|保存[到]?记忆/i,
      /不要再犯[这那]个错误/i,
      /以后(?:禁止|不让|不允许|不能)[^，。\n]{0,20}/i,
      /这[个条]以后就是默认(?:规则|设置|配置|行为)/i,
      /把[这那][个条些]?(?:记下来|加入记忆|保存起来|记住|写入|存下来)/i,
      /(?:重要|关键)[的]?[：:]\s*.{0,20}(?:以后|今后|未来)/i,
      /这个以后(?:就|都|要)按(?:照|着)?/i,
      /默认(?:规则|流程|配置|设置|行为)[：:]\s*/i,
      /(?:以后|从今往后|接下来)[^，。\n]{0,10}(?:都|就)这样[吧来]?[。，!！]?$/i,
      /(?:以后|接下来)(?:每次|所有|全部)[^，。\n]{0,20}都[按照用按]/i
    ];

    /* ── 弱信号：模式 + 各维度权重（lt=long_term, fr=future_reuse, st=stability, sp=specificity） ── */
    var CONTEXT_WEIGHT_PATTERNS = [
      { pat: /我[的]?(?:叫|是|姓名|名字|昵称|外号|绰号|代号|人称|又名|全名)|大家都叫我|朋友们[都]?叫我/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我[的]?(?:住在|来自|家在|出生于|出生在|老家|现居|生活在|常驻|base[在]?)/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我(?:做[一]?[名位个]?|搞|干|从事|负责|任职[于]?|目前在|现[任]?|供职|就职|效力)(?:[^，。\n]{0,20})/i,
        wt: { lt:2, fr:2, st:1, sp:1 } },
      { pat: /我[的]?(?:职业|工作|专业|行业|领域|单位|公司|团队|部门|岗位|职位|头衔|职责|职能|背景|资历|经验|特长|擅长|技能|技术栈)[：:]/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我(?:最|特别|非常|超|挺|蛮|真的很|真的|尤其)?(?:喜欢|爱|热爱|钟爱|偏爱).{0,10}[是叫有为]/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
	      { pat: /我(?:最|特别|非常|很|尤其)?(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用|热爱|钟爱|偏爱|推荐)的[^，。\n]{0,10}(?:是|叫|为|有)/i,
	        wt: { lt:2, fr:1, st:2, sp:2 } },
	      { pat: /我(?:最|特别|真的|尤其)(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用).{1,20}/i,
	        wt: { lt:2, fr:2, st:2, sp:1 } },
      { pat: /我[的]?(?:习惯|日常|作息|生活规律|时间安排|日程|每天[必会]|每周[必会]|睡前|起床|早起|晚睡|熬夜|失眠)/i,
        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我喜欢[^，。\n]{1,30}/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
	      { pat: /我(?:每天早上|每天早晨|每天晚上|每天中午|每天下午|傍晚|深夜|凌晨|睡前|起床[后]?|醒来|下班[后]?|放学[后]?|周末|工作日|平时|空闲时)[^，。\n]{0,8}(?:习惯|喜欢|会|要|都|就|必须|经常|总是|从不)/i,
	        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我(?:不[吃喝用看听玩去]|从[不未]|戒[了]?|忌|过敏|受不了|不能[吃喝用看])/i,
        wt: { lt:1, fr:1, st:1, sp:1 } },
      { pat: /我(?:学|学习|读|攻读|研究|探索|钻研|深耕|进修|深造|备考|考研|考博|考证)/i,
        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我[的]?(?:项目|作品|产品|创业|开源|side[._]?project|副业)/i,
        wt: { lt:2, fr:2, st:1, sp:2 } },
      { pat: /我[的]?(?:目标|梦想|愿望|理想|志向|计划|规划|flag|人生目标)/i,
        wt: { lt:2, fr:1, st:1, sp:1 } },
      { pat: /(?:你[^，。\n]{0,8}[的]?[说搞弄]错[了]?|不是[这样那样]的|我纠正|更正一下|上次[的]?那个[是]?不对)/i,
        wt: { lt:3, fr:3, st:3, sp:2 } },
      { pat: /(?:以后|每次|每回|从今往后)[^，。\n]{0,20}(?:都|就|要|必须)/i,
        wt: { lt:2, fr:2, st:2, sp:1 } },
      { pat: /我一[向直]|我从来|我从不|我从未|我始终|我永远/i,
        wt: { lt:2, fr:2, st:3, sp:1 } },
      { pat: /(?:请[你]?注意|请注意|重要[提示通知]|特别提醒|关键[点在于])[：:]\s*/i,
        wt: { lt:2, fr:2, st:1, sp:1 } }
    ];

    /* ── 负面信号：应丢弃的内容 ── */
    var REJECT_PATTERNS = [
      { pat: /(?:今天|现在|刚才|刚刚)[^，。\n]{0,8}(?:很[烦累怒恼躁]|好[烦累怒]|有点[烦累]|气死[我了]?|累死[我了]?|烦死[我了]?)/i, tag:'mood' },
      { pat: /(?:这个东西|这个系统|这个网站|这电脑|这手机)[真太]?(?:垃圾|卡|慢|傻逼|难用|不好用)/i, tag:'rant' },
      { pat: /(?:帮我|替我把|给[我]?[改做写删加创建复制粘贴])/i, tag:'task' },
      { pat: /(?:现在|刚才|这次|目前)[^，。\n]{0,10}(?:显示|报|跳|弹|提示)(?:\d{2,3}|error|fail|404|50[0-9]|超时|无响应|没反应)/i, tag:'error_report' },
      { pat: /^.{1,5}$/, tag:'too_short' }
    ];

    /* ── 语义分类 ── */
    function classifyMemory(text){
      var t = text.trim();
      for(var i=0; i < EXPLICIT_MEMORY_PATTERNS.length; i++){ if(EXPLICIT_MEMORY_PATTERNS[i].test(t)) return 'explicit_memory_request'; }
      if(/(?:你[^，。\n]{0,8}[的]?[说搞弄]错[了]?|不是[这样那样]的|我纠正|更正一下)/i.test(t)) return 'correction_rule';
      if(/(?:不要[改删碰]|禁止修改|默认[配置设置]|稳定版本|可用版本)/i.test(t)) return 'project_rule';
      if(/我[^，。\n]{0,6}(?:叫|是|住在|来自|家在|从事|负责|任职|目前在|现[任]?)/i.test(t)) return 'long_term_background';
      if(/(?:学习|研究|项目|创业|开源|专业|进修|目标|计划|愿望|理想)/i.test(t)) return 'long_term_background';
      if(/(?:最|特别|非常|很|真的|尤其)[^，。\n]{0,8}(?:喜欢|爱|讨厌|怕|希望|想要)[^，。\n]{0,10}(?:是|有|叫)/i.test(t)) return 'stable_preference';
	      if(/(?:最|特别|真的|尤其)(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用)/i.test(t)) return 'stable_preference';
      if(/我喜欢[^，。\n]{1,30}/i.test(t)) return 'stable_preference';
      if(/(?:每天|每周|每月|习惯|通常|一般|平时|经常|从不|从未|作息|规律|总是|每回|每次)/i.test(t)) return 'stable_preference';
      if(/(?:现在|今天|刚才|刚刚)[^，。\n]{0,6}(?:很|好|有点|感觉)[^，。\n]{0,10}$/i.test(t) && !/(?:以后|每天|每周|习惯|总是|从不|每次)/i.test(t)) return 'temporary_state';
      if(/^.{1,10}$/i.test(t)) return 'casual_chat';
      return 'casual_chat';
    }

    /* ── 多维度评分 ── */
    function scoreMemory(text, category){
      var s = { explicit_request:0, long_term:0, future_reuse:0, stability:0, specificity:0, sensitivity_risk:0, triviality:0, confidence:0, category:category, temporary_state:false, task_only:false, casual_chat:false };
      var t = text.trim(), len = t.length;

      if(category === 'explicit_memory_request') s.explicit_request = 1;
      if(category === 'temporary_state') s.temporary_state = true;
      if(category === 'task_only') s.task_only = true;
      if(category === 'casual_chat') s.casual_chat = true;

      /* 负面信号 */
      for(var i=0; i < REJECT_PATTERNS.length; i++){
        if(REJECT_PATTERNS[i].pat.test(t)){
          var tag = REJECT_PATTERNS[i].tag;
          if(tag === 'mood') s.temporary_state = true;
          if(tag === 'rant') s.triviality = Math.max(s.triviality, 3);
          if(tag === 'task' && !s.explicit_request) s.task_only = true;
          if(tag === 'error_report') s.task_only = true;
          if(tag === 'too_short') s.triviality = Math.max(s.triviality, 2);
        }
      }

      /* 弱信号加权 */
      for(var j=0; j < CONTEXT_WEIGHT_PATTERNS.length; j++){
        if(CONTEXT_WEIGHT_PATTERNS[j].pat.test(t)){
          var w = CONTEXT_WEIGHT_PATTERNS[j].wt;
          s.long_term = Math.max(s.long_term, w.lt);
          s.future_reuse = Math.max(s.future_reuse, w.fr);
          s.stability = Math.max(s.stability, w.st);
          s.specificity = Math.max(s.specificity, w.sp);
        }
      }

      /* 纠错提升 */
      if(category === 'correction_rule'){
        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2);
        s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
      }
      /* 项目规则提升 */
      if(category === 'project_rule'){
        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2);
        s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 2);
      }
      /* 长期背景提升 */
      if(category === 'long_term_background'){
	        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2); s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
        s.specificity = Math.max(s.specificity, 1);
      }
      /* 稳定偏好提升 */
      if(category === 'stable_preference'){
	        s.long_term = Math.max(s.long_term, 1); s.future_reuse = Math.max(s.future_reuse, 1); s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
      }

      /* 信息量 → confidence */
      var info = 0;
      if(len >= 6) info++; if(len >= 15) info++; if(len >= 30) info++;
      if(s.explicit_request) info += 2;
      if(category !== 'casual_chat' && category !== 'temporary_state' && category !== 'task_only') info++;
      if(info >= 4) s.confidence = 3; else if(info >= 2) s.confidence = 2; else if(info >= 1) s.confidence = 1;

      /* triviality：过长过短扣分 */
      if(s.triviality === 0){
        if(len < 4) s.triviality = 2; else if(len > 200) s.triviality = 1;
        if(/[0-9]/.test(t) || /[a-zA-Z]{3,}/.test(t) || /[：:""][^，。\n]{2,}/.test(t)) s.triviality = 0;
      }

      /* sensitivity_risk */
      if(/(?:密码|密钥|token|secret|password|api.?key|账号|银行|卡号|身份证|手机号|地址|电话)/i.test(t)) s.sensitivity_risk = 3;
      else if(/(?:收入|工资|薪水|家庭|感情|健康|疾病|医疗)/i.test(t)) s.sensitivity_risk = 2;
      else if(/(?:公司|项目|工作|代码|配置)/i.test(t)) s.sensitivity_risk = 1;

      return s;
    }

    /* ── 决策：是否正式写入 ── */
	    function shouldWriteMemory(s){
	      if(s.explicit_request){
	        if(s.sensitivity_risk >= 3 || s.triviality >= 3) return 'candidate';
	        return 'write';
	      }
	      var sum = s.long_term + s.future_reuse + s.stability + s.specificity;
	      if(sum >= 7 && s.confidence >= 2 && s.sensitivity_risk <= 1 && s.triviality <= 1 && !s.temporary_state && !s.task_only && !s.casual_chat) return 'write';
	      if(s.triviality >= 3) return 'discard';
	      if(s.temporary_state && sum < 3) return 'discard';
	      if(s.task_only) return 'discard';
	      if(s.casual_chat && sum === 0 && s.triviality > 0) return 'discard';
	      return 'candidate';
	    }

    /* ── 候选记忆：合并、证据计数 ── */
    function mergeCandidate(candidates, content, category){
      var now = Date.now();
      /* 找相似候选 */
      for(var i=0; i < candidates.length; i++){
        var c = candidates[i];
        var sim = contentSimilarity(c.content, content);
        if(sim >= 0.6){
          c.content = content.length > c.content.length ? content : c.content;
          c.evidenceCount = (c.evidenceCount || 1) + 1;
          c.lastSeenAt = now;
          c.confidence = Math.min(3, (c.confidence || 1) + 1);
          return;
        }
      }
      /* 找是否已存在正式记忆中 */
      var memories = loadMemories();
      for(var j=0; j < memories.length; j++){
        if(contentSimilarity(memories[j].content, content) >= 0.6) return; /* 已存在 */
      }
      /* 新增候选 */
      candidates.unshift({
        id: uid(), content: content, category: category || 'unknown',
        evidenceCount: 1, firstSeenAt: now, lastSeenAt: now,
        confidence: 1, sourceSummary: '系统自动提取'
      });
    }

    /* 内容相似度（简单字频重叠） */
    function contentSimilarity(a, b){
      if(!a || !b) return 0;
      if(a === b) return 1;
      var sa = a.slice(0, 60), sb = b.slice(0, 60);
      var short = sa.length <= sb.length ? sa : sb;
      var long = sa.length > sb.length ? sa : sb;
      var match = 0;
      for(var i=0; i < short.length; i++){
        if(long.indexOf(short[i]) >= 0) match++;
      }
      return match / long.length;
    }

    /* ── 清理过期候选 ── */
    function cleanupCandidates(){
      var candidates = loadMemoryCandidates();
      if(!candidates.length) return;
      var now = Date.now();
      var kept = [];
      for(var i=0; i < candidates.length; i++){
        var c = candidates[i];
        /* 超过7天且证据不足 → 删除 */
        if(now - c.lastSeenAt > 7*86400000 && (c.evidenceCount||1) < 2) continue;
        /* 超过30天 → 全部删除 */
        if(now - c.lastSeenAt > 30*86400000) continue;
        kept.push(c);
      }
      if(kept.length !== candidates.length) saveMemoryCandidates(kept);
    }

    /* ============================================================
       记忆引擎 v2 — 执行设计方案
       四阶段：摄取(Ingestion)→存储(Storage)→检索(Retrieval)→整合(Synthesis)
       语义向量 + IndexedDB + 实体提取 + 指代消解 + 隐含挖掘
       ============================================================ */
    var MEMORY_ENGINE = null;

    function initMemoryEngine(){
      if(MEMORY_ENGINE) return MEMORY_ENGINE;
      var engine = {};
      engine.ready = false;
      engine.modelLoaded = window.__HF && window.__HF.loaded === true;
      engine.db = null;

      /* IndexedDB 初始化（Dexie） */
      engine.initDB = function(){
        if(typeof Dexie === 'undefined') return null;
        try{
          var db = new Dexie('DaotianMemory');
          db.version(1).stores({
            memories: 'id, category, createdAt, updatedAt, enabled',
            candidates: 'id, category, firstSeenAt, lastSeenAt, evidenceCount',
            entities: '++id, name, type',
            conversationIndex: '++id, msgIndex, role, createdAt'
          });
          engine.db = db;
          return db;
        }catch(e){ return null; }
      };

      /* 向量嵌入（用 transformers.js） */
      engine.embed = async function(text){
        if(window.__HF && window.__HF.extractor){
          try{
            var r = await window.__HF.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(r.data);
          }catch(e){ return null; }
        }
        return null;
      };

      /* 余弦相似度 */
      engine.cosineSim = function(a, b){
        if(!a || !b || a.length !== b.length) return 0;
        var dot = 0, na = 0, nb = 0;
        for(var i=0; i<a.length; i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
      };

      /* 语义分类原型句子（各分类的语义代表） */
      var PROTOTYPES = {
        stable_preference: ['我喜欢吃苹果','我最爱蓝色','我平时喜欢跑步','周末我喜欢爬山','我习惯早起'],
        long_term_background: ['我是一名软件工程师','我住在北京','我在科技公司工作','我叫张三','我的专业是计算机'],
        correction_rule: ['你刚才说的不对','我纠正一下','不是这样的','你弄错了','更正一下'],
        project_rule: ['不要修改这个功能','默认配置不要动','稳定版本优先','不要删这个功能'],
        casual_chat: ['今天天气不错','你吃饭了吗','哈哈好好笑','好的没问题','晚安明天见']
      };
      engine._protoEmbs = null;

      engine._loadProtos = async function(){
        if(!engine.modelLoaded || engine._protoEmbs) return;
        var embs = {};
        for(var cat in PROTOTYPES){
          var arr = PROTOTYPES[cat];
          var sum = null;
          for(var i=0; i<arr.length; i++){
            var e = await engine.embed(arr[i]);
            if(e){
              if(!sum) sum = new Array(e.length).fill(0);
              for(var j=0; j<e.length; j++) sum[j] += e[j];
            }
          }
          if(sum){
            var len = Math.sqrt(sum.reduce(function(s,v){ return s+v*v; }, 0));
            for(var k=0; k<sum.length; k++) sum[k] /= (len + 1e-10);
            embs[cat] = sum;
          }
        }
        engine._protoEmbs = embs;
      };

      /* 语义分类（向量相似度 + softmax 概率） */
      engine.semanticClassify = async function(text){
        var regexCat = classifyMemory(text);
        if(regexCat === 'explicit_memory_request') return regexCat; /* 显式记忆请求直接确认 */
        if(!engine.modelLoaded || !engine._protoEmbs) return regexCat;
        var emb = await engine.embed(text);
        if(!emb) return regexCat;
        var bestCat = null, bestScore = 0;
        for(var cat in engine._protoEmbs){
          var sc = engine.cosineSim(emb, engine._protoEmbs[cat]);
          if(sc > bestScore){ bestScore = sc; bestCat = cat; }
        }
        return bestScore > 0.6 ? bestCat : regexCat;
      };

      /* 实体提取 */
      engine.extractEntities = function(text){
        var list = [];
        var patterns = [
          { type:'person_name', pat:/(?:我叫|我是|我的名字是|我叫作|我姓|我的名字叫|大家都叫我|朋友们叫我)([^，。\n]{1,12})/ },
          { type:'location', pat:/(?:我住在|我来自|我家在|我老家在|我出生于|出生在|现居|base在)([^，。\n]{1,20})/ },
          { type:'job', pat:/(?:我[是作当]?[一]?(?:名|位|个)?)([^，。\n]{1,20}(?:师|员|工|手|家|人|生))/ },
          { type:'organization', pat:/(?:我在|我就职于|我任职于|我供职于|我效力于|我目前在一|我现在的公司是|我的公司是|我的团队是)([^，。\n]{1,20})/ },
          { type:'preference_target', pat:/(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|推荐|钟爱|偏爱)([^，。\n]{1,20})(?:[，。]|$)/ },
          { type:'skill', pat:/(?:我[的]?(?:擅长|精通|熟练|掌握|技术栈是|技能是))([^，。\n]{1,20})/ }
        ];
        for(var i=0; i<patterns.length; i++){
          var m = text.match(patterns[i].pat);
          if(m) list.push({ type:patterns[i].type, value:m[1].trim() });
        }
        return list;
      };

      /* 指代消解（"第X条" / "这句话" / "上一条"） */
      engine.resolveReference = function(text, messages){
        if(!messages || !messages.length) return null;
        var refNum = text.match(/第(\d+)[条点则项步]/);
        if(refNum){
          var idx = parseInt(refNum[1]) - 1;
          for(var i=messages.length-1; i>=0; i--){
            if(messages[i].role === 'assistant'){
              var items = messages[i].content.split(/\d+\s*[.、）]/);
              if(items[idx+1]) return { type:'numbered_item', index:idx, content:items[idx+1].trim().slice(0,200), sourceIdx:i };
            }
          }
        }
        if(/这[句个条]|那[句个条]|上[一那]句/.test(text)){
          for(var j=messages.length-1; j>=0; j--){
            if(messages[j].role === 'assistant'){
              var sentences = messages[j].content.split(/[。！？\n]/).filter(Boolean);
              var last = sentences[sentences.length-1] || messages[j].content;
              return { type:'last_ai_message', content:last.trim().slice(0,200), sourceIdx:j };
            }
          }
        }
        return null;
      };

      /* 隐含信息挖掘（"这句话写得不错"→隐含偏好） */
      engine.mineImplicit = function(text){
        var pos = [
          { pat:/[^。，\n]{2,30}(?:不错|真好|很棒|很好|太好了|很喜欢|太好用了|真方便|真好看|很满意|很喜欢|真不错|确实好|真的很好)/ },
          { pat:/(?:最喜欢|最爱的|超喜欢|特别喜欢|真是太好)[^。，\n]{0,20}/ },
          { pat:/[^。，\n]{3,30}(?:很实用|很给力|很强大|很优雅|很简洁|很方便|很漂亮|很舒服|很流畅|很稳定)/ }
        ];
        for(var i=0; i<pos.length; i++){
          var m = text.match(pos[i].pat);
          if(m) return { implicit:true, sentiment:'positive', content:m[0].trim().slice(0,100), type:'stable_preference', confidence:0.6 };
        }
        var neg = [
          { pat:/[^。，\n]{2,30}(?:不好用|太难用|不好看|太丑|太慢|太卡|太复杂|不太好|不太喜欢|不喜欢|真差|不行)/ }
        ];
        for(var j=0; j<neg.length; j++){
          var n = text.match(neg[j].pat);
          if(n) return { implicit:true, sentiment:'negative', content:n[0].trim().slice(0,100), type:'stable_preference', confidence:0.5 };
        }
        return null;
      };

      /* 多策略检索（向量+关键词+实体+指代+时间） */
      engine.retrieve = async function(query, messages, limit){
        limit = limit || 10;
        var memories = loadMemories().filter(function(m){ return m.enabled !== false; });
        if(!memories.length) return [];
        var queryEmb = engine.modelLoaded ? await engine.embed(query) : null;
        var ref = engine.resolveReference(query, messages || []);
        var results = [];
        for(var i=0; i<memories.length; i++){
          var m = memories[i];
          var score = 0;
          if(queryEmb && m._embedding){
            var sim = engine.cosineSim(queryEmb, m._embedding);
            if(sim > 0.5) score += sim * 5;
          }
          var ml = (m.content||'').toLowerCase();
          if(ml.indexOf(query.toLowerCase()) >= 0) score += 4;
          if(ref && ml.indexOf(ref.content.slice(0,10)) >= 0) score += 5;
          var age = Date.now() - (m.updatedAt || m.createdAt || 0);
          if(age < 86400000) score += 2;
          else if(age < 604800000) score += 1;
          if(m.category === 'explicit_memory_request' || m.category === 'correction_rule') score += 2;
          if(score > 0) results.push({ memory:m, score:score });
        }
        results.sort(function(a,b){ return b.score - a.score; });
        return results.slice(0, limit);
      };

      /* 摄取管线：替代纯正则的 tryAutoExtractMemory */
      engine.ingest = async function(userText, messages){
        if(!loadAutoExtract()) return;
        var text = String(userText||'').trim();
        if(text.length < 6) return;

        var ref = engine.resolveReference(text, messages || []);
        var entities = engine.extractEntities(text);
        engine._lastEntities = entities;
        var implicit = engine.mineImplicit(text);
        var category = await engine.semanticClassify(text);
        var score = scoreMemory(text, category);

        if(entities.length){
          score.specificity = Math.min(score.specificity + 1, 3);
          score.confidence = Math.min(score.confidence + 1, 3);
        }
        if(implicit){ score.long_term += 1; score.future_reuse += 1; category = 'stable_preference'; }

        var decision = shouldWriteMemory(score);
        if(decision === 'discard'){
          if(implicit){
            var candContent = compressMemoryText(implicit.content);
            if(candContent.length > 6){
              var cands = loadMemoryCandidates();
              mergeCandidate(cands, candContent, 'stable_preference');
              if(cands.length > 100) cands = cands.slice(0,100);
              saveMemoryCandidates(cands);
              showCandidateConfirm(candContent);
            }
          }
          return;
        }

        var content = implicit ? compressMemoryText(implicit.content) : compressMemoryText(text);

        if(decision === 'write'){
          var memories = loadMemories();
          for(var i=0; i<memories.length; i++){
            if(contentSimilarity(memories[i].content, content) >= 0.6) return;
          }
          var tagList = [];
          entities.forEach(function(e){ if(tagList.indexOf(e.type)<0) tagList.push(e.type); });
          if(category === 'explicit_memory_request') tagList.push('用户指定');
          else if(category === 'correction_rule') tagList.push('纠错');
          else if(category === 'project_rule') tagList.push('项目规则');
          else if(category === 'stable_preference') tagList.push('偏好');
          else if(category === 'long_term_background') tagList.push('背景');
          else tagList.push('记忆');
          var newMem = {
            id:uid(), content:content, tags:tagList.length ? tagList : ['记忆'],
            category:category, createdAt:Date.now(), updatedAt:Date.now(), enabled:true,
            entities:entities, sourceRef:ref ? ref.type : null
          };
          if(engine.modelLoaded){
            var emb = await engine.embed(content);
            if(emb) newMem._embedding = emb;
          }
          memories.unshift(newMem);
          if(memories.length > 200) memories = memories.slice(0,200);
          saveMemories(memories);
          /* 同步到 IndexedDB */
          if(engine.db) try{ engine.db.memories.put(newMem).catch(function(){}); }catch(e){}
        }else{
          var candidates = loadMemoryCandidates();
          mergeCandidate(candidates, content, category);
          if(candidates.length > 100) candidates = candidates.slice(0,100);
          saveMemoryCandidates(candidates);
        }
        cleanupCandidates();
      };

      engine.initDB();
      if(engine.modelLoaded) engine._loadProtos();
      if(!engine.modelLoaded){
        var chk = setInterval(function(){
          if(window.__HF && window.__HF.loaded){
            engine.modelLoaded = true;
            engine._loadProtos();
            clearInterval(chk);
          }
        }, 2000);
      }
      engine.ready = true;
      MEMORY_ENGINE = engine;
      return engine;
    }

    /* 候选记忆确认弹窗 */
    function showCandidateConfirm(content){
      var el = document.getElementById('candidateToast');
      if(el) el.remove();
      var toast = document.createElement('div');
      toast.id = 'candidateToast';
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:200;background:var(--panel,#1a1c20);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;padding:12px 18px;box-shadow:0 12px 40px rgba(0,0,0,.3);max-width:min(420px,calc(100vw - 40px));font-size:13px;line-height:1.5;display:flex;flex-direction:column;gap:10px';
      toast.innerHTML = '<div style="color:var(--muted);font-size:12px">💡 发现候选记忆</div>' +
        '<div style="color:var(--text)">' + escapeHTML(content.slice(0,120)) + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button id="candConfirmBtn" style="border:0;border-radius:10px;background:var(--accent,#7aa89f);color:white;padding:6px 16px;font:inherit;font-size:12px;cursor:pointer">记住</button>' +
        '<button id="candRejectBtn" style="border:0;border-radius:10px;background:rgba(127,127,127,.15);color:var(--muted);padding:6px 16px;font:inherit;font-size:12px;cursor:pointer">忽略</button></div>';
      document.body.appendChild(toast);
      document.getElementById('candConfirmBtn').onclick = function(){
        var mem = loadMemories();
        mem.unshift({ id:uid(), content:content, tags:['隐含偏好'], category:'stable_preference', createdAt:Date.now(), updatedAt:Date.now(), enabled:true });
        saveMemories(mem);
        toast.remove();
        var cand = loadMemoryCandidates();
        for(var i=0; i<cand.length; i++){
          if(contentSimilarity(cand[i].content, content) >= 0.6){ cand.splice(i,1); break; }
        }
        saveMemoryCandidates(cand);
        toast('已保存');
      };
      document.getElementById('candRejectBtn').onclick = function(){ toast.remove(); toast('已忽略'); };
      setTimeout(function(){ var t=document.getElementById('candidateToast'); if(t) t.remove(); }, 6000);
    }

    /* ── 入口：每次用户发完消息后调用（增强版） ── */
    function tryAutoExtractMemory(userText){
      /* 初始化引擎（只在首次调用时） */
      if(!MEMORY_ENGINE) initMemoryEngine();
      /* 有引擎时走语义管线 */
      if(MEMORY_ENGINE && MEMORY_ENGINE.ready){
        MEMORY_ENGINE.ingest(userText, activeChat().messages);
        return;
      }
      /* 引擎未就绪时用原有正则方案 */
      if(!loadAutoExtract()) return;
      var text = String(userText||'').trim();
      if(text.length < 6) return;
      var category = classifyMemory(text);
      var score = scoreMemory(text, category);
      var decision = shouldWriteMemory(score);
      if(decision === 'discard') return;
      var content = compressMemoryText(text);
      if(decision === 'write'){
        var memories = loadMemories();
        for(var i=0; i<memories.length; i++){ if(contentSimilarity(memories[i].content, content) >= 0.6) return; }
        memories.unshift({
          id: uid(), content: content,
          tags: [category === 'explicit_memory_request' ? '用户指定' : category === 'correction_rule' ? '纠错' : category === 'project_rule' ? '项目规则' : category === 'stable_preference' ? '偏好' : category === 'long_term_background' ? '背景' : '记忆'],
          category: category, createdAt: Date.now(), updatedAt: Date.now(), enabled: true
        });
        if(memories.length > 200) memories = memories.slice(0,200);
        saveMemories(memories);
      }else{
        var candidates = loadMemoryCandidates();
        mergeCandidate(candidates, content, category);
        if(candidates.length > 100) candidates = candidates.slice(0,100);
        saveMemoryCandidates(candidates);
      }
      cleanupCandidates();
    }

    /* ── 压缩记忆文本：去语气词、去无意义前缀 ── */
    function compressMemoryText(text){
      var t = text.trim();
      /* 去开头"这个"、"那个"等无意义词 */
      t = t.replace(/^(?:这个|那个|这些|那些|一个|我的)[，,\s]*/i, '');
      /* 去末尾语气词 */
      t = t.replace(/[的啊了吗呢吧哈哦嗯哟][。，!！]?$/i, '');
      /* 去重复标点 */
      t = t.replace(/([。，！？!?])\1+/g, '$1');
      /* 提取关键部分：如果有"以后都"、"每次"等规则词，确保保留 */
      if(t.length > 200) t = t.slice(0, 200);
      return t.trim();
    }

/* ============================================================
   MemoryEngine v3 — 双层记忆系统
   独立区块，不改动任何现有函数。
   新数据流：提取 → 规范化 → 分类 → 评分 → 决策 → upsert/候选/丢弃
   ============================================================ */
   var MEMORY_V3 = (function(){
    /* ── 存储 key（不冲突旧 key） ── */
    var K = {
      memoriesV2:'daotian.memories.v2',
      candidatesV2:'daotian.memoryCandidates.v2',
      historyV2:'daotian.historyReferences.v2',
      logsV2:'daotian.memoryLogs.v2',
      settingsV2:'daotian.memorySettings.v2',
      migrationV2:'daotian.memoryMigration.v2'
    };

    /* ==============================================================
       模式银行（200+ 通用触发模式，不针对任何具体实体）
       按语义分组，每组按触发强度降序排列
       ============================================================== */

    /* ── A. 显式记忆请求（~25 模式） ── */
    var EXPLICIT_REQ = [
      /^记住[这那我]?[条句话个]?[!！。]?/m,
      /记[一着]?下[来]?[\s\S]{0,6}(?:记住|加入|写入|保存)/,
      /(?:请[你]?)?(?:把[这那])(?:个|条|句|些|段|话)?(?:记下来|加入记忆|保存起来|记住|写入|存下来)/,
      /(?:加入|写入|保存[到]?)记忆/i,
      /(?:别忘[了]?|切记|谨记|牢记|别忘了|不要忘)/i,
      /以后(?:都|就|请|要|必须|一定|千万|务必)[^，。\n]{0,6}(?:按照|遵照|依据|根据|按着|按|照|遵守|遵循)/i,
      /(?:从今往后|从现在开始|今后|接下来|以后|往后)[^，。\n]{0,8}(?:都|就|要|必须|一定|千万|务必)(?:按照|遵照|依据|根据|记住|注意|保持|以|遵守|遵循)/i,
      /(?:以后|每次|每回|每趟|从今往后)[^，。\n]{0,12}(?:都|就|要|必须|一定)(?:按|照|用|以|遵照)/i,
      /这[个条]以后(?:就|都|要|会)(?:作为|当成|当作|是|算|成为)/i,
      /这[个条]以后就(?:是|作为|当成|按)/i,
      /(?:以此为准|以此为据|以此为标准)/i,
      /(?:默认[规则流程配置设置行为])[\s\S]{0,20}(?:是|为|用|按)/i,
      /(?:设定|设置|配置)为[^，。\n]{2,20}[。]?$/m,
      /(?:请[你]?把)/i,
    ];

    /* ── B. 明确长期偏好（~40 模式） ── */
    var PREFERENCE_PAT = [
      /我(?:最|真的|特别|非常|超|挺|蛮|相当|极其|尤为|格外)?(?:喜欢|爱|热爱|钟爱|偏爱|欣赏|推崇|青睐|向往)[^，。\n]{2,40}/i,
      /我(?:真的|特别|非常|超|挺|蛮|相当|极其|真心|打心底)?觉得[^，。\n]{2,40}(?:不错|好听|好看|好用|好喝|好吃|好玩|棒|赞|好|可以|喜欢|满意|舒服|爽|合适)/i,
      /我心目中的[\\s]?(?:第?[一二三四五六七八九十]|No\\.?1|Number One|Top|首选|最爱|理想|最佳)/i,
      /我(?:心中的|心里的|眼里)[^，。\n]{0,12}(?:第[一二三]|最佳|最好|最棒|最爱|No\\.?1)/i,
      /对我来说[^，。\n]{0,20}(?:最|太|很|非常|特别|真)/i,
      /(?:是|作为)[^，。\n]{0,16}(?:首选|第一选择|优先|最优|最佳|最常用|首选方案)/i,
      /是我的(?:首选|最爱|最常用|第[一二三]选择|优先选项|常用选项)/i,
      /(?:比起|相比于|对比|相较)[^，。\n]{0,20}(?:更喜欢|更倾向|更偏好|更爱|宁愿|宁可|觉得更好)/i,
      /我更(?:喜欢|倾向[于]?|偏好|偏爱|愿意|想|希望|推荐|看好)/i,
      /我[^，。\n]{0,6}(?:喜欢|偏好|倾向|偏爱|推荐|看好)/i,
      /我通常|我一直|我总是|我经常|我习惯|我平时|我一般都|我向来|我一向|我素来|我从来(?:都是|就)/i,
      /我(?:日常|平时|闲时|有空|没事)[^，。\n]{0,8}(?:喜欢|习惯|会|爱|常|总是|经常)/i,
      /我(?:长期|一直以来|这些年|这几年|一直以来)[^，。\n]{0,10}(?:喜欢|保持|坚持|习惯|用|用着|使用)/i,
      /(?:最|特别|非常|很|真的|超|挺)[^，。\n]{0,6}(?:喜欢|爱|讨厌|怕|希望|想要|期待)[^，。\n]{0,10}(?:是|有|叫|为)/i,
      /(?:对|对于)[^，。\n]{2,20}(?:的)?(?:很|特别|真的|非常|超|挺|蛮)(?:喜欢|满意|感兴趣|看好|认可)/i,
      /(?:还是|更大|我更)(?:喜欢|倾向|偏好|愿意|推荐)(?:用|使用|选|采用)/i,
    ];

    /* ── C. 明确厌恶 / 禁止（~25 模式） ── */
    var DISLIKE_PAT = [
      /我(?:真的|实在|确实|特别|超级|非常|极其)?(?:不喜欢|讨厌|反感|厌恶|抗拒|排斥|受不了|无法接受|看不上|很反感|特别反感|非常反感|极其反感)/i,
      /我[^，。\n]{0,10}(?:不喜欢|讨厌|反感|厌恶|抗拒|受不了|看不上)[^，。\n]{0,20}(?:是|有|叫|为|那种|这类)/i,
      /我不[^，。\n]{0,6}(?:喜欢|爱吃|爱喝|爱看|爱听|爱玩|爱用|推荐|想知道)/i,
      /(?:讨厌|反感|抗拒|排斥|受不了|无法接受)[^，。\n]{0,16}(?:是|有|叫|那种|这类|这种)/i,
      /(?:最|特别|非常|超级|真的|极其)?(?:讨厌|反感|厌恶|受不了)[^，。\n]{0,20}(?:的是|就是|是|有)/i,
      /[^，。\n]{2,20}(?:不好用|太难用|不好看|太丑|太慢|太卡|太复杂|太难|太麻烦|太啰嗦|太啰嗦|太长了|太短了|太难懂)/i,
      /我不[吃喝用看听玩去学做搞整弄]了?/i,
      /我从(?:不|未)[^，。\n]{0,8}(?:喜欢|吃|喝|用|看|听|玩|去|做过|搞过)/i,
      /(?:讨厌|恨|厌恶|反感|排斥|抗拒)[^，。\n]{0,10}(?:的是|就是|这种|那种|这)/i,
      /我[^，。\n]{0,12}(?:现在|已经|基本|早已|早就|如今)[^，。\n]{0,6}(?:不再|不用|不吃|不喝|不看|不听|不玩|不去|不做|不写|不搞|不弄)[了]?/i,
    ];

    /* ── D. 指令 / 行为规则（~30 模式） ── */
    var INSTRUCTION_PAT = [
      /以后(?:直接|记得|一定|必须|要)[^，。\n]{2,30}/i,
      /以后(?:不用|不必|不要|不用再)[^，。\n]{2,30}/i,
      /(?:下次|以后|接下来|之后|后面)(?:直接|记得|一定|要|请|务必)[^，。\n]{2,30}/i,
      /(?:下次|以后|接下来|之后|后面)(?:不用|不必|不要|别)[^，。\n]{2,30}/i,
      /(?:请[你]?[以后每次]?|麻烦你)(?:直接|先|记得|一定|务必)[^，。\n]{2,30}/i,
      /(?:不要|别|不许|不准|禁止)[^，。\n]{0,8}(?:再|又|总是|老|一直|一来就|动不动)/i,
      /(?:以后凡是|以后涉及|以后碰到|以后遇到|以后处理|以后看到)[^，。\n]{0,20}(?:都|就|要|请|务必)/i,
      /(?:回复|回答|回应|写|做|处理|搞|弄|整)[^，。\n]{0,8}(?:直接|简练|简洁|简短|简单[点些]|精练|精炼|精要)/i,
      /(?:不要|别|不许|不准)[^，。\n]{0,8}(?:说|讲|提|问|扯|聊|谈|啰嗦|废话|长篇大论)/i,
      /(?:先|优先|主要|重点)[^，。\n]{0,8}(?:做|处理|解决|搞|弄|整)[^，。\n]{0,8}(?:这个|那个|这些|那些|的)/i,
      /(?:每次|每回|凡是)[^，。\n]{0,16}(?:都|就|必须|要|一定)[^，。\n]{0,8}(?:先|记得|先要|直接)/i,
      /[^，。\n]{2,20}(?:一步一步|分步|逐步|按步骤|一步步|逐步来|分步骤)/i,
      /(?:详细|仔细|细心|严谨|严格)[^，。\n]{0,8}(?:说明|解释|分析|阐述|论述|讲解)/i,
    ];

    /* ── E. 交互边界（~15 模式） ── */
    var BOUNDARY_PAT = [
      /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:叫我|喊我|称呼我|称我|叫住|叫我为)/i,
      /(?:不要|别|不许|不准)[^，。\n]{0,6}(?:擅自|随便|自动|动不动)[^，。\n]{0,8}(?:改|改坏|修改|变动|删|删除|加|添加|调用)/i,
      /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:讲|提|问|说|提|聊|扯|推荐|推销)/i,
      /(?:不要|别再|以后别)[^，。\n]{0,8}(?:把|拿|用)[^，。\n]{0,8}(?:来|去)(?:说事|举例|做例子|当理由|扯)/i,
      /(?:不要|别|不准)[^，。\n]{0,6}(?:什么都|什么事都|啥都|啥事都)[^，。\n]{0,8}(?:扯|往|拉|推)/i,
      /(?:不要|别)[^，。\n]{0,6}(?:擅自|私自|自己|随便)[^，。\n]{0,6}(?:改|改坏|删除|删掉|修改|变动)/i,
    ];

    /* ── F. 项目硬约束（~15 模式） ── */
    var PROJECT_PAT = [
      /[^，。\n]{2,30}(?:不能|不可|不准|不得)[^，。\n]{0,6}(?:改|改坏|动|删|删掉|破坏|影响|修改|变动|去掉|移除)/i,
      /[^，。\n]{2,30}(?:必须|需要|要)[^，。\n]{0,6}(?:保留|保持|存在|正常工作|正常运行|可用|能用|兼容)/i,
      /[^，。\n]{2,30}(?:不准|不能|不得|不允许)[^，。\n]{0,6}(?:改|动|删|删除|修|修坏|改坏)/i,
      /(?:这个|那个|该项目|本项目|这个项目)[^，。\n]{0,12}(?:采用|使用|基于|运行在|部署在|架构于)/i,
      /[^，。\n]{2,30}(?:采用|基于|使用|架构是|技术栈是|前端是|后端是)[^，。\n]{2,20}/i,
      /(?:部署|发布|上线)方式[^，。\n]{0,20}(?:是|为|采用)/i,
      /[^，。\n]{4,30}(?:的部署方式|的发布方式|的构建方式|的配置)(?:是|为|采用)/i,
    ];

    /* ── G. 工具 / API / 部署配置（~18 模式） ── */
    var TOOL_PAT = [
      /(?:使用|采用|基于|运行在|部署在|部署于)[^，。\n]{0,20}(?:部署|平台|服务|环境)/i,
      /(?:默认[模型API]|推荐[模型API]|常用[模型API])[^，。\n]{0,20}(?:是|为)/i,
      /[^，。\n]{4,30}(?:模型|API|接口|服务|提供方|供应商)[^，。\n]{0,16}(?:是|为|使用|用)/i,
      /(?:仓库|代码库|项目|程序|系统|产品)[^，。\n]{0,12}(?:地址|URL|链接|网址)(?:是|为|在)/i,
      /[^，。\n]{4,30}(?:的默认模型|的默认API|的默认参数|的默认设置)/i,
      /(?:到|至)[^，。\n]{0,12}(?:部署|构建|发布|上线)/i,
    ];

    /* ── H. 确认 / 强化模式（~25 模式） ── */
    var CONFIRM_PAT = [
      /^(?:对|是的|没错|就是|对啊|嗯[，]?对|对对对|[好嗯]吧?[，]?对|[好嗯]的[，]?对|是这样|说得对|说的对)[^，。\n]{0,20}$/m,
      /(?:没错|就是)[^，。\n]{0,8}(?:的|这|这个|这样|如此)/i,
      /(?:是|就|确实)[^，。\n]{0,6}(?:这个[版本设置网页模型项目]|这样|如此|的)/i,
      /(?:对的|没错|正是|确实如此|就是这样|就是如此|确实是这样)/i,
      /(?:我[的]?意思[就是]?|我的想法[就是]?|我说的[就是]?)[^，。\n]{0,12}(?:这个|这样|没错|对的|是的)/i,
      /(?:继续|保持|保留|维持)[^，。\n]{0,12}(?:这样|这个|原样|现状|原有的|之前的)/i,
      /(?:对[，。]|嗯[，。]|是的[，。])[^，。\n]{2,30}/i,
    ];

    /* ── I. 指代 / 参照模式（~25 模式） ── */
    var REFER_PAT = [
      /(?:这|那)(?:个|条|句|首|篇|段|张|个|份|款|些|类|种|版本|设置|参数|配置|功能|项目|方案|结果|回复|回答|文件|网页)/i,
      /刚才(?:那|这)(?:个|条|句|首|篇|段|次|个|版本|设置|功能|报错|错误|问题|结果|回复|回答|那个|哪个)/i,
      /(?:前面|上面|之前|上[一那]|前一)(?:个|条|句|条|段|篇|次|轮|版|版本)/i,
      /(?:你刚[才刚]|你上[次一]|你前[面次]|刚刚|之前)[^，。\n]{0,8}(?:说|讲|提|写|发|给|做|改|弄|搞)(?:的|过|的那个|过那个|的那个)/i,
      /(?:这[首篇条个]|那[首篇条个]|这版|它[们]?|[就]?是[这个那个])/i,
      /(?:这个|那个|这样|那样)[^，。\n]{0,12}(?:就是我说的|就是我讲的|就对了|就行|就好|就可以|能用|不错|很好|好听|好看|好用)/i,
    ];

    /* ── J. 临时状态（~15 模式） ── */
    var TEMP_PAT = [
      /(?:今天|今晚|今早|今[天晚早])[^，。\n]{0,12}(?:很|好|有点|感觉|就是|只是)[]?[^，。\n]{0,10}$/i,
      /(?:刚才|刚刚|现在|这会儿)[^，。\n]{0,12}(?:想|要|打算|准备|计划|觉得|感觉|有[点些])[^，。\n]{0,20}$/i,
      /(?:这[次回轮]|这次|这回|本次)[^，。\n]{0,16}(?:先|就|先用|就用|先试试|试试|试试看)/i,
      /(?:先|暂时|临时|暂且)[^，。\n]{0,8}(?:用|试|试试|看看|用着|用一下|用用)/i,
      /(?:我用|我试|我试了|我用了|我测了)[^，。\n]{0,16}(?:一下|试试|看看|一次|一回|测试)/i,
      /我今天[^，。\n]{0,20}(?:很[烦累怒恼]|好[烦累怒]|有[点些])[烦累怒恼躁]/,  /* mood filter also in trash */
    ];

    /* ── K. 敏感信息（~20 模式） ── */
    var SENSITIVE_PAT = [
      /(?:api[ _-]?key|secret[_-]?key|access[_-]?key|token|auth[_-]?token|bearer)[^，。\n]{0,20}/i,
      /(?:密码|口令|passwd|pass_word|password)[^，。\n]{0,20}/i,
      /(?:账号|帐号|username|user_name|login|登录名)[^，。\n]{0,20}/i,
      /(?:银行卡|信用卡|借记卡|卡号|card[_-]?number|cvv|cvc)/i,
      /(?:身份证|id[_-]?card|id[_-]?number|护照|passport)/i,
      /(?:手机号|电话|联系电话|mobile|phone[_-]?number)/i,
      /(?:家庭地址|住址|居住地址|详细地址|具体地址|收货地址)/i,
      /(?:验证码|校验码|确认码|code|otp|2fa|mfa)/i,
      /(?:私[密人]?[键钥]|私钥|private[_-]?key|mnemonic|助记词)/i,
      /^sk-[a-zA-Z0-9]{20,}$/m,
    ];

    /* ── L. 废词废句 / 丢弃（~50 模式） ── */
    var TRASH_PAT = [
      /^(?:啊|嗯|哦|哈|哈哈|呵呵|嘿嘿|嘻嘻|嘖|额|呃|哎|哟|哇|切|呸|呵|哼|唉|哦哦|嗯嗯|好吧|好啦|好滴|好哒|好的|好哦|行吧|行了|好了|可以|不行|不对|不是|算了|没事|没啥|没了|有啊|没用|没有|不是吧|不会吧|真的吗|是吗|是么|这样啊|这样吗|原来如此|原来这样|怪不得|难怪|了解|明白|懂了|知道|知道了|收到|收到|得嘞|好嘞|欧了|OK|ok)$/i,
      /^(?:爽|烦|牛|垃圾|赞|棒|强|好|6|666|nb|NB|tql|太强|太棒|太牛|厉害|牛逼|牛批|流弊|给力|优秀|优质|精彩|绝了|绝了)$/i,
      /^(?:喜欢|讨厌|不错|好听|好看|好用|好吃|好喝|好玩|好棒|好赞|好强|好牛|好厉害|好漂亮|好美|好帅|好 cute|可爱|有趣|有意思|无聊|没意思)$/i,
      /^(?:对|是的|没错|就是|对啊|嗯对|对对|对的|嗯嗯|嗯呢|是的是的|对对对|是的对|对呀|是的呀|dei|是哒|是的没错)$/i,
      /^(?:确实|确实如此|确实这样|确实不错|真不错|真的不错|真棒|真厉害|真的厉害|真好|真的好吗|真的好|太好了|太棒了|太厉害了|太强了|太赞了)$/i,
      /这(?:个|样)(?:好|行|可以|不错|挺好|很棒|很赞|很好|可以的|行了|差不多)/i,
      /那个(?:不行|不好|可以|行|不错)/i,
      /真的?(?:好|可以|不错|行|棒|赞|厉害|牛|强|漂亮|好看|好听|好用|方便|舒服|爽|合适)/i,
      /(?:挺|蛮|很|真的|特别|超|非常|有点|有点|比较|相当|极其|万分)(?:好|棒|赞|强|牛|可以|行|不错|厉害|漂亮|好看|好听|好用|方便|舒服|爽|合适|有意思|有趣)/i,
      /^[。，！？!?,.、]{1,10}$/,
      /^.{1,2}$/,
      /^(?:哈|呵|嘻|嘿|嘖){2,10}$/i,
      /(?:哈哈哈|呵呵呵|嘿嘿嘿|嘻嘻嘻|哈哈哈|呵呵哒|hhh|hhhh|233|2333)/i,
    ];

    /* ── M. 无意义重复 / 语气增强（~15 模式） ── */
    var NOISE_PAT = [
      /(?:真的|确实|实在|的确|简直|完全是|完全是|就是|真是|可真是)(?:太|很|好|非常|特别|超级)[^，。\n]{0,4}$/i,
      /(?:太|好|很|真|超|好)[^，。\n]{0,4}(?:了[。，!！]?)$/m,
      /[^，。\n]{2,12}[啊哦嗯哟呀哈哇诶]?[。，!！]?$/m,
      /(?:就是|还是|可是|但是|然而|不过|只是)[^，。\n]{0,20}(?:这样|那样|如此|这样吧|那样吧)/i,
    ];

    /* ==============================================================
       核心数据结构
       ============================================================== */
    function emptyStore(){
      return { savedMemories:[], candidateMemories:[], historyReferences:[], memoryLogs:[] };
    }

    function newSavedMemory(){
      return {
        id:uid(), kind:'saved_memory',
        type:'preference', subject:'user', predicate:'likes', object:'',
        text:'', evidence:[], confidence:0, importance:0,
        status:'active', created_at:nowISO(), updated_at:nowISO(),
        last_confirmed_at:null, tags:[], aliases:[], source:'auto', version:1
      };
    }

    function newCandidate(){
      return {
        id:uid(), kind:'candidate_memory',
        reason:'', proposed_text:'', raw_text:'',
        confidence:0, created_at:nowISO(), related_context:[]
      };
    }

    function newHistoryRef(){
      return {
        id:uid(), kind:'history_reference',
        summary:'', messages:[], topics:[], importance:0,
        created_at:nowISO(), updated_at:nowISO()
      };
    }

    function newLog(){
      return { id:uid(), action:'', input:'', output:'', reason:'', created_at:nowISO() };
    }

    function nowISO(){ return new Date().toISOString(); }

    /* ==============================================================
       存储层
       ============================================================== */
    function loadStore(){
      var s = readJSON(K.memoriesV2, null);
      if(s && s.savedMemories && Array.isArray(s.savedMemories)) return s;
      return emptyStore();
    }
    function saveStore(s){ saveJSON(K.memoriesV2, s); }

    function loadCandidatesV2(){
      var arr = readJSON(K.candidatesV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveCandidatesV2(arr){ saveJSON(K.candidatesV2, Array.isArray(arr) ? arr : []); }

    function loadHistoryV2(){
      var arr = readJSON(K.historyV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveHistoryV2(arr){ saveJSON(K.historyV2, Array.isArray(arr) ? arr : []); }

    function loadLogs(){
      var arr = readJSON(K.logsV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveLogs(arr){ saveJSON(K.logsV2, Array.isArray(arr) ? arr.slice(-500) : []); }

    /* ==============================================================
       logMemoryAction — 写记忆日志
       ============================================================== */
    function logAction(action, input, output, reason){
      var logs = loadLogs();
      logs.unshift({ id:uid(), action:action||'unknown', input:String(input||'').slice(0,200), output:String(output||'').slice(0,200), reason:String(reason||'').slice(0,200), created_at:nowISO() });
      if(logs.length > 500) logs = logs.slice(0,500);
      saveLogs(logs);
    }

    /* ==============================================================
       rejectTrashMemory — 丢弃废内容（写日志，不保存）
       ============================================================== */
    function rejectTrash(input, reason){
      logAction('reject', input, '已丢弃', reason);
    }

    /* ==============================================================
       classifyMemoryV3 — 增强分类（不冲突旧 classifyMemory）
       返回: { category, subcategory, contexts }
       ============================================================== */
    function classifyV3(text){
      var t = text.trim();
      var result = { category:'casual_chat', subcategory:'', contexts:[], explicit_request:false, is_confirmation:false, is_temporary:false, is_sensitive:false, is_trash:false, has_reference:false };

      /* 1. 敏感检测 — 最高优先级 */
      for(var i=0; i<SENSITIVE_PAT.length; i++){ if(SENSITIVE_PAT[i].test(t)){
        result.is_sensitive = true;
        result.category = 'sensitive';
        return result;
      }}

      /* 2. 显式记忆请求 */
      for(var i=0; i<EXPLICIT_REQ.length; i++){ if(EXPLICIT_REQ[i].test(t)){
        result.explicit_request = true;
        result.category = 'explicit_memory_request';
        result.subcategory = 'explicit_save';
        return result;
      }}

      /* 3. 厌恶 */
      for(var i=0; i<DISLIKE_PAT.length; i++){ if(DISLIKE_PAT[i].test(t)){
        result.category = 'stable_preference';
        result.subcategory = 'dislike';
        result.contexts.push('dislike');
        return result;
      }}

      /* 4. 偏好 */
      for(var i=0; i<PREFERENCE_PAT.length; i++){ if(PREFERENCE_PAT[i].test(t)){
        result.category = 'stable_preference';
        result.subcategory = 'preference';
        result.contexts.push('preference');
        return result;
      }}

      /* 5. 边界（交互边界优先于一般指令） */
      for(var i=0; i<BOUNDARY_PAT.length; i++){ if(BOUNDARY_PAT[i].test(t)){
        result.category = 'boundary';
        result.subcategory = 'interaction_boundary';
        result.contexts.push('boundary');
        return result;
      }}

      /* 6. 指令 */
      for(var i=0; i<INSTRUCTION_PAT.length; i++){ if(INSTRUCTION_PAT[i].test(t)){
        result.category = 'instruction';
        result.subcategory = 'behavior_rule';
        result.contexts.push('instruction');
        return result;
      }}

      /* 7. 项目约束 */
      for(var i=0; i<PROJECT_PAT.length; i++){ if(PROJECT_PAT[i].test(t)){
        result.category = 'project';
        result.subcategory = 'constraint';
        result.contexts.push('project');
        return result;
      }}

      /* 8. 工具配置 */
      for(var i=0; i<TOOL_PAT.length; i++){ if(TOOL_PAT[i].test(t)){
        result.category = 'project';
        result.subcategory = 'tool_config';
        result.contexts.push('tool_config');
        return result;
      }}

      /* 9. 确认 */
      for(var i=0; i<CONFIRM_PAT.length; i++){ if(CONFIRM_PAT[i].test(t)){
        result.is_confirmation = true;
        result.category = 'confirmation';
        result.subcategory = 'confirmation';
        result.contexts.push('confirmation');
        return result;
      }}

      /* 10. 噪声（内容类别之后，仅兜底） */
      for(var i=0; i<NOISE_PAT.length; i++){ if(NOISE_PAT[i].test(t)){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }}

      /* 11. 废词废句（兜底） */
      for(var i=0; i<TRASH_PAT.length; i++){ if(TRASH_PAT[i].test(t)){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }}

      /* 12. 指代 */
      for(var i=0; i<REFER_PAT.length; i++){ if(REFER_PAT[i].test(t)){
        result.has_reference = true;
        // Don't return yet — might be a proper sentence with reference + meaning
      }}

      /* 13. 临时 */
      for(var i=0; i<TEMP_PAT.length; i++){ if(TEMP_PAT[i].test(t)){
        result.is_temporary = true;
        result.category = 'temporary_state';
        result.subcategory = 'temporary';
        return result;
      }}

      /* 14. 简短无意义 */
      if(t.length < 4){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }

      return result;
    }

    /* ==============================================================
       detectIntensity — 检测用户语句的强度/确定性
       返回 0-1 的强度系数
       ============================================================== */
    function detectIntensity(text){
      var score = 0;
      /* 高强度副词 */
      var highIntensity = /(?:绝对|必须|一定|肯定|永远|从来|打死也|死也不|坚决|无论如何|毫无疑问|毫无疑问|毋庸置疑|毫不含糊|铁定|板上钉钉)/;
      if(highIntensity.test(text)) score += 0.25;
      /* 超高强度 */
      var extremeIntensity = /(?:最|第[一二三]|唯一|only|top|No\.?1|Number One|首选|最爱|天下第[一二三]|世界第[一二三])/i;
      if(extremeIntensity.test(text)) score += 0.2;
      /* 反复/习惯 */
      var habitual = /(?:每次|每回|总是|一直|从来都|向来|一贯|长期|多年|这些年|始终|坚持|保持|持续|稳定|固定)/;
      if(habitual.test(text)) score += 0.2;
      /* 强调否定 */
      var strongNeg = /(?:绝对不|坚决不|死也不|打死不|永远不|再也不|决不再|千万不|万万不|断然不|压根不|根本不)/;
      if(strongNeg.test(text)) score += 0.2;
      /* 强烈情感 */
      var strongEmotion = /(?:超级|特别|非常|极其|极度|格外|十分|忒|巨|狂|爆|炸裂|无敌|逆天|封神|神仙|天才|完美|绝了|太牛|太强|太棒)/;
      if(strongEmotion.test(text)) score += 0.1;
      return Math.min(0.5, score);
    }

    /* ==============================================================
       scoreMemoryV3 — 评分
       返回: { confidence, importance } 0-1
       ============================================================== */
    function scoreV3(category, text, explicit_request, has_reference, oldMem){
      var result = { confidence:0, importance:0 };
      var len = text.length;
      var intensity = detectIntensity(text);

      /* 置信度基础 */
      if(explicit_request){ result.confidence = 0.95; }
      else if(category === 'explicit_memory_request'){ result.confidence = 0.95; }
      else if(category === 'instruction'){ result.confidence = 0.88 + intensity; }
      else if(category === 'boundary'){ result.confidence = 0.88 + intensity; }
      else if(category === 'project' || category === 'tool_config'){ result.confidence = 0.83 + intensity; }
      else if(category === 'stable_preference'){
        if(has_reference && oldMem){ result.confidence = 0.8; }
        else if(has_reference){ result.confidence = 0.72; }
        else { result.confidence = 0.78 + intensity; }
      }
      else if(category === 'dislike'){
        result.confidence = 0.8 + intensity;
      }
      else if(category === 'confirmation' && oldMem){
        result.confidence = Math.min(0.98, (oldMem.confidence || 0.7) + 0.08);
        result.importance = oldMem.importance || 0.5;
        return result;
      }else{
        return result; // 低分，不进正式记忆
      }

      /* 内容长度与丰富度 */
      if(len < 6) result.confidence = Math.min(result.confidence, 0.3);
      else if(len < 10) result.confidence = Math.min(result.confidence, 0.55);
      else if(len >= 30) result.confidence = Math.min(0.98, result.confidence + 0.05); // 长内容加分
      else if(len >= 20) result.confidence = Math.min(0.98, result.confidence + 0.03);

      /* 内容特异性：包含具体实体/数字/时间加分 */
      var hasConcreteEntity = /(?:https?:\/\/|github|\.com|\.cn|\.io|[A-Z][a-z]{2,}(?:\.[A-Z][a-z]{2,})+|\d{4}-\d{2}-\d{2}|\d{1,3}\.\d{1,3}\.\d{1,3}|版本\s*\d|v\d+\.\d+|第[一二三四五六七八九十\d]+|[A-Z][a-z]+ [A-Z][a-z]+)/.test(text);
      if(hasConcreteEntity) result.confidence = Math.min(0.98, result.confidence + 0.05);

      /* 旧记忆强化 */
      if(oldMem){
        result.confidence = Math.min(0.98, Math.max(result.confidence, (oldMem.confidence||0.7) + 0.06));
      }

      /* ── 重要性 ── */
      if(category === 'project'){ result.importance = 0.85 + intensity * 0.15; }
      else if(category === 'instruction'){ result.importance = 0.75 + intensity * 0.2; }
      else if(category === 'boundary'){ result.importance = 0.8 + intensity * 0.15; }
      else if(category === 'tool_config'){ result.importance = 0.7 + intensity * 0.2; }
      else if(explicit_request || category === 'explicit_memory_request'){ result.importance = 0.7 + intensity * 0.2; }
      else if(category === 'stable_preference'){
        if(has_reference) result.importance = 0.45 + intensity * 0.35;
        else result.importance = 0.5 + intensity * 0.3;
      }
      else if(category === 'dislike'){
        result.importance = 0.65 + intensity * 0.25;
      }
      else { result.importance = 0.3 + intensity * 0.3; }

      /* 有指代但解析失败 → 适度降分，但仍保留一定价值 */
      if(has_reference && !oldMem && category !== 'trash' && category !== 'casual_chat'){
        result.confidence = Math.min(result.confidence, 0.68);
        result.importance = Math.min(result.importance, 0.55);
      }

      return result;
    }

    /* ==============================================================
       resolveReference — 指代解析
       ============================================================== */
    function resolveRef(text, recentMessages, existingMemories, historyRefs){
      if(!recentMessages && !existingMemories && !historyRefs) return null;

      var refMatch = null;
      for(var i=0; i<REFER_PAT.length; i++){
        var m = text.match(REFER_PAT[i]);
        if(m){ refMatch = m[0]; break; }
      }
      if(!refMatch) return null;

      var resolved = null;

      /* 1. 在最近消息中搜索明确对象 */
      if(recentMessages && recentMessages.length){
        for(var j=recentMessages.length-1; j>=0; j--){
          var msg = recentMessages[j];
          if(msg.role === 'assistant' && msg.content){
            // 找引号、书名号里的内容
            var quotes = msg.content.match(/[「『《""][^「『《""」』》""]{2,40}[」』》""]/g);
            if(quotes && quotes.length){
              resolved = { type:'assistant_mention', object:quotes[quotes.length-1].replace(/[「『《""」』》""]/g,''), source:'recent_messages' };
              break;
            }
            // 找 . 分隔的明确实体
            var entities = msg.content.match(/[^，。\n]{2,30}(?:的歌|的音乐|的小说|的电影|的剧|的作品|的版本|的功能|的设置|的配置|的模式)[^，。\n]{0,10}/i);
            if(entities && entities.length){
              resolved = { type:'entity_context', object:entities[0].trim(), source:'recent_messages' };
              break;
            }
          }
          if(msg.role === 'user' && msg !== text){
            // 找用户前一条消息中的核心内容（50字以上且有实体）
            if(msg.content && msg.content.length > 8 && msg.content.length < 200){
              resolved = { type:'previous_user_message', object:msg.content.slice(0,100), source:'recent_messages' };
              break;
            }
          }
        }
      }

      /* 在已有记忆中搜索匹配已解析的引用 */
      if(resolved && !resolved.memory && existingMemories && existingMemories.length && resolved.object){
        for(var k=0; k<existingMemories.length; k++){
          var em = existingMemories[k]; if(em.status !== 'active') continue;
          if((em.object && (em.object.indexOf(resolved.object) >= 0 || resolved.object.indexOf(em.object) >= 0)) ||
             (em.text && em.text.indexOf(resolved.object) >= 0)){
            resolved.memory = em; resolved.source = 'recent_messages_matched'; break;
          }
        }
      }

      /* 2. 在已有记忆中搜索 */
      if(!resolved && existingMemories && existingMemories.length){
        var best = null, bestScore = 0;
        for(var k=0; k<existingMemories.length; k++){
          var em = existingMemories[k];
          if(em.status !== 'active') continue;
          if(em.object && em.object.length > 2){
            var score = 0;
            if(text.indexOf('版本') >= 0 && (em.object.indexOf('版本') >= 0 || em.text.indexOf('版本') >= 0)) score += 3;
            if(text.indexOf('模型') >= 0 && (em.object.indexOf('模型') >= 0 || em.text.indexOf('模型') >= 0)) score += 3;
            if(text.indexOf('设置') >= 0 && (em.object.indexOf('设置') >= 0 || em.text.indexOf('设置') >= 0)) score += 3;
            if(text.indexOf('功能') >= 0 && (em.object.indexOf('功能') >= 0 || em.text.indexOf('功能') >= 0)) score += 3;
            if(score > bestScore){ bestScore = score; best = em; }
          }
        }
        if(best) resolved = { type:'existing_memory', object:best.object, memory:best, source:'existing_memories' };
      }

      /* 3. 在历史引用中搜索 */
      if(!resolved && historyRefs && historyRefs.length){
        var hr = historyRefs[0];
        if(hr && hr.topics && hr.topics.length){
          resolved = { type:'history_context', object:hr.topics.slice(0,3).join('、'), source:'history_reference', ref:hr };
        }
      }

      return resolved;
    }

    /* ==============================================================
       normalizeMemory — 规范化提取结果
       从分类+文本构建结构化的 saved_memory
       ============================================================== */
    function normalizeRaw(classification, text, resolvedRef, matchedPattern){
      var m = newSavedMemory();

      /* 根据分类设置 type/predicate/text */
      switch(classification.subcategory){
        case 'explicit_save':
          m.type = 'instruction'; m.predicate = 'requires';
          m.text = '用户要求：' + text.replace(/^(?:记住|记一下|记好了|别忘了|把[这那])/i,'').trim();
          if(m.text.length < 6) m.text = text;
          m.source = 'explicit_user'; m.confidence = 0.95; m.importance = 0.8;
          break;

        case 'dislike':
          m.type = 'dislike'; m.predicate = 'dislikes';
          m.object = extractObject(text, resolvedRef);
          m.text = '用户不喜欢' + (m.object ? m.object : extractDislikeTarget(text));
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.75;
          break;

        case 'preference':
          m.type = 'preference'; m.predicate = 'likes';
          m.object = extractObject(text, resolvedRef);
          m.text = '用户喜欢' + (m.object ? m.object : extractTarget(text));
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.6;
          break;

        case 'behavior_rule':
          m.type = 'instruction'; m.predicate = 'requires';
          m.object = extractTarget(text) || text;
          m.text = '用户要求：' + text.replace(/^(?:以后|下次|接下来|之后|请|麻烦你)/i,'').trim();
          m.source = 'auto'; m.confidence = 0.9; m.importance = 0.85;
          break;

        case 'interaction_boundary':
          m.type = 'boundary'; m.predicate = 'forbids';
          m.object = extractTarget(text) || text;
          m.text = '用户禁止：' + text.replace(/^(?:以后|下次|请|麻烦你)/i,'').trim();
          m.source = 'auto'; m.confidence = 0.9; m.importance = 0.9;
          break;

        case 'constraint':
          m.type = 'project'; m.predicate = 'requires';
          m.object = extractTarget(text) || text;
          m.text = '项目约束：' + text;
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.9;
          break;

        case 'tool_config':
          m.type = 'tool_config'; m.predicate = 'uses';
          m.object = extractTarget(text) || text;
          m.text = '工具配置：' + text;
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.8;
          break;

        default:
          m.text = text;
          break;
      }

      /* 指代替换 */
      if(resolvedRef && resolvedRef.object){
        var referPatterns = [/这[个首条篇段]/, /那[个首条篇段]/, /刚才那[个]/, /你刚[才]说的/, /它/];
        for(var i=0; i<referPatterns.length; i++){
          m.text = m.text.replace(referPatterns[i], resolvedRef.object);
        }
        m.object = resolvedRef.object;
        m.aliases.push(resolvedRef.object);
      }

      /* 规范化结尾 */
      m.text = m.text.trim();
      if(!/[。！？!?]$/.test(m.text)) m.text += '。';

      return m;
    }

    /* 提取对象（喜欢后面的内容） */
    function extractObject(text, ref){
      if(ref && ref.object) return ref.object;
      var objMatch = text.match(/(?:喜欢|爱|推荐|偏爱|偏好)[^，。\n]{1,40}$/i);
      if(objMatch) return objMatch[0].replace(/^(?:喜欢|爱|推荐|偏爱|偏好)/,'').trim();
      var full = text.match(/(?:我喜欢|我最喜欢|我更喜欢|我偏好|我偏向)[^，。\n]{1,40}/i);
      if(full) return full[0].replace(/^我(?:最)?(?:喜欢|偏好|偏向)/,'').trim();
      return '';
    }

    function extractTarget(text){
      var m = text.match(/[^，。\n]{2,40}$/);
      return m ? m[0].trim() : text.slice(-20);
    }

    function extractDislikeTarget(text){
      var m = text.match(/(?:不喜欢|讨厌|反感|受不了)[^，。\n]{1,40}$/i);
      if(m) return m[0].replace(/^(?:不喜欢|讨厌|反感|受不了)/,'').trim();
      return '';
    }

    /* ==============================================================
       upsertMemory — 合并/强化/冲突处理
       ============================================================== */
    function upsert(newMem, store){
      var existing = store.savedMemories;
      var bestMatch = null, bestScore = 0;

      for(var i=0; i<existing.length; i++){
        var e = existing[i];
        if(e.status === 'archived' || e.status === 'deleted') continue;
        var sim = textSimilarity(newMem.text, e.text);
        if(sim > bestScore){ bestScore = sim; bestMatch = { idx:i, mem:e, sim:sim }; }
      }

      /* 完全重复 / 高度相似 → 只更新 evidence 和置信度 */
      if(bestMatch && bestMatch.sim >= 0.65){
        var target = existing[bestMatch.idx];
        /* 合并 evidence */
        if(newMem.evidence && newMem.evidence.length){
          target.evidence = target.evidence.concat(newMem.evidence).slice(-20);
        }
        /* 强化置信度 */
        target.confidence = Math.min(0.98, Math.max(target.confidence||0.7, newMem.confidence||0.7) + 0.05);
        target.importance = Math.max(target.importance||0.5, newMem.importance||0.5);
        target.updated_at = nowISO();
        target.last_confirmed_at = nowISO();
        target.version = (target.version||1) + 1;
        /* 取更长更完整的文本 */
        if(newMem.text.length > target.text.length) target.text = newMem.text;
        /* 合并 aliases */
        if(newMem.aliases && newMem.aliases.length){
          newMem.aliases.forEach(function(a){ if(target.aliases.indexOf(a)<0) target.aliases.push(a); });
        }
        logAction('reinforce', newMem.text, target.text, '重复确认，合并强化');
        return { action:'reinforce', memory:target };
      }

      /* 中等相似 → 可能是同对象细化 */
      if(bestMatch && bestMatch.sim >= 0.4){
        var target2 = existing[bestMatch.idx];
        /* 检查是否同 predicate */
        if(target2.predicate === newMem.predicate){
          /* 新文本更长更详细 → 升级 */
          if(newMem.text.length > target2.text.length + 5){
            logAction('merge_refine', target2.text, newMem.text, '同对象细化更新');
            if(newMem.evidence) target2.evidence = target2.evidence.concat(newMem.evidence).slice(-20);
            target2.text = newMem.text;
            target2.object = newMem.object || target2.object;
            target2.confidence = Math.min(0.98, target2.confidence + 0.03);
            target2.importance = Math.max(target2.importance, newMem.importance);
            target2.updated_at = nowISO();
            target2.version = (target2.version||1) + 1;
            return { action:'refine', memory:target2 };
          }
          /* 旧文本更长 → 只是强化 */
          target2.confidence = Math.min(0.98, target2.confidence + 0.03);
          target2.last_confirmed_at = nowISO();
          if(newMem.evidence) target2.evidence = target2.evidence.concat(newMem.evidence).slice(-20);
          logAction('reinforce', newMem.text, target2.text, '同对象确认强化');
          return { action:'reinforce', memory:target2 };
        }

        /* 不同 predicate → 可能冲突 */
        if(target2.predicate !== newMem.predicate){
          var isConflict = false;
          if(target2.predicate === 'likes' && newMem.predicate === 'dislikes') isConflict = true;
          if(target2.predicate === 'dislikes' && newMem.predicate === 'likes') isConflict = true;
          if(target2.predicate === 'forbids' && newMem.predicate === 'requires') isConflict = true;
          if(target2.predicate === 'requires' && newMem.predicate === 'forbids') isConflict = true;

          if(isConflict && detectChangeOfMind(newMem.text, target2.text)){
            /* 归档旧记忆 */
            target2.status = 'archived';
            target2.updated_at = nowISO();
            logAction('archive_conflict', target2.text, newMem.text, '冲突归档，用户改变了想法');
            /* 新建新记忆 */
            newMem.id = uid();
            newMem.created_at = nowISO();
            newMem.updated_at = nowISO();
            existing.unshift(newMem);
            logAction('save', newMem.text, '', '冲突后新建');
            return { action:'conflict_replace', old:target2, memory:newMem };
          }
        }
      }

      /* 无匹配 → 新建 */
      newMem.id = uid();
      newMem.created_at = nowISO();
      newMem.updated_at = nowISO();
      existing.unshift(newMem);
      if(existing.length > 300) existing = existing.slice(0,300);
      logAction('save', newMem.text, '', '新建记忆');
      return { action:'save', memory:newMem };
    }

    /* 检测是否改变想法 */
    function detectChangeOfMind(newText, oldText){
      var changeIndicators = [
        /基本不用[了]?|不用了|不[再用]|不再|不[需想]要|换[成]?|改[成变用]|转[向移到]|变了|变了|变了想法|改主意/i,
        /不再[喜欢用考虑]|以后不用|以后不[会再]|已经不|已经不再|现在[不用不喜欢]?/i,
        /我以前|我之前|以前是|过去是|原本是|本来是|以前喜欢|之前用/i
      ];
      var hasChangeWord = false;
      for(var i=0; i<changeIndicators.length; i++){
        if(changeIndicators[i].test(newText)){ hasChangeWord = true; break; }
      }
      if(!hasChangeWord) return false;

      var oppositePairs = [
        { like:/喜欢|爱|偏好|用|使用|推崇/, dislike:/不喜欢|讨厌|不用|不再用|弃用|废弃/ },
        { on:/开[启着]?|启用|使用|用/, off:/[关停闭]|关闭|不用|停用/ }
      ];

      var newSubject = newText.slice(0,20);
      var oldSubject = oldText.slice(0,20);
      var shared = 0;
      for(var j=0; j<newSubject.length; j++){
        if(oldSubject.indexOf(newSubject[j]) >= 0) shared++;
      }
      return (shared / Math.max(newSubject.length, 1)) > 0.3;
    }

    /* 文本相似度 */
    function textSimilarity(a, b){
      if(!a || !b) return 0;
      if(a === b) return 1;
      var sa = a.slice(0,80).toLowerCase(), sb = b.slice(0,80).toLowerCase();
      var short = sa.length <= sb.length ? sa : sb;
      var long = sa.length > sb.length ? sa : sb;
      var match = 0;
      for(var i=0; i<short.length; i++){ if(long.indexOf(short[i]) >= 0) match++; }
      return match / long.length;
    }

    /* ==============================================================
       addCandidateMemory — 添加候选（带严格检查）
       ============================================================== */
    function addCandidate(proposedText, rawText, reason, confidence){
      if(!proposedText || proposedText.length < 6) return null;
      if(reason === 'sensitive') return null;

      /* 废词检查 */
      for(var i=0; i<TRASH_PAT.length; i++){ if(TRASH_PAT[i].test(proposedText)) return null; }

      var cand = newCandidate();
      cand.proposed_text = proposedText;
      cand.raw_text = (rawText||proposedText).slice(0,200);
      cand.reason = reason || '需要确认';
      cand.confidence = confidence || 0.5;
      cand.created_at = nowISO();

      var candidates = loadCandidatesV2();
      /* 去重 */
      for(var j=0; j<candidates.length; j++){
        if(textSimilarity(candidates[j].proposed_text, proposedText) >= 0.6) return null;
      }
      candidates.unshift(cand);
      if(candidates.length > 50) candidates = candidates.slice(0,50);
      saveCandidatesV2(candidates);
      logAction('candidate', rawText, proposedText, reason);
      return cand;
    }

    /* ==============================================================
       buildHistoryReference — 构建历史引用
       ============================================================== */
    function buildHistoryRef(messages, maxLen){
      if(!messages || !messages.length) return null;
      var ref = newHistoryRef();
      var msgs = messages.slice(-maxLen || -20);
      ref.messages = msgs.filter(function(m){ return m.id; }).map(function(m){ return m.id; });
      ref.summary = msgs.filter(function(m){ return m.role === 'user' || m.role === 'assistant'; }).slice(-6).map(function(m){
        return (m.role === 'user' ? 'U: ' : 'A: ') + (m.content||'').slice(0,120);
      }).join('\n');
      ref.importance = 0.4;
      ref.updated_at = nowISO();
      return ref;
    }

    /* ==============================================================
       retrieveRelevantMemories — 多策略检索
       ============================================================== */
    function retrieve(userMessage, store, count){
      count = count || 12;
      if(!store || !store.savedMemories) return [];

      var memories = store.savedMemories.filter(function(m){ return m.status === 'active'; });
      if(!memories.length) return [];

      /* 候选也纳入检索，只取高置信的 */
      var candidates = (store.candidateMemories||[]).filter(function(c){ return c.confidence >= 0.6; });

      var msg = (userMessage||'').toLowerCase();
      var results = [];

      /* 1. 关键词匹配 */
      var words = msg.split(/[\s，。、；：,.\n]+/).filter(function(w){ return w.length > 1; });

      for(var i=0; i<memories.length; i++){
        var m = memories[i];
        var score = 0;
        var text = (m.text||'').toLowerCase();

        /* 精确关键词 */
        for(var w=0; w<words.length; w++){
          if(text.indexOf(words[w]) >= 0){
            score += 2;
            /* 多次出现加分 */
            var count = (text.match(new RegExp(words[w].replace(/[.*+?^${}()|[\]\\]/g, '\$&'), 'g')) || []).length;
            score += Math.min(count, 5) * 0.5;
          }
        }

        /* 类别匹配 */
        if(m.type === 'project' && (msg.indexOf('项目') >= 0 || msg.indexOf('不能改') >= 0 || msg.indexOf('保留') >= 0)) score += 3;
        if(m.type === 'instruction' && (msg.indexOf('以后') >= 0 || msg.indexOf('不要') >= 0 || msg.indexOf('必须') >= 0)) score += 2;
        if(m.type === 'boundary' && (msg.indexOf('不要') >= 0 || msg.indexOf('称呼') >= 0 || msg.indexOf('叫我') >= 0)) score += 2;
        if(m.type === 'tool_config' && (msg.indexOf('部署') >= 0 || msg.indexOf('配置') >= 0 || msg.indexOf('API') >= 0)) score += 2;

        /* 置信度 */
        score += (m.confidence || 0) * 5;

        /* 重要性 */
        score += (m.importance || 0) * 4;

        /* 时间衰减（最近更新的权重高） */
        if(m.updated_at){
          var age = Date.now() - new Date(m.updated_at).getTime();
          if(age < 86400000) score += 3;
          else if(age < 604800000) score += 1.5;
          else if(age < 2592000000) score += 0.5;
        }

        if(score > 0) results.push({ memory:m, score:score });
      }

      /* 候选记忆也检索 */
      for(var ci=0; ci<candidates.length; ci++){
        var c = candidates[ci];
        var cs = 0;
        var ct = (c.proposed_text||'').toLowerCase();
        for(var w2=0; w2<words.length; w2++){
          if(ct.indexOf(words[w2]) >= 0) cs += 1.5;
        }
        cs += (c.confidence||0) * 3;
        if(cs > 0) results.push({ candidate:c, score:cs });
      }

      results.sort(function(a,b){ return b.score - a.score; });

      /* 不同类型尽量覆盖 */
      var typeSet = {};
      var final = [];
      for(var r=0; r<results.length && final.length < count; r++){
        var item = results[r];
        var type = item.memory ? item.memory.type : 'candidate';
        if(!typeSet[type] || final.length < count/2){
          final.push(item);
          typeSet[type] = true;
        }else if(final.length < count){
          final.push(item);
        }
      }

      return final.sort(function(a,b){ return b.score - a.score; }).slice(0, count);
    }

    /* ==============================================================
       buildMemoryContext — 构建注入 prompt
       ============================================================== */
    function buildContext(retrieved, userMessage){
      if(!retrieved || !retrieved.length) return '';

      var parts = [];

      /* 正式记忆 */
      var saved = retrieved.filter(function(r){ return r.memory && r.memory.status === 'active'; });
      if(saved.length){
        var lines = saved.map(function(r, i){
          return (i+1) + '. ' + (r.memory.text||'').slice(0,300);
        });
        parts.push('[长期记忆]\n' + lines.join('\n'));
      }

      /* 候选 */
      var cands = retrieved.filter(function(r){ return r.candidate; });
      if(cands.length && cands.length <= 3){
        var clines = cands.map(function(r){
          return '- (待确认) ' + (r.candidate.proposed_text||'').slice(0,200);
        });
        parts.push('[待确认信息]\n' + clines.join('\n'));
      }

      var text = parts.join('\n\n');
      if(text.length > 4000) text = text.slice(0,4000);
      return text;
    }

    /* ==============================================================
       extractMemoryFromMessage — 主提取入口
       输入: message, recentMessages, store
       输出: { action:'save'|'reinforce'|'candidate'|'reject'|'skip', memory?:saved_memory, reason?:string }
       ============================================================== */
    function extract(msgText, recentMessages, store){
      if(!store) store = loadStore();
      var text = String(msgText||'').trim();
      if(text.length < 4) return { action:'skip', reason:'too_short' };

      /* 分类 */
      var cls = classifyV3(text);

      /* 废词丢弃 */
      if(cls.is_trash){
        /* 尝试指代解析合并 */
        if(cls.has_reference || CONFIRM_PAT.some(function(p){ return p.test(text); })){
          var ref = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
          if(ref && ref.memory){
            var enhanced = upsert({ text:ref.memory.text, evidence:[], confidence:ref.memory.confidence+0.05, importance:ref.memory.importance, aliases:[] }, store);
            saveStore(store);
            return { action:'reinforce', memory:enhanced.memory, reason:'reference_resolved_trash' };
          }
        }
        rejectTrash(text, cls.subcategory || 'trash');
        return { action:'reject', reason:'trash:'+(cls.subcategory||'trash') };
      }

      /* 敏感 → 拒绝长期保存 */
      if(cls.is_sensitive){
        logAction('reject_sensitive', text, '', '敏感信息，不保存长期记忆');
        return { action:'reject', reason:'sensitive_info' };
      }

      /* 临时 → 不进正式记忆 */
      if(cls.is_temporary){
        logAction('skip_temporary', text, '', '临时状态，不进长期记忆');
        return { action:'skip', reason:'temporary_state' };
      }

      /* 确认 → 尝试强化旧记忆 */
      if(cls.is_confirmation){
        var ref2 = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
        if(ref2 && ref2.memory){
          var result = upsert({ text:ref2.memory.text, evidence:[{
            message_id:uid(), role:'user', text:text, created_at:nowISO()
          }], confidence:Math.min(0.98, (ref2.memory.confidence||0.7)+0.08), importance:ref2.memory.importance, aliases:[] }, store);
          saveStore(store);
          return { action:'reinforce', memory:result.memory, reason:'confirmation_upsert' };
        }
        if(ref2 && ref2.object){
          /* 有关联对象但无对应记忆 → candidate */
          var candText = '用户确认了关于' + ref2.object + '的偏好。';
          var added = addCandidate(candText, text, '有对象但尚未建立记忆', 0.6);
          if(added) return { action:'candidate', reason:'object_found_no_memory', candidate:added };
        }
        /* 无法解析 → discard */
        rejectTrash(text, 'confirmation_no_reference');
        return { action:'reject', reason:'confirmation_no_reference' };
      }

      /* 指代解析 */
      var resolved = null;
      if(cls.has_reference || text.match(/这[个首条篇段]|那[个首条篇段]|刚才|它|这个版本|这个设置/i)){
        resolved = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
      }

      /* 构建规范记忆 */
      var normal = normalizeRaw(cls, text, resolved, null);

      /* 评分 */
      var scores = scoreV3(cls.category, text, cls.explicit_request, !!resolved,
        resolved && resolved.memory ? resolved.memory : null);

      normal.confidence = scores.confidence;
      normal.importance = scores.importance;

      /* 添加 evidence */
      normal.evidence.push({
        message_id:uid(), role:'user', text:text.slice(0,200), created_at:nowISO()
      });

      /* 决策入口 */
      if(cls.explicit_request || cls.category === 'explicit_memory_request'){
        /* 如果有指代词但未解析 → 候选 */
        if(/[它这那]/.test(text) && !resolved){
          return { action:'candidate', reason:'explicit_request_ambiguous_reference', candidate:{proposed_text:normal.text} };
        }
        /* 显式请求 → 直接保存 */
        var upserted = upsert(normal, store);
        saveStore(store);
        return { action:upserted.action, memory:upserted.memory };
      }

      /* 高置信 → 直接保存（阈值略降，配合强度检测） */
      if(scores.confidence >= 0.72 && scores.importance >= 0.45){
        var upserted2 = upsert(normal, store);
        saveStore(store);
        return { action:upserted2.action, memory:upserted2.memory };
      }

      /* 中高置信 + 强度高 → 保存 */
      var intensity = detectIntensity(text);
      if(scores.confidence >= 0.65 && intensity >= 0.25 && text.length >= 12){
        var upserted25 = upsert(normal, store);
        saveStore(store);
        return { action:upserted25.action, memory:upserted25.memory };
      }

      /* 中等置信 → 检查对象是否明确 */
      if(scores.confidence >= 0.55 && scores.importance >= 0.35){
        if((normal.object && normal.object.length > 2) || (resolved && resolved.object)){
          var upserted3 = upsert(normal, store);
          saveStore(store);
          return { action:upserted3.action, memory:upserted3.memory };
        }
        /* 对象不明确 → candidate */
        var candReason = '对象不明确';
        if(cls.has_reference && !resolved) candReason = '指代解析失败';
        var added = addCandidate(normal.text, text, candReason, scores.confidence);
        return { action:'candidate', reason:candReason, candidate:added || undefined };
      }

      if(scores.confidence >= 0.35){
        /* 低中置信 → candidate（待用户确认） */
        var candReason2 = '置信度不足';
        if(!normal.object || normal.object.length < 2) candReason2 = '对象不明确，置信度不足';
        var added2 = addCandidate(normal.text, text, candReason2, scores.confidence);
        if(added2) return { action:'candidate', reason:candReason2, candidate:added2 };
      }

      /* 默认丢弃 */
      rejectTrash(text, 'low_value:'+cls.category);
      return { action:'reject', reason:'low_value:'+cls.category };
    }

    /* ==============================================================
       migrateOldMemories — 从 v1 迁移到 v2
       ============================================================== */
    function migrate(){
      var migrationFlag = readJSON(K.migrationV2, null);
      if(migrationFlag && migrationFlag.completed) return { migrated:0, reason:'already_migrated' };

      var store = loadStore();
      var count = 0;

      /* 迁移正式记忆 */
      var oldMemories = loadMemories();
      for(var i=0; i<oldMemories.length; i++){
        var old = oldMemories[i];
        if(!old || !old.content) continue;

        var newMem = newSavedMemory();
        newMem.text = old.content.slice(0,500);
        newMem.tags = Array.isArray(old.tags) ? old.tags.slice() : [];
        newMem.source = 'migrated_v1';
        newMem.created_at = old.createdAt ? new Date(old.createdAt).toISOString() : nowISO();
        newMem.updated_at = old.updatedAt ? new Date(old.updatedAt).toISOString() : nowISO();
        newMem.status = old.enabled !== false ? 'active' : 'archived';

        /* 分类 */
        var oldCategory = old.category || '';
        if(oldCategory === 'explicit_memory_request'){ newMem.type='instruction'; newMem.predicate='requires'; newMem.confidence=0.9; newMem.importance=0.7; }
        else if(oldCategory === 'stable_preference'){ newMem.type='preference'; newMem.predicate='likes'; newMem.confidence=0.7; newMem.importance=0.5; }
        else if(oldCategory === 'correction_rule'){ newMem.type='instruction'; newMem.predicate='forbids'; newMem.confidence=0.8; newMem.importance=0.8; }
        else if(oldCategory === 'long_term_background'){ newMem.type='fact'; newMem.predicate='is'; newMem.confidence=0.7; newMem.importance=0.5; }
        else if(oldCategory === 'project_rule'){ newMem.type='project'; newMem.predicate='requires'; newMem.confidence=0.8; newMem.importance=0.85; }
        else { newMem.type='preference'; newMem.predicate='likes'; newMem.confidence=0.5; newMem.importance=0.4; }

        /* 敏感检查 */
        var isSensitive = false;
        for(var si=0; si<SENSITIVE_PAT.length; si++){
          if(SENSITIVE_PAT[si].test(newMem.text)){ isSensitive = true; break; }
        }
        if(isSensitive){
          logAction('migrate_skip_sensitive', newMem.text, '', '旧记忆含敏感信息，不迁移');
          continue;
        }

        /* 过滤废词 */
        if(newMem.text.length < 4){ continue; }

        /* 去重 */
        var dup = false;
        for(var j=0; j<store.savedMemories.length; j++){
          if(textSimilarity(store.savedMemories[j].text, newMem.text) >= 0.6){ dup = true; break; }
        }
        if(dup) continue;

        store.savedMemories.push(newMem);
        count++;
        logAction('migrate', newMem.text, '', '从 v1 迁移');
      }

      /* 迁移候选 */
      var oldCandidates = loadMemoryCandidates();
      var candCount = 0;
      for(var ci=0; ci<oldCandidates.length; ci++){
        var oc = oldCandidates[ci];
        if(!oc || !oc.content) continue;
        /* 废词检查 */
        var isTrash = false;
        for(var ti=0; ti<TRASH_PAT.length; ti++){ if(TRASH_PAT[ti].test(oc.content)){ isTrash=true; break; } }
        if(isTrash) continue;
        if(oc.content.length < 6) continue;

        var nc = newCandidate();
        nc.proposed_text = oc.content.slice(0,300);
        nc.raw_text = (oc.sourceSummary||'').slice(0,200) || oc.content.slice(0,200);
        nc.reason = '从 v1 候选区迁移';
        nc.confidence = (oc.confidence||1) * 0.25;
        if(!store.candidateMemories) store.candidateMemories = [];
        store.candidateMemories.push(nc);
        candCount++;
        logAction('migrate_candidate', oc.content, '', '从 v1 候选区迁移');
      }

      saveStore(store);
      saveJSON(K.migrationV2, { completed:true, migratedAt:nowISO(), memoriesCount:count, candidatesCount:candCount });
      logAction('migration_complete', '', count+' 条记忆 + '+candCount+' 条候选', 'v1→v2 迁移完成');
      return { migrated:count, candidates:candCount };
    }

    /* ==============================================================
       initMemoryV3 — 初始化
       ============================================================== */
    function init(){
      if(window.__MEMORY_V3_INIT__) return;
      window.__MEMORY_V3_INIT__ = true;

      var migrationFlag = readJSON(K.migrationV2, null);
      if(!migrationFlag || !migrationFlag.completed){
        try{ migrate(); }catch(e){ console.warn('[MemoryV3] Migration failed:', e); }
      }

      logAction('init', '', '', 'MemoryEngine v3 初始化');
    }

    /* ==============================================================
       公开 API
       ============================================================== */
    return {
      KEYS: K,
      loadStore: loadStore,
      saveStore: saveStore,
      classify: classifyV3,
      score: scoreV3,
      normalize: normalizeRaw,
      resolveRef: resolveRef,
      extract: extract,
      upsert: upsert,
      addCandidate: addCandidate,
      rejectTrash: rejectTrash,
      buildHistoryRef: buildHistoryRef,
      retrieve: retrieve,
      buildContext: buildContext,
      log: logAction,
      migrate: migrate,
      init: init,
      similarity: textSimilarity,
      // Pattern banks (for testing)
      PATTERNS: {
        EXPLICIT_REQ: EXPLICIT_REQ,
        PREFERENCE: PREFERENCE_PAT,
        DISLIKE: DISLIKE_PAT,
        INSTRUCTION: INSTRUCTION_PAT,
        BOUNDARY: BOUNDARY_PAT,
        PROJECT: PROJECT_PAT,
        TOOL: TOOL_PAT,
        CONFIRM: CONFIRM_PAT,
        REFER: REFER_PAT,
        TEMP: TEMP_PAT,
        SENSITIVE: SENSITIVE_PAT,
        TRASH: TRASH_PAT,
        NOISE: NOISE_PAT
      }
    };
  })();

  /* 暴露到 window 供测试脚本使用 */
  window.__MEMORY_V3__ = MEMORY_V3;


    function providerTemplate(provider, index){
      provider = normalizeProvider(provider, index);
      return `<div class="preset-card" data-provider-id="${escapeHTML(provider.id)}">
        <div class="preset-card-head"><div class="preset-card-title">${escapeHTML(provider.providerName || '模型提供方')}</div><button class="preset-del" type="button" data-provider-delete="${escapeHTML(provider.id)}">删除</button></div>
        <div class="row"><div class="field"><label>提供方名称</label><input data-provider-field="providerName" value="${escapeHTML(provider.providerName)}" placeholder="DeepSeek / 小米 / OpenAI"></div><div class="field"><label>提供方类型</label><select data-provider-field="providerType"><option value="openai" ${provider.providerType==='openai'?'selected':''}>OpenAI 兼容</option><option value="gemini" ${provider.providerType==='gemini'?'selected':''}>Gemini</option><option value="anthropic" ${provider.providerType==='anthropic'?'selected':''}>Anthropic</option></select></div></div>
        <div class="field"><label>Base URL</label><input data-provider-field="baseUrl" value="${escapeHTML(provider.baseUrl)}" placeholder="https://api.deepseek.com"></div>
        <div class="field"><label>API Key</label><input data-provider-field="apiKey" type="password" value="${escapeHTML(provider.apiKey)}" placeholder="sk-... / AIza... / anthropic key"></div>
        <div class="field"><label>请求路径</label><input data-provider-field="path" value="${escapeHTML(provider.path)}" placeholder="/v1/chat/completions"></div>
        <div class="field"><button class="btn fetch-models-btn" data-fetch-models="${escapeHTML(provider.id)}" type="button">获取模型</button><span class="fetch-models-status" data-fetch-status="${escapeHTML(provider.id)}" style="font-size:12px;margin-left:8px;color:var(--muted)"></span></div>
        <div class="fetch-models-results" data-fetch-results="${escapeHTML(provider.id)}" style="display:none;margin-top:8px;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:14px;padding:8px">
          <input class="model-search-input" data-model-search="${escapeHTML(provider.id)}" placeholder="搜索模型..." style="width:100%;height:36px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.18);padding:0 10px;margin-bottom:8px;font-size:13px;outline:0">
          <div class="model-list-inner" data-model-list="${escapeHTML(provider.id)}"></div>
        </div>
        <div class="field"><label>可用模型（一行一个）</label><textarea class="provider-models" data-provider-field="models" placeholder="deepseek-chat\ndeepseek-reasoner">${escapeHTML(provider.models.join('\n'))}</textarea></div>
        <div style="margin-top:4px"><button class="btn manual-add-toggle" data-manual-toggle="${escapeHTML(provider.id)}" type="button" style="font-size:12px;background:transparent;border:1px dashed var(--line);color:var(--muted)">＋ 手动添加模型</button></div>
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

    /* ── 通用获取模型列表 ── */
    async function fetchModelsForProvider(providerId){
      var card = document.querySelector('[data-provider-id="'+providerId+'"]');
      if(!card) return;
      function val(name){ var el = card.querySelector('[data-provider-field="'+name+'"]'); return el ? el.value.trim() : ''; }
      var baseUrl = val('baseUrl');
      var apiKey = val('apiKey');
      if(!baseUrl){ toast('请先填写 Base URL'); return; }
      if(!apiKey){ toast('请先填写 API Key'); return; }

      var statusEl = card.querySelector('[data-fetch-status="'+providerId+'"]');
      var resultsEl = card.querySelector('[data-fetch-results="'+providerId+'"]');
      var btn = card.querySelector('[data-fetch-models="'+providerId+'"]');
      if(statusEl) statusEl.textContent = '获取中...';
      if(btn){ btn.textContent = '获取中...'; btn.disabled = true; }

      try{
        var res = await fetch('/models/list', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({ providerName: val('providerName'), baseUrl: baseUrl, apiKey: apiKey })
        });
        var data = await res.json();
        if(data.ok && data.models && data.models.length){
          if(statusEl) statusEl.textContent = '已获取 ' + data.models.length + ' 个模型';
          if(btn){ btn.textContent = '已获取'; btn.disabled = false; }
          var currentModels = splitModels(val('models'));
          var listHtml = data.models.map(function(m){
            var added = currentModels.indexOf(m.id) >= 0;
            return '<div class="model-list-row"><span class="model-list-name">'+escapeHTML(m.id)+'</span><button class="model-add-btn '+(added?'remove':'add')+'" data-model-name="'+escapeHTML(m.id)+'" data-provider-id="'+escapeHTML(providerId)+'">'+(added?'−':'＋')+'</button></div>';
          }).join('');
          var listEl = card.querySelector('[data-model-list="'+providerId+'"]');
          if(listEl) listEl.innerHTML = listHtml;
          if(resultsEl) resultsEl.style.display = 'block';
        }else{
          if(statusEl) statusEl.textContent = data.error || '获取失败，点此重试';
          if(btn){ btn.textContent = '获取失败，点此重试'; btn.disabled = false; }
        }
      }catch(err){
        if(statusEl) statusEl.textContent = '网络错误，点此重试';
        if(btn){ btn.textContent = '获取失败，点此重试'; btn.disabled = false; }
      }
    }

    function toggleModelInProvider(providerId, modelName){
      var card = document.querySelector('[data-provider-id="'+providerId+'"]');
      if(!card) return;
      var textarea = card.querySelector('[data-provider-field="models"]');
      if(!textarea) return;
      var models = splitModels(textarea.value);
      var idx = models.indexOf(modelName);
      if(idx >= 0){
        models.splice(idx, 1);
      }else{
        models.push(modelName);
      }
      textarea.value = models.join('\n');
      /* Update button state */
      var btn = card.querySelector('[data-model-name="'+modelName+'"]');
      if(btn){
        if(idx >= 0){ btn.textContent = '＋'; btn.classList.remove('remove'); btn.classList.add('add'); }
        else{ btn.textContent = '−'; btn.classList.remove('add'); btn.classList.add('remove'); }
      }
      /* Save immediately */
      collectProviderEditor(); persist(); renderModelSwitcher();
    }

    function openSettings(){ closeModelPopover(); closeAdvanced(); if(window.innerWidth<760) sidebarOpen=false; renderSidebar(); settings=ensureSettingsShape(settings); renderProviderEditor(); $('#providerModal').classList.add('show'); document.body.classList.add('modal-open'); }
    function closeSettings(){ $('#providerModal').classList.remove('show'); document.body.classList.remove('modal-open'); }
    function saveSettings(){ collectProviderEditor(); persist(); renderModelSwitcher(); closeSettings(); toast('已保存'); }

    /* ── 高级设置 ── */
    function openAdvanced(){ closeModelPopover(); if(window.innerWidth<760) sidebarOpen=false; renderSidebar(); renderAdvancedSettings(); $('#advancedModal').classList.add('show'); document.body.classList.add('modal-open'); }
    function closeAdvanced(){ $('#advancedModal').classList.remove('show'); document.body.classList.remove('modal-open'); }

    function renderAdvancedSettings(){
      const box = $('#advancedBody');
      if(!box) return;
      const personalization = loadPersonalization();
      const presets = modelPresets();
      const currentPreset = activePreset();
      const params = getModelParams(currentPreset.id);
      const memories = loadMemories();
      const autoExtract = loadAutoExtract();
      const memoryGlobalOn = loadMemoryGlobal();
      const tokenDisplay = loadTokenDisplay();
      box.innerHTML = `
        <div class="hint" style="margin-bottom:14px">每个板块都可以折叠展开。修改后自动保存。</div>

        <div class="adv-section">
          <button class="adv-section-head" data-adv-toggle="section-theme">
            <span>外观与主题</span>
            <span class="adv-arrow">▾</span>
          </button>
          <div class="adv-section-body" id="section-theme">
            <div class="field"><label>主题模式</label>
              <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
                <button class="pill theme-mode-pill${loadThemeMode()==='system'?' active':''}" data-theme-mode="system">跟随系统</button>
                <button class="pill theme-mode-pill${loadThemeMode()==='light'?' active':''}" data-theme-mode="light">浅色</button>
                <button class="pill theme-mode-pill${loadThemeMode()==='dark'?' active':''}" data-theme-mode="dark">深色</button>
              </div>
            </div>
          </div>
        </div>

        <div class="adv-section">
          <button class="adv-section-head" data-adv-toggle="section-params">
            <span>模型参数设置</span>
            <span class="adv-arrow">▾</span>
          </button>
          <div class="adv-section-body" id="section-params">
            <div class="field">
              <label>选择模型</label>
              <select id="adv-model-select" style="height:46px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:0 14px;outline:0;font:inherit;width:100%">${
                presets.map(function(p){ return '<option value="'+escapeHTML(p.id)+'"'+(p.id===currentPreset.id?' selected':'')+'>'+escapeHTML(p.label||p.model)+'</option>'; }).join('')
              }</select>
            </div>
            <div id="adv-params-panel">
              <div class="row"><div class="field"><label>Temperature <span class="param-val" id="pv-temperature">${params.temperature}</span></label><input type="range" class="param-slider" data-param="temperature" min="0" max="2" step="0.05" value="${params.temperature}"></div>
              <div class="field"><label>Top P <span class="param-val" id="pv-top_p">${params.top_p}</span></label><input type="range" class="param-slider" data-param="top_p" min="0" max="1" step="0.05" value="${params.top_p}"></div></div>
              <div class="row"><div class="field"><label>Max Tokens <span class="param-val" id="pv-max_tokens">${params.max_tokens||'默认'}</span></label><input type="range" class="param-slider" data-param="max_tokens" min="0" max="16384" step="256" value="${params.max_tokens}"></div>
              <div class="field"><label>Presence Penalty <span class="param-val" id="pv-presence_penalty">${params.presence_penalty}</span></label><input type="range" class="param-slider" data-param="presence_penalty" min="-2" max="2" step="0.1" value="${params.presence_penalty}"></div></div>
              <div class="row"><div class="field"><label>Frequency Penalty <span class="param-val" id="pv-frequency_penalty">${params.frequency_penalty}</span></label><input type="range" class="param-slider" data-param="frequency_penalty" min="-2" max="2" step="0.1" value="${params.frequency_penalty}"></div>
              <div class="field"><label>流式输出</label><div style="margin-top:10px"><button class="pill adv-toggle" data-param="stream" data-on="${params.stream?'1':'0'}">${params.stream?'✓ 开启':'关闭'}</button></div></div></div>
              <div class="field" style="margin-top:6px"><label>自定义系统提示词</label><textarea class="param-textarea" data-param="systemPrompt" placeholder="可选：覆盖默认系统提示词" style="width:100%;min-height:60px;resize:vertical;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit">${escapeHTML(params.systemPrompt||'')}</textarea></div>
              <div class="field" style="margin-top:6px"><label>记忆注入 <span class="hint" style="margin-left:10px">开启后，跨聊天记忆会注入到此模型的请求中</span></label><div style="margin-top:6px"><button class="pill adv-toggle" data-param="memoryInjection" data-on="${params.memoryInjection?'1':'0'}">${params.memoryInjection?'✓ 开启':'关闭'}</button></div></div>
              <div class="field" style="margin-top:6px"><label>显示 Token 消耗</label><div style="margin-top:6px"><button class="pill" id="toggle-token-display" data-on="${tokenDisplay?'1':'0'}">${tokenDisplay?'✓ 开启':'关闭'}</button></div></div>
              <div class="field" style="margin-top:6px"><label>自动滚动跟随</label><div style="margin-top:6px"><button class="pill" id="toggle-auto-scroll" data-on="${loadAutoScroll()?'1':'0'}">${loadAutoScroll()?'✓ 开启':'关闭'}</button></div></div>
            </div>
          </div>
        </div>

        <div class="adv-section">
          <button class="adv-section-head" data-adv-toggle="section-persona">
            <span>个性化设置</span>
            <span class="adv-arrow">▾</span>
          </button>
          <div class="adv-section-body" id="section-persona">
            <div class="field"><label>启用个性化</label><div style="margin-top:6px"><button class="pill" id="toggle-persona" data-on="${personalization.enabled?'1':'0'}">${personalization.enabled?'✓ 开启':'关闭'}</button></div></div>
            <div class="field" style="margin-top:10px"><label>个性化内容 <span class="hint">开启后自动注入每次请求的系统提示词</span></label>
              <textarea id="persona-content" placeholder="例如：&#10;· 用轻松自然的语气回复&#10;· 叫我名字&#10;· 技术问题分步骤解释&#10;· 尽量简短&#10;· 保持人味" style="width:100%;min-height:120px;resize:vertical;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit">${escapeHTML(personalization.content)}</textarea></div>
            <button class="btn" id="clear-persona" type="button" style="margin-top:8px">清空个性化</button>
          </div>
        </div>

        <div class="adv-section">
          <button class="adv-section-head" data-adv-toggle="section-memory">
            <span>跨聊天记忆 <span class="hint" style="font-weight:400">(${memories.filter(function(m){return m.enabled!==false;}).length} 条启用)</span></span>
            <span class="adv-arrow">▾</span>
          </button>
          <div class="adv-section-body" id="section-memory">
            <div class="row"><div class="field"><label>启用跨聊天记忆</label><div style="margin-top:6px"><button class="pill" id="toggle-memory-global" data-on="${memoryGlobalOn?'1':'0'}">${memoryGlobalOn?'✓ 开启':'关闭'}</button></div></div>
            <div class="field"><label>自动提取记忆</label><div style="margin-top:6px"><button class="pill" id="toggle-auto-extract" data-on="${autoExtract?'1':'0'}">${autoExtract?'✓ 开启':'关闭'}</button></div></div></div>
            <div class="field" style="margin-top:8px"><label>搜索记忆</label><input id="memory-search" placeholder="输入关键词搜索..." style="height:42px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:0 14px;outline:0;font:inherit;width:100%"></div>
            <div id="memory-list-area" style="margin-top:10px"></div>
            <button class="btn" id="add-memory-btn" type="button" style="margin-top:10px">＋ 新增记忆</button>
            <button class="btn danger" id="clear-all-memory" type="button" style="margin-top:8px">清空全部记忆</button>
          </div>
        </div>`;
      renderMemoryList();
    }

    function renderMemoryList(){
      const area = $('#memory-list-area');
      if(!area) return;
      const memories = loadMemories();
      const keyword = ($('#memory-search') && $('#memory-search').value.trim().toLowerCase()) || '';
      const filtered = keyword ? memories.filter(function(m){ return (m.content||'').toLowerCase().indexOf(keyword) >= 0 || (m.tags||[]).some(function(t){ return t.toLowerCase().indexOf(keyword) >= 0; }); }) : memories;
      if(!filtered.length){
        area.innerHTML = '<div style="padding:16px 0;color:var(--muted);font-size:14px;text-align:center">' + (keyword ? '没有匹配的记忆' : '还没有记忆') + '</div>';
        return;
      }
      area.innerHTML = filtered.map(function(m){
        const enabled = m.enabled !== false;
        const tags = Array.isArray(m.tags) ? m.tags.join('、') : '';
        return '<div class="mem-item" data-mem-id="'+escapeHTML(m.id)+'">' +
          '<div class="mem-content">'+escapeHTML((m.content||'').slice(0,200))+'</div>' +
          (tags ? '<div class="mem-tags">🏷 '+escapeHTML(tags)+'</div>' : '') +
          '<div class="mem-actions">' +
            '<button class="pill mem-toggle" data-mem-action="toggle" data-mem-id="'+escapeHTML(m.id)+'" data-on="'+(enabled?'1':'0')+'">'+(enabled?'✓ 已启用':'已禁用')+'</button>' +
            '<button class="pill mem-edit-btn" data-mem-action="edit" data-mem-id="'+escapeHTML(m.id)+'">编辑</button>' +
            '<button class="pill danger" data-mem-action="delete" data-mem-id="'+escapeHTML(m.id)+'">删除</button>' +
          '</div></div>';
      }).join('');
    }


    function openMemoryEdit(memory){
      const modal = $('#memoryEditModal');
      if(!modal) return;
      closeModelPopover(); if(window.innerWidth<760) sidebarOpen=false; renderSidebar();
      $('#memoryEditTitle').textContent = memory ? '编辑记忆' : '新增记忆';
      document.body.classList.add('modal-open');
      const content = $('#memoryEditContent'); if(content) content.value = memory ? (memory.content||'') : '';
      const tags = $('#memoryEditTags'); if(tags) tags.value = (memory && Array.isArray(memory.tags)) ? memory.tags.join(', ') : '';
      if(content) content._editId = memory ? memory.id : null;
      modal.classList.add('show');
    }
    function closeMemoryEdit(){ $('#memoryEditModal').classList.remove('show'); document.body.classList.remove('modal-open'); }
    function saveMemoryEdit(){
      const modal = $('#memoryEditModal'); if(!modal) return;
      const content = $('#memoryEditContent'); if(!content) return;
      const tags = $('#memoryEditTags');
      const text = content.value.trim();
      if(!text){ toast('记忆内容不能为空'); return; }
      const tagArr = tags ? tags.value.split(/[,，、\s]+/).map(function(s){ return s.trim(); }).filter(Boolean) : [];
      const editId = content._editId || null;
      let memories = loadMemories();
      if(editId){
        const idx = memories.findIndex(function(m){ return m.id === editId; });
        if(idx >= 0){
          memories[idx].content = text;
          memories[idx].tags = tagArr;
          memories[idx].updatedAt = Date.now();
        }
      }else{
        memories.push({ id: uid(), content: text, tags: tagArr, createdAt: Date.now(), updatedAt: Date.now(), enabled: true });
      }
      saveMemories(memories);
      closeMemoryEdit();
      renderMemoryList();
      toast(editId ? '已更新记忆' : '已添加记忆');
    }

    function saveCurrentModelParams(){
      const select = $('#adv-model-select');
      if(!select) return;
      const presetId = select.value;
      const params = getModelParams(presetId);
      document.querySelectorAll('#adv-params-panel [data-param]').forEach(function(el){
        const name = el.getAttribute('data-param');
        if(name === 'systemPrompt'){ params[name] = el.value; return; }
        if(name === 'stream' || name === 'memoryInjection'){ params[name] = el.getAttribute('data-on') === '1'; return; }
        var val = parseFloat(el.value);
        if(!isNaN(val)) params[name] = val;
      });
      setModelParams(presetId, params);
    }

    document.addEventListener('click', function(e){
      /* 高级设置 - 折叠面板 */
      var toggleHead = e.target.closest('[data-adv-toggle]');
      if(toggleHead){
        var targetId = toggleHead.getAttribute('data-adv-toggle');
        var body = document.getElementById(targetId);
        if(body){ body.classList.toggle('collapsed'); }
        return;
      }
      /* 高级设置 - 切换模型时加载对应参数 */
      if(e.target.closest('#adv-model-select')){
        setTimeout(function(){
          var select = $('#adv-model-select');
          if(!select) return;
          var presetId = select.value;
          var params = getModelParams(presetId);
          var panel = $('#adv-params-panel');
          if(!panel) return;
          panel.innerHTML = '<div class="row"><div class="field"><label>Temperature <span class="param-val" id="pv-temperature">'+params.temperature+'</span></label><input type="range" class="param-slider" data-param="temperature" min="0" max="2" step="0.05" value="'+params.temperature+'"></div>' +
          '<div class="field"><label>Top P <span class="param-val" id="pv-top_p">'+params.top_p+'</span></label><input type="range" class="param-slider" data-param="top_p" min="0" max="1" step="0.05" value="'+params.top_p+'"></div></div>' +
          '<div class="row"><div class="field"><label>Max Tokens <span class="param-val" id="pv-max_tokens">'+(params.max_tokens||'默认')+'</span></label><input type="range" class="param-slider" data-param="max_tokens" min="0" max="16384" step="256" value="'+params.max_tokens+'"></div>' +
          '<div class="field"><label>Presence Penalty <span class="param-val" id="pv-presence_penalty">'+params.presence_penalty+'</span></label><input type="range" class="param-slider" data-param="presence_penalty" min="-2" max="2" step="0.1" value="'+params.presence_penalty+'"></div></div>' +
          '<div class="row"><div class="field"><label>Frequency Penalty <span class="param-val" id="pv-frequency_penalty">'+params.frequency_penalty+'</span></label><input type="range" class="param-slider" data-param="frequency_penalty" min="-2" max="2" step="0.1" value="'+params.frequency_penalty+'"></div>' +
          '<div class="field"><label>流式输出</label><div style="margin-top:10px"><button class="pill adv-toggle" data-param="stream" data-on="'+(params.stream?'1':'0')+'">'+(params.stream?'✓ 开启':'关闭')+'</button></div></div></div>' +
          '<div class="field" style="margin-top:6px"><label>自定义系统提示词</label><textarea class="param-textarea" data-param="systemPrompt" placeholder="可选：覆盖默认系统提示词" style="width:100%;min-height:60px;resize:vertical;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit">'+escapeHTML(params.systemPrompt||'')+'</textarea></div>' +
          '<div class="field" style="margin-top:6px"><label>记忆注入 <span class="hint" style="margin-left:10px">开启后，跨聊天记忆会注入到此模型的请求中</span></label><div style="margin-top:6px"><button class="pill adv-toggle" data-param="memoryInjection" data-on="'+(params.memoryInjection?'1':'0')+'">'+(params.memoryInjection?'✓ 开启':'关闭')+'</button></div></div>';
        }, 10);
        return;
      }
      /* 参数滑块实时更新数值 */
      var slider = e.target.closest('.param-slider');
      if(slider){
        var name = slider.getAttribute('data-param');
        var valEl = document.getElementById('pv-'+name);
        if(valEl){
          var val = parseFloat(slider.value);
          if(name === 'max_tokens') valEl.textContent = val > 0 ? val : '默认';
          else valEl.textContent = val;
        }
        return;
      }
      /* 参数切换按钮 */
      var advToggle = e.target.closest('.adv-toggle');
      if(advToggle){
        var on = advToggle.getAttribute('data-on') === '1';
        advToggle.setAttribute('data-on', on ? '0' : '1');
        advToggle.textContent = on ? '关闭' : '✓ 开启';
        saveCurrentModelParams();
        return;
      }
      /* 参数文本域自动保存 */
      var paramTextarea = e.target.closest('.param-textarea');
      if(!paramTextarea && e.target.closest('.param-textarea')){} /* handled by input event */
    });
    /* 参数文本域 input 事件 */
    document.addEventListener('input', function(e){
      if(e.target.closest('.param-slider')){
        e.preventDefault();
        var slider = e.target;
        var name = slider.getAttribute('data-param');
        var valEl = document.getElementById('pv-'+name);
        if(valEl){
          var val = parseFloat(slider.value);
          if(name === 'max_tokens') valEl.textContent = val > 0 ? val : '默认';
          else valEl.textContent = val;
        }
        saveCurrentModelParams();
        return;
      }
      if(e.target.closest('.param-textarea')){
        saveCurrentModelParams();
        return;
      }
    });

    /* ── 高级设置事件绑定 ── */
    var _el_openAdvanced = $('#openAdvanced'); if(_el_openAdvanced) _el_openAdvanced.onclick = openAdvanced;
    var _el_closeAdvanced = $('#closeAdvanced'); if(_el_closeAdvanced) _el_closeAdvanced.onclick = closeAdvanced;
    var _el_closeAdvancedBtn = $('#closeAdvancedBtn'); if(_el_closeAdvancedBtn) _el_closeAdvancedBtn.onclick = closeAdvanced;

    /* 个性化 */
    document.addEventListener('click', function(e){
      if(e.target.closest('#toggle-persona')){
        var btn = $('#toggle-persona');
        if(!btn) return;
        var on = btn.getAttribute('data-on') === '1';
        btn.setAttribute('data-on', on ? '0' : '1');
        btn.textContent = on ? '关闭' : '✓ 开启';
        var p = loadPersonalization();
        p.enabled = !on;
        savePersonalization(p);
        toast(on ? '已关闭个性化' : '已开启个性化');
        return;
      }
      if(e.target.closest('#clear-persona')){
        var contentEl = $('#persona-content');
        if(contentEl) contentEl.value = '';
        var p = loadPersonalization();
        p.content = '';
        savePersonalization(p);
        toast('已清空个性化内容');
        return;
      }
    });
    document.addEventListener('input', function(e){
      if(e.target.closest('#persona-content')){
        var p = loadPersonalization();
        p.content = e.target.value;
        savePersonalization(p);
        return;
      }
    });

    /* 记忆 */
    document.addEventListener('click', function(e){
      /* 新增记忆 */
      if(e.target.closest('#add-memory-btn')){
        var contentInput = $('#memory-search');
        var prefill = (contentInput && contentInput.value.trim()) ? contentInput.value.trim() : '';
        openMemoryEdit(prefill ? { content: prefill, tags: [] } : null);
        return;
      }
      /* 记忆 toggle */
      var memToggle = e.target.closest('[data-mem-action="toggle"]');
      if(memToggle){
        var memId = memToggle.getAttribute('data-mem-id');
        var memories = loadMemories();
        var found = false;
        memories = memories.map(function(m){
          if(m.id === memId){ found = true; var en = m.enabled !== false; m.enabled = !en; }
          return m;
        });
        if(found){ saveMemories(memories); renderMemoryList(); toast('已切换记忆状态'); }
        return;
      }
      /* 编辑记忆 */
      var memEdit = e.target.closest('[data-mem-action="edit"]');
      if(memEdit){
        var memId2 = memEdit.getAttribute('data-mem-id');
        var memories2 = loadMemories();
        var mem = memories2.find(function(m){ return m.id === memId2; });
        if(mem) openMemoryEdit(mem);
        return;
      }
      /* 删除单条记忆 */
      var memDel = e.target.closest('[data-mem-action="delete"]');
      if(memDel){
        if(!confirm('确定要删除这条记忆吗？')) return;
        var memId3 = memDel.getAttribute('data-mem-id');
        var memories3 = loadMemories().filter(function(m){ return m.id !== memId3; });
        saveMemories(memories3);
        renderMemoryList();
        toast('已删除记忆');
        return;
      }
      /* 清空全部记忆 */
      if(e.target.closest('#clear-all-memory')){
        if(!confirm('确定要清空全部记忆吗？此操作不可恢复。')) return;
        saveMemories([]);
        renderMemoryList();
        toast('已清空全部记忆');
        return;
      }
      /* 跨聊天记忆全局开关（修复：使用独立 flag，同时控制记忆注入参数） */
      if(e.target.closest('#toggle-memory-global')){
        var btn = $('#toggle-memory-global');
        if(!btn) return;
        var on = loadMemoryGlobal();
        var newOn = !on;
        saveMemoryGlobal(newOn);
        /* 同步所有记忆条目的 enabled */
        var mems = loadMemories();
        mems = mems.map(function(m){ m.enabled = newOn; return m; });
        saveMemories(mems);
        /* 同步模型参数中的 memoryInjection */
        var presets = modelPresets();
        presets.forEach(function(p){
          var pp = getModelParams(p.id);
          pp.memoryInjection = newOn;
          setModelParams(p.id, pp);
        });
        btn.setAttribute('data-on', newOn ? '1' : '0');
        btn.textContent = newOn ? '✓ 开启' : '关闭';
        renderMemoryList();
        toast(newOn ? '已开启跨聊天记忆' : '已关闭跨聊天记忆');
        return;
      }
      /* 自动提取记忆开关 */
      if(e.target.closest('#toggle-auto-extract')){
        var btn2 = $('#toggle-auto-extract');
        if(!btn2) return;
        var on2 = btn2.getAttribute('data-on') === '1';
        btn2.setAttribute('data-on', on2 ? '0' : '1');
        btn2.textContent = on2 ? '关闭' : '✓ 开启';
        saveAutoExtract(!on2);
        toast(on2 ? '已关闭自动提取' : '已开启自动提取记忆');
        return;
      }
      if(e.target.closest('#toggle-token-display')){
        var btnT = $('#toggle-token-display');
        if(!btnT) return;
        var onT = btnT.getAttribute('data-on') === '1';
        btnT.setAttribute('data-on', onT ? '0' : '1');
        btnT.textContent = onT ? '关闭' : '✓ 开启';
        saveTokenDisplay(!onT);
        toast(onT ? '已关闭 Token 显示' : '已开启 Token 显示');
        renderMessages();
        return;
      }
      /* 主题模式 */
      if(e.target.closest('.theme-mode-pill')){
        var mode = e.target.getAttribute('data-theme-mode');
        if(!mode) return;
        saveThemeMode(mode);
        theme = resolveTheme();
        renderAll();
        document.querySelectorAll('.theme-mode-pill').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-theme-mode') === mode); });
        toast(mode==='system'?'已切换为跟随系统':mode==='light'?'已切换为浅色':'已切换为深色');
        return;
      }
      /* 自动滚动 */
      if(e.target.closest('#toggle-auto-scroll')){
        var btnS = $('#toggle-auto-scroll');
        if(!btnS) return;
        var onS = btnS.getAttribute('data-on') === '1';
        btnS.setAttribute('data-on', onS ? '0' : '1');
        btnS.textContent = onS ? '关闭' : '✓ 开启';
        saveAutoScroll(!onS);
        toast(onS ? '已关闭自动滚动' : '已开启自动滚动跟随');
        return;
      }
    });
    /* 记忆搜索 */
    document.addEventListener('input', function(e){
      if(e.target.closest('#memory-search')){
        renderMemoryList();
        return;
      }
    });
    /* 记忆编辑模态框 */
    var _el_closeMem = $('#closeMemoryEdit'); if(_el_closeMem) _el_closeMem.onclick = closeMemoryEdit;
    var _el_cancelMem = $('#cancelMemoryEdit'); if(_el_cancelMem) _el_cancelMem.onclick = closeMemoryEdit;
    var _el_saveMem = $('#saveMemoryEdit'); if(_el_saveMem) _el_saveMem.onclick = saveMemoryEdit;

    document.addEventListener('click', e=>{
      const presetBtn = e.target.closest('[data-model-preset]');
      if(presetBtn){ settings.activePresetId = presetBtn.getAttribute('data-model-preset'); syncLegacySettings(); persist(); renderModelSwitcher(); closeModelMenu(); toast('已切换模型'); return; }
      const manage = e.target.closest('#manageModels');
      if(manage){ closeModelMenu(); openSettings(); return; }
      if(e.target.closest('#modelTopTrigger')){ toggleModelPopover(); return; }
      if(!e.target.closest('#modelPopover') && !e.target.closest('#modelTopTrigger')) closeModelPopover();
      const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); safeClearAttachments(); if(window.innerWidth<760) sidebarOpen=false; renderAll(); }
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
      /* Fetch models button */
      var fetchBtn = e.target.closest('[data-fetch-models]');
      if(fetchBtn){
        var pid = fetchBtn.getAttribute('data-fetch-models');
        if(pid) fetchModelsForProvider(pid);
        return;
      }
      /* Model add/remove button */
      var modelAddBtn = e.target.closest('.model-add-btn');
      if(modelAddBtn){
        var mid = modelAddBtn.getAttribute('data-provider-id');
        var mname = modelAddBtn.getAttribute('data-model-name');
        if(mid && mname) toggleModelInProvider(mid, mname);
        return;
      }
    });
    /* Model search */
    document.addEventListener('input', function(e){
      var searchInput = e.target.closest('[data-model-search]');
      if(searchInput){
        var pid = searchInput.getAttribute('data-model-search');
        var keyword = searchInput.value.trim().toLowerCase();
        var listEl = document.querySelector('[data-model-list="'+pid+'"]');
        if(listEl){
          listEl.querySelectorAll('.model-list-row').forEach(function(row){
            var name = (row.querySelector('.model-list-name')||{}).textContent || '';
            row.style.display = !keyword || name.toLowerCase().indexOf(keyword) >= 0 ? '' : 'none';
          });
        }
        return;
      }
    });
    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();}; $('#openSide').onclick=()=>{closeModelPopover(); sidebarOpen=true;renderAll();}; $('#topNewChatBtn').onclick=startNewChat;
    $('#openProvider').onclick=openSettings; $('#closeProvider').onclick=closeSettings; $('#cancelProvider').onclick=closeSettings; $('#saveProvider').onclick=saveSettings;
    $('#addPreset').onclick=()=>{ collectProviderEditor(); const n=settings.modelProviders.length+1; settings.modelProviders.push(normalizeProvider({id:'p_custom_'+Date.now(),providerType:'openai',providerName:'新提供方 '+n,baseUrl:'',apiKey:'',path:'/v1/chat/completions',models:['']}, n)); renderProviderEditor(); };
    $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });

    /* ── 模态框：点击遮罩关闭 ── */
    ['providerModal','advancedModal','memoryEditModal'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('click', function(e){
        if(e.target === el){
          if(id === 'providerModal') closeSettings();
          else if(id === 'advancedModal') closeAdvanced();
          else if(id === 'memoryEditModal') closeMemoryEdit();
        }
      });
    });

    /* ── 模态框：左滑/右滑关闭 ── */
    (function(){
      var swipeStartX = 0, swipeStartY = 0, swipeEl = null;
      document.addEventListener('touchstart', function(e){
        var modal = e.target.closest('.modal-backdrop.show');
        if(!modal) return;
        var touch = e.touches[0];
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
        swipeEl = modal;
      }, {passive:true});

      document.addEventListener('touchmove', function(e){
        if(!swipeEl) return;
        var touch = e.touches[0];
        var dx = touch.clientX - swipeStartX;
        var dy = touch.clientY - swipeStartY;
        if(Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)){
          swipeEl.style.transform = 'translateX(' + dx + 'px)';
          swipeEl.style.transition = 'none';
        }
      }, {passive:true});

      document.addEventListener('touchend', function(e){
        if(!swipeEl){
          swipeEl = null;
          return;
        }
        var touch = e.changedTouches[0];
        var dx = touch.clientX - swipeStartX;
        swipeEl.style.transform = '';
        swipeEl.style.transition = '';
        if(Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(touch.clientY - swipeStartY) * 1.2){
          var id = swipeEl.id;
          if(id === 'providerModal') closeSettings();
          else if(id === 'advancedModal') closeAdvanced();
          else if(id === 'memoryEditModal') closeMemoryEdit();
        }
        swipeEl = null;
      }, {passive:true});
    })();

    /* ── ESC 键关闭模态框 ── */
    document.addEventListener('keydown', function(e){
      if(e.key !== 'Escape') return;
      var modals = document.querySelectorAll('.modal-backdrop.show');
      if(!modals.length) return;
      var topModal = modals[modals.length-1];
      var id = topModal.id;
      if(id === 'providerModal') closeSettings();
      else if(id === 'advancedModal') closeAdvanced();
      else if(id === 'memoryEditModal') closeMemoryEdit();
    });


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

        input.addEventListener('input', function(){ schedule(20); scrollLatest(); autoResizeTextarea(this); });
    function autoResizeTextarea(ta){
      ta.style.height='44px';
      var maxH=120;
      var nh=Math.min(ta.scrollHeight, maxH);
      ta.style.height=nh+'px';
      ta.style.overflowY=ta.scrollHeight > maxH ? 'auto' : 'hidden';
    }
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
    /* 预初始化记忆引擎（后台加载向量模型） */
    initMemoryEngine();

    /* ── 主题：跟随系统 ── */
    try{
    if(window.matchMedia){
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){
        if(loadThemeMode() === 'system'){ theme = resolveTheme(); renderAll(); }
      });
    }
    }catch(_e1){}

    /* ── 加号附件菜单（函数定义在 try 外，严格模式安全） ── */
    var _attachments = [];
    var _plusOpen = false;

    function openPlusMenu(){
      _plusOpen = true;
      var menu = $('#plusMenu'); if(!menu) return;
      var btn = $('#plusBtn'); if(btn) btn.textContent = '×';
      menu.style.display = 'flex';
      menu.style.opacity = '0';
      menu.style.transform = 'translateY(8px)';
      requestAnimationFrame(function(){
        menu.style.transition = 'opacity 180ms ease-out, transform 180ms ease-out';
        menu.style.opacity = '1';
        menu.style.transform = 'translateY(0)';
      });
    }

    function closePlusMenu(){
      _plusOpen = false;
      var menu = $('#plusMenu'); if(!menu) return;
      var btn = $('#plusBtn'); if(btn) btn.textContent = '+';
      menu.style.opacity = '0';
      menu.style.transform = 'translateY(8px)';
      setTimeout(function(){ menu.style.display = 'none'; }, 180);
    }

    function togglePlusMenu(){
      if(_plusOpen) closePlusMenu(); else openPlusMenu();
    }

    function updateSearchVisual(){
      var plusBtn = $('#plusBtn');
      var composer = document.querySelector('.composer');
      if(searchOn){
        if(plusBtn) plusBtn.classList.add('web-active');
        if(composer) composer.classList.add('web-on');
      }else{
        if(plusBtn) plusBtn.classList.remove('web-active');
        if(composer) composer.classList.remove('web-on');
      }
    }

    function showAttachPreview(){
      try{
        var el = $('#attachPreview'); if(!el) return;
        if(!_attachments.length){ el.style.display = 'none'; el.innerHTML = ''; return; }
        el.style.display = 'flex';
        el.innerHTML = _attachments.map(function(a,i){
          return '<span class="attach-chip">'+escapeHTML(a.name)+'<button class="attach-chip-remove" data-attach-idx="'+i+'">×</button></span>';
        }).join('');
      }catch(err){ console.warn('[attach preview] failed:', err); }
    }

    function getFileExt(name){ var parts=(name||'').split('.'); return parts.length>1?parts.pop().toLowerCase():''; }
    function isTextFile(name){ return TEXT_EXTENSIONS.indexOf(getFileExt(name)) >= 0; }
    function isImageFile(name){ return IMAGE_EXTENSIONS.indexOf(getFileExt(name)) >= 0; }
    function isBinaryFile(name){ return SUPPORTED_BINARY.indexOf(getFileExt(name)) >= 0; }

    function addAttachment(file){
      if(_attachments.length >= 5){ toast('最多添加5个附件'); return; }
      var entry = { file:file, name:file.name, type:file.type, size:file.size, content:null, status:'pending' };
      _attachments.push(entry);
      showAttachPreview();
      closePlusMenu();
      /* Read text files immediately */
      if(isTextFile(file.name)){
        var reader = new FileReader();
        reader.onload = function(){
          entry.content = reader.result;
          entry.status = 'ready';
        };
        reader.onerror = function(){ entry.status = 'error'; };
        reader.readAsText(file);
      }else if(isImageFile(file.name)){
        var imgReader = new FileReader();
        imgReader.onload = function(){
          entry.dataUrl = imgReader.result;
          entry.status = 'ready';
        };
        imgReader.onerror = function(){ entry.status = 'error'; };
        imgReader.readAsDataURL(file);
      }else{
        entry.status = 'ready'; // will be sent as binary via FormData
      }
    }

    function safeShowAttachPreview(data){
      try{
        if(typeof showAttachPreview === 'function'){ showAttachPreview(data); }
      }catch(e){ console.warn('[attach] safeShowAttachPreview:', e); }
    }

    function safeClearAttachments(){
      try{ _attachments = []; showAttachPreview(); }catch(e){ _attachments = []; }
    }

    try{
    var _pb = $('#plusBtn'); if(_pb) _pb.onclick = togglePlusMenu;

    document.addEventListener('click', function(e){
      var chipDel = e.target.closest('.attach-chip-remove');
      if(chipDel){
        var idx = parseInt(chipDel.getAttribute('data-attach-idx'));
        if(!isNaN(idx) && idx >= 0 && idx < _attachments.length){
          _attachments.splice(idx, 1);
          showAttachPreview();
        }
        return;
      }
      /* Thinking depth pills */
      var tdPill = e.target.closest('.td-pill');
      if(tdPill){
        var depth = tdPill.getAttribute('data-depth');
        if(depth){
          thinkingDepth = depth;
          saveThinkingDepth(depth);
          var depthLabels = {off:'关',low:'低',medium:'中',high:'高',extreme:'极限'};
          var valEl = $('#thinkingDepthVal');
          if(valEl) valEl.textContent = depthLabels[depth] || '中';
          var pills = document.querySelectorAll('.td-pill');
          pills.forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-depth') === depth); });
        }
        return;
      }
      /* Thinking depth row toggle */
      var tdRow = e.target.closest('.thinking-depth-row');
      if(tdRow){
        var pillsBox = $('#thinkingDepthPills');
        if(pillsBox){
          var show = pillsBox.style.display === 'none';
          pillsBox.style.display = show ? 'flex' : 'none';
          if(show){
            pillsBox.querySelectorAll('.td-pill').forEach(function(p){ p.classList.toggle('active', p.getAttribute('data-depth') === thinkingDepth); });
          }
        }
        return;
      }
      var item = e.target.closest('.plus-menu-item');
      if(item){
        var action = item.getAttribute('data-action');
        if(action === 'camera'){ var ci = document.getElementById('cameraInput'); if(ci) ci.click(); }
        else if(action === 'image'){ var ii = document.getElementById('imageInput'); if(ii) ii.click(); }
        else if(action === 'file'){ var fi = document.getElementById('fileInput'); if(fi) fi.click(); }
        else if(action === 'search'){ searchOn=!searchOn; closePlusMenu(); updateSearchVisual(); }
        return;
      }
      if(_plusOpen && !e.target.closest('#plusMenu') && !e.target.closest('#plusBtn')){
        closePlusMenu();
      }
    });

    var _ci = document.getElementById('cameraInput');
    var _ii = document.getElementById('imageInput');
    var _fi = document.getElementById('fileInput');
    if(_ci) _ci.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
    if(_ii) _ii.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
    if(_fi) _fi.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
    }catch(_e2){}
  }catch(err){
    emergency(err && err.stack ? err.stack : err);
  }
})();
