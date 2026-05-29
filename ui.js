'use strict';

/* ==============================================================
   ui.js — 界面与滚动模块
   从 app.js 提取，依赖 globals.js
   ============================================================== */

/* ── 自动滚动默认关闭 ── */
var AUTO_SCROLL_DEFAULT_OFF_KEY = 'daotian.autoScroll.defaultOff.v2';
function ensureAutoScrollDefaultOff(){
  try{
    if(localStorage.getItem(AUTO_SCROLL_DEFAULT_OFF_KEY) !== '1'){
      localStorage.setItem(KEYS.autoScroll, 'false');
      localStorage.setItem(AUTO_SCROLL_DEFAULT_OFF_KEY, '1');
    }
    if(localStorage.getItem(KEYS.autoScroll) === null){
      localStorage.setItem(KEYS.autoScroll, 'false');
    }
  }catch(_e){}
}
function loadAutoScroll(){
  ensureAutoScrollDefaultOff();
  return readJSON(KEYS.autoScroll, false) === true;
}
function saveAutoScroll(v){
  saveJSON(KEYS.autoScroll, v === true);
  if(v === true) autoScrollManualUntil = 0;
}
function markAutoScrollManual(){
  autoScrollManualUntil = Date.now() + 10 * 60 * 1000;
}
function isAutoScrollManualActive(){
  var box = $('#messages');
  if(isNearBottom(box)){
    autoScrollManualUntil = 0;
    return false;
  }
  return Date.now() < autoScrollManualUntil;
}
function canProgramAutoScroll(){
  return loadAutoScroll() && !isAutoScrollManualActive();
}
var thinkingScrollRaf = 0;
var streamScrollTimer = 0;
var userScrolling = false;
var userScrollingTimer = 0;
function isNearBottom(box){
  if(!box) return true;
  return box.scrollHeight - box.scrollTop - box.clientHeight < 80;
}
function shouldAutoFollowStream(){
  return canProgramAutoScroll() && !userScrolling && isNearBottom($('#messages'));
}
function initUserScrollDetection(){
  if(_scrollDetectInited) return; _scrollDetectInited = true;
  var box = $('#messages'); if(!box) return;
  box.style.overflowY = 'auto';
  box.style.touchAction = 'pan-y';
  box.style.webkitOverflowScrolling = 'touch';
  var lastScrollTop = 0;
  function onUserScroll(e){
    /* Ignore touches on composer/input area */
    if(e && e.target){
      if(e.target.closest('.composer-wrap, textarea, input, #sendBtn, .plus-btn, .search-globe, .plus-menu')) return;
    }
    markAutoScrollManual();
    /* Only mark as user-scrolling if actually scrolling UP (away from bottom) */
    var currentTop = box.scrollTop;
    var scrollingUp = currentTop < lastScrollTop - 10;
    lastScrollTop = currentTop;
    if(!scrollingUp) return;
    /* Don't pause during active streaming unless user has scrolled far */
    if(isStreamingNow()){
      var dist = box.scrollHeight - box.scrollTop - box.clientHeight;
      if(dist < 300) return;
    }
    userScrolling = true;
    clearTimeout(userScrollingTimer);
    userScrollingTimer = setTimeout(function(){
      userScrolling = false;
      if(isNearBottom($('#messages'))){
        scheduleThinkingScroll();
      }
    }, 2500);
  }
  box.addEventListener('wheel', onUserScroll, {passive:true});
  box.addEventListener('touchstart', function(e){ lastScrollTop = box.scrollTop; onUserScroll(e); }, {passive:true});
  box.addEventListener('touchmove', onUserScroll, {passive:true});
  box.addEventListener('pointerdown', onUserScroll, {passive:true});
  box.addEventListener('scroll', function(){
    if(isNearBottom(box)){
      userScrolling = false;
      autoScrollManualUntil = 0;
      clearTimeout(userScrollingTimer);
    }
  }, {passive:true});
}
function isMobileViewport(){
  return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 900;
}
function isInputFocused(){
  var inp = $('#input');
  return !!inp && document.activeElement === inp;
}
function isKeyboardMode(){
  return isMobileViewport() && (document.body.classList.contains('keyboard-open') || isInputFocused());
}
function isStreamingNow(){
  return !!(typeof sending !== 'undefined' && sending) || !!(typeof generatingChatId !== 'undefined' && generatingChatId);
}
function shouldKeepFollowing(){
  if(!canProgramAutoScroll()) return false;
  var box = $('#messages');
  if(!box) return false;
  /* During active streaming, only pause if user has scrolled far away */
  if(isStreamingNow()){
    var distance = box.scrollHeight - box.scrollTop - box.clientHeight;
    return distance <= 400;
  }
  var distance2 = box.scrollHeight - box.scrollTop - box.clientHeight;
  return distance2 <= 220;
}
function scrollMessagesToBottomStable(){
  if(!shouldKeepFollowing()) return;
  var box = $('#messages');
  if(!box) return;
  requestAnimationFrame(function(){
    box.scrollTop = box.scrollHeight;
  });
}
function forceScrollToStreamBottom(){
  if(!canProgramAutoScroll()) return;
  var box = document.getElementById('messages');
  if(!box) return;
  requestAnimationFrame(function(){
    box.scrollTop = box.scrollHeight;
    requestAnimationFrame(function(){
      box.scrollTop = box.scrollHeight;
    });
  });
}
function scrollActiveMessageIntoReadingZone(options){
  options = options || {};
  if(!loadAutoScroll()) return;
  var box = $('#messages');
  if(!box) return;
  var target =
    box.querySelector('.message.assistant[data-scroll-focus="1"]') ||
    box.querySelector('.message.user:last-of-type') ||
    box.lastElementChild;
  if(!target) return;
  scrollTargetIntoReadingZone(box, target, typeof options.ratio === 'number' ? options.ratio : 0.34);
}
function scheduleThinkingScroll(){
  if(!loadAutoScroll()) return;
  if(!shouldAutoFollowStream()) return;
  if(thinkingScrollRaf) cancelAnimationFrame(thinkingScrollRaf);
  thinkingScrollRaf = requestAnimationFrame(function(){
    thinkingScrollRaf = 0;
    scrollActiveMessageIntoReadingZone();
  });
}
function scheduleStreamScroll(){
  if(!shouldAutoFollowStream()) return;
  if(streamScrollTimer) return;
  streamScrollTimer = setTimeout(function(){
    streamScrollTimer = 0;
    scheduleThinkingScroll();
  }, 140);
}
function scrollTargetIntoReadingZone(box, target, topRatio){
  if(!box || !target) return;
  var ratio = typeof topRatio === 'number' ? topRatio : 0.34;
  var boxRect = box.getBoundingClientRect();
  var targetRect = target.getBoundingClientRect();
  var currentTop = box.scrollTop;
  var desiredTop = Math.max(0, box.clientHeight * ratio);
  var delta = (targetRect.top - boxRect.top) - desiredTop;
  var nextTop = currentTop + delta;
  var maxTop = Math.max(0, box.scrollHeight - box.clientHeight);
  box.scrollTop = Math.min(maxTop, Math.max(0, nextTop));
}
function scrollThinkingToReadingZone(){
  var box = $('#messages');
  var row = box && box.querySelector('.daotian-thinking-message[data-scroll-focus="1"], .daotian-thinking-message');
  if(!box || !row) return;
  var ratio = window.innerWidth <= 900 ? 0.18 : 0.26;
  if(document.body.classList.contains('keyboard-open')) ratio = 0.16;
  scrollTargetIntoReadingZone(box, row, ratio);
}

