'use strict';
window.DAOTIAN_MODEL_UTILS = window.DAOTIAN_MODEL_UTILS || {};
(function(){
  const DTC = window.DAOTIAN_CONFIG || {};

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

  function modelValuesFromProvider(p){
    if(Array.isArray(p.models) || typeof p.models === 'string') return splitModels(p.models);
    if(Array.isArray(p.modelList) || typeof p.modelList === 'string') return splitModels(p.modelList);
    if(typeof p.model === 'string') return splitModels(p.model);
    return [];
  }

  function normalizeProvider(p, i){
    p = p && typeof p === 'object' ? p : {};
    const providerName = String(p.providerName || p.name || p.label || '').trim();
    const baseUrl = String(p.baseUrl || '').trim();
    const models = modelValuesFromProvider(p);
    const id = String(p.id || p.providerId || makeProviderId(providerName, baseUrl, i)).trim();
    return {
      id,
      providerType: String(p.providerType || DTC.defaultSettings.providerType || 'openai'),
      providerName,
      baseUrl,
      apiKey: String(p.apiKey || '').trim(),
      path: String(p.path || p.requestPath || DTC.defaultSettings.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
      models: Array.from(new Set(models))
    };
  }

  function providerHasConfig(provider){
    if(!provider) return false;
    return !!(
      (provider.providerName && provider.providerName.trim()) ||
      (provider.baseUrl && provider.baseUrl.trim()) ||
      (provider.apiKey && provider.apiKey.trim()) ||
      (provider.models && provider.models.length) ||
      (provider.path && provider.path !== DTC.defaultSettings.path)
    );
  }

  function normalizeProviders(providers){
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
        providerType: String(p.providerType || DTC.defaultSettings.providerType || 'openai'),
        providerName: String(p.providerName || p.name || '').trim(),
        baseUrl: String(p.baseUrl || '').trim(),
        apiKey: String(p.apiKey || '').trim(),
        path: String(p.path || DTC.defaultSettings.path || '/v1/chat/completions').trim() || '/v1/chat/completions',
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
      (String(base.baseUrl || '').trim() && String(base.baseUrl || '').trim() !== DTC.legacyDefaultSettings.baseUrl) ||
      (String(base.model || '').trim() && String(base.model || '').trim() !== DTC.legacyDefaultSettings.model) ||
      (String(base.providerName || '').trim() && String(base.providerName || '').trim() !== DTC.legacyDefaultSettings.providerName)
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
    var hasProviderList = raw && typeof raw === 'object' && Array.isArray(raw.modelProviders);
    var hasShareProviderList = raw && typeof raw === 'object' && Array.isArray(raw.shareModelProviders);
    var hasPresetList = raw && typeof raw === 'object' && Array.isArray(raw.modelPresets);
    var base = Object.assign({}, DTC.defaultSettings, raw || {});
    base.sharePackageProviderId = String(base.sharePackageProviderId || '').trim();
    var providers = [];
    if(hasProviderList){
      providers = base.modelProviders.map(normalizeProvider).filter(providerHasConfig);
      providers = normalizeProviders(providers);
    }else if(hasPresetList && base.modelPresets.length){
      providers = providersFromPresets(base.modelPresets);
    }
    if(!providers.length && !hasProviderList && !hasPresetList) providers = legacyProviders(base);
    providers = providers.filter(function(provider){
      return !(provider && provider.id === 'p_ollama_builtin' && provider.providerType === 'ollama' && provider.models && provider.models.length === 1 && provider.models[0] === 'gemma4');
    });
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

  var DTM = window.DAOTIAN_MODEL_UTILS;
  DTM.slugify = slugify;
  DTM.splitModels = splitModels;
  DTM.makeProviderId = makeProviderId;
  DTM.modelValuesFromProvider = modelValuesFromProvider;
  DTM.normalizeProvider = normalizeProvider;
  DTM.providerHasConfig = providerHasConfig;
  DTM.normalizeProviders = normalizeProviders;
  DTM.presetFromProvider = presetFromProvider;
  DTM.providersToPresets = providersToPresets;
  DTM.accessPackageKey = accessPackageKey;
  DTM.accessPackageStatus = accessPackageStatus;
  DTM.normalizeAccessPackage = normalizeAccessPackage;
  DTM.accessPackageToPreset = accessPackageToPreset;
  DTM.accessPackagesToPresets = accessPackagesToPresets;
  DTM.providerKeyFromPreset = providerKeyFromPreset;
  DTM.providersFromPresets = providersFromPresets;
  DTM.legacyProviders = legacyProviders;
  DTM.ensureSettingsShape = ensureSettingsShape;
})();
