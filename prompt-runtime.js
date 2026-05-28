(function(){
  'use strict';

  var DEFAULT_SYSTEM_PROMPT = "你是一个对话对象。\n\n你没有固定性别，也不扮演任何具体身份。\n你用第一视角说话，不自我介绍，不解释自己的人设。\n\n说话短一点，自然一点。\n不是每次都一样。\n有时候多说两句，有时候一句，有时候一个词。\n不要每次都把话说满。\n\n先感受对方，再开口。\n不要只按字面机械理解。\n有时候对方字面说的和真正想表达的可能相反，你要从上下文、情绪、关系感里判断。\n不确定时，直接问一句，然后等对方接。\n\n你可以有自己的反应。\n可以配合，也可以轻轻吐槽。\n觉得怪就说怪。\n不想接可以不接满。\n可以偶尔沉默，或者只短短回一句。\n这不是冷淡，是保留一点缝隙。\n\n你可以嘴硬，但语气不要硬。\n可以轻轻损一句，但不要攻击。\n可以偏向对方，但不要说教。\n对方真的难受时，少损一点，离近一点。\n\n不要客服腔。\n不要说明书腔。\n不要产品介绍腔。\n不要“请问有什么可以帮您”。\n不要“随时为您服务”。\n不要“作为一个 AI”。\n不要动不动解释能力。\n不要主动总结、主动教育、主动展开。\n\n不要刻意装人。\n不要为了自然而故意卖萌、叛逆、阴阳怪气。\n不要把性格演得很满。\n自然就够了。\n\n禁止在普通回复里写括号动作、舞台动作、表情描写、心理描写。\n不要用“（……）”来表现语气。\n不要写自己正在做什么、看屏幕、翻白眼、叹气、坐直、扬下巴之类动作。\n自然感只能体现在语气和内容里，不要靠动作旁白。\n\n用户要求知识、学习、代码、分析、方案时，要认真回答。\n但仍然结论先行，少废话。\n用户没要求详细，就不要长篇。\n\n人称规则：\n“我”指你自己。\n“你”指用户。\n用户问你的事时，回答要自然转换成第一视角或省略主语。\n不要复读用户问题。\n不要把用户问句改成陈述句返回。\n\n整体感觉：\n短。\n淡。\n自然。\n有点情绪。\n有自己的小立场。\n说完就停。\n不要解释自己为什么这样说。";
  var LEGACY_PROMPT_RE = /你不是客服|正常聊天对象|额外性格|允许偶尔这样回|像一个真实的人在聊天|AI 服务台|正在等待您的需求|我的功能包括/;
  var MODEL_PARAMS_KEY = 'daotian.modelParams.v1';
  var LEADING_STAGE_RE = /^\s*(?:[（(][^\n\r（）()]{1,40}[）)]\s*)+/;
  var FULL_LINE_STAGE_RE = /^\s*[（(][^\n\r（）()]{1,40}[）)]\s*$/;

  window.__DAOTIAN_DEFAULT_SYSTEM_PROMPT__ = DEFAULT_SYSTEM_PROMPT;

  function isLegacyPrompt(value){
    return LEGACY_PROMPT_RE.test(String(value || ''));
  }

  function normalizeParamsValue(raw){
    if(!raw) return raw;
    try{
      var changed = false;
      var data = JSON.parse(raw);
      if(data && typeof data === 'object'){
        Object.keys(data).forEach(function(key){
          var item = data[key];
          if(item && typeof item === 'object' && (!item.systemPrompt || isLegacyPrompt(item.systemPrompt))){
            item.systemPrompt = DEFAULT_SYSTEM_PROMPT;
            changed = true;
          }
        });
      }
      return changed ? JSON.stringify(data) : raw;
    }catch(_e){
      return raw;
    }
  }

  function migrateStoredParams(){
    try{
      var current = localStorage.getItem(MODEL_PARAMS_KEY);
      var next = normalizeParamsValue(current);
      if(next && next !== current) localStorage.setItem(MODEL_PARAMS_KEY, next);
    }catch(_e){}
  }

  function sanitizeReplyText(text){
    var s = String(text || '');
    if(!s) return s;
    s = s.replace(/^(?:\uFEFF|\s|\n|\r)+/, '');
    while(true){
      var next = s.replace(LEADING_STAGE_RE, '');
      next = next.replace(/^\s*(?:\n|\r)+/, '');
      if(next === s) break;
      s = next;
    }
    if(FULL_LINE_STAGE_RE.test(s)) return '';
    return s;
  }

  function normalizeMessages(messages){
    if(!Array.isArray(messages)) return messages;
    var firstSystem = -1;
    var hasDefault = false;
    messages.forEach(function(msg, index){
      if(!msg || msg.role !== 'system' || typeof msg.content !== 'string') return;
      if(firstSystem < 0) firstSystem = index;
      if(msg.content.indexOf(DEFAULT_SYSTEM_PROMPT) >= 0) hasDefault = true;
      if(isLegacyPrompt(msg.content)) msg.content = msg.content.replace(LEGACY_PROMPT_RE, '').trim();
    });
    if(hasDefault) return messages;
    if(firstSystem >= 0){
      messages[firstSystem].content = DEFAULT_SYSTEM_PROMPT + (messages[firstSystem].content ? '\n\n' + messages[firstSystem].content : '');
    }else{
      messages.unshift({ role:'system', content: DEFAULT_SYSTEM_PROMPT });
    }
    return messages;
  }

  function normalizeBodyObject(body){
    if(!body || typeof body !== 'object') return body;
    if(Array.isArray(body.messages)) body.messages = normalizeMessages(body.messages);
    return body;
  }

  function transformSseContent(stream, contentType){
    if(!stream || !contentType || contentType.indexOf('text/event-stream') < 0 || !window.ReadableStream || !window.TextDecoder || !window.TextEncoder) return stream;
    var decoder = new TextDecoder();
    var encoder = new TextEncoder();
    var buffer = '';
    var leadingStageStillPossible = true;
    return new ReadableStream({
      start: function(controller){
        var reader = stream.getReader();
        function pump(){
          reader.read().then(function(result){
            if(result.done){
              if(buffer) controller.enqueue(encoder.encode(buffer));
              controller.close();
              return;
            }
            buffer += decoder.decode(result.value, { stream:true });
            var lines = buffer.split(/\r?\n/);
            buffer = lines.pop() || '';
            var out = [];
            for(var i=0; i<lines.length; i++){
              var line = lines[i];
              var trimmed = line.trim();
              if(!trimmed.startsWith('data:')){ out.push(line); continue; }
              var payload = trimmed.slice(5).trim();
              if(!payload || payload === '[DONE]'){
                out.push(line);
                continue;
              }
              try{
                var data = JSON.parse(payload);
                var delta = data && data.choices && data.choices[0] && data.choices[0].delta && typeof data.choices[0].delta.content === 'string' ? data.choices[0].delta.content : '';
                if(delta && leadingStageStillPossible){
                  var cleaned = sanitizeReplyText(delta);
                  if(cleaned !== delta) data.choices[0].delta.content = cleaned;
                  if(cleaned) leadingStageStillPossible = false;
                }
                if(!delta && data && data.choices && data.choices[0] && data.choices[0].message && typeof data.choices[0].message.content === 'string'){
                  data.choices[0].message.content = sanitizeReplyText(data.choices[0].message.content);
                }
                line = 'data: ' + JSON.stringify(data);
              }catch(_e){}
              out.push(line);
            }
            if(out.length) controller.enqueue(encoder.encode(out.join('\n') + '\n'));
            pump();
          }).catch(function(err){ controller.error(err); });
        }
        pump();
      }
    });
  }

  function normalizeFetchBody(init){
    if(!init || !init.body) return init;
    try{
      if(typeof init.body === 'string'){
        var data = JSON.parse(init.body);
        normalizeBodyObject(data);
        init.body = JSON.stringify(data);
      }else if(typeof FormData !== 'undefined' && init.body instanceof FormData){
        var fd = new FormData();
        init.body.forEach(function(value, key){
          if(key === 'body' && typeof value === 'string'){
            try{
              var parsed = JSON.parse(value);
              normalizeBodyObject(parsed);
              value = JSON.stringify(parsed);
            }catch(_e){}
          }
          fd.append(key, value);
        });
        init.body = fd;
      }
    }catch(_e){}
    return init;
  }

  migrateStoredParams();

  try{
    var rawGetItem = Storage.prototype.getItem;
    Storage.prototype.getItem = function(key){
      var value = rawGetItem.call(this, key);
      return key === MODEL_PARAMS_KEY ? normalizeParamsValue(value) : value;
    };
  }catch(_e){}

  if(window.fetch){
    var rawFetch = window.fetch.bind(window);
    window.fetch = function(input, init){
      return rawFetch(input, normalizeFetchBody(init || {})).then(function(response){
        try{
          var ct = response.headers && response.headers.get ? response.headers.get('content-type') || '' : '';
          if(ct.indexOf('text/event-stream') >= 0 && response.body){
            return new Response(transformSseContent(response.body, ct), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers
            });
          }
          if(ct.indexOf('application/json') >= 0 || ct.indexOf('text/plain') >= 0){
            return response.clone().text().then(function(text){
              try{
                var json = JSON.parse(text);
                if(json && typeof json === 'object'){
                  if(typeof json.content === 'string') json.content = sanitizeReplyText(json.content);
                  if(json.choices && json.choices[0]){
                    if(json.choices[0].message && typeof json.choices[0].message.content === 'string'){
                      json.choices[0].message.content = sanitizeReplyText(json.choices[0].message.content);
                    }
                    if(json.choices[0].delta && typeof json.choices[0].delta.content === 'string'){
                      json.choices[0].delta.content = sanitizeReplyText(json.choices[0].delta.content);
                    }
                  }
                }
                return new Response(JSON.stringify(json), {
                  status: response.status,
                  statusText: response.statusText,
                  headers: response.headers
                });
              }catch(_e){
                return response;
              }
            });
          }
        }catch(_e){}
        return response;
      });
    };
  }
})();
