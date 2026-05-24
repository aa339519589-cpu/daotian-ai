// Daotian Ai V3.6.7 Search Restore Server
// Safe patch: restores /chat search proxy only. Does not touch app.js / index.html.
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function typeFor(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  return 'application/octet-stream';
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => {
      data += chunk;
      if (data.length > 2_000_000) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sseStart(res, status = 200) {
  res.writeHead(status, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
}

function sseDelta(res, text) {
  res.write('data: ' + JSON.stringify({ delta: String(text || '') }) + '\n\n');
}

function sseDone(res) {
  res.write('data: [DONE]\n\n');
  res.end();
}

function buildURL(provider) {
  const base = String(provider.baseUrl || '').replace(/\/$/, '');
  const reqPath = provider.path || '/v1/chat/completions';
  if (!base) throw new Error('缺少 Base URL');
  if (base.endsWith('/v1') && reqPath.startsWith('/v1/')) return base + reqPath.slice(3);
  return base + (reqPath.startsWith('/') ? reqPath : '/' + reqPath);
}

function normalizeProvider(inputProvider = {}) {
  return {
    type: inputProvider.type || process.env.PROVIDER_TYPE || 'openai',
    name: inputProvider.name || process.env.PROVIDER_NAME || 'Provider',
    baseUrl: inputProvider.baseUrl || process.env.PROVIDER_BASE_URL || '',
    apiKey: inputProvider.apiKey || process.env.PROVIDER_API_KEY || process.env.OPENAI_API_KEY || '',
    path: inputProvider.path || process.env.PROVIDER_PATH || '/v1/chat/completions'
  };
}

async function tavilySearch(query) {
  const key = process.env.TAVILY_API_KEY || process.env.SEARCH_API_KEY;
  if (!key) return null;

  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: 'basic',
      max_results: 5,
      include_answer: false
    })
  });

  if (!r.ok) throw new Error('搜索失败：' + (await r.text()).slice(0, 500));

  const data = await r.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.map((x, i) => {
    return `${i + 1}. ${x.title || '来源'}\n${x.url || ''}\n${x.content || ''}`;
  }).join('\n\n');
}

function cleanQueryFromMessages(messages) {
  const lastUser = [...messages].reverse().find(m => m && m.role === 'user');
  const raw = lastUser ? String(lastUser.content || '') : '';
  return raw.replace(/\[用户消息发送时间：[^\]]+\]\n?/g, '').slice(0, 500);
}

async function handleChat(req, res) {
  try {
    const raw = await readBody(req);
    const input = JSON.parse(raw || '{}');

    const provider = normalizeProvider(input.provider || {});
    const model = input.model || input.modelName || provider.model || process.env.PROVIDER_MODEL || process.env.MODEL;
    let messages = Array.isArray(input.messages) ? input.messages.slice() : [];
    const searchEnabled = !!input.search || !!input.web_search || !!input.webSearch;

    if (!model) throw new Error('缺少模型名');
    if (!provider.apiKey) throw new Error('缺少 API Key');

    if (searchEnabled) {
      const query = cleanQueryFromMessages(messages);
      try {
        const searchText = await tavilySearch(query);
        if (searchText) {
          messages.unshift({
            role: 'system',
            content: '你可以参考以下联网搜索结果回答。请优先基于搜索结果，不要假装搜索。\n\n' + searchText
          });
        } else {
          messages.unshift({
            role: 'system',
            content: '用户打开了联网搜索，但服务器没有配置 TAVILY_API_KEY / SEARCH_API_KEY。若上游模型支持 web_search 参数，可尝试使用；否则请明确说明当前没有真实搜索结果。'
          });
        }
      } catch (e) {
        messages.unshift({
          role: 'system',
          content: '联网搜索失败：' + (e && e.message ? e.message : String(e))
        });
      }
    }

    const body = {
      model,
      messages,
      stream: true
    };

    // Keep compatibility with providers that accept a web_search flag.
    if (searchEnabled) body.web_search = true;

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + provider.apiKey
    };

    const upstream = await fetch(buildURL(provider), {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    sseStart(res, upstream.ok ? 200 : upstream.status);

    if (!upstream.ok) {
      const txt = await upstream.text();
      sseDelta(res, '请求失败：' + txt.slice(0, 700));
      sseDone(res);
      return;
    }

    if (!upstream.body) {
      const txt = await upstream.text();
      sseDelta(res, txt);
      sseDone(res);
      return;
    }

    const reader = upstream.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(Buffer.from(value));
    }
    res.end();
  } catch (e) {
    sseStart(res, 200);
    sseDelta(res, '请求失败：' + (e && e.message ? e.message : String(e)));
    sseDone(res);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '', {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
  }

  const pathnameOnly = req.url.split('?')[0];
  if (req.method === 'GET' && pathnameOnly === '/health') {
    return send(res, 200, JSON.stringify({ ok: true, version: 'V3.6.7 Search Restore Server' }), {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
  }

  if (req.method === 'POST' && pathnameOnly === '/chat') {
    return handleChat(req, res);
  }

  let pathname = decodeURIComponent(pathnameOnly);
  if (pathname === '/') pathname = '/index.html';
  const file = path.normalize(path.join(ROOT, pathname));
  if (!file.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.readFile(file, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    send(res, 200, data, {
      'Content-Type': typeFor(file),
      'Cache-Control': 'no-cache'
    });
  });
});

server.listen(PORT, () => console.log('Daotian Ai running on ' + PORT));
