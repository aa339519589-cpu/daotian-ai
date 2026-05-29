// upload-hotfix.js — fixes file/PDF uploads lost before /chat fetch
// Also prevents the old 30s front-end timeout from turning a still-running assistant reply into a red error bubble.
(function(){
  'use strict';
  if(window.__DAOTIAN_UPLOAD_HOTFIX__) return;
  window.__DAOTIAN_UPLOAD_HOTFIX__ = 'v3-20260529-upload-pdf-timeout-autoscroll-guard';

  var CACHE_TTL = 10 * 60 * 1000;
  var fileCache = [];
  var FILE_GUARD_PROMPT = [
    '【文件读取硬规则】',
    '本轮用户上传了文件。只有在后端明确注入了文件正文、OCR文字、页面文本或图片视觉内容时，才可以回答文件里的具体内容。',
    '如果上下文里只有文件名、大小、页数未知、解析失败、OCR失败、扫描版、无法提取文字等信息，必须直接说明“我没有读到文件正文”，不能猜题目数量、章节、页数、题型、答案或内容。',
    '不能根据文件名、教材章节名、常见讲义格式推断里面有多少题；不知道就说不知道。',
    '如果用户要求数题、总结、做题，而正文未读到，只能要求用户上传清晰图片/截图/可复制文字层PDF。'
  ].join('\n');

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

  function injectFileGuard(body){
    if(!body || !Array.isArray(body.messages)) return body;
    var exists = body.messages.some(function(m){ return m && m.role === 'system' && String(m.content||'').indexOf('【文件读取硬规则】') >= 0; });
    if(!exists){
      var sysIdx = body.messages.findIndex(function(m){ return m && m.role === 'system'; });
      if(sysIdx >= 0){
        body.messages[sysIdx] = Object.assign({}, body.messages[sysIdx], { content:String(body.messages[sysIdx].content||'') + '\n\n' + FILE_GUARD_PROMPT });
      }else{
        body.messages.unshift({ role:'system', content:FILE_GUARD_PROMPT });
      }
    }
    return body;
  }

  function pickFiles(marker){
    prune();
    if(!marker || !fileCache.length) return [];
    var rawText = String(marker.text || '');
    var decodedText = safeDecode(rawText);
    var selected = fileCache.filter(function(x){
      return rawText.indexOf(x.name) >= 0 || rawText.indexOf(x.encodedName) >= 0 || decodedText.indexOf(x.name) >= 0;
    });
    if(!selected.length){ selected = fileCache.slice(-marker.count); }
    return selected.slice(-marker.count);
  }

  // app.js has an internal 30s timer that mutates the same assistant message into role='error'.
  // For scanned/OCR PDFs that is too short; when the upstream later streams real text, it stays red.
  // Patch only that exact timeout callback and leave all other timers untouched.
  try{
    var rawSetTimeout = window.setTimeout.bind(window);
    if(!window.__DAOTIAN_TIMEOUT_PATCHED__){
      window.__DAOTIAN_TIMEOUT_PATCHED__ = true;
      window.setTimeout = function(fn, delay){
        try{
          var src = typeof fn === 'function' ? Function.prototype.toString.call(fn) : '';
          if(Number(delay) === 30000 && src.indexOf('请求超时，没有收到回复') >= 0 && src.indexOf("assistant.role='error'") >= 0){
            return rawSetTimeout(function(){
              console.warn('[upload-hotfix] suppressed stale 30s chat timeout; request is still allowed to finish');
            }, 30000);
          }
        }catch(_e){}
        return rawSetTimeout.apply(window, arguments);
      };
    }
  }catch(e){ console.warn('[upload-hotfix] timeout patch skipped:', e && e.message ? e.message : e); }

  var originalFetch = window.fetch ? window.fetch.bind(window) : null;
  if(originalFetch){
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
            body = injectFileGuard(body);
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
              init = Object.assign({}, init, { body:JSON.stringify(body) });
              console.warn('[upload-hotfix] file marker found but no cached File object matched');
            }
          }
        }
      }catch(err){
        console.warn('[upload-hotfix] skipped:', err && err.message ? err.message : err);
      }
      return originalFetch(input, init);
    };
  }

  // Auto-follow scroll guard. Default is OFF. Manual touch/wheel scrolling must never be locked by streaming.
  (function(){
    var AUTO_KEY = 'daotian.autoScroll.v1';
    var RESET_KEY = 'daotian.autoScroll.defaultOff.v2';
    var patchedBox = null;
    var prototypePatched = false;
    var originalScrollIntoView = null;
    var userOverrideUntil = 0;

    function autoOn(){ try{ return localStorage.getItem(AUTO_KEY) === 'true'; }catch(_e){ return false; } }
    function setAuto(v){ try{ localStorage.setItem(AUTO_KEY, v ? 'true' : 'false'); }catch(_e){} }
    function nearBottom(box){ return !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 90); }
    function manualActive(){
      var box = document.getElementById('messages');
      if(nearBottom(box)){ userOverrideUntil = 0; return false; }
      return Date.now() < userOverrideUntil;
    }
    function markManual(){ userOverrideUntil = Date.now() + 10 * 60 * 1000; }
    function canProgramScroll(){ return autoOn() && !manualActive(); }
    function defaultOff(){
      try{
        if(localStorage.getItem(RESET_KEY) !== '1'){
          localStorage.setItem(AUTO_KEY, 'false');
          localStorage.setItem(RESET_KEY, '1');
        }
        if(localStorage.getItem(AUTO_KEY) === null) localStorage.setItem(AUTO_KEY, 'false');
      }catch(_e){}
    }
    function insideMessages(el){
      try{ return !!(el && (el.id === 'messages' || (el.closest && el.closest('#messages')))); }catch(_e){ return false; }
    }
    function patchScrollIntoView(){
      if(prototypePatched) return;
      prototypePatched = true;
      originalScrollIntoView = Element.prototype.scrollIntoView;
      if(typeof originalScrollIntoView === 'function'){
        Element.prototype.scrollIntoView = function(){
          if(insideMessages(this) && !canProgramScroll()) return;
          return originalScrollIntoView.apply(this, arguments);
        };
      }
    }
    function patchBox(){
      defaultOff();
      patchScrollIntoView();
      var box = document.getElementById('messages');
      if(!box || box === patchedBox || box.__dtAutoFollowGuard) return;
      box.style.overflowY = 'auto';
      box.style.touchAction = 'pan-y';
      box.style.webkitOverflowScrolling = 'touch';
      var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop');
      if(!desc || !desc.get || !desc.set) return;
      patchedBox = box;
      box.__dtAutoFollowGuard = true;
      var nativeScrollTo = box.scrollTo;
      var nativeScrollBy = box.scrollBy;
      box.addEventListener('touchstart', markManual, {passive:true});
      box.addEventListener('touchmove', markManual, {passive:true});
      box.addEventListener('wheel', markManual, {passive:true});
      box.addEventListener('pointerdown', markManual, {passive:true});
      box.addEventListener('scroll', function(){ if(nearBottom(box)) userOverrideUntil = 0; }, {passive:true});
      Object.defineProperty(box, 'scrollTop', {
        configurable:true,
        get:function(){ return desc.get.call(this); },
        set:function(v){ if(canProgramScroll()) desc.set.call(this, v); }
      });
      if(typeof nativeScrollTo === 'function'){
        box.scrollTo = function(){ if(canProgramScroll()) return nativeScrollTo.apply(this, arguments); };
      }
      if(typeof nativeScrollBy === 'function'){
        box.scrollBy = function(){ if(canProgramScroll()) return nativeScrollBy.apply(this, arguments); };
      }
    }
    function syncToggle(){
      try{
        var on = autoOn();
        document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){
          row.setAttribute('data-on', on ? '1' : '0');
          var sw = row.querySelector('.settings-toggle-switch');
          if(sw) sw.classList.toggle('on', on);
        });
      }catch(_e){}
    }
    function tick(){ patchBox(); syncToggle(); }
    defaultOff();
    document.addEventListener('click', function(e){
      var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
      if(!row) return;
      setTimeout(function(){
        var on = row.getAttribute('data-on') === '1';
        if(on) userOverrideUntil = 0;
        setAuto(on);
        syncToggle();
      }, 0);
    }, true);
    if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once:true});
    else tick();
    new MutationObserver(tick).observe(document.documentElement, {childList:true, subtree:true});
    window.addEventListener('storage', tick, {passive:true});
  })();
})();
