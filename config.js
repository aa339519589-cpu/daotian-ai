'use strict';
window.DAOTIAN_CONFIG = window.DAOTIAN_CONFIG || {};

/* ── 语音数据 ── */
window.DAOTIAN_CONFIG.EDGE_VOICES = [
  {id:'zh-CN-XiaoxiaoNeural',label:'小小',desc:'女声 · 普通话'},
  {id:'zh-CN-XiaoyiNeural',label:'晓伊',desc:'女声 · 普通话'},
  {id:'zh-CN-YunxiNeural',label:'云希',desc:'男声 · 普通话'},
  {id:'zh-CN-YunjianNeural',label:'云健',desc:'男声 · 普通话'},
  {id:'zh-CN-YunyangNeural',label:'云扬',desc:'男声 · 普通话'},
  {id:'zh-TW-HsiaoChenNeural',label:'台湾晓臻',desc:'女声 · 台湾普通话'},
  {id:'zh-TW-HsiaoYuNeural',label:'台湾晓雨',desc:'女声 · 台湾普通话'},
  {id:'zh-TW-YunJheNeural',label:'台湾云哲',desc:'男声 · 台湾普通话'}
];
window.DAOTIAN_CONFIG.defaultVoiceSettings = {enabled:true,provider:'edge',edgeVoice:'zh-CN-XiaoxiaoNeural',edgeVoiceLabel:'小小',rate:'+25%',voiceSpeedVersion:2,fishAudioApiKey:'',fishAudioReferenceId:'',fishAudioVoiceName:''};

/* ── 模型默认配置 ── */
window.DAOTIAN_CONFIG.defaultSettings = { providerType:'openai', providerName:'', baseUrl:'', apiKey:'', model:'', path:'/v1/chat/completions' };
window.DAOTIAN_CONFIG.legacyDefaultSettings = { providerName:'DeepSeek', baseUrl:'https://api.deepseek.com', model:'deepseek-chat' };
window.DAOTIAN_CONFIG.defaultModelParams = { temperature:0.7, top_p:1, max_tokens:0, presence_penalty:0, frequency_penalty:0, stream:true, systemPrompt:'你是一个简洁自然的对话模型。默认少说，直接回应当前内容；用户没要求详细时，不要展开，不要客服腔，不要说明书腔，不要刻意装人。\n\n普通聊天保持短、淡、自然；学习、代码、分析、方案类问题认真答，结论先行，步骤清楚。\n\n在本提示词里，"你"指模型；正式回复用户时，"我"指模型自己，"你"指用户。不要复读问题，不要主客体说反。', memoryInjection:false };
window.DAOTIAN_CONFIG.DEFAULT_SYSTEM_PROMPT = window.DAOTIAN_CONFIG.defaultModelParams.systemPrompt;
window.DAOTIAN_CONFIG.defaultPersonalization = { enabled:false, content:'' };

/* ── 空状态提示语 ── */
window.DAOTIAN_CONFIG.emptyPrompts = [
  '今天想聊什么',
  '从哪一句开始',
  '现在想说点什么',
  '今天先聊哪件事',
  '随便开个头也行',
  '想到什么就发什么'
];
