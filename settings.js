'use strict';

/* ==============================================================
   settings.js — 设置系统与 Provider 编辑器模块
   从 app.js 提取，依赖 globals.js（KEYS、readJSON、saveJSON、$、toast 等）
   ============================================================== */

    function providerTemplate(provider, index){
      provider = normalizeProvider(provider, index);
      return `<div class="preset-card" data-provider-id="${escapeHTML(provider.id)}">
        <div class="preset-card-head"><div class="preset-card-title">${escapeHTML(provider.providerName || '模型提供方')}</div><button class="preset-del" type="button" data-provider-delete="${escapeHTML(provider.id)}">删除</button></div>
        <div class="row"><div class="field"><label>提供方名称</label><input data-provider-field="providerName" value="${escapeHTML(provider.providerName)}" placeholder="DeepSeek / 小米 / OpenAI"></div><div class="field"><label>提供方类型</label><select data-provider-field="providerType"><option value="openai" ${provider.providerType==='openai'?'selected':''}>OpenAI 兼容</option><option value="gemini" ${provider.providerType==='gemini'?'selected':''}>Gemini</option><option value="anthropic" ${provider.providerType==='anthropic'?'selected':''}>Anthropic</option></select></div></div>
        <div class="field"><label>Base URL</label><input data-provider-field="baseUrl" value="${escapeHTML(provider.baseUrl)}" placeholder="https://api.deepseek.com"></div>
        <div class="field"><label>API Key</label><div style="position:relative"><input data-provider-field="apiKey" type="password" value="${escapeHTML(provider.apiKey)}" placeholder="sk-... / AIza... / anthropic key" style="width:100%;padding-right:40px"><button class="api-key-eye" data-eye="${escapeHTML(provider.id)}" type="button" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;color:var(--muted);font-size:14px;padding:4px;opacity:.5" title="显示/隐藏"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
        <div class="field"><label>请求路径</label><input data-provider-field="path" value="${escapeHTML(provider.path)}" placeholder="/v1/chat/completions"></div>
        <div class="field"><button class="btn fetch-models-btn" data-fetch-models="${escapeHTML(provider.id)}" type="button">获取模型</button><span class="fetch-models-status" data-fetch-status="${escapeHTML(provider.id)}" style="margin-left:8px;color:var(--muted)"></span></div>
        <div class="fetch-models-results" data-fetch-results="${escapeHTML(provider.id)}" style="display:none;margin-top:8px;max-height:260px;overflow-y:auto;border:1px solid var(--line);border-radius:14px;padding:8px">
          <input class="model-search-input" data-model-search="${escapeHTML(provider.id)}" placeholder="搜索模型..." style="width:100%;height:36px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,.18);padding:0 10px;margin-bottom:8px;outline:0">
          <div class="model-list-inner" data-model-list="${escapeHTML(provider.id)}"></div>
        </div>
        <div class="field"><label>可用模型（一行一个）</label><textarea class="provider-models" data-provider-field="models" placeholder="deepseek-chat\ndeepseek-reasoner">${escapeHTML(provider.models.join('\n'))}</textarea></div>
        <div style="margin-top:4px"><button class="btn manual-add-toggle" data-manual-toggle="${escapeHTML(provider.id)}" type="button" style="background:transparent;border:1px dashed var(--line);color:var(--muted)">＋ 手动添加模型</button></div>
      </div>`;
    }

    function providerHubScopeKey(scope){
      return scope === 'share' ? 'shareModelProviders' : 'modelProviders';
    }
    function providerHubSectionId(scope){
      return scope === 'share' ? 'shareProviderSection' : 'selfProviderSection';
    }
    function providerHubListId(scope){
      return scope === 'share' ? 'shareProviderList' : 'selfProviderList';
    }
    function providerHubAddBtnId(scope){
      return scope === 'share' ? 'shareAddProvider' : 'selfAddProvider';
    }
    function providerHubSaveBtnId(scope){
      return scope === 'share' ? 'shareSaveProvider' : 'selfSaveProvider';
    }
    function providerHubSaveLabel(scope){
      return scope === 'share' ? '保存分享配置' : '保存';
    }
    function providerHubTitle(scope){
      return scope === 'share' ? '分享给别人' : '自己使用';
    }
    function providerHubDesc(scope){
      return scope === 'share'
        ? '配置给别人用的模型，保存后可独立生成接入码'
        : '配置自己的模型，保存后仅当前用户可见';
    }
    function providerHubProviders(scope){
      settings = ensureSettingsShape(settings);
      const key = providerHubScopeKey(scope);
      if(!Array.isArray(settings[key])) settings[key] = [];
      return settings[key];
    }
    function setProviderHubProviders(scope, providers){
      settings = ensureSettingsShape(settings);
      const key = providerHubScopeKey(scope);
      settings[key] = normalizeProviders(Array.isArray(providers) ? providers : []);
      if(scope === 'self'){
        settings.modelPresets = providersToPresets(settings.modelProviders);
      }
      syncLegacySettings();
    }
    function isProviderSectionPage(){
      return settingsPage === 'providerHub' || settingsPage === 'shareHub';
    }
    function providerHubRoot(scope){
      var modal = document.querySelector('#settingsModal');
      if(!modal) return null;
      return modal.querySelector('[data-provider-section="'+scope+'"]');
    }
    function renderProviderSection(scope){
      const providers = providerHubProviders(scope);
      const listId = providerHubListId(scope);
      const addBtnId = providerHubAddBtnId(scope);
      const saveBtnId = providerHubSaveBtnId(scope);
      return '<div class="settings-card provider-section" data-provider-section="'+scope+'">'+
        '<div class="settings-card-title">'+escapeHTML(providerHubTitle(scope))+'</div>'+
        '<div class="settings-muted">'+escapeHTML(providerHubDesc(scope))+'</div>'+
        '<div id="'+listId+'" class="preset-list">'+providers.map(function(provider, index){ return providerTemplate(provider, index); }).join('')+'</div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">'+
          '<button class="settings-btn" id="'+addBtnId+'" type="button">＋ 添加提供方</button>'+
          '<button class="settings-btn primary" id="'+saveBtnId+'" type="button">'+escapeHTML(providerHubSaveLabel(scope))+'</button>'+
        '</div>'+
      '</div>';
    }
    function collectProviderHubSection(scope){
      const root = providerHubRoot(scope);
      if(!root) return [];
      const cards = Array.from(root.querySelectorAll('[data-provider-id]'));
      const providers = cards.map(function(card, i){
        function val(name){ const el = card.querySelector('[data-provider-field="'+name+'"]'); return el ? el.value.trim() : ''; }
        var rawModels = splitModels(val('models'));
        var seen = {}; var deduped = [];
        for(var mi=0; mi<rawModels.length; mi++){
          var m = rawModels[mi];
          if(m && !seen[m]){ seen[m]=true; deduped.push(m); }
        }
        return normalizeProvider({
          id: card.getAttribute('data-provider-id') || makeProviderId(val('providerName'), val('baseUrl'), i),
          providerType: val('providerType'),
          providerName: val('providerName'),
          baseUrl: val('baseUrl'),
          apiKey: val('apiKey'),
          path: val('path'),
          models: deduped
        }, i);
      }).filter(providerHasConfig);
      setProviderHubProviders(scope, providers);
      return providers;
    }
    function setProviderHubSaveState(scope, state){
      const btn = document.getElementById(providerHubSaveBtnId(scope));
      if(!btn) return;
      if(window.__providerHubSaveTimers__ && window.__providerHubSaveTimers__[scope]){
        clearTimeout(window.__providerHubSaveTimers__[scope]);
        window.__providerHubSaveTimers__[scope] = null;
      }
      btn.dataset.saveState = state || 'idle';
      if(state === 'saving'){
        btn.textContent = scope === 'share' ? '保存中...' : '保存中...';
        btn.disabled = true;
      }else if(state === 'saved'){
        btn.textContent = '已保存 ✓';
        btn.disabled = false;
        window.__providerHubSaveTimers__ = window.__providerHubSaveTimers__ || {};
        window.__providerHubSaveTimers__[scope] = setTimeout(function(){
          if(btn.dataset.saveState === 'saved') setProviderHubSaveState(scope, 'idle');
        }, 1000);
      }else if(state === 'error'){
        btn.textContent = '保存失败';
        btn.disabled = false;
      }else{
        btn.textContent = providerHubSaveLabel(scope);
        btn.disabled = false;
      }
    }
    async function saveProviderHubSection(scope){
      setProviderHubSaveState(scope, 'saving');
      try{
        collectProviderHubSection(scope);
        syncLegacySettings();
        persistModelSettingsStrict();
        if(scope === 'self') renderModelSwitcher();
        setProviderHubSaveState(scope, 'saved');
        if(scope === 'share'){
          toast('分享配置已保存');
          renderSettingsPage();
        }else if(hasUsableModelConfig()) toast('配置已保存');
        else toast('已保存，请先添加模型');
      }catch(err){
        console.error('[provider hub] save failed:', err);
        setProviderHubSaveState(scope, 'error');
        toast('保存失败：' + (err && err.message ? err.message : '未知错误'));
      }
    }

    function renderProviderEditor(){
      ensureModelStyle();
      const box = $('#presetList');
      if(!box) return;
      settings = ensureSettingsShape(settings);
      if(!Array.isArray(settings.modelProviders)) settings.modelProviders = [];
      box.innerHTML = settings.modelProviders.map(providerTemplate).join('');
    }

    function providerEditorScope(){
      if(settingsPage === 'providerHub') return null;
      var old = document.getElementById('providerModal');
      if(old && old.classList.contains('show')) return old;
      return null;
    }

    function setSaveProviderButtonState(state){
      const btn = $('#saveProvider');
      if(!btn) return;
      if(window.__providerSaveTimer__){
        clearTimeout(window.__providerSaveTimer__);
        window.__providerSaveTimer__ = null;
      }
      btn.dataset.saveState = state || 'idle';
      if(state === 'saving'){
        btn.textContent = '保存中...';
        btn.disabled = true;
      }else if(state === 'saved'){
        btn.textContent = '已保存 ✓';
        btn.disabled = false;
        window.__providerSaveTimer__ = setTimeout(function(){
          if(btn.dataset.saveState === 'saved') setSaveProviderButtonState('idle');
        }, 1000);
      }else if(state === 'error'){
        btn.textContent = '保存失败';
        btn.disabled = false;
      }else{
        btn.textContent = '保存';
        btn.disabled = false;
      }
    }

    function collectProviderEditor(){
      const scope = providerEditorScope();
      if(!scope) return;
      const cards = Array.from(scope.querySelectorAll('[data-provider-id]'));
      var providers = cards.map(function(card, i){
        function val(name){ const el = card.querySelector('[data-provider-field="'+name+'"]'); return el ? el.value.trim() : ''; }
        var rawModels = splitModels(val('models'));
        /* 强制去重：去掉空白，用 Set 去重，保持顺序 */
        var seen = {}; var deduped = [];
        for(var mi=0; mi<rawModels.length; mi++){
          var m = rawModels[mi];
          if(m && !seen[m]){ seen[m]=true; deduped.push(m); }
        }
        return normalizeProvider({
          id: card.getAttribute('data-provider-id') || makeProviderId(val('providerName'), val('baseUrl'), i),
          providerType: val('providerType'), providerName: val('providerName'), baseUrl: val('baseUrl'),
          apiKey: val('apiKey'), path: val('path'), models: deduped
        }, i);
      }).filter(providerHasConfig);
      providers = normalizeProviders(providers);
      settings.modelProviders = providers;
      settings.modelPresets = providersToPresets(providers);
      if(!settings.modelPresets.length){
        settings.activePresetId = '';
      }else if(!settings.activePresetId || !settings.modelPresets.some(p=>p.id===settings.activePresetId)){
        settings.activePresetId = settings.modelPresets[0].id;
      }
      syncLegacySettings();
    }

    var __providerAddLock__ = false;
    function addProviderEditorCard(scope){
      if(__providerAddLock__) return;
      scope = scope === 'share' ? 'share' : 'self';
      __providerAddLock__ = true;
      try{
        if(isProviderSectionPage()){
          collectProviderHubSection(scope);
          var providers = providerHubProviders(scope).slice();
          var n = providers.length + 1;
          providers.push(normalizeProvider({
            id: scope + '_p_custom_' + Date.now(),
            providerType:'openai',
            providerName:'新提供方 ' + n,
            baseUrl:'',
            apiKey:'',
            path:'/v1/chat/completions',
            models:[]
          }, n));
          setProviderHubProviders(scope, providers);
          if(scope === 'share'){
            settings.sharePackageProviderId = providers[providers.length - 1] ? providers[providers.length - 1].id : settings.sharePackageProviderId;
          }
          saveJSONStrict(KEYS.settings, settings);
          renderSettingsPage();
          setProviderHubSaveState(scope, 'idle');
        }else{
          collectProviderEditor();
          if(!Array.isArray(settings.modelProviders)) settings.modelProviders = [];
          var n2 = settings.modelProviders.length + 1;
          settings.modelProviders.push(normalizeProvider({
            id:'p_custom_' + Date.now(),
            providerType:'openai',
            providerName:'新提供方 ' + n2,
            baseUrl:'',
            apiKey:'',
            path:'/v1/chat/completions',
            models:[]
          }, n2));
          renderProviderEditor();
          setSaveProviderButtonState('idle');
        }
      }catch(err){
        console.error('[provider] add failed:', err);
        toast('添加提供方失败：' + (err.message || '未知错误'));
      }finally{
        __providerAddLock__ = false;
      }
    }

    /* ── 通用获取模型列表 ── */
    async function fetchModelsForProvider(scope, providerId){
      if(arguments.length === 1){ providerId = scope; scope = 'self'; }
      scope = scope === 'share' ? 'share' : 'self';
      var scopeRoot = isProviderSectionPage() ? providerHubRoot(scope) : providerEditorScope();
      if(!scopeRoot){ toast('页面状态异常，请刷新重试'); return; }
      var card = scopeRoot.querySelector('[data-provider-id="'+providerId+'"]');
      if(!card) return;
      function val(name){ var el = card.querySelector('[data-provider-field="'+name+'"]'); return el ? el.value.trim() : ''; }
      var baseUrl = val('baseUrl');
      var apiKey = val('apiKey');
      var providerName = val('providerName');
      if(!baseUrl){ toast('请先填写 Base URL'); return; }
      if(!apiKey){ toast('请先填写 API Key'); return; }

      var path = val('path') || '/v1/chat/completions';
      var statusEl = card.querySelector('[data-fetch-status="'+providerId+'"]');
      var resultsEl = card.querySelector('[data-fetch-results="'+providerId+'"]');
      var btn = card.querySelector('[data-fetch-models="'+providerId+'"]');
      if(statusEl) statusEl.textContent = '获取中...';
      if(btn){ btn.textContent = '获取中...'; btn.disabled = true; }
      if(resultsEl) resultsEl.style.display = 'none';

      try{
        var payload = { providerName: providerName, baseUrl: baseUrl, apiKey: apiKey, path: path };
        payload.providerScope = scope;
        if(AUTH_USER && AUTH_USER.id) payload.providerId = providerId;
        var data = await authFetch('/models/list', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if(data.ok && data.models && data.models.length){
          var fetchedModels = data.models.map(function(m){ return String(m.id || m.name || '').trim(); }).filter(Boolean);
          var textarea = card.querySelector('[data-provider-field="models"]');
          var currentModels = splitModels(textarea ? textarea.value : val('models'));
          fetchedModels.forEach(function(modelId){
            if(currentModels.indexOf(modelId) < 0) currentModels.push(modelId);
          });
          if(textarea) textarea.value = currentModels.join('\n');
          if(isProviderSectionPage()) collectProviderHubSection(scope);
          else collectProviderEditor();
          if(isProviderSectionPage() && scope === 'share'){
            var shareSelectEl = $('#sharePackageProviderSelect');
            if(shareSelectEl && shareSelectEl.value === providerId) syncPackageEditorModels(providerId);
          }
          if(statusEl) statusEl.textContent = '已获取并加入 ' + fetchedModels.length + ' 个模型';
          setTimeout(function(){ if(btn){ btn.textContent = '获取模型'; btn.disabled = false; } }, 1500);
          var listHtml = data.models.map(function(m){
            var modelId = String(m.id || m.name || '').trim();
            var added = currentModels.indexOf(modelId) >= 0;
            return '<div class="model-list-row"><span class="model-list-name">'+escapeHTML(modelId)+'</span><button class="model-add-btn '+(added?'remove':'add')+'" data-model-name="'+escapeHTML(modelId)+'" data-provider-id="'+escapeHTML(providerId)+'">'+(added?'−':'＋')+'</button></div>';
          }).join('');
          var listEl = card.querySelector('[data-model-list="'+providerId+'"]');
          if(listEl) listEl.innerHTML = listHtml;
          if(resultsEl) resultsEl.style.display = 'block';
        }else if(data.models && !data.models.length){
          if(statusEl) statusEl.textContent = '该 Base URL 返回了空的模型列表';
          if(btn){ btn.textContent = '获取模型'; btn.disabled = false; }
        }else{
          var errMsg = data.error || data.message || '获取失败';
          if(statusEl) statusEl.textContent = errMsg;
          if(btn){ btn.textContent = '获取失败，点此重试'; btn.disabled = false; }
        }
      }catch(err){
        console.error('[models] fetch failed:', err);
        var detail = (err && err.message) ? err.message : '网络错误';
        if(detail.indexOf('Failed to fetch') >= 0 || detail.indexOf('NetworkError') >= 0){
          detail = '网络连接失败，请检查 Base URL 是否正确：' + baseUrl;
        }
        if(statusEl) statusEl.textContent = detail;
        if(btn){ btn.textContent = '获取失败，点此重试'; btn.disabled = false; }
      }
    }

    function toggleModelInProvider(scope, providerId, modelName){
      if(arguments.length === 2){ modelName = providerId; providerId = scope; scope = 'self'; }
      scope = scope === 'share' ? 'share' : 'self';
      var scopeRoot = isProviderSectionPage() ? providerHubRoot(scope) : providerEditorScope();
      var card = scopeRoot ? scopeRoot.querySelector('[data-provider-id="'+providerId+'"]') : null;
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
      if(isProviderSectionPage()){
        collectProviderHubSection(scope);
        saveJSONStrict(KEYS.settings, settings);
        if(scope === 'share'){
          var shareSelectEl2 = $('#sharePackageProviderSelect');
          if(shareSelectEl2 && shareSelectEl2.value === providerId) syncPackageEditorModels(providerId);
        }
        if(scope === 'self') renderModelSwitcher();
      }else{
        collectProviderEditor(); persist(); renderModelSwitcher();
      }
    }

    /* ── 模型提供方草稿管理 ── */
    var _providerDraft = null;
    function openSettings(){ closeModelPopover(); if(window.innerWidth<760) sidebarOpen=false; renderSidebar(); settings=ensureSettingsShape(settings); /* 深拷贝草稿 */ _providerDraft = JSON.parse(JSON.stringify(settings.modelProviders)); renderProviderEditor(); setSaveProviderButtonState('idle'); $('#providerModal').classList.add('show'); document.body.classList.add('modal-open'); }
    function closeSettings(){ /* 丢弃草稿 */ _providerDraft = null; $('#providerModal').classList.remove('show'); document.body.classList.remove('modal-open'); renderModelSwitcher(); }
    function openSettingsModalPage(page){
      closeModelPopover();
      var legacyProviderModal = $('#providerModal');
      if(legacyProviderModal) legacyProviderModal.classList.remove('show');
      sidebarOpen = false;
      renderSidebar();
      settingsPage = page || 'home';
      settingsPageStack = ['home'];
      if(page && page !== 'home') settingsPageStack.push(page);
      renderSettingsPage();
      $('#settingsModal').classList.add('show');
      document.body.classList.add('modal-open');
      document.body.classList.toggle('provider-hub-open', page === 'providerHub');
      document.body.classList.toggle('access-code-open', page === 'access');
    }
    function openAccessPage(){ openSettingsModalPage('access'); }
    function openProviderHub(){ openSettingsModalPage('providerHub'); }
    function openShareHub(){ openSettingsModalPage('shareHub'); }
    async function saveSettings(){
      if(settingsPage === 'providerHub') return;
      setSaveProviderButtonState('saving');
      try{
        await new Promise(function(resolve){ setTimeout(resolve, 250); });
        collectProviderEditor();
        syncModelState();
        persistModelSettingsStrict();
        renderModelSwitcher();
        _providerDraft = null;
        setSaveProviderButtonState('saved');
        if(hasUsableModelConfig()){ toast('配置已保存'); }
        else{ toast('已保存，请先添加模型'); }
        console.log('[settings] saved, key:', KEYS.settings, 'usable:', hasUsableModelConfig(), 'providers:', JSON.stringify(settings.modelProviders.map(function(p){return {name:p.providerName,key:p.apiKey?'***':'EMPTY',baseUrl:p.baseUrl,path:p.path,models:p.models};})));
      }catch(e){
        console.error('[saveSettings] 保存失败:', e);
        setSaveProviderButtonState('error');
        toast('保存失败：' + (e.message || '未知错误'));
      }
    }
    /* 通用保存按钮状态机 */
    function saveButtonFeedback(btnId, successMsg, errorMsg){
      var btn = document.getElementById(btnId);
      if(!btn) return;
      var original = btn.textContent || '保存设置';
      btn.textContent = '保存中...'; btn.disabled = true;
      return {
        done: function(){
          btn.textContent = '已保存 ✓';
          setTimeout(function(){ btn.textContent = original; btn.disabled = false; }, 1000);
          if(successMsg) toast(successMsg);
        },
        fail: function(){
          btn.textContent = '保存失败';
          btn.disabled = false;
          setTimeout(function(){ btn.textContent = original; btn.disabled = false; }, 1500);
          if(errorMsg) toast(errorMsg);
        }
      };
    }
    window.__saveSettings__ = saveSettings;
    function deleteProvider(providerId, scope){
      scope = scope === 'share' ? 'share' : 'self';
      if(isProviderSectionPage()){
        var list = providerHubProviders(scope).slice();
        var prov = list.find(function(p){ return p.id === providerId; });
        if(!prov) return;
        var name = prov.providerName || '模型提供方';
        if(!confirm('确认删除 '+name+'？\n\n删除后该供应商下的所有模型都会从模型列表中移除。')) return;
        list = list.filter(function(p){ return p.id !== providerId; });
        setProviderHubProviders(scope, list);
        if(scope === 'share' && settings.sharePackageProviderId === providerId){
          settings.sharePackageProviderId = list[0] ? list[0].id : '';
        }
        saveJSONStrict(KEYS.settings, settings);
        if(scope === 'self') renderModelSwitcher();
        var bodyEl = $('#settingsBody');
        if(bodyEl) renderSettingsPage();
        else console.error('[deleteProvider] settingsBody not found, skip re-render');
        toast('已删除 '+name);
        return;
      }
      var prov = settings.modelProviders.find(function(p){return p.id===providerId;});
      if(!prov) return;
      var name = prov.providerName || '模型提供方';
      if(!confirm('确认删除 '+name+'？\n\n删除后该供应商下的所有模型都会从模型列表中移除。')) return;
      settings.modelProviders = settings.modelProviders.filter(function(p){return p.id!==providerId;});
      if(!settings.modelProviders.length){ settings.modelProviders = []; }
      settings.modelPresets = providersToPresets(settings.modelProviders);
      _providerDraft = null;
      persist();
      if(settingsPage === 'providerHub') renderSettingsPage();
      else renderProviderEditor();
      renderModelSwitcher();
      toast('已删除 '+name);
    }

    /* ── 统一设置系统 ── */
    var settingsPage = 'home';
    var settingsPageStack = ['home'];

    function openSettingsModal(){
      closeModelPopover();
      if(window.innerWidth<760) sidebarOpen=false;
      renderSidebar();
      settingsPage = 'home';
      settingsPageStack = ['home'];
      renderSettingsPage();
      $('#settingsModal').classList.add('show');
      document.body.classList.add('modal-open');
    }
    function closeSettingsModal(){
      $('#settingsModal').classList.remove('show');
      document.body.classList.remove('modal-open');
      document.body.classList.remove('provider-hub-open','access-code-open');
    }
    function settingsGoTo(page){
      settingsPage = page;
      settingsPageStack.push(page);
      renderSettingsPage();
    }
    function settingsGoBack(){
      if(settingsPageStack.length > 1){
        settingsPageStack.pop();
        settingsPage = settingsPageStack[settingsPageStack.length-1];
      }else{
        settingsPage = 'home';
      }
      renderSettingsPage();
    }

    function renderSettingsPage(){
      var body = $('#settingsBody');
      var title = $('#settingsTitle');
      var backBtn = $('#settingsBackBtn');
      if(!body) return;

      if(settingsPage === 'home'){
        if(title) title.textContent = '设置';
        if(backBtn) backBtn.style.display = 'none';
        body.innerHTML = renderSettingsHome();
      }else if(settingsPage === 'appearance'){
        if(title) title.textContent = '外观与主题';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderAppearancePage();
      }else if(settingsPage === 'model'){
        if(title) title.textContent = '模型与参数';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderModelParamsPage();
      }else if(settingsPage === 'memory'){
        if(title) title.textContent = '记忆设置';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderMemoryPage();
      }else if(settingsPage === 'personalization'){
        if(title) title.textContent = '个性化';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderPersonalizationPage();
      }else if(settingsPage === 'chatPrefs'){
        if(title) title.textContent = '聊天偏好';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderChatPrefsPage();
      }else if(settingsPage === 'voiceSettings'){
        if(title) title.textContent = '语音功能';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderVoiceSettingsPage();
      }else if(settingsPage === 'access'){
        if(title) title.textContent = '接入码';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderAccessPage();
      }else if(settingsPage === 'providerHub'){
        if(title) title.textContent = '模型提供方';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderProviderHubPage();
      }else if(settingsPage === 'shareHub'){
        if(title) title.textContent = '分享给别人';
        if(backBtn) backBtn.style.display = 'flex';
        body.innerHTML = renderShareHubPage();
      }
    }

    function settingsEntry(label, desc, page, icon){
      icon = icon || '›';
      return '<button class="settings-entry" data-settings-go="'+page+'"><span class="settings-entry-icon">'+icon+'</span><span class="settings-entry-text"><span class="settings-entry-title">'+escapeHTML(label)+'</span><span class="settings-entry-desc">'+escapeHTML(desc)+'</span></span><span class="settings-entry-arrow">›</span></button>';
    }

    function renderSettingsHome(){
      var authActions = AUTH_USER && AUTH_USER.id
        ? '<button class="settings-btn danger" id="logoutBtn" type="button">退出登录</button>'
        : '<div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button class="settings-btn" id="loginBtn" type="button">登录</button><button class="settings-btn" id="registerBtn" type="button">注册</button></div>';
      var authLabel = AUTH_USER && AUTH_USER.id ? '当前账号' : '游客模式';
      var authEmail = AUTH_USER && AUTH_USER.email ? AUTH_USER.email : '本地临时保存';
      return '<div class="settings-home">'+
        settingsEntry('接入码','输入别人提供的接入码，获取可用模型','access','�')+
        settingsEntry('模型提供方','配置自己使用的模型','providerHub','◫')+
        settingsEntry('分享给别人','配置分享用模型并生成接入码','shareHub','◎')+
        settingsEntry('外观与主题','跟随系统 / 浅色 / 深色','appearance','○')+
        settingsEntry('模型与参数','模型、Temperature、Top P','model','◇')+
        settingsEntry('记忆设置','跨聊天记忆与自动提取','memory','□')+
        settingsEntry('个性化聊天偏好','系统提示词与回复风格','personalization','▽')+
        settingsEntry('聊天偏好','字体大小 / 流式输出 / 自动滚动 / Token 显示','chatPrefs','✎')+
        settingsEntry('语音功能','Edge TTS / Fish Audio / 音色语速','voiceSettings','♪')+
        '<div class="settings-account"><div><div class="settings-account-label">'+escapeHTML(authLabel)+'</div><div class="settings-account-email">'+escapeHTML(authEmail)+'</div></div>'+authActions+'</div>'+
      '</div>';
    }

    function renderAppearancePage(){
      var mode = loadThemeMode();
      return '<div class="settings-page">'+
        '<div class="settings-card"><div class="settings-card-title">主题模式</div>'+
          '<button class="settings-radio-row'+(mode==='system'?' selected':'')+'" data-theme-mode="system"><span class="settings-radio-dot"></span><span class="settings-radio-text"><span class="settings-radio-title">跟随系统</span><span class="settings-radio-desc">根据系统设置自动切换主题</span></span></button>'+
          '<button class="settings-radio-row'+(mode==='light'?' selected':'')+'" data-theme-mode="light"><span class="settings-radio-dot"></span><span class="settings-radio-text"><span class="settings-radio-title">浅色</span><span class="settings-radio-desc">始终使用浅色主题</span></span></button>'+
          '<button class="settings-radio-row'+(mode==='dark'?' selected':'')+'" data-theme-mode="dark"><span class="settings-radio-dot"></span><span class="settings-radio-text"><span class="settings-radio-title">深色</span><span class="settings-radio-desc">始终使用深色主题</span></span></button>'+
        '</div></div>';
    }
    function renderModelParamsPage(){
      var presets = modelPresets();
      var currentPreset = activePreset();
      var params = getModelParams(currentPreset.id);
      return '<div class="settings-page">'+
        '<div class="settings-card"><div class="settings-card-title">当前模型</div>'+
          '<select id="adv-model-select" class="settings-select">'+presets.map(function(p){ return '<option value="'+escapeHTML(p.id)+'"'+(p.id===currentPreset.id?' selected':'')+'>'+escapeHTML(p.label||p.model)+'</option>'; }).join('')+'</select>'+
        '</div>'+
        '<div class="settings-card"><div class="settings-card-title">参数</div>'+
          settingsSlider('温度', params.temperature, 0, 2, 0.05) +
          settingsSlider('Top P', params.top_p, 0, 1, 0.05) +
          settingsSlider('Max Tokens', params.max_tokens||0, 0, 16384, 256, true) +
          settingsSlider('存在惩罚', params.presence_penalty, -2, 2, 0.1) +
          settingsSlider('频率惩罚', params.frequency_penalty, -2, 2, 0.1) +
          settingsToggle('记忆注入', '每次请求附带已启用的长期记忆', params.memoryInjection !== false, 'memoryInjection')+
        '</div>'+
        '<div class="settings-card"><div class="settings-card-title">系统 Prompt</div>'+
          '<textarea class="settings-textarea param-textarea" data-param="systemPrompt" placeholder="系统 Prompt 会注入到每一次模型请求中">'+escapeHTML(params.systemPrompt||DEFAULT_SYSTEM_PROMPT)+'</textarea>'+
        '</div>'+
      '</div>';
    }
    function settingsSlider(label, value, min, max, step, isToken){
      var displayVal = (isToken && (value===0||!value)) ? '默认' : value;
      var paramName = label.toLowerCase().replace(/\s+/g,'_');
      var nameMap = {'温度':'temperature','Top P':'top_p','Max Tokens':'max_tokens','存在惩罚':'presence_penalty','频率惩罚':'frequency_penalty'};
      var realName = nameMap[label] || paramName;
      return '<div class="settings-slider-row"><div class="settings-slider-head"><span>'+escapeHTML(label)+'</span><span class="settings-slider-val" id="pv-'+realName+'">'+displayVal+'</span></div><input type="range" class="param-slider settings-range" data-param="'+realName+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+value+'"><div class="settings-slider-labels"><span>'+min+'</span><span>'+max+'</span></div></div>';
    }
    function settingsToggle(label, desc, on, param){
      return '<button class="settings-toggle-row" data-param="'+param+'" data-on="'+(on?'1':'0')+'"><span class="settings-toggle-text"><span class="settings-toggle-title">'+escapeHTML(label)+'</span><span class="settings-toggle-desc">'+escapeHTML(desc)+'</span></span><span class="settings-toggle-switch'+(on?' on':'')+'"><span class="settings-toggle-knob"></span></span></button>';
    }
    function renderMemoryPage(){
      var memories = loadMemories();
      var autoExtract = loadAutoExtract();
      var memoryGlobalOn = loadMemoryGlobal();
      return '<div class="settings-page">'+
        settingsToggle('跨聊天记忆', (memories.filter(function(m){return m.enabled!==false;}).length)+' 条启用', memoryGlobalOn, 'memoryGlobal')+
        settingsToggle('自动提取记忆', '从对话中自动识别长期偏好', autoExtract, 'autoExtract')+
        '<div class="settings-card"><div class="settings-card-title">搜索记忆</div><input id="memory-search" class="settings-input" placeholder="输入关键词搜索..."><div id="memory-list-area" style="margin-top:10px"></div></div>'+
        '<div style="display:flex;gap:8px;margin-top:12px"><button class="settings-btn" id="add-memory-btn">＋ 新增记忆</button><button class="settings-btn danger" id="clear-all-memory">清空全部记忆</button></div>'+
      '</div>';
    }
    function renderPersonalizationPage(){
      var p = loadPersonalization();
      return '<div class="settings-page">'+
        settingsToggle('启用个性化', '将你的偏好加入系统提示词', p.enabled, 'persona')+
        '<div class="settings-card"><div class="settings-card-title">个性化内容</div><textarea id="persona-content" class="settings-textarea" placeholder="例如：&#10;用轻松自然的语气回复&#10;技术问题分步骤解释&#10;回答尽量简洁">'+escapeHTML(p.content)+'</textarea></div>'+
        '<button class="settings-btn danger" id="clear-persona" style="margin-top:8px">清空个性化</button>'+
      '</div>';
    }
    function renderChatPrefsPage(){
      var fs = loadFontSize();
      var ap = activePreset();
      var mp = (ap && ap.id) ? getModelParams(ap.id) : {};
      var streamOn = typeof mp.stream === 'boolean' ? mp.stream : true;
      return '<div class="settings-page">'+
        '<div class="settings-card"><div class="settings-card-title">字体大小 <span class="settings-slider-val" id="fontSizeVal">'+fs+'px</span></div>'+
        '<input type="range" id="fontSizeSlider" class="param-slider settings-range" min="15" max="21" step="1" value="'+fs+'"><div class="settings-slider-labels"><span>15px</span><span>21px</span></div></div>'+
        settingsToggle('流式输出', '逐步显示模型回复', streamOn, 'stream')+
        settingsToggle('自动滚动跟随', '回复生成时自动跟随到底部', loadAutoScroll(), 'autoScroll')+
        settingsToggle('显示 Token 消耗', '在消息下方显示输入和输出消耗', loadTokenDisplay(), 'tokenDisplay')+
        settingsToggle('记忆注入', '发送请求时注入相关记忆', loadMemoryGlobal(), 'memoryGlobal')+
      '</div>';
    }

    function renderVoiceSettingsPage(){
      var vs = loadVoiceSettings();
      var isEdge = vs.provider === 'edge';
      var currentVoice = EDGE_VOICES.find(function(v){ return v.id === vs.edgeVoice; }) || EDGE_VOICES[0];
      var rateLabels = {'+10%':'慢一点','+25%':'正常','+40%':'快一点'};
      return '<div class="settings-page">'+
        '<div class="settings-card">'+
          '<button class="settings-toggle-row" id="voiceToggleRow" data-on="'+(vs.enabled?'1':'0')+'"><span class="settings-toggle-text"><span class="settings-toggle-title">语音开关</span><span class="settings-toggle-desc">'+(vs.enabled?'已开启':'已关闭')+'</span></span><span class="settings-toggle-switch'+(vs.enabled?' on':'')+'"><span class="settings-toggle-knob"></span></span></button>'+
        '</div>'+
        '<div class="settings-card">'+
          '<div class="settings-card-title">语音服务</div>'+
          '<div class="voice-provider-pills">'+
            '<button class="voice-provider-pill'+(isEdge?' active':'')+'" data-voice-provider="edge">Edge TTS（免费）</button>'+
            '<button class="voice-provider-pill'+(isEdge?'':' active')+'" data-voice-provider="fish">Fish Audio（自填API）</button>'+
          '</div>'+
        '</div>'+
        (isEdge ? '<div class="settings-card"><div class="settings-card-title">声音选择</div>'+
          EDGE_VOICES.map(function(ev){ return '<button class="settings-radio-row'+(ev.id===vs.edgeVoice?' selected':'')+'" data-voice-id="'+escapeHTML(ev.id)+'" data-voice-label="'+escapeHTML(ev.label)+'"><span class="settings-radio-dot"></span><span class="settings-radio-text"><span class="settings-radio-title">'+escapeHTML(ev.label)+'</span><span class="settings-radio-desc">'+escapeHTML(ev.desc)+'</span></span></button>'; }).join('')+
        '</div>' : '')+
        (!isEdge ? '<div class="settings-card"><div class="settings-card-title">Fish Audio 设置</div>'+
          '<div class="field"><label>API Key</label><input type="password" class="ss-input" id="fishApiKey" value="'+escapeHTML(vs.fishAudioApiKey)+'" placeholder="请输入 Fish Audio API Key"></div>'+
          '<div class="field"><label>Reference ID</label><input type="text" class="ss-input" id="fishRefId" value="'+escapeHTML(vs.fishAudioReferenceId)+'" placeholder="请输入声音 reference_id"></div>'+
          '<div class="field"><label>声音备注名</label><input type="text" class="ss-input" id="fishVoiceName" value="'+escapeHTML(vs.fishAudioVoiceName)+'" placeholder="例如：湾湾小河"></div>'+
        '</div>' : '')+
        '<div class="settings-card">'+
          '<div class="settings-card-title">语速</div>'+
          '<div class="voice-provider-pills">'+
            '<button class="voice-provider-pill'+(vs.rate==='+10%'?' active':'')+'" data-voice-rate="+10%">慢一点</button>'+
            '<button class="voice-provider-pill'+(vs.rate==='+25%'?' active':'')+'" data-voice-rate="+25%">正常</button>'+
            '<button class="voice-provider-pill'+(vs.rate==='+40%'?' active':'')+'" data-voice-rate="+40%">快一点</button>'+
          '</div>'+
        '</div>'+
        '<button class="settings-btn primary" id="testVoiceBtn" style="margin-top:8px;width:100%">测试听音 — 你好，我是稻田 AI</button>'+
        '<button class="settings-btn" id="saveVoiceBtn" style="margin-top:12px;width:100%;background:var(--accent);border-color:var(--accent);color:#fff;border-radius:999px;font-weight:600">保存设置</button>'+
      '</div>';
    }

    function renderAccessPage(){
      var claims = loadAccessClaims();
      var codes = Object.keys(claims);
      var cards = codes.map(function(code){
        var pkg = claims[code];
        return '<div class="settings-card"><div class="settings-card-title">'+escapeHTML(pkg.packageName || '接入模型')+'</div><div class="settings-muted">接入码：'+escapeHTML(code)+'</div><div class="settings-muted">状态：'+escapeHTML(pkg.status || 'active')+'</div><div class="settings-muted">模型：'+escapeHTML((pkg.models || []).join('、') || '无')+'</div></div>';
      }).join('');
      return '<div class="settings-page access-page">'+
        '<div class="settings-card"><div class="settings-card-title">接入码</div><div class="settings-muted">输入别人提供的接入码，即可获取可用模型</div><div class="access-claim-row"><input id="accessCodeInput" class="settings-input" placeholder="请输入接入码"><button class="settings-btn primary" id="claimAccessBtn">一键接入</button></div><div id="accessStatus" class="settings-muted" style="margin-top:8px"></div></div>'+
        (cards || '')+
      '</div>';
    }

    function renderProviderHubPage(){
      settings = ensureSettingsShape(settings);
      if(!Array.isArray(settings.modelProviders)) settings.modelProviders = [];
      var ownSection = renderProviderSection('self');
      return '<div class="settings-page provider-hub">'+
        ownSection+
      '</div>';
    }

    function renderPackageEditor(){
      var providers = Array.isArray(settings.shareModelProviders) ? settings.shareModelProviders : [];
      if(!providers.length) return '<div class="package-editor"><div class="settings-muted">请先在下方添加分享用提供方并保存模型</div></div>';
      var modelChecks = '';
      for(var pi=0; pi<providers.length; pi++){
        var p = providers[pi];
        if(!p.models || !p.models.length) continue;
        modelChecks += '<div style="margin-bottom:8px"><div style="font-weight:540;font-size:13px;color:var(--text);margin-bottom:4px">'+escapeHTML(p.providerName||p.id)+'</div>';
        for(var mi=0; mi<p.models.length; mi++){
          var mid = p.id+'_'+p.models[mi];
          modelChecks += '<label style="display:inline-flex;align-items:center;gap:4px;margin-right:12px;margin-bottom:4px;font-size:13px;cursor:pointer"><input type="checkbox" class="share-model-check" data-provider="'+escapeHTML(p.id)+'" data-model="'+escapeHTML(p.models[mi])+'" checked>'+escapeHTML(p.models[mi])+'</label>';
        }
        modelChecks += '</div>';
      }
      return '<div class="package-editor">'+
        '<div class="row"><div class="field"><label>接入包名称</label><input id="sharePackageNameInput" class="settings-input" placeholder="例如：团队共享包" style="width:100%"></div></div>'+
        '<div class="row"><div class="field"><label>有效期（天）</label><input id="sharePackageExpiryInput" class="settings-input" type="number" min="1" step="1" value="30" style="width:100px"></div><div class="field"><label>总额度（0 不限）</label><input id="sharePackageQuotaInput" class="settings-input" type="number" min="0" step="1" value="0" style="width:100px"></div></div>'+
        '<div class="field"><label>可分享模型</label><div style="max-height:200px;overflow:auto;border:1px solid var(--line);border-radius:10px;padding:8px 12px">'+modelChecks+'</div></div>'+
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="settings-btn primary" id="shareCreatePackageBtn">生成接入码</button><span style="margin-left:4px"><button class="settings-btn" id="shareSelectAllBtn" type="button">全选</button><button class="settings-btn" id="shareDeselectAllBtn" type="button">取消全选</button></span></div>'+
        '<div id="sharePackageStatus" class="settings-muted" style="margin-top:8px"></div>'+
      '</div>';
    }
    function syncPackageEditorModels(providerId){
      var providers = Array.isArray(settings.shareModelProviders) ? settings.shareModelProviders : [];
      var provider = providers.find(function(p){ return p.id === providerId; }) || providers[0] || null;
      var ta = $('#sharePackageModelsInput');
      if(ta && provider) ta.value = (provider.models || []).join('\n');
    }

    function renderShareHubPage(){
      settings = ensureSettingsShape(settings);
      if(!Array.isArray(settings.shareModelProviders)) settings.shareModelProviders = [];
      /* 分享用提供方编辑区 —— 独立于自己使用，存到 shareModelProviders */
      var shareSection = renderProviderSection('share');

      var packages = loadAccessPackages();
      var packageCards = (Array.isArray(packages) && packages.length)
        ? packages.map(function(p){
            var statusLabel = p.enabled===false ? '已停用' : (p.status==='expired'?'已过期':(p.status==='quota'?'额度用完':'启用中'));
            var statusColor = p.enabled===false ? '#c96f66' : (p.status!=='active'?'#d4a853':'#6a9');
            return '<div class="settings-card"><div class="settings-card-title">'+escapeHTML(p.packageName || '模型包')+'</div>'+
              '<div class="settings-muted">接入码：<code>'+escapeHTML(p.code || '')+'</code> <button class="copy-code-btn" data-copy="'+escapeHTML(p.code || '')+'" type="button" style="cursor:pointer;background:var(--accent);color:#fff;border:0;border-radius:8px;padding:2px 10px;font-size:12px">复制</button></div>'+
              '<div class="settings-muted">模型（'+(p.modelCount||p.models.length||0)+'个）：'+escapeHTML((p.models||[]).slice(0,6).join('、') + ((p.models||[]).length>6?'...':''))+'</div>'+
              '<div class="settings-muted">状态：<span style="color:'+statusColor+'">'+statusLabel+'</span> / 额度：'+(p.quotaTotal>0?(p.quotaUsed||0)+'/'+p.quotaTotal:'不限')+' / 到期：'+(p.expiresAt?new Date(p.expiresAt).toLocaleDateString():'永久')+'</div>'+
              '<div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">'+
                (p.enabled===false
                  ? '<button class="settings-btn" data-pkg-action="enable" data-pkg-id="'+escapeHTML(p.id)+'">启用</button>'
                  : '<button class="settings-btn" data-pkg-action="disable" data-pkg-id="'+escapeHTML(p.id)+'">停用</button>')+
                '<button class="settings-btn" data-pkg-action="regen" data-pkg-id="'+escapeHTML(p.id)+'">重新生成码</button>'+
                '<button class="settings-btn danger" data-pkg-action="delete" data-pkg-id="'+escapeHTML(p.id)+'">删除</button>'+
              '</div></div>';
          }).join('')
        : '<div class="settings-muted">暂无已生成的接入码</div>';
      return '<div class="settings-page share-hub">'+
        '<div class="settings-card"><div class="settings-card-title">分享给别人</div><div class="settings-muted">这里配置给别人使用的模型提供方，保存后可生成接入码。接入码使用者看不到你的 API Key。</div></div>'+
        shareSection+
        '<div class="settings-card"><div class="settings-card-title">生成新接入码</div><div class="settings-muted">选择一个分享用模型提供方，选择可分享模型，生成接入码给别人使用。</div><div id="packageEditor">'+renderPackageEditor()+'</div></div>'+
        '<div class="settings-card"><div class="settings-card-title">已生成的接入码</div>'+packageCards+'</div>'+
      '</div>';
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
      var presetId = select ? select.value : null;
      if(!presetId){
        var ap = activePreset();
        if(ap && ap.id) presetId = ap.id;
      }
      if(!presetId) return;
      const params = getModelParams(presetId);
      document.querySelectorAll('#settingsBody [data-param], #adv-params-panel [data-param]').forEach(function(el){
        const name = el.getAttribute('data-param');
        if(name === 'systemPrompt'){ params[name] = el.value; return; }
        if(name === 'stream' || name === 'memoryInjection'){ params[name] = el.getAttribute('data-on') === '1'; return; }
        var val = parseFloat(el.value);
        if(!isNaN(val)) params[name] = val;
      });
      setModelParams(presetId, params);
    }

function initSettingsEvents(){
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
          '<div class="field" style="margin-top:6px"><label>系统提示词</label><textarea class="param-textarea" data-param="systemPrompt" placeholder="编辑当前系统提示词" style="width:100%;min-height:60px;resize:vertical;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit">'+escapeHTML(params.systemPrompt||'')+'</textarea></div>' +
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
      /* Fish Audio input auto-save */
      if(e.target.closest('#fishApiKey')){
        var vs = loadVoiceSettings(); vs.fishAudioApiKey = e.target.value; saveVoiceSettings(vs); return;
      }
      if(e.target.closest('#fishRefId')){
        var vs = loadVoiceSettings(); vs.fishAudioReferenceId = e.target.value; saveVoiceSettings(vs); return;
      }
      if(e.target.closest('#fishVoiceName')){
        var vs = loadVoiceSettings(); vs.fishAudioVoiceName = e.target.value; saveVoiceSettings(vs); return;
      }
      if(e.target.closest('#fontSizeSlider')){
        var v = parseInt(e.target.value); applyFontSize(v); saveFontSize(v);
        var valEl = document.getElementById('fontSizeVal'); if(valEl) valEl.textContent = v+'px';
        return;
      }
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
    document.addEventListener('change', function(e){
      var pkgSel = e.target.closest('#sharePackageProviderSelect');
      if(pkgSel){
        settings.sharePackageProviderId = pkgSel.value;
        saveJSONStrict(KEYS.settings, settings);
        syncPackageEditorModels(pkgSel.value);
      }
    });

    /* ── 高级设置事件绑定 ── */
    var _el_openSettings = $('#openSettingsBtn'); if(_el_openSettings) _el_openSettings.onclick = openSettingsModal;
    $('#settingsBackBtn').onclick = settingsGoBack;
    $('#settingsCloseBtn').onclick = closeSettingsModal;

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
    /* ── 设置系统事件 ── */
    document.addEventListener('click', function(e){
      var loginBtn = e.target.closest('#loginBtn');
      if(loginBtn){
        renderAuthPage('login');
        return;
      }
      var registerBtn = e.target.closest('#registerBtn');
      if(registerBtn){
        renderAuthPage('register');
        return;
      }
      var logoutBtn = e.target.closest('#logoutBtn');
      if(logoutBtn){
        logoutBtn.disabled = true;
        logoutBtn.textContent = '退出中...';
        flushAuthDataSync().finally(function(){
          authFetch('/api/auth/logout', {method:'POST', body:'{}'}).finally(function(){ location.reload(); });
        });
        return;
      }
      var entry = e.target.closest('.settings-entry');
      if(entry){
        var page = entry.getAttribute('data-settings-go');
        if(page) settingsGoTo(page);
        return;
      }
      /* Voice: provider pills */
      var vpPill = e.target.closest('.voice-provider-pill');
      if(vpPill){
        var prov = vpPill.getAttribute('data-voice-provider');
        var rate = vpPill.getAttribute('data-voice-rate');
        if(prov){
          var vs = loadVoiceSettings(); vs.provider = prov; saveVoiceSettings(vs);
          renderSettingsPage();
        }
        if(rate){
          var vs2 = loadVoiceSettings(); vs2.rate = rate; saveVoiceSettings(vs2);
          renderSettingsPage();
        }
        return;
      }
      /* Voice: enabled toggle */
      var vtr = e.target.closest('#voiceToggleRow');
      if(vtr){
        var vs3 = loadVoiceSettings(); vs3.enabled = !vs3.enabled; saveVoiceSettings(vs3);
        renderSettingsPage();
        return;
      }
      /* Voice: save button */
      var saveBtn = e.target.closest('#saveVoiceBtn');
      if(saveBtn){
        var fb = saveButtonFeedback('saveVoiceBtn', '语音设置已保存', '语音保存失败');
        try{
          var vs5 = loadVoiceSettings();
          var fk = document.getElementById('fishApiKey');
          var fr = document.getElementById('fishRefId');
          var fv = document.getElementById('fishVoiceName');
          if(fk) vs5.fishAudioApiKey = fk.value;
          if(fr) vs5.fishAudioReferenceId = fr.value;
          if(fv) vs5.fishAudioVoiceName = fv.value;
          saveVoiceSettings(vs5);
          if(fb) fb.done();
        }catch(e){
          if(fb) fb.fail();
        }
        return;
      }
      /* Test voice button */
      var testBtn = e.target.closest('#testVoiceBtn');
      if(testBtn){
        var vs = loadVoiceSettings();
        testBtn.textContent = '正在生成...';
        testBtn.disabled = true;
        var ttsBody = {text:'你好，我是稻田 AI。',provider:vs.provider,voice:vs.edgeVoice,rate:vs.rate};
        if(vs.provider==='fish'){ ttsBody.fishAudioApiKey = vs.fishAudioApiKey; ttsBody.fishAudioReferenceId = vs.fishAudioReferenceId; }
        if(vs.provider==='fish' && (!vs.fishAudioApiKey||!vs.fishAudioReferenceId)){
          testBtn.textContent = '测试听音 — "你好，我是稻田 AI"';
          testBtn.disabled = false;
          toast('请先填写 Fish Audio API Key 和 Reference ID');
          return;
        }
        (async function(){
          try{
            var tres = await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ttsBody)});
            if(!tres.ok){ throw new Error('TTS failed'); }
            var tblob = await tres.blob();
            var ta = new Audio(URL.createObjectURL(tblob));
            ta.play();
            testBtn.textContent = '测试听音 — "你好，我是稻田 AI"';
            testBtn.disabled = false;
          }catch(terr){
            testBtn.textContent = '测试听音 — "你好，我是稻田 AI"';
            testBtn.disabled = false;
            toast('语音暂时不可用');
          }
        })();
        return;
      }
      /* Fish Audio input changes */
      var fishInput = e.target.closest('#fishApiKey,#fishRefId,#fishVoiceName');
      if(!fishInput && e.target.matches && (e.target.id==='fishApiKey'||e.target.id==='fishRefId'||e.target.id==='fishVoiceName')){ return; }
      var radio = e.target.closest('.settings-radio-row');
      if(radio){
        var mode = radio.getAttribute('data-theme-mode');
        if(mode){ saveThemeMode(mode); theme = resolveTheme(); renderAll(); renderSettingsPage(); toast(mode==='system'?'已切换为跟随系统':mode==='light'?'已切换为浅色':'已切换为深色'); }
        /* Voice selection via radio */
        var vid2 = radio.getAttribute('data-voice-id');
        if(vid2){
          var vlbl2 = radio.getAttribute('data-voice-label');
          var vs4 = loadVoiceSettings();
          vs4.edgeVoice = vid2;
          vs4.edgeVoiceLabel = vlbl2 || vid2;
          saveVoiceSettings(vs4);
          renderSettingsPage();
        }
        return;
      }
      var toggle = e.target.closest('.settings-toggle-row');
      if(toggle){
        var param = toggle.getAttribute('data-param');
        var on = toggle.getAttribute('data-on') === '1';
        var newOn = !on;
        toggle.setAttribute('data-on', newOn?'1':'0');
        var sw = toggle.querySelector('.settings-toggle-switch');
        if(sw) sw.classList.toggle('on', newOn);
        if(param==='stream'||param==='memoryInjection'){ saveCurrentModelParams(); }
        else if(param==='tokenDisplay'){ saveTokenDisplay(newOn); renderMessages(); }
        else if(param==='autoScroll'){ saveAutoScroll(newOn); }
        else if(param==='memoryGlobal'){ saveMemoryGlobal(newOn); var m=loadMemories(); m=m.map(function(mm){mm.enabled=newOn;return mm;}); saveMemories(m); renderMemoryPage(); }
        else if(param==='autoExtract'){ saveAutoExtract(newOn); }
        else if(param==='persona'){ var pp=loadPersonalization(); pp.enabled=newOn; savePersonalization(pp); }
        return;
      }
    });
    /* ── 记忆编辑模态框（保留） ── */
    var _el_closeMem = $('#closeMemoryEdit'); if(_el_closeMem) _el_closeMem.onclick = closeMemoryEdit;
    var _el_cancelMem = $('#cancelMemoryEdit'); if(_el_cancelMem) _el_cancelMem.onclick = closeMemoryEdit;
    var _el_saveMem = $('#saveMemoryEdit'); if(_el_saveMem) _el_saveMem.onclick = saveMemoryEdit;

    /* ── 记忆搜索渲染（从旧代码保留，在 memory page 中复用） ── */
    /* memory search is handled by existing handlers */

    document.addEventListener('click', e=>{
      const presetBtn = e.target.closest('[data-model-preset]');
      if(presetBtn){ settings.activePresetId = presetBtn.getAttribute('data-model-preset'); syncLegacySettings(); persist(); renderModelSwitcher(); closeModelMenu(); toast('已切换模型'); return; }
      const manage = e.target.closest('#manageModels');
      if(manage){ closeModelMenu(); openProviderHub(); return; }
      if(e.target.closest('#modelTopTrigger')){ toggleModelPopover(); return; }
      if(!e.target.closest('#modelPopover') && !e.target.closest('#modelTopTrigger')) closeModelPopover();
      const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); safeClearAttachments(); if(window.innerWidth<760) sidebarOpen=false; renderAll(); }
      const selfSaveProviderBtn = e.target.closest('#selfSaveProvider');
      if(selfSaveProviderBtn){
        saveProviderHubSection('self');
        return;
      }
      const shareSaveProviderBtn = e.target.closest('#shareSaveProvider');
      if(shareSaveProviderBtn){
        saveProviderHubSection('share');
        return;
      }
      const providerDel=e.target.closest('[data-provider-delete]');
      if(providerDel){
        e.stopPropagation();
        var id=providerDel.getAttribute('data-provider-delete');
        var section = providerDel.closest('[data-provider-section]');
        var scope = section ? section.getAttribute('data-provider-section') : 'self';
        deleteProvider(id, scope);
        return;
      }
      /* API Key 眼睛切换 */
      var eyeBtn = e.target.closest('.api-key-eye');
      if(eyeBtn){
        e.stopPropagation();
        var card = eyeBtn.closest('[data-provider-id]');
        if(card){
          var inp = card.querySelector('[data-provider-field="apiKey"]');
          if(inp){ inp.type = inp.type === 'password' ? 'text' : 'password'; }
        }
        return;
      }
      /* Manual add model button */
      var manAdd = e.target.closest('[data-manual-toggle]');
      if(manAdd){
        var pid2 = manAdd.getAttribute('data-manual-toggle');
        var section2 = manAdd.closest('[data-provider-section]');
        var scope2 = section2 ? section2.getAttribute('data-provider-section') : 'self';
        var root2 = isProviderSectionPage() ? providerHubRoot(scope2) : providerEditorScope();
        var card2 = root2 ? root2.querySelector('[data-provider-id="'+pid2+'"]') : null;
        if(card2){
          var modelName = prompt('输入模型名称（如 deepseek-v4-pro）：');
          if(modelName && modelName.trim()){
            var ta = card2.querySelector('[data-provider-field="models"]');
            if(ta){
              var currentModels = ta.value.trim();
              ta.value = currentModels ? currentModels + '\n' + modelName.trim() : modelName.trim();
              if(isProviderSectionPage()){
                collectProviderHubSection(scope2);
                saveJSONStrict(KEYS.settings, settings);
                if(scope2 === 'share'){
                  var shareSelectEl3 = $('#sharePackageProviderSelect');
                  if(shareSelectEl3 && shareSelectEl3.value === pid2) syncPackageEditorModels(pid2);
                }
              }else{
                collectProviderEditor();
              }
              renderModelSwitcher();
              toast('已添加 ' + modelName.trim());
            }
          }
        }
        return;
      }
      var addProviderBtn = e.target.closest('#addPreset,#addProvider,#selfAddProvider,#shareAddProvider');
      if(addProviderBtn){
        e.preventDefault();
        var addScope = addProviderBtn.getAttribute('data-provider-scope') || (addProviderBtn.id === 'shareAddProvider' ? 'share' : 'self');
        addProviderEditorCard(addScope);
        return;
      }
      var claimBtn = e.target.closest('#claimAccessBtn');
      if(claimBtn){
        var input = $('#accessCodeInput');
        var status = $('#accessStatus');
        var code = input ? input.value.trim() : '';
        if(!code){ if(status) status.textContent = '请输入接入码'; return; }
        claimBtn.disabled = true; claimBtn.textContent = '接入中...';
        if(status) status.textContent = '接入中...';
        (async function(){
          try{
            var res = await fetch('/api/access/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:code})});
            var data = await res.json();
            if(!res.ok || !data.ok) throw new Error(data.message || data.error || '接入失败');
            var claims = loadAccessClaims();
            claims[code] = data.package;
            saveAccessClaims(claims);
            saveAccessPackages(Object.values(claims));
            renderSettingsPage();
            if(status) status.textContent = '成功：' + (data.package.packageName || '接入模型');
            toast('接入成功');
          }catch(err){
            if(status) status.textContent = err.message || '接入失败';
            toast(err.message || '接入失败');
          }finally{
            claimBtn.disabled = false;
            claimBtn.textContent = '一键接入';
          }
        })();
        return;
      }
      var createPkgBtn = e.target.closest('#shareCreatePackageBtn');
      if(createPkgBtn){
        var nameInput2 = $('#sharePackageNameInput');
        var expiryInput2 = $('#sharePackageExpiryInput');
        var quotaInput2 = $('#sharePackageQuotaInput');
        var statusEl2 = $('#sharePackageStatus');
        if(!nameInput2){ return; }
        // Collect items from checkboxes
        var checks = document.querySelectorAll('.share-model-check:checked');
        var itemMap = {};
        for(var ci=0; ci<checks.length; ci++){
          var pid = checks[ci].getAttribute('data-provider');
          var mid = checks[ci].getAttribute('data-model');
          if(!itemMap[pid]) itemMap[pid] = [];
          itemMap[pid].push(mid);
        }
        var items = Object.keys(itemMap).map(function(pid){ return { providerId:pid, models:itemMap[pid] }; });
        if(!items.length){
          if(statusEl2) statusEl2.textContent = '请至少选择一个模型';
          return;
        }
        var pkgBody2 = {
          packageName: nameInput2.value.trim(),
          items: items,
          expiresInDays: Number(expiryInput2 && expiryInput2.value || 0),
          quotaTotal: Number(quotaInput2 && quotaInput2.value || 0)
        };
        createPkgBtn.disabled = true;
        createPkgBtn.textContent = '生成中...';
        if(statusEl2) statusEl2.textContent = '生成中...';
        (async function(){
          try{
            var data2 = await authFetch('/api/access/packages', {method:'POST', body:JSON.stringify(pkgBody2)});
            if(!data2.ok) throw new Error(data2.message || '生成失败');
            await refreshAccessPackages();
            if(statusEl2) statusEl2.textContent = '接入码：' + data2.package.code;
            toast('接入码已生成');
            renderSettingsPage();
          }catch(err2){
            console.error('[access] create package failed:', err2);
            if(statusEl2) statusEl2.textContent = err2.message || '生成失败';
            toast(err2.message || '生成失败');
          }finally{
            createPkgBtn.disabled = false;
            createPkgBtn.textContent = '生成接入码';
          }
        })();
        return;
      }
      // Select all / deselect all buttons
      var selectAllBtn = e.target.closest('#shareSelectAllBtn');
      if(selectAllBtn){
        document.querySelectorAll('.share-model-check').forEach(function(cb){ cb.checked = true; });
        return;
      }
      var deselectAllBtn = e.target.closest('#shareDeselectAllBtn');
      if(deselectAllBtn){
        document.querySelectorAll('.share-model-check').forEach(function(cb){ cb.checked = false; });
        return;
      }
      // Package management actions
      var pkgActionBtn = e.target.closest('[data-pkg-action]');
      if(pkgActionBtn){
        var action = pkgActionBtn.getAttribute('data-pkg-action');
        var pkgId = pkgActionBtn.getAttribute('data-pkg-id');
        if(action === 'delete'){
          if(!confirm('删除后该接入码会立即失效，确定删除吗？')) return;
          authFetch('/api/access/packages/'+pkgId, {method:'DELETE'}).then(function(r){ if(r.ok){ toast('已删除'); refreshAccessPackages().then(function(){ renderSettingsPage(); }); }else{ toast(r.message||'删除失败'); } }).catch(function(){ toast('删除失败'); });
        }else if(action === 'disable'){
          authFetch('/api/access/packages/'+pkgId, {method:'PATCH', body:JSON.stringify({enabled:false})}).then(function(r){ if(r.ok){ toast('已停用'); refreshAccessPackages().then(function(){ renderSettingsPage(); }); }else{ toast(r.message||'操作失败'); } });
        }else if(action === 'enable'){
          authFetch('/api/access/packages/'+pkgId, {method:'PATCH', body:JSON.stringify({enabled:true})}).then(function(r){ if(r.ok){ toast('已启用'); refreshAccessPackages().then(function(){ renderSettingsPage(); }); }else{ toast(r.message||'操作失败'); } });
        }else if(action === 'regen'){
          if(!confirm('重新生成后旧码立即失效，确定吗？')) return;
          authFetch('/api/access/packages/'+pkgId+'/regenerate-code', {method:'POST'}).then(function(r){ if(r.ok){ toast('新码：'+r.package.code); refreshAccessPackages().then(function(){ renderSettingsPage(); }); }else{ toast(r.message||'操作失败'); } });
        }
        return;
      }
      var copyCodeBtn = e.target.closest('.copy-code-btn');
      if(copyCodeBtn){
        var codeText = copyCodeBtn.getAttribute('data-copy') || '';
        if(codeText){
          navigator.clipboard.writeText(codeText).then(function(){ toast('已复制接入码'); }, function(){ toast('复制失败，请手动复制'); });
        }
        return;
      }
      var refreshPkgBtn = e.target.closest('#shareRefreshPackageBtn');
      if(refreshPkgBtn){ refreshAccessPackages(); return; }
      var shareProviderSel = e.target.closest('#sharePackageProviderSelect');
      if(shareProviderSel){
        settings.sharePackageProviderId = shareProviderSel.value;
        saveJSONStrict(KEYS.settings, settings);
        syncPackageEditorModels(shareProviderSel.value);
        return;
      }
      /* Fetch models button */
      var fetchBtn = e.target.closest('[data-fetch-models]');
      if(fetchBtn){
        var pid = fetchBtn.getAttribute('data-fetch-models');
        var fetchSection = fetchBtn.closest('[data-provider-section]');
        var fetchScope = fetchSection ? fetchSection.getAttribute('data-provider-section') : 'self';
        if(pid) fetchModelsForProvider(fetchScope, pid);
        return;
      }
      /* Model add/remove button */
      var modelAddBtn = e.target.closest('.model-add-btn');
      if(modelAddBtn){
        var mid = modelAddBtn.getAttribute('data-provider-id');
        var mname = modelAddBtn.getAttribute('data-model-name');
        var modelSection = modelAddBtn.closest('[data-provider-section]');
        var modelScope = modelSection ? modelSection.getAttribute('data-provider-section') : 'self';
        if(mid && mname) toggleModelInProvider(modelScope, mid, mname);
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
    document.addEventListener('change', function(e){
      var shareSelect = e.target.closest('#sharePackageProviderSelect');
      if(shareSelect){
        syncPackageEditorModels(shareSelect.value);
        return;
      }
    });
    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();}; $('#openSide').onclick=()=>{closeModelPopover(); sidebarOpen=true;renderAll();}; $('#topNewChatBtn').onclick=startNewChat;
    var _openAccessCode = $('#openAccessCode'); if(_openAccessCode) _openAccessCode.onclick = openAccessPage;
    var _openProvider = $('#openProvider'); if(_openProvider) _openProvider.onclick = openProviderHub;
    var _openShare = $('#openShare'); if(_openShare) _openShare.onclick = openShareHub;
    $('#closeProvider').onclick=closeSettings; $('#cancelProvider').onclick=closeSettings; $('#saveProvider').onclick=function(){ saveSettings(); };
    $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });

    /* ── 模态框：点击遮罩关闭 ── */
    /* ── 模态框：点击遮罩关闭 ── */
    ['providerModal','settingsModal','memoryEditModal'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el) return;
      el.addEventListener('click', function(e){
        if(e.target === el){
          if(id === 'providerModal') closeSettings();
          else if(id === 'settingsModal') closeSettingsModal();
          else if(id === 'memoryEditModal') closeMemoryEdit();
        }
      });
    });

    /* ── 模态框：左滑/右滑关闭 ── */
    (function(){
      var swipeStartX = 0, swipeStartY = 0, swipeEl = null;
      var swipeIgnored = false;
      document.addEventListener('touchstart', function(e){
        /* Ignore slider/range inputs */
        if(e.target.closest('input[type="range"]') || e.target.closest('.param-slider')){
          swipeIgnored = true;
          swipeEl = null;
          return;
        }
        swipeIgnored = false;
        var modal = e.target.closest('.modal-backdrop.show');
        if(!modal) return;
        var touch = e.touches[0];
        swipeStartX = touch.clientX;
        swipeStartY = touch.clientY;
        swipeEl = modal;
      }, {passive:true});

      document.addEventListener('touchmove', function(e){
        if(!swipeEl || swipeIgnored) return;
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
          swipeIgnored = false;
          return;
        }
        var touch = e.changedTouches[0];
        var dx = touch.clientX - swipeStartX;
        swipeEl.style.transform = '';
        swipeEl.style.transition = '';
        if(Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(touch.clientY - swipeStartY) * 1.2){
          var id = swipeEl.id;
          if(id === 'providerModal') closeSettings();
          else if(id === 'settingsModal') closeSettingsModal();
          else if(id === 'memoryEditModal') closeMemoryEdit();
        }
        swipeEl = null;
        swipeIgnored = false;
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
      else if(id === 'settingsModal') closeSettingsModal();
      else if(id === 'memoryEditModal') closeMemoryEdit();
}
