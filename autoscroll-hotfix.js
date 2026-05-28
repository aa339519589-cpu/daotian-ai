(function(){
  'use strict';

  var AUTO_KEY = 'daotian.autoScroll.v1';
  var RESET_KEY = 'daotian.autoScroll.defaultOff.v1';
  var patchedBox = null;

  function getAutoFollowEnabled(){
    try{ return localStorage.getItem(AUTO_KEY) === 'true'; }catch(_e){ return false; }
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

  function installScrollGuard(){
    forceDefaultOffOnce();
    var box = document.getElementById('messages');
    if(!box || box === patchedBox || box.__dtAutoFollowGuard) return;

    var proto = Element.prototype;
    var desc = Object.getOwnPropertyDescriptor(proto, 'scrollTop');
    if(!desc || !desc.get || !desc.set) return;

    patchedBox = box;
    box.__dtAutoFollowGuard = true;
    var allowUntil = 0;

    box.addEventListener('touchstart', function(){ allowUntil = Date.now() + 1200; }, {passive:true});
    box.addEventListener('touchmove', function(){ allowUntil = Date.now() + 1200; }, {passive:true});
    box.addEventListener('wheel', function(){ allowUntil = Date.now() + 1200; }, {passive:true});

    Object.defineProperty(box, 'scrollTop', {
      configurable:true,
      get:function(){ return desc.get.call(this); },
      set:function(v){
        if(!getAutoFollowEnabled() && Date.now() > allowUntil){
          return;
        }
        desc.set.call(this, v);
      }
    });
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
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', tick, {once:true});
  }else{
    tick();
  }

  new MutationObserver(tick).observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('storage', tick, {passive:true});
})();