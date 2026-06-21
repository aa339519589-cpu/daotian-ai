(function(){
  'use strict';

  var raf = 0;

  function removeWrongPlaceholder(){
    var style = document.getElementById('daotianMathStreamGuardStyle');
    if(style && style.parentNode) style.parentNode.removeChild(style);
    document.querySelectorAll('.math-streaming-pending').forEach(function(el){
      el.classList.remove('math-streaming-pending');
    });
    document.querySelectorAll('.assistant-render[aria-busy="true"]').forEach(function(el){
      el.removeAttribute('aria-busy');
      el.style.removeProperty('color');
      el.style.removeProperty('-webkit-text-fill-color');
    });
  }

  function unlockMathJax(){
    var mj = window.MathJax;
    if(!mj) return;
    if(mj.__daotianLiveRenderUnlocked) return;
    mj.typesetPromise = function(elements){
      try{
        if(typeof mj.typeset === 'function') mj.typeset(elements || []);
      }catch(_e){}
      return Promise.resolve();
    };
    mj.typesetClear = function(){ return; };
    mj.__daotianLiveRenderUnlocked = true;
  }

  function renderLiveMath(){
    removeWrongPlaceholder();
    unlockMathJax();
    var mj = window.MathJax;
    if(!mj || typeof mj.typesetPromise !== 'function') return;
    var nodes = document.querySelectorAll('.message.assistant.streaming-live .assistant-render,.message.assistant[data-scroll-focus="1"] .assistant-render');
    if(!nodes.length) return;
    try{ mj.typesetPromise(Array.prototype.slice.call(nodes)).catch(function(){}); }catch(_e){}
  }

  function schedule(){
    if(raf) return;
    raf = requestAnimationFrame(function(){
      raf = 0;
      renderLiveMath();
    });
  }

  removeWrongPlaceholder();
  unlockMathJax();
  document.addEventListener('DOMContentLoaded', function(){ removeWrongPlaceholder(); unlockMathJax(); }, {once:true});
  new MutationObserver(schedule).observe(document.documentElement, {childList:true, subtree:true, characterData:true, attributes:true, attributeFilter:['class','aria-busy','data-scroll-focus']});
  setInterval(function(){ removeWrongPlaceholder(); unlockMathJax(); renderLiveMath(); }, 300);
})();
