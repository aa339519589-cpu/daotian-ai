(function(){
'use strict';
window.__DAOTIAN_SCROLL_REBUILD__='v7-keyboard-follow';
var KEY='daotian.autoScroll.v1';
var box=null,raf=0,locked=false,lastTouch=0,observer=null;
try{if(localStorage.getItem(KEY)!=='true')localStorage.setItem(KEY,'false')}catch(e){}
function inputFocused(){var i=document.getElementById('input');return !!(i&&document.activeElement===i)}
function keyboardOpen(){return document.body.classList.contains('keyboard-open')||inputFocused()}
function on(){try{return localStorage.getItem(KEY)==='true'}catch(e){return false}}
function sync(){var v=on();document.querySelectorAll('[data-param="autoScroll"]').forEach(function(row){row.setAttribute('data-on',v?'1':'0');var sw=row.querySelector('.settings-toggle-switch');if(sw)sw.classList.toggle('on',v)})}
function near(){if(!box)return true;return box.scrollHeight-box.scrollTop-box.clientHeight<160}
function bottom(){if(!box)return;try{box.scrollTop=Math.max(0,box.scrollHeight-box.clientHeight)}catch(e){}}
function follow(){if(!box||locked)return;if(!keyboardOpen()&&!on())return;if(raf)return;raf=requestAnimationFrame(function(){raf=0;if(!box||locked)return;if(!keyboardOpen()&&!on())return;bottom()})}
function manual(){lastTouch=Date.now();locked=!near()}
function bind(){var el=document.getElementById('messages');if(!el||el===box)return;box=el;locked=false;try{box.style.scrollBehavior='auto';box.style.overflowY='auto';box.style.touchAction='pan-y';box.style.webkitOverflowScrolling='touch'}catch(e){}
box.addEventListener('touchstart',manual,{passive:true});box.addEventListener('pointerdown',manual,{passive:true});box.addEventListener('wheel',manual,{passive:true});box.addEventListener('scroll',function(){if(near())locked=false;else if(Date.now()-lastTouch<1200)locked=true},{passive:true});
if(observer)observer.disconnect();observer=new MutationObserver(follow);observer.observe(box,{childList:true,subtree:true,characterData:true})}
document.addEventListener('click',function(e){var row=e.target&&e.target.closest?e.target.closest('[data-param="autoScroll"]'):null;if(!row)return;setTimeout(function(){sync();locked=false;follow()},30)},true);
document.addEventListener('focusin',function(e){if(e&&e.target&&e.target.id==='input'){locked=false;setTimeout(follow,60);setTimeout(follow,220)}},true);
function tick(){bind();sync();if((on()||keyboardOpen())&&!locked)follow()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick,{once:true});else tick();
addEventListener('resize',tick,{passive:true});if(window.visualViewport){visualViewport.addEventListener('resize',tick,{passive:true});visualViewport.addEventListener('scroll',tick,{passive:true})}setInterval(tick,700);
})();