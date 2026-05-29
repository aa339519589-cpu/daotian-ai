'use strict';

/* ==============================================================
   upload.js — 文件上传与解析模块
   从 app.js 提取，依赖 globals.js（_attachments、toast、$）
   部分回调依赖 app.js（escapeHTML 等，运行时查找）
   ============================================================== */

/* ── Upload hotfix merged from upload-hotfix.js ── */
var UPLOAD_CACHE_TTL = 10 * 60 * 1000;
var uploadFileCache = [];
var FILE_GUARD_PROMPT = [
  '【文件读取硬规则】',
  '本轮用户上传了文件。只有在后端明确注入了文件正文、OCR文字、页面文本或图片视觉内容时，才可以回答文件里的具体内容。',
  '如果上下文里只有文件名、大小、页数未知、解析失败、OCR失败、扫描版、无法提取文字等信息，必须直接说明"我没有读到文件正文"，不能猜题目数量、章节、页数、题型、答案或内容。',
  '不能根据文件名、教材章节名、常见讲义格式推断里面有多少题；不知道就说不知道。',
  '如果用户要求数题、总结、做题，而正文未读到，只能要求用户上传清晰图片/截图/可复制文字层PDF。'
].join('\n');
function safeDecodeUploadName(s){
  try{ return decodeURIComponent(String(s||'')); }catch(e){ return String(s||''); }
}
function uploadFileKey(f){
  return [f && f.name || '', f && f.size || 0, f && f.lastModified || 0].join('|');
}
function pruneUploadFileCache(){
  var t = Date.now();
  uploadFileCache = uploadFileCache
    .filter(function(x){ return x && x.file && (t - x.ts) <= UPLOAD_CACHE_TTL; })
    .slice(-20);
}
function rememberUploadFile(file){
  if(!file || !file.name) return;
  pruneUploadFileCache();
  var key = uploadFileKey(file);
  uploadFileCache = uploadFileCache.filter(function(x){ return x.key !== key; });
  uploadFileCache.push({
    key:key,
    file:file,
    name:file.name,
    encodedName:encodeURIComponent(file.name),
    size:file.size,
    type:file.type,
    ts:Date.now()
  });
  uploadFileCache = uploadFileCache.slice(-20);
  console.log('[upload-hotfix] captured file:', file.name, file.size, file.type || '');
}
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
  var exists = body.messages.some(function(m){
    return m && m.role === 'system' && String(m.content||'').indexOf('【文件读取硬规则】') >= 0;
  });
  if(!exists){
    var sysIdx = body.messages.findIndex(function(m){ return m && m.role === 'system'; });
    if(sysIdx >= 0){
      body.messages[sysIdx] = Object.assign({}, body.messages[sysIdx], {
        content:String(body.messages[sysIdx].content||'') + '\n\n' + FILE_GUARD_PROMPT
      });
    }else{
      body.messages.unshift({ role:'system', content:FILE_GUARD_PROMPT });
    }
  }
  return body;
}
function pickUploadFiles(marker){
  pruneUploadFileCache();
  if(!marker || !uploadFileCache.length) return [];
  var rawText = String(marker.text || '');
  var decodedText = safeDecodeUploadName(rawText);
  var selected = uploadFileCache.filter(function(x){
    return rawText.indexOf(x.name) >= 0 ||
      rawText.indexOf(x.encodedName) >= 0 ||
      decodedText.indexOf(x.name) >= 0;
  });
  if(!selected.length) selected = uploadFileCache.slice(-marker.count);
  return selected.slice(-marker.count);
}

/* ── 文件扩展名常量 ── */
var TEXT_EXTENSIONS = ['txt','md','csv','json','js','html','css','py','java','cpp','c','h','rb','go','rs','ts','tsx','jsx','xml','yaml','yml','toml','ini','cfg','log','sh','bash','zsh','sql','r','m','swift','kt','scala','lua','pl','php'];
var IMAGE_EXTENSIONS = ['png','jpg','jpeg','webp','gif','bmp'];
var SUPPORTED_BINARY = ['pdf','docx','xlsx'];

/* ── 加号附件菜单 ── */
var _plusOpen = false;

function openPlusMenu(){
  _plusOpen = true;
  var menu = $('#plusMenu'); if(!menu) return;
  var btn = $('#plusBtn'); if(btn) btn.textContent = '×';
  menu.style.display = 'flex';
  menu.style.opacity = '0';
  menu.style.transform = 'translateY(8px)';
  requestAnimationFrame(function(){
    menu.style.transition = 'opacity 180ms ease-out, transform 180ms ease-out';
    menu.style.opacity = '1';
    menu.style.transform = 'translateY(0)';
  });
}

