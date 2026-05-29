;(function(){
  'use strict';
  if(window.__DAOTIAN_STREAM_SMOOTH_HOTFIX__) return;
  window.__DAOTIAN_STREAM_SMOOTH_HOTFIX__ = 'v1.1.0-water-flow';

  var nativeFetch = window.fetch;
  if(typeof nativeFetch !== 'function' || typeof ReadableStream === 'undefined') return;

  var STREAM_CFG = {
    minBatch: 1,
    maxBatch: 3,
    bufferStartDelay: 20,
    baseDelayMin: 30,
    baseDelayMax: 40,
    punctuationDelay: 60,
    paragraphDelay: 120,
    backlogFastThreshold: 180,
    backlogTurboThreshold: 420
  };

  function sleep(ms){ return new Promise(function(resolve){ setTimeout(resolve, ms); }); }

  function isLikelyChatRequest(input, init){
    try{
      var url = typeof input === 'string' ? input : (input && input.url) || '';
      var method = String((init && init.method) || '').toUpperCase();
      if(method && method !== 'POST') return false;
      if(url.indexOf('/chat') >= 0) return true;
      if(url.indexOf('/v1/chat/completions') >= 0) return true;
      return false;
    }catch(e){ return false; }
  }

  function getDeltaText(data){
    try{
      if(!data || typeof data !== 'object') return '';
      if(typeof data.content === 'string') return data.content;
      var c = data.choices && data.choices[0];
      if(c && c.delta && typeof c.delta.content === 'string') return c.delta.content;
      if(c && c.message && typeof c.message.content === 'string') return c.message.content;
      if(c && typeof c.text === 'string') return c.text;
    }catch(e){}
    return '';
  }

  function makeDataLine(content){
    return 'data: ' + JSON.stringify({ content: content }) + '\n\n';
  }

  function charLen(s){ return Array.from(String(s||'')).length; }
  function takeChars(s, n){
    var arr = Array.from(String(s||''));
    return { head: arr.slice(0,n).join(''), tail: arr.slice(n).join('') };
  }

  function chooseBatchSize(buffer){
    var len = charLen(buffer);
    if(len > STREAM_CFG.backlogTurboThreshold) return 5;
    if(len > STREAM_CFG.backlogFastThreshold) return 4;
    return STREAM_CFG.minBatch + Math.floor(Math.random() * (STREAM_CFG.maxBatch - STREAM_CFG.minBatch + 1));
  }

  function chooseDelay(chunk, bufferLeft){
    if(bufferLeft > STREAM_CFG.backlogTurboThreshold) return 14;
    if(bufferLeft > STREAM_CFG.backlogFastThreshold) return 22;
    if(/\n\n\s*$/.test(chunk)) return STREAM_CFG.paragraphDelay;
    if(/[，。！？；：,.!?;:]\s*$/.test(chunk)) return STREAM_CFG.punctuationDelay;
    return STREAM_CFG.baseDelayMin + Math.floor(Math.random() * (STREAM_CFG.baseDelayMax - STREAM_CFG.baseDelayMin + 1));
  }

  function shouldSmoothResponse(res){
    try{
      if(!res || !res.body || !res.ok) return false;
      var ct = String(res.headers && res.headers.get && res.headers.get('content-type') || '').toLowerCase();
      if(ct.indexOf('text/event-stream') >= 0) return true;
      return false;
    }catch(e){ return false; }
  }

  function smoothSseResponse(res){
    var decoder = new TextDecoder();
    var encoder = new TextEncoder();
    var reader = res.body.getReader();
    var textBuffer = '';
    var contentBuffer = '';
    var pendingTail = [];
    var startedRelease = false;
    var cancelled = false;

    async function flushContent(controller, force){
      if(!contentBuffer) return;
      if(!force && !startedRelease){
        startedRelease = true;
        await sleep(STREAM_CFG.bufferStartDelay);
      }
      while(contentBuffer && !cancelled){
        var n = force ? charLen(contentBuffer) : chooseBatchSize(contentBuffer);
        var part = takeChars(contentBuffer, n);
        contentBuffer = part.tail;
        if(part.head){ controller.enqueue(encoder.encode(makeDataLine(part.head))); }
        if(force) continue;
        await sleep(chooseDelay(part.head, charLen(contentBuffer)));
      }
    }

    function pushTailLine(line){
      if(line == null) return;
      pendingTail.push(line);
    }

    function emitTail(controller){
      while(pendingTail.length){
        var line = pendingTail.shift();
        controller.enqueue(encoder.encode(line));
      }
    }

    async function processEvent(rawEvent, controller){
      if(!rawEvent) return;
      var lines = rawEvent.split(/\r?\n/);
      var dataLines = [];
      for(var i=0;i<lines.length;i++){
        if(lines[i].indexOf('data:') === 0) dataLines.push(lines[i].slice(5).trim());
      }
      if(!dataLines.length){
        pushTailLine(rawEvent + '\n\n');
        return;
      }
      var payload = dataLines.join('\n');
      if(payload === '[DONE]'){
        await flushContent(controller, true);
        emitTail(controller);
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        return;
      }
      var data = null;
      try{ data = JSON.parse(payload); }catch(e){
        await flushContent(controller, true);
        emitTail(controller);
        controller.enqueue(encoder.encode(rawEvent + '\n\n'));
        return;
      }
      var delta = getDeltaText(data);
      if(delta){
        contentBuffer += delta;
        if(charLen(contentBuffer) >= 12){ await flushContent(controller, false); }
        return;
      }
      await flushContent(controller, true);
      emitTail(controller);
      controller.enqueue(encoder.encode(rawEvent + '\n\n'));
    }

    var stream = new ReadableStream({
      async start(controller){
        try{
          while(!cancelled){
            var r = await reader.read();
            if(r.done) break;
            textBuffer += decoder.decode(r.value, {stream:true});
            var parts = textBuffer.split(/\n\n|\r\n\r\n/);
            textBuffer = parts.pop() || '';
            for(var i=0;i<parts.length;i++){
              await processEvent(parts[i], controller);
            }
          }
          textBuffer += decoder.decode();
          if(textBuffer.trim()) await processEvent(textBuffer.trim(), controller);
          await flushContent(controller, true);
          emitTail(controller);
          controller.close();
        }catch(e){
          try{ controller.error(e); }catch(_e){}
        }
      },
      cancel(){
        cancelled = true;
        try{ reader.cancel(); }catch(e){}
      }
    });

    var headers = new Headers(res.headers);
    headers.set('x-daotian-stream-smooth', '1');
    return new Response(stream, { status: res.status, statusText: res.statusText, headers: headers });
  }

  window.fetch = async function(input, init){
    var res = await nativeFetch.apply(this, arguments);
    try{
      if(isLikelyChatRequest(input, init) && shouldSmoothResponse(res)){
        return smoothSseResponse(res);
      }
    }catch(e){
      console.warn('[stream-smooth] bypass:', e && e.message ? e.message : e);
    }
    return res;
  };

  console.log('[stream-smooth] enabled v1.1.0-water-flow');
})();
