;(function(){
  'use strict';

  var KEY = 'daotian.keyboardViewportMode.v1';

  function readMode(){
    var mode = 'content';
    try{ mode = localStorage.getItem(KEY) || 'content'; }catch(e){}
    return mode === 'legacy' ? 'legacy' : 'content';
  }

  function applyMode(mode){
    mode = mode === 'legacy' ? 'legacy' : 'content';
    window.__DAOTIAN_KEYBOARD_VIEWPORT_MODE__ = mode;
    document.documentElement.setAttribute('data-keyboard-viewport', mode);
    var meta = document.querySelector('meta[name="viewport"]');
    if(meta){
      meta.setAttribute('content', mode === 'legacy'
        ? 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-visual'
        : 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content');
    }
  }

  window.daotianKeyboardViewportMode = {
    get:function(){ return readMode(); },
    set:function(mode){
      mode = mode === 'legacy' ? 'legacy' : 'content';
      try{ localStorage.setItem(KEY, mode); }catch(e){}
      applyMode(mode);
      return mode;
    },
    useLegacy:function(){ return this.set('legacy'); },
    useContent:function(){ return this.set('content'); }
  };

  applyMode(readMode());
})();
