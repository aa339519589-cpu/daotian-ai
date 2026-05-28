(function(){
  'use strict';

  var AUTO_KEY = 'daotian.autoScroll.v1';
  var RESET_KEY = 'daotian.autoScroll.defaultOff.v2';
  var patchedBox = null;
  var prototypePatched = false;
  var originalScrollIntoView = null;

  function getAutoFollowEnabled(){
    try{ return localStorage.getItem(AUTO_KEY) === 'true'; }catch(_e){ return false; }
  }

  function setAutoFollowEnabled(v){
    try{ localStorage.setItem(AUTO_KEY, v ? 'true' : 'false'); }catch(_e){}
  }

  function forceDefaultOffOnce(){
    try{
      if(localStorage.getItem(RESET_KEY) !== '1'){
        localStorage.setItem(AUTO_KEY, 'false');
        localStorage.setItem(RESET_KEY, '1');
      }
      if(localStorage.getItem(AUTO_KEY) === null){
        localStorage.setItem(AUTO_KEY, 'false');
      }
    }catch(_e){}
  }

  function insideMessages(el){
    try{
      return !!(el && (el.id === 'messages' || (el.closest && el.closest('#messages'))));
    }catch(_e){ return false; }
  }

  function installPrototypeGuard(){
    if(prototypePatched) return;
    prototypePatched = true;
    originalScrollIntoView = Element.prototype.scrollIntoView;
    if(typeof originalScrollIntoView === 'function'){
      Element.prototype.scrollIntoView = function(){
        if(insideMessages(this) && !getAutoFollowEnabled()) return;
        return originalScrollIntoView.apply(this, arguments);
      };
    }
  }

  function installScrollGuard(){
    forceDefaultOffOnce();
    installPrototypeGuard();

    var box = document.getElementById('messages');
    if(!box || box === patchedBox || box.__dtAutoFollowGuard) return;

    try{
      box.style.overflowY = 'auto';
      box.style.touchAction = 'pan-y';
      box.style.webkitOverflowScrolling = 'touch';
    }catch(_e){}

    var proto = Element.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
    if(!desc || !desc.get || !desc.set) return;

    patchedBox = box;
    box.__dtAutoFollowGuard = true;

    var nativeScrollTo = box.scrollTo;
    var nativeScrollBy = box.scrollBy;

    Object.defineProperty(box, 'scrollTop', {
      configurable:true,
      get:function(){ return desc.get.call(this); },
      set:function(v){
        if(!getAutoFollowEnabled()) return;
        desc.set.call(this, v);
      }
    });

    if(typeof nativeScrollTo === 'function'){
      box.scrollTo = function(){
        if(!getAutoFollowEnabled()) return;
        return nativeScrollTo.apply(this, arguments);
      };
    }

    if(typeof nativeScrollBy === 'function'){
      box.scrollBy = function(){
        if(!getAutoFollowEnabled()) return;
        return nativeScrollBy.apply(this, arguments);
      };
    }
  }

  function syncToggleUI(){
    try{
      var on = getAutoFollowEnabled();
      document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){
        row.setAttribute('data-on', on ? '1' : '0');
        var sw = row.querySelector('.settings-toggle-switch');
        if(sw) sw.classList.toggle('on', on);
      });
    }catch(_e){}
  }

  function tick(){
    installScrollGuard();
    syncToggleUI();
  }

  forceDefaultOffOnce();

  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
    if(!row) return;
    setTimeout(function(){
      var on = row.getAttribute('data-on') === '1';
      setAutoFollowEnabled(on);
      syncToggleUI();
    }, 0);
  }, true);

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tick, {once:true});
  }else{
    tick();
  }

  new MutationObserver(tick).observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('storage', tick, {passive:true});
})();
