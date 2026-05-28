(function(){
  'use strict';

  var styleId = 'thinkingCanvasLoaderStyle';
  var raf = 0;
  var list = [];
  var observer = null;

  function css(){
    if(document.getElementById(styleId)) return;
    var s = document.createElement('style');
    s.id = styleId;
    s.textContent = '.daotian-thinking-orbit{position:relative!important;width:22px!important;height:22px!important;min-width:22px!important;min-height:22px!important;display:inline-block!important;overflow:visible!important}.daotian-thinking-orbit span{display:none!important}.dt-canvas-loader{position:absolute;left:50%;top:50%;width:22px;height:22px;transform:translate(-50%,-50%);display:block}';
    document.head.appendChild(s);
  }

  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function mix(a,b,t){return a+(b-a)*t;}
  function smooth(t){t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);}
  function gather(p){
    if(p<0.16) return 0;
    if(p<0.55) return smooth((p-0.16)/0.39);
    if(p<0.68) return 1;
    return 1-smooth((p-0.68)/0.32);
  }

  function draw(c, now){
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var size = 44;
    if(c.width !== size*dpr){c.width=size*dpr;c.height=size*dpr;}
    var ctx = c.getContext('2d');
    if(!ctx) return;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.save();
    ctx.scale(dpr,dpr);
    var cx=22, cy=22, n=12, tau=Math.PI*2;
    var p=(now%1680)/1680;
    var g=gather(p);
    var spin=now/2400*tau;
    ctx.lineCap='round';
    ctx.strokeStyle='#d86b4d';
    for(var i=0;i<n;i++){
      var local=clamp(g + Math.sin(now/620+i*1.17)*0.018,0,1);
      var a=spin+i*tau/n;
      var r=mix(11.8,2.1,local);
      var len=mix(7.8,17.6,smooth(local));
      var w=mix(3.2,4.8,smooth(local));
      var bx=cx+Math.cos(a)*r;
      var by=cy+Math.sin(a)*r;
      var dx=Math.cos(a)*len/2;
      var dy=Math.sin(a)*len/2;
      ctx.globalAlpha=mix(.76,1,smooth(local));
      ctx.lineWidth=w;
      ctx.beginPath();
      ctx.moveTo(bx-dx,by-dy);
      ctx.lineTo(bx+dx,by+dy);
      ctx.stroke();
    }
    ctx.restore();
  }

  function loop(now){
    raf=0;
    list=list.filter(function(c){return c&&c.isConnected;});
    for(var i=0;i<list.length;i++) draw(list[i],now);
    if(list.length) raf=requestAnimationFrame(loop);
  }
  function startLoop(){if(!raf) raf=requestAnimationFrame(loop);}

  function upgrade(node){
    if(!node || node.getAttribute('data-canvas-loader')==='1') return;
    node.setAttribute('data-canvas-loader','1');
    node.innerHTML='';
    var c=document.createElement('canvas');
    c.className='dt-canvas-loader';
    c.setAttribute('aria-hidden','true');
    node.appendChild(c);
    list.push(c);
    startLoop();
  }

  function scan(){
    css();
    var arr=document.querySelectorAll('.daotian-thinking-orbit');
    for(var i=0;i<arr.length;i++) upgrade(arr[i]);
  }

  function boot(){
    scan();
    if(observer) return;
    observer=new MutationObserver(scan);
    observer.observe(document.documentElement,{childList:true,subtree:true});
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
