(function(){
  'use strict';
  window.__DAOTIAN_SCROLL_REBUILD__ = 'v4-manual-scroll-safe';
  var key = 'daotian.autoScroll.v1';
  var box = null;
  var lastTop = 0;
  var raf = 0;
  var userInteracting = false;
  var userTimer = 0;
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
    userTimer = setTimeout(function(){
      userInteracting = false;
    }, 900);
  }
  function setBottom(){
    if(!box || !isOn() || userInteracting) return;
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      if(!box || !isOn() || userInteracting) return;
      try{ box.scrollTop = box.scrollHeight; }catch(e){}
    });
  }
  function bind(){
    var el = document.getElementById('messages');
    if(!el || el === box) return;
    box = el;
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
    new MutationObserver(setBottom).observe(box, {childList:true, subtree:true, characterData:true});
  }
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
    if(!row) return;
    setTimeout(function(){
      setOn(row.getAttribute('data-on') === '1');
      userInteracting = false;
      setBottom();
    }, 20);
  }, true);
  function tick(){ bind(); sync(); if(isOn() && !userInteracting) setBottom(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once:true}); else tick();
  setInterval(tick, 900);
})();