(async function(){
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

  var FATAL_PATTERNS = [
    /cannot read propert/i, /is not a function/i, /is not defined/i,
    /unexpected token/i, /syntaxerror/i
  ];
  var APP_READY = false;
  function isFatalError(msg){
    var s = String(msg || '');
    if(!APP_READY) return true;
    for(var i=0; i<FATAL_PATTERNS.length; i++){
      if(FATAL_PATTERNS[i].test(s)) return true;
    }
    return false;
  }
  window.addEventListener('error', function(e){
    var msg = e.message || e.error || 'script error';
    if(isFatalError(msg)){ emergency(msg); return; }
    console.warn('[non-fatal]', msg);
  });
  window.addEventListener('unhandledrejection', function(e){
    var msg = (e.reason && e.reason.message) || e.reason || 'promise error';
    if(isFatalError(msg)){ emergency(msg); return; }
    console.warn('[non-fatal promise]', msg);
  });

  try{
    const app = $('#app');
    window.app = app;
    if(!app) throw new Error('#app not found');
    const defaultSettings = { providerType:'openai', providerName:'', baseUrl:'', apiKey:'', model:'', path:'/v1/chat/completions' };
    const legacyDefaultSettings = { providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', model:'deepseek-chat' };
    const defaultPersonalization = { enabled:false, content:'' };

    function loadModelParamsMap(){
      const m = readJSON(KEYS.modelParams, {});
      if(typeof m !== 'object' || !m) return {};
      Object.keys(m).forEach(function(k){ if(!m[k] || typeof m[k] !== 'object') delete m[k]; });
      return m;
    }
    function getModelParams(presetId){
    window.getModelParams = getModelParams;
      const map = loadModelParamsMap();
      const params = map[presetId] ? Object.assign({}, defaultModelParams, map[presetId]) : Object.assign({}, defaultModelParams);
      if(!params.systemPrompt || !String(params.systemPrompt).trim()) params.systemPrompt = DEFAULT_SYSTEM_PROMPT;
      return params;
    }
    function setModelParams(presetId, params){
    window.setModelParams = setModelParams;
      const map = loadModelParamsMap();
      map[presetId] = Object.assign({}, defaultModelParams, params || {});
      saveJSON(KEYS.modelParams, map);
    }
    function loadPersonalization(){
    window.loadPersonalization = loadPersonalization;
      return Object.assign({}, defaultPersonalization, readJSON(KEYS.personalization, {}));
    }
    function savePersonalization(p){
    window.savePersonalization = savePersonalization;
      saveJSON(KEYS.personalization, { enabled:!!p.enabled, content:String(p.content||'') });
    }
    function loadMemories(){
    window.loadMemories = loadMemories;
      const arr = readJSON(KEYS.memories, []);
      return Array.isArray(arr) ? arr.filter(function(m){ return m && typeof m.content === 'string'; }) : [];
    }
    function saveMemories(arr){
    window.saveMemories = saveMemories;
      saveJSON(KEYS.memories, Array.isArray(arr) ? arr : []);
    }
    function loadMemoryGlobal(){
    window.loadMemoryGlobal = loadMemoryGlobal;
      var v = readJSON(KEYS.memoryGlobal, null);
      if(v === true || v === false) return v;
      return true;
    }
    function saveMemoryGlobal(v){
    window.saveMemoryGlobal = saveMemoryGlobal;
      saveJSON(KEYS.memoryGlobal, v === true);
    }
    function loadAutoExtract(){
    window.loadAutoExtract = loadAutoExtract;
      return readJSON(KEYS.autoExtract, true) === true;
    }
    function saveAutoExtract(v){
    window.saveAutoExtract = saveAutoExtract;
      saveJSON(KEYS.autoExtract, v === true);
    }

    /* ── Server Memory API helpers ── */
    var _memoriesMigrated = false;
    window._memoriesMigrated = _memoriesMigrated;
    async function migrateMemoriesToServer(){
    window.migrateMemoriesToServer = migrateMemoriesToServer;
      if(_memoriesMigrated) return;
      var oldMems = loadMemories();
      if(!oldMems.length) return;
      try{
        var res = await authFetch('/api/memory/migrate', {method:'POST', body:JSON.stringify({memories:oldMems})});
        if(res && res.ok){ _memoriesMigrated = true; window._memoriesMigrated = true; console.log('[Mem] migrated '+res.imported+' memories to server'); }
      }catch(e){ console.warn('[Mem] migration deferred:', e.message); }
    }
    async function retrieveMemories(query){
    window.retrieveMemories = retrieveMemories;
      try{
        var res = await authFetch('/api/memory/retrieve', {method:'POST', body:JSON.stringify({query:query, limit:5})});
        if(res && res.ok && Array.isArray(res.memories)) return res.memories;
      }catch(e){ console.warn('[Mem] retrieve failed:', e.message); }
      return [];
    }
    function ingestMemoryFacts(facts){
    window.ingestMemoryFacts = ingestMemoryFacts;
      if(!facts || !facts.length) return;
      authFetch('/api/memory/ingest', {method:'POST', body:JSON.stringify({facts:facts})}).catch(function(e){
        console.warn('[Mem] ingest failed:', e.message);
      });
    }
    function formatMemoryContext(memories){
    window.formatMemoryContext = formatMemoryContext;
      if(!memories || !memories.length) return '';
      var lines = memories.map(function(m){ return '- ' + m.fact; });
      return '\n\n[User Profile]\n' + lines.join('\n');
    }
    function loadAccessPackages(){
    window.loadAccessPackages = loadAccessPackages;
      var v = readJSON(KEYS.accessPackages, []);
      return Array.isArray(v) ? v : [];
    }
    function saveAccessPackages(v){
    window.saveAccessPackages = saveAccessPackages;
      saveJSON(KEYS.accessPackages, Array.isArray(v) ? v : []);
    }
    function loadAccessClaims(){
    window.loadAccessClaims = loadAccessClaims;
      var v = readJSON(KEYS.accessClaims, {});
      return v && typeof v === 'object' ? v : {};
    }
    function saveAccessClaims(v){
    window.saveAccessClaims = saveAccessClaims;
      saveJSON(KEYS.accessClaims, v && typeof v === 'object' ? v : {});
    }
    async function refreshAccessPackages(){
    window.refreshAccessPackages = refreshAccessPackages;
      if(!AUTH_USER || !AUTH_USER.id) return loadAccessPackages();
      try{
        var data = await authFetch('/api/access/packages', {method:'GET', headers:{}});
        if(data && data.ok && Array.isArray(data.packages)){
          saveAccessPackages(data.packages);
          return data.packages;
        }
      }catch(err){
        console.warn('[access] refresh failed:', err);
      }
      return loadAccessPackages();
    }
    function loadTokenDisplay(){
    window.loadTokenDisplay = loadTokenDisplay;
      return readJSON(KEYS.tokenDisplay, false) === true;
    }
    function saveTokenDisplay(v){
    window.saveTokenDisplay = saveTokenDisplay;
      saveJSON(KEYS.tokenDisplay, v === true);
    }
    function loadMemoryCandidates(){
    window.loadMemoryCandidates = loadMemoryCandidates;
      const arr = readJSON(KEYS.memoryCandidates, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveMemoryCandidates(arr){
    window.saveMemoryCandidates = saveMemoryCandidates;
      saveJSON(KEYS.memoryCandidates, Array.isArray(arr) ? arr : []);
    }
    function exportModelParamsBody(presetId, existingBody){
    window.exportModelParamsBody = exportModelParamsBody;
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
    window.emptyPrompts = emptyPrompts;

    function authEscape(s){ return String(s).replace(/[&<>"]/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]); }); }
    function renderAuthPage(mode, message){
    window.renderAuthPage = renderAuthPage;
      mode = mode === 'register' ? 'register' : 'login';
      app.innerHTML = '<div class="auth-shell">'+
        '<div class="auth-card">'+
          '<div class="auth-mark">稻田 AI</div>'+
          '<div class="auth-title">'+(mode==='register'?'创建账号':'登录账号')+'</div>'+
          '<div class="auth-subtitle">'+(mode==='register'?'注册后你的聊天、模型和 API Key 会按账号隔离。':'登录后继续使用你的私有配置和聊天记录。')+'</div>'+
          '<div class="auth-error" id="authError" style="'+(message?'':'display:none')+'">'+authEscape(message||'')+'</div>'+
          '<input class="auth-input" id="authEmail" type="email" autocomplete="email" placeholder="邮箱">'+
          '<input class="auth-input" id="authPassword" type="password" autocomplete="'+(mode==='register'?'new-password':'current-password')+'" placeholder="密码">'+
          (mode==='register'?'<input class="auth-input" id="authConfirm" type="password" autocomplete="new-password" placeholder="确认密码">':'')+
          '<button class="auth-primary" id="authSubmit">'+(mode==='register'?'注册':'登录')+'</button>'+
          '<button class="auth-switch" id="authSwitch">'+(mode==='register'?'已有账号，去登录':'没有账号，去注册')+'</button>'+
          '<button class="auth-switch" id="authBack">返回聊天</button>'+
        '</div>'+
      '</div>';
      var submit = $('#authSubmit');
      var sw = $('#authSwitch');
      var email = $('#authEmail');
      var password = $('#authPassword');
      if(email) setTimeout(function(){ email.focus(); }, 30);
      function showError(msg){ var el = $('#authError'); if(el){ el.textContent = msg; el.style.display = 'block'; } }
      async function submitAuth(){
        var payload = { email:(email&&email.value||'').trim(), password:(password&&password.value||'') };
        if(mode === 'register'){
          var confirm = ($('#authConfirm') && $('#authConfirm').value) || '';
          if(payload.password !== confirm){ showError('两次密码不一致'); return; }
        }
        if(submit){ submit.disabled = true; submit.textContent = mode==='register' ? '注册中...' : '登录中...'; }
        try{
          await authFetch(mode==='register' ? '/api/auth/register' : '/api/auth/login', {method:'POST', body:JSON.stringify(payload)});
          location.reload();
        }catch(err){
          showError(err.message || '操作失败');
          if(submit){ submit.disabled = false; submit.textContent = mode==='register' ? '注册' : '登录'; }
        }
      }
      if(submit) submit.onclick = submitAuth;
      [email,password,$('#authConfirm')].forEach(function(el){ if(el) el.addEventListener('keydown', function(e){ if(e.key === 'Enter') submitAuth(); }); });
      if(sw) sw.onclick = function(){ renderAuthPage(mode==='register'?'login':'register'); };
      var back = $('#authBack');
      if(back) back.onclick = function(){ location.reload(); };
    }
    async function loadAuthData(){
    window.loadAuthData = loadAuthData;
      try{
        var me = await authFetch('/api/auth/me', {method:'GET', headers:{}});
        AUTH_USER = me.user;
        /* Migrate old localStorage memories to server on login */
        if(AUTH_USER && AUTH_USER.id){ setTimeout(function(){ migrateMemoriesToServer().catch(function(){}); }, 2000); }


        AUTH_DATA = {};
        try{
          var data = await authFetch('/api/user/data', {method:'GET', headers:{}});
          AUTH_DATA = data.data && typeof data.data === 'object' ? data.data : {};
          Object.keys(AUTH_DATA).forEach(function(key){
            localStorage.setItem(scopedStorageKey(key), String(AUTH_DATA[key]));
          });
          await refreshAccessPackages();
        }catch(dataErr){
          console.warn('[auth] user data restore failed, continuing with local state:', dataErr && dataErr.message ? dataErr.message : dataErr);
        }
        return true;
      }catch(err){
        AUTH_USER = null;
        AUTH_DATA = {};
        AUTH_SYNC_QUEUE = {};
        return false;
      }
    }
    async function ensureAuthenticated(){
    window.ensureAuthenticated = ensureAuthenticated;
      return loadAuthData();
    }
    function slugify(value){
      return String(value || 'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48) || 'x';
    }
    function splitModels(value){
    window.splitModels = splitModels;
      if(Array.isArray(value)) return value.map(v=>String(v||'').trim()).filter(Boolean);
      return String(value || '')
        .split(/[\n,，;；]+/)
        .map(v=>v.trim())
        .filter(Boolean);
    }
    function makeProviderId(name, baseUrl, i){
    window.makeProviderId = makeProviderId;
      return 'p_' + slugify((name || 'provider') + '_' + (baseUrl || '')) + '_' + i;
    }
    function modelValuesFromProvider(p){
      if(Array.isArray(p.models) || typeof p.models === 'string') return splitModels(p.models);
      if(Array.isArray(p.modelList) || typeof p.modelList === 'string') return splitModels(p.modelList);
      if(typeof p.model === 'string') return splitModels(p.model);
      return [];
    }
    function normalizeProvider(p, i){
    window.normalizeProvider = normalizeProvider;
      p = p && typeof p === 'object' ? p : {};
      const providerName = String(p.providerName || p.name || p.label || '').trim();
      const baseUrl = String(p.baseUrl || '').trim();
      const models = modelValuesFromProvider(p);
      const id = String(p.id || p.providerId || makeProviderId(providerName, baseUrl, i)).trim();
      return {
        id,
        providerType: String(p.providerType || defaultSettings.providerType || 'openai'),
        providerName,
        baseUrl,
        apiKey: String(p.apiKey || '').trim(),
        path: String(p.path || p.requestPath || defaultSettings.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
        models: Array.from(new Set(models))
      };
    }
    function providerHasConfig(provider){
    window.providerHasConfig = providerHasConfig;
      if(!provider) return false;
      return !!(
        (provider.providerName && provider.providerName.trim()) ||
        (provider.baseUrl && provider.baseUrl.trim()) ||
        (provider.apiKey && provider.apiKey.trim()) ||
        (provider.models && provider.models.length) ||
        (provider.path && provider.path !== defaultSettings.path)
      );
    }
    /* 合并重复 provider：同 name+baseUrl → 合并 models 去重 */
    function normalizeProviders(providers){
    window.normalizeProviders = normalizeProviders;
      if(!Array.isArray(providers)) return [];
      var merged = []; var seen = {};
      for(var i=0; i<providers.length; i++){
        var p = providers[i]; if(!p) continue;
        var key = (p.providerName||'').trim().toLowerCase() + '||' + (p.baseUrl||'').trim().toLowerCase();
        var meaningful = !!((p.providerName||'').trim() || (p.baseUrl||'').trim());
        if(!meaningful){
          merged.push({id:p.id, providerType:p.providerType, providerName:p.providerName, baseUrl:p.baseUrl, apiKey:p.apiKey, path:p.path, models:p.models.slice()});
          continue;
        }
        if(seen[key] !== undefined){
          var existing = merged[seen[key]];
          if(p.apiKey && p.apiKey.trim()) existing.apiKey = p.apiKey;
          for(var j=0; j<p.models.length; j++){
            if(!existing.models.includes(p.models[j])) existing.models.push(p.models[j]);
          }
        }else{
          seen[key] = merged.length;
          merged.push({id:p.id, providerType:p.providerType, providerName:p.providerName, baseUrl:p.baseUrl, apiKey:p.apiKey, path:p.path, models:p.models.slice()});
        }
      }
      return merged;
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
    window.providersToPresets = providersToPresets;
      const presets = [];
      providers.forEach(function(provider){
        provider.models.forEach(function(model){ presets.push(presetFromProvider(provider, model, presets.length)); });
      });
      return presets;
    }
    function accessPackageKey(pkg){
      return String(pkg.code || pkg.id || pkg.packageName || '').trim();
    }
    function accessPackageStatus(pkg){
      if(!pkg) return 'inactive';
      if(pkg.enabled === false) return 'disabled';
      if(pkg.expiresAt && Date.parse(pkg.expiresAt) <= Date.now()) return 'expired';
      if(Number(pkg.quotaTotal || 0) > 0 && Number(pkg.quotaUsed || 0) >= Number(pkg.quotaTotal || 0)) return 'quota';
      return 'active';
    }
    function normalizeAccessPackage(pkg, i){
      pkg = pkg && typeof pkg === 'object' ? pkg : {};
      var models = splitModels(pkg.models);
      return {
        id: String(pkg.id || 'pkg_' + i || '').trim(),
        code: String(pkg.code || '').trim(),
        providerUserId: String(pkg.providerUserId || '').trim(),
        providerId: String(pkg.providerId || '').trim(),
        packageName: String(pkg.packageName || pkg.name || '').trim(),
        providerName: String(pkg.providerName || '').trim(),
        models: Array.from(new Set(models)),
        enabled: pkg.enabled !== false,
        quotaTotal: Number(pkg.quotaTotal || 0),
        quotaUsed: Number(pkg.quotaUsed || 0),
        expiresAt: String(pkg.expiresAt || '').trim(),
        createdAt: String(pkg.createdAt || '').trim(),
        updatedAt: String(pkg.updatedAt || '').trim()
      };
    }
    function accessPackageToPreset(pkg, i){
      pkg = normalizeAccessPackage(pkg, i);
      var firstModel = pkg.models[0] || '';
      var code = accessPackageKey(pkg);
      return {
        id: 'access__' + slugify(code || pkg.packageName || ('pkg_' + i)),
        providerId: 'access__' + slugify(code || pkg.packageName || ('pkg_' + i)),
        providerType: 'openai',
        providerName: pkg.packageName || pkg.providerName || '接入模型',
        baseUrl: '',
        apiKey: '',
        path: '/v1/chat/completions',
        model: firstModel,
        label: (pkg.packageName || pkg.providerName || '接入模型') + (firstModel ? ' / ' + firstModel : ''),
        accessCode: code,
        accessPackageId: pkg.id,
        accessStatus: accessPackageStatus(pkg),
        accessPackage: pkg,
        models: pkg.models.slice(),
        readOnly: true,
        packageName: pkg.packageName,
        providerUserId: pkg.providerUserId
      };
    }
    function accessPackagesToPresets(packages){
      var out = [];
      (Array.isArray(packages) ? packages : []).forEach(function(pkg, i){
        var p = normalizeAccessPackage(pkg, i);
        if(!accessPackageKey(p)) return;
        out.push(accessPackageToPreset(p, i));
      });
      return out;
    }
    function providerKeyFromPreset(p){
      return [p.providerType||'openai', p.providerName||'', p.baseUrl||'', p.apiKey||'', p.path||'/v1/chat/completions', p.accessCode||''].join('\n');
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
          providerName: String(p.providerName || p.name || '').trim(),
          baseUrl: String(p.baseUrl || '').trim(),
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
      const legacyModels = splitModels(base.models || base.modelList || base.model || '');
      const hasRealLegacyConfig = !!(
        String(base.apiKey || '').trim() ||
        (String(base.baseUrl || '').trim() && String(base.baseUrl || '').trim() !== legacyDefaultSettings.baseUrl) ||
        (String(base.model || '').trim() && String(base.model || '').trim() !== legacyDefaultSettings.model) ||
        (String(base.providerName || '').trim() && String(base.providerName || '').trim() !== legacyDefaultSettings.providerName)
      );
      if(!hasRealLegacyConfig) return [];
      var provider = normalizeProvider({
        id:'p_legacy_0',
        providerType: base.providerType || 'openai',
        providerName: base.providerName || '',
        baseUrl: base.baseUrl || '',
        apiKey: base.apiKey || '',
        path: base.path || '/v1/chat/completions',
        models: legacyModels
      }, 0);
      return providerHasConfig(provider) ? [provider] : [];
    }
    function ensureSettingsShape(raw){
    window.ensureSettingsShape = ensureSettingsShape;
      var hasProviderList = raw && typeof raw === 'object' && Array.isArray(raw.modelProviders);
      var hasShareProviderList = raw && typeof raw === 'object' && Array.isArray(raw.shareModelProviders);
      var hasPresetList = raw && typeof raw === 'object' && Array.isArray(raw.modelPresets);
      var base = Object.assign({}, defaultSettings, raw || {});
      base.sharePackageProviderId = String(base.sharePackageProviderId || '').trim();
      var providers = [];
      if(hasProviderList){
        providers = base.modelProviders.map(normalizeProvider).filter(providerHasConfig);
        /* 合并重复 provider */
        providers = normalizeProviders(providers);
      }else if(hasPresetList && base.modelPresets.length){
        providers = providersFromPresets(base.modelPresets);
      }
      if(!providers.length && !hasProviderList && !hasPresetList) providers = legacyProviders(base);
      var shareProviders = [];
      if(hasShareProviderList){
        shareProviders = base.shareModelProviders.map(normalizeProvider).filter(providerHasConfig);
        shareProviders = normalizeProviders(shareProviders);
      }
      base.modelProviders = providers;
      base.shareModelProviders = shareProviders;
      base.modelPresets = providersToPresets(providers);
      if(!base.activePresetId || !base.modelPresets.some(function(p){return p.id===base.activePresetId;})){
        var hit = base.modelPresets[0];
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

    await ensureAuthenticated();

    let theme = resolveTheme();
    window.theme = theme;
    settings = ensureSettingsShape(readJSON(scopedStorageKey(KEYS.settings),null) || readJSON(KEYS.settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {});
    let chats = loadChats();
    window.chats = chats;
    activeId = safeGet(KEYS.active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
    sidebarOpen = true;
    searchOn = (function(){ var v = readJSON('daotian.searchOn.v1', null); return v === null ? true : !!v; })();
    function saveSearchOn(v){ saveJSON('daotian.searchOn.v1', !!v); }
    window.saveSearchOn = saveSearchOn;
    sending = false;
    let activeAbortController = null;
    window.activeAbortController = activeAbortController;
    let lastSendAt = 0;
    window.lastSendAt = lastSendAt;
    generatingChatId = null;
    if(!chats.some(c=>c && c.id===activeId)) activeId = chats[0].id;

    function activeChat(){ return chats.find(c=>c && c.id===activeId) || chats[0]; }
    window.activeChat = activeChat;
    function modelPresets(){
    window.modelPresets = modelPresets;
      settings = ensureSettingsShape(settings);
      var own = Array.isArray(settings.modelPresets) ? settings.modelPresets : [];
      var access = accessPackagesToPresets(loadAccessPackages());
      return own.concat(access);
    }
    function activePreset(){
    window.activePreset = activePreset;
      const presets = modelPresets();
      return presets.find(p=>p.id===settings.activePresetId) || presets[0];
    }
    function syncLegacySettings(){
    window.syncLegacySettings = syncLegacySettings;
      const p = activePreset();
      if(!p){
        const firstProvider = (settings.modelProviders && settings.modelProviders[0]) || null;
        settings.providerType = (firstProvider && firstProvider.providerType) || defaultSettings.providerType;
        settings.providerName = (firstProvider && firstProvider.providerName) || '';
        settings.baseUrl = (firstProvider && firstProvider.baseUrl) || '';
        settings.apiKey = (firstProvider && firstProvider.apiKey) || '';
        settings.model = '';
        settings.path = (firstProvider && firstProvider.path) || defaultSettings.path;
        return false;
      }
      settings.providerType = p.providerType;
      settings.providerName = p.providerName;
      settings.baseUrl = p.baseUrl;
      settings.apiKey = p.apiKey;
      settings.model = p.model;
      settings.path = p.path;
      return true;
    }
    function persist(options){
    window.persist = persist;
      const strict = options && options.strict;
      syncLegacySettings();
      if(strict){
        saveJSONStrict(KEYS.chats,chats);
        setItemStrict(KEYS.active,activeId);
        saveJSONStrict(KEYS.settings,settings);
        return;
      }
      saveJSON(KEYS.chats,chats);
      setItem(KEYS.active,activeId);
      saveJSON(KEYS.settings,settings);
    }
    function persistModelSettingsStrict(){
    window.persistModelSettingsStrict = persistModelSettingsStrict;
      syncLegacySettings();
      saveJSONStrict(KEYS.settings, settings);
    }

    /* ── Model state sync ── */
    function findFirstUsableProvider(){
    window.findFirstUsableProvider = findFirstUsableProvider;
      settings = ensureSettingsShape(settings);
      var providers = settings.modelProviders || [];
      for(var i=0; i<providers.length; i++){
        var p = providers[i];
        if(p.apiKey && p.apiKey.trim() && p.baseUrl && p.baseUrl.trim() && p.models && p.models.length){
          return p;
        }
      }
      return null;
    }
    function hasAnyProvider(){
    window.hasAnyProvider = hasAnyProvider;
      settings = ensureSettingsShape(settings);
      return (Array.isArray(settings.modelProviders) && settings.modelProviders.length > 0);
    }
    function hasProviderWithCredentials(){
    window.hasProviderWithCredentials = hasProviderWithCredentials;
      settings = ensureSettingsShape(settings);
      var providers = settings.modelProviders || [];
      for(var i=0; i<providers.length; i++){
        var p = providers[i];
        if(p.apiKey && p.apiKey.trim() && p.baseUrl && p.baseUrl.trim()) return true;
      }
      return false;
    }
    function syncModelState(){
    window.syncModelState = syncModelState;
      settings = ensureSettingsShape(settings);
      var provider = findFirstUsableProvider();
      if(provider){
        var preset = presetFromProvider(provider, provider.models[0], 0);
        settings.activePresetId = preset.id;
        syncLegacySettings();
        saveJSON(KEYS.settings, settings);
        return true;
      }
      syncLegacySettings();
      return false;
    }









    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><span class="sidebar-label">历史对话</span></div>
          <div class="chat-list" id="chatList"></div>
      <div class="sidebar-bottom"><button class="side-bottom-btn settings-only" id="openSettingsBtn">设置</button></div>
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
            <button class="plus-menu-item" data-action="search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg><span>联网</span><span class="search-capsule" id="searchCapsule"><span class="search-capsule-knob"></span></span></button>
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
      <div class="modal-backdrop" id="settingsModal"><div class="settings-shell" id="settingsShell">
        <div class="settings-header">
          <button class="settings-back-btn" id="settingsBackBtn" style="display:none"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <span class="settings-title" id="settingsTitle">设置</span>
          <button class="settings-close-btn" id="settingsCloseBtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="settings-body" id="settingsBody"></div>
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
    renderAll();
    try{ if(typeof initChatEvents === 'function') initChatEvents(); }catch(e){ console.error('initChatEvents failed', e); }
    try{ if(typeof initSettingsEvents === 'function') initSettingsEvents(); }catch(e){ console.error('initSettingsEvents failed', e); }
    try{ if(typeof initUploadEvents === 'function') initUploadEvents(); }catch(e){ console.error('initUploadEvents failed', e); }
    syncModelState();
    applyFontSize(loadFontSize());
    APP_READY = true;
    document.title = '稻田 AI ✓';
    /* Trigger memory migration from localStorage to server if logged in */
    if(AUTH_USER && AUTH_USER.id){ setTimeout(function(){ migrateMemoriesToServer().catch(function(){}); }, 3000); }
    updateSearchVisual();
    setupMobileViewport();
    initUserScrollDetection();
    initThinkingPositionObserver();
    /* 预初始化记忆引擎（后台加载向量模型） */
    initMemoryEngine();

  }catch(err){
    emergency(err && err.stack ? err.stack : err);
  }
})();
