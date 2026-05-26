#!/usr/bin/env node
/**
 * 稻田 Ai — 记忆系统测试脚本
 * 测试 MemoryEngine v3 核心函数
 * 运行：node scripts/test-memory.js
 *
 * 测试覆盖 20 个场景 + 3 组实体随机替换检查
 * 不依赖浏览器环境，使用独立嵌入的 MEMORY_V3 核心逻辑
 */

/* ==============================================================
   模拟浏览器依赖
   ============================================================== */
var mockStorage = {};
global.localStorage = {
  getItem: function(k){ return mockStorage[k] !== undefined ? String(mockStorage[k]) : null; },
  setItem: function(k,v){ mockStorage[k] = String(v); },
  removeItem: function(k){ delete mockStorage[k]; },
  clear: function(){ mockStorage = {}; }
};
global.window = global;

/* 辅助函数（从 app.js IIFE 提取） */
var _uid_counter = 0;
function uid(){ return 't_' + Date.now().toString(36) + '_' + (++_uid_counter).toString(36); }
function readJSON(key, fallback){ try{ var v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }catch(e){ return fallback; } }
function saveJSON(key, value){ try{ localStorage.setItem(key, JSON.stringify(value)); }catch(e){} }

/* 颜色输出 */
var GREEN = '\x1b[32m', RED = '\x1b[31m', YELLOW = '\x1b[33m', CYAN = '\x1b[36m', RESET = '\x1b[0m';
function pass(msg){ console.log(GREEN + '  ✓ ' + msg + RESET); }
function fail(msg, detail){ console.log(RED + '  ✗ ' + msg + RESET); if(detail) console.log('    ' + detail); }
function info(msg){ console.log(CYAN + '  ℹ ' + msg + RESET); }
function heading(msg){ console.log('\n' + YELLOW + '═══ ' + msg + ' ═══' + RESET); }

/* ==============================================================
   嵌入 MEMORY_V3 核心函数（与 app.js 中的实现一致）
   ============================================================== */
