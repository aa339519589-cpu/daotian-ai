const __nf = globalThis.fetch;

function __anthropicHost(url){
  try{ return /anthropic/i.test(new URL(String(url)).hostname); }catch{ return /anthropic/i.test(String(url||'')); }
}
function __claudeBody(body){
  try{ const j = JSON.parse(String(body||'{}')); return /^claude[-_]/i.test(String(j.model||'')); }catch{ return false; }
}
function __bearer(headers){
  const k = 'author' + 'ization';
  let v = '';
  try{ v = typeof headers?.get === 'function' ? (headers.get(k) || headers.get('Authorization') || '') : (headers?.[k] || headers?.Authorization || ''); }catch{}
  return String(v).replace(/^Bearer\s+/i,'').trim();
}
function __text(c){
  if(typeof c === 'string') return c;
  if(Array.isArray(c)) return c.map(p=>typeof p==='string'?p:(p&&p.type==='text'?p.text||'':'')).join('\n');
  return String(c||'');
}
function __convertMessages(list){
  let system = '';
  const messages = [];
  for(const m of Array.isArray(list)?list:[]){
    if(!m || !m.role) continue;
    const t = __text(m.content);
    if(!t) continue;
    if(m.role === 'system'){ system += (system?'\n\n':'') + t; continue; }
    if(m.role !== 'user' && m.role !== 'assistant') continue;
    const last = messages[messages.length-1];
    if(last && last.role === m.role) last.content += '\n\n' + t;
    else messages.push({ role:m.role, content:t });
  }
  if(!messages.length) messages.push({ role:'user', content:' ' });
  return { system, messages };
}
function __openaiChunk(t){ return 'data: ' + JSON.stringify({ choices:[{ delta:{ content:String(t||'') } }] }) + '\n\n'; }
function __done(){ return 'data: [DONE]\n\n'; }

async function __anthropicFetch(_url, init={}){
  let src = {};
  try{ src = JSON.parse(String(init.body||'{}')); }catch{}
  const cm = __convertMessages(src.messages || []);
  const req = {
    model:String(src.model || 'claude-sonnet-4-5'),
    max_tokens:Number(src.max_tokens || src.maxTokens || 4096) || 4096,
    messages:cm.messages,
    stream:src.stream !== false
  };
  if(cm.system) req.system = cm.system;
  if(typeof src.temperature === 'number') req.temperature = src.temperature;
  if(typeof src.top_p === 'number') req.top_p = src.top_p;
  if(src.thinking) req.thinking = src.thinking;
  if(Array.isArray(src.tools)) req.tools = src.tools;
  if(src.tool_choice) req.tool_choice = src.tool_choice;

  const h = {};
  h['content-type'] = 'application/json';
  h['x-' + 'api-' + 'key'] = __bearer(init.headers);
  h['anthropic-version'] = '2023-06-01';
  h['anthropic-beta'] = 'fine-grained-tool-streaming-2025-05-14';
  const up = await __nf('https://api.anthropic.com/v1/messages', { method:'POST', signal:init.signal, headers:h, body:JSON.stringify(req) });

  if(!req.stream){
    const txt = await up.text();
    let data = null; try{ data = JSON.parse(txt); }catch{}
    if(!up.ok) return new Response(txt, { status:up.status, headers:{'content-type':up.headers.get('content-type') || 'application/json'} });
    const content = Array.isArray(data?.content) ? data.content.map(p=>p?.text || '').join('') : '';
    return new Response(JSON.stringify({ choices:[{ message:{ content } }], usage:data?.usage || null, raw:data }), { status:up.status, headers:{'content-type':'application/json'} });
  }
  if(!up.ok || !up.body){
    const txt = await up.text().catch(()=>'');
    return new Response(txt, { status:up.status, headers:{'content-type':up.headers.get('content-type') || 'application/json'} });
  }

  const enc = new TextEncoder();
  const dec = new TextDecoder();
  const reader = up.body.getReader();
  let buf = '';
  let usage = null;
  const stream = new ReadableStream({
    async start(controller){
      try{
        while(true){
          const r = await reader.read();
          if(r.done) break;
          buf += dec.decode(r.value, {stream:true});
          const events = buf.split(/\r?\n\r?\n/);
          buf = events.pop() || '';
          for(const evt of events){
            const lines = evt.split(/\r?\n/);
            let ev = '';
            const ds = [];
            for(const line of lines){
              if(line.startsWith('event:')) ev = line.slice(6).trim();
              else if(line.startsWith('data:')) ds.push(line.slice(5).trim());
            }
            if(!ds.length) continue;
            let data = null; try{ data = JSON.parse(ds.join('\n')); }catch{ continue; }
            if(data?.usage) usage = data.usage;
            if(ev === 'content_block_delta' || data.type === 'content_block_delta'){
              const d = data.delta || {};
              if(d.type === 'text_delta' && d.text) controller.enqueue(enc.encode(__openaiChunk(d.text)));
            }else if(ev === 'message_delta' || data.type === 'message_delta'){
              if(data.usage) usage = data.usage;
            }else if(ev === 'error' || data.type === 'error'){
              controller.enqueue(enc.encode('data: ' + JSON.stringify({ error:data.error || data }) + '\n\n'));
            }
          }
        }
        controller.enqueue(enc.encode('data: ' + JSON.stringify({ usage:usage || null }) + '\n\n'));
        controller.enqueue(enc.encode(__done()));
        controller.close();
      }catch(e){ try{ controller.error(e); }catch{} }
    },
    cancel(){ try{ reader.cancel(); }catch{} }
  });
  return new Response(stream, { status:up.status, headers:{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','connection':'keep-alive','x-daotian-anthropic-native':'1'} });
}

globalThis.fetch = function(input, init={}){
  const url = typeof input === 'string' ? input : input?.url;
  if((__anthropicHost(url) || __claudeBody(init?.body)) && String(init?.method || 'GET').toUpperCase() === 'POST') return __anthropicFetch(url, init);
  return __nf(input, init);
};
console.log('[anthropic-native-stream] active');
