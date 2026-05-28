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
