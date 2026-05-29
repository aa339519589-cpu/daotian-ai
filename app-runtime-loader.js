/* Runtime bridge for modular split — loads app.js after patching local-only state into shared globals. */
var theme;
var chats;
var activeAbortController = null;
var lastSendAt = 0;

(function(){
  'use strict';
  var VERSION = 'v1-app-bridge';

  function showLoaderError(err){
    var app = document.getElementById('app');
    if(!app) return;
    var msg = (err && (err.stack || err.message)) || String(err || 'unknown');
    app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f5f2ea;color:#2a2824;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;padding:24px">' +
      '<div style="max-width:520px;width:100%;background:#fff;border:1px solid rgba(90,78,62,.18);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(70,55,35,.12)">' +
      '<h2 style="margin:0 0 10px;font-size:22px">稻田 Ai 启动补丁失败</h2>' +
      '<pre style="white-space:pre-wrap;background:#f7f3ec;border-radius:14px;padding:12px;font-size:12px;color:#655b52;max-height:220px;overflow:auto">' + msg.replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]);}) + '</pre>' +
      '</div></div>';
  }

  function replaceOnce(src, from, to){
    if(src.indexOf(from) < 0) throw new Error('runtime patch marker not found: ' + from);
    return src.replace(from, to);
  }

  function exposeBlock(){
    var names = [
      'loadModelParamsMap','getModelParams','setModelParams','exportModelParamsBody',
      'loadPersonalization','savePersonalization','loadMemories','saveMemories','loadMemoryGlobal','saveMemoryGlobal',
      'loadAutoExtract','saveAutoExtract','loadMemoryCandidates','saveMemoryCandidates',
      'migrateMemoriesToServer','retrieveMemories','ingestMemoryFacts','formatMemoryContext',
      'loadAccessPackages','saveAccessPackages','loadAccessClaims','saveAccessClaims','refreshAccessPackages',
      'loadTokenDisplay','saveTokenDisplay','loadAutoScroll','saveAutoScroll',
      'ensureAuthenticated','loadAuthData','ensureSettingsShape','normalizeProvider','normalizeProviders','providerHasConfig',
      'makeProviderId','splitModels','providersToPresets','presetFromProvider','accessPackagesToPresets',
      'activeChat','modelPresets','activePreset','syncLegacySettings','persist','persistModelSettingsStrict',
      'findFirstUsableProvider','hasAnyProvider','hasProviderWithCredentials','syncModelState','hasUsableModelConfig','saveSearchOn'
    ];
    return '\n    /* Runtime bridge: expose app.js closure helpers to extracted modules */\n' +
      '    window.__DAOTIAN_RUNTIME_BRIDGE__ = \'' + VERSION + '\';\n' +
      '    window.theme = theme; window.chats = chats; window.activeAbortController = activeAbortController; window.lastSendAt = lastSendAt;\n' +
      names.map(function(n){ return '    try{ window.' + n + ' = ' + n + '; }catch(_bridge_' + n + '){}'; }).join('\n') + '\n';
  }

  function patchSource(src){
    src = replaceOnce(src, 'let theme = resolveTheme();', 'theme = resolveTheme();');
    src = replaceOnce(src, 'let chats = loadChats();', 'chats = loadChats();');
    src = replaceOnce(src, 'let activeAbortController = null;', 'activeAbortController = null;');
    src = replaceOnce(src, 'let lastSendAt = 0;', 'lastSendAt = 0;');
    var marker = '\n    renderAll();\n    syncModelState();';
    var at = src.lastIndexOf(marker);
    if(at < 0) throw new Error('runtime patch marker not found: startup renderAll');
    src = src.slice(0, at) + exposeBlock() + src.slice(at);
    return src + '\n//# sourceURL=/app.js';
  }

  fetch('./app.js?v=v556&runtime=' + encodeURIComponent(VERSION) + '&t=' + Date.now(), {cache:'no-store'})
    .then(function(res){
      if(!res.ok) throw new Error('app.js fetch failed: HTTP ' + res.status);
      return res.text();
    })
    .then(function(src){
      var patched = patchSource(src);
      var s = document.createElement('script');
      s.text = patched;
      document.body.appendChild(s);
    })
    .catch(showLoaderError);
})();