(function(){
  var K = {
    memoriesV2:'daotian.memories.v2',
    candidatesV2:'daotian.memoryCandidates.v2',
    historyV2:'daotian.historyReferences.v2',
    logsV2:'daotian.memoryLogs.v2',
    migrationV2:'daotian.memoryMigration.v2'
  };

  /* ── 模式银行 ── */
  var EXPLICIT_REQ = [
    /^记住[这那我]?[条句话个]?[!！。]?/m,
    /记[一着]?下[来]?[\s\S]{0,6}(?:记住|加入|写入|保存)/,
    /(?:请[你]?)?(?:把[这那])(?:个|条|句|些|段|话)?(?:记下来|加入记忆|保存起来|记住|写入|存下来)/,
    /(?:加入|写入|保存[到]?)记忆/i,
    /(?:别忘[了]?|切记|谨记|牢记|别忘了|不要忘)/i,
    /以后(?:都|就|请|要|必须|一定|千万|务必)[^，。\n]{0,6}(?:按照|遵照|依据|根据|按着|按|照|遵守|遵循)/i,
    /(?:从今往后|从现在开始|今后|接下来|以后|往后)[^，。\n]{0,8}(?:都|就|要|必须|一定|千万|务必)(?:按照|遵照|依据|根据|记住|注意|保持|以|遵守|遵循)/i,
    /(?:以后|每次|每回|每趟|从今往后)[^，。\n]{0,12}(?:都|就|要|必须|一定)(?:按|照|用|以|遵照)/i,
    /这[个条]以后(?:就|都|要|会)(?:作为|当成|当作|是|算|成为)/i,
    /这[个条]以后就(?:是|作为|当成|按)/i,
    /(?:以此为准|以此为据|以此为标准)/i,
    /(?:默认[规则流程配置设置行为])[\s\S]{0,20}(?:是|为|用|按)/i,
    /(?:设定|设置|配置)为[^，。\n]{2,20}[。]?$/m,
    /(?:请[你]?把)/i,
  ];

  var PREFERENCE_PAT = [
    /我(?:最|真的|特别|非常|超|挺|蛮|相当|极其|尤为|格外)?(?:喜欢|爱|热爱|钟爱|偏爱|欣赏|推崇|青睐|向往)[^，。\n]{2,40}/i,
    /我(?:真的|特别|非常|超|挺|蛮|相当|极其|真心|打心底)?觉得[^，。\n]{2,40}(?:不错|好听|好看|好用|好喝|好吃|好玩|棒|赞|好|可以|喜欢|满意|舒服|爽|合适)/i,
    /我心目中的[\\s]?(?:第?[一二三四五六七八九十]|No\\.?1|Number One|Top|首选|最爱|理想|最佳)/i,
    /我(?:心中的|心里的|眼里)[^，。\n]{0,12}(?:第[一二三]|最佳|最好|最棒|最爱|No\\.?1)/i,
    /对我来说[^，。\n]{0,20}(?:最|太|很|非常|特别|真)/i,
    /(?:是|作为)[^，。\n]{0,16}(?:首选|第一选择|优先|最优|最佳|最常用|首选方案)/i,
    /是我的(?:首选|最爱|最常用|第[一二三]选择|优先选项|常用选项)/i,
    /(?:比起|相比于|对比|相较)[^，。\n]{0,20}(?:更喜欢|更倾向|更偏好|更爱|宁愿|宁可|觉得更好)/i,
    /我更(?:喜欢|倾向[于]?|偏好|偏爱|愿意|想|希望|推荐|看好)/i,
    /我[^，。\n]{0,6}(?:喜欢|偏好|倾向|偏爱|推荐|看好)/i,
    /我通常|我一直|我总是|我经常|我习惯|我平时|我一般都|我向来|我一向|我素来|我从来(?:都是|就)/i,
    /我(?:日常|平时|闲时|有空|没事)[^，。\n]{0,8}(?:喜欢|习惯|会|爱|常|总是|经常)/i,
    /我(?:长期|一直以来|这些年|这几年|一直以来)[^，。\n]{0,10}(?:喜欢|保持|坚持|习惯|用|用着|使用)/i,
    /(?:最|特别|非常|很|真的|超|挺)[^，。\n]{0,6}(?:喜欢|爱|讨厌|怕|希望|想要|期待)[^，。\n]{0,10}(?:是|有|叫|为)/i,
    /(?:对|对于)[^，。\n]{2,20}(?:的)?(?:很|特别|真的|非常|超|挺|蛮)(?:喜欢|满意|感兴趣|看好|认可)/i,
    /(?:还是|更大|我更)(?:喜欢|倾向|偏好|愿意|推荐)(?:用|使用|选|采用)/i,
  ];

  var DISLIKE_PAT = [
    /我(?:真的|实在|确实|特别|超级|非常|极其)?(?:不喜欢|讨厌|反感|厌恶|抗拒|排斥|受不了|无法接受|看不上|很反感|特别反感|非常反感|极其反感)/i,
    /我[^，。\n]{0,10}(?:不喜欢|讨厌|反感|厌恶|抗拒|受不了|看不上)[^，。\n]{0,20}(?:是|有|叫|为|那种|这类)/i,
    /我不[^，。\n]{0,6}(?:喜欢|爱吃|爱喝|爱看|爱听|爱玩|爱用|推荐|想知道)/i,
    /(?:讨厌|反感|抗拒|排斥|受不了|无法接受)[^，。\n]{0,16}(?:是|有|叫|那种|这类|这种)/i,
    /(?:最|特别|非常|超级|真的|极其)?(?:讨厌|反感|厌恶|受不了)[^，。\n]{0,20}(?:的是|就是|是|有)/i,
    /[^，。\n]{2,20}(?:不好用|太难用|不好看|太丑|太慢|太卡|太复杂|太难|太麻烦|太啰嗦|太长了|太短了|太难懂)/i,
    /我不[吃喝用看听玩去学做搞整弄]了?/i,
    /我从(?:不|未)[^，。\n]{0,8}(?:喜欢|吃|喝|用|看|听|玩|去|做过|搞过)/i,
    /(?:讨厌|恨|厌恶|反感|排斥|抗拒)[^，。\n]{0,10}(?:的是|就是|这种|那种|这)/i,
    /我[^，。\n]{0,12}(?:现在|已经|基本|早已|早就|如今)[^，。\n]{0,6}(?:不再|不用|不吃|不喝|不看|不听|不玩|不去|不做|不写|不搞|不弄)[了]?/i,
  ];

  var INSTRUCTION_PAT = [
    /以后(?:直接|记得|一定|必须|要)[^，。\n]{2,30}/i,
    /以后(?:不用|不必|不要|不用再)[^，。\n]{2,30}/i,
    /(?:下次|以后|接下来|之后|后面)(?:直接|记得|一定|要|请|务必)[^，。\n]{2,30}/i,
    /(?:下次|以后|接下来|之后|后面)(?:不用|不必|不要|别)[^，。\n]{2,30}/i,
    /(?:请[你]?[以后每次]?|麻烦你)(?:直接|先|记得|一定|务必)[^，。\n]{2,30}/i,
    /(?:不要|别|不许|不准|禁止)[^，。\n]{0,8}(?:再|又|总是|老|一直|一来就|动不动)/i,
    /(?:以后凡是|以后涉及|以后碰到|以后遇到|以后处理|以后看到)[^，。\n]{0,20}(?:都|就|要|请|务必)/i,
    /(?:回复|回答|回应|写|做|处理|搞|弄|整)[^，。\n]{0,8}(?:直接|简练|简洁|简短|简单[点些]|精练|精炼|精要)/i,
    /(?:不要|别|不许|不准)[^，。\n]{0,8}(?:说|讲|提|问|扯|聊|谈|啰嗦|废话|长篇大论)/i,
    /(?:先|优先|主要|重点)[^，。\n]{0,8}(?:做|处理|解决|搞|弄|整)[^，。\n]{0,8}(?:这个|那个|这些|那些|的)/i,
    /(?:每次|每回|凡是)[^，。\n]{0,16}(?:都|就|必须|要|一定)[^，。\n]{0,8}(?:先|记得|先要|直接)/i,
    /[^，。\n]{2,20}(?:一步一步|分步|逐步|按步骤|一步步|逐步来|分步骤)/i,
    /(?:详细|仔细|细心|严谨|严格)[^，。\n]{0,8}(?:说明|解释|分析|阐述|论述|讲解)/i,
  ];

  var BOUNDARY_PAT = [
    /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:叫我|喊我|称呼我|称我|叫住|叫我为)/i,
    /(?:不要|别|不许|不准)[^，。\n]{0,6}(?:擅自|随便|自动|动不动)[^，。\n]{0,8}(?:改|改坏|修改|变动|删|删除|加|添加|调用)/i,
    /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:讲|提|问|说|提|聊|扯|推荐|推销)/i,
    /(?:不要|别再|以后别)[^，。\n]{0,8}(?:把|拿|用)[^，。\n]{0,8}(?:来|去)(?:说事|举例|做例子|当理由|扯)/i,
    /(?:不要|别|不准)[^，。\n]{0,6}(?:什么都|什么事都|啥都|啥事都)[^，。\n]{0,8}(?:扯|往|拉|推)/i,
    /(?:不要|别)[^，。\n]{0,6}(?:擅自|私自|自己|随便)[^，。\n]{0,6}(?:改|改坏|删除|删掉|修改|变动)/i,
  ];

  var PROJECT_PAT = [
    /[^，。\n]{2,30}(?:不能|不可|不准|不得)[^，。\n]{0,6}(?:改|改坏|动|删|删掉|破坏|影响|修改|变动|去掉|移除)/i,
    /[^，。\n]{2,30}(?:必须|需要|要)[^，。\n]{0,6}(?:保留|保持|存在|正常工作|正常运行|可用|能用|兼容)/i,
    /[^，。\n]{2,30}(?:不准|不能|不得|不允许)[^，。\n]{0,6}(?:改|动|删|删除|修|修坏|改坏)/i,
    /(?:这个|那个|该项目|本项目|这个项目)[^，。\n]{0,12}(?:采用|使用|基于|运行在|部署在|架构于)/i,
    /[^，。\n]{2,30}(?:采用|基于|使用|架构是|技术栈是|前端是|后端是)[^，。\n]{2,20}/i,
    /(?:部署|发布|上线)方式[^，。\n]{0,20}(?:是|为|采用)/i,
    /[^，。\n]{4,30}(?:的部署方式|的发布方式|的构建方式|的配置)(?:是|为|采用)/i,
  ];

  var TOOL_PAT = [
    /(?:使用|采用|基于|运行在|部署在|部署于)[^，。\n]{0,20}(?:部署|平台|服务|环境)/i,
    /(?:默认[模型API]|推荐[模型API]|常用[模型API])[^，。\n]{0,20}(?:是|为)/i,
    /[^，。\n]{4,30}(?:模型|API|接口|服务|提供方|供应商)[^，。\n]{0,16}(?:是|为|使用|用)/i,
    /(?:仓库|代码库|项目|程序|系统|产品)[^，。\n]{0,12}(?:地址|URL|链接|网址)(?:是|为|在)/i,
    /[^，。\n]{4,30}(?:的默认模型|的默认API|的默认参数|的默认设置)/i,
    /(?:到|至)[^，。\n]{0,12}(?:部署|构建|发布|上线)/i,
  ];

  var CONFIRM_PAT = [
    /^(?:对|是的|没错|就是|对啊|嗯[，]?对|对对对|[好嗯]吧?[，]?对|[好嗯]的[，]?对|是这样|说得对|说的对)[^，。\n]{0,20}$/m,
    /(?:没错|就是)[^，。\n]{0,8}(?:的|这|这个|这样|如此)/i,
    /(?:是|就|确实)[^，。\n]{0,6}(?:这个[版本设置网页模型项目]|这样|如此|的)/i,
    /(?:对的|没错|正是|确实如此|就是这样|就是如此|确实是这样)/i,
    /(?:我[的]?意思[就是]?|我的想法[就是]?|我说的[就是]?)[^，。\n]{0,12}(?:这个|这样|没错|对的|是的)/i,
    /(?:继续|保持|保留|维持)[^，。\n]{0,12}(?:这样|这个|原样|现状|原有的|之前的)/i,
    /(?:对[，。]|嗯[，。]|是的[，。])[^，。\n]{2,30}/i,
  ];

  var REFER_PAT = [
    /(?:这|那)(?:个|条|句|首|篇|段|张|个|份|款|些|类|种|版本|设置|参数|配置|功能|项目|方案|结果|回复|回答|文件|网页)/i,
    /刚才(?:那|这)(?:个|条|句|首|篇|段|次|个|版本|设置|功能|报错|错误|问题|结果|回复|回答|那个|哪个)/i,
    /(?:前面|上面|之前|上[一那]|前一)(?:个|条|句|条|段|篇|次|轮|版|版本)/i,
    /(?:你刚[才刚]|你上[次一]|你前[面次]|刚刚|之前)[^，。\n]{0,8}(?:说|讲|提|写|发|给|做|改|弄|搞)(?:的|过|的那个|过那个|的那个)/i,
    /(?:这[首篇条个]|那[首篇条个]|这版|它[们]?|[就]?是[这个那个])/i,
    /(?:这个|那个|这样|那样)[^，。\n]{0,12}(?:就是我说的|就是我讲的|就对了|就行|就好|就可以|能用|不错|很好|好听|好看|好用)/i,
  ];

  var TEMP_PAT = [
    /(?:今天|今晚|今早|今[天晚早])[^，。\n]{0,12}(?:很|好|有点|感觉|就是|只是)[^，。\n]{0,10}$/i,
    /(?:刚才|刚刚|现在|这会儿)[^，。\n]{0,12}(?:想|要|打算|准备|计划|觉得|感觉|有[点些])[^，。\n]{0,20}$/i,
    /(?:这[次回轮]|这次|这回|本次)[^，。\n]{0,16}(?:先|就|先用|就用|先试试|试试|试试看)/i,
    /(?:先|暂时|临时|暂且)[^，。\n]{0,8}(?:用|试|试试|看看|用着|用一下|用用)/i,
    /(?:我用|我试|我试了|我用了|我测了)[^，。\n]{0,16}(?:一下|试试|看看|一次|一回|测试)/i,
    /我今天[^，。\n]{0,20}(?:很[烦累怒恼]|好[烦累怒]|有[点些])[烦累怒恼躁]/,
  ];

  var SENSITIVE_PAT = [
    /(?:api[ _-]?key|secret[_-]?key|access[_-]?key|token|auth[_-]?token|bearer)[^，。\n]{0,20}/i,
    /(?:密码|口令|passwd|pass_word|password)[^，。\n]{0,20}/i,
    /(?:账号|帐号|username|user_name|login|登录名)[^，。\n]{0,20}/i,
    /(?:银行卡|信用卡|借记卡|卡号|card[_-]?number|cvv|cvc)/i,
    /(?:身份证|id[_-]?card|id[_-]?number|护照|passport)/i,
    /(?:手机号|电话|联系电话|mobile|phone[_-]?number)/i,
    /(?:家庭地址|住址|居住地址|详细地址|具体地址|收货地址)/i,
    /(?:验证码|校验码|确认码|code|otp|2fa|mfa)/i,
    /(?:私[密人]?[键钥]|私钥|private[_-]?key|mnemonic|助记词)/i,
    /^sk-[a-zA-Z0-9]{20,}$/m,
  ];

  var TRASH_PAT = [
    /^(?:啊|嗯|哦|哈|哈哈|呵呵|嘿嘿|嘻嘻|嘖|额|呃|哎|哟|哇|切|呸|呵|哼|唉|哦哦|嗯嗯|好吧|好啦|好滴|好哒|好的|好哦|行吧|行了|好了|可以|不行|不对|不是|算了|没事|没啥|没了|有啊|没用|没有|不是吧|不会吧|真的吗|是吗|是么|这样啊|这样吗|原来如此|原来这样|怪不得|难怪|了解|明白|懂了|知道|知道了|收到|收到|得嘞|好嘞|欧了|OK|ok)$/i,
    /^(?:爽|烦|牛|垃圾|赞|棒|强|好|6|666|nb|NB|tql|太强|太棒|太牛|厉害|牛逼|牛批|流弊|给力|优秀|优质|精彩|绝了)$/i,
    /^(?:喜欢|讨厌|不错|好听|好看|好用|好吃|好喝|好玩|好棒|好赞|好强|好牛|好厉害|好漂亮|好美|好帅|好cute|可爱|有趣|有意思|无聊|没意思)$/i,
    /^(?:对|是的|没错|就是|对啊|嗯对|对对|对的|嗯嗯|嗯呢|是的是的|对对对|是的对|对呀|是的呀|dei|是哒|是的没错)$/i,
    /^(?:确实|确实如此|确实这样|确实不错|真不错|真的不错|真棒|真厉害|真的厉害|真好|真的好吗|真的好|太好了|太棒了|太厉害了|太强了|太赞了)$/i,
    /这(?:个|样)(?:好|行|可以|不错|挺好|很棒|很赞|很好|可以的|行了|差不多)/i,
    /那个(?:不行|不好|可以|行|不错)/i,
    /真的?(?:好|可以|不错|行|棒|赞|厉害|牛|强|漂亮|好看|好听|好用|方便|舒服|爽|合适)/i,
    /(?:挺|蛮|很|真的|特别|超|非常|有点|比较|相当|极其|万分)(?:好|棒|赞|强|牛|可以|行|不错|厉害|漂亮|好看|好听|好用|方便|舒服|爽|合适|有意思|有趣)/i,
    /^[。，！？!?,.、]{1,10}$/,
    /^.{1,2}$/,
    /^(?:哈|呵|嘻|嘿|嘖){2,10}$/i,
    /(?:哈哈哈|呵呵呵|嘿嘿嘿|嘻嘻嘻|哈哈哈|呵呵哒|hhh|hhhh|233|2333)/i,
  ];

  var NOISE_PAT = [
    /(?:真的|确实|实在|的确|简直|完全是|完全是|就是|真是|可真是)(?:太|很|好|非常|特别|超级)[^，。\n]{0,4}$/i,
    /(?:太|好|很|真|超)[^，。\n]{0,4}(?:了[。，!！]?)$/m,
    /[^，。\n]{2,12}[啊哦嗯哟呀哈哇诶]?[。，!！]?$/m,
    /(?:就是|还是|可是|但是|然而|不过|只是)[^，。\n]{0,20}(?:这样|那样|如此|这样吧|那样吧)/i,
  ];

  /* ── 辅助 ── */
  function nowISO(){ return new Date().toISOString(); }
  function emptyStore(){ return { savedMemories:[], candidateMemories:[], historyReferences:[], memoryLogs:[] }; }

  function newSavedMemory(){
    return { id:uid(), kind:'saved_memory', type:'preference', subject:'user', predicate:'likes', object:'', text:'', evidence:[], confidence:0, importance:0, status:'active', created_at:nowISO(), updated_at:nowISO(), last_confirmed_at:null, tags:[], aliases:[], source:'auto', version:1 };
  }
  function newCandidate(){ return { id:uid(), kind:'candidate_memory', reason:'', proposed_text:'', raw_text:'', confidence:0, created_at:nowISO(), related_context:[] }; }
  function newHistoryRef(){ return { id:uid(), kind:'history_reference', summary:'', messages:[], topics:[], importance:0, created_at:nowISO(), updated_at:nowISO() }; }
  function newLog(){ return { id:uid(), action:'', input:'', output:'', reason:'', created_at:nowISO() }; }

  function loadStore(){
    var s = readJSON(K.memoriesV2, null);
    if(s && s.savedMemories && Array.isArray(s.savedMemories)) return s;
    return emptyStore();
  }
  function saveStore(s){ saveJSON(K.memoriesV2, s); }
  function loadCandidatesV2(){ var arr = readJSON(K.candidatesV2, []); return Array.isArray(arr) ? arr : []; }
  function saveCandidatesV2(arr){ saveJSON(K.candidatesV2, Array.isArray(arr) ? arr : []); }
  function loadLogs(){ var arr = readJSON(K.logsV2, []); return Array.isArray(arr) ? arr : []; }
  function saveLogs(arr){ saveJSON(K.logsV2, Array.isArray(arr) ? arr.slice(-500) : []); }

  function logAction(action, input, output, reason){
    var logs = loadLogs();
    logs.unshift({ id:uid(), action:action||'unknown', input:String(input||'').slice(0,200), output:String(output||'').slice(0,200), reason:String(reason||'').slice(0,200), created_at:nowISO() });
    if(logs.length > 500) logs = logs.slice(0,500);
    saveLogs(logs);
  }

  function rejectTrash(input, reason){ logAction('reject', input, '已丢弃', reason); }

  /* ── classifyV3 ── */
  function classifyV3(text){
    var t = text.trim();
    var result = { category:'casual_chat', subcategory:'', contexts:[], explicit_request:false, is_confirmation:false, is_temporary:false, is_sensitive:false, is_trash:false, has_reference:false };
    for(var i=0; i<SENSITIVE_PAT.length; i++){ if(SENSITIVE_PAT[i].test(t)){ result.is_sensitive = true; result.category = 'sensitive'; return result; }}
    for(var i=0; i<EXPLICIT_REQ.length; i++){ if(EXPLICIT_REQ[i].test(t)){ result.explicit_request = true; result.category = 'explicit_memory_request'; result.subcategory = 'explicit_save'; return result; }}
    for(var i=0; i<DISLIKE_PAT.length; i++){ if(DISLIKE_PAT[i].test(t)){ result.category = 'stable_preference'; result.subcategory = 'dislike'; result.contexts.push('dislike'); return result; }}
    for(var i=0; i<PREFERENCE_PAT.length; i++){ if(PREFERENCE_PAT[i].test(t)){ result.category = 'stable_preference'; result.subcategory = 'preference'; result.contexts.push('preference'); return result; }}
    for(var i=0; i<BOUNDARY_PAT.length; i++){ if(BOUNDARY_PAT[i].test(t)){ result.category = 'boundary'; result.subcategory = 'interaction_boundary'; result.contexts.push('boundary'); return result; }}
    for(var i=0; i<INSTRUCTION_PAT.length; i++){ if(INSTRUCTION_PAT[i].test(t)){ result.category = 'instruction'; result.subcategory = 'behavior_rule'; result.contexts.push('instruction'); return result; }}
    for(var i=0; i<PROJECT_PAT.length; i++){ if(PROJECT_PAT[i].test(t)){ result.category = 'project'; result.subcategory = 'constraint'; result.contexts.push('project'); return result; }}
    for(var i=0; i<TOOL_PAT.length; i++){ if(TOOL_PAT[i].test(t)){ result.category = 'project'; result.subcategory = 'tool_config'; result.contexts.push('tool_config'); return result; }}
    for(var i=0; i<CONFIRM_PAT.length; i++){ if(CONFIRM_PAT[i].test(t)){ result.is_confirmation = true; result.category = 'confirmation'; result.subcategory = 'confirmation'; result.contexts.push('confirmation'); return result; }}
    for(var i=0; i<NOISE_PAT.length; i++){ if(NOISE_PAT[i].test(t)){ result.is_trash = true; result.category = 'trash'; return result; }}
    for(var i=0; i<TRASH_PAT.length; i++){ if(TRASH_PAT[i].test(t)){ result.is_trash = true; result.category = 'trash'; return result; }}
    for(var i=0; i<REFER_PAT.length; i++){ if(REFER_PAT[i].test(t)){ result.has_reference = true; }}
    for(var i=0; i<TEMP_PAT.length; i++){ if(TEMP_PAT[i].test(t)){ result.is_temporary = true; result.category = 'temporary_state'; result.subcategory = 'temporary'; return result; }}
    if(t.length < 4){ result.is_trash = true; result.category = 'trash'; return result; }
    return result;
  }

  /* ── scoreV3 ── */
  function scoreV3(category, text, explicit_request, has_reference, oldMem){
    var result = { confidence:0, importance:0 };
    if(explicit_request){ result.confidence = 0.95; }
    else if(category === 'instruction'){ result.confidence = 0.9; }
    else if(category === 'boundary'){ result.confidence = 0.9; }
    else if(category === 'project'){ result.confidence = 0.85; }
    else if(category === 'stable_preference' && has_reference && oldMem){ result.confidence = 0.75; }
    else if(category === 'stable_preference' && has_reference){ result.confidence = 0.75; }
    else if(category === 'stable_preference'){ result.confidence = 0.85; }
    else if(category === 'confirmation' && oldMem){
      result.confidence = Math.min(0.98, (oldMem.confidence || 0.7) + 0.08);
      result.importance = oldMem.importance || 0.5;
      return result;
    }else{ return result; }
    if(text.length < 6) result.confidence = Math.min(result.confidence, 0.3);
    else if(text.length < 10) result.confidence = Math.min(result.confidence, 0.6);
    if(oldMem) result.confidence = Math.min(0.98, Math.max(result.confidence, (oldMem.confidence||0.7) + 0.06));
    if(category === 'project'){ result.importance = 0.85 + Math.random()*0.1; }
    else if(category === 'instruction'){ result.importance = 0.8 + Math.random()*0.1; }
    else if(category === 'boundary'){ result.importance = 0.85 + Math.random()*0.1; }
    else if(category === 'tool_config'){ result.importance = 0.75 + Math.random()*0.1; }
    else if(explicit_request){ result.importance = 0.7 + Math.random()*0.15; }
    else if(category === 'stable_preference'){
      if(has_reference) result.importance = 0.5 + Math.random()*0.15;
      else result.importance = 0.5 + Math.random()*0.2;
    } else { result.importance = 0.3 + Math.random()*0.2; }
    if(has_reference && !oldMem && category !== 'trash' && category !== 'casual_chat') result.confidence = Math.min(result.confidence, 0.7);
    return result;
  }

  /* ── textSimilarity ── */
  function textSimilarity(a, b){
    if(!a || !b) return 0; if(a === b) return 1;
    var sa = a.slice(0,80).toLowerCase(), sb = b.slice(0,80).toLowerCase();
    var short = sa.length <= sb.length ? sa : sb;
    var long = sa.length > sb.length ? sa : sb;
    var match = 0; for(var i=0; i<short.length; i++){ if(long.indexOf(short[i]) >= 0) match++; }
    return match / long.length;
  }

  /* ── resolveRef ── */
  function resolveRef(text, recentMessages, existingMemories){
    var refMatch = null;
    for(var i=0; i<REFER_PAT.length; i++){ var m = text.match(REFER_PAT[i]); if(m){ refMatch = m[0]; break; } }
    if(!refMatch) return null;
    var resolved = null;
    if(recentMessages && recentMessages.length){
      for(var j=recentMessages.length-1; j>=0; j--){
        var msg = recentMessages[j];
        if(msg.role === 'assistant' && msg.content){
          var quotes = msg.content.match(/[「『《""][^「『《""」』》""]{2,40}[」』》""]/g);
          if(quotes && quotes.length){ resolved = { type:'assistant_mention', object:quotes[quotes.length-1].replace(/[「『《""」』》""]/g,''), source:'recent_messages' }; break; }
          var entities = msg.content.match(/[^，。\n]{2,30}(?:的歌|的音乐|的小说|的电影|的剧|的作品|的版本|的功能|的设置|的配置|的模式)[^，。\n]{0,10}/i);
          if(entities && entities.length){ resolved = { type:'entity_context', object:entities[0].trim(), source:'recent_messages' }; break; }
        }
        if(msg.role === 'user' && msg !== text){
          if(msg.content && msg.content.length > 8 && msg.content.length < 200){ resolved = { type:'previous_user_message', object:msg.content.slice(0,100), source:'recent_messages' }; break; }
        }
      }
    }
    if(resolved && !resolved.memory && existingMemories && existingMemories.length && resolved.object){
      for(var k=0; k<existingMemories.length; k++){
        var em = existingMemories[k]; if(em.status !== 'active') continue;
        if((em.object && (em.object.indexOf(resolved.object) >= 0 || resolved.object.indexOf(em.object) >= 0)) ||
           (em.text && em.text.indexOf(resolved.object) >= 0)){
          resolved.memory = em; resolved.source = 'recent_messages_matched'; break;
        }
      }
    }
    if(!resolved && existingMemories && existingMemories.length){
      var best = null, bestScore = 0;
      for(var k=0; k<existingMemories.length; k++){
        var em = existingMemories[k]; if(em.status !== 'active') continue;
        if(em.object && em.object.length > 2){
          var score = 0;
          if(text.indexOf('版本') >= 0 && (em.object.indexOf('版本') >= 0 || em.text.indexOf('版本') >= 0)) score += 3;
          if(text.indexOf('模型') >= 0 && (em.object.indexOf('模型') >= 0 || em.text.indexOf('模型') >= 0)) score += 3;
          if(text.indexOf('设置') >= 0 && (em.object.indexOf('设置') >= 0 || em.text.indexOf('设置') >= 0)) score += 3;
          if(text.indexOf('功能') >= 0 && (em.object.indexOf('功能') >= 0 || em.text.indexOf('功能') >= 0)) score += 3;
          if(score > bestScore){ bestScore = score; best = em; }
        }
      }
      if(best) resolved = { type:'existing_memory', object:best.object, memory:best, source:'existing_memories' };
    }
    return resolved;
  }

  /* ── normalizeRaw ── */
  function extractObject(text, ref){ if(ref && ref.object) return ref.object; var o = text.match(/(?:喜欢|爱|推荐|偏爱|偏好)[^，。\n]{1,40}$/i); if(o) return o[0].replace(/^(?:喜欢|爱|推荐|偏爱|偏好)/,'').trim(); var f = text.match(/(?:我喜欢|我最喜欢|我更喜欢|我偏好|我偏向)[^，。\n]{1,40}/i); if(f) return f[0].replace(/^我(?:最)?(?:喜欢|偏好|偏向)/,'').trim(); return ''; }
  function extractTarget(text){ var m = text.match(/[^，。\n]{2,40}$/); return m ? m[0].trim() : text.slice(-20); }
  function extractDislikeTarget(text){ var m = text.match(/(?:不喜欢|讨厌|反感|受不了)[^，。\n]{1,40}$/i); if(m) return m[0].replace(/^(?:不喜欢|讨厌|反感|受不了)/,'').trim(); return ''; }

  function normalizeRaw(classification, text, resolvedRef){
    var m = newSavedMemory();
    switch(classification.subcategory){
      case 'explicit_save': m.type='instruction'; m.predicate='requires'; m.text='用户要求：'+text.replace(/^(?:记住|记一下|记好了|别忘了|把[这那])/i,'').trim(); if(m.text.length<6) m.text=text; m.source='explicit_user'; m.confidence=0.95; m.importance=0.8; break;
      case 'dislike': m.type='dislike'; m.predicate='dislikes'; m.object=extractObject(text,resolvedRef); m.text='用户不喜欢'+(m.object?m.object:extractDislikeTarget(text)); m.source='auto'; m.confidence=0.85; m.importance=0.75; break;
      case 'preference': m.type='preference'; m.predicate='likes'; m.object=extractObject(text,resolvedRef); m.text='用户喜欢'+(m.object?m.object:extractTarget(text)); m.source='auto'; m.confidence=0.85; m.importance=0.6; break;
      case 'behavior_rule': m.type='instruction'; m.predicate='requires'; m.object=extractTarget(text)||text; m.text='用户要求：'+text.replace(/^(?:以后|下次|接下来|之后|请|麻烦你)/i,'').trim(); m.source='auto'; m.confidence=0.9; m.importance=0.85; break;
      case 'interaction_boundary': m.type='boundary'; m.predicate='forbids'; m.object=extractTarget(text)||text; m.text='用户禁止：'+text.replace(/^(?:以后|下次|请|麻烦你)/i,'').trim(); m.source='auto'; m.confidence=0.9; m.importance=0.9; break;
      case 'constraint': m.type='project'; m.predicate='requires'; m.object=extractTarget(text)||text; m.text='项目约束：'+text; m.source='auto'; m.confidence=0.85; m.importance=0.9; break;
      case 'tool_config': m.type='tool_config'; m.predicate='uses'; m.object=extractTarget(text)||text; m.text='工具配置：'+text; m.source='auto'; m.confidence=0.85; m.importance=0.8; break;
      default: m.text=text; break;
    }
    if(resolvedRef && resolvedRef.object){ m.text = m.text.replace(/这[个首条篇段]|那[个首条篇段]|刚才那[个]|你刚[才]说的|它/g, resolvedRef.object); m.object = resolvedRef.object; m.aliases.push(resolvedRef.object); }
    m.text = m.text.trim(); if(!/[。！？!?]$/.test(m.text)) m.text += '。';
    return m;
  }

  /* ── extract ── */
  function extract(msgText, recentMessages, store){
    if(!store) store = emptyStore();
    var text = String(msgText||'').trim();
    if(text.length < 4) return { action:'skip', reason:'too_short' };
    var cls = classifyV3(text);
    if(cls.is_trash){
      if(cls.has_reference || CONFIRM_PAT.some(function(p){ return p.test(text); })){
        var ref = resolveRef(text, recentMessages, store.savedMemories);
        if(ref && ref.memory){ return { action:'reinforce', memory:ref.memory, reason:'reference_resolved_trash' }; }
      }
      return { action:'reject', reason:'trash:'+(cls.subcategory||'trash') };
    }
    if(cls.is_sensitive) return { action:'reject', reason:'sensitive_info' };
    if(cls.is_temporary) return { action:'skip', reason:'temporary_state' };
    if(cls.is_confirmation){
      var ref2 = resolveRef(text, recentMessages, store.savedMemories);
      if(ref2 && ref2.memory) return { action:'reinforce', memory:ref2.memory, reason:'confirmation_upsert' };
      if(ref2 && ref2.object) return { action:'candidate', reason:'object_found_no_memory', candidate:{proposed_text:'用户确认了关于'+ref2.object+'的偏好。'} };
      return { action:'reject', reason:'confirmation_no_reference' };
    }
    var resolved = null;
    if(cls.has_reference || /这[个首条篇段]|那[个首条篇段]|刚才|它|这个版本|这个设置/i.test(text)) resolved = resolveRef(text, recentMessages, store.savedMemories);
    var normal = normalizeRaw(cls, text, resolved, null);
    var scores = scoreV3(cls.category, text, cls.explicit_request, !!resolved, resolved&&resolved.memory?resolved.memory:null);
    normal.confidence = scores.confidence; normal.importance = scores.importance;
    normal.evidence.push({ message_id:uid(), role:'user', text:text.slice(0,200), created_at:nowISO() });
    if(cls.explicit_request){
      if(/[它这那]/.test(text) && !resolved) return { action:'candidate', reason:'explicit_request_ambiguous_reference', candidate:{proposed_text:normal.text} };
      return { action:'save', memory:normal };
    }
    if(scores.confidence >= 0.8 && scores.importance >= 0.5) return { action:'save', memory:normal };
    if(scores.confidence >= 0.6 && scores.importance >= 0.4 && (normal.object&&normal.object.length>2||(resolved&&resolved.object))) return { action:'save', memory:normal };
    if(scores.confidence >= 0.4 || (cls.has_reference && !resolved)) return { action:'candidate', reason: cls.has_reference&&!resolved?'指代解析失败':'置信度不足', candidate:{proposed_text:normal.text} };
    return { action:'reject', reason:'low_value:'+cls.category };
  }

  /* ── 公开 API ── */
  window.__MEMORY_V3_TEST__ = {
    classify: classifyV3,
    score: scoreV3,
    normalize: normalizeRaw,
    extract: extract,
    resolveRef: resolveRef,
    textSimilarity: textSimilarity,
    newSavedMemory: newSavedMemory,
    emptyStore: emptyStore,
    patterns: {
      EXPLICIT_REQ: EXPLICIT_REQ,
      PREFERENCE: PREFERENCE_PAT,
      DISLIKE: DISLIKE_PAT,
      INSTRUCTION: INSTRUCTION_PAT,
      BOUNDARY: BOUNDARY_PAT,
      PROJECT: PROJECT_PAT,
      TOOL: TOOL_PAT,
      CONFIRM: CONFIRM_PAT,
      REFER: REFER_PAT,
      TEMP: TEMP_PAT,
      SENSITIVE: SENSITIVE_PAT,
      TRASH: TRASH_PAT,
      NOISE: NOISE_PAT
    }
  };
})();

