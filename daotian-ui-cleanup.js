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

  function cleanup(){
    fixPinnedDots();
    removeSidebarBranding();
    removeHomeBranding();
    fixModelEmptyText();
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
  observer.observe(document.documentElement, {childList:true, subtree:true, characterData:true});
})();
