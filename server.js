const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

function send(res, status, body, headers={}){
  res.writeHead(status, headers);
  res.end(body);
}
function typeFor(file){
  if(file.endsWith('.html')) return 'text/html; charset=utf-8';
  if(file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if(file.endsWith('.css')) return 'text/css; charset=utf-8';
  if(file.endsWith('.json')) return 'application/json; charset=utf-8';
  if(file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}
function readBody(req){
  return new Promise((resolve,reject)=>{
    let data='';
    req.on('data',chunk=>{
      data += chunk;
      if(data.length > 2_000_000){ reject(new Error('body too large')); req.destroy(); }
    });
    req.on('end',()=>resolve(data));
    req.on('error',reject);
  });
}
function buildURL(provider){
  const base = String(provider.baseUrl || '').replace(/\/$/,'');
  const reqPath = provider.path || '/v1/chat/completions';
  if(!base) throw new Error('缺少 Base URL');
  if(base.endsWith('/v1') && reqPath.startsWith('/v1/')) return base + reqPath.slice(3);
  return base + (reqPath.startsWith('/') ? reqPath : '/' + reqPath);
}
async function tavilySearch(query){
  const key = process.env.TAVILY_API_KEY || process.env.SEARCH_API_KEY;
  if(!key) return null;
  const r = await fetch('https://api.tavily.com/search', {
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({api_key:key,query,search_depth:'basic',max_results:5,include_answer:false})
  });
  if(!r.ok) throw new Error('搜索失败：'+await r.text());
  const data = await r.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((x,i)=>`${i+1}. ${x.title || '来源'}\n${x.url || ''}\n${x.content || ''}`).join('\n\n');
}
async function handleChat(req,res){
  try{
    const raw = await readBody(req);
    const input = JSON.parse(raw || '{}');
    const provider = input.provider || {};
    const model = input.model;
    let messages = Array.isArray(input.messages) ? input.messages.slice() : [];
    if(!model) throw new Error('缺少模型名');
    if(!provider.apiKey) throw new Error('缺少 API Key');

    if(input.search){
      const lastUser = [...messages].reverse().find(m=>m.role === 'user');
      const query = lastUser ? String(lastUser.content || '').replace(/\[用户消息发送时间：[^\]]+\]\n?/,'').slice(0,500) : '';
      try{
        const searchText = await tavilySearch(query);
        if(searchText){
          messages.unshift({role:'system',content:'你可以参考以下联网搜索结果回答。回答中尽量说明信息来自搜索结果。\n\n'+searchText});
        }else{
          messages.unshift({role:'system',content:'用户打开了联网搜索，但服务器没有配置 TAVILY_API_KEY。若模型自身支持联网参数，可尝试；否则请说明无法完成真实联网检索。'});
        }
      }catch(e){
        messages.unshift({role:'system',content:'联网搜索失败：'+(e.message || String(e))});
      }
    }

    const body = {
      model,
      messages,
      stream: true
    };
    if(input.search) body.web_search = true;

    const headers = {'Content-Type':'application/json','Authorization':'Bearer '+provider.apiKey};
    const upstream = await fetch(buildURL(provider), {method:'POST',headers,body:JSON.stringify(body)});

    res.writeHead(upstream.ok ? 200 : upstream.status, {
      'Content-Type':'text/event-stream; charset=utf-8',
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive',
      'Access-Control-Allow-Origin':'*'
    });

    if(!upstream.ok){
      const txt = await upstream.text();
      res.write('data: '+JSON.stringify({delta:'请求失败：'+txt.slice(0,500)})+'\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    if(!upstream.body){
      const txt = await upstream.text();
      res.write('data: '+JSON.stringify({delta:txt})+'\n\n');
      res.write('data: [DONE]\n\n');
      res.end();
      return;
    }

    const reader = upstream.body.getReader();
    while(true){
      const {done,value} = await reader.read();
      if(done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  }catch(e){
    res.writeHead(200, {'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'});
    res.write('data: '+JSON.stringify({delta:'请求失败：'+(e.message || String(e))})+'\n\n');
    res.write('data: [DONE]\n\n');
    res.end();
  }
}

const server = http.createServer(async (req,res)=>{
  if(req.method === 'OPTIONS'){
    return send(res,204,'',{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Allow-Methods':'GET,POST,OPTIONS'});
  }
  if(req.method === 'POST' && req.url.split('?')[0] === '/chat') return handleChat(req,res);
  let pathname = decodeURIComponent(req.url.split('?')[0]);
  if(pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if(!file.startsWith(ROOT)) return send(res,403,'Forbidden');
  fs.readFile(file,(err,data)=>{
    if(err) return send(res,404,'Not found');
    send(res,200,data,{'Content-Type':typeFor(file),'Cache-Control':'no-cache'});
  });
});
server.listen(PORT,()=>console.log('Daotian Ai running on '+PORT));
