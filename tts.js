'use strict';

/* ==============================================================
   tts.js — 文字转语音模块
   从 app.js 提取，依赖 globals.js（KEYS、defaultVoiceSettings、AUTH_USER、
   readJSON、saveJSON、toast）
   ============================================================== */

/* ── 消息 ID 工具 ── */
function makeTtsMsgId(chatId, idx){ return 'tts_' + chatId + '_' + idx; }

/* ── 语音设置 ── */
function loadVoiceSettings(){
  var raw = readJSON(KEYS.voiceSettings, null);
  var out = Object.assign({}, defaultVoiceSettings, raw && typeof raw === 'object' ? raw : {});
  if(out.provider !== 'edge' && out.provider !== 'fish'){ out.provider = 'edge'; }
  var isGuest = !AUTH_USER || !AUTH_USER.id;
  if(isGuest && out.provider === 'fish' && (!out.fishAudioApiKey || !out.fishAudioReferenceId)){
    out.provider = 'edge';
    out.edgeVoice = out.edgeVoice || 'zh-CN-XiaoxiaoNeural';
    out.edgeVoiceLabel = out.edgeVoiceLabel || '小小';
  }
  if(!out.edgeVoice) out.edgeVoice = 'zh-CN-XiaoxiaoNeural';
  if(!out.edgeVoiceLabel) out.edgeVoiceLabel = '小小';
  if(!out.rate) out.rate = '+25%';
  if(typeof out.enabled === 'undefined') out.enabled = true;
  if(out.voiceSpeedVersion !== 2){
    var speedMap = {'+0%':'+10%', '+10%':'+25%', '+25%':'+40%'};
    out.rate = speedMap[out.rate] || '+25%';
    out.voiceSpeedVersion = 2;
  }
  return out;
}
function saveVoiceSettings(v){ saveJSON(KEYS.voiceSettings, v); }
function getSafeVoiceSettingsForTts(){
  var vs = loadVoiceSettings();
  if(!vs || typeof vs !== 'object') vs = {};
  vs = Object.assign({}, defaultVoiceSettings, vs);
  if(vs.provider !== 'edge' && vs.provider !== 'fish'){ vs.provider = 'edge'; }
  var _isGuest = !AUTH_USER || !AUTH_USER.id;
  if((_isGuest || vs.provider === 'fish') && (!vs.fishAudioApiKey || !vs.fishAudioReferenceId)){ vs.provider = 'edge'; }
  if(!vs.edgeVoice) vs.edgeVoice = 'zh-CN-XiaoxiaoNeural';
  if(!vs.edgeVoiceLabel) vs.edgeVoiceLabel = '小小';
  if(!vs.rate) vs.rate = '+25%';
  if(typeof vs.enabled === 'undefined') vs.enabled = true;
  return vs;
}

/* ── Voice Cache & Pre-generation ── */
var _voiceCache = {};
function setTtsButtonError(btn, err){
  var msg = String(err && err.message ? err.message : err || '语音播放失败');
  console.error('[TTS]', msg, err || '');
  if(btn){
    btn.classList.remove('loading','playing','paused');
    btn.classList.add('error');
    setTimeout(function(){ btn.classList.remove('error'); }, 2200);
  }
  toast(msg.length > 30 ? '语音播放失败' : msg);
}
/* play one blob — used inside queue; does NOT manage _ttsPlayingIdx or button state */
function playOneBlob(blob, idx){
  return new Promise(function(resolve, reject){
    var objectUrl = URL.createObjectURL(blob);
    var a = new Audio(objectUrl);
    _ttsAudio = a;
    a.onended = function(){ _ttsAudio = null; URL.revokeObjectURL(objectUrl); resolve(); };
    a.onerror = function(){ _ttsAudio = null; URL.revokeObjectURL(objectUrl); reject(new Error('音频播放失败')); };
    a.play().catch(function(err){ URL.revokeObjectURL(objectUrl); reject(err); });
  });
}

