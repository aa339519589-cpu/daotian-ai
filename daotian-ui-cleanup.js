(function(){
  'use strict';

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

  function removeSearchSources(root){
    root = root || document;
    root.querySelectorAll('.assistant-render, .bubble, .assistant-content').forEach(function(el){
      if(!el || !el.childNodes) return;
      Array.from(el.childNodes).forEach(function(node){
        if(node.nodeType === 3){
          node.nodeValue = String(node.nodeValue || '').replace(/[\[（(]?来源[:：]\s*搜索结果\d+[\]）)]?/g, '');
        }
      });
      el.querySelectorAll('p, span, div, li').forEach(function(x){
        if(!x.children.length){
          var t = x.textContent || '';
          var cleaned = t.replace(/[\[（(]?来源[:：]\s*搜索结果\d+[\]）)]?/g, '').trim();
          if(cleaned !== t.trim()) x.textContent = cleaned;
          if(!x.textContent.trim()) x.remove();
        }
      });
    });
  }

  function cleanDaotianBrand(root){
    root = root || document;
    root.querySelectorAll('.sidebar-label, .brand').forEach(function(el){
      el.style.visibility = 'hidden';
    });
    root.querySelectorAll('.brand-name').forEach(function(el){
      el.style.display = 'none';
    });
    root.querySelectorAll('.empty-logo').forEach(function(el){
      el.style.display = 'none';
    });
  }

  function cleanup(){
    fixPinnedDots();
    removeSearchSources(document);
    cleanDaotianBrand(document);
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', cleanup, {once:true});
  }else{
    cleanup();
  }

  try{
    new MutationObserver(function(){ cleanup(); }).observe(document.documentElement, {childList:true, subtree:true, characterData:true});
  }catch(_e){}
})();
