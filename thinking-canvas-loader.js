(function(){
  'use strict';

  var styleId = 'thinkingCanvasLoaderStyle';
  var raf = 0;
  var list = [];
  var observer = null;

  var rays = [
    {r:.96,l:1.16,w:.98,ph:.00,lag:-.060,a:.98},
    {r:1.08,l:.88,w:.92,ph:.19,lag:.035,a:.82},
    {r:.91,l:1.05,w:1.06,ph:.37,lag:-.018,a:.94},
    {r:1.13,l:.96,w:.95,ph:.61,lag:.070,a:.86},
    {r:.98,l:1.22,w:1.02,ph:.82,lag:-.040,a:.99},
    {r:1.04,l:.82,w:.90,ph:1.06,lag:.018,a:.80},
    {r:.89,l:1.10,w:1.08,ph:1.31,lag:-.072,a:.95},
    {r:1.10,l:.93,w:.94,ph:1.57,lag:.052,a:.84},
    {r:.94,l:1.18,w:1.04,ph:1.83,lag:-.025,a:.97},
    {r:1.15,l:.86,w:.91,ph:2.07,lag:.080,a:.81},
    {r:.92,l:1.07,w:1.07,ph:2.29,lag:-.047,a:.93},
    {r:1.05,l:.97,w:.96,ph:2.53,lag:.026,a:.87}
  ];

  function css(){
    if(document.getElementById(styleId)) return;
    var s = document.createElement('style');
    s.id = styleId;
    s.textContent = '.daotian-thinking-orbit{position:relative!important;width:23px!important;height:23px!important;min-width:23px!important;min-height:23px!important;display:inline-block!important;overflow:visible!important}.daotian-thinking-orbit span{display:none!important}.dt-canvas-loader{position:absolute;left:50%;top:50%;width:23px;height:23px;transform:translate(-50%,-50%);display:block}';
    document.head.appendChild(s);
  }

  function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
  function mix(a,b,t){return a+(b-a)*t;}
  function smooth(t){t=clamp(t,0,1);return t*t*t*(t*(t*6-15)+10);}
  function gather(p){
    if(p<0.14) return 0;
    if(p<0.58) return smooth((p-0.14)/0.44);
    if(p<0.70) return 1;
    return 1-smooth((p-0.70)/0.30);
  }

  function draw(c, now){
    var dpr = Math.min(3, window.devicePixelRatio || 1);
    var size = 48;
    if(c.width !== size*dpr){c.width=size*dpr;c.height=size*dpr;}
    var ctx = c.getContext('2d');
    if(!ctx) return;
    ctx.clearRect(0,0,c.width,c.height);
    ctx.save();
    ctx.scale(dpr,dpr);

    var cx=24, cy=24, n=12, tau=Math.PI*2;
    var p=(now%1760)/1760;
    var baseGather=gather(p);
    var spin=now/3300*tau;
    var breathe=Math.sin(now/760)*0.45+Math.sin(now/1120+1.7)*0.25;

    ctx.lineCap='round';
    ctx.strokeStyle='#d86b4d';

    for(var i=0;i<n;i++){
      var m=rays[i];
      var pp=(p+m.lag+1)%1;
      var g=gather(pp);
      g=clamp(g + Math.sin(now/690 + m.ph*3.1)*0.035 + Math.sin(now/1030 + i*.73)*0.018,0,1);
      var eased=smooth(g);
      var angleJitter=Math.sin(now/980+m.ph*4.4)*0.025 + Math.sin(now/1470+i)*0.018;
      var a=spin+i*tau/n+angleJitter;

      var openR=11.9*m.r + breathe*.18;
      var closeR=1.55 + (1-m.r)*.55 + Math.sin(now/860+m.ph*5)*.18;
      var r=mix(openR,closeR,eased);

      var openLen=6.8*m.l + Math.sin(now/730+m.ph*6)*.35;
      var closeLen=16.4*m.l + Math.sin(now/510+i*.41)*1.05;
      var len=mix(openLen,closeLen,smooth(clamp(g*.94+.03,0,1)));

      var width=mix(2.75*m.w,4.55*m.w,eased);
      var alpha=mix(.56*m.a,.98,eased);
      if(baseGather>.94){
        len += Math.sin(now/260+i*.57)*.35;
        r += Math.sin(now/310+i*.69)*.16;
      }

      var bx=cx+Math.cos(a)*r;
      var by=cy+Math.sin(a)*r;
      var dx=Math.cos(a)*len/2;
      var dy=Math.sin(a)*len/2;
      ctx.globalAlpha=alpha;
      ctx.lineWidth=width;
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
