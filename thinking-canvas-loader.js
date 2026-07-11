(function(){
  'use strict';

  var STYLE_ID = 'daotianThinkingTextFlowStyle';
  var observer = null;
  var raf = 0;

  function injectStyle(){
    if(document.getElementById(STYLE_ID)) return;
    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = [
      '.daotian-thinking-message{justify-content:flex-start!important;align-items:center!important;}',
      '.daotian-thinking{display:inline-flex!important;align-items:center!important;gap:0!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important;}',
      '.daotian-thinking-orbit,.daotian-thinking img,.daotian-thinking canvas,.daotian-thinking svg{display:none!important;visibility:hidden!important;width:0!important;height:0!important;min-width:0!important;min-height:0!important;margin:0!important;padding:0!important;overflow:hidden!important;}',
      '.daotian-thinking-text{display:inline-block!important;font-size:14px!important;line-height:1.5!important;font-weight:400!important;font-style:normal!important;letter-spacing:0!important;white-space:nowrap!important;opacity:1!important;color:transparent!important;-webkit-text-fill-color:transparent!important;background:linear-gradient(100deg,rgba(110,106,100,.52) 0%,rgba(110,106,100,.52) 34%,rgba(45,43,40,.92) 49%,rgba(110,106,100,.52) 64%,rgba(110,106,100,.52) 100%)!important;background-size:230% 100%!important;background-position:180% 50%;-webkit-background-clip:text!important;background-clip:text!important;animation:daotianThinkingTextFlow 1.55s linear infinite!important;will-change:background-position!important;}',
      '[data-theme="dark"] .daotian-thinking-text{background:linear-gradient(100deg,rgba(158,158,158,.58) 0%,rgba(158,158,158,.58) 34%,rgba(238,238,238,.94) 49%,rgba(158,158,158,.58) 64%,rgba(158,158,158,.58) 100%)!important;background-size:230% 100%!important;background-position:180% 50%;-webkit-background-clip:text!important;background-clip:text!important;}',
      '@keyframes daotianThinkingTextFlow{0%{background-position:180% 50%}100%{background-position:-80% 50%}}',
      '@media (prefers-reduced-motion:reduce){.daotian-thinking-text{animation:none!important;background-position:50% 50%!important;}}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function normalize(node){
    if(!node || node.nodeType !== 1) return;
    var row = node.classList && node.classList.contains('daotian-thinking-message')
      ? node
      : node.querySelector && node.querySelector('.daotian-thinking-message');
    if(!row) return;

    var wrap = row.querySelector('.daotian-thinking');
    var text = wrap && wrap.querySelector('.daotian-thinking-text');
    var clean = !!(wrap && text && wrap.children.length === 1 && text.textContent === 'Thinking');
    if(clean) return;

    row.innerHTML = '<div class="daotian-thinking" role="status" aria-live="polite"><span class="daotian-thinking-text">Thinking</span></div>';
  }

  function scan(){
    raf = 0;
    injectStyle();
    var rows = document.querySelectorAll('.daotian-thinking-message');
    for(var i = 0; i < rows.length; i++) normalize(rows[i]);
  }

  function schedule(){
    if(raf) return;
    raf = requestAnimationFrame(scan);
  }

  function boot(){
    scan();
    if(observer) return;
    observer = new MutationObserver(schedule);
    observer.observe(document.documentElement,{childList:true,subtree:true,characterData:true});
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
