(function(){
  'use strict';

  var BLOCKED_MODEL = 'gemma4';
  var BLOCKED_PROVIDER_ID = 'p_ollama_builtin';
  var SETTINGS_KEYS = [
    'daotian.settings.v323',
    'daotian.settings.v322',
    'daotian.settings'
  ];

  function isBlockedModel(value){
    return String(value || '').trim().toLowerCase() === BLOCKED_MODEL;
  }

  function readJSON(key){
    try{
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    }catch(_e){ return null; }
  }

  function writeJSON(key, value){
    try{ localStorage.setItem(key, JSON.stringify(value)); }catch(_e){}
  }

  function cleanProvider(provider){
    if(!provider || typeof provider !== 'object') return null;
    var id = String(provider.id || provider.providerId || '').trim();
    var type = String(provider.providerType || '').trim().toLowerCase();
    var models = Array.isArray(provider.models) ? provider.models : [];
    models = models.filter(function(model){ return !isBlockedModel(model); });

    if(id === BLOCKED_PROVIDER_ID) return null;
    if(type === 'ollama' && !models.length) return null;

    provider.models = models;
    if(isBlockedModel(provider.model)) provider.model = '';
    if(isBlockedModel(provider.modelList)) provider.modelList = '';
    return provider;
  }

  function cleanPreset(preset){
    if(!preset || typeof preset !== 'object') return null;
    if(isBlockedModel(preset.model)) return null;
    if(String(preset.providerId || '').trim() === BLOCKED_PROVIDER_ID) return null;
    if(Array.isArray(preset.models)) preset.models = preset.models.filter(function(model){ return !isBlockedModel(model); });
    return preset;
  }

  function cleanSettings(settings){
    if(!settings || typeof settings !== 'object') return settings;

    if(Array.isArray(settings.modelProviders)){
      settings.modelProviders = settings.modelProviders.map(cleanProvider).filter(Boolean);
    }
    if(Array.isArray(settings.shareModelProviders)){
      settings.shareModelProviders = settings.shareModelProviders.map(cleanProvider).filter(Boolean);
    }
    if(Array.isArray(settings.modelPresets)){
      settings.modelPresets = settings.modelPresets.map(cleanPreset).filter(Boolean);
    }

    if(isBlockedModel(settings.model)) settings.model = '';
    if(isBlockedModel(settings.modelList)) settings.modelList = '';
    if(isBlockedModel(settings.models)) settings.models = '';

    var active = String(settings.activePresetId || '').trim();
    var hasActive = settings.modelPresets && settings.modelPresets.some(function(p){ return p && p.id === active; });
    if(!hasActive) settings.activePresetId = settings.modelPresets && settings.modelPresets[0] ? settings.modelPresets[0].id : '';

    return settings;
  }

  function purgeStorage(){
    SETTINGS_KEYS.forEach(function(key){
      var settings = readJSON(key);
      if(settings){ writeJSON(key, cleanSettings(settings)); }
    });
  }

  function hasUsableModel(){
    var settings = readJSON('daotian.settings.v323') || readJSON('daotian.settings.v322') || readJSON('daotian.settings') || {};
    settings = cleanSettings(settings) || {};
    var providers = Array.isArray(settings.modelProviders) ? settings.modelProviders : [];
    for(var i=0; i<providers.length; i++){
      var p = providers[i];
      if(p && p.baseUrl && p.apiKey && Array.isArray(p.models) && p.models.length){ return true; }
    }
    return false;
  }

  function showNeedModel(){
    var label = document.getElementById('modelTopLabel');
    if(label){ label.textContent = '请先添加模型'; label.title = '请先添加模型'; }
    var status = document.getElementById('status');
    if(status){
      status.textContent = '请先添加模型';
      status.classList.add('show');
      clearTimeout(showNeedModel.t);
      showNeedModel.t = setTimeout(function(){ status.classList.remove('show'); }, 1800);
    }
  }

  function blockEmptySend(e){
    var target = e.target;
    var isSendClick = target && target.closest && target.closest('#sendBtn');
    var isEnterSend = e.type === 'keydown' && target && target.id === 'input' && e.key === 'Enter' && !e.shiftKey;
    if((isSendClick || isEnterSend) && !hasUsableModel()){
      e.preventDefault();
      e.stopPropagation();
      if(e.stopImmediatePropagation) e.stopImmediatePropagation();
      showNeedModel();
      return false;
    }
  }

  function guardFetch(){
    if(window.__daotianGemma4FetchGuard) return;
    var originalFetch = window.fetch;
    if(typeof originalFetch !== 'function') return;
    window.fetch = function(input, init){
      try{
        var body = init && init.body;
        if(typeof body === 'string' && body.indexOf(BLOCKED_MODEL) >= 0){
          var parsed = JSON.parse(body);
          if(isBlockedModel(parsed.model) || isBlockedModel(parsed.frontendUpstream && parsed.frontendUpstream.model)){
            return Promise.resolve(new Response(JSON.stringify({ok:false,error:'model_required',message:'请先添加模型'}), {
              status: 400,
              headers: {'Content-Type':'application/json'}
            }));
          }
        }
      }catch(_e){}
      return originalFetch.apply(this, arguments);
    };
    window.__daotianGemma4FetchGuard = true;
  }

  purgeStorage();
  guardFetch();
  document.addEventListener('click', blockEmptySend, true);
  document.addEventListener('keydown', blockEmptySend, true);
  document.addEventListener('DOMContentLoaded', function(){ purgeStorage(); showNeedModel(); }, {once:true});
})();
