(function(){
  'use strict';

  var cleanupRaf = 0;

  function pinnedMeta(){
    try{
      var raw = localStorage.getItem('daotian.sidebar.meta.v1');
      var meta = raw ? JSON.parse(raw) : {};
      return meta && meta.pinned && typeof meta.pinned === 'object' ? meta.pinned : {};
    }catch(_e){ return {}; }
  }

  function fixPinnedDots(){
    var pinned = pinnedMeta();
    document.querySelectorAll('.chat-item').forEach(function(item){
      var id = item.getAttribute('data-id') || '';
      item.classList.toggle('pinned', !!pinned[id]);
    });
  }

  function removeNoisyBranding(){
    document.querySelectorAll('.sidebar .brand,.empty-logo,.brand-name,.empty-prompt,.brand-main-row').forEach(function(el){
      if(el && el.parentNode) el.setAttribute('aria-hidden', 'true');
    });
  }

  function cleanup(){
    fixPinnedDots();
    removeNoisyBranding();
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
  observer.observe(document.documentElement, {childList:true, subtree:true});
})();
