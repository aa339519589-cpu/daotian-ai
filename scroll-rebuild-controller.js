(function(){
  'use strict';
  window.__DAOTIAN_SCROLL_REBUILD__ = 'v1';
  try{
    if(localStorage.getItem('daotian.autoScroll.v1') !== 'true'){
      localStorage.setItem('daotian.autoScroll.v1','false');
    }
  }catch(e){}
  function sync(){
    var on = false;
    try{ on = localStorage.getItem('daotian.autoScroll.v1') === 'true'; }catch(e){}
    document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){
      row.setAttribute('data-on', on ? '1' : '0');
      var sw = row.querySelector('.settings-toggle-switch');
      if(sw) sw.classList.toggle('on', on);
    });
  }
  document.addEventListener('click', function(e){
    var row = e.target && e.target.closest ? e.target.closest('[data-param="autoScroll"]') : null;
    if(!row) return;
    setTimeout(function(){
      try{ localStorage.setItem('daotian.autoScroll.v1', row.getAttribute('data-on') === '1' ? 'true' : 'false'); }catch(e){}
      sync();
    }, 20);
  }, true);
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', sync, {once:true}); else sync();
  setInterval(sync, 1200);
})();