;(function(){
  'use strict';

  function mode(){
    return window.__DAOTIAN_KEYBOARD_VIEWPORT_MODE__ === 'legacy' ? 'legacy' : 'content';
  }

  function isComposer(el){
    return !!(el && el.classList && el.classList.contains('composer-wrap'));
  }

  function clean(){
    if(mode() === 'legacy') return;
    var el = document.querySelector('.composer-wrap');
    if(!el) return;
    el.style.removeProperty('transform');
    el.style.removeProperty('margin-bottom');
  }

  var rawSetProperty = CSSStyleDeclaration.prototype.setProperty;
  CSSStyleDeclaration.prototype.setProperty = function(name, value, priority){
    try{
      if(mode() !== 'legacy' && String(name).toLowerCase() === 'transform'){
        var owner = this && this.__dtOwnerElement;
        if(isComposer(owner)) return;
      }
    }catch(e){}
    return rawSetProperty.apply(this, arguments);
  };

  function bindOwner(el){
    if(!el || !el.style || el.style.__dtBoundOwner) return;
    try{
      Object.defineProperty(el.style, '__dtOwnerElement', {value:el, configurable:true});
      Object.defineProperty(el.style, '__dtBoundOwner', {value:true, configurable:true});
    }catch(e){}
  }

  function scan(){
    bindOwner(document.querySelector('.composer-wrap'));
    clean();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan, {once:true});
  else scan();

  new MutationObserver(scan).observe(document.documentElement, {childList:true, subtree:true});
  window.addEventListener('resize', scan, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', scan, {passive:true});
    window.visualViewport.addEventListener('scroll', scan, {passive:true});
  }
  document.addEventListener('focusin', scan, true);
  document.addEventListener('focusout', function(){ setTimeout(scan, 80); }, true);
  setInterval(scan, 160);
})();