/* ── 字体 ── */
function loadFontSize(){ var v = parseInt(safeGet(KEYS.fontSize)); if(v>=15&&v<=21) return v; return 18; }
function saveFontSize(v){ setItem(KEYS.fontSize, String(v)); applyFontSize(v); }
function applyFontSize(v){
  var s = (v||18)/18;
  var id = 'daotianFontScale'; var old = document.getElementById(id); if(old) old.remove();
  var st = document.createElement('style'); st.id = id;
  st.textContent = 'html{font-size:'+Math.round(18*s)+'px!important}'+
    'body{font-size:'+Math.round(18*s)+'px!important}'+
    '.bubble{font-size:'+Math.round(18*s)+'px!important}'+
    '.assistant-render{font-size:'+Math.round(18*s)+'px!important}'+
    'textarea,.field input,.field select,input[type="text"],input[type="password"]{font-size:'+Math.round(18*s)+'px!important}'+
    '.model-top-trigger{font-size:'+Math.round(18*s)+'px!important}'+
    '.plus-menu-item{font-size:'+Math.round(14*s)+'px!important}'+
    '.chat-title{font-size:'+Math.round(16*s)+'px!important}'+
    '.chat-time{font-size:'+Math.round(13*s)+'px!important}'+
    '.pill{font-size:'+Math.round(14*s)+'px!important}'+
    '.new-chat-btn{font-size:'+Math.round(15*s)+'px!important}'+
    '.field label{font-size:'+Math.round(15*s)+'px!important}'+
    '.model-option-title{font-size:'+Math.round(15*s)+'px!important}'+
    '.model-option-subtitle{font-size:'+Math.round(12*s)+'px!important}'+
    '.settings-entry-title{font-size:'+Math.round(15*s)+'px!important}'+
    '.settings-card-title{font-size:'+Math.round(13*s)+'px!important}'+
    '.settings-radio-title{font-size:'+Math.round(15*s)+'px!important}'+
    '.settings-toggle-title{font-size:'+Math.round(15*s)+'px!important}'+
    '.hint,.settings-entry-desc,.settings-radio-desc,.settings-toggle-desc,.settings-card-hint{font-size:'+Math.round(13*s)+'px!important}'+
    '.side-bottom-btn{font-size:'+Math.round(14*s)+'px!important}'+
    '.sidebar-label{font-size:'+Math.round(15*s)+'px!important}'+
    '.preset-card-title{font-size:'+Math.round(15*s)+'px!important}'+
    '.fetch-models-btn{font-size:'+Math.round(13*s)+'px!important}'+
    '.manual-add-toggle{font-size:'+Math.round(13*s)+'px!important}'+
    '.btn{font-size:'+Math.round(15*s)+'px!important}'+
    '.status{font-size:'+Math.round(14*s)+'px!important}';
  document.head.appendChild(st);
}

