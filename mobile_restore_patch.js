(function(){
  'use strict';
  window.__DAOTIAN_MOBILE_RESTORE_VERSION__ = 'v3.6.3-restore-mobile-header-keyboard';

  function $(sel, root){ return (root || document).querySelector(sel); }
  function isMobile(){ return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 760; }

  function injectStyle(){
    if(document.getElementById('daotianMobileRestoreStyle')) return;
    var style = document.createElement('style');
    style.id = 'daotianMobileRestoreStyle';
    style.textContent = `
      .mobile-topbar{display:none}

      @media (max-width:760px){
        html,body,#app{width:100%;height:var(--app-height,100dvh);min-height:var(--app-height,100dvh);overflow:hidden!important;overscroll-behavior:none!important;}
        body{position:fixed!important;inset:0!important;width:100vw!important;background:var(--bg)!important;touch-action:manipulation;}
        #app{position:fixed!important;left:0!important;top:var(--app-top,0px)!important;width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;transform:none!important;}
        .app-shell{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:var(--app-height,100dvh)!important;overflow:hidden!important;display:flex!important;}
        .main{width:100vw!important;height:var(--app-height,100dvh)!important;min-height:0!important;display:flex!important;flex-direction:column!important;align-items:stretch!important;overflow:hidden!important;margin:0!important;position:relative!important;}

        .mobile-topbar{display:flex!important;align-items:center;justify-content:space-between;flex:0 0 auto;height:38px;padding:0 12px;border-bottom:1px solid var(--line,rgba(127,127,127,.16));background:rgba(18,20,23,.72);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);z-index:90;}
        :root[data-theme="light"] .mobile-topbar,[data-theme="light"] .mobile-topbar{background:rgba(248,246,240,.78)}
        .mobile-topbar-title{font-size:14px;font-weight:650;letter-spacing:.04em;color:var(--text);opacity:.92;line-height:1;}
        .mobile-topbar-btn{width:30px;height:30px;border-radius:13px;border:1px solid var(--line,rgba(127,127,127,.18));background:rgba(127,127,127,.08);color:var(--text);display:grid;place-items:center;font:inherit;font-size:15px;padding:0;}

        .floating-menu,.top-actions{display:none!important;}
        .messages{width:100%!important;flex:1 1 auto!important;min-height:0!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;padding:16px 14px 122px!important;scroll-padding-bottom:24px!important;}
        .empty{min-height:100%!important;height:100%!important;display:grid!important;place-items:center!important;padding:0 0 18px!important;}
        .empty-center{transform:translateY(0)!important;}
        .empty-logo,.empty-logo-gamma{width:72px!important;height:72px!important;}
        .empty-prompt{font-size:15px!important;}

        .composer-wrap{position:relative!important;left:auto!important;right:auto!important;bottom:auto!important;top:auto!important;transform:none!important;flex:0 0 auto!important;width:100%!important;max-width:none!important;z-index:80!important;padding:8px 12px calc(10px + env(safe-area-inset-bottom))!important;background:linear-gradient(to top,var(--bg) 82%,rgba(0,0,0,0))!important;}
        .toolbar,.search-toggle{margin-bottom:7px!important;}
        .toolbar-right{display:flex!important;}
        .model-select,.model-pill{max-width:42vw!important;}
        .composer{width:100%!important;max-width:none!important;border-radius:22px!important;}
        textarea{font-size:16px!important;}

        .sidebar{position:fixed!important;left:0!important;top:0!important;bottom:0!important;width:min(82vw,320px)!important;min-width:min(82vw,320px)!important;height:var(--app-height,100dvh)!important;z-index:140!important;transform:translateX(-105%)!important;opacity:0!important;pointer-events:none!important;transition:transform .22s ease,opacity .22s ease!important;box-shadow:18px 0 50px rgba(0,0,0,.28)!important;}
        .sidebar:not(.closed),body.mobile-sidebar-open .sidebar{transform:translateX(0)!important;opacity:1!important;pointer-events:auto!important;}
        .sidebar.closed{transform:translateX(-105%)!important;opacity:0!important;pointer-events:none!important;}
        .sidebar-top{height:calc(54px + env(safe-area-inset-top))!important;padding:env(safe-area-inset-top) 12px 0!important;}
        .sidebar-bottom{padding-bottom:calc(12px + env(safe-area-inset-bottom))!important;}

        body.dt-keyboard-open .mobile-topbar{display:flex!important;height:34px!important;}
        body.dt-keyboard-open .messages{padding:10px 14px 8px!important;}
        body.dt-keyboard-open .empty{display:none!important;}
        body.dt-keyboard-open .toolbar,body.dt-keyboard-open .search-toggle{display:none!important;}
        body.dt-keyboard-open .composer-wrap{padding:7px 12px calc(7px + env(safe-area-inset-bottom))!important;background:linear-gradient(to top,var(--bg) 92%,rgba(0,0,0,0))!important;}
        body.dt-keyboard-open .composer{border-radius:20px!important;padding-top:8px!important;padding-bottom:8px!important;}
        body.dt-keyboard-open textarea{min-height:36px!important;max-height:86px!important;}
        body.dt-keyboard-open .send{width:42px!important;height:42px!important;}
        body.dt-keyboard-open .sidebar{transform:translateX(-105%)!important;opacity:0!important;pointer-events:none!important;}
      }
    `;
    document.head.appendChild(style);
  }

  function ensureTopbar(){
    if(!isMobile()) return;
    var main = $('.main');
    if(!main || $('#mobileTopbar')) return;
    var bar = document.createElement('div');
    bar.className = 'mobile-topbar';
    bar.id = 'mobileTopbar';
    bar.innerHTML = '<button class="mobile-topbar-btn" id="mobileMenuBtn" title="菜单">☰</button><div class="mobile-topbar-title">稻田 Ai</div><button class="mobile-topbar-btn" id="mobileThemeBtn" title="主题">☾</button>';
    main.insertBefore(bar, main.firstChild);

    var menuBtn = $('#mobileMenuBtn');
    var themeBtn = $('#mobileThemeBtn');
    if(menuBtn){
      menuBtn.addEventListener('click', function(){
        var side = $('.sidebar');
        if(!side) return;
        if(side.classList.contains('closed')){
          var open = $('#openSide');
          if(open) open.click(); else side.classList.remove('closed');
          document.body.classList.add('mobile-sidebar-open');
        }else{
          var close = $('#closeSide');
          if(close) close.click(); else side.classList.add('closed');
          document.body.classList.remove('mobile-sidebar-open');
        }
      });
    }
    if(themeBtn){
      themeBtn.addEventListener('click', function(){
        var real = $('#themeBtn');
        if(real) real.click();
        setTimeout(syncThemeIcon, 30);
      });
    }
  }

  function syncThemeIcon(){
    var btn = $('#mobileThemeBtn');
    if(!btn) return;
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark' || ($('.app-shell') && $('.app-shell').getAttribute('data-theme') === 'dark');
    btn.textContent = isDark ? '☾' : '☀';
  }

  function closeMobileSidebar(){
    document.body.classList.remove('mobile-sidebar-open');
    var side = $('.sidebar');
    if(side && !side.classList.contains('closed')){
      var close = $('#closeSide');
      if(close) close.click(); else side.classList.add('closed');
    }
  }

  function updateViewport(){
    var root = document.documentElement;
    if(!isMobile()){
      document.body.classList.remove('dt-keyboard-open');
      document.body.classList.remove('mobile-sidebar-open');
      root.style.removeProperty('--app-height');
      root.style.removeProperty('--app-top');
      return;
    }

    var vv = window.visualViewport;
    var height = vv && vv.height ? vv.height : window.innerHeight;
    var top = vv && typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
    height = Math.max(320, Math.round(height));
    top = Math.max(0, Math.round(top));

    root.style.setProperty('--app-height', height + 'px');
    root.style.setProperty('--app-top', top + 'px');

    var focused = document.activeElement && (/TEXTAREA|INPUT/.test(document.activeElement.tagName));
    document.body.classList.toggle('dt-keyboard-open', !!focused);
    if(focused){
      closeMobileSidebar();
      scrollLatest();
    }
  }

  function scrollLatest(){
    var box = $('.messages');
    if(!box) return;
    requestAnimationFrame(function(){ try{ box.scrollTop = box.scrollHeight; }catch(e){} });
    setTimeout(function(){ try{ box.scrollTop = box.scrollHeight; }catch(e){} }, 80);
    setTimeout(function(){ try{ box.scrollTop = box.scrollHeight; }catch(e){} }, 240);
    setTimeout(function(){ try{ box.scrollTop = box.scrollHeight; }catch(e){} }, 520);
  }

  function boot(){
    injectStyle();
    ensureTopbar();
    syncThemeIcon();
    updateViewport();
    setTimeout(function(){ ensureTopbar(); syncThemeIcon(); updateViewport(); }, 250);
    setTimeout(function(){ ensureTopbar(); syncThemeIcon(); updateViewport(); }, 900);
  }

  document.addEventListener('focusin', function(e){
    if(e.target && (/TEXTAREA|INPUT/.test(e.target.tagName))){
      updateViewport();
      setTimeout(updateViewport, 120);
      setTimeout(updateViewport, 320);
      setTimeout(scrollLatest, 120);
    }
  });
  document.addEventListener('focusout', function(){ setTimeout(updateViewport, 180); });
  window.addEventListener('resize', function(){ setTimeout(updateViewport, 20); }, {passive:true});
  window.addEventListener('orientationchange', function(){ setTimeout(updateViewport, 260); }, {passive:true});
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize', function(){ setTimeout(updateViewport, 10); }, {passive:true});
    window.visualViewport.addEventListener('scroll', function(){ setTimeout(updateViewport, 10); }, {passive:true});
  }

  var obs = new MutationObserver(function(){ ensureTopbar(); syncThemeIcon(); });
  obs.observe(document.documentElement, {childList:true, subtree:true, attributes:true, attributeFilter:['data-theme','class']});

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
