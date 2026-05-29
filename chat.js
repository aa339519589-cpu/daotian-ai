'use strict';

/* ==============================================================
   chat.js — 聊天核心模块
   从 app.js 提取，包含 Markdown渲染、聊天UI、消息发送、
   流式响应处理、侧栏管理、记忆自动提取等
   依赖 globals / tts / upload / ui / memory / settings
   ============================================================== */

    app.innerHTML = `
      <div class="app-shell" data-theme="${theme}">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-top"><button class="icon-btn" id="closeSide" title="收起">☰</button><span class="sidebar-label">历史对话</span></div>
          <div class="chat-list" id="chatList"></div>
      <div class="sidebar-bottom"><button class="side-bottom-btn settings-only" id="openSettingsBtn">设置</button></div>
        </aside>
        <main class="main">
          <div class="chat-topbar" id="chatTopbar">
            <button class="home-menu-button" id="openSide" title="展开侧边栏"><span></span><span></span><span></span></button>
            <button class="model-top-trigger" id="modelTopTrigger" title="切换模型"><span id="modelTopLabel">...</span><span class="chevron">▾</span></button>
            <div class="model-popover" id="modelPopover"></div>
            <button class="top-new-chat-btn" id="topNewChatBtn" title="新建对话"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          </div>
          <div class="messages" id="messages"></div>
          <div class="composer-wrap">
            <div class="composer">
              <button class="plus-btn" id="plusBtn" title="添加附件">+</button>
              <textarea id="input" placeholder="输入消息..."></textarea>
              <button class="send" id="sendBtn">›</button>
            </div>
            <div class="attach-preview" id="attachPreview" style="display:none"></div>
          </div>
          <div class="plus-menu" id="plusMenu" style="display:none">
            <button class="plus-menu-item" data-action="camera"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/><circle cx="12" cy="13" r="4"/></svg>拍照</button>
            <button class="plus-menu-item" data-action="image"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>添加图片</button>
            <button class="plus-menu-item" data-action="file"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>添加文件</button>
            <button class="plus-menu-item" data-action="search"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><ellipse cx="12" cy="12" rx="4" ry="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg><span>联网</span><span class="search-capsule" id="searchCapsule"><span class="search-capsule-knob"></span></span></button>
          </div>
          <input type="file" id="cameraInput" accept="image/*" capture="environment" style="display:none">
          <input type="file" id="imageInput" accept="image/*" style="display:none">
          <input type="file" id="fileInput" style="display:none">
        </main>
      </div>
      <div class="modal-backdrop" id="providerModal"><div class="modal">
        <div class="modal-head"><span>设置 / 模型提供方</span><button class="icon-btn" id="closeProvider">×</button></div>
        <div class="modal-body">
          <div class="hint">可以保存多个模型提供方；每个提供方下面可以填多个模型。聊天页点"模型"就能切换，下一条消息立即使用选中的模型。</div>
          <div id="presetList" class="preset-list"></div>
          <button class="btn" id="addPreset" type="button">＋ 添加提供方</button>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelProvider">取消</button><button class="btn primary" id="saveProvider">保存</button></div>
      </div></div>
      <div class="modal-backdrop" id="settingsModal"><div class="settings-shell" id="settingsShell">
        <div class="settings-header">
          <button class="settings-back-btn" id="settingsBackBtn" style="display:none"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>
          <span class="settings-title" id="settingsTitle">设置</span>
          <button class="settings-close-btn" id="settingsCloseBtn"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        </div>
        <div class="settings-body" id="settingsBody"></div>
      </div></div>
      <div class="modal-backdrop" id="memoryEditModal"><div class="modal" style="max-width:520px">
        <div class="modal-head"><span id="memoryEditTitle">编辑记忆</span><button class="icon-btn" id="closeMemoryEdit">×</button></div>
        <div class="modal-body">
          <div class="field"><label>记忆内容</label><textarea id="memoryEditContent" rows="4" style="resize:vertical;min-height:80px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:10px 14px;outline:0;font:inherit;width:100%"></textarea></div>
          <div class="field"><label>标签（逗号分隔）</label><input id="memoryEditTags" placeholder="学习, 项目, 偏好, 生活, 人格" style="height:46px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.28);padding:0 14px;outline:0;font:inherit;width:100%"></div>
        </div>
        <div class="modal-foot"><button class="btn" id="cancelMemoryEdit">取消</button><button class="btn primary" id="saveMemoryEdit">保存</button></div>
      </div></div>
      <div class="status" id="status"></div>`;

    function escapeHTML(s){ return String(s).replace(/[&<>"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch])); }

    function escapeAttr(s){ return String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])); }

    function ensureRenderStyle(){
      if(document.getElementById('daotianRenderStyle')) return;
      const style=document.createElement('style');
      style.id='daotianRenderStyle';
      style.textContent = `
        .assistant-render{max-width:min(720px,88%);padding:2px 2px;line-height:1.65;font-size:1rem;font-weight:400;color:var(--text);background:transparent;border:0;box-shadow:none;word-break:break-word;overflow-wrap:anywhere;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
        .assistant-render p{margin:.4em 0 .65em;}
        .assistant-render p:last-child{margin-bottom:0;}
        .assistant-render h1,.assistant-render h2,.assistant-render h3{margin:1em 0 .45em;line-height:1.25;font-weight:650;letter-spacing:-0.015em;}
        .assistant-render h1{font-size:1.22em}.assistant-render h2{font-size:1.12em}.assistant-render h3{font-size:1.05em}
        .assistant-render ul,.assistant-render ol{margin:.45em 0 .8em;padding-left:1.35em;}
        .assistant-render li{margin:.18em 0;}
        .assistant-render blockquote{margin:.65em 0;padding:.2em .9em;border-left:3px solid rgba(127,127,127,.32);color:var(--muted);}
        .assistant-render code{font-family:var(--font-mono);font-size:.92em;background:rgba(127,127,127,.12);border-radius:6px;padding:.08em .32em;}
        .assistant-render pre{margin:.7em 0;padding:12px 13px;border-radius:14px;background:rgba(127,127,127,.10);border:1px solid rgba(127,127,127,.14);overflow:auto;-webkit-overflow-scrolling:touch;white-space:pre;}
        .assistant-render pre code{background:transparent;padding:0;border-radius:0;white-space:pre;}
        .assistant-render hr{border:0;height:1px;background:var(--line);margin:1em 0;opacity:.6}
        .assistant-render a{color:inherit;text-decoration:underline;text-underline-offset:3px;}
        .assistant-render table{border-collapse:collapse;margin:.7em 0;display:block;overflow:auto;max-width:100%;}
        .assistant-render th,.assistant-render td{border:1px solid rgba(127,127,127,.22);padding:6px 9px;}
        .assistant-render .math-block{overflow-x:auto;overflow-y:hidden;margin:.7em 0;padding:.15em 0;}
        .assistant-render .html-preview-frame{width:100%;min-height:240px;border:1px solid rgba(127,127,127,.18);border-radius:14px;background:white;margin:.55em 0;}
        .assistant-render details{margin:.55em 0;}
        .assistant-render summary{cursor:pointer;color:var(--muted);font-size:13px;margin-bottom:.35em;}
        .assistant-render .mermaid{background:rgba(255,255,255,.04);border-radius:14px;padding:12px;overflow:auto;}
        @media (max-width:760px){.assistant-render{max-width:calc(100vw - 36px);font-size:1rem}.assistant-render .html-preview-frame{min-height:210px}}
      `;
      document.head.appendChild(style);
    }

    /* ── Markdown Rendering System ── */
    var _md = null;
    function getMd(){
      if(_md) return _md;
      if(typeof window.markdownit === 'function'){
        _md = window.markdownit({ html:false, linkify:true, breaks:false, typographer:false });
        /* disable default HTML rendering */
        _md.renderer.rules.html_block = function(){ return ''; };
        _md.renderer.rules.html_inline = function(){ return ''; };
        /* code fence → use highlight.js if available */
        _md.renderer.rules.fence = function(tokens, idx){
          var token = tokens[idx];
          var lang = (token.info || '').trim().toLowerCase();
          var code = token.content;
          var safe = escapeHTML(code);
          var langLabel = lang || 'text';
          if(!lang) langLabel = 'text';
          if(typeof hljs !== 'undefined' && hljs.getLanguage && hljs.getLanguage(lang)){
            try{ safe = hljs.highlight(code, {language:lang, ignoreIllegals:true}).value; }catch(_e){}
          }
          return '<div class="code-block" data-lang="'+escapeAttr(langLabel)+'">'+
            '<div class="code-head"><span class="code-lang">'+escapeAttr(langLabel)+'</span>'+
            '<button class="code-copy-btn" data-code="'+escapeAttr(code)+'">复制</button></div>'+
            '<pre><code class="language-'+escapeAttr(langLabel)+'">'+safe+'</code></pre></div>';
        };
        return _md;
      }
      return null;
    }

    function protectMath(text){
      var placeholders = [];
      var idx = 0;
      /* protect $$...$$ and \[...\] */
      text = text.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, function(m, open, body, close){
        var ph = ' MATHBLOCK'+idx+' ';
        placeholders.push(m);
        idx++;
        return ph;
      });
      /* protect \(...\) and $...$ (inline) */
      text = text.replace(/(\\\(|\$)([^\n$]+?)(\\\)|\$)/g, function(m, open, body, close){
        if(open === '$' && close === '$' && m.indexOf('$$')===0) return m; /* skip display */
        var ph = 'MATHINLINE'+idx+'';
        placeholders.push(m);
        idx++;
        return ph;
      });
      return {text:text, placeholders:placeholders};
    }
    function restoreMath(html, placeholders){
      for(var i=0;i<placeholders.length;i++){
        html = html.replace(' MATHBLOCK'+i+' ', placeholders[i]);
        html = html.replace('MATHINLINE'+i+'', placeholders[i]);
      }
      return html;
    }

    function wrapArtifactCards(container){
      /* Wrap tables */
      var tables = container.querySelectorAll('table');
      for(var ti=0;ti<tables.length;ti++){
        var tbl = tables[ti];
        if(tbl.closest('.artifact-card')) continue;
        var wrap = document.createElement('div'); wrap.className = 'artifact-card';
        var head = '<div class="artifact-head"><span class="artifact-title">表格</span>'+
          '<div class="artifact-actions">'+
          '<button data-artifact-action="copy">复制</button>'+
          '<button data-artifact-action="download">CSV</button>'+
          '<button data-artifact-action="fullscreen">全屏</button>'+
          '</div></div>';
        var body = document.createElement('div'); body.className = 'artifact-body';
        var tblWrap = document.createElement('div'); tblWrap.className = 'markdown-table-wrap';
        tbl.parentNode.insertBefore(wrap, tbl);
        wrap.innerHTML = head;
        wrap.appendChild(body);
        tblWrap.appendChild(tbl);
        body.appendChild(tblWrap);
        wrap.setAttribute('data-artifact-id', 'tbl_'+Date.now()+'_'+ti);
      }
      /* Wrap code blocks into code cards */
      var codeBlocks = container.querySelectorAll('.code-block');
      for(var ci=0;ci<codeBlocks.length;ci++){
        var cb = codeBlocks[ci];
        if(cb.closest('.artifact-card')) continue;
        var lang = cb.getAttribute('data-lang') || 'text';
        var codeEl = cb.querySelector('code');
        var rawCode = codeEl ? (codeEl.textContent||'') : '';
        var wrap = document.createElement('div'); wrap.className = 'artifact-card';
        wrap.setAttribute('data-artifact-id', 'code_'+Date.now()+'_'+ci);
        var extMap = {js:'.js',ts:'.ts',python:'.py',py:'.py',html:'.html',css:'.css',json:'.json',svg:'.svg',md:'.md'};
        var ext = extMap[lang] || '.txt';
        var head = '<div class="artifact-head"><span class="artifact-title">代码 '+escapeHTML(lang)+'</span>'+
          '<div class="artifact-actions">'+
          '<button data-artifact-action="copy" data-code="'+escapeAttr(rawCode)+'">复制</button>'+
          '<button data-artifact-action="download" data-ext="'+ext+'" data-code="'+escapeAttr(rawCode)+'">下载</button>'+
          '<button data-artifact-action="fullscreen">全屏</button>'+
          '</div></div>';
        var body = document.createElement('div'); body.className = 'artifact-body';
        cb.parentNode.insertBefore(wrap, cb);
        wrap.innerHTML = head;
        wrap.appendChild(body);
        body.appendChild(cb);
      }
      /* Wrap mermaid blocks */
      var mermaids = container.querySelectorAll('.mermaid');
      for(var mi=0;mi<mermaids.length;mi++){
        var mm = mermaids[mi];
        if(mm.closest('.artifact-card')) continue;
        var rawMmd = mm.textContent || '';
        var wrap = document.createElement('div'); wrap.className = 'artifact-card';
        wrap.setAttribute('data-artifact-id', 'mermaid_'+Date.now()+'_'+mi);
        var head = '<div class="artifact-head"><span class="artifact-title">图表</span>'+
          '<div class="artifact-actions">'+
          '<button data-artifact-action="fullscreen">全屏</button>'+
          '</div></div>'+
          '<div class="artifact-tabs">'+
          '<button class="active" data-artifact-tab="preview" data-target="mermaid">图表</button>'+
          '<button data-artifact-tab="code" data-target="mermaid">代码</button>'+
          '</div>';
        wrap.innerHTML = head;
        var body = document.createElement('div'); body.className = 'artifact-body';
        var previewDiv = document.createElement('div'); previewDiv.appendChild(mm.cloneNode(true));
        body.appendChild(previewDiv);
        var codeDiv = document.createElement('div'); codeDiv.style.display = 'none';
        codeDiv.innerHTML = '<pre><code>'+escapeHTML(rawMmd)+'</code></pre>';
        body.appendChild(codeDiv);
        mm.parentNode.insertBefore(wrap, mm);
        wrap.appendChild(body);
      }
      /* Wrap HTML/SVG preview iframes */
      var htmlPreviews = container.querySelectorAll('.html-preview-frame');
      for(var hi=0;hi<htmlPreviews.length;hi++){
        var hp = htmlPreviews[hi];
        if(hp.closest('.artifact-card')) continue;
        var details = hp.nextElementSibling;
        var rawSrc = '';
        if(details && details.tagName==='DETAILS'){
          var codeIn = details.querySelector('code');
          if(codeIn) rawSrc = codeIn.textContent || '';
          details.parentNode.removeChild(details);
        }
        var wrap = document.createElement('div'); wrap.className = 'artifact-card';
        wrap.setAttribute('data-artifact-id', 'html_'+Date.now()+'_'+hi);
        var head = '<div class="artifact-head"><span class="artifact-title">HTML/SVG 预览</span>'+
          '<div class="artifact-actions">'+
          '<button data-artifact-action="fullscreen">全屏</button>'+
          '</div></div>'+
          '<div class="artifact-tabs">'+
          '<button class="active" data-artifact-tab="preview" data-target="html">预览</button>'+
          '<button data-artifact-tab="code" data-target="html">代码</button>'+
          '</div>';
        wrap.innerHTML = head;
        var body = document.createElement('div'); body.className = 'artifact-body';
        var previewDiv2 = document.createElement('div'); previewDiv2.appendChild(hp.cloneNode(true));
        body.appendChild(previewDiv2);
        var codeDiv2 = document.createElement('div'); codeDiv2.style.display = 'none';
        codeDiv2.innerHTML = '<pre><code>'+escapeHTML(rawSrc)+'</code></pre>';
        body.appendChild(codeDiv2);
        hp.parentNode.insertBefore(wrap, hp);
        wrap.appendChild(body);
      }
    }

    function renderWithMarkdownIt(text){
      var md = getMd();
      if(!md) return renderLegacyAssistantContent(text);
      var mathProtected = protectMath(text);
      var html = md.render(mathProtected.text);
      html = restoreMath(html, mathProtected.placeholders);
      /* sanitize */
      if(typeof DOMPurify !== 'undefined'){
        html = DOMPurify.sanitize(html, {
          ALLOWED_TAGS:['p','br','strong','em','del','s','code','pre','blockquote','ul','ol','li','table','thead','tbody','tr','th','td','hr','h1','h2','h3','h4','h5','h6','a','span','div','details','summary','input','iframe','button','img'],
          ALLOWED_ATTR:['class','href','target','rel','title','data-lang','data-artifact-id','data-artifact-action','data-artifact-tab','data-target','data-code','data-ext','checked','disabled','type','sandbox','srcdoc','allow','loading','src','alt','id']
        });
      }
      /* fix links: add target rel */
      html = html.replace(/<a /g, '<a target="_blank" rel="noopener noreferrer" ');
      /* convert task list items */
      html = html.replace(/<li>\[ \]\s*/g, '<li class="task-list-item"><input type="checkbox" disabled> ');
      html = html.replace(/<li>\[[xX]\]\s*/g, '<li class="task-list-item"><input type="checkbox" checked disabled> ');
      /* table wrapper for mobile scroll */
      html = html.replace(/(<table[\s\S]*?<\/table>)/g, '<div class="markdown-table-wrap">$1</div>');
      /* Post-process: artifact cards */
      var tmp = document.createElement('div');
      tmp.innerHTML = html;
      wrapArtifactCards(tmp);
      return tmp.innerHTML;
    }

    function renderLegacyAssistantContent(raw){
      var text = String(raw || '');
      var re = /```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```/g;
      var out = ''; var last = 0; var match;
      while((match = re.exec(text))){
        out += renderMarkdownText(text.slice(last, match.index));
        var lang2 = (match[1]||'').trim().toLowerCase();
        var code2 = match[2]||'';
        var safeCode2 = escapeHTML(code2);
        if(lang2==='mermaid'){
          out += '<pre class="mermaid">'+safeCode2+'</pre>';
        }else if(lang2==='html'||lang2==='svg'){
          var srcdoc3 = lang2==='svg'?'<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="margin:0;display:grid;place-items:center;min-height:100vh">'+code2+'</body>':code2;
          out += '<iframe class="html-preview-frame artifact-preview-frame" sandbox="allow-scripts" srcdoc="'+escapeAttr(srcdoc3)+'"></iframe>';
          out += '<details><summary>源码</summary><pre><code class="language-'+escapeAttr(lang2)+'">'+safeCode2+'</code></pre></details>';
        }else{
          out += '<div class="code-block" data-lang="'+(lang2||'text')+'"><div class="code-head"><span class="code-lang">'+(lang2||'text')+'</span><button class="code-copy-btn" data-code="'+escapeAttr(code2)+'">复制</button></div><pre><code>'+safeCode2+'</code></pre></div>';
        }
        last = re.lastIndex;
      }
      out += renderMarkdownText(text.slice(last));
      out = out.replace(/<p>\s*\$\$([\s\S]*?)\$\$\s*<\/p>/g, '<div class="math-block">$$$1$$</div>');
      return out||'';
    }

    function renderInlineMarkdown(text){
      var html = escapeHTML(text);
      html = html.replace(/`([^`]+)`/g,function(_m,code){return '<code>'+code+'</code>';});
      html = html.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
      html = html.replace(/__([^_]+)__/g,'<strong>$1</strong>');
      html = html.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
      html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
      return html;
    }

    function renderMarkdownText(text){
      var lines = String(text||'').split('\n');
      var out=''; var list=null; var para=[];
      function flushPara(){
        if(para.length){
          out += '<p>'+renderInlineMarkdown(para.join('\n')).replace(/\n/g,'<br>')+'</p>';
          para=[];
        }
      }
      function closeList(){ if(list){ out+='</'+list+'>'; list=null; } }
      /* detect table */
      var isTable = false; var tableRows = [];
      for(var li=0;li<lines.length;li++){
        var l = lines[li];
        if(l.indexOf('|')>=0 && /^\s*\|?[\s\S]*?\|\s*$/.test(l)){
          if(!isTable){ flushPara(); closeList(); isTable=true; }
          tableRows.push(l);
        }else{
          if(isTable){
            isTable=false;
            if(tableRows.length>=2){
              out += buildTable(tableRows);
            }else{
              tableRows.forEach(function(tr){ out+='<p>'+renderInlineMarkdown(tr)+'</p>'; });
            }
            tableRows=[];
          }
          if(/^\s*$/.test(l)){ flushPara(); closeList(); continue; }
          if(/^\s{0,3}([-*_])\s*\1\s*\1[\s\1]*$/.test(l)){ flushPara(); closeList(); out+='<hr>'; continue; }
          var heading2 = l.match(/^(#{1,3})\s+(.+)$/);
          if(heading2){ flushPara(); closeList(); var lv=heading2[1].length; out+='<h'+lv+'>'+renderInlineMarkdown(heading2[2])+'</h'+lv+'>'; continue; }
          var quote2 = l.match(/^>\s?(.+)$/);
          if(quote2){ flushPara(); closeList(); out+='<blockquote>'+renderInlineMarkdown(quote2[1])+'</blockquote>'; continue; }
          var bullet2 = l.match(/^\s*[-*+]\s+(.+)$/);
          if(bullet2){ flushPara(); if(list!=='ul'){ closeList(); list='ul'; out+='<ul>'; } out+='<li>'+renderInlineMarkdown(bullet2[1])+'</li>'; continue; }
          var ordered2 = l.match(/^\s*\d+[.)]\s+(.+)$/);
          if(ordered2){ flushPara(); if(list!=='ol'){ closeList(); list='ol'; out+='<ol>'; } out+='<li>'+renderInlineMarkdown(ordered2[1])+'</li>'; continue; }
          closeList(); para.push(l);
        }
      }
      if(isTable&&tableRows.length>=2){ out+=buildTable(tableRows); tableRows=[]; }
      flushPara(); closeList();
      return out;
    }

    function buildTable(rows){
      if(rows.length<2) return renderMarkdownText(rows.join('\n'));
      var out = '<div class="markdown-table-wrap"><table><thead>';
      /* header */
      var hdr = rows[0].split('|').filter(function(c){return c.trim();});
      out += '<tr>';
      hdr.forEach(function(c){ out+='<th>'+renderInlineMarkdown(c.trim())+'</th>'; });
      out += '</tr></thead>';
      /* detect separator */
      var bodyStart = 1;
      if(/^[\s|:\-]+$/.test(rows[1].replace(/\|/g,'').trim())) bodyStart=2;
      out += '<tbody>';
      for(var ri=bodyStart;ri<rows.length;ri++){
        var cells = rows[ri].split('|').filter(function(c){return c.trim();});
        out += '<tr>';
        cells.forEach(function(c){ out+='<td>'+renderInlineMarkdown(c.trim())+'</td>'; });
        out += '</tr>';
      }
      out += '</tbody></table></div>';
      return out;
    }

    function renderAssistantContent(raw){
      ensureRenderStyle();
      var text = String(raw||'');
      /* Prefer markdown-it */
      if(typeof window.markdownit === 'function'){
        return renderWithMarkdownIt(text);
      }
      return renderLegacyAssistantContent(text);
    }

    var _fullscreenOverlay = null;
    function getFullscreenOverlay(){
      if(_fullscreenOverlay) return _fullscreenOverlay;
      var div = document.createElement('div');
      div.id = 'artifactFullscreen';
      div.className = 'artifact-fullscreen';
      div.innerHTML = '<div class="artifact-fullscreen-close">&times;</div><div class="artifact-fullscreen-body"></div>';
      div.addEventListener('click', function(e){
        if(e.target === div || e.target.classList.contains('artifact-fullscreen-close')) closeFullscreen();
      });
      document.body.appendChild(div);
      _fullscreenOverlay = div;
      return div;
    }
    function openFullscreen(content){
      var ov = getFullscreenOverlay();
      ov.querySelector('.artifact-fullscreen-body').innerHTML = content;
      ov.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    function closeFullscreen(){
      if(!_fullscreenOverlay) return;
      _fullscreenOverlay.classList.remove('open');
      document.body.style.overflow = '';
    }

    /* Event delegation for artifact actions */
    document.addEventListener('click', function(e){
      /* Copy */
      var copyBtn = e.target.closest('[data-artifact-action="copy"]');
      if(copyBtn){
        e.preventDefault(); e.stopPropagation();
        var code = copyBtn.getAttribute('data-code') || '';
        /* If no data-code, copy the closest code block or table content */
        if(!code){
          var card = copyBtn.closest('.artifact-card');
          if(card){
            var tblEl = card.querySelector('table');
            if(tblEl){
              var tsv = ''; var tableRows2 = tblEl.querySelectorAll('tr');
              tableRows2.forEach(function(tr){
                var cells = []; tr.querySelectorAll('th,td').forEach(function(td){ cells.push(td.textContent.trim()); });
                tsv += cells.join('\t')+'\n';
              });
              code = tsv;
            }else{
              var preEl = card.querySelector('pre code');
              if(preEl) code = preEl.textContent||'';
            }
          }
        }
        try{
          if(navigator.clipboard && navigator.clipboard.writeText){
            navigator.clipboard.writeText(code).then(function(){ toast('已复制'); }).catch(function(){ toast('复制失败'); });
          }else{
            var ta = document.createElement('textarea'); ta.value = code;
            ta.style.position='fixed';ta.style.opacity='0';
            document.body.appendChild(ta);ta.select();
            document.execCommand('copy');document.body.removeChild(ta);
            toast('已复制');
          }
        }catch(_e2){ toast('复制失败'); }
        return;
      }
      /* Download */
      var dloadBtn = e.target.closest('[data-artifact-action="download"]');
      if(dloadBtn){
        e.preventDefault(); e.stopPropagation();
        var dcode = dloadBtn.getAttribute('data-code') || '';
        var ext = dloadBtn.getAttribute('data-ext') || '.txt';
        if(!dcode){
          var card2 = dloadBtn.closest('.artifact-card');
          if(card2){
            var tblEl2 = card2.querySelector('table');
            if(tblEl2){
              var csv = ''; var rows3 = tblEl2.querySelectorAll('tr');
              rows3.forEach(function(tr){
                var cells = []; tr.querySelectorAll('th,td').forEach(function(td){ cells.push('"'+String(td.textContent).replace(/"/g,'""')+'"'); });
                csv += cells.join(',')+'\n';
              });
              dcode = csv; ext = '.csv';
            }else{
              var preEl2 = card2.querySelector('pre code');
              if(preEl2) dcode = preEl2.textContent||'';
            }
          }
        }
        var blob = new Blob([dcode], {type:'text/plain'});
        var url2 = URL.createObjectURL(blob);
        var a2 = document.createElement('a'); a2.href = url2; a2.download = 'download'+ext;
        a2.click(); URL.revokeObjectURL(url2); toast('已下载');
        return;
      }
      /* Fullscreen */
      var fsBtn = e.target.closest('[data-artifact-action="fullscreen"]');
      if(fsBtn){
        e.preventDefault(); e.stopPropagation();
        var card3 = fsBtn.closest('.artifact-card');
        if(!card3) return;
        var body3 = card3.querySelector('.artifact-body');
        if(body3) openFullscreen(body3.innerHTML);
        return;
      }
      /* Tab switch */
      var tabBtn = e.target.closest('[data-artifact-tab]');
      if(tabBtn){
        e.preventDefault(); e.stopPropagation();
        var card4 = tabBtn.closest('.artifact-card');
        if(!card4) return;
        var targetTab = tabBtn.getAttribute('data-artifact-tab');
        /* Update active tab button */
        card4.querySelectorAll('[data-artifact-tab]').forEach(function(b){ b.classList.remove('active'); });
        tabBtn.classList.add('active');
        /* Show/hide body children */
        var body4 = card4.querySelector('.artifact-body');
        if(!body4) return;
        var children = body4.children;
        if(targetTab==='preview'){
          for(var ci4=0;ci4<children.length;ci4++){
            if(ci4===0) children[ci4].style.display = '';
            else children[ci4].style.display = 'none';
          }
        }else if(targetTab==='code'){
          for(var ci42=0;ci42<children.length;ci42++){
            if(ci42===children.length-1) children[ci42].style.display = '';
            else children[ci42].style.display = 'none';
          }
        }
        return;
      }
    });

    /* Keyboard: ESC close fullscreen */
    document.addEventListener('keydown', function(e){
      if(e.key==='Escape' && _fullscreenOverlay && _fullscreenOverlay.classList.contains('open')){
        closeFullscreen();
      }
    });

    let enhanceTimer = null;
    function scheduleEnhanceRender(){
      /* skip during streaming — full render on completion */
      if(isStreamingNow()) return;
      clearTimeout(enhanceTimer);
      enhanceTimer = setTimeout(function(){
        const box = document.getElementById('messages');
        if(!box) return;
        try{
          if(window.MathJax && window.MathJax.typesetPromise){ window.MathJax.typesetPromise([box]).catch(function(){}); }
        }catch(_e){}
        try{
          if(window.mermaid && window.mermaid.run){
            var ms = box.querySelectorAll('.mermaid');
            if(ms.length) window.mermaid.run({nodes: ms}).catch(function(){});
          }
        }catch(_e){}
      }, 220);
    }

    function ensureThinkingStyle(){
      if(document.getElementById('daotianThinkingStyle')) return;
      const style=document.createElement('style');
      style.id='daotianThinkingStyle';
      style.textContent = '\
.daotian-thinking-message{justify-content:flex-start!important;max-width:100%!important;margin:0 auto 14px!important;display:flex!important;align-items:center!important}\
.daotian-thinking{display:inline-flex!important;align-items:center!important;gap:8px!important;padding:0!important;margin:0!important;background:transparent!important;border:0!important;box-shadow:none!important;color:var(--muted)!important;font-size:14px!important;line-height:1.5!important}\
.daotian-thinking-orbit{position:relative!important;width:18px!important;height:18px!important;min-width:18px!important;min-height:18px!important;flex:0 0 18px!important;background:transparent!important;overflow:visible!important}\
.daotian-thinking-orbit span{position:absolute!important;left:50%!important;top:50%!important;width:2.35px!important;height:2.35px!important;margin:-1.175px 0 0 -1.175px!important;border-radius:999px!important;background:rgba(218,96,72,.82)!important;transform:rotate(var(--a)) translateY(-6.6px) scale(var(--s,1))!important;animation:daotianClaudePulse 960ms cubic-bezier(.45,0,.35,1) infinite!important;animation-delay:calc(var(--i) * -80ms)!important;will-change:opacity,transform!important}\
.daotian-thinking-text{font-size:14px!important;line-height:1.5!important;font-weight:400!important;color:var(--muted)!important;opacity:.66!important;letter-spacing:0!important;white-space:nowrap!important}\
@keyframes daotianClaudePulse{0%{opacity:.95;filter:saturate(1.08)}12%{opacity:.82}28%{opacity:.52}52%{opacity:.28}78%{opacity:.16}100%{opacity:.13}}\
';
      document.head.appendChild(style);
    }

    function ensureModelStyle(){
      if(document.getElementById('daotianModelStyle')) return;
      const style=document.createElement('style');
      style.id='daotianModelStyle';
      style.textContent = `
        .model-toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .preset-list{display:flex;flex-direction:column;gap:12px}
        .preset-card{border:1px solid var(--border,rgba(127,127,127,.18));border-radius:18px;padding:14px;background:rgba(127,127,127,.06)}
        .preset-card-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;color:var(--text)}
        .preset-card-title{font-weight:650;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .preset-del{border:0;background:transparent;color:var(--muted);font:inherit;cursor:pointer;padding:4px 8px;border-radius:10px}
        .preset-del:hover{background:rgba(127,127,127,.12);color:var(--text)}
        textarea.provider-models{min-height:82px;resize:vertical;line-height:1.45;font-family:inherit}
        @media (max-width:760px){.model-menu{width:min(260px,calc(100vw - 36px))}#providerModal .modal{max-height:88vh}#providerModal .modal-body{max-height:calc(88vh - 112px);overflow:auto;-webkit-overflow-scrolling:touch}.preset-card .row{display:block}.preset-card .field{margin-bottom:10px}}
      `;
      document.head.appendChild(style);
    }




    function renderSidebar(){
      const side = $('#sidebar'); if(!side) return;
      side.classList.toggle('closed', !sidebarOpen);
      document.body.classList.toggle('sidebar-open', !!sidebarOpen);
      $('#openSide').style.display = sidebarOpen ? 'none' : 'grid';
      const list = $('#chatList');
      list.innerHTML = chats.map(c=>`<div class="chat-item ${c.id===activeId?'active':''}" data-id="${escapeHTML(c.id)}"><span class="chat-dot"></span><span class="chat-title">${escapeHTML(c.title)}</span><span class="chat-time">${nowTime()}</span>${(c.messages&&c.messages.length)?'<button class="delete-chat" data-del="'+escapeHTML(c.id)+'" title="删除">×</button>':''}</div>`).join('');
    }
    function pickEmptyPrompt(){
      const seed = chats.length + (activeId ? activeId.length : 0) + new Date().getDate();
      return emptyPrompts[seed % emptyPrompts.length];
    }

    function formatTokens(n){
      if(n >= 1000){ var v = (n/1000).toFixed(1); if(v.endsWith('.0')) v = v.slice(0,-2); return v + 'k'; }
      return String(n);
    }
    function renderTokenUsage(m){
      if(!loadTokenDisplay()) return '';
      if(m.role !== 'assistant' || !m.content) return '';
      var usage = m.usage;
      if(!usage){
        return '<div class="usage-footer">Token：API 未返回</div>';
      }
      var parts = [];
      var input = usage.prompt_tokens || usage.input_tokens || 0;
      if(input) parts.push('输入 ' + formatTokens(input));
      var output = usage.completion_tokens || usage.output_tokens || 0;
      if(output) parts.push('输出 ' + formatTokens(output));
      var cache = usage.cache_read_input_tokens || usage.cache_creation_input_tokens || usage.cached_tokens || 0;
      if(cache) parts.push('缓存 ' + formatTokens(cache));
      var total = usage.total_tokens || (input + output) || 0;
      if(!parts.length && total) parts.push('总计 ' + formatTokens(total));
      var text = parts.length ? 'Tokens：' + parts.join('｜') : 'Token：API 未返回';
      return '<div class="usage-footer">' + text + '</div>';
    }

    function formatMsgTime(ts){
      if(!ts) return '';
      var d = new Date(ts);
      var h = d.getHours(), m = d.getMinutes();
      return (h<10?'0':'')+h+':'+(m<10?'0':'')+m;
    }
    function hasRichLayoutContent(text){
      text = String(text || '');
      if(/```/.test(text)) return true;
      if(/<table|<iframe|<canvas|<svg|<!doctype html|<html/i.test(text)) return true;
      if(/^\s*\|.+\|\s*$/m.test(text) && /^\s*\|?\s*:?-{3,}:?\s*\|/m.test(text)) return true;
      if(text.split('\n').some(function(line){ return line.length > 60; })) return true;
      return false;
    }
    function renderMessages(){
      const c = activeChat(); const box = $('#messages'); if(!box || !c) return;
      const msgs = Array.isArray(c.messages) ? c.messages : [];
      var hasScrollFocus = msgs.some(function(m){ return m && m.role === 'assistant' && m.scrollFocus; });
      if(msgs.length===0){
        box.innerHTML = `<div class="empty"><div class="empty-center"><div class="brand-main-row"><svg class="empty-logo" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" stroke-width="3"/><path d="M34 32 C43 31 49 36 56 46 C61 52 62 62 58 88 C62 63 64 53 70 46 C77 37 84 31 92 32" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg><div class="brand-name">稻田 AI</div></div><div class="empty-prompt">${escapeHTML(pickEmptyPrompt())}</div></div></div>`;
        return;
      }
      box.innerHTML = msgs.map(function(m, idx){
        const content = escapeHTML(m.content);
        if(m.role === 'user'){
          return '<div class="message user"><div class="bubble">'+content+'</div></div>';
        }
        if(m.role === 'error'){
          return '<div class="message assistant"><div style="max-width:min(720px,88%);padding:12px 14px;border-radius:14px;line-height:1.65;white-space:pre-wrap;font-size:14px;color:#c96f66;background:rgba(196,80,70,.10);border:1px solid rgba(196,80,70,.22)">'+content+'</div></div>';
        }
        if(m.thinking && !m.content){
          ensureThinkingStyle();
          var dots='';
          var angles=[0,30,60,90,120,150,180,210,240,270,300,330];
          for(var di=0;di<12;di++){
            var scale=di===0?1:.94;
            dots+='<span style=\"--i:'+di+';--a:'+angles[di]+'deg;--s:'+scale+'\"></span>';
          }
          return '<div class="message assistant daotian-thinking-message" data-scroll-focus="1"><div class="daotian-thinking"><span class="daotian-thinking-orbit" aria-hidden="true">'+dots+'</span><span class="daotian-thinking-text">想一下</span></div></div>';
        }
        var ttsText = (m.content || '').replace(/\s+/g,' ').trim();
        var ttsBtn = (m.role==='assistant' && !m.thinking && ttsText.length>0)
          ? '<button class="tts-play-btn" data-tts-idx="'+makeTtsMsgId(c.id,idx)+'" title="朗读"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg></button>' : '';
        var isRich = hasRichLayoutContent(m.content);
        var richClass = isRich ? ' rich-wide' : '';
        var scrollAttr2 = m.scrollFocus ? ' data-scroll-focus="1"' : '';
        return '<div class="message assistant'+richClass+'"'+scrollAttr2+'><div class="assistant-content"><div class="assistant-render">'+renderAssistantContent(m.content)+'</div>'+renderTokenUsage(m)+ttsBtn+'</div></div>';
      }).join('');
      box.classList.toggle('generating-space', !!hasScrollFocus);
      scheduleEnhanceRender();
      if(loadAutoScroll()){
        if(isStreamingNow() && hasScrollFocus){
          forceScrollToStreamBottom();
        }else{
          scrollMessagesToBottomStable();
        }
      }
    }
    function normalizeHttpError(status, text, contentType){
      var raw = String(text || '');
      var ct = String(contentType || '').toLowerCase();
      var looksHtml = ct.indexOf('text/html') >= 0 || /<!doctype html|<html[\s>]|<title>\s*\d{3}/i.test(raw);
      if(status === 401 || status === 403) return '认证失败，请检查 API Key 或模型权限。';
      if(status === 404) return '模型接口地址错误，请检查 Base URL / 请求路径。';
      if(status === 429) return '请求太频繁或额度不足，请稍后再试。';
      if(status === 502 || status === 503 || status === 504) return '模型服务暂时不可用（HTTP ' + status + '），请稍后重试。';
      if(looksHtml) return '模型服务返回网页错误页（HTTP ' + status + '），请检查服务状态或稍后重试。';
      try{ var data = JSON.parse(raw); return data.message || data.error || data.detail || ('请求失败（HTTP ' + status + '）'); }catch(_e){}
      return raw.slice(0,200) || ('请求失败（HTTP ' + status + '）');
    }
    function friendlyModelName(model){
      if(!model) return '...';
      var map={'deepseek-chat':'DeepSeek Chat','deepseek-v4-flash':'DeepSeek Flash','deepseek-reasoner':'DeepSeek Reasoner','gemini-2.5-flash':'Gemini Flash','gemini-2.5-pro':'Gemini Pro','gpt-4o':'GPT-4o','gpt-4o-mini':'GPT-4o Mini','claude-sonnet-4-6':'Claude Sonnet','claude-opus-4-7':'Claude Opus'};
      return map[model] || model;
    }
    function hasUsableModelConfig(){
      settings = ensureSettingsShape(settings);
      return findFirstUsableProvider() !== null;
    }

    function getModelConfigLevel(){
      settings = ensureSettingsShape(settings);
      if(!hasAnyProvider()) return 'noProvider';
      if(!hasProviderWithCredentials()) return 'providerMissingKey';
      if(!findFirstUsableProvider()) return 'providerReadyButNoModel';
      return 'usable';
    }

    /* Model capability detection */
    var VISION_MODEL_PATTERNS = [
      /gpt-4o/i, /gpt-4\.1/i, /gpt-4-turbo/i, /gpt-4-vision/i,
      /claude/i, /gemini/i, /vision/i, /vl/i, /multimodal/i,
      /qwen-vl/i, /glm-4v/i, /yi-vision/i, /llava/i,
      /pixtral/i, /llama.*vision/i, /bakllava/i, /cogvlm/i
    ];
    var TEXT_ONLY_MODEL_PATTERNS = [
      /deepseek/i, /qwen(?!.*vl)/i, /glm(?!.*4v)/i, /yi(?!.*vision)/i,
      /llama(?!.*vision)/i, /mistral/i, /mixtral/i, /phi/i,
      /gemma/i, /command/i, /openchat/i, /zephyr/i
    ];

    function modelSupportsVision(modelName){
      if(!modelName) return false;
      for(var i=0; i<VISION_MODEL_PATTERNS.length; i++){
        if(VISION_MODEL_PATTERNS[i].test(modelName)) return true;
      }
      for(var j=0; j<TEXT_ONLY_MODEL_PATTERNS.length; j++){
        if(TEXT_ONLY_MODEL_PATTERNS[j].test(modelName)) return false;
      }
      return false; // default: no vision
    }

    function getModelStatusText(){
      var level = getModelConfigLevel();
      if(level === 'noProvider') return '请先添加模型提供方';
      if(level === 'providerMissingKey') return '请填写 Base URL / API Key';
      var current = activePreset();
      if(level === 'providerReadyButNoModel' || !current || !current.model) return '请填写或获取模型名称';
      return friendlyModelName(current.model);
    }
    function renderModelSwitcher(){
      ensureModelStyle();
      var current = activePreset();
      var label = $('#modelTopLabel');
      var usable = hasUsableModelConfig();
      var displayText = getModelStatusText();
      if(label){ label.textContent = displayText; label.title = displayText; }
      var popover = $('#modelPopover');
      if(popover){
        var presets = modelPresets();
        if(!presets.length || !usable){
          popover.innerHTML = '<div style="padding:14px 12px;text-align:center;opacity:.56">请先添加模型</div><div class="model-popover-divider"></div><button class="model-option" id="manageModels"><span class="model-option-check">›</span><span><div class="model-option-title">管理模型配置</div></span></button>';
        }else{
          /* 按model去重 */
          var seenModels = {};
          var unique = [];
          for(var pi=0; pi<presets.length; pi++){
            if(!seenModels[presets[pi].model]){ seenModels[presets[pi].model]=true; unique.push(presets[pi]); }
          }
          popover.innerHTML = unique.map(function(p){
            var active = p.id === settings.activePresetId;
            var shortName = p.model||'';
            var shortMap = {'deepseek-chat':'Chat','deepseek-v4-pro':'Pro','deepseek-v4-flash':'Flash','deepseek-reasoner':'Reasoner'};
            if(shortMap[shortName]) shortName = shortMap[shortName];
            return '<button class="model-option'+(active?' selected':'')+'" data-model-preset="'+escapeHTML(p.id)+'"><span class="model-option-check">'+(active?'✓':'')+'</span><span><div class="model-option-title">'+escapeHTML(shortName)+'</div></span></button>';
          }).join('') + '<div class="model-popover-divider"></div><button class="model-option" id="manageModels"><span class="model-option-check">›</span><span><div class="model-option-title">管理模型配置</div></span></button>';
        }
      }
    }

    function openModelPopover(){ var p=$('#modelPopover'); if(p){ renderModelSwitcher(); p.classList.add('open'); } var t=$('#modelTopTrigger'); if(t) t.setAttribute('aria-expanded','true'); }
    function closeModelPopover(){ var p=$('#modelPopover'); if(p) p.classList.remove('open'); var t=$('#modelTopTrigger'); if(t) t.setAttribute('aria-expanded','false'); }
    function toggleModelPopover(){ if(!hasUsableModelConfig()){ openProviderHub(); return; } var p=$('#modelPopover'); if(p && p.classList.contains('open')) closeModelPopover(); else openModelPopover(); }
    function closeModelMenu(){ closeModelPopover(); }

    function renderAll(){
      theme = resolveTheme();
      document.documentElement.setAttribute('data-theme', theme);
      /* 同步 theme-color meta：移除media限制确保手动切换生效 */
      var metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach(function(m){ m.removeAttribute('media'); m.content = theme === 'dark' ? '#282826' : '#f5f2ea'; });
      if(metas.length === 0){
        var m = document.createElement('meta'); m.name = 'theme-color'; m.content = theme === 'dark' ? '#282826' : '#f5f2ea';
        document.head.appendChild(m);
      }
      const shell = $('.app-shell'); if(shell) shell.setAttribute('data-theme', theme);
      if(sidebarOpen) closeModelPopover();
      renderSidebar(); renderMessages(); renderModelSwitcher(); persist();
    }

    function createChat(){ var empty=chats.find(function(c){ return !c.messages || !c.messages.length; }); if(empty){ activeId=empty.id; }else{ var id=uid(); chats.unshift({id:id,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}); activeId=id; } safeClearAttachments(); sidebarOpen=false; renderAll(); }
    function startNewChat(){ if(activeAbortController){ try{activeAbortController.abort();}catch(e){} activeAbortController=null; generatingChatId=null; } sending=false; createChat(); }
    function deleteChat(id){
      const idx = chats.findIndex(c=>c.id===id); if(idx<0) return;
      chats.splice(idx,1);
      if(chats.length===0){ const nid=uid(); chats=[{id:nid,title:'新对话',createdAt:Date.now(),updatedAt:Date.now(),messages:[]}]; activeId=nid; }
      else if(activeId===id){ activeId = chats[Math.max(0,Math.min(idx,chats.length-1))].id; }
      safeClearAttachments(); renderAll(); toast('已删除');
    }

    function buildOpenAIURL(preset){ const cfg=preset||activePreset(); const base=(cfg.baseUrl||'').replace(/\/$/,''); const path=cfg.path||'/v1/chat/completions'; if(!base) return '/v1/chat/completions'; if(base.endsWith('/v1') && path.startsWith('/v1/')) return base + path.slice(3); return base + (path.startsWith('/') ? path : '/' + path); }
    function extractDelta(data){
      const choice = data && data.choices && data.choices[0];
      if(choice && choice.delta && typeof choice.delta.content === 'string') return choice.delta.content;
      if(choice && choice.message && typeof choice.message.content === 'string') return choice.message.content;
      if(data && typeof data.content === 'string') return data.content;
      if(data && Array.isArray(data.content)){
        return data.content.map(function(part){ return part && part.text ? part.text : ''; }).join('');
      }
      return '';
    }

    function extractFullContent(data){
      return data.choices?.[0]?.message?.content ||
        data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('') ||
        (typeof data.content === 'string' ? data.content : '') ||
        data.content?.[0]?.text ||
        '';
    }

    async function callModel(messages, onDelta, preset){
      const cfg = preset || activePreset();
      if((cfg.providerType||'openai') !== 'openai') throw new Error('Gemini / Anthropic 已保存，但还需要后端转发适配。当前先用 OpenAI 兼容接口。');
      const headers={'Content-Type':'application/json'};
      const body={model:cfg.model||'deepseek-chat',messages:messages.map(m=>({role:m.role,content:m.content})),stream:true,stream_options:{include_usage:true}};
      exportModelParamsBody(cfg.id, body);
      let targetUrl = buildOpenAIURL(cfg);
      if(searchOn || cfg.accessCode || cfg.providerId || (cfg.baseUrl && cfg.apiKey)){
        targetUrl = '/chat';
        body.webSearch = Boolean(searchOn);
        body.search = Boolean(searchOn);
        if(cfg.accessCode) body.accessCode = cfg.accessCode;
        else if(cfg.providerId) body.providerId = cfg.providerId;
        else if(cfg.baseUrl && cfg.apiKey){
          body.frontendUpstream = {
            providerType: cfg.providerType || 'openai',
            providerName: cfg.providerName || cfg.label || '当前模型',
            baseUrl: cfg.baseUrl || '',
            apiKey: cfg.apiKey || '',
            requestPath: cfg.path || '/v1/chat/completions',
            path: cfg.path || '/v1/chat/completions',
            model: cfg.model || 'deepseek-chat'
          };
        }
      }
      const fetchHeaders = targetUrl === '/chat' ? {'Content-Type':'application/json'} : headers;
      const res=await fetch(targetUrl,{method:'POST',headers:fetchHeaders,body:JSON.stringify(body)});
      if(!res.ok){ var txt3=await res.text(); var ct3=res.headers.get('content-type')||''; throw new Error(normalizeHttpError(res.status, txt3, ct3)); }

      if(!res.body){
        const txt=await res.text();
        try{ const data=JSON.parse(txt); var nc = extractFullContent(data) || JSON.stringify(data).slice(0,1000); return { content: nc, usage: data.usage || null }; }catch(e){ return { content: txt, usage: null }; }
      }

      const reader=res.body.getReader();
      const decoder=new TextDecoder();
      let buffer='';
      let raw='';
      let full='';
      let streamError='';
      let capturedUsage = null;

      function consumeLine(line){
        const trimmed=line.trim();
        if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        const payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{
          const data=JSON.parse(payload);
          if(data.usage) capturedUsage = data.usage;
          const delta=extractDelta(data);
          if(delta){
            full += delta;
            if(onDelta) onDelta(delta, full);
          }else if(data && (data.error || data.message) && !full){
            streamError = String(data.message || data.error || '请求失败');
          }
        }catch(_e){}
        return false;
      }

      while(true){
        const read=await reader.read();
        if(read.done) break;
        const chunk=decoder.decode(read.value,{stream:true});
        raw += chunk;
        buffer += chunk;
        let index;
        while((index=buffer.indexOf('\n'))>=0){
          const line=buffer.slice(0,index);
          buffer=buffer.slice(index+1);
          if(consumeLine(line)) return { content: full, usage: capturedUsage };
        }
      }
      buffer += decoder.decode();
      if(buffer.trim()) consumeLine(buffer);
      if(streamError && !full) throw new Error(streamError);
      if(full) return { content: full, usage: capturedUsage };

      try{
        const data=JSON.parse(raw);
        return { content: extractFullContent(data) || JSON.stringify(data).slice(0,1000), usage: capturedUsage || (data.usage || null) };
      }catch(_e){
        return { content: raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(), usage: capturedUsage };
      }
    }
    async function sendMessage(){
      if(sending) return;
      if(generatingChatId && generatingChatId !== activeId){ activeAbortController = null; generatingChatId = null; }
      var input=$('#input'); var text=(input.value||'').trim();
      var hasAttachments = _attachments && _attachments.length > 0;
      if(!text && !hasAttachments) return;
      var sendAttachments = hasAttachments ? _attachments.slice() : [];
      if(!hasUsableModelConfig()){ toast('请先添加模型'); openProviderHub(); return; }
      var cfg = activePreset();

      /* Image check: non-vision model blocks images */
      if(hasAttachments){
        var hasImages = false;
        for(var ai=0; ai<_attachments.length; ai++){
          if(isImageFile(_attachments[ai].name)){ hasImages = true; break; }
        }
        if(hasImages && !modelSupportsVision(cfg.model)){
          toast('当前模型不支持图片阅读，请切换支持视觉的模型');
          return;
        }
      }

      var c=activeChat();
      /* Build display text — file content parsed server-side */
      var displayText = text || '';
      if(hasAttachments){
        var fileNames = _attachments.map(function(a){ return a.name; }).join('、');
        var sizeTotal = 0;
        for(var afi=0; afi<_attachments.length; afi++){ sizeTotal += _attachments[afi].size || 0; }
        var sizeStr = sizeTotal > 1024*1024 ? (sizeTotal/1024/1024).toFixed(1)+'MB' : (sizeTotal/1024).toFixed(0)+'KB';
        displayText = (text||'请查看文件内容') + '\n\n[已发送 ' + _attachments.length + ' 个文件：' + fileNames + '（' + sizeStr + '）]';
        var hasBinaries = false;
        for(var abi=0; abi<_attachments.length; abi++){ if(isBinaryFile(_attachments[abi].name)||!isTextFile(_attachments[abi].name)&&!isImageFile(_attachments[abi].name)){ hasBinaries = true; break; } }
        if(!text && !hasBinaries && _attachments.every(function(a){return isTextFile(a.name);})){
          displayText = '请查看以下文件的内容\n\n[已发送 ' + _attachments.length + ' 个文件：' + fileNames + ']';
        }
      }
      c.messages.push({role:'user',content:displayText,time:Date.now(),files:hasAttachments?_attachments.map(function(a){return{name:a.name,type:a.type,size:a.size};}):undefined}); if(!c.title || c.title==='新对话') c.title=(text||'文件对话').slice(0,28); c.updatedAt=Date.now(); input.value=''; input.style.height='44px'; input.style.overflowY='hidden'; sending=true; $('#sendBtn').disabled=true;
      /* 立即清除附件预览，不等模型返回 */
      if(hasAttachments){ _attachments = []; if(typeof showAttachPreview === 'function') showAttachPreview(); }
      try{ if(!window.__MEMORY_V3_INIT__) MEMORY_V3.init(); }catch(_e){}
      var params = getModelParams(cfg.id);
      var requestMessages=c.messages.filter(m=>m.role==='user'||m.role==='assistant'||m.role==='system').map(m=>({role:m.role,content:m.content}));
      /* Retrieve server memories asynchronously — inject into system prompt */
      var retrievedMems = [];
      try{
        if(AUTH_USER && AUTH_USER.id){
          retrievedMems = await retrieveMemories(text);
        }else{
          // Guest: fallback to old localStorage retrieval
          try{ var _store=loadStore(); var _ret=retrieve(text,4,_store); if(_ret&&_ret.length) retrievedMems=_ret.map(function(r){return{fact:r.memory?r.memory.text:r.text,id:r.memory?r.memory.id:''};}); }catch(_g){}
        }
      }catch(_r){ console.warn('[Mem] pre-send retrieval error:', _r.message); }
      var memoryContext = formatMemoryContext(retrievedMems);
      var systemText = (params && params.systemPrompt && params.systemPrompt.trim() && params.systemPrompt !== EMPTY_PROMPT) ? params.systemPrompt.trim() : (defaultModelParams.systemPrompt !== EMPTY_PROMPT ? defaultModelParams.systemPrompt : '');
      if(memoryContext){
        systemText += memoryContext;
        console.log('[Mem] injecting '+retrievedMems.length+' memories into prompt');
      }
      if(!requestMessages.some(function(m){ return m.role === 'system'; }) && systemText){
        requestMessages.unshift({role:'system', content:systemText});
      }else if(systemText){
        var firstSystem = requestMessages.findIndex(function(m){ return m.role === 'system'; });
        if(firstSystem >= 0 && !requestMessages[firstSystem].content){
          requestMessages[firstSystem].content = systemText;
        }
      }
      var willExtract = loadAutoExtract() && quickExtract(text);
      var assistant={role:'assistant',content:'',thinking:true,scrollFocus:true,model:cfg.model,provider:cfg.providerName,modelLabel:cfg.label,usage:null,time:Date.now(),memoryNotice:!!willExtract};
      c.messages.push(assistant);
      assistant._msgIdx = c.messages.length - 1; assistant._chatId = c.id;
      renderAll();
      var memoryNoticeTimer = null;

      /* Build request body — include upstream when going through /chat */
      var body={model:cfg.model||'deepseek-chat',messages:requestMessages,stream:true,stream_options:{include_usage:true}};
      exportModelParamsBody(cfg.id, body);
      if(searchOn || hasAttachments || cfg.accessCode || cfg.providerId || (cfg.baseUrl && cfg.apiKey)){
        if(searchOn){ body.webSearch = true; body.search = true; }
        if(cfg.accessCode) body.accessCode = cfg.accessCode;
        if(cfg.providerId) body.providerId = cfg.providerId;
        body.providerScope = cfg.providerScope || 'self';
        if(cfg.baseUrl && cfg.apiKey){
          body.frontendUpstream = {
            providerType: cfg.providerType || 'openai',
            providerName: cfg.providerName || cfg.label || '当前模型',
            baseUrl: cfg.baseUrl || '',
            apiKey: cfg.apiKey || '',
            requestPath: cfg.path || '/v1/chat/completions',
            path: cfg.path || '/v1/chat/completions',
            model: cfg.model || body.model || ''
          };
        }
      }

      var timeoutId = setTimeout(function(){
        if(assistant.thinking){
          console.warn('[upload-hotfix] suppressed stale 30s chat timeout; request is still allowed to finish');
        }
      }, 30000);
      try{
        var result=await callModelWithBody(requestMessages, body, cfg, function(delta){
          if(assistant.thinking){
            assistant.thinking=false;
            if(assistant.memoryNotice){
              renderMessages();
              memoryNoticeTimer = setTimeout(function(){
                assistant.memoryNotice = false;
                renderMessages();
              }, 1800);
            }
          }
          assistant.content += delta;
          c.updatedAt=Date.now();
          if(!assistant.memoryNotice) renderMessages();
          if(assistant.scrollFocus) forceScrollToStreamBottom();
        }, sendAttachments);
        clearTimeout(timeoutId);
        clearTimeout(memoryNoticeTimer);
        assistant.memoryNotice = false;
        assistant.thinking=false;
        assistant.scrollFocus = false;
        if(!assistant.content.trim()) assistant.content=result.content || '没有返回内容';
        assistant.usage = result.usage || null;
      }catch(err){
        clearTimeout(timeoutId);
        if(err&&err.message==='ABORTED'){
          assistant.role='system'; assistant.content=''; assistant.thinking=false;
        }else{
          assistant.role='error';
          var errMsg = err&&err.message?err.message:String(err);
          if(errMsg.indexOf('model_required')>=0) errMsg = '请先选择模型后再发送';
          else if(errMsg.indexOf('Authentication')>=0||errMsg.indexOf('401')>=0) errMsg = '认证失败，请检查 API Key 或模型提供方配置';
          else if(errMsg.indexOf('rate_limit')>=0||errMsg.indexOf('429')>=0) errMsg = '请求太频繁，请稍后再试';
          else if(errMsg.indexOf('Failed to fetch')>=0||errMsg.indexOf('NetworkError')>=0) errMsg = '网络连接失败，请检查网络后重试';
          else if(errMsg.length > 200) errMsg = errMsg.slice(0,200) + '...';
          assistant.content = errMsg;
        }
        clearTimeout(memoryNoticeTimer);
        assistant.memoryNotice = false;
        assistant.thinking=false;
        assistant.scrollFocus = false;
      }
      sending=false; $('#sendBtn').disabled=false; c.updatedAt=Date.now(); activeAbortController=null; generatingChatId=null; renderAll();
      lastSendAt = Date.now();
      /* 移动端键盘发送后重新 focus 输入框，防止输入栏下沉 */
      if(isMobileViewport() && document.body.classList.contains('keyboard-open')){
        try{
          var inp2 = $('#input');
          if(inp2){
            requestAnimationFrame(function(){
              try{ inp2.focus({preventScroll:true}); }catch(_e){ inp2.focus(); }
            });
          }
        }catch(_e){}
      }
      scheduleThinkingScroll();
      /* 后台预生成语音缓存 */
      if(assistant && assistant.content && !assistant.thinking){
        var _msgId = makeTtsMsgId(assistant._chatId||c.id, assistant._msgIdx||0);
        preGenerateVoice(_msgId, assistant.content);
      }
      /* Async memory ingest — fire-and-forget to server, never blocks chat */
      try{
        var _facts = [];
        if(willExtract){
          var _extracted = quickExtract(text);
          if(_extracted) _facts.push({fact:_extracted, category:'auto', confidence:0.7});
        }
        // Also push old localStorage for migration
        var _oldMems = loadMemories();
        if(_oldMems.length && (!_memoriesMigrated) && AUTH_USER && AUTH_USER.id){
          migrateMemoriesToServer().catch(function(){});
        }
        if(_facts.length && AUTH_USER && AUTH_USER.id){
          ingestMemoryFacts(_facts);
        }else if(_facts.length){
          // Guest: fallback to localStorage
          var _mems = loadMemories();
          _mems.unshift({ id: uid(), content: _facts[0].fact, tags: [], createdAt: Date.now(), updatedAt: Date.now(), enabled: true });
          if(_mems.length > 200) _mems = _mems.slice(0,200);
          saveMemories(_mems);
        }
      }catch(_e){ console.warn('[Mem] post-chat ingest error:', _e.message); }
    }

    async function callModelWithBody(requestMessages, body, cfg, onDelta, attachedFiles){
      activeAbortController = new AbortController();
      generatingChatId = activeId;
      var marker = looksLikeChatFileRequest(body);
      if(marker){
        body = injectFileGuard(body);
      }
      var fileEntries = Array.isArray(attachedFiles)
        ? attachedFiles.filter(function(x){ return x && x.file; })
        : [];
      if(!fileEntries.length && marker){
        fileEntries = pickUploadFiles(marker);
      }
      var hasFiles = fileEntries.length > 0;
      var fetchBody, fetchHeaders, targetUrl;

      if(hasFiles || searchOn || cfg.accessCode || cfg.providerId || (cfg.baseUrl && cfg.apiKey)){
        targetUrl = '/chat';
        /* 先写 body 字段，再序列化 —— 顺序绝对不能反 */
        body.accessCode = cfg.accessCode || '';
        body.providerId = cfg.providerId || '';
        body.providerScope = cfg.providerScope || 'self';
        if(cfg.baseUrl && cfg.apiKey){
          body.frontendUpstream = {
            providerType: cfg.providerType || 'openai',
            providerName: cfg.providerName || cfg.label || '当前模型',
            baseUrl: cfg.baseUrl || '',
            apiKey: cfg.apiKey || '',
            requestPath: cfg.path || '/v1/chat/completions',
            path: cfg.path || '/v1/chat/completions',
            model: cfg.model || body.model || ''
          };
        }
        if(searchOn){ body.webSearch = true; body.search = true; }
        if(hasFiles){
          var fd = new FormData();
          fd.append('body', JSON.stringify(body));
          for(var fai=0; fai<fileEntries.length; fai++){
            fd.append('files', fileEntries[fai].file, fileEntries[fai].name);
          }
          fetchBody = fd;
          fetchHeaders = {};
          console.log('[upload-hotfix] converted /chat to multipart, files:', fileEntries.map(function(x){ return x.name; }).join(', '));
        }else{
          fetchHeaders = {'Content-Type':'application/json'};
          fetchBody = JSON.stringify(body);
        }
      }else{
        fetchHeaders = {'Content-Type':'application/json'};
        if(cfg.apiKey) fetchHeaders.Authorization = 'Bearer '+cfg.apiKey;
        fetchBody = JSON.stringify(body);
        targetUrl = buildOpenAIURL(cfg);
      }

      console.log('[send] targetUrl:', targetUrl, 'hasKey:', !!cfg.apiKey, 'model:', body.model);

      var res=await fetch(targetUrl,{method:'POST',headers:fetchHeaders,body:fetchBody,signal:activeAbortController?activeAbortController.signal:undefined}).catch(function(e){ if(e.name==='AbortError'){ throw new Error('ABORTED'); } throw e; });
      console.log('[send] response status:', res.status, 'ok:', res.ok, 'hasBody:', !!res.body);

      if(!res.ok){ var txt4=await res.text(); var ct4=res.headers.get('content-type')||''; console.error('[send] HTTP error:', res.status); throw new Error(normalizeHttpError(res.status, txt4, ct4)); }

      if(!res.body){
        var txt2=await res.text();
        try{ var data2=JSON.parse(txt2); var nc = extractFullContent(data2) || JSON.stringify(data2).slice(0,1000); return { content: nc, usage: data2.usage || null }; }catch(e){ return { content: txt2, usage: null }; }
      }

      var reader=res.body.getReader();
      var decoder=new TextDecoder();
      var buffer='';
      var raw='';
      var full='';
      var streamError='';
      var capturedUsage = null;

      function consumeLine(line){
        var trimmed=line.trim();
        if(!trimmed) return false;
        if(!trimmed.startsWith('data:')) return false;
        var payload=trimmed.replace(/^data:\s*/, '');
        if(!payload || payload==='[DONE]') return payload==='[DONE]';
        try{
          var data=JSON.parse(payload);
          if(data.usage) capturedUsage = data.usage;
          var delta=extractDelta(data);
          if(delta){
            full += delta;
            if(onDelta) onDelta(delta, full);
          }else if(data && (data.error || data.message) && !full){
            streamError = String(data.message || data.error || '请求失败');
          }
        }catch(_e){}
        return false;
      }

      while(true){
        var read=await reader.read();
        if(read.done) break;
        var chunk=decoder.decode(read.value,{stream:true});
        raw += chunk;
        buffer += chunk;
        var index;
        while((index=buffer.indexOf('\n'))>=0){
          var line=buffer.slice(0,index);
          buffer=buffer.slice(index+1);
          if(consumeLine(line)) return { content: full, usage: capturedUsage };
        }
      }
      buffer += decoder.decode();
      if(buffer.trim()) consumeLine(buffer);
      if(streamError && !full) throw new Error(streamError);
      if(full) return { content: full, usage: capturedUsage };

      try{
        var data3=JSON.parse(raw);
        return { content: extractFullContent(data3) || JSON.stringify(data3).slice(0,1000), usage: capturedUsage || (data3.usage || null) };
      }catch(_e2){
        return { content: raw.replace(/^data:\s*/gm,'').replace(/\[DONE\]/g,'').trim(), usage: capturedUsage };
      }
    }

    /* ── 简化记忆提取：分类 → 直接存，不评分、不候选 ── */
    function quickExtract(text){
      var t = String(text||'').trim();
      if(t.length < 6) return null;
      if(/[?？]$/.test(t) || /^(?:什么|谁|哪|怎么|为什么|何时|如何)/.test(t)) return null;
      try{
        var cls = MEMORY_V3.classify(t);
        if(cls.is_trash || cls.is_sensitive || cls.is_temporary) return null;
        if(cls.explicit_request || cls.category === 'explicit_memory_request'){
          var cleaned = t.replace(/^(?:记住[这那我]?[条句话个]?|记[一着]?下[来]?|请[你]?[把]?)[!！。,\s]*/i, '').trim();
          return cleaned || t;
        }
        if(cls.category === 'stable_preference' || cls.category === 'instruction' || cls.category === 'boundary' || cls.category === 'project' || cls.category === 'dislike'){
          var obj = cls.subcategory === 'dislike' ? '用户不喜欢' : cls.subcategory === 'preference' ? '用户喜欢' : '';
          return obj ? obj + '：' + t : t;
        }
      }catch(_e){}
      return null;
    }

    /*
      语义化记忆系统（纯前端，不耗 token）
      核心：关键词是弱信号。语义分类 + 多维度评分决定是否写入。
      流程：分类 → 评分 → 决策（正式写入 / 候选 / 丢弃）
    */

    /* ── 强信号：用户明确要求记忆 ── */
    var EXPLICIT_MEMORY_PATTERNS = [
      /记住[这那]|记好[了]?|牢[记固][这那]/i,
      /以后[都就请要](?:按照|遵照|依据|根据|用|按着|按)/i,
      /以后[都就请要][别不]要[再又]/i,
      /加入记忆|写入记忆|保存[到]?记忆/i,
      /不要再犯[这那]个错误/i,
      /以后(?:禁止|不让|不允许|不能)[^，。\n]{0,20}/i,
      /这[个条]以后就是默认(?:规则|设置|配置|行为)/i,
      /把[这那][个条些]?(?:记下来|加入记忆|保存起来|记住|写入|存下来)/i,
      /(?:重要|关键)[的]?[：:]\s*.{0,20}(?:以后|今后|未来)/i,
      /这个以后(?:就|都|要)按(?:照|着)?/i,
      /默认(?:规则|流程|配置|设置|行为)[：:]\s*/i,
      /(?:以后|从今往后|接下来)[^，。\n]{0,10}(?:都|就)这样[吧来]?[。，!！]?$/i,
      /(?:以后|接下来)(?:每次|所有|全部)[^，。\n]{0,20}都[按照用按]/i
    ];

    /* ── 弱信号：模式 + 各维度权重（lt=long_term, fr=future_reuse, st=stability, sp=specificity） ── */
    var CONTEXT_WEIGHT_PATTERNS = [
      { pat: /我[的]?(?:叫|是|姓名|名字|昵称|外号|绰号|代号|人称|又名|全名)|大家都叫我|朋友们[都]?叫我/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我[的]?(?:住在|来自|家在|出生于|出生在|老家|现居|生活在|常驻|base[在]?)/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我(?:做[一]?[名位个]?|搞|干|从事|负责|任职[于]?|目前在|现[任]?|供职|就职|效力)(?:[^，。\n]{0,20})/i,
        wt: { lt:2, fr:2, st:1, sp:1 } },
      { pat: /我[的]?(?:职业|工作|专业|行业|领域|单位|公司|团队|部门|岗位|职位|头衔|职责|职能|背景|资历|经验|特长|擅长|技能|技术栈)[：:]/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
      { pat: /我(?:最|特别|非常|超|挺|蛮|真的很|真的|尤其)?(?:喜欢|爱|热爱|钟爱|偏爱).{0,10}[是叫有为]/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
	      { pat: /我(?:最|特别|非常|很|尤其)?(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用|热爱|钟爱|偏爱|推荐)的[^，。\n]{0,10}(?:是|叫|为|有)/i,
	        wt: { lt:2, fr:1, st:2, sp:2 } },
	      { pat: /我(?:最|特别|真的|尤其)(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用).{1,20}/i,
	        wt: { lt:2, fr:2, st:2, sp:1 } },
      { pat: /我[的]?(?:习惯|日常|作息|生活规律|时间安排|日程|每天[必会]|每周[必会]|睡前|起床|早起|晚睡|熬夜|失眠)/i,
        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我喜欢[^，。\n]{1,30}/i,
        wt: { lt:2, fr:2, st:2, sp:2 } },
	      { pat: /我(?:每天早上|每天早晨|每天晚上|每天中午|每天下午|傍晚|深夜|凌晨|睡前|起床[后]?|醒来|下班[后]?|放学[后]?|周末|工作日|平时|空闲时)[^，。\n]{0,8}(?:习惯|喜欢|会|要|都|就|必须|经常|总是|从不)/i,
	        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我(?:不[吃喝用看听玩去]|从[不未]|戒[了]?|忌|过敏|受不了|不能[吃喝用看])/i,
        wt: { lt:1, fr:1, st:1, sp:1 } },
      { pat: /我(?:学|学习|读|攻读|研究|探索|钻研|深耕|进修|深造|备考|考研|考博|考证)/i,
        wt: { lt:2, fr:1, st:2, sp:1 } },
      { pat: /我[的]?(?:项目|作品|产品|创业|开源|side[._]?project|副业)/i,
        wt: { lt:2, fr:2, st:1, sp:2 } },
      { pat: /我[的]?(?:目标|梦想|愿望|理想|志向|计划|规划|flag|人生目标)/i,
        wt: { lt:2, fr:1, st:1, sp:1 } },
      { pat: /(?:你[^，。\n]{0,8}[的]?[说搞弄]错[了]?|不是[这样那样]的|我纠正|更正一下|上次[的]?那个[是]?不对)/i,
        wt: { lt:3, fr:3, st:3, sp:2 } },
      { pat: /(?:以后|每次|每回|从今往后)[^，。\n]{0,20}(?:都|就|要|必须)/i,
        wt: { lt:2, fr:2, st:2, sp:1 } },
      { pat: /我一[向直]|我从来|我从不|我从未|我始终|我永远/i,
        wt: { lt:2, fr:2, st:3, sp:1 } },
      { pat: /(?:请[你]?注意|请注意|重要[提示通知]|特别提醒|关键[点在于])[：:]\s*/i,
        wt: { lt:2, fr:2, st:1, sp:1 } }
    ];

    /* ── 负面信号：应丢弃的内容 ── */
    var REJECT_PATTERNS = [
      { pat: /(?:今天|现在|刚才|刚刚)[^，。\n]{0,8}(?:很[烦累怒恼躁]|好[烦累怒]|有点[烦累]|气死[我了]?|累死[我了]?|烦死[我了]?)/i, tag:'mood' },
      { pat: /(?:这个东西|这个系统|这个网站|这电脑|这手机)[真太]?(?:垃圾|卡|慢|傻逼|难用|不好用)/i, tag:'rant' },
      { pat: /(?:帮我|替我把|给[我]?[改做写删加创建复制粘贴])/i, tag:'task' },
      { pat: /(?:现在|刚才|这次|目前)[^，。\n]{0,10}(?:显示|报|跳|弹|提示)(?:\d{2,3}|error|fail|404|50[0-9]|超时|无响应|没反应)/i, tag:'error_report' },
      { pat: /^.{1,5}$/, tag:'too_short' }
    ];

    /* ── 语义分类 ── */
    function classifyMemory(text){
      var t = text.trim();
      for(var i=0; i < EXPLICIT_MEMORY_PATTERNS.length; i++){ if(EXPLICIT_MEMORY_PATTERNS[i].test(t)) return 'explicit_memory_request'; }
      if(/(?:你[^，。\n]{0,8}[的]?[说搞弄]错[了]?|不是[这样那样]的|我纠正|更正一下)/i.test(t)) return 'correction_rule';
      if(/(?:不要[改删碰]|禁止修改|默认[配置设置]|稳定版本|可用版本)/i.test(t)) return 'project_rule';
      if(/我[^，。\n]{0,6}(?:叫|是|住在|来自|家在|从事|负责|任职|目前在|现[任]?)/i.test(t)) return 'long_term_background';
      if(/(?:学习|研究|项目|创业|开源|专业|进修|目标|计划|愿望|理想)/i.test(t)) return 'long_term_background';
      if(/(?:最|特别|非常|很|真的|尤其)[^，。\n]{0,8}(?:喜欢|爱|讨厌|怕|希望|想要)[^，。\n]{0,10}(?:是|有|叫)/i.test(t)) return 'stable_preference';
	      if(/(?:最|特别|真的|尤其)(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|爱用)/i.test(t)) return 'stable_preference';
      if(/我喜欢[^，。\n]{1,30}/i.test(t)) return 'stable_preference';
      if(/(?:每天|每周|每月|习惯|通常|一般|平时|经常|从不|从未|作息|规律|总是|每回|每次)/i.test(t)) return 'stable_preference';
      if(/(?:现在|今天|刚才|刚刚)[^，。\n]{0,6}(?:很|好|有点|感觉)[^，。\n]{0,10}$/i.test(t) && !/(?:以后|每天|每周|习惯|总是|从不|每次)/i.test(t)) return 'temporary_state';
      if(/^.{1,10}$/i.test(t)) return 'casual_chat';
      return 'casual_chat';
    }

    /* ── 多维度评分 ── */
    function scoreMemory(text, category){
      var s = { explicit_request:0, long_term:0, future_reuse:0, stability:0, specificity:0, sensitivity_risk:0, triviality:0, confidence:0, category:category, temporary_state:false, task_only:false, casual_chat:false };
      var t = text.trim(), len = t.length;

      if(category === 'explicit_memory_request') s.explicit_request = 1;
      if(category === 'temporary_state') s.temporary_state = true;
      if(category === 'task_only') s.task_only = true;
      if(category === 'casual_chat') s.casual_chat = true;

      /* 负面信号 */
      for(var i=0; i < REJECT_PATTERNS.length; i++){
        if(REJECT_PATTERNS[i].pat.test(t)){
          var tag = REJECT_PATTERNS[i].tag;
          if(tag === 'mood') s.temporary_state = true;
          if(tag === 'rant') s.triviality = Math.max(s.triviality, 3);
          if(tag === 'task' && !s.explicit_request) s.task_only = true;
          if(tag === 'error_report') s.task_only = true;
          if(tag === 'too_short') s.triviality = Math.max(s.triviality, 2);
        }
      }

      /* 弱信号加权 */
      for(var j=0; j < CONTEXT_WEIGHT_PATTERNS.length; j++){
        if(CONTEXT_WEIGHT_PATTERNS[j].pat.test(t)){
          var w = CONTEXT_WEIGHT_PATTERNS[j].wt;
          s.long_term = Math.max(s.long_term, w.lt);
          s.future_reuse = Math.max(s.future_reuse, w.fr);
          s.stability = Math.max(s.stability, w.st);
          s.specificity = Math.max(s.specificity, w.sp);
        }
      }

      /* 纠错提升 */
      if(category === 'correction_rule'){
        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2);
        s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
      }
      /* 项目规则提升 */
      if(category === 'project_rule'){
        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2);
        s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 2);
      }
      /* 长期背景提升 */
      if(category === 'long_term_background'){
	        s.long_term = Math.max(s.long_term, 2); s.future_reuse = Math.max(s.future_reuse, 2); s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
        s.specificity = Math.max(s.specificity, 1);
      }
      /* 稳定偏好提升 */
      if(category === 'stable_preference'){
	        s.long_term = Math.max(s.long_term, 1); s.future_reuse = Math.max(s.future_reuse, 1); s.stability = Math.max(s.stability, 2); s.specificity = Math.max(s.specificity, 1);
      }

      /* 信息量 → confidence */
      var info = 0;
      if(len >= 6) info++; if(len >= 15) info++; if(len >= 30) info++;
      if(s.explicit_request) info += 2;
      if(category !== 'casual_chat' && category !== 'temporary_state' && category !== 'task_only') info++;
      if(info >= 4) s.confidence = 3; else if(info >= 2) s.confidence = 2; else if(info >= 1) s.confidence = 1;

      /* triviality：过长过短扣分 */
      if(s.triviality === 0){
        if(len < 4) s.triviality = 2; else if(len > 200) s.triviality = 1;
        if(/[0-9]/.test(t) || /[a-zA-Z]{3,}/.test(t) || /[：:""][^，。\n]{2,}/.test(t)) s.triviality = 0;
      }

      /* sensitivity_risk */
      if(/(?:密码|密钥|token|secret|password|api.?key|账号|银行|卡号|身份证|手机号|地址|电话)/i.test(t)) s.sensitivity_risk = 3;
      else if(/(?:收入|工资|薪水|家庭|感情|健康|疾病|医疗)/i.test(t)) s.sensitivity_risk = 2;
      else if(/(?:公司|项目|工作|代码|配置)/i.test(t)) s.sensitivity_risk = 1;

      return s;
    }

    /* ── 决策：是否正式写入 ── */
	    function shouldWriteMemory(s){
	      if(s.explicit_request){
	        if(s.sensitivity_risk >= 3 || s.triviality >= 3) return 'candidate';
	        return 'write';
	      }
	      var sum = s.long_term + s.future_reuse + s.stability + s.specificity;
	      if(sum >= 7 && s.confidence >= 2 && s.sensitivity_risk <= 1 && s.triviality <= 1 && !s.temporary_state && !s.task_only && !s.casual_chat) return 'write';
	      if(s.triviality >= 3) return 'discard';
	      if(s.temporary_state && sum < 3) return 'discard';
	      if(s.task_only) return 'discard';
	      if(s.casual_chat && sum === 0 && s.triviality > 0) return 'discard';
	      return 'candidate';
	    }

    /* ── 候选记忆：合并、证据计数 ── */
    function mergeCandidate(candidates, content, category){
      var now = Date.now();
      /* 找相似候选 */
      for(var i=0; i < candidates.length; i++){
        var c = candidates[i];
        var sim = contentSimilarity(c.content, content);
        if(sim >= 0.6){
          c.content = content.length > c.content.length ? content : c.content;
          c.evidenceCount = (c.evidenceCount || 1) + 1;
          c.lastSeenAt = now;
          c.confidence = Math.min(3, (c.confidence || 1) + 1);
          return;
        }
      }
      /* 找是否已存在正式记忆中 */
      var memories = loadMemories();
      for(var j=0; j < memories.length; j++){
        if(contentSimilarity(memories[j].content, content) >= 0.6) return; /* 已存在 */
      }
      /* 新增候选 */
      candidates.unshift({
        id: uid(), content: content, category: category || 'unknown',
        evidenceCount: 1, firstSeenAt: now, lastSeenAt: now,
        confidence: 1, sourceSummary: '系统自动提取'
      });
    }

    /* 内容相似度（简单字频重叠） */
    function contentSimilarity(a, b){
      if(!a || !b) return 0;
      if(a === b) return 1;
      var sa = a.slice(0, 60), sb = b.slice(0, 60);
      var short = sa.length <= sb.length ? sa : sb;
      var long = sa.length > sb.length ? sa : sb;
      var match = 0;
      for(var i=0; i < short.length; i++){
        if(long.indexOf(short[i]) >= 0) match++;
      }
      return match / long.length;
    }

    /* ── 清理过期候选 ── */
    function cleanupCandidates(){
      var candidates = loadMemoryCandidates();
      if(!candidates.length) return;
      var now = Date.now();
      var kept = [];
      for(var i=0; i < candidates.length; i++){
        var c = candidates[i];
        /* 超过7天且证据不足 → 删除 */
        if(now - c.lastSeenAt > 7*86400000 && (c.evidenceCount||1) < 2) continue;
        /* 超过30天 → 全部删除 */
        if(now - c.lastSeenAt > 30*86400000) continue;
        kept.push(c);
      }
      if(kept.length !== candidates.length) saveMemoryCandidates(kept);
    }

    /* ============================================================
       记忆引擎 v2 — 执行设计方案
       四阶段：摄取(Ingestion)→存储(Storage)→检索(Retrieval)→整合(Synthesis)
       语义向量 + IndexedDB + 实体提取 + 指代消解 + 隐含挖掘
       ============================================================ */
    var MEMORY_ENGINE = null;

    function initMemoryEngine(){
      if(MEMORY_ENGINE) return MEMORY_ENGINE;
      var engine = {};
      engine.ready = false;
      engine.modelLoaded = window.__HF && window.__HF.loaded === true;
      engine.db = null;

      /* IndexedDB 初始化（Dexie） */
      engine.initDB = function(){
        if(typeof Dexie === 'undefined') return null;
        try{
          var db = new Dexie('DaotianMemory');
          db.version(1).stores({
            memories: 'id, category, createdAt, updatedAt, enabled',
            candidates: 'id, category, firstSeenAt, lastSeenAt, evidenceCount',
            entities: '++id, name, type',
            conversationIndex: '++id, msgIndex, role, createdAt'
          });
          engine.db = db;
          return db;
        }catch(e){ return null; }
      };

      /* 向量嵌入（用 transformers.js） */
      engine.embed = async function(text){
        if(window.__HF && window.__HF.extractor){
          try{
            var r = await window.__HF.extractor(text, { pooling: 'mean', normalize: true });
            return Array.from(r.data);
          }catch(e){ return null; }
        }
        return null;
      };

      /* 余弦相似度 */
      engine.cosineSim = function(a, b){
        if(!a || !b || a.length !== b.length) return 0;
        var dot = 0, na = 0, nb = 0;
        for(var i=0; i<a.length; i++){ dot += a[i]*b[i]; na += a[i]*a[i]; nb += b[i]*b[i]; }
        return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-10);
      };

      /* 语义分类原型句子（各分类的语义代表） */
      var PROTOTYPES = {
        stable_preference: ['我喜欢吃苹果','我最爱蓝色','我平时喜欢跑步','周末我喜欢爬山','我习惯早起'],
        long_term_background: ['我是一名软件工程师','我住在北京','我在科技公司工作','我叫张三','我的专业是计算机'],
        correction_rule: ['你刚才说的不对','我纠正一下','不是这样的','你弄错了','更正一下'],
        project_rule: ['不要修改这个功能','默认配置不要动','稳定版本优先','不要删这个功能'],
        casual_chat: ['今天天气不错','你吃饭了吗','哈哈好好笑','好的没问题','晚安明天见']
      };
      engine._protoEmbs = null;

      engine._loadProtos = async function(){
        if(!engine.modelLoaded || engine._protoEmbs) return;
        var embs = {};
        for(var cat in PROTOTYPES){
          var arr = PROTOTYPES[cat];
          var sum = null;
          for(var i=0; i<arr.length; i++){
            var e = await engine.embed(arr[i]);
            if(e){
              if(!sum) sum = new Array(e.length).fill(0);
              for(var j=0; j<e.length; j++) sum[j] += e[j];
            }
          }
          if(sum){
            var len = Math.sqrt(sum.reduce(function(s,v){ return s+v*v; }, 0));
            for(var k=0; k<sum.length; k++) sum[k] /= (len + 1e-10);
            embs[cat] = sum;
          }
        }
        engine._protoEmbs = embs;
      };

      /* 语义分类（向量相似度 + softmax 概率） */
      engine.semanticClassify = async function(text){
        var regexCat = classifyMemory(text);
        if(regexCat === 'explicit_memory_request') return regexCat; /* 显式记忆请求直接确认 */
        if(!engine.modelLoaded || !engine._protoEmbs) return regexCat;
        var emb = await engine.embed(text);
        if(!emb) return regexCat;
        var bestCat = null, bestScore = 0;
        for(var cat in engine._protoEmbs){
          var sc = engine.cosineSim(emb, engine._protoEmbs[cat]);
          if(sc > bestScore){ bestScore = sc; bestCat = cat; }
        }
        return bestScore > 0.6 ? bestCat : regexCat;
      };

      /* 实体提取 */
      engine.extractEntities = function(text){
        var list = [];
        var patterns = [
          { type:'person_name', pat:/(?:我叫|我是|我的名字是|我叫作|我姓|我的名字叫|大家都叫我|朋友们叫我)([^，。\n]{1,12})/ },
          { type:'location', pat:/(?:我住在|我来自|我家在|我老家在|我出生于|出生在|现居|base在)([^，。\n]{1,20})/ },
          { type:'job', pat:/(?:我[是作当]?[一]?(?:名|位|个)?)([^，。\n]{1,20}(?:师|员|工|手|家|人|生))/ },
          { type:'organization', pat:/(?:我在|我就职于|我任职于|我供职于|我效力于|我目前在一|我现在的公司是|我的公司是|我的团队是)([^，。\n]{1,20})/ },
          { type:'preference_target', pat:/(?:喜欢|爱|爱吃|爱喝|爱看|爱听|爱玩|推荐|钟爱|偏爱)([^，。\n]{1,20})(?:[，。]|$)/ },
          { type:'skill', pat:/(?:我[的]?(?:擅长|精通|熟练|掌握|技术栈是|技能是))([^，。\n]{1,20})/ }
        ];
        for(var i=0; i<patterns.length; i++){
          var m = text.match(patterns[i].pat);
          if(m) list.push({ type:patterns[i].type, value:m[1].trim() });
        }
        return list;
      };

      /* 指代消解（"第X条" / "这句话" / "上一条"） */
      engine.resolveReference = function(text, messages){
        if(!messages || !messages.length) return null;
        var refNum = text.match(/第(\d+)[条点则项步]/);
        if(refNum){
          var idx = parseInt(refNum[1]) - 1;
          for(var i=messages.length-1; i>=0; i--){
            if(messages[i].role === 'assistant'){
              var items = messages[i].content.split(/\d+\s*[.、）]/);
              if(items[idx+1]) return { type:'numbered_item', index:idx, content:items[idx+1].trim().slice(0,200), sourceIdx:i };
            }
          }
        }
        if(/这[句个条]|那[句个条]|上[一那]句/.test(text)){
          for(var j=messages.length-1; j>=0; j--){
            if(messages[j].role === 'assistant'){
              var sentences = messages[j].content.split(/[。！？\n]/).filter(Boolean);
              var last = sentences[sentences.length-1] || messages[j].content;
              return { type:'last_ai_message', content:last.trim().slice(0,200), sourceIdx:j };
            }
          }
        }
        return null;
      };

      /* 隐含信息挖掘（"这句话写得不错"→隐含偏好） */
      engine.mineImplicit = function(text){
        var pos = [
          { pat:/[^。，\n]{2,30}(?:不错|真好|很棒|很好|太好了|很喜欢|太好用了|真方便|真好看|很满意|很喜欢|真不错|确实好|真的很好)/ },
          { pat:/(?:最喜欢|最爱的|超喜欢|特别喜欢|真是太好)[^。，\n]{0,20}/ },
          { pat:/[^。，\n]{3,30}(?:很实用|很给力|很强大|很优雅|很简洁|很方便|很漂亮|很舒服|很流畅|很稳定)/ }
        ];
        for(var i=0; i<pos.length; i++){
          var m = text.match(pos[i].pat);
          if(m) return { implicit:true, sentiment:'positive', content:m[0].trim().slice(0,100), type:'stable_preference', confidence:0.6 };
        }
        var neg = [
          { pat:/[^。，\n]{2,30}(?:不好用|太难用|不好看|太丑|太慢|太卡|太复杂|不太好|不太喜欢|不喜欢|真差|不行)/ }
        ];
        for(var j=0; j<neg.length; j++){
          var n = text.match(neg[j].pat);
          if(n) return { implicit:true, sentiment:'negative', content:n[0].trim().slice(0,100), type:'stable_preference', confidence:0.5 };
        }
        return null;
      };

      /* 多策略检索（向量+关键词+实体+指代+时间） */
      engine.retrieve = async function(query, messages, limit){
        limit = limit || 10;
        var memories = loadMemories().filter(function(m){ return m.enabled !== false; });
        if(!memories.length) return [];
        var queryEmb = engine.modelLoaded ? await engine.embed(query) : null;
        var ref = engine.resolveReference(query, messages || []);
        var results = [];
        for(var i=0; i<memories.length; i++){
          var m = memories[i];
          var score = 0;
          if(queryEmb && m._embedding){
            var sim = engine.cosineSim(queryEmb, m._embedding);
            if(sim > 0.5) score += sim * 5;
          }
          var ml = (m.content||'').toLowerCase();
          if(ml.indexOf(query.toLowerCase()) >= 0) score += 4;
          if(ref && ml.indexOf(ref.content.slice(0,10)) >= 0) score += 5;
          var age = Date.now() - (m.updatedAt || m.createdAt || 0);
          if(age < 86400000) score += 2;
          else if(age < 604800000) score += 1;
          if(m.category === 'explicit_memory_request' || m.category === 'correction_rule') score += 2;
          if(score > 0) results.push({ memory:m, score:score });
        }
        results.sort(function(a,b){ return b.score - a.score; });
        return results.slice(0, limit);
      };

      /* 摄取管线：替代纯正则的 tryAutoExtractMemory */
      engine.ingest = async function(userText, messages){
        if(!loadAutoExtract()) return;
        var text = String(userText||'').trim();
        if(text.length < 6) return;

        var ref = engine.resolveReference(text, messages || []);
        var entities = engine.extractEntities(text);
        engine._lastEntities = entities;
        var implicit = engine.mineImplicit(text);
        var category = await engine.semanticClassify(text);
        var score = scoreMemory(text, category);

        if(entities.length){
          score.specificity = Math.min(score.specificity + 1, 3);
          score.confidence = Math.min(score.confidence + 1, 3);
        }
        if(implicit){ score.long_term += 1; score.future_reuse += 1; category = 'stable_preference'; }

        var decision = shouldWriteMemory(score);
        if(decision === 'discard'){
          if(implicit){
            var candContent = compressMemoryText(implicit.content);
            if(candContent.length > 6){
              var cands = loadMemoryCandidates();
              mergeCandidate(cands, candContent, 'stable_preference');
              if(cands.length > 100) cands = cands.slice(0,100);
              saveMemoryCandidates(cands);
              showCandidateConfirm(candContent);
            }
          }
          return;
        }

        var content = implicit ? compressMemoryText(implicit.content) : compressMemoryText(text);

        if(decision === 'write'){
          var memories = loadMemories();
          for(var i=0; i<memories.length; i++){
            if(contentSimilarity(memories[i].content, content) >= 0.6) return;
          }
          var tagList = [];
          entities.forEach(function(e){ if(tagList.indexOf(e.type)<0) tagList.push(e.type); });
          if(category === 'explicit_memory_request') tagList.push('用户指定');
          else if(category === 'correction_rule') tagList.push('纠错');
          else if(category === 'project_rule') tagList.push('项目规则');
          else if(category === 'stable_preference') tagList.push('偏好');
          else if(category === 'long_term_background') tagList.push('背景');
          else tagList.push('记忆');
          var newMem = {
            id:uid(), content:content, tags:tagList.length ? tagList : ['记忆'],
            category:category, createdAt:Date.now(), updatedAt:Date.now(), enabled:true,
            entities:entities, sourceRef:ref ? ref.type : null
          };
          if(engine.modelLoaded){
            var emb = await engine.embed(content);
            if(emb) newMem._embedding = emb;
          }
          memories.unshift(newMem);
          if(memories.length > 200) memories = memories.slice(0,200);
          saveMemories(memories);
          /* 同步到 IndexedDB */
          if(engine.db) try{ engine.db.memories.put(newMem).catch(function(){}); }catch(e){}
        }else{
          var candidates = loadMemoryCandidates();
          mergeCandidate(candidates, content, category);
          if(candidates.length > 100) candidates = candidates.slice(0,100);
          saveMemoryCandidates(candidates);
        }
        cleanupCandidates();
      };

      engine.initDB();
      if(engine.modelLoaded) engine._loadProtos();
      if(!engine.modelLoaded){
        var chk = setInterval(function(){
          if(window.__HF && window.__HF.loaded){
            engine.modelLoaded = true;
            engine._loadProtos();
            clearInterval(chk);
          }
        }, 2000);
      }
      engine.ready = true;
      MEMORY_ENGINE = engine;
      return engine;
    }

    /* 候选记忆确认弹窗 */
    function showCandidateConfirm(content){
      var el = document.getElementById('candidateToast');
      if(el) el.remove();
      var toast = document.createElement('div');
      toast.id = 'candidateToast';
      toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);z-index:200;background:var(--panel,#1a1c20);border:1px solid var(--border,rgba(255,255,255,.12));border-radius:16px;padding:12px 18px;box-shadow:0 12px 40px rgba(0,0,0,.3);max-width:min(420px,calc(100vw - 40px));font-size:13px;line-height:1.5;display:flex;flex-direction:column;gap:10px';
      toast.innerHTML = '<div style="color:var(--muted);font-size:12px">💡 发现候选记忆</div>' +
        '<div style="color:var(--text)">' + escapeHTML(content.slice(0,120)) + '</div>' +
        '<div style="display:flex;gap:8px;justify-content:flex-end">' +
        '<button id="candConfirmBtn" style="border:0;border-radius:10px;background:var(--accent,#7aa89f);color:white;padding:6px 16px;font:inherit;font-size:12px;cursor:pointer">记住</button>' +
        '<button id="candRejectBtn" style="border:0;border-radius:10px;background:rgba(127,127,127,.15);color:var(--muted);padding:6px 16px;font:inherit;font-size:12px;cursor:pointer">忽略</button></div>';
      document.body.appendChild(toast);
      document.getElementById('candConfirmBtn').onclick = function(){
        var mem = loadMemories();
        mem.unshift({ id:uid(), content:content, tags:['隐含偏好'], category:'stable_preference', createdAt:Date.now(), updatedAt:Date.now(), enabled:true });
        saveMemories(mem);
        toast.remove();
        var cand = loadMemoryCandidates();
        for(var i=0; i<cand.length; i++){
          if(contentSimilarity(cand[i].content, content) >= 0.6){ cand.splice(i,1); break; }
        }
        saveMemoryCandidates(cand);
        toast('已保存');
      };
      document.getElementById('candRejectBtn').onclick = function(){ toast.remove(); toast('已忽略'); };
      setTimeout(function(){ var t=document.getElementById('candidateToast'); if(t) t.remove(); }, 6000);
    }

    /* ── 入口：每次用户发完消息后调用（增强版） ── */
    function tryAutoExtractMemory(userText){
      /* 初始化引擎（只在首次调用时） */
      if(!MEMORY_ENGINE) initMemoryEngine();
      /* 有引擎时走语义管线 */
      if(MEMORY_ENGINE && MEMORY_ENGINE.ready){
        MEMORY_ENGINE.ingest(userText, activeChat().messages);
        return;
      }
      /* 引擎未就绪时用原有正则方案 */
      if(!loadAutoExtract()) return;
      var text = String(userText||'').trim();
      if(text.length < 6) return;
      var category = classifyMemory(text);
      var score = scoreMemory(text, category);
      var decision = shouldWriteMemory(score);
      if(decision === 'discard') return;
      var content = compressMemoryText(text);
      if(decision === 'write'){
        var memories = loadMemories();
        for(var i=0; i<memories.length; i++){ if(contentSimilarity(memories[i].content, content) >= 0.6) return; }
        memories.unshift({
          id: uid(), content: content,
          tags: [category === 'explicit_memory_request' ? '用户指定' : category === 'correction_rule' ? '纠错' : category === 'project_rule' ? '项目规则' : category === 'stable_preference' ? '偏好' : category === 'long_term_background' ? '背景' : '记忆'],
          category: category, createdAt: Date.now(), updatedAt: Date.now(), enabled: true
        });
        if(memories.length > 200) memories = memories.slice(0,200);
        saveMemories(memories);
      }else{
        var candidates = loadMemoryCandidates();
        mergeCandidate(candidates, content, category);
        if(candidates.length > 100) candidates = candidates.slice(0,100);
        saveMemoryCandidates(candidates);
      }
      cleanupCandidates();
    }

    /* ── 压缩记忆文本：去语气词、去无意义前缀 ── */
    function compressMemoryText(text){
      var t = text.trim();
      /* 去开头"这个"、"那个"等无意义词 */
      t = t.replace(/^(?:这个|那个|这些|那些|一个|我的)[，,\s]*/i, '');
      /* 去末尾语气词 */
      t = t.replace(/[的啊了吗呢吧哈哦嗯哟][。，!！]?$/i, '');
      /* 去重复标点 */
      t = t.replace(/([。，！？!?])\1+/g, '$1');
      /* 提取关键部分：如果有"以后都"、"每次"等规则词，确保保留 */
      if(t.length > 200) t = t.slice(0, 200);
      return t.trim();
    }
