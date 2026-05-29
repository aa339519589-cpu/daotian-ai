(function(){
  'use strict';
  var EMPTY_PROMPT='\u200B';
  var SETTINGS_KEY='daotian.settings.v323';
  var PARAMS_KEY='daotian.modelParams.v1';
  var FLAG_KEY='daotian.systemPromptDefault.v2';
  var running=false;

  function readJSON(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(e){return f;}}
  function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function parseValue(v,f){try{return typeof v==='string'?JSON.parse(v):(v||f);}catch(e){return f;}}
  function splitModels(v){if(Array.isArray(v))return v.map(function(x){return String(x||'').trim();}).filter(Boolean);return String(v||'').split(/[\n,，;；]+/).map(function(x){return x.trim();}).filter(Boolean);}
  function slugify(v){return String(v||'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)||'x';}
  function collectPresetIds(settings){
    var ids=[];settings=settings&&typeof settings==='object'?settings:{};
    if(Array.isArray(settings.modelPresets)){settings.modelPresets.forEach(function(p){if(p&&p.id)ids.push(String(p.id));});}
    if(Array.isArray(settings.modelProviders)){settings.modelProviders.forEach(function(p){if(!p)return;var pid=String(p.id||'').trim();var models=splitModels(p.models||p.modelList||p.model||'');models.forEach(function(m){if(pid)ids.push(pid+'__'+slugify(m));});});}
    if(settings.activePresetId)ids.push(String(settings.activePresetId));
    return Array.from(new Set(ids.filter(Boolean)));
  }
  function blankMap(map,settings){
    if(!map||typeof map!=='object'||Array.isArray(map))map={};
    var changed=false;
    collectPresetIds(settings).forEach(function(id){
      var item=map[id]&&typeof map[id]==='object'?map[id]:{};
      if(item.systemPrompt!==EMPTY_PROMPT){item.systemPrompt=EMPTY_PROMPT;map[id]=item;changed=true;}
    });
    Object.keys(map).forEach(function(id){
      var item=map[id];
      if(item&&typeof item==='object'&&item.systemPrompt!==EMPTY_PROMPT){item.systemPrompt=EMPTY_PROMPT;changed=true;}
    });
    return {map:map,changed:changed};
  }
  function patchDataBag(bag){
    if(!bag||typeof bag!=='object')return false;
    var changed=false;
    function patchPair(prefix){
      var sk=prefix+SETTINGS_KEY,pk=prefix+PARAMS_KEY;
      if(!(pk in bag))return;
      var settings=parseValue(bag[sk],{});
      var map=parseValue(bag[pk],{});
      var patched=blankMap(map,settings);
      if(patched.changed){bag[pk]=JSON.stringify(patched.map);changed=true;}
    }
    patchPair('');
    Object.keys(bag).forEach(function(k){if(k.endsWith(PARAMS_KEY)){patchPair(k.slice(0,-PARAMS_KEY.length));}});
    return changed;
  }
  function patchFetchOnce(){
    try{
      if(window.__daotianPromptOffDataPatched||!window.fetch)return;
      window.__daotianPromptOffDataPatched=true;
      var rawFetch=window.fetch;
      window.fetch=function(input,init){
        var url=typeof input==='string'?input:(input&&input.url)||'';
        var method=String((init&&init.method)||(input&&input.method)||'GET').toUpperCase();
        var promise=rawFetch.apply(this,arguments);
        if(method==='GET'&&String(url).indexOf('/api/user/data')>=0){
          return promise.then(function(res){
            return res.clone().text().then(function(text){
              try{
                var obj=JSON.parse(text);
                if(obj&&obj.data&&patchDataBag(obj.data)){
                  var headers=new Headers(res.headers);
                  headers.set('content-type','application/json');
                  return new Response(JSON.stringify(obj),{status:res.status,statusText:res.statusText,headers:headers});
                }
              }catch(e){}
              return res;
            },function(){return res;});
          });
        }
        return promise;
      };
    }catch(e){}
  }
  function getPrefixes(){
    var out={'':true};
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(k===SETTINGS_KEY||k===PARAMS_KEY)out['']=true;if(k.endsWith('.'+SETTINGS_KEY))out[k.slice(0,-SETTINGS_KEY.length)]=true;if(k.endsWith('.'+PARAMS_KEY))out[k.slice(0,-PARAMS_KEY.length)]=true;}}catch(e){}
    return Object.keys(out);
  }
  function syncPromptOff(){
    if(running)return;running=true;
    try{
      getPrefixes().forEach(function(prefix){
        var settings=readJSON(prefix+SETTINGS_KEY,{});
        var map=readJSON(prefix+PARAMS_KEY,{});
        var patched=blankMap(map,settings);
        if(patched.changed)saveJSON(prefix+PARAMS_KEY,patched.map);
      });
      localStorage.setItem(FLAG_KEY,'disabled');
      window.__DAOTIAN_DEFAULT_SYSTEM_PROMPT__=EMPTY_PROMPT;
      window.__DAOTIAN_SYSTEM_PROMPT_DISABLED__=true;
    }catch(e){console.warn('[prompt-off]',e&&e.message?e.message:e);}finally{running=false;}
  }
  patchFetchOnce();
  syncPromptOff();setTimeout(syncPromptOff,300);setTimeout(syncPromptOff,1000);setTimeout(syncPromptOff,2500);
})();