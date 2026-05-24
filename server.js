const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const MAX_BODY = 35 * 1024 * 1024;

const MIME = {
  '.html':'text/html; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml; charset=utf-8',
  '.ico':'image/x-icon'
};

function send(res, status, body, headers={}){
  res.writeHead(status, Object.assign({'Content-Type':'text/plain; charset=utf-8'}, headers));
  res.end(body);
}
function json(res, status, obj){ send(res, status, JSON.stringify(obj), {'Content-Type':'application/json; charset=utf-8'}); }
function readBody(req){
  return new Promise((resolve,reject)=>{
    let size = 0;
    const chunks = [];
    req.on('data', chunk => {
      size += chunk.length;
      if(size > MAX_BODY){ reject(new Error('请求太大，图片或文件请压小一点')); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}
function cleanBase(base){ return String(base || '').trim().replace(/\/+$/,''); }
function cleanPath(p){ p = String(p || '/v1/chat/completions').trim(); return p.startsWith('/') ? p : '/' + p; }
function buildURL(baseUrl, apiPath){
  const base = cleanBase(baseUrl || process.env.DEFAULT_BASE_URL || 'https://api.deepseek.com');
  const p = cleanPath(apiPath || process.env.DEFAULT_API_PATH || '/v1/chat/completions');
  if(base.endsWith('/v1') && p.startsWith('/v1/')) return base + p.slice(3);
  return base + p;
}
async function proxyChat(req, res){
  try{
    const raw = await readBody(req);
    const incoming = JSON.parse(raw || '{}');
    const settings = incoming.settings || {};
    const apiKey = settings.apiKey || process.env.API_KEY || process.env.DEEPSEEK_API_KEY || '';
    const target = buildURL(settings.baseUrl, settings.path);

    const body = {
      model: settings.model || 'deepseek-chat',
      messages: Array.isArray(incoming.messages) ? incoming.messages : [],
      stream: incoming.stream !== false
    };
    if(typeof settings.temperature === 'number') body.temperature = settings.temperature;
    if(typeof settings.top_p === 'number') body.top_p = settings.top_p;
    if(typeof settings.max_tokens === 'number' && settings.max_tokens > 0) body.max_tokens = settings.max_tokens;
    if(incoming.web_search) body.web_search = true;

    const headers = {'Content-Type':'application/json'};
    if(apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const upstream = await fetch(target, { method:'POST', headers, body:JSON.stringify(body) });
    const contentType = upstream.headers.get('content-type') || (body.stream ? 'text/event-stream; charset=utf-8' : 'application/json; charset=utf-8');
    res.writeHead(upstream.status, {
      'Content-Type': contentType,
      'Cache-Control':'no-cache, no-transform',
      'Connection':'keep-alive'
    });
    if(!upstream.body){ res.end(await upstream.text()); return; }
    const reader = upstream.body.getReader();
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  }catch(err){
    if(!res.headersSent) json(res, 500, { error: String(err && err.message || err) });
    else res.end();
  }
}
function serveStatic(req, res){
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if(urlPath === '/') urlPath = '/index.html';
  const file = path.normalize(path.join(ROOT, urlPath));
  if(!file.startsWith(ROOT)){ send(res, 403, 'Forbidden'); return; }
  fs.readFile(file, (err, data)=>{
    if(err){ send(res, 404, 'Not found'); return; }
    const ext = path.extname(file).toLowerCase();
    send(res, 200, data, {'Content-Type': MIME[ext] || 'application/octet-stream'});
  });
}
const server = http.createServer((req,res)=>{
  if(req.method === 'OPTIONS'){
    res.writeHead(204, {
      'Access-Control-Allow-Origin':'*',
      'Access-Control-Allow-Methods':'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers':'Content-Type, Authorization'
    });
    res.end();
    return;
  }
  if(req.url && req.url.startsWith('/api/chat')){
    if(req.method !== 'POST'){ json(res, 405, {error:'POST only'}); return; }
    proxyChat(req,res);
    return;
  }
  if(req.method === 'GET') serveStatic(req,res);
  else json(res, 405, {error:'Method not allowed'});
});
server.listen(PORT, ()=> console.log(`Daotian Ai running on ${PORT}`));