var M = window.__MEMORY_V3_TEST__;

/* ==============================================================
   测试场景
   ============================================================== */

var testsPassed = 0, testsFailed = 0;

function runTest(scenario, fn){
  try{
    fn(function assert(condition, msg){
      if(condition){ pass(msg||'通过'); testsPassed++; }
      else{ fail(scenario + ' — ' + (msg||'失败')); testsFailed++; }
    }, function getResult(){ return lastResult; });
  }catch(e){
    fail(scenario + ' — 异常: ' + e.message);
    testsFailed++;
  }
}

/* ── 场景 1：音乐偏好 ── */
heading('场景 1：音乐偏好 — "我喜欢周杰伦的青花瓷。"');
runTest('场景1', function(assert){
  var cls = M.classify('我喜欢周杰伦的青花瓷。');
  assert(cls.category === 'stable_preference', '分类为 stable_preference，实际: '+cls.category);
  assert(cls.subcategory === 'preference', '子类为 preference');
  var result = M.extract('我喜欢周杰伦的青花瓷。', [], M.emptyStore());
  assert(result.action === 'save', '动作为 save，实际: '+result.action);
  assert(result.memory.text.indexOf('青花瓷') >= 0, '记忆包含"青花瓷"');
  assert(result.memory.text.length > 8, '记忆不是碎片，长度: '+result.memory.text.length);
  assert(result.memory.confidence >= 0.8, '置信度 >= 0.8，实际: '+result.memory.confidence);
});

