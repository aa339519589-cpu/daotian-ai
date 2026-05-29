(function(){
  'use strict';
  if(window.__DAOTIAN_SCROLL_KEYBOARD_FINAL_FIX__ === 'v2-20260529') return;
  window.__DAOTIAN_SCROLL_KEYBOARD_FINAL_FIX__ = 'v2-20260529';

  var AUTO_KEY = 'daotian.autoScroll.v1';
  var manualLock = false;
  var patchedBox = null;
  var baseDesc = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollTop') || Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTop');
  var rawScrollIntoView = Element.prototype.scrollIntoView;
  var rawProtoPatched = false;

  function autoOn(){
    try{
      if(localStorage.getItem(AUTO_KEY) === 'true') return true;
      for(var i=0;i<localStorage.length;i++){
        var k = localStorage.key(i) || '';
        if(k.indexOf(AUTO_KEY) >= 0 && localStorage.getItem(k) === 'true') return true;
      }
      var row = document.querySelector('[data-param="autoScroll"]');
      if(row && row.getAttribute('data-on') === '1') return true;
      var sw = row && row.querySelector('.settings-toggle-switch.on');
      if(sw) return true;
    }catch(_e){}
    return false;
  }

  function nearBottom(box){
    if(!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  }

  function markManual(){
    var box = document.getElementById('messages');
    if(!box) return;
    manualLock = !nearBottom(box);
  }

  function canProgramScroll(){
    var box = document.getElementById('messages');
    if(box && nearBottom(box)) manualLock = false;
    return autoOn() && !manualLock;
  }

  function insideMessages(el){
    try{ return !!(el && (el.id === 'messages' || (el.closest && el.closest('#messages')))); }catch(_e){ return false; }
  }

  function patchScrollIntoView(){
    if(rawProtoPatched) return;
    rawProtoPatched = true;
    if(typeof rawScrollIntoView === 'function'){
      Element.prototype.scrollIntoView = function(){
        if(insideMessages(this) && !canProgramScroll()) return;
        return rawScrollIntoView.apply(this, arguments);
      };
    }
  }

  function patchMessagesBox(){
    patchScrollIntoView();
    var box = document.getElementById('messages');
    if(!box) return;

    try{
      box.style.overflowY = 'auto';
      box.style.touchAction = 'pan-y';
      box.style.webkitOverflowScrolling = 'touch';
    }catch(_e){}

    if(box !== patchedBox){
      patchedBox = box;
      manualLock = false;
      box.addEventListener('touchstart', markManual, {passive:true});
      box.addEventListener('touchmove', function(){ manualLock = true; }, {passive:true});
      box.addEventListener('wheel', function(){ manualLock = true; }, {passive:true});
      box.addEventListener('pointerdown', markManual, {passive:true});
      box.addEventListener('scroll', function(){ if(nearBottom(box)) manualLock = false; }, {passive:true});
    }

    if(baseDesc && baseDesc.get && baseDesc.set){
      try{
        Object.defineProperty(box, 'scrollTop', {
          configurable:true,
          get:function(){ return baseDesc.get.call(this); },
          set:function(v){ if(canProgramScroll()) baseDesc.set.call(this, v); }
        });
      }catch(_e){}
    }

    var nativeScrollTo = Element.prototype.scrollTo;
    var nativeScrollBy = Element.prototype.scrollBy;
    if(typeof nativeScrollTo === 'function'){
      try{ box.scrollTo = function(){ if(canProgramScroll()) return nativeScrollTo.apply(this, arguments); }; }catch(_e){}
    }
    if(typeof nativeScrollBy === 'function'){
      try{ box.scrollBy = function(){ if(canProgramScroll()) return nativeScrollBy.apply(this, arguments); }; }catch(_e){}
    }
  }

  function syncViewportVars(){
    var vv = window.visualViewport;
    var h = vv ? vv.height : window.innerHeight;
    var top = vv ? vv.offsetTop : 0;
    var root = document.documentElement;
    root.style.setProperty('--app-height', Math.max(1, Math.round(h)) + 'px');
    root.style.setProperty('--app-top', Math.round(top) + 'px');
    root.style.setProperty('--vvh', Math.max(1, Math.round(h)) + 'px');

    var input = document.getElementById('input');
    var focused = input && document.activeElement === input;
    var keyboardLikely = focused && vv && (window.innerHeight - vv.height > 120);
    document.body.classList.toggle('keyboard-open', !!keyboardLikely);
  }

  function injectFinalCss(){
    var css = '@media(max-width:900px){' +
      'body.keyboard-open{overflow:hidden!important;overscroll-behavior:none!important;background:var(--bg)!important;}' +
      'body.keyboard-open #app{position:fixed!important;left:0!important;right:0!important;top:var(--app-top,0px)!important;width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:visible!important;transform:none!important;background:var(--bg)!important;}' +
      'body.keyboard-open .app-shell{position:relative!important;left:auto!important;right:auto!important;top:auto!important;width:100vw!important;height:100%!important;min-height:0!important;overflow:visible!important;background:var(--bg)!important;}' +
      'body.keyboard-open .main{position:relative!important;width:100vw!important;height:100%!important;min-height:0!important;overflow:visible!important;background:var(--bg)!important;}' +
      'body.keyboard-open .composer-wrap{position:absolute!important;left:0!important;right:0!important;bottom:-60px!important;width:100vw!important;padding:0!important;margin:0!important;background:transparent!important;background-image:none!important;z-index:10000!important;transform:none!important;will-change:auto!important;}' +
      'body.keyboard-open .composer-wrap::after{display:none!important;content:none!important;}' +
      'body.keyboard-open .composer{width:calc(100% - 44px)!important;max-width:none!important;margin:0 auto!important;margin-bottom:0!important;transform:translateY(0)!important;}' +
      'body.keyboard-open .messages{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:10px 18px 76px!important;scroll-padding-bottom:76px!important;touch-action:pan-y!important;}' +
      'body.keyboard-open .messages.generating-space{padding-bottom:76px!important;scroll-padding-bottom:76px!important;}' +
      'body.keyboard-open .attach-preview{display:none!important;}' +
      'body.keyboard-open .floating-menu,body.keyboard-open .top-actions{opacity:0!important;pointer-events:none!important;}' +
    '}';
    var st = document.getElementById('daotianScrollKeyboardFinalStyle');
    if(!st){
      st = document.createElement('style');
      st.id = 'daotianScrollKeyboardFinalStyle';
      document.head.appendChild(st);
    }
    if(st.textContent !== css) st.textContent = css;
    if(st.parentNode === document.head && st !== document.head.lastElementChild) document.head.appendChild(st);
  }

  function tick(){
    injectFinalCss();
    syncViewportVars();
    patchMessagesBox();
  }

  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', tick, {passive:true});
    window.visualViewport.addEventListener('scroll', tick, {passive:true});
  }
  window.addEventListener('resize', tick, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(tick, 80); }, {passive:true});
  document.addEventListener('focusin', function(){ setTimeout(tick, 60); setTimeout(tick, 260); }, true);
  document.addEventListener('focusout', function(){ setTimeout(tick, 80); }, true);
  new MutationObserver(tick).observe(document.documentElement, {childList:true, subtree:true});

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once:true});
  else tick();
})();
