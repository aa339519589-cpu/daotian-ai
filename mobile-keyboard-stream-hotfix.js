;(function(){
  'use strict';

  var STYLE_ID = 'daotianMobileKeyboardStreamHotfixStyle';
  var raf = 0;
  var pauseUntil = 0;

  function isMobile(){
    return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 900;
  }

  function isKeyboardOpen(){
    var input = document.getElementById('input');
    return isMobile() && (document.body.classList.contains('keyboard-open') || document.activeElement === input);
  }

  function injectStyle(){
    var css = [
      '@media(max-width:900px){',
      'body.keyboard-open .composer-wrap{z-index:999!important;will-change:transform!important;}',
      'body.keyboard-open .messages{bottom:82px!important;}',
      'body.keyboard-open .messages.generating-space{padding-bottom:96px!important;scroll-padding-bottom:96px!important;}',
      'body.keyboard-open .daotian-thinking-message{scroll-margin-top:8px!important;scroll-margin-bottom:96px!important;}',
      '}'
    ].join('\n');
    var old = document.getElementById(STYLE_ID);
    if(old && old.textContent === css) return;
    if(old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function nearBottom(box){
    if(!box) return true;
    return box.scrollHeight - box.scrollTop - box.clientHeight < 260;
  }

  function isGenerating(box){
    return !!(box && (
      box.classList.contains('generating-space') ||
      box.querySelector('.daotian-thinking-message') ||
      box.querySelector('.message.assistant[data-scroll-focus="1"]') ||
      document.querySelector('.send.stop-mode')
    ));
  }

  function tightenKeyboardGap(){
    var wrap = document.querySelector('.composer-wrap');
    if(!wrap) return;

    if(!isKeyboardOpen()){
      wrap.style.removeProperty('transform');
      wrap.style.removeProperty('margin-bottom');
      return;
    }

    var vv = window.visualViewport;
    if(!vv) return;

    var rect = wrap.getBoundingClientRect();
    var vvBottom = Math.round((vv.offsetTop || 0) + vv.height);
    var gap = Math.round(vvBottom - rect.bottom);

    if(gap > 8 && gap < 260){
      wrap.style.setProperty('transform', 'translateY(' + gap + 'px)', 'important');
    }else if(gap < -8){
      wrap.style.setProperty('transform', 'translateY(' + gap + 'px)', 'important');
    }else{
      wrap.style.removeProperty('transform');
    }
  }

  function keepStreamAtBottom(){
    var box = document.getElementById('messages');
    if(!box || !isGenerating(box)) return;
    if(Date.now() < pauseUntil) return;
    if(!nearBottom(box)) return;
    box.scrollTop = box.scrollHeight;
  }

  function tick(){
    raf = 0;
    injectStyle();
    tightenKeyboardGap();
    keepStreamAtBottom();
  }

  function schedule(){
    if(raf) return;
    raf = requestAnimationFrame(tick);
  }

  function bind(){
    injectStyle();
    var box = document.getElementById('messages');
    if(!box){ setTimeout(bind, 120); return; }

    ['wheel','touchmove'].forEach(function(evt){
      box.addEventListener(evt, function(){
        if(!nearBottom(box)) pauseUntil = Date.now() + 1600;
      }, {passive:true});
    });

    new MutationObserver(schedule).observe(box, {
      childList:true,
      subtree:true,
      characterData:true,
      attributes:true,
      attributeFilter:['class','data-scroll-focus']
    });

    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', schedule, {passive:true});
      window.visualViewport.addEventListener('scroll', schedule, {passive:true});
    }
    window.addEventListener('resize', schedule, {passive:true});
    window.addEventListener('orientationchange', schedule, {passive:true});
    document.addEventListener('focusin', schedule, true);
    document.addEventListener('focusout', function(){ setTimeout(schedule, 80); }, true);

    setInterval(function(){
      if(isKeyboardOpen() || isGenerating(box)) schedule();
    }, 120);

    schedule();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind, {once:true});
  }else{
    bind();
  }
})();