/* playBlobQueue: sequential playback of blobs array, supports pause/resume */
async function playBlobQueue(blobs, idx, btn){
  var startIndex = _ttsQueueIndex || 0;
  _ttsQueue = blobs;
  _ttsBtn = btn;

  for(var qi = startIndex; qi < blobs.length && _ttsQueue === blobs; qi++){
    _ttsQueueIndex = qi;
    if(btn){ btn.classList.remove('loading','paused'); btn.classList.add('playing'); }
    try{
      await playOneBlob(blobs[qi], idx);
    }catch(err){
      console.error('[TTS] queue blob '+(qi+1)+'/'+blobs.length+' failed:', err && err.message ? err.message : err);
      /* skip failed segment, continue */
    }
  }

  /* finished or aborted */
  if(_ttsQueue === blobs){
    _ttsQueue = null;
    _ttsQueueIndex = 0;
    _ttsBtn = null;
    _ttsAudio = null;
    if(_ttsPlayingIdx === idx) _ttsPlayingIdx = null;
    if(btn) btn.classList.remove('playing','paused');
  }
}
function stopTtsQueue(){
  _ttsQueue = null; _ttsQueueIndex = 0;
  if(_ttsAudio){ try{ _ttsAudio.pause(); _ttsAudio = null; }catch(_e){} }
  if(_ttsBtn){ _ttsBtn.classList.remove('playing','paused','loading'); _ttsBtn = null; }
  _ttsPlayingIdx = null; _ttsPausedAt = 0;
}
function splitTextForTts(text){
  var chunks = []; var remaining = String(text||'').replace(/\s+/g,' ').trim();
  if(!remaining) return [];
  while(remaining.length > 0){
    if(remaining.length <= 400){ chunks.push(remaining); break; }
    var slice = remaining.slice(0,400);
    var brk = Math.max(slice.lastIndexOf('。'), slice.lastIndexOf('！'), slice.lastIndexOf('？'), slice.lastIndexOf('；'), slice.lastIndexOf('\n'), slice.lastIndexOf('，'), slice.lastIndexOf('、'));
    if(brk < 50) brk = 400;
    chunks.push(remaining.slice(0, brk+1));
    remaining = remaining.slice(brk+1);
  }
  return chunks.filter(function(c){ return c.trim().length >= 1; });
}

async function preGenerateVoice(msgId, text){
  if(!text || !String(text).trim().length) return;
  var vs = getSafeVoiceSettingsForTts();
  if(!vs.enabled) return;
  if(_voiceCache[msgId] && (_voiceCache[msgId].status==='ready'||_voiceCache[msgId].status==='loading')) return;
  _voiceCache[msgId] = {status:'loading'};
  try{
    var chunks = splitTextForTts(text);
    if(!chunks.length){ _voiceCache[msgId] = {status:'error', error:'text_empty'}; return; }
    var blobs = [];
    for(var ci=0; ci<chunks.length; ci++){
      var ttsB = {text:chunks[ci], provider:vs.provider, voice:vs.edgeVoice, rate:vs.rate};
      if(vs.provider==='fish'){ ttsB.fishAudioApiKey=vs.fishAudioApiKey; ttsB.fishAudioReferenceId=vs.fishAudioReferenceId; }
      var res = await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ttsB)});
      if(!res.ok) throw new Error('TTS failed: '+res.status);
      var blob = await res.blob();
      blobs.push(blob);
    }
    if(blobs.length){
      _voiceCache[msgId] = {status:'ready', blobs:blobs, error:null};
    }else{
      _voiceCache[msgId] = {status:'error', error:'No audio'};
    }
  }catch(e){
    _voiceCache[msgId] = {status:'error', error:e.message};
  }
}

/* ── TTS Engine ── */
var _ttsAudio = null;
var _ttsPlayingIdx = null;
var _ttsPausedAt = 0;
var _ttsQueue = null;
var _ttsQueueIndex = 0;
var _ttsBtn = null; // current active button during queue playback

