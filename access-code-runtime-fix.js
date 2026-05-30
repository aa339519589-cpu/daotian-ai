/* Access-code runtime fix
   Makes claimed access codes usable as normal model presets without exposing the provider key. */
(function(){
  'use strict';
  var DTM = window.DAOTIAN_MODEL_UTILS || null;
  var DTG = window.DAOTIAN_GLOBALS || null;
  if(!DTM || !DTG || !DTG.KEYS) return;

  function installAccessFetchGuard(){
    if(window.__DAOTIAN_ACCESS_FETCH_GUARD__) return;
    window.__DAOTIAN_ACCESS_FETCH_GUARD__ = true;
    var rawFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      try{
        var url = typeof input === 'string' ? input : (input && input.url) || '';
        if(String(url).indexOf('__access__') === 0){
          init = init || {};
          var bodyText = init.body || '';
          var body = typeof bodyText === 'string' ? JSON.parse(bodyText || '{}') : {};
          var up = body.frontendUpstream || {};
          var code = String(body.accessCode || up.apiKey || '').trim();
          if(code){
            body.accessCode = code;
            delete body.frontendUpstream;
            input = '/chat';
            init = Object.assign({}, init, {
              headers: Object.assign({'Content-Type':'application/json'}, init.headers || {}),
              body: JSON.stringify(body)
            });
          }
        }
      }catch(_e){}
      return rawFetch(input, init);
    };
  }
  installAccessFetchGuard();

  function safeParse(v, fallback){
    try{ return v ? JSON.parse(v) : fallback; }catch(_e){ return fallback; }
  }
  function allStoredValuesBySuffix(suffix){
    var out = [];
    try{
      var direct = localStorage.getItem(suffix);
      if(direct) out.push(direct);
      for(var i=0; i<localStorage.length; i++){
        var k = localStorage.key(i) || '';
        if(k !== suffix && k.slice(-suffix.length) === suffix){
          var v = localStorage.getItem(k);
          if(v) out.push(v);
        }
      }
    }catch(_e){}
    return out;
  }
  function loadClaimedPackages(){
    var map = {};
    var pkgValues = allStoredValuesBySuffix(DTG.KEYS.accessPackages || 'daotian.accessPackages.v1');
    for(var i=0; i<pkgValues.length; i++){
      var arr = safeParse(pkgValues[i], []);
      if(Array.isArray(arr)){
        for(var j=0; j<arr.length; j++) addPkg(arr[j], map, j);
      }
    }
    var claimValues = allStoredValuesBySuffix(DTG.KEYS.accessClaims || 'daotian.accessClaims.v1');
    for(var c=0; c<claimValues.length; c++){
      var obj = safeParse(claimValues[c], {});
      if(obj && typeof obj === 'object' && !Array.isArray(obj)){
        Object.keys(obj).forEach(function(code, idx){
          var p = obj[code] || {};
          if(!p.code) p.code = code;
          addPkg(p, map, idx);
        });
      }
    }
    return Object.keys(map).map(function(k){ return map[k]; });
  }
  function addPkg(raw, map, idx){
    if(!raw || typeof raw !== 'object') return;
    var p = typeof DTM.normalizeAccessPackage === 'function' ? DTM.normalizeAccessPackage(raw, idx) : raw;
    var code = String((DTM.accessPackageKey ? DTM.accessPackageKey(p) : (p.code || p.id || '')) || '').trim();
    var models = Array.isArray(p.models) ? p.models.map(function(m){return String(m||'').trim();}).filter(Boolean) : [];
    if(!code || !models.length) return;
    p.code = code;
    p.models = Array.from(new Set(models));
    map[code] = p;
  }
  function slug(value){
    if(typeof DTM.slugify === 'function') return DTM.slugify(value);
    return String(value || 'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48) || 'x';
  }
  function pkgStatus(pkg){
    if(typeof DTM.accessPackageStatus === 'function') return DTM.accessPackageStatus(pkg);
    if(pkg.enabled === false) return 'disabled';
    if(pkg.expiresAt && Date.parse(pkg.expiresAt) <= Date.now()) return 'expired';
    if(Number(pkg.quotaTotal||0) > 0 && Number(pkg.quotaUsed||0) >= Number(pkg.quotaTotal||0)) return 'quota';
    return 'active';
  }
  function accessProviderFromPackage(pkg, i){
    var code = String(pkg.code || '').trim();
    return {
      id: 'access__' + slug(code || pkg.id || ('pkg_' + i)),
      providerType: 'openai',
      providerName: pkg.packageName || pkg.providerName || '接入模型',
      baseUrl: '__access__',
      apiKey: code,
      path: '/v1/chat/completions',
      models: Array.isArray(pkg.models) ? pkg.models.slice() : [],
      accessCode: code,
      accessPackageId: pkg.id || '',
      accessStatus: pkgStatus(pkg),
      readOnly: true
    };
  }
  function accessPresetFromPackage(pkg, model, i){
    var code = String(pkg.code || '').trim();
    var providerId = 'access__' + slug(code || pkg.id || ('pkg_' + i));
    var name = pkg.packageName || pkg.providerName || '接入模型';
    return {
      id: providerId + '__' + slug(model),
      providerId: providerId,
      providerType: 'openai',
      providerName: name,
      baseUrl: '__access__',
      apiKey: code,
      path: '/v1/chat/completions',
      model: model,
      label: name + ' / ' + model,
      accessCode: code,
      accessPackageId: pkg.id || '',
      accessStatus: pkgStatus(pkg),
      accessPackage: pkg,
      models: Array.isArray(pkg.models) ? pkg.models.slice() : [],
      readOnly: true,
      packageName: pkg.packageName || '',
      providerUserId: pkg.providerUserId || ''
    };
  }
  function accessPackagesToPresetsFixed(packages){
    var out = [];
    (Array.isArray(packages) ? packages : []).forEach(function(raw, i){
      var p = typeof DTM.normalizeAccessPackage === 'function' ? DTM.normalizeAccessPackage(raw, i) : raw;
      var code = String((DTM.accessPackageKey ? DTM.accessPackageKey(p) : (p.code || p.id || '')) || '').trim();
      if(!code) return;
      p.code = code;
      (Array.isArray(p.models) ? p.models : []).forEach(function(model){
        model = String(model || '').trim();
        if(model) out.push(accessPresetFromPackage(p, model, i));
      });
    });
    return out;
  }

  var oldPresetFromProvider = DTM.presetFromProvider;
  DTM.presetFromProvider = function(provider, model, index){
    var p = oldPresetFromProvider ? oldPresetFromProvider(provider, model, index) : null;
    if(!p){
      p = { id:(provider.id || 'p') + '__' + slug(model), providerId:provider.id, providerType:provider.providerType || 'openai', providerName:provider.providerName || '', baseUrl:provider.baseUrl || '', apiKey:provider.apiKey || '', path:provider.path || '/v1/chat/completions', model:model };
    }
    if(provider && (provider.accessCode || provider.baseUrl === '__access__')){
      p.accessCode = provider.accessCode || provider.apiKey || '';
      p.accessPackageId = provider.accessPackageId || '';
      p.accessStatus = provider.accessStatus || 'active';
      p.readOnly = true;
      p.baseUrl = provider.baseUrl || '__access__';
      p.apiKey = provider.apiKey || provider.accessCode;
    }
    return p;
  };
  DTM.accessPackagesToPresets = accessPackagesToPresetsFixed;

  var oldEnsureSettingsShape = DTM.ensureSettingsShape;
  DTM.ensureSettingsShape = function(raw){
    var base = oldEnsureSettingsShape ? oldEnsureSettingsShape(raw) : (raw || {});
    var packages = loadClaimedPackages();
    if(packages.length){
      var providers = Array.isArray(base.modelProviders) ? base.modelProviders.slice() : [];
      var presets = Array.isArray(base.modelPresets) ? base.modelPresets.slice() : [];
      providers = providers.map(function(p){
        if(p && p.baseUrl === '__access__' && !p.accessCode) p.accessCode = p.apiKey || '';
        return p;
      });
      presets = presets.map(function(p){
        if(p && p.baseUrl === '__access__' && !p.accessCode) p.accessCode = p.apiKey || '';
        return p;
      });
      var providerIds = {};
      providers.forEach(function(p){ providerIds[p.id] = true; });
      packages.forEach(function(pkg, i){
        var ap = accessProviderFromPackage(pkg, i);
        if(!providerIds[ap.id]){ providers.push(ap); providerIds[ap.id] = true; }
      });
      var presetIds = {};
      presets.forEach(function(p){ presetIds[p.id] = true; });
      accessPackagesToPresetsFixed(packages).forEach(function(p){
        if(!presetIds[p.id]){ presets.push(p); presetIds[p.id] = true; }
      });
      base.modelProviders = providers;
      base.modelPresets = presets;
      if(!base.activePresetId || !presetIds[base.activePresetId]){
        var firstAccess = presets.find(function(p){ return p.accessCode && p.accessStatus === 'active'; });
        if(firstAccess) base.activePresetId = firstAccess.id;
        else if(presets[0]) base.activePresetId = presets[0].id;
      }
    }
    return base;
  };

  document.addEventListener('click', function(e){
    if(!e.target || !e.target.closest || !e.target.closest('#claimAccessBtn')) return;
    setTimeout(function(){
      try{
        var packages = loadClaimedPackages();
        if(!packages.length) return;
        var label = document.getElementById('modelTopLabel');
        if(label && /请填写|请先添加/.test(label.textContent || '')) location.reload();
      }catch(_e){}
    }, 1300);
  }, true);
})();
