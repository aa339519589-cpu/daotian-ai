(function(){
  'use strict';

  var AUTO_SCROLL_KEY = 'daotian.autoScroll.v1';
  var FONT_SIZE_KEY = 'daotian.fontSize.v1';

  function setDefaults(){
    try{
      localStorage.setItem(AUTO_SCROLL_KEY, 'false');
      localStorage.setItem(FONT_SIZE_KEY, '16');
    }catch(_e){}
  }

  function removeAutoScrollToggle(root){
    root = root || document;
    try{
      var row = root.querySelector('[data-param="autoScroll"]');
      if(row) row.remove();

      var toggles = root.querySelectorAll('.settings-toggle-row');
      for(var i=0; i<toggles.length; i++){
        var text = toggles[i].textContent || '';
        if(text.indexOf('自动滚动跟随') >= 0 || text.indexOf('回复生成时自动跟随到底部') >= 0){
          toggles[i].remove();
        }
      }
    }catch(_e){}
  }

  function applyFontBase(){
    try{
      document.documentElement.style.fontSize = '16px';
      if(document.body) document.body.style.fontSize = '16px';
    }catch(_e){}
  }

  function apply(){
    setDefaults();
    applyFontBase();
    removeAutoScrollToggle(document);
  }

  setDefaults();
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', apply);
  }else{
    apply();
  }

  try{
    var observer = new MutationObserver(function(){ apply(); });
    observer.observe(document.documentElement, {childList:true, subtree:true});
  }catch(_e){}
})();