async function handleTtsClick(idx, btn){
  if(!btn) return;
  var vs = getSafeVoiceSettingsForTts();
  if(!vs.enabled){ toast('语音功能已关闭'); return; }

  /* ── Pause/resume within same queue ── */
  if(_ttsPlayingIdx === idx && _ttsQueue){
    if(_ttsAudio && !_ttsAudio.paused){
      _ttsAudio.pause(); _ttsPausedAt = _ttsAudio.currentTime;
      btn.classList.remove('playing'); btn.classList.add('paused');
      return;
    }else if(_ttsAudio && _ttsAudio.paused){
      _ttsAudio.play();
      btn.classList.remove('paused'); btn.classList.add('playing');
      return;
    }
  }

  /* ── Different message → stop everything ── */
  if(_ttsPlayingIdx !== idx){
    stopTtsQueue();
  }

  /* ── Cached blobs → queue play ── */
  var cached = _voiceCache[idx];
  if(cached && cached.status === 'error'){ delete _voiceCache[idx]; cached = null; }
  if(cached && cached.status === 'ready' && cached.blobs && cached.blobs.length){
    var prevBtns = document.querySelectorAll('.tts-play-btn.playing,.tts-play-btn.paused');
    prevBtns.forEach(function(b){ b.classList.remove('playing','paused'); });
    _ttsPlayingIdx = idx;
    _ttsQueueIndex = 0;
    btn.classList.remove('loading','paused');
    try{
      await playBlobQueue(cached.blobs, idx, btn);
    }catch(err){
      setTtsButtonError(btn, err);
    }
    return;
  }
  if(cached && cached.status === 'loading'){
    var _ct = setTimeout(function(){
      if(_voiceCache[idx] && _voiceCache[idx].status === 'loading'){ delete _voiceCache[idx]; }
    }, 8000);
    toast('语音正在生成中...');
    return;
  }

  /* ── Live generate + queue play ── */
  var msgEl = btn.closest('.message');
  var renderEl = msgEl ? msgEl.querySelector('.assistant-render') : null;
  var plainText = renderEl ? (renderEl.textContent || renderEl.innerText || '').replace(/\s+/g,' ').trim() : '';
  if(!plainText){ console.warn('[TTS] no text'); return; }

  var chunks = splitTextForTts(plainText);
  if(!chunks.length) return;

  stopTtsQueue();
  var prevBtns2 = document.querySelectorAll('.tts-play-btn.playing,.tts-play-btn.paused,.tts-play-btn.loading');
  prevBtns2.forEach(function(b){ b.classList.remove('playing','paused','loading'); });

  btn.classList.add('loading');
  _ttsPlayingIdx = idx;
  var stopped = false;

  function stopLive(){ stopped = true; stopTtsQueue(); }

  try{
    var blobs = [];
    var consecutiveFails = 0;
    for(var ci = 0; ci < chunks.length && !stopped; ci++){
      var vss = getSafeVoiceSettingsForTts();
      var ttsBody = {text:chunks[ci], provider:vss.provider, voice:vss.edgeVoice, rate:vss.rate};
      if(vss.provider==='fish'){ ttsBody.fishAudioApiKey=vss.fishAudioApiKey; ttsBody.fishAudioReferenceId=vss.fishAudioReferenceId; }
      var res = await fetch('/api/tts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(ttsBody)});
      if(!res.ok){
        consecutiveFails++;
        if(consecutiveFails>=2){ stopTtsQueue(); setTtsButtonError(btn, new Error('语音请求失败')); break; }
        continue;
      }
      consecutiveFails = 0;
      var blob = await res.blob();
      blobs.push(blob);
    }
    if(!stopped && blobs.length){
      _voiceCache[idx] = {status:'ready', blobs:blobs, error:null};
      btn.classList.remove('loading');
      await playBlobQueue(blobs, idx, btn);
    }else if(!stopped){
      btn.classList.remove('playing','loading');
      _ttsPlayingIdx = null;
    }
  }catch(e){
    setTtsButtonError(btn, e);
  }
  btn._ttsStop = stopLive;
}

/* ── 委托点击监听（在 document 上，无需等待 DOM 就绪） ── */
document.addEventListener('click', function(e){
  var btn = e.target.closest('.tts-play-btn');
  if(btn){
    e.preventDefault(); e.stopPropagation();
    var idx = btn.getAttribute('data-tts-idx');
    if(idx) handleTtsClick(idx, btn);
    return;
  }
});