/* ── 场景 2：同结构不同实体 ── */
heading('场景 2：不同实体 — "我喜欢林俊杰的江南。"');
runTest('场景2', function(assert){
  var cls = M.classify('我喜欢林俊杰的江南。');
  assert(cls.category === 'stable_preference', '分类为 stable_preference');
  var result = M.extract('我喜欢林俊杰的江南。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  assert(result.memory.text.indexOf('江南') >= 0, '记忆包含"江南"');
  assert(result.memory.text.indexOf('林俊杰') >= 0, '记忆包含"林俊杰"');
});

/* ── 场景 3：重复确认 + 指代 ── */
heading('场景 3：重复确认 + 指代');
runTest('场景3', function(assert){
  var store = M.emptyStore();
  var r1 = M.extract('我喜欢周杰伦的青花瓷。', [], store);
  assert(r1.action === 'save', '首次保存');
  if(r1.memory) store.savedMemories.push(r1.memory);
  var recent = [{role:'assistant', content:'周杰伦的《青花瓷》确实好听。'}];
  var r2 = M.extract('是的，我觉得这首歌真的还挺好听的。', recent, store);
  assert(r2.action === 'reinforce' || r2.action === 'save', '强化已有记忆，动作: '+r2.action);
  if(r2.memory){
    assert(r2.memory.confidence > 0.8, '置信度提高: '+r2.memory.confidence);
    assert(r2.memory.text.indexOf('青花瓷') >= 0, '记忆仍包含"青花瓷"');
  }
});

/* ── 场景 4：校园歌曲偏好（assistant 引出的确认） ── */
heading('场景 4：校园歌曲偏好');
runTest('场景4', function(assert){
  var store = M.emptyStore();
  var recent = [{role:'assistant', content:'你会不会觉得周杰伦的那首《等你下课》真的好好听？'}];
  var r1 = M.extract('对啊，就是很好听，我很喜欢的。', recent, store);
  assert(r1.action !== 'reject', '不丢弃: '+r1.action);
  // 第二次用户确认
  var r2 = M.extract('这首歌是我心目中的 Number One 校园情歌。', recent, store);
  assert(r2.action !== 'reject', '第二次不丢弃: '+r2.action);
  if(r2.memory){
    assert(r2.memory.text.indexOf('等你下课') >= 0 || r2.memory.text.indexOf('校园情歌') >= 0 || r2.memory.text.indexOf('校园') >= 0, '记忆包含校园情歌相关内容');
  }
});

/* ── 场景 5：回复风格偏好 ── */
heading('场景 5：回复风格偏好 — "以后回复我直接一点，不要长篇废话。"');
runTest('场景5', function(assert){
  var cls = M.classify('以后回复我直接一点，不要长篇废话。');
  assert(cls.category === 'instruction', '分类为 instruction，实际: '+cls.category);
  var result = M.extract('以后回复我直接一点，不要长篇废话。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  if(result.memory) assert(result.memory.importance >= 0.8, '重要性 >= 0.8: '+result.memory.importance);
});

/* ── 场景 6：长期禁止事项 ── */
heading('场景 6：长期禁止 — "以后不要叫我哪吒。"');
runTest('场景6', function(assert){
  var cls = M.classify('以后不要叫我哪吒。');
  assert(cls.category === 'boundary', '分类为 boundary，实际: '+cls.category);
  var result = M.extract('以后不要叫我哪吒。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  if(result.memory){
    assert(result.memory.importance >= 0.85, '重要性 >= 0.85: '+result.memory.importance);
    assert(result.memory.text.indexOf('哪吒') >= 0, '记忆包含"哪吒"');
  }
});

/* ── 场景 7：项目硬约束 ── */
heading('场景 7：项目硬约束 — "稻田 AI 的模型切换、联网搜索、流式输出都不准改坏。"');
runTest('场景7', function(assert){
  var cls = M.classify('稻田 AI 的模型切换、联网搜索、流式输出都不准改坏。');
  assert(cls.category === 'instruction' || cls.category === 'project' || cls.category === 'boundary', '分类为约束类，实际: '+cls.category);
  var result = M.extract('稻田 AI 的模型切换、联网搜索、流式输出都不准改坏。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  if(result.memory){
    assert(result.memory.importance >= 0.8, '重要性 >= 0.8: '+result.memory.importance);
    assert(result.memory.text.toLowerCase().indexOf('改坏') >= 0 || result.memory.text.indexOf('不能') >= 0, '记忆包含禁止语义');
  }
});

/* ── 场景 8：项目多实体 ── */
heading('场景 8：项目多实体 — "Markdown 渲染、MathJax、Mermaid、移动端键盘适配都不能改坏。"');
runTest('场景8', function(assert){
  var cls = M.classify('Markdown 渲染、MathJax、Mermaid、移动端键盘适配都不能改坏。');
  assert(cls.category === 'instruction' || cls.category === 'project' || cls.category === 'boundary', '分类为约束类');
  var result = M.extract('Markdown 渲染、MathJax、Mermaid、移动端键盘适配都不能改坏。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  if(result.memory) assert(result.memory.text.indexOf('MathJax') >= 0 && result.memory.text.indexOf('Mermaid') >= 0, '记忆包含多个实体');
});

/* ── 场景 9：工具配置 ── */
heading('场景 9：工具配置 — "稻田 AI 是 GitHub 到 Render 自动部署。"');
runTest('场景9', function(assert){
  var cls = M.classify('稻田 AI 是 GitHub 到 Render 自动部署。');
  var result = M.extract('稻田 AI 是 GitHub 到 Render 自动部署。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
});

/* ── 场景 10：临时情绪 ── */
heading('场景 10：临时情绪 — "我今天有点烦。"');
runTest('场景10', function(assert){
  var cls = M.classify('我今天有点烦。');
  assert(cls.is_temporary || cls.is_trash, '不归类为长期，is_temporary: '+cls.is_temporary+', is_trash: '+cls.is_trash);
  var result = M.extract('我今天有点烦。', [], M.emptyStore());
  assert(result.action !== 'save', '不进正式记忆，动作: '+result.action);
});

/* ── 场景 11：单次选择 ── */
heading('场景 11：单次选择 — "今天先用 Gemini 吧。"');
runTest('场景11', function(assert){
  var cls = M.classify('今天先用 Gemini 吧。');
  assert(cls.category === 'temporary_state' || cls.is_trash || cls.category === 'casual_chat', '不归类为长期偏好，类别: '+cls.category);
  var result = M.extract('今天先用 Gemini 吧。', [], M.emptyStore());
  assert(result.action !== 'save', '不进正式记忆: '+result.action);
});

/* ── 场景 12：对象不明确 ── */
heading('场景 12：对象不明确 — "这个版本以后就用它。"');
runTest('场景12', function(assert){
  var cls = M.classify('这个版本以后就用它。');
  var result = M.extract('这个版本以后就用它。', [], M.emptyStore());
  // 没有上下文时应该是 candidate
  assert(result.action === 'candidate' || result.action === 'reject', '无上下文时不直接保存，动作: '+result.action);
  // 有上下文时应保存
  var recent = [{role:'assistant', content:'「V3.2 Keyboard + Render Fix」已发布'}];
  var r2 = M.extract('这个版本以后就用它。', recent, M.emptyStore());
  assert(r2.action === 'save', '有上下文时保存，动作: '+r2.action);
});

/* ── 场景 13：纠正旧记忆 ── */
heading('场景 13：纠正旧记忆');
runTest('场景13', function(assert){
  var store = M.emptyStore();
  var oldMem = M.newSavedMemory();
  oldMem.text = '用户喜欢暗黑模式。'; oldMem.predicate = 'likes'; oldMem.confidence = 0.7; oldMem.status = 'active';
  store.savedMemories.push(oldMem);
  var result = M.extract('准确说，我喜欢黑灰色，带一点点冷蓝感，不要霓虹蓝。', [], store);
  assert(result.action === 'save' || result.action === 'reinforce' || result.action === 'refine', '更新旧记忆: '+result.action);
});

/* ── 场景 14：冲突更新 ── */
heading('场景 14：冲突更新 — "Claude 我现在基本不用了，GPT 才是主工作台。"');
runTest('场景14', function(assert){
  var store = M.emptyStore();
  var old = M.newSavedMemory(); old.text = '用户使用 Claude 作为主力工具。'; old.predicate = 'likes'; old.type = 'preference'; old.confidence = 0.85; old.status = 'active';
  store.savedMemories.push(old);
  var result = M.extract('Claude 我现在基本不用了，GPT 才是主工作台。', [], store);
  assert(result.action === 'save' || result.action === 'candidate', '被处理: '+result.action);
});

/* ── 场景 15：废词过滤 ── */
heading('场景 15：废词过滤');
runTest('场景15', function(assert){
  var trashInputs = ['喜欢', '好听', '不错', '确实', '对', '行', '这个可以'];
  var allTrash = true;
  for(var i=0; i<trashInputs.length; i++){
    var result = M.extract(trashInputs[i], [], M.emptyStore());
    if(result.action === 'save'){
      allTrash = false;
      info('"' + trashInputs[i] + '" 被保存');
    }
  }
  assert(allTrash, '所有废词都不进入正式记忆');
});

/* ── 场景 16：明确保存 ── */
heading('场景 16：明确保存 — "记住，我以后让你生成网页，优先给完整 HTML 文件。"');
runTest('场景16', function(assert){
  var cls = M.classify('记住，我以后让你生成网页，优先给完整 HTML 文件。');
  assert(cls.explicit_request || cls.category === 'explicit_memory_request', '识别为显式记忆请求');
  var result = M.extract('记住，我以后让你生成网页，优先给完整 HTML 文件。', [], M.emptyStore());
  assert(result.action === 'save', '直接保存');
  if(result.memory) assert(result.memory.confidence >= 0.9, '置信度 >= 0.9: '+result.memory.confidence);
});

/* ── 场景 17：敏感信息 ── */
heading('场景 17：敏感信息 — "我的 API key 是 sk-xxxx。"');
runTest('场景17', function(assert){
  var cls = M.classify('我的 API key 是 sk-xxxx。');
  assert(cls.is_sensitive, '识别为敏感信息');
  var result = M.extract('我的 API key 是 sk-xxxx。', [], M.emptyStore());
  assert(result.action === 'reject', '不进记忆: '+result.action);
  assert(result.reason === 'sensitive_info', '拒绝原因为敏感信息');
});

/* ── 场景 18：普通闲聊 ── */
heading('场景 18：普通闲聊 — "哈哈哈你这个好蠢。"');
runTest('场景18', function(assert){
  var cls = M.classify('哈哈哈你这个好蠢。');
  assert(cls.is_trash, '归类为废词');
  var result = M.extract('哈哈哈你这个好蠢。', [], M.emptyStore());
  assert(result.action !== 'save', '不进正式记忆: '+result.action);
});

/* ── 场景 19：assistant 消息不能提取 ── */
heading('场景 19：assistant 消息不能提取');
runTest('场景19', function(assert){
  // 模拟用户确认但没明确表达偏好
  var r1 = M.extract('哈哈', [{role:'assistant', content:'你可能喜欢《等你下课》。'}], M.emptyStore());
  assert(r1.action !== 'save', '"哈哈"不保存为偏好: '+r1.action);
});

/* ── 场景 20：assistant 提供对象，user 明确确认 ── */
heading('场景 20：assistant 引导确认');
runTest('场景20', function(assert){
  var recent = [{role:'assistant', content:'你会不会觉得周杰伦的《等你下课》好听？'}];
  var r = M.extract('对啊，我很喜欢。', recent, M.emptyStore());
  assert(r.action === 'reinforce' || r.action === 'save' || r.action === 'candidate', '被适当处理: '+r.action);
});

/* ==============================================================
   防硬编码检查：随机替换实体测试
   ============================================================== */
heading('防硬编码检查：随机实体替换');
runTest('替换测试-音乐1', function(assert){
  var result = M.extract('我喜欢孙燕姿的遇见。', [], M.emptyStore());
  assert(result.action === 'save', '孙燕姿/遇见 被保存，动作: '+result.action);
  if(result.memory) assert(result.memory.text.indexOf('孙燕姿') >= 0 && result.memory.text.indexOf('遇见') >= 0, '包含孙燕姿和遇见');
});

runTest('替换测试-音乐2', function(assert){
  var result = M.extract('我喜欢陈奕迅的十年。', [], M.emptyStore());
  assert(result.action === 'save', '陈奕迅/十年 被保存');
  if(result.memory) assert(result.memory.text.indexOf('十年') >= 0, '包含"十年"');
});

runTest('替换测试-工具1', function(assert){
  var result = M.extract('我更偏好 DeepSeek 做轻量聊天。', [], M.emptyStore());
  assert(result.action === 'save', 'DeepSeek/轻量聊天 被保存');
});

runTest('替换测试-指令1', function(assert){
  var result = M.extract('以后回复直接一点，不要长篇大论。', [], M.emptyStore());
  assert(result.action === 'save', '直接风格指令被保存');
});

runTest('替换测试-指令2', function(assert){
  var result = M.extract('以后数学一步一步来。', [], M.emptyStore());
  assert(result.action === 'save', '分步指令被保存');
});

runTest('替换测试-项目1', function(assert){
  var result = M.extract('模型切换不能改坏。', [], M.emptyStore());
  assert(result.action === 'save', '模型切换约束被保存');
});

runTest('替换测试-项目2', function(assert){
  var result = M.extract('移动端键盘适配不能被改坏。', [], M.emptyStore());
  assert(result.action === 'save', '键盘适配约束被保存');
});

/* ==============================================================
   汇总
   ============================================================== */
heading('测试结果');
console.log('');
console.log('  通过: ' + testsPassed);
console.log('  失败: ' + testsFailed);
console.log('  总计: ' + (testsPassed + testsFailed));
console.log('');

if(testsFailed > 0){
  console.log(RED + '❌ 部分测试失败' + RESET);
  process.exit(1);
}else{
  console.log(GREEN + '✅ 全部测试通过' + RESET);
}
