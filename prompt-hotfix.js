(function(){
  'use strict';
  var NEW_PROMPT='说话默认朋友微信聊天风格，简洁直接，不许官方腔。但该干活干活，别矫情。独立思考。';
  var OLD_MARK_1='你是一个简洁自然的对话模型';
  var OLD_MARK_2='不要客服腔';
  var OLD_MARK_3='不要主客体说反';
  var SETTINGS_KEY='daotian.settings.v323';
  var PARAMS_KEY='daotian.modelParams.v1';
  var FLAG_KEY='daotian.systemPromptDefault.v2';
  var running=false;
  function readJSON(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(e){return f;}}
  function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function splitModels(v){if(Array.isArray(v))return v.map(function(x){return String(x||'').trim();}).filter(Boolean);return String(v||'').split(/[\n,，;；]+/).map(function(x){return x.trim();}).filter(Boolean);}
  function slugify(v){return String(v||'x').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').slice(0,48)||'x';}
  function shouldReplacePrompt(v){var s=String(v||'').trim();if(!s)return true;if(s===NEW_PROMPT)return false;return s.indexOf(OLD_MARK_1)>=0&&s.indexOf(OLD_MARK_2)>=0&&s.indexOf(OLD_MARK_3)>=0;}
  function collectPresetIds(settings){
    var ids=[];settings=settings&&typeof settings==='object'?settings:{};
    if(Array.isArray(settings.modelPresets)){settings.modelPresets.forEach(function(p){if(p&&p.id)ids.push(String(p.id));});}
    if(Array.isArray(settings.modelProviders)){settings.modelProviders.forEach(function(p){if(!p)return;var pid=String(p.id||'').trim();var models=splitModels(p.models||p.modelList||p.model||'');models.forEach(function(m){if(pid)ids.push(pid+'__'+slugify(m));});});}
    return Array.from(new Set(ids.filter(Boolean)));
  }
  function getPrefixes(){
    var out={'':true};
    try{for(var i=0;i<localStorage.length;i++){var k=localStorage.key(i)||'';if(k===SETTINGS_KEY||k===PARAMS_KEY)out['']=true;if(k.endsWith('.'+SETTINGS_KEY))out[k.slice(0,-SETTINGS_KEY.length)]=true;if(k.endsWith('.'+PARAMS_KEY))out[k.slice(0,-PARAMS_KEY.length)]=true;}}catch(e){}
    return Object.keys(out);
  }
  function syncPromptDefaults(){
    if(running)return;running=true;
    try{
      getPrefixes().forEach(function(prefix){
        var settings=readJSON(prefix+SETTINGS_KEY,{});
        var map=readJSON(prefix+PARAMS_KEY,{});
        if(!map||typeof map!=='object'||Array.isArray(map))map={};
        var changed=false;
        collectPresetIds(settings).forEach(function(id){var item=map[id]&&typeof map[id]==='object'?map[id]:{};if(shouldReplacePrompt(item.systemPrompt)){item.systemPrompt=NEW_PROMPT;map[id]=item;changed=true;}});
        Object.keys(map).forEach(function(id){var item=map[id];if(item&&typeof item==='object'&&shouldReplacePrompt(item.systemPrompt)){item.systemPrompt=NEW_PROMPT;changed=true;}});
        if(changed)saveJSON(prefix+PARAMS_KEY,map);
      });
      localStorage.setItem(FLAG_KEY,NEW_PROMPT);
      window.__DAOTIAN_DEFAULT_SYSTEM_PROMPT__=NEW_PROMPT;
    }catch(e){console.warn('[prompt-hotfix]',e&&e.message?e.message:e);}finally{running=false;}
  }
  syncPromptDefaults();setTimeout(syncPromptDefaults,300);setTimeout(syncPromptDefaults,1000);
  try{
    var oldSet=Storage.prototype.setItem;
    if(!Storage.prototype.__daotianPromptPatched){
      Object.defineProperty(Storage.prototype,'__daotianPromptPatched',{value:true,configurable:true});
      Storage.prototype.setItem=function(k,v){var r=oldSet.apply(this,arguments);try{var key=String(k||'');if(key.indexOf(SETTINGS_KEY)>=0||key.indexOf(PARAMS_KEY)>=0)setTimeout(syncPromptDefaults,0);}catch(e){}return r;};
    }
  }catch(e){}
})();
