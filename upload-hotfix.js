// upload-hotfix.js — fixes file/PDF uploads lost before /chat fetch
// Root cause: app.js clears the private _attachments array before callModelWithBody checks it,
// so the request is sent as JSON instead of multipart/form-data. This script captures File objects
// at selection time and converts the affected /chat JSON request back into FormData.
(function(){
  'use strict';
  if(window.__DAOTIAN_UPLOAD_HOTFIX__) return;
  window.__DAOTIAN_UPLOAD_HOTFIX__ = 'v1-20260528';

  var CACHE_TTL = 10 * 60 * 1000;
  var fileCache = [];

  function now(){ return Date.now(); }
  function safeDecode(s){ try{ return decodeURIComponent(String(s||'')); }catch(e){ return String(s||''); } }
  function fileKey(f){ return [f && f.name || '', f && f.size || 0, f && f.lastModified || 0].join('|'); }
  function prune(){
    var t = now();
    fileCache = fileCache.filter(function(x){ return x && x.file && (t - x.ts) <= CACHE_TTL; }).slice(-20);
  }
  function rememberFile(file){
    if(!file || !file.name) return;
    prune();
    var key = fileKey(file);
    fileCache = fileCache.filter(function(x){ return x.key !== key; });
    fileCache.push({ key:key, file:file, name:file.name, encodedName:encodeURIComponent(file.name), size:file.size, type:file.type, ts:now() });
    fileCache = fileCache.slice(-20);
    console.log('[upload-hotfix] captured file:', file.name, file.size, file.type || '');
  }

  // Capture before app.js clears input.value.
  document.addEventListener('change', function(e){
    var el = e.target;
    if(!el || !el.matches || !el.matches('input[type="file"]') || !el.files) return;
    Array.prototype.forEach.call(el.files, rememberFile);
  }, true);

  function looksLikeChatFileRequest(body){
    if(!body || !Array.isArray(body.messages)) return null;
    for(var i = body.messages.length - 1; i >= 0; i--){
      var m = body.messages[i];
      if(!m || m.role !== 'user' || typeof m.content !== 'string') continue;
      var match = m.content.match(/\[已发送\s*(\d+)\s*个文件：/);
      if(match) return { text:m.content, count:Math.max(1, parseInt(match[1], 10) || 1) };
    }
    return null;
  }

  function pickFiles(marker){
    prune();
    if(!marker || !fileCache.length) return [];
    var rawText = String(marker.text || '');
    var decodedText = safeDecode(rawText);
    var selected = fileCache.filter(function(x){
      return rawText.indexOf(x.name) >= 0 || rawText.indexOf(x.encodedName) >= 0 || decodedText.indexOf(x.name) >= 0;
    });
    if(!selected.length){
      selected = fileCache.slice(-marker.count);
    }
    return selected.slice(-marker.count);
  }

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if(!originalFetch) return;

  window.fetch = function(input, init){
    try{
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = init && init.method ? String(init.method).toUpperCase() : 'GET';
      var isChat = url === '/chat' || /\/chat(?:\?|$)/.test(url);
      var isJsonBody = init && typeof init.body === 'string';
      if(isChat && method === 'POST' && isJsonBody){
        var body = JSON.parse(init.body || '{}');
        var marker = looksLikeChatFileRequest(body);
        if(marker){
          var files = pickFiles(marker);
          if(files.length){
            var fd = new FormData();
            fd.append('body', JSON.stringify(body));
            files.forEach(function(x){ fd.append('files', x.file, x.name); });
            var headers = Object.assign({}, init.headers || {});
            delete headers['Content-Type'];
            delete headers['content-type'];
            init = Object.assign({}, init, { body:fd, headers:headers });
            console.log('[upload-hotfix] converted /chat to multipart, files:', files.map(function(x){ return x.name; }).join(', '));
          }else{
            console.warn('[upload-hotfix] file marker found but no cached File object matched');
          }
        }
      }
    }catch(err){
      console.warn('[upload-hotfix] skipped:', err && err.message ? err.message : err);
    }
    return originalFetch(input, init);
  };
})();
