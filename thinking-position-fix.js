(function(){
  'use strict';

  var STYLE_ID = 'daotianThinkingPositionFixRuntimeStyle';
  var scrollTimer = 0;
  var headObserverStarted = false;
  var messagesObserver = null;
  var viewportTimer = 0;

  function injectRuntimeStyle(){
    var css = [
      '.messages.generating-space{padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;}',
      '.daotian-thinking-message{scroll-margin-top:18dvh!important;scroll-margin-bottom:72dvh!important;}',
      '.daotian-thinking-orbit{position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;flex:0 0 18px!important;background:transparent!important;overflow:visible!important;transform-origin:50% 50%!important;animation:dtClaudeOrbitDrift 1880ms linear infinite!important;}',
      '.daotian-thinking-orbit span{position:absolute!important;left:50%!important;top:50%!important;width:2.3px!important;height:2.3px!important;margin:-1.15px 0 0 -1.15px!important;border-radius:999px!important;background:#D96F55!important;box-shadow:none!important;filter:saturate(1.04)!important;transform-origin:center center!important;transform:rotate(var(--a)) translateY(-6.7px)!important;animation:dtClaudeRayMorph 1880ms cubic-bezier(.44,0,.16,1) infinite!important;animation-delay:calc(var(--i) * -18ms)!important;will-change:width,height,margin,opacity,transform!important;}',
      '@keyframes dtClaudeOrbitDrift{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}',
      '@keyframes dtClaudeRayMorph{0%,100%{width:2.25px;height:2.25px;margin:-1.125px 0 0 -1.125px;border-radius:999px;opacity:.46;transform:rotate(var(--a)) translateY(-6.7px) scale(.95)}16%{width:2.3px;height:2.6px;margin:-1.3px 0 0 -1.15px;border-radius:999px;opacity:.56;transform:rotate(var(--a)) translateY(-6.55px) scale(.98)}30%{width:2.45px;height:4.4px;margin:-2.2px 0 0 -1.225px;border-radius:999px;opacity:.72;transform:rotate(var(--a)) translateY(-5.75px) scale(1)}44%{width:2.6px;height:7.4px;margin:-3.7px 0 0 -1.3px;border-radius:999px;opacity:.9;transform:rotate(var(--a)) translateY(-4.65px) scale(1)}54%{width:2.72px;height:9.4px;margin:-4.7px 0 0 -1.36px;border-radius:999px;opacity:.98;transform:rotate(var(--a)) translateY(-3.85px) scale(1.02)}64%{width:2.68px;height:9px;margin:-4.5px 0 0 -1.34px;border-radius:999px;opacity:.95;transform:rotate(var(--a)) translateY(-4.05px) scale(1)}76%{width:2.5px;height:5.2px;margin:-2.6px 0 0 -1.25px;border-radius:999px;opacity:.76;transform:rotate(var(--a)) translateY(-5.45px) scale(1)}88%{width:2.3px;height:2.7px;margin:-1.35px 0 0 -1.15px;border-radius:999px;opacity:.55;transform:rotate(var(--a)) translateY(-6.55px) scale(.98)}}',
      '@media(max-width:900px){.messages.generating-space{padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;scroll-padding-bottom:calc(72dvh + env(safe-area-inset-bottom,0px))!important;}body.keyboard-open .messages.generating-space{padding-bottom:96px!important;scroll-padding-bottom:96px!important;}body.keyboard-open .daotian-thinking-message{scroll-margin-top:18dvh!important;scroll-margin-bottom:96px!important;}body.keyboard-open .composer-wrap{transform:translateY(var(--dt-composer-nudge,0px))!important;will-change:transform!important;transition:transform 90ms linear!important;z-index:1000!important;}body.keyboard-open .messages{bottom:72px!important;scroll-padding-bottom:8px!important;}}'
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

  function syncComposerNudge(){
    try{
      var root = document.documentElement;
      var input = document.getElementById('input');
      var wrap = document.querySelector('.composer-wrap');
      if(!root || !input || !wrap || window.innerWidth > 900){
        if(root) root.style.setProperty('--dt-composer-nudge','0px');
        return;
      }
      var focused = document.activeElement === input;
      if(!focused){
        root.style.setProperty('--dt-composer-nudge','0px');
        return;
      }
      var vv = window.visualViewport;
      var desiredBottom = vv ? (vv.offsetTop + vv.height - 6) : (window.innerHeight - 6);
      var rect = wrap.getBoundingClientRect();
      var gap = Math.round(desiredBottom - rect.bottom);
      var nudge = Math.max(0, Math.min(gap, 260));
      root.style.setProperty('--dt-composer-nudge', nudge + 'px');
      if(!document.body.classList.contains('keyboard-open')) document.body.classList.add('keyboard-open');
    }catch(_e){}
  }

  function scheduleComposerNudge(){
    clearTimeout(viewportTimer);
    requestAnimationFrame(function(){ requestAnimationFrame(syncComposerNudge); });
    viewportTimer = setTimeout(syncComposerNudge, 120);
  }

  function scrollThinkingToReadingZone(){
    injectRuntimeStyle();
    scheduleComposerNudge();
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
    scheduleComposerNudge();
    var box = getMessagesBox();
    if(!box){ setTimeout(observeMessages, 120); return; }
    if(messagesObserver) messagesObserver.disconnect();
    messagesObserver = new MutationObserver(function(){
      scheduleComposerNudge();
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
  window.addEventListener('resize', function(){ scheduleComposerNudge(); if(getThinkingRow(getMessagesBox())) scheduleThinkingPosition(); }, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', scheduleComposerNudge, {passive:true});
    window.visualViewport.addEventListener('scroll', scheduleComposerNudge, {passive:true});
  }
  document.addEventListener('focusin', scheduleComposerNudge, true);
  document.addEventListener('focusout', function(){ setTimeout(scheduleComposerNudge, 80); }, true);
})();