(function(){
  'use strict';

  function emergency(message){
    var app = document.getElementById('app');
    if(!app) return;
    app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#f5f2ea;color:#2a2824;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;padding:24px">' +
      '<div style="max-width:520px;width:100%;background:#fff;border:1px solid rgba(90,78,62,.18);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(70,55,35,.12)">' +
      '<h2 style="margin:0 0 10px;font-size:22px">稻田 Ai 已进入救援模式</h2>' +
      '<p style="line-height:1.7;color:#827a70;margin:0 0 16px">页面没有丢。只是旧缓存数据可能损坏，已拦截白屏。</p>' +
      '<pre style="white-space:pre-wrap;background:#f7f3ec;border-radius:14px;padding:12px;font-size:12px;color:#655b52;max-height:160px;overflow:auto">' + String(message||'unknown').replace(/[&<>]/g,function(c){return ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]);}) + '</pre>' +
      '<button id="resetDaotian" style="height:42px;border:0;border-radius:14px;background:#a77a57;color:white;padding:0 16px;font:inherit;cursor:pointer">清理本地聊天缓存并恢复</button>' +
      '</div></div>';
    var btn = document.getElementById('resetDaotian');
    if(btn) btn.onclick = function(){
      try{
        Object.keys(localStorage).forEach(function(k){ if(k.indexOf('daotian')===0) localStorage.removeItem(k); });
      }catch(e){}
      location.reload();
    };
  }

  window.addEventListener('error', function(e){ emergency(e.message || e.error || 'script error'); });
  window.addEventListener('unhandledrejection', function(e){ emergency((e.reason && e.reason.message) || e.reason || 'promise error'); });

  try{
    const $ = (sel, root=document) => root.querySelector(sel);
    const uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

    const KEYS = {
      chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323',
      oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
      v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322'
    };

    const defaultSettings = { providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions' };

    const emptyPrompts = [
      '今天想聊什么',
      '从哪一句开始',
      '现在想说点什么',
      '今天先聊哪件事',
      '随便开个头也行',
      '想到什么就发什么'
    ];

    function safeGet(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
    function readJSON(key, fallback){ try{ const v = safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
    function saveJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
    function setItem(key, value){ try{ localStorage.setItem(key, value); }catch(e){} }

    function normalizeMessage(m){
      if(!m || typeof m !== 'object') return null;
      const role = m.role === 'assistant' || m.role === 'system' ? m.role : 'user';
      const content = typeof m.content === 'string' ? m.content : (m.content == null ? '' : String(m.content));
      return {role, content};
    }
    function normalizeChat(c, i){
      if(!c || typeof c !== 'object') return null;
      const id = typeof c.id === 'string' && c.id ? c.id : uid() + '_' + i;
      const messages = Array.isArray(c.messages) ? c.messages.map(normalizeMessage).filter(Boolean) : [];
      let title = typeof c.title === 'string' && c.title.trim() ? c.title.trim() : '';
      if(!title && messages[0]) title = messages[0].content.slice(0,28);
      if(!title) title = '新对话';
      return {id, title, createdAt:Number(c.createdAt)||Date.now(), updatedAt:Number(c.updatedAt)||Date.now(), messages};
    }
    function loadChats(){
      const candidates = [readJSON(KEYS.chats,null), readJSON(KEYS.v322Chats,null), readJSON(KEYS.oldChats,null)];
      for(const raw of candidates){
        if(Array.isArray(raw)){
          const clean = raw.map(normalizeChat).filter(Boolean);
          if(clean.length) return clean;
        }
      }
      const id = uid();
      return [{id, title:'新对话', createdAt:Date.now(), updatedAt:Date.now(), messages:[]}];
    }

    let theme = safeGet(KEYS.theme) || 'dark';
    let settings = Object.assign({}, defaultSettings, readJSON(KEYS.settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {});
    let chats = loadChats();
    let activeId = safeGet(KEYS.active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
    let sidebarOpen = true;
    let searchOn = false;
    let sending = false;
    if(!chats.some(c=>c && c.id===activeId)) activeId = chats[0].id;

    function activeChat(){ return chats.find(c=>c && c.id===activeId) || chats[0]; }
    function persist(){ saveJSON(KEYS.chats,chats); setItem(KEYS.active,activeId); saveJSON(KEYS.settings,settings); setItem(KEYS.theme,theme); }

    const app = $('#app');
    if(!app) throw new Error('#app not found');
    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><div class="brand">稻田 Ai</div></div>
          <button class="new-chat-btn" id="newChat">＋ 新对话</button>
          <div class="chat-list" id="chatList"></div>
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openProvider">设置 / 模型提供方</button></div>
        </aside>
        <main class="main">
          <button class="floating-menu" id="openSide" title="展开侧边栏">☰</button>
          <div class="top-actions"><button class="icon-btn" id="themeBtn" title="主题">☀</button></div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="search-toggle"><button class="pill" id="searchBtn">○ 联网搜索</button></div>
            <div class="composer"><textarea id="input" placeholder="输入消息...（Enter 发送，Shift + Enter 换行）"></textarea><button class="send" id="sendBtn">›</button></div>
          </div>
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="row"><div class="field"><label>提供方类型</label><select id="providerType"><option value="openai">OpenAI 兼容</option><option value="gemini">Gemini</option><option value="anthropic">Anthropic</option></select></div><div class="field"><label>名称</label><input id="providerName" placeholder="DeepSeek / OpenAI / Gemini / Anthropic"></div></div>
          <div class="field"><label>Base URL</label><input id="baseUrl" placeholder="https://api.deepseek.com"></div>
          <div class="field"><label>API Key</label><input id="apiKey" type="password" placeholder="sk-... / AIza... / anthropic key"></div>
          <div class="row"><div class="field"><label>模型名</label><input id="model" placeholder="deepseek-chat"></div><div class="field"><label>请求路径</label><input id="path" placeholder="/v1/chat/completions"></div></div>
          <div class="hint">OpenAI 兼容接口可直接浏览器请求。Gemini / Anthropic 配置先保存，后续需要后端适配转发。</div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    function toast(text){ const s=$('#status'); if(!s)return; s.textContent=text; s.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>s.classList.remove('show'),1800); }
    function escapeHTML(s){ return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

    function renderSidebar(){
      const side = $('#sidebar'); if(!side) return;
      side.classList.toggle('closed', !sidebarOpen);
      $('#openSide').style.display = sidebarOpen ? 'none' : 'grid';
      const list = $('#chatList');
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span><button class="delete-chat" data-del="${escapeHTML(c.id)}" title="删除">×</button></div>`).join('');
    }
    function pickEmptyPrompt(){
      const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate();
      return emptyPrompts[seed % emptyPrompts.length];
    }

    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><svg class="empty-logo empty-logo-gamma" viewBox="0 0 120 120" aria-hidden="true"><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(m=>`<div class="message ${m.role==='user'?'user':'assistant'}"><div class="bubble">${escapeHTML(m.content)}</div></div>`).join('');
      box.scrollTop = box.scrollHeight;
    }
    function renderAll(){
      document.documentElement.setAttribute('data-theme', theme);
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      const themeBtn = $('#themeBtn'); if(themeBtn) themeBtn.textContent = theme === 'dark' ? '☾' : '☀';
      renderSidebar(); renderMessages(); persist();
    }

    function createChat(){ const id=uid(); chats.unshift({id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; sidebarOpen=true; renderAll(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      renderAll(); toast('已删除');
    }

    function buildOpenAIURL(){ const base=(settings.baseUrl||'').replace(/\/$/,''); const path=settings.path||'/v1/chat/completions'; if(!base) return '/v1/chat/completions'; if(base.endsWith('/v1') && path.startsWith('/v1/')) return base + path.slice(3); return base + (path.startsWith('/') ? path : '/' + path); }
    async function callModel(messages){
      if((settings.providerType||'openai') !== 'openai') throw new Error('Gemini / Anthropic 已保存，但还需要后端转发适配。当前先用 OpenAI 兼容接口。');
      const headers={'Content-Type':'application/json'}; if(settings.apiKey) headers.Authorization='Bearer '+settings.apiKey;
      const body={model:settings.model||'deepseek-chat',messages:messages.map(m=>({role:m.role,content:m.content})),stream:false}; if(searchOn) body.web_search=true;
      const res=await fetch(buildOpenAIURL(),{method:'POST',headers,body:JSON.stringify(body)}); const txt=await res.text(); if(!res.ok) throw new Error(txt.slice(0,400)||('HTTP '+res.status));
      try{ const data=JSON.parse(txt); return data.choices?.[0]?.message?.content || data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || data.content?.[0]?.text || JSON.stringify(data).slice(0,1000); }catch(e){ return txt; }
    }
    async function sendMessage(){
      if(sending) return; const input=$('#input'); const text=(input.value||'').trim(); if(!text) return; const c=activeChat();
      c.messages.push({role:'user',content:text}); if(!c.title || c.title==='新对话') c.title=text.slice(0,28); c.updatedAt=Date.now(); input.value=''; sending=true; $('#sendBtn').disabled=true; renderAll();
      try{ c.messages.push({role:'assistant',content:await callModel(c.messages) || '没有返回内容'}); }catch(err){ c.messages.push({role:'assistant',content:'请求失败：'+(err&&err.message?err.message:String(err))}); }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
    }

    function openSettings(){ $('#providerType').value=settings.providerType||'openai'; $('#providerName').value=settings.providerName||''; $('#baseUrl').value=settings.baseUrl||''; $('#apiKey').value=settings.apiKey||''; $('#model').value=settings.model||''; $('#path').value=settings.path||'/v1/chat/completions'; $('#providerModal').classList.add('show'); }
    function closeSettings(){ $('#providerModal').classList.remove('show'); }
    function saveSettings(){ settings={providerType:$('#providerType').value,providerName:$('#providerName').value.trim(),baseUrl:$('#baseUrl').value.trim(),apiKey:$('#apiKey').value.trim(),model:$('#model').value.trim(),path:$('#path').value.trim()||'/v1/chat/completions'}; persist(); closeSettings(); toast('已保存'); }

    document.addEventListener('click', e=>{ const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; } const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); if(window.innerWidth<760) sidebarOpen=false; renderAll(); } });
    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();}; $('#openSide').onclick=()=>{sidebarOpen=true;renderAll();}; $('#newChat').onclick=createChat; $('#themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#openProvider').onclick=openSettings; $('#closeProvider').onclick=closeSettings; $('#cancelProvider').onclick=closeSettings; $('#saveProvider').onclick=saveSettings;
    $('#searchBtn').onclick=()=>{searchOn=!searchOn; $('#searchBtn').classList.toggle('active',searchOn); $('#searchBtn').textContent=searchOn?'● 联网搜索':'○ 联网搜索';}; $('#sendBtn').onclick=sendMessage;
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });
    $('#providerType').addEventListener('change', e=>{ const v=e.target.value; if(v==='openai'){ $('#path').value='/v1/chat/completions'; if(!$('#baseUrl').value) $('#baseUrl').value='https://api.deepseek.com'; } if(v==='gemini'){ $('#providerName').value=$('#providerName').value||'Gemini'; $('#baseUrl').value=$('#baseUrl').value||'https://generativelanguage.googleapis.com'; $('#model').value=$('#model').value||'gemini-1.5-flash'; } if(v==='anthropic'){ $('#providerName').value=$('#providerName').value||'Anthropic'; $('#baseUrl').value=$('#baseUrl').value||'https://api.anthropic.com'; $('#model').value=$('#model').value||'claude-3-5-sonnet-latest'; } });



    function setupMobileViewport(){
      try{
        const root = document.documentElement;
        const input = $('#input');
        if(!root || !input) return;
        let t = null;
        function isMobile(){ return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 760; }
        function update(){
          try{
            if(!isMobile()){
              document.body.classList.remove('keyboard-open');
              root.style.removeProperty('--vvh');
              root.style.removeProperty('--vvo');
              return;
            }
            const vv = window.visualViewport;
            const h = vv && vv.height ? vv.height : window.innerHeight;
            const top = vv && typeof vv.offsetTop === 'number' ? vv.offsetTop : 0;
            root.style.setProperty('--vvh', Math.max(320, Math.round(h)) + 'px');
            root.style.setProperty('--vvo', Math.round(top) + 'px');
            const focused = document.activeElement === input;
            document.body.classList.toggle('keyboard-open', !!focused);
            if(focused){
              sidebarOpen = false;
              renderSidebar();
              setTimeout(function(){
                const box = $('#messages');
                if(box) box.scrollTop = box.scrollHeight;
              }, 60);
            }
          }catch(_e){}
        }
        function schedule(){ clearTimeout(t); t = setTimeout(update, 40); }
        input.addEventListener('focus', function(){ setTimeout(update, 60); setTimeout(update, 220); });
        input.addEventListener('blur', function(){ setTimeout(update, 120); });
        window.addEventListener('resize', schedule, {passive:true});
        window.addEventListener('orientationchange', function(){ setTimeout(update, 260); }, {passive:true});
        if(window.visualViewport){
          window.visualViewport.addEventListener('resize', schedule, {passive:true});
          window.visualViewport.addEventListener('scroll', schedule, {passive:true});
        }
        update();
      }catch(_err){}
    }

    renderAll();
    setupMobileViewport();
  }catch(err){
    emergency(err && err.stack ? err.stack : err);
  }
})();
