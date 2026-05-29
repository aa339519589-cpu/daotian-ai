(function(){
  'use strict';
  window.__DAOTIAN_SCROLL_REBUILD__ = 'v3-bottom-follow';
  var key = 'daotian.autoScroll.v1';
  var box = null;
  var lastTop = 0;
  var raf = 0;
  try{
    if(localStorage.getItem(key) !== 'true') localStorage.setItem(key,'false');
  }catch(e){}
  function isOn(){
    try{ return localStorage.getItem(key) === 'true'; }catch(e){ return false; }
  }
  function sync(){
    var on = isOn();
    document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){
      row.setAttribute('data-on', on ? '1' : '0');
      var sw = row.querySelector('.settings-toggle-switch');
      if(sw) sw.classList.toggle('on', on);
    });
  }
  function setBottom(){
    if(!box || !isOn()) return;
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      try{ box.scrollTop = box.scrollHeight; }catch(e){}
    });
  }
  function bind(){
    var el = document.getElementById('messages');
    if(!el || el === box) return;
    box = el;
    box.addEventListener('touchstart', function(){ lastTop = box.scrollTop; }, {passive:true});
    box.addEventListener('touchmove', function(){
      var now = box.scrollTop;
      if(now < lastTop - 8){ try{ localStorage.setItem(key,'false'); }catch(e){} sync(); }
      lastTop = now;
    }, {passive:true});
    box.addEventListener('wheel', function(ev){
      if(ev && ev.deltaY < -4){ try{ localStorage.setItem(key,'false'); }catch(e){} sync(); }
    }, {passive:true});
    new MutationObserver(setBottom).observe(box, {childList:true, subtree:true, characterData:true});
  }
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
    if(!row) return;
    setTimeout(function(){
      try{ localStorage.setItem(key, row.getAttribute('data-on') === '1' ? 'true' : 'false'); }catch(e){}
      sync();
      setBottom();
    }, 20);
  }, true);
  function tick(){ bind(); sync(); if(isOn()) setBottom(); }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', tick, {once:true}); else tick();
  setInterval(tick, 700);
})();