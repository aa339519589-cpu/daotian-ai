(function(){
  'use strict';
  window.__DAOTIAN_ROLLBACK_LOADER__ = 'rollback-to-c09250b-v3.5.2-pre-settings-memory';
  var RAW = 'https://raw.githubusercontent.com/aa339519589-cpu/daotian-ai/c09250bb408d4c04e5192a85d034177e87a9fef1/app.js';
  function showError(msg){
    try{
      var app = document.getElementById('app') || document.body;
      app.innerHTML = '<div style="padding:24px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.7;color:#111;background:#fff;min-height:100vh">'
        + '<h2 style="margin:0 0 12px">稻田 Ai 回滚加载失败</h2>'
        + '<p>旧稳定版没有执行成功。请检查网络是否能打开 GitHub raw。</p>'
        + '<pre style="white-space:pre-wrap;background:#f3f3f3;padding:12px;border-radius:12px">' + String(msg || 'unknown').replace(/[&<>]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;'}[c];}) + '</pre>'
        + '<p>旧版地址：</p><pre style="white-space:pre-wrap;background:#f3f3f3;padding:12px;border-radius:12px">' + RAW + '</pre>'
        + '</div>';
    }catch(_e){}
  }
  fetch(RAW, {cache:'no-store'})
    .then(function(res){
      if(!res.ok) throw new Error('HTTP ' + res.status);
      return res.text();
    })
    .then(function(code){
      if(!code || code.indexOf('v3.5.2-keyboard-render-stable') < 0){
        throw new Error('旧版代码校验失败');
      }
      (0, eval)(code + '\n//# sourceURL=daotian-v3.5.2-stable-rollback.js');
    })
    .catch(function(err){ showError(err && err.message ? err.message : err); });
})();
