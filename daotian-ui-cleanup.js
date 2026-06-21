(function(){
  'use strict';

  var cleanupRaf = 0;
  var mathJaxGuardTimer = 0;
  var mathJaxGuardTries = 0;

  function pinnedMeta(){
    try{
      var raw = localStorage.getItem('daotian.sidebar.meta.v1');
      var meta = raw ? JSON.parse(raw) : {};
      return meta && meta.pinned && typeof meta.pinned === 'object' ? meta.pinned : {};
    }catch(_e){ return {}; }
  }

  function isDaotianBrandText(text){
    return /^(稻田\s*A[Ii]|稻田AI)$/.test(String(text || '').replace(/\s+/g, ''));
  }

  function hardHide(el){
    if(!el || el.nodeType !== 1) return;
    el.setAttribute('aria-hidden', 'true');
    el.setAttribute('hidden', '');
    el.style.setProperty('display', 'none', 'important');
    el.style.setProperty('visibility', 'hidden', 'important');
    el.style.setProperty('width', '0', 'important');
    el.style.setProperty('height', '0', 'important');
    el.style.setProperty('margin', '0', 'important');
    el.style.setProperty('padding', '0', 'important');
    el.style.setProperty('overflow', 'hidden', 'important');
  }

  function fixPinnedDots(){
    var pinned = pinnedMeta();
    document.querySelectorAll('.chat-item').forEach(function(item){
      var id = item.getAttribute('data-id') || '';
      item.classList.toggle('pinned', !!pinned[id]);
    });
  }

  function removeSidebarBranding(){
    var sideTop = document.querySelector('.sidebar-top');
    if(!sideTop) return;

    Array.prototype.slice.call(sideTop.childNodes).forEach(function(node){
      if(node.nodeType === 3 && isDaotianBrandText(node.textContent)) node.textContent = '';
    });

    sideTop.querySelectorAll('*').forEach(function(el){
      var text = (el.textContent || '').trim();
      if(isDaotianBrandText(text)) hardHide(el);
    });

    document.querySelectorAll('.sidebar .brand,[class*="brand"]').forEach(function(el){
      var inSidebar = el.closest && el.closest('.sidebar');
      var text = (el.textContent || '').trim();
      if(inSidebar && (!text || isDaotianBrandText(text))) hardHide(el);
    });
  }

  function removeHomeBranding(){
    document.querySelectorAll('.empty-logo,.brand-name,.empty-prompt,.brand-main-row').forEach(function(el){
      hardHide(el);
    });
  }

  function fixModelEmptyText(){
    var label = document.getElementById('modelTopLabel');
    if(label && label.textContent && label.textContent.indexOf('请先添加模型提供方') >= 0){
      label.textContent = '请先添加模型';
      label.title = '请先添加模型';
    }
    document.querySelectorAll('#modelPopover div').forEach(function(el){
      if(el.textContent && el.textContent.indexOf('请先添加模型提供方') >= 0){
        el.textContent = el.textContent.replace('请先添加模型提供方', '请先添加模型');
      }
    });
  }

  function ensureMathStreamStyle(){
    if(document.getElementById('daotianMathStreamGuardStyle')) return;
    var style = document.createElement('style');
    style.id = 'daotianMathStreamGuardStyle';
    style.textContent = '\
.message.assistant.streaming-live.math-streaming-pending .assistant-render{position:relative!important;min-height:1.65em!important;color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;}\
.message.assistant.streaming-live.math-streaming-pending .assistant-render *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important;}\
.message.assistant.streaming-live.math-streaming-pending .assistant-render::after{content:"公式生成中…";position:absolute;left:0;top:0;color:var(--muted)!important;-webkit-text-fill-color:var(--muted)!important;opacity:.72;font:inherit;line-height:1.65;pointer-events:none;}\
';
    document.head.appendChild(style);
  }

  function hasActiveStreaming(){
    return !!document.querySelector('.message.assistant.streaming-live,[data-scroll-focus="1"]');
  }

  function hasMathSyntax(text){
    var s = String(text || '');
    return /\\\(|\\\[|\\frac|\\sqrt|\\sum|\\int|\\lim|\\begin\{|\\end\{|\$\$|(?:^|[^$])\$[^$\n]/.test(s);
  }

  /* 旧的「公式生成中」隐藏守卫已停用：数学公式现在在流式输出中实时渲染，
     不再需要把内容设为透明并显示占位。这里只负责清除可能残留的守卫痕迹。 */
  function clearMathStreamGuard(){
    var style = document.getElementById('daotianMathStreamGuardStyle');
    if(style && style.parentNode) style.parentNode.removeChild(style);
    document.querySelectorAll('.math-streaming-pending').forEach(function(el){
      el.classList.remove('math-streaming-pending');
    });
    document.querySelectorAll('.assistant-render[aria-busy="true"]').forEach(function(el){
      el.removeAttribute('aria-busy');
    });
  }

  function installMathJaxStreamGuard(){
    var mj = window.MathJax;
    if(!mj) return false;
    var hasPromise = typeof mj.typesetPromise === 'function';
    var hasClear = typeof mj.typesetClear === 'function';
    if(!hasPromise && !hasClear) return false;
    if(mj.__daotianStreamGuardInstalled) return true;

    var originalTypesetPromise = mj.typesetPromise;
    var originalTypesetClear = mj.typesetClear;

    if(hasPromise){
      mj.typesetPromise = function(){
        if(hasActiveStreaming()) return Promise.resolve();
        return originalTypesetPromise.apply(mj, arguments);
      };
    }
    if(hasClear){
      mj.typesetClear = function(){
        if(hasActiveStreaming()) return;
        return originalTypesetClear.apply(mj, arguments);
      };
    }
    mj.__daotianStreamGuardInstalled = true;
    return true;
  }

  function scheduleMathJaxGuard(){
    if(installMathJaxStreamGuard()) return;
    if(mathJaxGuardTries > 80) return;
    clearTimeout(mathJaxGuardTimer);
    mathJaxGuardTries++;
    mathJaxGuardTimer = setTimeout(scheduleMathJaxGuard, 250);
  }

  function cleanup(){
    fixPinnedDots();
    removeSidebarBranding();
    removeHomeBranding();
    fixModelEmptyText();
    /* 不再隐藏流式公式、不再拦截 MathJax —— 公式实时渲染由 app.js 负责 */
    clearMathStreamGuard();
  }

  function scheduleCleanup(){
    if(cleanupRaf) return;
    cleanupRaf = requestAnimationFrame(function(){
      cleanupRaf = 0;
      cleanup();
    });
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', cleanup, {once:true});
  }else{
    cleanup();
  }

  var observer = new MutationObserver(scheduleCleanup);
  observer.observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','data-scroll-focus']});
})();
