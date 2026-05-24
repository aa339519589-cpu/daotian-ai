(function(){
  'use strict';

  function emergency(message){
    var app = document.getElementById('app');
    if(!app) return;
    app.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;background:#0f1115;color:#e8eaf0;font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',sans-serif;padding:24px">' +
      '<div style="max-width:520px;width:100%;background:#151820;border:1px solid rgba(255,255,255,.1);border-radius:22px;padding:22px;box-shadow:0 20px 60px rgba(0,0,0,.35)">' +
      '<h2 style="margin:0 0 10px;font-size:22px">稻田 Ai 已进入救援模式</h2>' +
      '<p style="line-height:1.7;color:#9097a6;margin:0 0 16px">页面没有丢。只是脚本报错，已拦截白屏。</p>' +
      '<pre style="white-space:pre-wrap;background:rgba(255,255,255,.06);border-radius:14px;padding:12px;font-size:12px;color:#c9ced8;max-height:180px;overflow:auto">' + escapeHTML(String(message||'unknown')) + '</pre>' +
      '<button id="resetDaotian" style="height:42px;border:0;border-radius:14px;background:#d8d4ca;color:#0f1115;padding:0 16px;font:inherit;cursor:pointer">清理本地缓存并恢复</button>' +
      '</div></div>';
    var btn = document.getElementById('resetDaotian');
    if(btn) btn.onclick = function(){
      try{ Object.keys(localStorage).forEach(function(k){ if(k.indexOf('daotian')===0) localStorage.removeItem(k); }); }catch(e){}
      location.reload();
    };
  }

  function escapeHTML(s){ return String(s).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); }); }
  window.addEventListener('error', function(e){ emergency(e.message || e.error || 'script error'); });
  window.addEventListener('unhandledrejection', function(e){ emergency((e.reason && e.reason.message) || e.reason || 'promise error'); });

  try{
    const $ = (sel, root=document) => root.querySelector(sel);
    const uid = () => 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8);
    const nowTime = () => new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});

    const KEYS = {
      chats:'daotian.chats.v360', active:'daotian.activeChat.v360', settings:'daotian.settings.v360', theme:'daotian.theme.v360',
      memory:'daotian.crossMemory.v360',
      oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
      v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322',
      v323Chats:'daotian.chats.v323', v323Active:'daotian.activeChat.v323', v323Settings:'daotian.settings.v323', v323Theme:'daotian.theme.v323'
    };

    const defaultSettings = {
      providerType:'openai', providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', apiKey:'', model:'deepseek-chat', path:'/v1/chat/completions',
      temperature:0.7, top_p:0.9, max_tokens:0, contextMessages:24,
      memoryEnabled:true, systemPrompt:'', personalPrompt:'', useServerProxy:true
    };

    const emptyPrompts = ['今天想聊什么','从哪一句开始','现在想说点什么','今天先聊哪件事','随便开个头也行','想到什么就发什么'];
    let pendingFiles = [];

    function safeGet(key){ try{return localStorage.getItem(key);}catch(e){return null;} }
    function readJSON(key, fallback){ try{ const v = safeGet(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
    function saveJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }
    function setItem(key, value){ try{ localStorage.setItem(key, value); }catch(e){} }

    function normalizeMessage(m){
      if(!m || typeof m !== 'object') return null;
      const role = m.role === 'assistant' || m.role === 'system' ? m.role : 'user';
      const content = typeof m.content === 'string' ? m.content : (m.content == null ? '' : String(m.content));
      const attachments = Array.isArray(m.attachments) ? m.attachments : [];
      return {role, content, attachments:attachments.map(slimAttachment).filter(Boolean)};
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
      const candidates = [readJSON(KEYS.chats,null), readJSON(KEYS.v323Chats,null), readJSON(KEYS.v322Chats,null), readJSON(KEYS.oldChats,null)];
      for(const raw of candidates){
        if(Array.isArray(raw)){
          const clean = raw.map(normalizeChat).filter(Boolean);
          if(clean.length) return clean;
        }
      }
      const id = uid();
      return [{id, title:'新对话', createdAt:Date.now(), updatedAt:Date.now(), messages:[]}];
    }
    function loadSettings(){
      return Object.assign({}, defaultSettings, readJSON(KEYS.settings,null) || readJSON(KEYS.v323Settings,null) || readJSON(KEYS.v322Settings,null) || readJSON(KEYS.oldSettings,null) || {});
    }
    function getMemory(){ return safeGet(KEYS.memory) || ''; }
    function setMemory(v){ setItem(KEYS.memory, String(v || '').trim()); }
    function appendMemory(line){
      const clean = String(line || '').trim();
      if(!clean) return false;
      const old = getMemory();
      const next = old ? (old + '\n- ' + clean) : ('- ' + clean);
      setMemory(next.slice(-12000));
      return true;
    }

    let theme = safeGet(KEYS.theme) || safeGet(KEYS.v323Theme) || 'dark';
    let settings = loadSettings();
    let chats = loadChats();
    let activeId = safeGet(KEYS.active) || safeGet(KEYS.v323Active) || safeGet(KEYS.v322Active) || safeGet(KEYS.oldActive) || chats[0].id;
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
          <div class="sidebar-bottom"><button class="side-bottom-btn" id="openProvider">设置 / 模型 / 记忆</button></div>
        </aside>
        <main class="main">
          <button class="floating-menu" id="openSide" title="展开侧边栏">☰</button>
          <div class="top-actions"><button class="icon-btn" id="themeBtn" title="主题">☾</button><button class="icon-btn" id="quickMemory" title="记忆">记</button></div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="file-tray" id="fileTray"></div>
            <div class="toolbar"><div class="toolbar-left"><button class="pill" id="searchBtn">○ 联网搜索</button><button class="pill" id="memoryBtn">● 跨聊天记忆</button></div><div class="toolbar-right"><button class="pill" id="clearFiles">清空附件</button></div></div>
            <div class="composer"><button class="upload-btn" id="uploadBtn" title="上传文件或图片">+</button><textarea id="input" placeholder="输入消息...（Enter 发送，Shift + Enter 换行）"></textarea><button class="send" id="sendBtn">›</button></div>
            <input id="fileInput" type="file" multiple accept="image/*,.txt,.md,.markdown,.json,.js,.css,.html,.xml,.csv,.log,.py,.java,.c,.cpp,.h,.ts,.tsx,.jsx,.vue,.yml,.yaml,.pdf,.doc,.docx" hidden />
          </div>
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型 / 记忆</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="row"><div class="field"><label>提供方类型</label><select id="providerType"><option value="openai">OpenAI 兼容</option><option value="custom">自定义兼容接口</option></select></div><div class="field"><label>名称</label><input id="providerName" placeholder="DeepSeek / OpenAI / 小米 / 中转"></div></div>
          <div class="field"><label>Base URL</label><input id="baseUrl" placeholder="https://api.deepseek.com"></div>
          <div class="field"><label>API Key</label><input id="apiKey" type="password" placeholder="sk-..."></div>
          <div class="row"><div class="field"><label>模型名</label><input id="model" placeholder="deepseek-chat / gpt-4o-mini"></div><div class="field"><label>请求路径</label><input id="path" placeholder="/v1/chat/completions"></div></div>
          <div class="row"><div class="field"><label>Temperature</label><input id="temperature" type="number" min="0" max="2" step="0.05" placeholder="0.7"></div><div class="field"><label>Top P</label><input id="topP" type="number" min="0" max="1" step="0.05" placeholder="0.9"></div></div>
          <div class="row"><div class="field"><label>最大输出 token，0=默认</label><input id="maxTokens" type="number" min="0" step="128" placeholder="0"></div><div class="field"><label>上下文消息数</label><input id="contextMessages" type="number" min="2" max="80" step="2" placeholder="24"></div></div>
          <label class="switch-line"><input id="memoryEnabled" type="checkbox"> 启用跨聊天记忆</label>
          <label class="switch-line"><input id="useServerProxy" type="checkbox"> 走本站后端代理 /api/chat</label>
          <div class="field"><label>个性化 Prompt / 人格设定</label><textarea id="personalPrompt" placeholder="比如：回复短一点，更像微信聊天，不要废话。"></textarea></div>
          <div class="field"><label>系统 Prompt</label><textarea id="systemPrompt" placeholder="给模型的底层规则。"></textarea></div>
          <div class="field"><label>跨聊天记忆</label><textarea id="memoryText" placeholder="这里写长期记忆。每个新对话都会带上它。"></textarea></div>
          <div class="hint">文件上传：文本类文件会直接塞进上下文；图片会用 vision 格式发送。DeepSeek deepseek-chat 通常不能看图，想读图片请切到支持视觉的模型。PDF/DOCX 目前只显示附件信息，不做正文解析。</div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    function toast(text){ const s=$('#status'); if(!s)return; s.textContent=text; s.classList.add('show'); clearTimeout(toast.t); toast.t=setTimeout(()=>s.classList.remove('show'),1800); }
    function pickEmptyPrompt(){ const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate(); return emptyPrompts[seed % emptyPrompts.length]; }
    function formatBytes(n){ n=Number(n)||0; if(n<1024) return n+' B'; if(n<1048576) return (n/1024).toFixed(1)+' KB'; return (n/1048576).toFixed(1)+' MB'; }
    function slimAttachment(a){
      if(!a || typeof a !== 'object') return null;
      return {name:String(a.name||'附件'), type:String(a.type||''), size:Number(a.size)||0, kind:String(a.kind||'file'), text:a.text?String(a.text).slice(0,60000):'', dataUrl:a.dataUrl?String(a.dataUrl):''};
    }

    function renderRich(s){
      const raw = String(s || '');
      if(!raw) return '';
      const parts = raw.split(/```/g);
      return parts.map(function(part, i){
        if(i % 2 === 1){
          const cut = part.replace(/^\w+\n/, '');
          return '<pre><code>' + escapeHTML(cut) + '</code></pre>';
        }
        return '<p>' + escapeHTML(part).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\n{2,}/g,'</p><p>').replace(/\n/g,'<br>') + '</p>';
      }).join('');
    }
    function renderAttachmentList(list){
      if(!Array.isArray(list) || !list.length) return '';
      return '<div class="attachments">' + list.map(function(a){
        const img = a.kind === 'image' && a.dataUrl ? '<img src="'+escapeHTML(a.dataUrl)+'" alt="">' : '<span>📎</span>';
        return '<div class="attachment-card">'+img+'<div><div class="name">'+escapeHTML(a.name)+'</div><div>'+escapeHTML(formatBytes(a.size))+'</div></div></div>';
      }).join('') + '</div>';
    }
    function renderPendingFiles(){
      const tray = $('#fileTray'); if(!tray) return;
      tray.innerHTML = pendingFiles.map(function(f, i){
        const img = f.kind === 'image' && f.dataUrl ? '<img src="'+escapeHTML(f.dataUrl)+'" alt="">' : '<span>📎</span>';
        return '<div class="file-chip">'+img+'<span>'+escapeHTML(f.name)+'</span><button data-file-remove="'+i+'">×</button></div>';
      }).join('');
    }

    function renderSidebar(){
      const side = $('#sidebar'); if(!side) return;
      side.classList.toggle('closed', !sidebarOpen);
      $('#openSide').style.display = sidebarOpen ? 'none' : 'grid';
      const list = $('#chatList');
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span><button class="delete-chat" data-del="${escapeHTML(c.id)}" title="删除">×</button></div>`).join('');
    }
    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><svg class="empty-logo empty-logo-gamma" viewBox="0 0 120 120" aria-hidden="true"><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(function(m){
        const pending = m.role === 'assistant' && m.pending && !m.content;
        const body = pending ? '<span class="thinking">想一下 <i></i><i></i><i></i></span>' : renderRich(m.content);
        return '<div class="message '+(m.role==='user'?'user':'assistant')+'"><div class="bubble">'+body+renderAttachmentList(m.attachments)+'</div></div>';
      }).join('');
      box.scrollTop = box.scrollHeight;
    }
    function renderAll(){
      document.documentElement.setAttribute('data-theme', theme);
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      const themeBtn = $('#themeBtn'); if(themeBtn) themeBtn.textContent = theme === 'dark' ? '☾' : '☀';
      const memoryBtn = $('#memoryBtn'); if(memoryBtn){ memoryBtn.classList.toggle('active', !!settings.memoryEnabled); memoryBtn.textContent = settings.memoryEnabled ? '● 跨聊天记忆' : '○ 跨聊天记忆'; }
      renderSidebar(); renderMessages(); renderPendingFiles(); persist();
    }

    function createChat(){ const id=uid(); chats.unshift({id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; sidebarOpen=true; renderAll(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      renderAll(); toast('已删除');
    }

    function isTextFile(file){
      const name = (file.name || '').toLowerCase();
      return /^text\//.test(file.type || '') || /\.(txt|md|markdown|json|js|css|html|xml|csv|log|py|java|c|cpp|h|ts|tsx|jsx|vue|yml|yaml)$/i.test(name);
    }
    function readAsDataURL(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=reject; r.readAsDataURL(file); }); }
    function readAsText(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(String(r.result||'')); r.onerror=reject; r.readAsText(file); }); }
    async function addFiles(fileList){
      const files = Array.from(fileList || []);
      if(!files.length) return;
      for(const file of files){
        if(pendingFiles.length >= 8){ toast('最多 8 个附件'); break; }
        if(file.size > 8 * 1024 * 1024){ toast(file.name + ' 太大'); continue; }
        try{
          if((file.type || '').startsWith('image/')){
            const dataUrl = await readAsDataURL(file);
            pendingFiles.push({kind:'image', name:file.name, type:file.type, size:file.size, dataUrl});
          }else if(isTextFile(file)){
            const text = await readAsText(file);
            pendingFiles.push({kind:'text', name:file.name, type:file.type, size:file.size, text:text.slice(0,60000)});
          }else{
            pendingFiles.push({kind:'file', name:file.name, type:file.type, size:file.size, text:''});
          }
        }catch(_e){ toast(file.name + ' 读取失败'); }
      }
      renderPendingFiles();
    }

    function autoMemoryFromText(text){
      const t = String(text || '').trim();
      const patterns = [/^记住[:：]\s*(.+)$/i,/^remember[:：]\s*(.+)$/i,/^加入记忆[:：]\s*(.+)$/i,/^存到记忆[:：]\s*(.+)$/i];
      for(const p of patterns){ const m = t.match(p); if(m && m[1]) return appendMemory(m[1]); }
      return false;
    }
    function buildSystemMessages(){
      const blocks = [];
      const memory = getMemory();
      if(settings.systemPrompt && settings.systemPrompt.trim()) blocks.push(settings.systemPrompt.trim());
      if(settings.personalPrompt && settings.personalPrompt.trim()) blocks.push('个性化要求：\n' + settings.personalPrompt.trim());
      if(settings.memoryEnabled && memory.trim()) blocks.push('以下是跨聊天长期记忆，回答时默认参考：\n' + memory.trim());
      if(!blocks.length) return [];
      return [{role:'system', content:blocks.join('\n\n---\n\n')}];
    }
    function buildRequestMessages(chatMessages){
      const max = Math.max(2, Number(settings.contextMessages) || 24);
      const recent = chatMessages.slice(-max).map(toApiMessage).filter(Boolean);
      return buildSystemMessages().concat(recent);
    }
    function toApiMessage(m){
      if(!m || m.pending) return null;
      if(m.role === 'assistant') return {role:'assistant', content:m.content || ''};
      const attachments = Array.isArray(m.attachments) ? m.attachments : [];
      const images = attachments.filter(a=>a.kind==='image' && a.dataUrl);
      const textFiles = attachments.filter(a=>a.kind==='text' && a.text);
      const otherFiles = attachments.filter(a=>a.kind==='file');
      let text = m.content || '';
      textFiles.forEach(function(f){ text += '\n\n[文件：'+f.name+'，'+formatBytes(f.size)+']\n' + f.text; });
      otherFiles.forEach(function(f){ text += '\n\n[附件：'+f.name+'，'+formatBytes(f.size)+'。当前版本未解析该文件正文。]'; });
      if(images.length){
        const content = [{type:'text', text:text || '请看图片。'}].concat(images.map(function(img){ return {type:'image_url', image_url:{url:img.dataUrl}}; }));
        return {role:'user', content};
      }
      return {role:'user', content:text};
    }
    function clientSettings(){
      const num = v => { const n = Number(v); return Number.isFinite(n) ? n : undefined; };
      const out = Object.assign({}, settings);
      out.temperature = num(settings.temperature);
      out.top_p = num(settings.top_p);
      out.max_tokens = num(settings.max_tokens);
      return out;
    }
    function buildDirectURL(){
      const base=(settings.baseUrl||'').replace(/\/$/,''); const p=settings.path||'/v1/chat/completions';
      if(!base) return '/v1/chat/completions';
      if(base.endsWith('/v1') && p.startsWith('/v1/')) return base + p.slice(3);
      return base + (p.startsWith('/') ? p : '/' + p);
    }
    function extractDelta(data){
      const choice = data && data.choices && data.choices[0];
      if(choice && choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
      if(choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
      if(data && Array.isArray(data.content)) return data.content.map(part=>part && part.text ? part.text : '').join('');
      if(data && data.candidates && data.candidates[0] && data.candidates[0].content) return (data.candidates[0].content.parts || []).map(p=>p.text||'').join('');
      return '';
    }
    function extractFullContent(data){
      return data?.choices?.[0]?.message?.content || data?.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') || data?.content?.[0]?.text || '';
    }

    async function callModel(messages, onDelta){
      const body = {messages, settings:clientSettings(), stream:true, web_search:searchOn};
      const headers = {'Content-Type':'application/json'};
      let url = '/api/chat';
      if(!settings.useServerProxy){
        url = buildDirectURL();
        body.model = settings.model || 'deepseek-chat';
        body.messages = messages;
        body.stream = true;
        body.temperature = Number(settings.temperature);
        body.top_p = Number(settings.top_p);
        if(Number(settings.max_tokens) > 0) body.max_tokens = Number(settings.max_tokens);
        delete body.settings;
        if(settings.apiKey) headers.Authorization = 'Bearer ' + settings.apiKey;
      }
      const res = await fetch(url,{method:'POST',headers,body:JSON.stringify(body)});
      if(!res.ok){ const txt=await res.text(); throw new Error(txt.slice(0,600)||('HTTP '+res.status)); }
      if(!res.body){ const txt=await res.text(); try{ return extractFullContent(JSON.parse(txt)) || txt; }catch(_e){ return txt; } }

      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let buffer=''; let raw=''; let full='';
      function consumeLine(line){
        const trimmed=line.trim(); if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        const payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{ const data=JSON.parse(payload); const delta=extractDelta(data); if(delta){ full += delta; if(onDelta) onDelta(delta, full); } }catch(_e){}
        return false;
      }
      while(true){
        const read=await reader.read(); if(read.done) break;
        const chunk=decoder.decode(read.value,{stream:true}); raw += chunk; buffer += chunk;
        let index; while((index=buffer.indexOf('\n'))>=0){ const line=buffer.slice(0,index); buffer=buffer.slice(index+1); if(consumeLine(line)) return full; }
      }
      buffer += decoder.decode(); if(buffer.trim()) consumeLine(buffer);
      if(full) return full;
      try{ const data=JSON.parse(raw); return extractFullContent(data) || JSON.stringify(data).slice(0,1200); }catch(_e){ return raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(); }
    }

    async function sendMessage(){
      if(sending) return;
      const input=$('#input'); const text=(input.value||'').trim();
      if(!text && !pendingFiles.length) return;
      autoMemoryFromText(text);
      const c=activeChat();
      const attachments = pendingFiles.map(slimAttachment).filter(Boolean);
      c.messages.push({role:'user', content:text, attachments});
      if(!c.title || c.title==='新对话') c.title=(text || (attachments[0] && attachments[0].name) || '新对话').slice(0,28);
      c.updatedAt=Date.now();
      input.value=''; pendingFiles=[]; sending=true; $('#sendBtn').disabled=true;
      const requestMessages = buildRequestMessages(c.messages);
      const assistant={role:'assistant',content:'',pending:true,attachments:[]};
      c.messages.push(assistant);
      renderAll();
      try{
        const finalText=await callModel(requestMessages, function(delta){ assistant.pending=false; assistant.content += delta; c.updatedAt=Date.now(); renderMessages(); });
        assistant.pending=false;
        if(!assistant.content.trim()) assistant.content=finalText || '没有返回内容';
      }catch(err){
        assistant.pending=false;
        assistant.content='请求失败：'+(err&&err.message?err.message:String(err));
      }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); renderAll();
    }

    function openSettings(){
      $('#providerType').value=settings.providerType||'openai'; $('#providerName').value=settings.providerName||''; $('#baseUrl').value=settings.baseUrl||''; $('#apiKey').value=settings.apiKey||''; $('#model').value=settings.model||''; $('#path').value=settings.path||'/v1/chat/completions';
      $('#temperature').value=settings.temperature ?? 0.7; $('#topP').value=settings.top_p ?? 0.9; $('#maxTokens').value=settings.max_tokens ?? 0; $('#contextMessages').value=settings.contextMessages ?? 24;
      $('#memoryEnabled').checked=!!settings.memoryEnabled; $('#useServerProxy').checked=settings.useServerProxy !== false;
      $('#personalPrompt').value=settings.personalPrompt||''; $('#systemPrompt').value=settings.systemPrompt||''; $('#memoryText').value=getMemory();
      $('#providerModal').classList.add('show');
    }
    function closeSettings(){ $('#providerModal').classList.remove('show'); }
    function saveSettings(){
      settings={
        providerType:$('#providerType').value, providerName:$('#providerName').value.trim(), baseUrl:$('#baseUrl').value.trim(), apiKey:$('#apiKey').value.trim(), model:$('#model').value.trim(), path:$('#path').value.trim()||'/v1/chat/completions',
        temperature:Number($('#temperature').value || 0.7), top_p:Number($('#topP').value || 0.9), max_tokens:Number($('#maxTokens').value || 0), contextMessages:Number($('#contextMessages').value || 24),
        memoryEnabled:$('#memoryEnabled').checked, useServerProxy:$('#useServerProxy').checked,
        personalPrompt:$('#personalPrompt').value.trim(), systemPrompt:$('#systemPrompt').value.trim()
      };
      setMemory($('#memoryText').value); persist(); closeSettings(); renderAll(); toast('已保存');
    }

    document.addEventListener('click', e=>{
      const remove=e.target.closest('[data-file-remove]'); if(remove){ pendingFiles.splice(Number(remove.getAttribute('data-file-remove')),1); renderPendingFiles(); return; }
      const del=e.target.closest('[data-del]'); if(del){ e.stopPropagation(); deleteChat(del.getAttribute('data-del')); return; }
      const item=e.target.closest('.chat-item'); if(item){ activeId=item.getAttribute('data-id'); if(window.innerWidth<760) sidebarOpen=false; renderAll(); }
    });
    $('#closeSide').onclick=()=>{sidebarOpen=false;renderAll();};
    $('#openSide').onclick=()=>{sidebarOpen=true;renderAll();};
    $('#newChat').onclick=createChat;
    $('#themeBtn').onclick=()=>{theme=theme==='dark'?'light':'dark';renderAll();};
    $('#quickMemory').onclick=openSettings;
    $('#openProvider').onclick=openSettings; $('#closeProvider').onclick=closeSettings; $('#cancelProvider').onclick=closeSettings; $('#saveProvider').onclick=saveSettings;
    $('#searchBtn').onclick=()=>{searchOn=!searchOn; $('#searchBtn').classList.toggle('active',searchOn); $('#searchBtn').textContent=searchOn?'● 联网搜索':'○ 联网搜索';};
    $('#memoryBtn').onclick=()=>{settings.memoryEnabled=!settings.memoryEnabled; persist(); renderAll();};
    $('#sendBtn').onclick=sendMessage;
    $('#uploadBtn').onclick=()=>$('#fileInput').click();
    $('#fileInput').onchange=e=>{ addFiles(e.target.files); e.target.value=''; };
    $('#clearFiles').onclick=()=>{pendingFiles=[];renderPendingFiles();};
    $('#input').addEventListener('keydown', e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); sendMessage(); } });
    $('#providerType').addEventListener('change', e=>{ const v=e.target.value; if(v==='openai'){ $('#path').value='/v1/chat/completions'; if(!$('#baseUrl').value) $('#baseUrl').value='https://api.deepseek.com'; } });

    function setupMobileViewport(){
      try{
        const root = document.documentElement; const input = $('#input'); const messagesBox = $('#messages'); if(!root || !input || !messagesBox) return;
        let timer = null;
        function isMobile(){ return (window.innerWidth || document.documentElement.clientWidth || 9999) <= 900; }
        function scrollLatest(){ requestAnimationFrame(()=>{try{messagesBox.scrollTop = messagesBox.scrollHeight;}catch(_e){}}); setTimeout(()=>{try{messagesBox.scrollTop = messagesBox.scrollHeight;}catch(_e){}},120); }
        function applyViewport(){
          if(!isMobile()){ document.body.classList.remove('keyboard-open'); root.style.removeProperty('--app-height'); return; }
          const vv = window.visualViewport; const h = vv && vv.height ? vv.height : window.innerHeight;
          root.style.setProperty('--app-height', Math.max(320, Math.round(h)) + 'px');
          const focused = document.activeElement === input;
          document.body.classList.toggle('keyboard-open', focused);
          if(focused){ if(sidebarOpen){ sidebarOpen=false; renderSidebar(); } scrollLatest(); }
        }
        function schedule(delay){ clearTimeout(timer); timer = setTimeout(applyViewport, delay || 30); }
        input.addEventListener('focus', function(){ schedule(0); setTimeout(applyViewport,120); setTimeout(applyViewport,320); });
        input.addEventListener('blur', function(){ setTimeout(function(){ document.body.classList.remove('keyboard-open'); applyViewport(); },160); });
        input.addEventListener('input', function(){ schedule(20); scrollLatest(); });
        window.addEventListener('resize', function(){ schedule(20); }, {passive:true});
        window.addEventListener('orientationchange', function(){ setTimeout(applyViewport,260); }, {passive:true});
        if(window.visualViewport){ window.visualViewport.addEventListener('resize', function(){ schedule(20); }, {passive:true}); window.visualViewport.addEventListener('scroll', function(){ schedule(20); }, {passive:true}); }
        applyViewport();
      }catch(_err){}
    }

    renderAll();
    setupMobileViewport();
  }catch(err){ emergency(err && err.stack ? err.stack : err); }
})();
