(function(){
  'use strict';
  window.__DAOTIAN_SCROLL_REBUILD__ = 'v5-bottom-anchor';
  var key = 'daotian.autoScroll.v1';
  var box = null;
  var lastTop = 0;
  var raf = 0;
  var userInteracting = false;
  var userTimer = 0;
  var observer = null;
  var spacerClass = 'dt-bottom-anchor-spacer';
  try{
    if(localStorage.getItem(key) !== 'true') localStorage.setItem(key,'false');
  }catch(e){}
  function isOn(){
    try{ return localStorage.getItem(key) === 'true'; }catch(e){ return false; }
  }
  function setOn(v){
    try{ localStorage.setItem(key, v ? 'true' : 'false'); }catch(e){}
    sync();
  }
  function sync(){
    var on = isOn();
    document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){
      row.setAttribute('data-on', on ? '1' : '0');
      var sw = row.querySelector('.settings-toggle-switch');
      if(sw) sw.classList.toggle('on', on);
    });
  }
  function nearBottom(){
    if(!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  }
  function pauseForManual(){
    userInteracting = true;
    clearTimeout(userTimer);
    userTimer = setTimeout(function(){ userInteracting = false; }, 1200);
  }
  function ensureSpacer(){
    if(!box) return null;
    var sp = box.querySelector(':scope > .' + spacerClass);
    if(!sp){
      sp = document.createElement('div');
      sp.className = spacerClass;
      sp.setAttribute('aria-hidden','true');
      sp.style.cssText = 'height:0px;min-height:0;flex:0 0 auto;pointer-events:none;margin:0;padding:0;border:0;';
      box.insertBefore(sp, box.firstChild);
    }
    return sp;
  }
  function contentHeightWithoutSpacer(){
    if(!box) return 0;
    var total = 0;
    Array.prototype.forEach.call(box.children, function(el){
      if(el.classList && el.classList.contains(spacerClass)) return;
      var cs = getComputedStyle(el);
      total += el.offsetHeight + (parseFloat(cs.marginTop)||0) + (parseFloat(cs.marginBottom)||0);
    });
    return total;
  }
  function updateSpacer(){
    if(!box) return;
    var sp = ensureSpacer();
    if(!sp) return;
    if(!isOn()){
      sp.style.height = '0px';
      return;
    }
    var content = contentHeightWithoutSpacer();
    var reserve = 18;
    var h = Math.max(0, box.clientHeight - content - reserve);
    sp.style.height = Math.round(h) + 'px';
  }
  function setBottom(){
    if(!box || !isOn() || userInteracting) return;
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      if(!box || !isOn() || userInteracting) return;
      updateSpacer();
      try{ box.scrollTop = box.scrollHeight; }catch(e){}
    });
  }
  function bind(){
    var el = document.getElementById('messages');
    if(!el || el === box) return;
    box = el;
    try{ box.style.scrollBehavior = 'auto'; }catch(e){}
    box.addEventListener('touchstart', function(){ lastTop = box.scrollTop; pauseForManual(); }, {passive:true});
    box.addEventListener('pointerdown', function(){ lastTop = box.scrollTop; pauseForManual(); }, {passive:true});
    box.addEventListener('touchmove', function(){
      pauseForManual();
      var now = box.scrollTop;
      if(now < lastTop - 8 && !nearBottom()) setOn(false);
      lastTop = now;
    }, {passive:true});
    box.addEventListener('wheel', function(ev){
      pauseForManual();
      if(ev && ev.deltaY < -4 && !nearBottom()) setOn(false);
    }, {passive:true});
    box.addEventListener('scroll', function(){
      if(!nearBottom()) pauseForManual();
    }, {passive:true});
    if(observer) observer.disconnect();
    observer = new MutationObserver(setBottom);
    observer.observe(box, {childList:true, subtree:true, characterData:true});
  }
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
    if(!row) return;
    setTimeout(function(){
      setOn(row.getAttribute('data-on') === '1');
      userInteracting = false;
      updateSpacer();
      setBottom();
    }, 20);
  }, true);
  function tick(){ bind(); sync(); if(isOn() && !userInteracting){ updateSpacer(); setBottom(); } }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once:true}); else tick();
  window.addEventListener('resize', tick, {passive:true});
  setInterval(tick, 900);
})();