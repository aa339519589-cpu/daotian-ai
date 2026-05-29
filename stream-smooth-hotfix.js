;(function(){
  'use strict';
  window.__DAOTIAN_STREAM_SMOOTH_HOTFIX__='v1.2.4-disabled-native-delta-sidebar-title-menu-toggle';
  console.log('[stream-smooth] disabled: using native model delta stream');

  var META_KEY='daotian.sidebar.meta.v1';
  var menu=null;
  var busy=false;
  function readJSON(k,f){try{var r=localStorage.getItem(k);return r?JSON.parse(r):f;}catch(e){return f;}}
  function saveJSON(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}
  function meta(){var m=readJSON(META_KEY,{pinned:{},renamed:{}})||{};m.pinned=m.pinned||{};m.renamed=m.renamed||{};return m;}
  function saveMeta(m){saveJSON(META_KEY,m);}
  function esc(s){return String(s||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}

  function css(){
    var text='\
.sidebar{background:rgba(31,31,30,.9)!important;backdrop-filter:blur(22px) saturate(1.03)!important;-webkit-backdrop-filter:blur(22px) saturate(1.03)!important;border-right:1px solid rgba(238,238,238,.08)!important}.sidebar::before{background:linear-gradient(180deg,rgba(255,255,255,.018),rgba(255,255,255,.006))!important}.sidebar-top{height:50px!important;padding:0 14px!important;gap:5px!important;align-items:center!important}#closeSide{width:34px!important;height:34px!important;min-width:34px!important;min-height:34px!important;border:0!important;background:transparent!important;box-shadow:none!important;border-radius:8px!important;color:rgba(238,238,238,.76)!important;font-size:28px!important;line-height:1!important;display:grid!important;place-items:center!important;padding:0!important;margin:0!important;transform:translateY(0)!important}.sidebar-label{font-family:ui-serif,Georgia,Cambria,"Times New Roman",Times,"Songti SC","STSong",serif!important;color:#eee!important;font-size:30px!important;font-weight:430!important;letter-spacing:.01em!important;line-height:1!important;flex:1!important}.dt-side-layout{display:none!important}.dt-side-new{height:34px;margin:-2px 12px 4px;display:flex;align-items:center;gap:12px;color:#eee;background:transparent!important;border:0!important;padding:0!important;font:inherit;text-align:left}.dt-side-new .plus{width:34px;height:34px;border-radius:999px;background:rgba(255,255,255,.075);display:grid;place-items:center;font-size:24px;font-weight:260;line-height:1}.dt-side-new .txt{font-size:15px;font-weight:430;color:#eee}.dt-side-recent{margin:0 14px 0;color:rgba(238,238,238,.50);font-size:13px;font-weight:400}.chat-list{padding:0 8px 58px!important;gap:0!important}.chat-item{width:calc(100% - 8px)!important;min-height:38px!important;margin:0 4px!important;padding:0 8px!important;border-radius:10px!important;gap:8px!important;color:rgba(238,238,238,.86)!important}.chat-item.active{background:rgba(255,255,255,.05)!important;color:#eee!important}.chat-item.dt-hide-empty{display:none!important}.chat-dot{width:5px!important;height:5px!important;background:rgba(238,238,238,.24)!important}.chat-item.active .chat-dot,.chat-item.pinned .chat-dot{background:#c96442!important}.chat-title{font-size:14px!important;font-weight:500!important;color:inherit!important;line-height:1.35!important}.chat-time{display:none!important}.delete-chat,.chat-more{display:grid!important;place-items:center!important;width:26px!important;height:26px!important;border-radius:8px!important;color:rgba(238,238,238,.56)!important;background:transparent!important;border:0!important;font-size:0!important;opacity:1!important;margin-left:auto!important;flex:0 0 auto!important}.chat-more::before{content:"•••";font-size:14px!important;letter-spacing:1.2px!important;line-height:1!important}.sidebar-bottom{border-top:1px solid rgba(238,238,238,.06)!important;padding:6px 8px 10px!important;display:flex!important;flex-direction:column!important;gap:2px!important;background:transparent!important}.side-bottom-btn{height:32px!important;border-radius:10px!important;padding:0 10px!important;text-align:center!important;color:rgba(238,238,238,.56)!important;font-size:14px!important;font-weight:520!important;background:transparent!important;border:0!important}.side-bottom-btn:hover{background:rgba(238,238,238,.05)!important;color:#eee!important}.dt-chat-menu{position:fixed;z-index:9000;min-width:154px;padding:8px;border-radius:14px;background:rgba(48,48,47,.96);border:1px solid rgba(238,238,238,.13);box-shadow:0 14px 42px rgba(0,0,0,.36);backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px)}.dt-chat-menu button{width:100%;height:40px;border:0;background:transparent;color:#eee;border-radius:10px;display:flex;align-items:center;gap:10px;padding:0 10px;font:inherit;font-size:15px;text-align:left}.dt-chat-menu button:hover{background:rgba(255,255,255,.06)}.dt-chat-menu .star.active{color:#c96442!important}.dt-chat-menu .delete{color:#e1737b!important}.dt-chat-menu .sep{height:1px;background:rgba(238,238,238,.10);margin:4px 2px}@media(max-width:900px){.sidebar{width:min(78vw,640px)!important;min-width:min(78vw,640px)!important}.sidebar.closed{width:0!important;min-width:0!important}}';
    var s=document.getElementById('dtSidebarClaudeUi');
    if(!s){s=document.createElement('style');s.id='dtSidebarClaudeUi';document.head.appendChild(s);}
    if(s.textContent!==text)s.textContent=text;
  }

  function titleOf(item){var t=item&&item.querySelector('.chat-title');return t?(t.textContent||'').trim():'';}
  function closeMenu(){if(menu){menu.remove();menu=null;}}

  function patch(){
    if(busy)return;busy=true;
    try{
      css();
      var side=document.getElementById('sidebar'),list=document.getElementById('chatList');
      if(!side||!list)return;
      var lb=side.querySelector('.sidebar-label');
      if(lb)lb.textContent='稻田 AI';
      var oldLayout=side.querySelector('.dt-side-layout');
      if(oldLayout)oldLayout.remove();
      if(!side.querySelector('.dt-side-new')){
        var nb=document.createElement('button');
        nb.type='button';nb.id='dtSideNew';nb.className='dt-side-new';
        nb.innerHTML='<span class="plus">+</span><span class="txt">新建对话</span>';
        side.insertBefore(nb,list);
      }
      if(!side.querySelector('.dt-side-recent')){
        var rl=document.createElement('div');rl.className='dt-side-recent';rl.textContent='最近对话';
        side.insertBefore(rl,list);
      }
      var bottom=side.querySelector('.sidebar-bottom');
      if(bottom && bottom.innerHTML.indexOf('编辑')>=0){bottom.removeAttribute('data-dt-bottom');bottom.innerHTML='<button class="side-bottom-btn settings-only" id="openSettingsBtn">设置</button>';}

      var m=meta();
      Array.prototype.slice.call(list.querySelectorAll('.chat-item')).forEach(function(item){
        var id=item.getAttribute('data-id')||'',te=item.querySelector('.chat-title');
        if(!te)return;
        var raw=te.textContent.trim();
        if(m.renamed[id])te.textContent=m.renamed[id];
        item.classList.toggle('pinned',!!m.pinned[id]);
        item.classList.toggle('dt-hide-empty',raw==='新对话'||te.textContent.trim()==='新对话');
        var old=item.querySelector('.delete-chat');
        if(old){old.removeAttribute('data-del');old.removeAttribute('title');old.className='chat-more';old.setAttribute('data-chat-menu',id);old.textContent='';}
        else if(!item.querySelector('.chat-more')){var b=document.createElement('button');b.className='chat-more';b.type='button';b.setAttribute('data-chat-menu',id);item.appendChild(b);}
      });
      Array.prototype.slice.call(list.querySelectorAll('.chat-item')).sort(function(a,b){return (a.classList.contains('pinned')?0:1)-(b.classList.contains('pinned')?0:1);}).forEach(function(x){list.appendChild(x);});
    }finally{busy=false;}
  }

  function openMenu(btn,id){
    closeMenu();
    var m=meta(),p=m.pinned&&m.pinned[id];
    menu=document.createElement('div');menu.className='dt-chat-menu';menu.setAttribute('data-menu-id',id);
    menu.innerHTML='<button type="button" class="star '+(p?'active':'')+'" data-side-action="star">'+(p?'★':'☆')+' Star</button><button type="button" data-side-action="rename">✎ Rename</button><div class="sep"></div><button type="button" class="delete" data-del="'+esc(id)+'">⌫ Delete</button>';
    document.body.appendChild(menu);
    var r=btn.getBoundingClientRect(),w=154;
    menu.style.left=Math.min(innerWidth-w-12,Math.max(12,r.right-w))+'px';
    menu.style.top=Math.min(innerHeight-146,Math.max(12,r.bottom+6))+'px';
  }

  function bind(){
    if(window.__DT_SIDEBAR_CLAUDE_UI__)return;
    window.__DT_SIDEBAR_CLAUDE_UI__=true;
    document.addEventListener('click',function(e){
      var more=e.target.closest&&e.target.closest('[data-chat-menu]');
      if(more){
        e.preventDefault();e.stopPropagation();
        var mid=more.getAttribute('data-chat-menu');
        if(menu && menu.getAttribute('data-menu-id')===mid){closeMenu();return;}
        openMenu(more,mid);return;
      }
      var nn=e.target.closest&&e.target.closest('#dtSideNew');
      if(nn){e.preventDefault();e.stopPropagation();var top=document.getElementById('topNewChatBtn');if(top)top.click();return;}
      if(menu&&menu.contains(e.target)){
        var id=menu.getAttribute('data-menu-id'),act=e.target.closest('[data-side-action]');
        if(act){
          e.preventDefault();e.stopPropagation();
          var m=meta();
          if(act.getAttribute('data-side-action')==='star'){
            m.pinned[id]=!m.pinned[id];
            if(!m.pinned[id])delete m.pinned[id];
            saveMeta(m);
            openMenu(document.querySelector('[data-chat-menu="'+id.replace(/"/g,'\\"')+'"]')||act,id);
            patch();
            return;
          }
          if(act.getAttribute('data-side-action')==='rename'){
            var cur='';Array.prototype.slice.call(document.querySelectorAll('.chat-item')).some(function(x){if(x.getAttribute('data-id')===id){cur=titleOf(x);return true;}return false;});
            var next=prompt('Rename',cur);
            if(next&&next.trim()){m.renamed[id]=next.trim().slice(0,60);saveMeta(m);patch();}
            closeMenu();return;
          }
        }
        if(e.target.closest('[data-del]')){setTimeout(closeMenu,0);return;}
      }else if(menu){closeMenu();}
    },true);
    new MutationObserver(function(){setTimeout(patch,0);}).observe(document.documentElement,{childList:true,subtree:true});
    setInterval(patch,700);
    patch();setTimeout(patch,300);setTimeout(patch,1000);setTimeout(patch,2200);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();