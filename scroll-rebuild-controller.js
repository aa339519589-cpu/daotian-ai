(function(){
'use strict';
window.__DAOTIAN_SCROLL_REBUILD__='v6-stable-follow';
var KEY='daotian.autoScroll.v1';
var box=null,raf=0,locked=false,lastTouch=0,observer=null;
try{if(localStorage.getItem(KEY)!=='true')localStorage.setItem(KEY,'false')}catch(e){}
function on(){try{return localStorage.getItem(KEY)==='true'}catch(e){return false}}
function sync(){var v=on();document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){row.setAttribute('data-on',v?'1':'0');var sw=row.querySelector('.settings-toggle-switch');if(sw)sw.classList.toggle('on',v)})}
function near(){if(!box)return true;return box.scrollHeight-box.scrollTop-box.clientHeight<160}
function bottom(){if(!box)return;try{box.scrollTop=Math.max(0,box.scrollHeight-box.clientHeight)}catch(e){}}
function follow(){if(!box||!on()||locked)return;if(raf)return;raf=requestAnimationFrame(function(){raf=0;if(!box||!on()||locked)return;bottom()})}
function manual(){lastTouch=Date.now();locked=!near()}
function bind(){var el=document.getElementById('messages');if(!el||el===box)return;box=el;locked=false;try{box.style.scrollBehavior='auto';box.style.overflowY='auto';box.style.touchAction='pan-y';box.style.webkitOverflowScrolling='touch'}catch(e){}
box.addEventListener('touchstart',manual,{passive:true});box.addEventListener('pointerdown',manual,{passive:true});box.addEventListener('wheel',manual,{passive:true});box.addEventListener('scroll',function(){if(near())locked=false;else if(Date.now()-lastTouch<1200)locked=true},{passive:true});
if(observer)observer.disconnect();observer=new MutationObserver(follow);observer.observe(box,{childList:true,subtree:true,characterData:true})}
document.addEventListener('click',function(e){var row=e.target&&e.target.closest?e.target.closest('[data-param="autoScroll"]'):null;if(!row)return;setTimeout(function(){sync();locked=false;follow()},30)},true);
function tick(){bind();sync();if(on()&&!locked)follow()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
addEventListener('resize',tick,{passive:true});setInterval(tick,700);
})();