(function(){
  'use strict';

  var STYLE_ID = 'daotianThinkingPositionFixRuntimeStyle';
  var scrollTimer = 0;
  var headObserverStarted = false;
  var messagesObserver = null;

  function injectRuntimeStyle(){
    var css = [
      '.messages.generating-space{padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;}',
      '.daotian-thinking-message{scroll-margin-top:18dvh!important;scroll-margin-bottom:72dvh!important;}',
      '.daotian-thinking-orbit{position:relative!important;width:26px!important;height:26px!important;min-width:26px!important;min-height:26px!important;flex:0 0 26px!important;background:transparent!important;overflow:visible!important;transform-origin:50% 50%!important;animation:dtClaudeOrbitDrift 1320ms linear infinite!important;}',
      '.daotian-thinking-orbit span{position:absolute!important;left:50%!important;top:50%!important;width:3px!important;height:7.8px!important;margin:-3.9px 0 0 -1.5px!important;border-radius:999px!important;background:#D86B4D!important;box-shadow:none!important;filter:saturate(1.02)!important;transform-origin:center center!important;transform:rotate(var(--a)) translateY(-9.8px)!important;animation:dtClaudeRadialCollapse 1680ms cubic-bezier(.42,0,.16,1) infinite!important;animation-delay:calc(var(--i) * -10ms)!important;will-change:width,height,margin,opacity,transform!important;}',
      '@keyframes dtClaudeOrbitDrift{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
      '@keyframes dtClaudeRadialCollapse{0%,100%{width:3px;height:7.8px;margin:-3.9px 0 0 -1.5px;opacity:.72;transform:rotate(var(--a)) translateY(-9.8px) scale(1)}14%{width:3px;height:7.2px;margin:-3.6px 0 0 -1.5px;opacity:.66;transform:rotate(var(--a)) translateY(-9.2px) scale(.98)}30%{width:3.25px;height:9.8px;margin:-4.9px 0 0 -1.625px;opacity:.84;transform:rotate(var(--a)) translateY(-6.4px) scale(1)}44%{width:3.55px;height:12.8px;margin:-6.4px 0 0 -1.775px;opacity:.96;transform:rotate(var(--a)) translateY(-3.1px) scale(1.02)}52%{width:3.65px;height:14.2px;margin:-7.1px 0 0 -1.825px;opacity:1;transform:rotate(var(--a)) translateY(-1.15px) scale(1.03)}60%{width:3.55px;height:13px;margin:-6.5px 0 0 -1.775px;opacity:.98;transform:rotate(var(--a)) translateY(-2.6px) scale(1.02)}74%{width:3.25px;height:9.6px;margin:-4.8px 0 0 -1.625px;opacity:.84;transform:rotate(var(--a)) translateY(-6.7px) scale(1)}88%{width:3px;height:7.4px;margin:-3.7px 0 0 -1.5px;opacity:.68;transform:rotate(var(--a)) translateY(-9.4px) scale(.98)}}',
      '@media(max-width:900px){.messages.generating-space{padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;}body.keyboard-open .messages.generating-space{padding-bottom:calc(58dvh + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:calc(58dvh + env(safe-area-inset-bottom,0px))!important;}.daotian-thinking-message{scroll-margin-top:18dvh!important;scroll-margin-bottom:58dvh!important;}}'
    ].join('\n');
    var existing = document.getElementById(STYLE_ID);
    if(existing && existing.textContent === css && existing.parentNode === document.head && existing === document.head.lastElementChild) return;
    if(existing) existing.remove();
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function keepStyleLast(){
    injectRuntimeStyle();
    if(headObserverStarted || !document.head) return;
    headObserverStarted = true;
    new MutationObserver(function(){
      var style = document.getElementById(STYLE_ID);
      if(!style || style !== document.head.lastElementChild){
        setTimeout(injectRuntimeStyle, 0);
      }
    }).observe(document.head, {childList:true});
  }

  function getMessagesBox(){ return document.getElementById('messages'); }
  function getThinkingRow(box){ return box && box.querySelector('.daotian-thinking-message[data-scroll-focus="1"], .daotian-thinking-message'); }

  function scrollThinkingToReadingZone(){
    injectRuntimeStyle();
    var box = getMessagesBox();
    var row = getThinkingRow(box);
    if(!box || !row) return;

    var ratio = window.innerWidth <= 900 ? 0.18 : 0.26;
    if(document.body.classList.contains('keyboard-open')) ratio = 0.16;

    var boxRect = box.getBoundingClientRect();
    var rowRect = row.getBoundingClientRect();
    var desiredTop = box.clientHeight * ratio;
    var delta = (rowRect.top - boxRect.top) - desiredTop;
    var nextTop = box.scrollTop + delta;
    var maxTop = Math.max(0, box.scrollHeight - box.clientHeight);
    box.scrollTop = Math.max(0, Math.min(maxTop, nextTop));
  }

  function scheduleThinkingPosition(){
    clearTimeout(scrollTimer);
    requestAnimationFrame(function(){
      requestAnimationFrame(scrollThinkingToReadingZone);
    });
    scrollTimer = setTimeout(scrollThinkingToReadingZone, 80);
  }

  function observeMessages(){
    keepStyleLast();
    var box = getMessagesBox();
    if(!box){ setTimeout(observeMessages, 120); return; }
    if(messagesObserver) messagesObserver.disconnect();
    messagesObserver = new MutationObserver(function(){
      if(getThinkingRow(box)) scheduleThinkingPosition();
    });
    messagesObserver.observe(box, {childList:true, subtree:true, attributes:true, attributeFilter:['class','data-scroll-focus']});
    if(getThinkingRow(box)) scheduleThinkingPosition();
  }

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', observeMessages, {once:true});
  }else{
    observeMessages();
  }
  window.addEventListener('resize', function(){ if(getThinkingRow(getMessagesBox())) scheduleThinkingPosition(); }, {passive:true});
})();