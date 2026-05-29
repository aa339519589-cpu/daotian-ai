(function(){
  'use strict';
  if(window.__DAOTIAN_UNIFIED_KEYBOARD_SCROLL__ === 'v1') return;
  window.__DAOTIAN_UNIFIED_KEYBOARD_SCROLL__ = 'v1';

  var raf = 0;
  var followRaf = 0;
  var pausedByUser = false;
  var lastPointerAt = 0;
  var observer = null;
  var box = null;

  function $(sel){ return document.querySelector(sel); }
  function root(){ return document.documentElement; }
  function isMobile(){
    var w = window.innerWidth || document.documentElement.clientWidth || 9999;
    var coarse = false;
    try{ coarse = matchMedia('(pointer: coarse)').matches; }catch(e){}
    return w <= 900 && ((navigator.maxTouchPoints || 0) > 0 || coarse || 'ontouchstart' in window);
  }
  function inputFocused(){
    var input = document.getElementById('input');
    return !!input && document.activeElement === input;
  }
  function viewport(){
    var vv = window.visualViewport;
    return {
      width: Math.round(vv ? vv.width : window.innerWidth),
      height: Math.round(vv ? vv.height : window.innerHeight),
      top: Math.round(vv ? vv.offsetTop : 0),
      left: Math.round(vv ? vv.offsetLeft : 0),
      layoutHeight: Math.round(window.innerHeight || (vv ? vv.height : 0) || document.documentElement.clientHeight || 0)
    };
  }
  function composerHeight(){
    var wrap = $('.composer-wrap');
    if(!wrap) return 86;
    try{ return Math.max(56, Math.ceil(wrap.getBoundingClientRect().height)); }catch(e){ return 86; }
  }
  function installStyle(){
    var id = 'daotianUnifiedKeyboardScrollStyle';
    if(document.getElementById(id)) return;
    var st = document.createElement('style');
    st.id = id;
    st.textContent = `
      @media (max-width:900px) and (pointer:coarse){
        body.dt-keyboard-open{overflow:hidden!important;overscroll-behavior:none!important;background:var(--bg)!important;}
        body.dt-keyboard-open #app{position:fixed!important;left:0!important;top:var(--dt-vv-top,0px)!important;width:100vw!important;height:var(--dt-vv-height,100dvh)!important;min-height:var(--dt-vv-height,100dvh)!important;overflow:hidden!important;transform:none!important;background:var(--bg)!important;}
        body.dt-keyboard-open .app-shell{position:relative!important;width:100vw!important;height:100%!important;min-height:0!important;overflow:hidden!important;background:var(--bg)!important;}
        body.dt-keyboard-open .main{position:relative!important;width:100vw!important;height:100%!important;min-height:0!important;overflow:hidden!important;background:var(--bg)!important;}
        body.dt-keyboard-open .composer-wrap{position:absolute!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;margin:0!important;padding:6px 14px calc(6px + env(safe-area-inset-bottom))!important;z-index:10000!important;transform:none!important;background:linear-gradient(to top,var(--bg) 86%,rgba(0,0,0,0))!important;will-change:auto!important;}
        body.dt-keyboard-open .composer{width:calc(100vw - 28px)!important;max-width:none!important;margin:0 auto!important;transform:none!important;}
        body.dt-keyboard-open .messages{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:var(--dt-composer-height,86px)!important;height:auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-y!important;padding:10px 18px 8px!important;scroll-padding-bottom:8px!important;}
        body.dt-keyboard-open .attach-preview{display:none!important;}
        body.dt-keyboard-open .floating-menu,body.dt-keyboard-open .top-actions{opacity:0!important;pointer-events:none!important;}
      }
      @media (min-width:901px),(pointer:fine){
        body.dt-keyboard-open #app{position:static!important;height:auto!important;min-height:100vh!important;overflow:visible!important;}
        body.dt-keyboard-open .composer-wrap{position:sticky!important;bottom:0!important;transform:none!important;}
      }
    `;
    document.head.appendChild(st);
  }
  function nearBottom(){
    if(!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  }
  function scrollBottom(force){
    if(!box) bindBox();
    if(!box) return;
    if(!force && pausedByUser) return;
    if(followRaf) return;
    followRaf = requestAnimationFrame(function(){
      followRaf = 0;
      if(!box) return;
      if(!force && pausedByUser) return;
      box.scrollTop = Math.max(0, box.scrollHeight - box.clientHeight);
    });
  }
  function bindBox(){
    var next = document.getElementById('messages');
    if(!next || next === box) return;
    box = next;
    pausedByUser = false;
    box.style.overflowY = 'auto';
    box.style.webkitOverflowScrolling = 'touch';
    box.style.touchAction = 'pan-y';

    box.addEventListener('touchstart', function(){ lastPointerAt = Date.now(); }, {passive:true});
    box.addEventListener('pointerdown', function(){ lastPointerAt = Date.now(); }, {passive:true});
    box.addEventListener('wheel', function(){ lastPointerAt = Date.now(); }, {passive:true});
    box.addEventListener('scroll', function(){
      if(nearBottom()){
        pausedByUser = false;
        return;
      }
      if(Date.now() - lastPointerAt < 1500) pausedByUser = true;
    }, {passive:true});

    if(observer) observer.disconnect();
    observer = new MutationObserver(function(){
      if(nearBottom()) pausedByUser = false;
      scrollBottom(false);
    });
    observer.observe(box, {childList:true, subtree:true, characterData:true});
  }
  function applyLayout(){
    installStyle();
    bindBox();

    if(!isMobile() || !inputFocused()){
      document.body.classList.remove('dt-keyboard-open');
      document.body.classList.remove('keyboard-open');
      root().style.removeProperty('--dt-vv-height');
      root().style.removeProperty('--dt-vv-top');
      root().style.removeProperty('--dt-composer-height');
      return;
    }

    var v = viewport();
    var ch = composerHeight();
    document.body.classList.add('dt-keyboard-open');
    document.body.classList.add('keyboard-open');
    root().style.setProperty('--dt-vv-height', Math.max(1, v.height) + 'px');
    root().style.setProperty('--dt-vv-top', v.top + 'px');
    root().style.setProperty('--dt-composer-height', ch + 'px');
    root().style.setProperty('--app-height', Math.max(1, v.height) + 'px');
    root().style.setProperty('--app-top', v.top + 'px');
    root().style.setProperty('--composer-h', ch + 'px');
    scrollBottom(false);
  }
  function schedule(){
    if(raf) return;
    raf = requestAnimationFrame(function(){ raf = 0; applyLayout(); });
  }

  if(window.visualViewport){
    visualViewport.addEventListener('resize', schedule, {passive:true});
    visualViewport.addEventListener('scroll', schedule, {passive:true});
  }
  window.addEventListener('resize', schedule, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(schedule, 80); setTimeout(schedule, 260); }, {passive:true});
  document.addEventListener('focusin', function(){ pausedByUser = false; schedule(); setTimeout(schedule, 120); setTimeout(function(){ scrollBottom(true); }, 260); }, true);
  document.addEventListener('focusout', function(){ setTimeout(schedule, 80); }, true);
  document.addEventListener('DOMContentLoaded', schedule, {once:true});
  schedule();
  setInterval(schedule, 800);
})();