/* ── 主题 ── */
function loadThemeMode(){
  var v = safeGet(KEYS.themeMode);
  if(v === 'light' || v === 'dark' || v === 'system') return v;
  return 'system';
}
function saveThemeMode(m){ setItem(KEYS.themeMode, m); }
function resolveTheme(){
  var mode = loadThemeMode();
  if(mode === 'light') return 'light';
  if(mode === 'dark') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ── 移动端键盘样式注入 ── */
function ensureMobileKeyboardStyle(){
  if(document.getElementById('daotianMobileKeyboardStyle')) return;
  const style=document.createElement('style');
  style.id='daotianMobileKeyboardStyle';
  style.textContent = `\
@media (max-width:900px){\
  body.keyboard-open{overflow:hidden!important;overscroll-behavior:none!important;}\
  body.keyboard-open #app{position:fixed!important;left:0!important;top:var(--app-top,0px)!important;width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;transform:none!important;}\
  body.keyboard-open .app-shell{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;}\
  body.keyboard-open .main{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:0!important;position:relative!important;overflow:hidden!important;}\
  body.keyboard-open .messages{position:absolute!important;left:0!important;right:0!important;top:0!important;bottom:72px!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:10px 18px 8px!important;scroll-padding-bottom:8px!important;}\
  body.keyboard-open .messages.generating-space{padding-bottom:96px!important;scroll-padding-bottom:96px!important;}\
  body.keyboard-open .composer-wrap{position:absolute!important;left:0!important;right:0!important;bottom:0!important;width:100vw!important;padding:4px 14px 6px!important;background:linear-gradient(to top,var(--bg) 88%,rgba(0,0,0,0))!important;z-index:100!important;}\
  body.keyboard-open .empty{display:none!important;}\
  body.keyboard-open .floating-menu,body.keyboard-open .top-actions{opacity:0!important;pointer-events:none!important;}\
  body.keyboard-open .sidebar:not(.closed){transform:translateX(-105%)!important;opacity:0!important;pointer-events:none!important;}\
}`;
  document.head.appendChild(style);
}

/* ── 键盘与视口 ── */
function setupMobileViewport(){
  try{
    ensureMobileKeyboardStyle();
    const root = document.documentElement;
    const input = $('#input');
    const messagesBox = $('#messages');
    if(!root || !input || !messagesBox) return;

    var baselineHeight = window.innerHeight;
    var lastInset = 0;
    var rafPending = false;

    function isMobile(){
      var w = window.innerWidth || document.documentElement.clientWidth || 9999;
      var t = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
      var c = false;
      try{ c = matchMedia('(pointer: coarse)').matches; }catch(e){}
      return w <= 900 && (t || c);
    }
    function isIOS(){
      return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    }

    function updateKeyboard(){
      if(!isMobile()){
        document.body.classList.remove('keyboard-open');
        root.style.removeProperty('--keyboard-inset');
        lastInset = 0;
        return;
      }

      var vv = window.visualViewport;
      if(!vv){ return; }

      var vvHeight = Math.round(vv.height);
      var vvTop = typeof vv.offsetTop === 'number' ? Math.round(vv.offsetTop) : 0;
      var inset = baselineHeight - vvHeight - vvTop;
      var focused = document.activeElement === input;

      if(inset < 30 || !focused){
        /* keyboard closed or input not focused → reset */
        baselineHeight = window.innerHeight;
        document.body.classList.remove('keyboard-open');
        root.style.removeProperty('--keyboard-inset');
        root.style.removeProperty('--keyboard-accessory-offset');
        root.style.removeProperty('--app-height');
        root.style.removeProperty('--app-top');
        if(lastInset !== 0){ lastInset = 0; }
        return;
      }

      /* keyboard is open */
      root.style.setProperty('--app-height', vvHeight + 'px');
      root.style.setProperty('--app-top', vvTop + 'px');
      root.style.setProperty('--vvh', vvHeight + 'px');
      root.style.setProperty('--keyboard-accessory-offset', '0px');
      var layoutH = window.innerHeight || vvHeight;
      var keyboardLikely = layoutH - vvHeight > 120;
      var extra = keyboardLikely ? Math.round(Math.min(72, Math.max(48, layoutH * 0.07))) : 0;
      root.style.setProperty('--dt-keyboard-extra', extra + 'px');
      var composerEl = document.querySelector('.composer-wrap');
      var ch = 88;
      try{ if(composerEl) ch = Math.max(64, Math.ceil(composerEl.getBoundingClientRect().height)); }catch(_e){}
      root.style.setProperty('--composer-h', ch + 'px');

      if(Math.abs(inset - lastInset) > 6){
        root.style.setProperty('--keyboard-inset', inset + 'px');
        lastInset = inset;
      }

      if(!document.body.classList.contains('keyboard-open')){
        document.body.classList.add('keyboard-open');
        if(sidebarOpen){ sidebarOpen = false; renderSidebar(); }
        try{ window.scrollTo(0, 0); }catch(_e){}
        if(!isStreamingNow()){
          requestAnimationFrame(function(){
            try{ scrollActiveMessageIntoReadingZone({ratio:0.18}); }catch(_e){}
          });
        }
      }
    }

    function scheduleUpdate(){
      if(rafPending) return;
      rafPending = true;
      requestAnimationFrame(function(){
        rafPending = false;
        updateKeyboard();
      });
    }

    /* Track baseline when viewport changes without keyboard */
    window.addEventListener('resize', function(){
      if(!document.body.classList.contains('keyboard-open')){
        baselineHeight = window.innerHeight;
      }
      scheduleUpdate();
    }, {passive:true});

    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', scheduleUpdate, {passive:true});
      window.visualViewport.addEventListener('scroll', scheduleUpdate, {passive:true});
    }

    input.addEventListener('focus', function(){
      baselineHeight = window.innerHeight;
      scheduleUpdate();
    });

    input.addEventListener('blur', function(){
      setTimeout(function(){
        if(sending || (lastSendAt && Date.now() - lastSendAt < 1200)) return;
        if(document.activeElement !== input) updateKeyboard();
      }, 300);
    });

    window.addEventListener('orientationchange', function(){ setTimeout(scheduleUpdate, 80); }, {passive:true});
    document.addEventListener('focusin', function(){ scheduleUpdate(); setTimeout(scheduleUpdate, 120); setTimeout(scheduleUpdate, 320); }, true);
    document.addEventListener('focusout', function(){ setTimeout(scheduleUpdate, 80); }, true);

    input.addEventListener('input', function(){ autoResizeTextarea(this); });

    updateKeyboard();
  }catch(_err){}
}
function autoResizeTextarea(ta){
  ta.style.height='44px';
  var maxH=120;
  var nh=Math.min(ta.scrollHeight, maxH);
  ta.style.height=nh+'px';
  ta.style.overflowY=ta.scrollHeight > maxH ? 'auto' : 'hidden';
}

/* ── Thinking 位置观察器 ── */
function initThinkingPositionObserver(){
  var box = $('#messages');
  if(!box){ setTimeout(initThinkingPositionObserver, 120); return; }
  if(_thinkingObserver) _thinkingObserver.disconnect();
  _thinkingObserver = new MutationObserver(function(){
    if(box.querySelector('.daotian-thinking-message')) scheduleThinkingScroll();
  });
  _thinkingObserver.observe(box, {childList:true, subtree:true, attributes:true, attributeFilter:['class','data-scroll-focus']});
  if(box.querySelector('.daotian-thinking-message')) scheduleThinkingScroll();
}

/* ── 系统主题跟随 ── */
try{
  if(window.matchMedia){
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(){
      if(loadThemeMode() === 'system'){ theme = resolveTheme(); renderAll(); }
    });
  }
}catch(_e1){}
