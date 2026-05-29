(function(){
  'use strict';

  var STYLE_ID = 'daotianThinkingPositionFixRuntimeStyle';
  var raf = 0;
  var keepUntil = 0;

  function injectRuntimeStyle(){
    var css = [
      '.messages.generating-space{padding-bottom:110px!important;scroll-padding-bottom:110px!important;}',
      '.daotian-thinking-message{scroll-margin-top:12px!important;scroll-margin-bottom:110px!important;}',
      '.daotian-thinking-orbit{position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;flex:0 0 18px!important;background:transparent!important;overflow:visible!important;transform-origin:50% 50%!important;animation:dtClaudeOrbitDrift 2800ms linear infinite!important;}',
      '.daotian-thinking-orbit span{position:absolute!important;left:50%!important;top:50%!important;width:2.35px!important;height:5.6px!important;margin:-2.8px 0 0 -1.175px!important;border-radius:999px!important;background:#D96F55!important;box-shadow:none!important;filter:saturate(1.04)!important;transform-origin:center center!important;transform:rotate(var(--a)) translateY(-6.25px)!important;animation:dtClaudeRayMorph 1680ms cubic-bezier(.55,.02,.24,1) infinite!important;animation-delay:calc(var(--i) * -8ms)!important;will-change:width,height,margin,opacity,transform!important;}',
      '@keyframes dtClaudeOrbitDrift{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
      '@keyframes dtClaudeRayMorph{0%,100%{width:2.35px;height:5.6px;margin:-2.8px 0 0 -1.175px;opacity:.76;transform:rotate(var(--a)) translateY(-6.25px)}14%{width:2.35px;height:5.6px;margin:-2.8px 0 0 -1.175px;opacity:.78;transform:rotate(var(--a)) translateY(-6.25px)}32%{width:2.55px;height:7.4px;margin:-3.7px 0 0 -1.275px;opacity:.86;transform:rotate(var(--a)) translateY(-4.2px)}48%{width:2.78px;height:11.4px;margin:-5.7px 0 0 -1.39px;opacity:.96;transform:rotate(var(--a)) translateY(-1.55px)}56%,66%{width:3px;height:13.8px;margin:-6.9px 0 0 -1.5px;opacity:1;transform:rotate(var(--a)) translateY(-.45px)}78%{width:2.62px;height:8.1px;margin:-4.05px 0 0 -1.31px;opacity:.9;transform:rotate(var(--a)) translateY(-3.55px)}90%{width:2.4px;height:5.9px;margin:-2.95px 0 0 -1.2px;opacity:.8;transform:rotate(var(--a)) translateY(-5.95px)}}',
      '@media(max-width:900px){.messages.generating-space{padding-bottom:96px!important;scroll-padding-bottom:96px!important;}body.keyboard-open .messages.generating-space{padding-bottom:96px!important;scroll-padding-bottom:96px!important;}.daotian-thinking-message{scroll-margin-top:8px!important;scroll-margin-bottom:96px!important;}}'
    ].join('\n');
    var old = document.getElementById(STYLE_ID);
    if(old && old.textContent === css && old.parentNode === document.head && old === document.head.lastElementChild) return;
    if(old) old.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function isNearBottom(box){ return !box || box.scrollHeight - box.scrollTop - box.clientHeight < 420; }
  function isWorking(box){ return !!(box && (box.classList.contains('generating-space') || box.querySelector('.daotian-thinking-message'))); }

  function keepBottomStable(){
    var box = document.getElementById('messages');
    if(!box) return;
    if(isWorking(box) && isNearBottom(box)) keepUntil = Date.now() + 1800;
    if(Date.now() < keepUntil && isNearBottom(box)) box.scrollTop = box.scrollHeight;
  }

  function tick(){ raf = 0; injectRuntimeStyle(); keepBottomStable(); }
  function schedule(){ if(!raf) raf = requestAnimationFrame(tick); }

  function start(){
    injectRuntimeStyle();
    if(document.head){ new MutationObserver(schedule).observe(document.head,{childList:true}); }
    var box = document.getElementById('messages');
    if(box){ new MutationObserver(schedule).observe(box,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class','data-scroll-focus']}); }
    window.addEventListener('resize',schedule,{passive:true});
    document.addEventListener('focusin',schedule,true);
    document.addEventListener('focusout',function(){ setTimeout(schedule,80); },true);
    schedule();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();