function closePlusMenu(){
  _plusOpen = false;
  var menu = $('#plusMenu'); if(!menu) return;
  var btn = $('#plusBtn'); if(btn) btn.textContent = '+';
  menu.style.opacity = '0';
  menu.style.transform = 'translateY(8px)';
  setTimeout(function(){ menu.style.display = 'none'; }, 180);
}

function togglePlusMenu(){
  if(_plusOpen) closePlusMenu(); else openPlusMenu();
}

function updateSearchVisual(){
  var capsule = $('#searchCapsule');
  if(capsule){
    if(searchOn){ capsule.classList.add('on'); }else{ capsule.classList.remove('on'); }
  }
}

function showAttachPreview(){
  try{
    var el = $('#attachPreview'); if(!el) return;
    if(!_attachments.length){ el.style.display = 'none'; el.innerHTML = ''; return; }
    el.style.display = 'flex';
    el.innerHTML = _attachments.map(function(a,i){
      return '<span class="attach-chip">'+escapeHTML(a.name)+'<button class="attach-chip-remove" data-attach-idx="'+i+'">×</button></span>';
    }).join('');
  }catch(err){ console.warn('[attach preview] failed:', err); }
}

function getFileExt(name){ var parts=(name||'').split('.'); return parts.length>1?parts.pop().toLowerCase():''; }
function isTextFile(name){ return TEXT_EXTENSIONS.indexOf(getFileExt(name)) >= 0; }
function isImageFile(name){ return IMAGE_EXTENSIONS.indexOf(getFileExt(name)) >= 0; }
function isBinaryFile(name){ return SUPPORTED_BINARY.indexOf(getFileExt(name)) >= 0; }

function addAttachment(file){
  if(_attachments.length >= 5){ toast('最多添加5个附件'); return; }
  rememberUploadFile(file);
  var entry = { file:file, name:file.name, type:file.type, size:file.size, status:'ready' };
  _attachments.push(entry);
  showAttachPreview();
  closePlusMenu();
}

function safeShowAttachPreview(data){
  try{
    if(typeof showAttachPreview === 'function'){ showAttachPreview(data); }
  }catch(e){ console.warn('[attach] safeShowAttachPreview:', e); }
}

function safeClearAttachments(){
  try{ _attachments = []; showAttachPreview(); }catch(e){ _attachments = []; }
}

/* ── 事件绑定 ── */
try{
  var _pb = $('#plusBtn'); if(_pb) _pb.onclick = togglePlusMenu;

  document.addEventListener('click', function(e){
    var chipDel = e.target.closest('.attach-chip-remove');
    if(chipDel){
      var idx = parseInt(chipDel.getAttribute('data-attach-idx'));
      if(!isNaN(idx) && idx >= 0 && idx < _attachments.length){
        _attachments.splice(idx, 1);
        showAttachPreview();
      }
      return;
    }
    var item = e.target.closest('.plus-menu-item');
    if(item){
      var action = item.getAttribute('data-action');
      if(action === 'camera'){ var ci = document.getElementById('cameraInput'); if(ci) ci.click(); }
      else if(action === 'image'){ var ii = document.getElementById('imageInput'); if(ii) ii.click(); }
      else if(action === 'file'){ var fi = document.getElementById('fileInput'); if(fi) fi.click(); }
      else if(action === 'search'){
        if(!searchOn){
          /* turning on → check server config */
          fetch('/api/search/status').then(function(r){ return r.json(); }).then(function(s){
            if(s && s.configured){
              searchOn = true; saveSearchOn(true); updateSearchVisual();
            }else{
              searchOn = false; toast('联网搜索未配置，请在 Render 环境变量添加 TAVILY_API_KEY');
            }
          }).catch(function(){
            searchOn = false; toast('无法检查搜索状态，请稍后重试');
          });
        }else{
          searchOn = false; saveSearchOn(false); updateSearchVisual();
        }
      }
      return;
    }
    if(_plusOpen && !e.target.closest('#plusMenu') && !e.target.closest('#plusBtn')){
      closePlusMenu();
    }
  });

  var _ci = document.getElementById('cameraInput');
  var _ii = document.getElementById('imageInput');
  var _fi = document.getElementById('fileInput');
  if(_ci) _ci.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
  if(_ii) _ii.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
  if(_fi) _fi.addEventListener('change', function(){ if(this.files && this.files[0]) addAttachment(this.files[0]); this.value = ''; });
}catch(_e2){}
