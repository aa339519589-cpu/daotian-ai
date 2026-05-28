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
      '.daotian-thinking-orbit{position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;flex:0 0 18px!important;background:transparent!important;overflow:visible!important;transform-origin:50% 50%!important;animation:dtClaudeOrbitDrift 1680ms linear infinite!important;}',
      '.daotian-thinking-orbit span{position:absolute!important;left:50%!important;top:50%!important;width:2.35px!important;height:2.35px!important;margin:-1.175px 0 0 -1.175px!important;border-radius:999px!important;background:#D96F55!important;box-shadow:none!important;filter:saturate(1.04)!important;transform-origin:center center!important;transform:rotate(var(--a)) translateY(-6.3px)!important;animation:dtClaudeRayMorph 1680ms cubic-bezier(.42,0,.18,1) infinite!important;animation-delay:calc(var(--i) * -26ms)!important;will-change:width,height,margin,opacity,transform!important;}',
      '@keyframes dtClaudeOrbitDrift{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
      '@keyframes dtClaudeRayMorph{0%,100%{width:2.2px;height:2.2px;margin:-1.1px 0 0 -1.1px;border-radius:999px;opacity:.48;transform:rotate(var(--a)) translateY(-6.15px) scale(.94)}18%{width:2.35px;height:2.8px;margin:-1.4px 0 0 -1.175px;border-radius:999px;opacity:.62;transform:rotate(var(--a)) translateY(-6.25px) scale(.98)}38%{width:2.55px;height:6.2px;margin:-3.1px 0 0 -1.275px;border-radius:999px;opacity:.84;transform:rotate(var(--a)) translateY(-6.95px) scale(1)}52%{width:2.65px;height:8.4px;margin:-4.2px 0 0 -1.325px;border-radius:999px;opacity:.96;transform:rotate(var(--a)) translateY(-7.55px) scale(1)}68%{width:2.5px;height:6.4px;margin:-3.2px 0 0 -1.25px;border-radius:999px;opacity:.82;transform:rotate(var(--a)) translateY(-7px) scale(1)}84%{width:2.35px;height:3px;margin:-1.5px 0 0 -1.175px;border-radius:999px;opacity:.58;transform:rotate(var(--a)) translateY(-6.35px) scale(.98)}}',
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