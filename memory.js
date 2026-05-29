'use strict';

/* ==============================================================
   memory.js — 记忆引擎模块
   从 app.js 提取，依赖 globals.js（KEYS、readJSON、saveJSON）
   ============================================================== */

/* ============================================================
   MemoryEngine v3 — 双层记忆系统
   独立区块，不改动任何现有函数。
   新数据流：提取 → 规范化 → 分类 → 评分 → 决策 → upsert/候选/丢弃
   ============================================================ */
   var MEMORY_V3 = (function(){
    /* ── 存储 key（不冲突旧 key） ── */
    var K = {
      memoriesV2:'daotian.memories.v2',
      candidatesV2:'daotian.memoryCandidates.v2',
      historyV2:'daotian.historyReferences.v2',
      logsV2:'daotian.memoryLogs.v2',
      settingsV2:'daotian.memorySettings.v2',
      migrationV2:'daotian.memoryMigration.v2'
    };

    /* ==============================================================
       模式银行（200+ 通用触发模式，不针对任何具体实体）
       按语义分组，每组按触发强度降序排列
       ============================================================== */

    /* ── A. 显式记忆请求（~25 模式） ── */
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

    /* ── B. 明确长期偏好（~40 模式） ── */
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

    /* ── C. 明确厌恶 / 禁止（~25 模式） ── */
    var DISLIKE_PAT = [
      /我(?:真的|实在|确实|特别|超级|非常|极其)?(?:不喜欢|讨厌|反感|厌恶|抗拒|排斥|受不了|无法接受|看不上|很反感|特别反感|非常反感|极其反感)/i,
      /我[^，。\n]{0,10}(?:不喜欢|讨厌|反感|厌恶|抗拒|受不了|看不上)[^，。\n]{0,20}(?:是|有|叫|为|那种|这类)/i,
      /我不[^，。\n]{0,6}(?:喜欢|爱吃|爱喝|爱看|爱听|爱玩|爱用|推荐|想知道)/i,
      /(?:讨厌|反感|抗拒|排斥|受不了|无法接受)[^，。\n]{0,16}(?:是|有|叫|那种|这类|这种)/i,
      /(?:最|特别|非常|超级|真的|极其)?(?:讨厌|反感|厌恶|受不了)[^，。\n]{0,20}(?:的是|就是|是|有)/i,
      /[^，。\n]{2,20}(?:不好用|太难用|不好看|太丑|太慢|太卡|太复杂|太难|太麻烦|太啰嗦|太啰嗦|太长了|太短了|太难懂)/i,
      /我不[吃喝用看听玩去学做搞整弄]了?/i,
      /我从(?:不|未)[^，。\n]{0,8}(?:喜欢|吃|喝|用|看|听|玩|去|做过|搞过)/i,
      /(?:讨厌|恨|厌恶|反感|排斥|抗拒)[^，。\n]{0,10}(?:的是|就是|这种|那种|这)/i,
      /我[^，。\n]{0,12}(?:现在|已经|基本|早已|早就|如今)[^，。\n]{0,6}(?:不再|不用|不吃|不喝|不看|不听|不玩|不去|不做|不写|不搞|不弄)[了]?/i,
    ];

    /* ── D. 指令 / 行为规则（~30 模式） ── */
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

    /* ── E. 交互边界（~15 模式） ── */
    var BOUNDARY_PAT = [
      /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:叫我|喊我|称呼我|称我|叫住|叫我为)/i,
      /(?:不要|别|不许|不准)[^，。\n]{0,6}(?:擅自|随便|自动|动不动)[^，。\n]{0,8}(?:改|改坏|修改|变动|删|删除|加|添加|调用)/i,
      /(?:不要|别|不许|不准|禁止)[^，。\n]{0,6}(?:讲|提|问|说|提|聊|扯|推荐|推销)/i,
      /(?:不要|别再|以后别)[^，。\n]{0,8}(?:把|拿|用)[^，。\n]{0,8}(?:来|去)(?:说事|举例|做例子|当理由|扯)/i,
      /(?:不要|别|不准)[^，。\n]{0,6}(?:什么都|什么事都|啥都|啥事都)[^，。\n]{0,8}(?:扯|往|拉|推)/i,
      /(?:不要|别)[^，。\n]{0,6}(?:擅自|私自|自己|随便)[^，。\n]{0,6}(?:改|改坏|删除|删掉|修改|变动)/i,
    ];

    /* ── F. 项目硬约束（~15 模式） ── */
    var PROJECT_PAT = [
      /[^，。\n]{2,30}(?:不能|不可|不准|不得)[^，。\n]{0,6}(?:改|改坏|动|删|删掉|破坏|影响|修改|变动|去掉|移除)/i,
      /[^，。\n]{2,30}(?:必须|需要|要)[^，。\n]{0,6}(?:保留|保持|存在|正常工作|正常运行|可用|能用|兼容)/i,
      /[^，。\n]{2,30}(?:不准|不能|不得|不允许)[^，。\n]{0,6}(?:改|动|删|删除|修|修坏|改坏)/i,
      /(?:这个|那个|该项目|本项目|这个项目)[^，。\n]{0,12}(?:采用|使用|基于|运行在|部署在|架构于)/i,
      /[^，。\n]{2,30}(?:采用|基于|使用|架构是|技术栈是|前端是|后端是)[^，。\n]{2,20}/i,
      /(?:部署|发布|上线)方式[^，。\n]{0,20}(?:是|为|采用)/i,
      /[^，。\n]{4,30}(?:的部署方式|的发布方式|的构建方式|的配置)(?:是|为|采用)/i,
    ];

    /* ── G. 工具 / API / 部署配置（~18 模式） ── */
    var TOOL_PAT = [
      /(?:使用|采用|基于|运行在|部署在|部署于)[^，。\n]{0,20}(?:部署|平台|服务|环境)/i,
      /(?:默认[模型API]|推荐[模型API]|常用[模型API])[^，。\n]{0,20}(?:是|为)/i,
      /[^，。\n]{4,30}(?:模型|API|接口|服务|提供方|供应商)[^，。\n]{0,16}(?:是|为|使用|用)/i,
      /(?:仓库|代码库|项目|程序|系统|产品)[^，。\n]{0,12}(?:地址|URL|链接|网址)(?:是|为|在)/i,
      /[^，。\n]{4,30}(?:的默认模型|的默认API|的默认参数|的默认设置)/i,
      /(?:到|至)[^，。\n]{0,12}(?:部署|构建|发布|上线)/i,
    ];

    /* ── H. 确认 / 强化模式（~25 模式） ── */
    var CONFIRM_PAT = [
      /^(?:对|是的|没错|就是|对啊|嗯[，]?对|对对对|[好嗯]吧?[，]?对|[好嗯]的[，]?对|是这样|说得对|说的对)[^，。\n]{0,20}$/m,
      /(?:没错|就是)[^，。\n]{0,8}(?:的|这|这个|这样|如此)/i,
      /(?:是|就|确实)[^，。\n]{0,6}(?:这个[版本设置网页模型项目]|这样|如此|的)/i,
      /(?:对的|没错|正是|确实如此|就是这样|就是如此|确实是这样)/i,
      /(?:我[的]?意思[就是]?|我的想法[就是]?|我说的[就是]?)[^，。\n]{0,12}(?:这个|这样|没错|对的|是的)/i,
      /(?:继续|保持|保留|维持)[^，。\n]{0,12}(?:这样|这个|原样|现状|原有的|之前的)/i,
      /(?:对[，。]|嗯[，。]|是的[，。])[^，。\n]{2,30}/i,
    ];

    /* ── I. 指代 / 参照模式（~25 模式） ── */
    var REFER_PAT = [
      /(?:这|那)(?:个|条|句|首|篇|段|张|个|份|款|些|类|种|版本|设置|参数|配置|功能|项目|方案|结果|回复|回答|文件|网页)/i,
      /刚才(?:那|这)(?:个|条|句|首|篇|段|次|个|版本|设置|功能|报错|错误|问题|结果|回复|回答|那个|哪个)/i,
      /(?:前面|上面|之前|上[一那]|前一)(?:个|条|句|条|段|篇|次|轮|版|版本)/i,
      /(?:你刚[才刚]|你上[次一]|你前[面次]|刚刚|之前)[^，。\n]{0,8}(?:说|讲|提|写|发|给|做|改|弄|搞)(?:的|过|的那个|过那个|的那个)/i,
      /(?:这[首篇条个]|那[首篇条个]|这版|它[们]?|[就]?是[这个那个])/i,
      /(?:这个|那个|这样|那样)[^，。\n]{0,12}(?:就是我说的|就是我讲的|就对了|就行|就好|就可以|能用|不错|很好|好听|好看|好用)/i,
    ];

    /* ── J. 临时状态（~15 模式） ── */
    var TEMP_PAT = [
      /(?:今天|今晚|今早|今[天晚早])[^，。\n]{0,12}(?:很|好|有点|感觉|就是|只是)[]?[^，。\n]{0,10}$/i,
      /(?:刚才|刚刚|现在|这会儿)[^，。\n]{0,12}(?:想|要|打算|准备|计划|觉得|感觉|有[点些])[^，。\n]{0,20}$/i,
      /(?:这[次回轮]|这次|这回|本次)[^，。\n]{0,16}(?:先|就|先用|就用|先试试|试试|试试看)/i,
      /(?:先|暂时|临时|暂且)[^，。\n]{0,8}(?:用|试|试试|看看|用着|用一下|用用)/i,
      /(?:我用|我试|我试了|我用了|我测了)[^，。\n]{0,16}(?:一下|试试|看看|一次|一回|测试)/i,
      /我今天[^，。\n]{0,20}(?:很[烦累怒恼]|好[烦累怒]|有[点些])[烦累怒恼躁]/,  /* mood filter also in trash */
    ];

    /* ── K. 敏感信息（~20 模式） ── */
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

    /* ── L. 废词废句 / 丢弃（~50 模式） ── */
    var TRASH_PAT = [
      /^(?:啊|嗯|哦|哈|哈哈|呵呵|嘿嘿|嘻嘻|嘖|额|呃|哎|哟|哇|切|呸|呵|哼|唉|哦哦|嗯嗯|好吧|好啦|好滴|好哒|好的|好哦|行吧|行了|好了|可以|不行|不对|不是|算了|没事|没啥|没了|有啊|没用|没有|不是吧|不会吧|真的吗|是吗|是么|这样啊|这样吗|原来如此|原来这样|怪不得|难怪|了解|明白|懂了|知道|知道了|收到|收到|得嘞|好嘞|欧了|OK|ok)$/i,
      /^(?:爽|烦|牛|垃圾|赞|棒|强|好|6|666|nb|NB|tql|太强|太棒|太牛|厉害|牛逼|牛批|流弊|给力|优秀|优质|精彩|绝了|绝了)$/i,
      /^(?:喜欢|讨厌|不错|好听|好看|好用|好吃|好喝|好玩|好棒|好赞|好强|好牛|好厉害|好漂亮|好美|好帅|好 cute|可爱|有趣|有意思|无聊|没意思)$/i,
      /^(?:对|是的|没错|就是|对啊|嗯对|对对|对的|嗯嗯|嗯呢|是的是的|对对对|是的对|对呀|是的呀|dei|是哒|是的没错)$/i,
      /^(?:确实|确实如此|确实这样|确实不错|真不错|真的不错|真棒|真厉害|真的厉害|真好|真的好吗|真的好|太好了|太棒了|太厉害了|太强了|太赞了)$/i,
      /这(?:个|样)(?:好|行|可以|不错|挺好|很棒|很赞|很好|可以的|行了|差不多)/i,
      /那个(?:不行|不好|可以|行|不错)/i,
      /真的?(?:好|可以|不错|行|棒|赞|厉害|牛|强|漂亮|好看|好听|好用|方便|舒服|爽|合适)/i,
      /(?:挺|蛮|很|真的|特别|超|非常|有点|有点|比较|相当|极其|万分)(?:好|棒|赞|强|牛|可以|行|不错|厉害|漂亮|好看|好听|好用|方便|舒服|爽|合适|有意思|有趣)/i,
      /^[。，！？!?,.、]{1,10}$/,
      /^.{1,2}$/,
      /^(?:哈|呵|嘻|嘿|嘖){2,10}$/i,
      /(?:哈哈哈|呵呵呵|嘿嘿嘿|嘻嘻嘻|哈哈哈|呵呵哒|hhh|hhhh|233|2333)/i,
    ];

    /* ── M. 无意义重复 / 语气增强（~15 模式） ── */
    var NOISE_PAT = [
      /(?:真的|确实|实在|的确|简直|完全是|完全是|就是|真是|可真是)(?:太|很|好|非常|特别|超级)[^，。\n]{0,4}$/i,
      /(?:太|好|很|真|超|好)[^，。\n]{0,4}(?:了[。，!！]?)$/m,
      /[^，。\n]{2,12}[啊哦嗯哟呀哈哇诶]?[。，!！]?$/m,
      /(?:就是|还是|可是|但是|然而|不过|只是)[^，。\n]{0,20}(?:这样|那样|如此|这样吧|那样吧)/i,
    ];

    /* ==============================================================
       核心数据结构
       ============================================================== */
    function emptyStore(){
      return { savedMemories:[], candidateMemories:[], historyReferences:[], memoryLogs:[] };
    }

    function newSavedMemory(){
      return {
        id:uid(), kind:'saved_memory',
        type:'preference', subject:'user', predicate:'likes', object:'',
        text:'', evidence:[], confidence:0, importance:0,
        status:'active', created_at:nowISO(), updated_at:nowISO(),
        last_confirmed_at:null, tags:[], aliases:[], source:'auto', version:1
      };
    }

    function newCandidate(){
      return {
        id:uid(), kind:'candidate_memory',
        reason:'', proposed_text:'', raw_text:'',
        confidence:0, created_at:nowISO(), related_context:[]
      };
    }

    function newHistoryRef(){
      return {
        id:uid(), kind:'history_reference',
        summary:'', messages:[], topics:[], importance:0,
        created_at:nowISO(), updated_at:nowISO()
      };
    }

    function newLog(){
      return { id:uid(), action:'', input:'', output:'', reason:'', created_at:nowISO() };
    }

    function nowISO(){ return new Date().toISOString(); }

    /* ==============================================================
       存储层
       ============================================================== */
    function loadStore(){
      var s = readJSON(K.memoriesV2, null);
      if(s && s.savedMemories && Array.isArray(s.savedMemories)) return s;
      return emptyStore();
    }
    function saveStore(s){ saveJSON(K.memoriesV2, s); }

    function loadCandidatesV2(){
      var arr = readJSON(K.candidatesV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveCandidatesV2(arr){ saveJSON(K.candidatesV2, Array.isArray(arr) ? arr : []); }

    function loadHistoryV2(){
      var arr = readJSON(K.historyV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveHistoryV2(arr){ saveJSON(K.historyV2, Array.isArray(arr) ? arr : []); }

    function loadLogs(){
      var arr = readJSON(K.logsV2, []);
      return Array.isArray(arr) ? arr : [];
    }
    function saveLogs(arr){ saveJSON(K.logsV2, Array.isArray(arr) ? arr.slice(-500) : []); }

    /* ==============================================================
       logMemoryAction — 写记忆日志
       ============================================================== */
    function logAction(action, input, output, reason){
      var logs = loadLogs();
      logs.unshift({ id:uid(), action:action||'unknown', input:String(input||'').slice(0,200), output:String(output||'').slice(0,200), reason:String(reason||'').slice(0,200), created_at:nowISO() });
      if(logs.length > 500) logs = logs.slice(0,500);
      saveLogs(logs);
    }

    /* ==============================================================
       rejectTrashMemory — 丢弃废内容（写日志，不保存）
       ============================================================== */
    function rejectTrash(input, reason){
      logAction('reject', input, '已丢弃', reason);
    }

    /* ==============================================================
       classifyMemoryV3 — 增强分类（不冲突旧 classifyMemory）
       返回: { category, subcategory, contexts }
       ============================================================== */
    function classifyV3(text){
      var t = text.trim();
      var result = { category:'casual_chat', subcategory:'', contexts:[], explicit_request:false, is_confirmation:false, is_temporary:false, is_sensitive:false, is_trash:false, has_reference:false };

      /* 1. 敏感检测 — 最高优先级 */
      for(var i=0; i<SENSITIVE_PAT.length; i++){ if(SENSITIVE_PAT[i].test(t)){
        result.is_sensitive = true;
        result.category = 'sensitive';
        return result;
      }}

      /* 2. 显式记忆请求 */
      for(var i=0; i<EXPLICIT_REQ.length; i++){ if(EXPLICIT_REQ[i].test(t)){
        result.explicit_request = true;
        result.category = 'explicit_memory_request';
        result.subcategory = 'explicit_save';
        return result;
      }}

      /* 3. 厌恶 */
      for(var i=0; i<DISLIKE_PAT.length; i++){ if(DISLIKE_PAT[i].test(t)){
        result.category = 'stable_preference';
        result.subcategory = 'dislike';
        result.contexts.push('dislike');
        return result;
      }}

      /* 4. 偏好 */
      for(var i=0; i<PREFERENCE_PAT.length; i++){ if(PREFERENCE_PAT[i].test(t)){
        result.category = 'stable_preference';
        result.subcategory = 'preference';
        result.contexts.push('preference');
        return result;
      }}

      /* 5. 边界（交互边界优先于一般指令） */
      for(var i=0; i<BOUNDARY_PAT.length; i++){ if(BOUNDARY_PAT[i].test(t)){
        result.category = 'boundary';
        result.subcategory = 'interaction_boundary';
        result.contexts.push('boundary');
        return result;
      }}

      /* 6. 指令 */
      for(var i=0; i<INSTRUCTION_PAT.length; i++){ if(INSTRUCTION_PAT[i].test(t)){
        result.category = 'instruction';
        result.subcategory = 'behavior_rule';
        result.contexts.push('instruction');
        return result;
      }}

      /* 7. 项目约束 */
      for(var i=0; i<PROJECT_PAT.length; i++){ if(PROJECT_PAT[i].test(t)){
        result.category = 'project';
        result.subcategory = 'constraint';
        result.contexts.push('project');
        return result;
      }}

      /* 8. 工具配置 */
      for(var i=0; i<TOOL_PAT.length; i++){ if(TOOL_PAT[i].test(t)){
        result.category = 'project';
        result.subcategory = 'tool_config';
        result.contexts.push('tool_config');
        return result;
      }}

      /* 9. 确认 */
      for(var i=0; i<CONFIRM_PAT.length; i++){ if(CONFIRM_PAT[i].test(t)){
        result.is_confirmation = true;
        result.category = 'confirmation';
        result.subcategory = 'confirmation';
        result.contexts.push('confirmation');
        return result;
      }}

      /* 10. 噪声（内容类别之后，仅兜底） */
      for(var i=0; i<NOISE_PAT.length; i++){ if(NOISE_PAT[i].test(t)){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }}

      /* 11. 废词废句（兜底） */
      for(var i=0; i<TRASH_PAT.length; i++){ if(TRASH_PAT[i].test(t)){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }}

      /* 12. 指代 */
      for(var i=0; i<REFER_PAT.length; i++){ if(REFER_PAT[i].test(t)){
        result.has_reference = true;
        // Don't return yet — might be a proper sentence with reference + meaning
      }}

      /* 13. 临时 */
      for(var i=0; i<TEMP_PAT.length; i++){ if(TEMP_PAT[i].test(t)){
        result.is_temporary = true;
        result.category = 'temporary_state';
        result.subcategory = 'temporary';
        return result;
      }}

      /* 14. 简短无意义 */
      if(t.length < 4){
        result.is_trash = true;
        result.category = 'trash';
        return result;
      }

      return result;
    }

    /* ==============================================================
       detectIntensity — 检测用户语句的强度/确定性
       返回 0-1 的强度系数
       ============================================================== */
    function detectIntensity(text){
      var score = 0;
      /* 高强度副词 */
      var highIntensity = /(?:绝对|必须|一定|肯定|永远|从来|打死也|死也不|坚决|无论如何|毫无疑问|毫无疑问|毋庸置疑|毫不含糊|铁定|板上钉钉)/;
      if(highIntensity.test(text)) score += 0.25;
      /* 超高强度 */
      var extremeIntensity = /(?:最|第[一二三]|唯一|only|top|No\.?1|Number One|首选|最爱|天下第[一二三]|世界第[一二三])/i;
      if(extremeIntensity.test(text)) score += 0.2;
      /* 反复/习惯 */
      var habitual = /(?:每次|每回|总是|一直|从来都|向来|一贯|长期|多年|这些年|始终|坚持|保持|持续|稳定|固定)/;
      if(habitual.test(text)) score += 0.2;
      /* 强调否定 */
      var strongNeg = /(?:绝对不|坚决不|死也不|打死不|永远不|再也不|决不再|千万不|万万不|断然不|压根不|根本不)/;
      if(strongNeg.test(text)) score += 0.2;
      /* 强烈情感 */
      var strongEmotion = /(?:超级|特别|非常|极其|极度|格外|十分|忒|巨|狂|爆|炸裂|无敌|逆天|封神|神仙|天才|完美|绝了|太牛|太强|太棒)/;
      if(strongEmotion.test(text)) score += 0.1;
      return Math.min(0.5, score);
    }

    /* ==============================================================
       scoreMemoryV3 — 评分
       返回: { confidence, importance } 0-1
       ============================================================== */
    function scoreV3(category, text, explicit_request, has_reference, oldMem){
      var result = { confidence:0, importance:0 };
      var len = text.length;
      var intensity = detectIntensity(text);

      /* 置信度基础 */
      if(explicit_request){ result.confidence = 0.95; }
      else if(category === 'explicit_memory_request'){ result.confidence = 0.95; }
      else if(category === 'instruction'){ result.confidence = 0.88 + intensity; }
      else if(category === 'boundary'){ result.confidence = 0.88 + intensity; }
      else if(category === 'project' || category === 'tool_config'){ result.confidence = 0.83 + intensity; }
      else if(category === 'stable_preference'){
        if(has_reference && oldMem){ result.confidence = 0.8; }
        else if(has_reference){ result.confidence = 0.72; }
        else { result.confidence = 0.78 + intensity; }
      }
      else if(category === 'dislike'){
        result.confidence = 0.8 + intensity;
      }
      else if(category === 'confirmation' && oldMem){
        result.confidence = Math.min(0.98, (oldMem.confidence || 0.7) + 0.08);
        result.importance = oldMem.importance || 0.5;
        return result;
      }else{
        return result; // 低分，不进正式记忆
      }

      /* 内容长度与丰富度 */
      if(len < 6) result.confidence = Math.min(result.confidence, 0.3);
      else if(len < 10) result.confidence = Math.min(result.confidence, 0.55);
      else if(len >= 30) result.confidence = Math.min(0.98, result.confidence + 0.05); // 长内容加分
      else if(len >= 20) result.confidence = Math.min(0.98, result.confidence + 0.03);

      /* 内容特异性：包含具体实体/数字/时间加分 */
      var hasConcreteEntity = /(?:https?:\/\/|github|\.com|\.cn|\.io|[A-Z][a-z]{2,}(?:\.[A-Z][a-z]{2,})+|\d{4}-\d{2}-\d{2}|\d{1,3}\.\d{1,3}\.\d{1,3}|版本\s*\d|v\d+\.\d+|第[一二三四五六七八九十\d]+|[A-Z][a-z]+ [A-Z][a-z]+)/.test(text);
      if(hasConcreteEntity) result.confidence = Math.min(0.98, result.confidence + 0.05);

      /* 旧记忆强化 */
      if(oldMem){
        result.confidence = Math.min(0.98, Math.max(result.confidence, (oldMem.confidence||0.7) + 0.06));
      }

      /* ── 重要性 ── */
      if(category === 'project'){ result.importance = 0.85 + intensity * 0.15; }
      else if(category === 'instruction'){ result.importance = 0.75 + intensity * 0.2; }
      else if(category === 'boundary'){ result.importance = 0.8 + intensity * 0.15; }
      else if(category === 'tool_config'){ result.importance = 0.7 + intensity * 0.2; }
      else if(explicit_request || category === 'explicit_memory_request'){ result.importance = 0.7 + intensity * 0.2; }
      else if(category === 'stable_preference'){
        if(has_reference) result.importance = 0.45 + intensity * 0.35;
        else result.importance = 0.5 + intensity * 0.3;
      }
      else if(category === 'dislike'){
        result.importance = 0.65 + intensity * 0.25;
      }
      else { result.importance = 0.3 + intensity * 0.3; }

      /* 有指代但解析失败 → 适度降分，但仍保留一定价值 */
      if(has_reference && !oldMem && category !== 'trash' && category !== 'casual_chat'){
        result.confidence = Math.min(result.confidence, 0.68);
        result.importance = Math.min(result.importance, 0.55);
      }

      return result;
    }

    /* ==============================================================
       resolveReference — 指代解析
       ============================================================== */
    function resolveRef(text, recentMessages, existingMemories, historyRefs){
      if(!recentMessages && !existingMemories && !historyRefs) return null;

      var refMatch = null;
      for(var i=0; i<REFER_PAT.length; i++){
        var m = text.match(REFER_PAT[i]);
        if(m){ refMatch = m[0]; break; }
      }
      if(!refMatch) return null;

      var resolved = null;

      /* 1. 在最近消息中搜索明确对象 */
      if(recentMessages && recentMessages.length){
        for(var j=recentMessages.length-1; j>=0; j--){
          var msg = recentMessages[j];
          if(msg.role === 'assistant' && msg.content){
            // 找引号、书名号里的内容
            var quotes = msg.content.match(/[「『《""][^「『《""」』》""]{2,40}[」』》""]/g);
            if(quotes && quotes.length){
              resolved = { type:'assistant_mention', object:quotes[quotes.length-1].replace(/[「『《""」』》""]/g,''), source:'recent_messages' };
              break;
            }
            // 找 . 分隔的明确实体
            var entities = msg.content.match(/[^，。\n]{2,30}(?:的歌|的音乐|的小说|的电影|的剧|的作品|的版本|的功能|的设置|的配置|的模式)[^，。\n]{0,10}/i);
            if(entities && entities.length){
              resolved = { type:'entity_context', object:entities[0].trim(), source:'recent_messages' };
              break;
            }
          }
          if(msg.role === 'user' && msg !== text){
            // 找用户前一条消息中的核心内容（50字以上且有实体）
            if(msg.content && msg.content.length > 8 && msg.content.length < 200){
              resolved = { type:'previous_user_message', object:msg.content.slice(0,100), source:'recent_messages' };
              break;
            }
          }
        }
      }

      /* 在已有记忆中搜索匹配已解析的引用 */
      if(resolved && !resolved.memory && existingMemories && existingMemories.length && resolved.object){
        for(var k=0; k<existingMemories.length; k++){
          var em = existingMemories[k]; if(em.status !== 'active') continue;
          if((em.object && (em.object.indexOf(resolved.object) >= 0 || resolved.object.indexOf(em.object) >= 0)) ||
             (em.text && em.text.indexOf(resolved.object) >= 0)){
            resolved.memory = em; resolved.source = 'recent_messages_matched'; break;
          }
        }
      }

      /* 2. 在已有记忆中搜索 */
      if(!resolved && existingMemories && existingMemories.length){
        var best = null, bestScore = 0;
        for(var k=0; k<existingMemories.length; k++){
          var em = existingMemories[k];
          if(em.status !== 'active') continue;
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

      /* 3. 在历史引用中搜索 */
      if(!resolved && historyRefs && historyRefs.length){
        var hr = historyRefs[0];
        if(hr && hr.topics && hr.topics.length){
          resolved = { type:'history_context', object:hr.topics.slice(0,3).join('、'), source:'history_reference', ref:hr };
        }
      }

      return resolved;
    }

    /* ==============================================================
       normalizeMemory — 规范化提取结果
       从分类+文本构建结构化的 saved_memory
       ============================================================== */
    function normalizeRaw(classification, text, resolvedRef, matchedPattern){
      var m = newSavedMemory();

      /* 根据分类设置 type/predicate/text */
      switch(classification.subcategory){
        case 'explicit_save':
          m.type = 'instruction'; m.predicate = 'requires';
          m.text = '用户要求：' + text.replace(/^(?:记住|记一下|记好了|别忘了|把[这那])/i,'').trim();
          if(m.text.length < 6) m.text = text;
          m.source = 'explicit_user'; m.confidence = 0.95; m.importance = 0.8;
          break;

        case 'dislike':
          m.type = 'dislike'; m.predicate = 'dislikes';
          m.object = extractObject(text, resolvedRef);
          m.text = '用户不喜欢' + (m.object ? m.object : extractDislikeTarget(text));
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.75;
          break;

        case 'preference':
          m.type = 'preference'; m.predicate = 'likes';
          m.object = extractObject(text, resolvedRef);
          m.text = '用户喜欢' + (m.object ? m.object : extractTarget(text));
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.6;
          break;

        case 'behavior_rule':
          m.type = 'instruction'; m.predicate = 'requires';
          m.object = extractTarget(text) || text;
          m.text = '用户要求：' + text.replace(/^(?:以后|下次|接下来|之后|请|麻烦你)/i,'').trim();
          m.source = 'auto'; m.confidence = 0.9; m.importance = 0.85;
          break;

        case 'interaction_boundary':
          m.type = 'boundary'; m.predicate = 'forbids';
          m.object = extractTarget(text) || text;
          m.text = '用户禁止：' + text.replace(/^(?:以后|下次|请|麻烦你)/i,'').trim();
          m.source = 'auto'; m.confidence = 0.9; m.importance = 0.9;
          break;

        case 'constraint':
          m.type = 'project'; m.predicate = 'requires';
          m.object = extractTarget(text) || text;
          m.text = '项目约束：' + text;
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.9;
          break;

        case 'tool_config':
          m.type = 'tool_config'; m.predicate = 'uses';
          m.object = extractTarget(text) || text;
          m.text = '工具配置：' + text;
          m.source = 'auto'; m.confidence = 0.85; m.importance = 0.8;
          break;

        default:
          m.text = text;
          break;
      }

      /* 指代替换 */
      if(resolvedRef && resolvedRef.object){
        var referPatterns = [/这[个首条篇段]/, /那[个首条篇段]/, /刚才那[个]/, /你刚[才]说的/, /它/];
        for(var i=0; i<referPatterns.length; i++){
          m.text = m.text.replace(referPatterns[i], resolvedRef.object);
        }
        m.object = resolvedRef.object;
        m.aliases.push(resolvedRef.object);
      }

      /* 规范化结尾 */
      m.text = m.text.trim();
      if(!/[。！？!?]$/.test(m.text)) m.text += '。';

      return m;
    }

    /* 提取对象（喜欢后面的内容） */
    function extractObject(text, ref){
      if(ref && ref.object) return ref.object;
      var objMatch = text.match(/(?:喜欢|爱|推荐|偏爱|偏好)[^，。\n]{1,40}$/i);
      if(objMatch) return objMatch[0].replace(/^(?:喜欢|爱|推荐|偏爱|偏好)/,'').trim();
      var full = text.match(/(?:我喜欢|我最喜欢|我更喜欢|我偏好|我偏向)[^，。\n]{1,40}/i);
      if(full) return full[0].replace(/^我(?:最)?(?:喜欢|偏好|偏向)/,'').trim();
      return '';
    }

    function extractTarget(text){
      var m = text.match(/[^，。\n]{2,40}$/);
      return m ? m[0].trim() : text.slice(-20);
    }

    function extractDislikeTarget(text){
      var m = text.match(/(?:不喜欢|讨厌|反感|受不了)[^，。\n]{1,40}$/i);
      if(m) return m[0].replace(/^(?:不喜欢|讨厌|反感|受不了)/,'').trim();
      return '';
    }

    /* ==============================================================
       upsertMemory — 合并/强化/冲突处理
       ============================================================== */
    function upsert(newMem, store){
      var existing = store.savedMemories;
      var bestMatch = null, bestScore = 0;

      for(var i=0; i<existing.length; i++){
        var e = existing[i];
        if(e.status === 'archived' || e.status === 'deleted') continue;
        var sim = textSimilarity(newMem.text, e.text);
        if(sim > bestScore){ bestScore = sim; bestMatch = { idx:i, mem:e, sim:sim }; }
      }

      /* 完全重复 / 高度相似 → 只更新 evidence 和置信度 */
      if(bestMatch && bestMatch.sim >= 0.65){
        var target = existing[bestMatch.idx];
        /* 合并 evidence */
        if(newMem.evidence && newMem.evidence.length){
          target.evidence = target.evidence.concat(newMem.evidence).slice(-20);
        }
        /* 强化置信度 */
        target.confidence = Math.min(0.98, Math.max(target.confidence||0.7, newMem.confidence||0.7) + 0.05);
        target.importance = Math.max(target.importance||0.5, newMem.importance||0.5);
        target.updated_at = nowISO();
        target.last_confirmed_at = nowISO();
        target.version = (target.version||1) + 1;
        /* 取更长更完整的文本 */
        if(newMem.text.length > target.text.length) target.text = newMem.text;
        /* 合并 aliases */
        if(newMem.aliases && newMem.aliases.length){
          newMem.aliases.forEach(function(a){ if(target.aliases.indexOf(a)<0) target.aliases.push(a); });
        }
        logAction('reinforce', newMem.text, target.text, '重复确认，合并强化');
        return { action:'reinforce', memory:target };
      }

      /* 中等相似 → 可能是同对象细化 */
      if(bestMatch && bestMatch.sim >= 0.4){
        var target2 = existing[bestMatch.idx];
        /* 检查是否同 predicate */
        if(target2.predicate === newMem.predicate){
          /* 新文本更长更详细 → 升级 */
          if(newMem.text.length > target2.text.length + 5){
            logAction('merge_refine', target2.text, newMem.text, '同对象细化更新');
            if(newMem.evidence) target2.evidence = target2.evidence.concat(newMem.evidence).slice(-20);
            target2.text = newMem.text;
            target2.object = newMem.object || target2.object;
            target2.confidence = Math.min(0.98, target2.confidence + 0.03);
            target2.importance = Math.max(target2.importance, newMem.importance);
            target2.updated_at = nowISO();
            target2.version = (target2.version||1) + 1;
            return { action:'refine', memory:target2 };
          }
          /* 旧文本更长 → 只是强化 */
          target2.confidence = Math.min(0.98, target2.confidence + 0.03);
          target2.last_confirmed_at = nowISO();
          if(newMem.evidence) target2.evidence = target2.evidence.concat(newMem.evidence).slice(-20);
          logAction('reinforce', newMem.text, target2.text, '同对象确认强化');
          return { action:'reinforce', memory:target2 };
        }

        /* 不同 predicate → 可能冲突 */
        if(target2.predicate !== newMem.predicate){
          var isConflict = false;
          if(target2.predicate === 'likes' && newMem.predicate === 'dislikes') isConflict = true;
          if(target2.predicate === 'dislikes' && newMem.predicate === 'likes') isConflict = true;
          if(target2.predicate === 'forbids' && newMem.predicate === 'requires') isConflict = true;
          if(target2.predicate === 'requires' && newMem.predicate === 'forbids') isConflict = true;

          if(isConflict && detectChangeOfMind(newMem.text, target2.text)){
            /* 归档旧记忆 */
            target2.status = 'archived';
            target2.updated_at = nowISO();
            logAction('archive_conflict', target2.text, newMem.text, '冲突归档，用户改变了想法');
            /* 新建新记忆 */
            newMem.id = uid();
            newMem.created_at = nowISO();
            newMem.updated_at = nowISO();
            existing.unshift(newMem);
            logAction('save', newMem.text, '', '冲突后新建');
            return { action:'conflict_replace', old:target2, memory:newMem };
          }
        }
      }

      /* 无匹配 → 新建 */
      newMem.id = uid();
      newMem.created_at = nowISO();
      newMem.updated_at = nowISO();
      existing.unshift(newMem);
      if(existing.length > 300) existing = existing.slice(0,300);
      logAction('save', newMem.text, '', '新建记忆');
      return { action:'save', memory:newMem };
    }

    /* 检测是否改变想法 */
    function detectChangeOfMind(newText, oldText){
      var changeIndicators = [
        /基本不用[了]?|不用了|不[再用]|不再|不[需想]要|换[成]?|改[成变用]|转[向移到]|变了|变了|变了想法|改主意/i,
        /不再[喜欢用考虑]|以后不用|以后不[会再]|已经不|已经不再|现在[不用不喜欢]?/i,
        /我以前|我之前|以前是|过去是|原本是|本来是|以前喜欢|之前用/i
      ];
      var hasChangeWord = false;
      for(var i=0; i<changeIndicators.length; i++){
        if(changeIndicators[i].test(newText)){ hasChangeWord = true; break; }
      }
      if(!hasChangeWord) return false;

      var oppositePairs = [
        { like:/喜欢|爱|偏好|用|使用|推崇/, dislike:/不喜欢|讨厌|不用|不再用|弃用|废弃/ },
        { on:/开[启着]?|启用|使用|用/, off:/[关停闭]|关闭|不用|停用/ }
      ];

      var newSubject = newText.slice(0,20);
      var oldSubject = oldText.slice(0,20);
      var shared = 0;
      for(var j=0; j<newSubject.length; j++){
        if(oldSubject.indexOf(newSubject[j]) >= 0) shared++;
      }
      return (shared / Math.max(newSubject.length, 1)) > 0.3;
    }

    /* 文本相似度 */
    function textSimilarity(a, b){
      if(!a || !b) return 0;
      if(a === b) return 1;
      var sa = a.slice(0,80).toLowerCase(), sb = b.slice(0,80).toLowerCase();
      var short = sa.length <= sb.length ? sa : sb;
      var long = sa.length > sb.length ? sa : sb;
      var match = 0;
      for(var i=0; i<short.length; i++){ if(long.indexOf(short[i]) >= 0) match++; }
      return match / long.length;
    }

    /* ==============================================================
       addCandidateMemory — 添加候选（带严格检查）
       ============================================================== */
    function addCandidate(proposedText, rawText, reason, confidence){
      if(!proposedText || proposedText.length < 6) return null;
      if(reason === 'sensitive') return null;

      /* 废词检查 */
      for(var i=0; i<TRASH_PAT.length; i++){ if(TRASH_PAT[i].test(proposedText)) return null; }

      var cand = newCandidate();
      cand.proposed_text = proposedText;
      cand.raw_text = (rawText||proposedText).slice(0,200);
      cand.reason = reason || '需要确认';
      cand.confidence = confidence || 0.5;
      cand.created_at = nowISO();

      var candidates = loadCandidatesV2();
      /* 去重 */
      for(var j=0; j<candidates.length; j++){
        if(textSimilarity(candidates[j].proposed_text, proposedText) >= 0.6) return null;
      }
      candidates.unshift(cand);
      if(candidates.length > 50) candidates = candidates.slice(0,50);
      saveCandidatesV2(candidates);
      logAction('candidate', rawText, proposedText, reason);
      return cand;
    }

    /* ==============================================================
       buildHistoryReference — 构建历史引用
       ============================================================== */
    function buildHistoryRef(messages, maxLen){
      if(!messages || !messages.length) return null;
      var ref = newHistoryRef();
      var msgs = messages.slice(-maxLen || -20);
      ref.messages = msgs.filter(function(m){ return m.id; }).map(function(m){ return m.id; });
      ref.summary = msgs.filter(function(m){ return m.role === 'user' || m.role === 'assistant'; }).slice(-6).map(function(m){
        return (m.role === 'user' ? 'U: ' : 'A: ') + (m.content||'').slice(0,120);
      }).join('\n');
      ref.importance = 0.4;
      ref.updated_at = nowISO();
      return ref;
    }

    /* ==============================================================
       retrieveRelevantMemories — 多策略检索
       ============================================================== */
    function retrieve(userMessage, store, count){
      count = count || 12;
      if(!store || !store.savedMemories) return [];

      var memories = store.savedMemories.filter(function(m){ return m.status === 'active'; });
      if(!memories.length) return [];

      /* 候选也纳入检索，只取高置信的 */
      var candidates = (store.candidateMemories||[]).filter(function(c){ return c.confidence >= 0.6; });

      var msg = (userMessage||'').toLowerCase();
      var results = [];

      /* 1. 关键词匹配 */
      var words = msg.split(/[\s，。、；：,.\n]+/).filter(function(w){ return w.length > 1; });

      for(var i=0; i<memories.length; i++){
        var m = memories[i];
        var score = 0;
        var text = (m.text||'').toLowerCase();

        /* 精确关键词 */
        for(var w=0; w<words.length; w++){
          if(text.indexOf(words[w]) >= 0){
            score += 2;
            /* 多次出现加分 */
            var count = (text.match(new RegExp(words[w].replace(/[.*+?^${}()|[\]\\]/g, '\$&'), 'g')) || []).length;
            score += Math.min(count, 5) * 0.5;
          }
        }

        /* 类别匹配 */
        if(m.type === 'project' && (msg.indexOf('项目') >= 0 || msg.indexOf('不能改') >= 0 || msg.indexOf('保留') >= 0)) score += 3;
        if(m.type === 'instruction' && (msg.indexOf('以后') >= 0 || msg.indexOf('不要') >= 0 || msg.indexOf('必须') >= 0)) score += 2;
        if(m.type === 'boundary' && (msg.indexOf('不要') >= 0 || msg.indexOf('称呼') >= 0 || msg.indexOf('叫我') >= 0)) score += 2;
        if(m.type === 'tool_config' && (msg.indexOf('部署') >= 0 || msg.indexOf('配置') >= 0 || msg.indexOf('API') >= 0)) score += 2;

        /* 置信度 */
        score += (m.confidence || 0) * 5;

        /* 重要性 */
        score += (m.importance || 0) * 4;

        /* 时间衰减（最近更新的权重高） */
        if(m.updated_at){
          var age = Date.now() - new Date(m.updated_at).getTime();
          if(age < 86400000) score += 3;
          else if(age < 604800000) score += 1.5;
          else if(age < 2592000000) score += 0.5;
        }

        if(score > 0) results.push({ memory:m, score:score });
      }

      /* 候选记忆也检索 */
      for(var ci=0; ci<candidates.length; ci++){
        var c = candidates[ci];
        var cs = 0;
        var ct = (c.proposed_text||'').toLowerCase();
        for(var w2=0; w2<words.length; w2++){
          if(ct.indexOf(words[w2]) >= 0) cs += 1.5;
        }
        cs += (c.confidence||0) * 3;
        if(cs > 0) results.push({ candidate:c, score:cs });
      }

      results.sort(function(a,b){ return b.score - a.score; });

      /* 不同类型尽量覆盖 */
      var typeSet = {};
      var final = [];
      for(var r=0; r<results.length && final.length < count; r++){
        var item = results[r];
        var type = item.memory ? item.memory.type : 'candidate';
        if(!typeSet[type] || final.length < count/2){
          final.push(item);
          typeSet[type] = true;
        }else if(final.length < count){
          final.push(item);
        }
      }

      return final.sort(function(a,b){ return b.score - a.score; }).slice(0, count);
    }

    /* ==============================================================
       buildMemoryContext — 构建注入 prompt
       ============================================================== */
    function buildContext(retrieved, userMessage){
      if(!retrieved || !retrieved.length) return '';

      var parts = [];

      /* 正式记忆 */
      var saved = retrieved.filter(function(r){ return r.memory && r.memory.status === 'active'; });
      if(saved.length){
        var lines = saved.map(function(r, i){
          return (i+1) + '. ' + (r.memory.text||'').slice(0,300);
        });
        parts.push('[长期记忆]\n' + lines.join('\n'));
      }

      /* 候选 */
      var cands = retrieved.filter(function(r){ return r.candidate; });
      if(cands.length && cands.length <= 3){
        var clines = cands.map(function(r){
          return '- (待确认) ' + (r.candidate.proposed_text||'').slice(0,200);
        });
        parts.push('[待确认信息]\n' + clines.join('\n'));
      }

      var text = parts.join('\n\n');
      if(text.length > 4000) text = text.slice(0,4000);
      return text;
    }

    /* ==============================================================
       extractMemoryFromMessage — 主提取入口
       输入: message, recentMessages, store
       输出: { action:'save'|'reinforce'|'candidate'|'reject'|'skip', memory?:saved_memory, reason?:string }
       ============================================================== */
    function extract(msgText, recentMessages, store){
      if(!store) store = loadStore();
      var text = String(msgText||'').trim();
      if(text.length < 4) return { action:'skip', reason:'too_short' };

      /* 分类 */
      var cls = classifyV3(text);

      /* 废词丢弃 */
      if(cls.is_trash){
        /* 尝试指代解析合并 */
        if(cls.has_reference || CONFIRM_PAT.some(function(p){ return p.test(text); })){
          var ref = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
          if(ref && ref.memory){
            var enhanced = upsert({ text:ref.memory.text, evidence:[], confidence:ref.memory.confidence+0.05, importance:ref.memory.importance, aliases:[] }, store);
            saveStore(store);
            return { action:'reinforce', memory:enhanced.memory, reason:'reference_resolved_trash' };
          }
        }
        rejectTrash(text, cls.subcategory || 'trash');
        return { action:'reject', reason:'trash:'+(cls.subcategory||'trash') };
      }

      /* 敏感 → 拒绝长期保存 */
      if(cls.is_sensitive){
        logAction('reject_sensitive', text, '', '敏感信息，不保存长期记忆');
        return { action:'reject', reason:'sensitive_info' };
      }

      /* 临时 → 不进正式记忆 */
      if(cls.is_temporary){
        logAction('skip_temporary', text, '', '临时状态，不进长期记忆');
        return { action:'skip', reason:'temporary_state' };
      }

      /* 确认 → 尝试强化旧记忆 */
      if(cls.is_confirmation){
        var ref2 = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
        if(ref2 && ref2.memory){
          var result = upsert({ text:ref2.memory.text, evidence:[{
            message_id:uid(), role:'user', text:text, created_at:nowISO()
          }], confidence:Math.min(0.98, (ref2.memory.confidence||0.7)+0.08), importance:ref2.memory.importance, aliases:[] }, store);
          saveStore(store);
          return { action:'reinforce', memory:result.memory, reason:'confirmation_upsert' };
        }
        if(ref2 && ref2.object){
          /* 有关联对象但无对应记忆 → candidate */
          var candText = '用户确认了关于' + ref2.object + '的偏好。';
          var added = addCandidate(candText, text, '有对象但尚未建立记忆', 0.6);
          if(added) return { action:'candidate', reason:'object_found_no_memory', candidate:added };
        }
        /* 无法解析 → discard */
        rejectTrash(text, 'confirmation_no_reference');
        return { action:'reject', reason:'confirmation_no_reference' };
      }

      /* 指代解析 */
      var resolved = null;
      if(cls.has_reference || text.match(/这[个首条篇段]|那[个首条篇段]|刚才|它|这个版本|这个设置/i)){
        resolved = resolveRef(text, recentMessages, store.savedMemories, store.historyReferences);
      }

      /* 构建规范记忆 */
      var normal = normalizeRaw(cls, text, resolved, null);

      /* 评分 */
      var scores = scoreV3(cls.category, text, cls.explicit_request, !!resolved,
        resolved && resolved.memory ? resolved.memory : null);

      normal.confidence = scores.confidence;
      normal.importance = scores.importance;

      /* 添加 evidence */
      normal.evidence.push({
        message_id:uid(), role:'user', text:text.slice(0,200), created_at:nowISO()
      });

      /* 决策入口 */
      if(cls.explicit_request || cls.category === 'explicit_memory_request'){
        /* 如果有指代词但未解析 → 候选 */
        if(/[它这那]/.test(text) && !resolved){
          return { action:'candidate', reason:'explicit_request_ambiguous_reference', candidate:{proposed_text:normal.text} };
        }
        /* 显式请求 → 直接保存 */
        var upserted = upsert(normal, store);
        saveStore(store);
        return { action:upserted.action, memory:upserted.memory };
      }

      /* 高置信 → 直接保存（阈值略降，配合强度检测） */
      if(scores.confidence >= 0.72 && scores.importance >= 0.45){
        var upserted2 = upsert(normal, store);
        saveStore(store);
        return { action:upserted2.action, memory:upserted2.memory };
      }

      /* 中高置信 + 强度高 → 保存 */
      var intensity = detectIntensity(text);
      if(scores.confidence >= 0.65 && intensity >= 0.25 && text.length >= 12){
        var upserted25 = upsert(normal, store);
        saveStore(store);
        return { action:upserted25.action, memory:upserted25.memory };
      }

      /* 中等置信 → 检查对象是否明确 */
      if(scores.confidence >= 0.55 && scores.importance >= 0.35){
        if((normal.object && normal.object.length > 2) || (resolved && resolved.object)){
          var upserted3 = upsert(normal, store);
          saveStore(store);
          return { action:upserted3.action, memory:upserted3.memory };
        }
        /* 对象不明确 → candidate */
        var candReason = '对象不明确';
        if(cls.has_reference && !resolved) candReason = '指代解析失败';
        var added = addCandidate(normal.text, text, candReason, scores.confidence);
        return { action:'candidate', reason:candReason, candidate:added || undefined };
      }

      if(scores.confidence >= 0.35){
        /* 低中置信 → candidate（待用户确认） */
        var candReason2 = '置信度不足';
        if(!normal.object || normal.object.length < 2) candReason2 = '对象不明确，置信度不足';
        var added2 = addCandidate(normal.text, text, candReason2, scores.confidence);
        if(added2) return { action:'candidate', reason:candReason2, candidate:added2 };
      }

      /* 默认丢弃 */
      rejectTrash(text, 'low_value:'+cls.category);
      return { action:'reject', reason:'low_value:'+cls.category };
    }

    /* ==============================================================
       migrateOldMemories — 从 v1 迁移到 v2
       ============================================================== */
    function migrate(){
      var migrationFlag = readJSON(K.migrationV2, null);
      if(migrationFlag && migrationFlag.completed) return { migrated:0, reason:'already_migrated' };

      var store = loadStore();
      var count = 0;

      /* 迁移正式记忆 */
      var oldMemories = loadMemories();
      for(var i=0; i<oldMemories.length; i++){
        var old = oldMemories[i];
        if(!old || !old.content) continue;

        var newMem = newSavedMemory();
        newMem.text = old.content.slice(0,500);
        newMem.tags = Array.isArray(old.tags) ? old.tags.slice() : [];
        newMem.source = 'migrated_v1';
        newMem.created_at = old.createdAt ? new Date(old.createdAt).toISOString() : nowISO();
        newMem.updated_at = old.updatedAt ? new Date(old.updatedAt).toISOString() : nowISO();
        newMem.status = old.enabled !== false ? 'active' : 'archived';

        /* 分类 */
        var oldCategory = old.category || '';
        if(oldCategory === 'explicit_memory_request'){ newMem.type='instruction'; newMem.predicate='requires'; newMem.confidence=0.9; newMem.importance=0.7; }
        else if(oldCategory === 'stable_preference'){ newMem.type='preference'; newMem.predicate='likes'; newMem.confidence=0.7; newMem.importance=0.5; }
        else if(oldCategory === 'correction_rule'){ newMem.type='instruction'; newMem.predicate='forbids'; newMem.confidence=0.8; newMem.importance=0.8; }
        else if(oldCategory === 'long_term_background'){ newMem.type='fact'; newMem.predicate='is'; newMem.confidence=0.7; newMem.importance=0.5; }
        else if(oldCategory === 'project_rule'){ newMem.type='project'; newMem.predicate='requires'; newMem.confidence=0.8; newMem.importance=0.85; }
        else { newMem.type='preference'; newMem.predicate='likes'; newMem.confidence=0.5; newMem.importance=0.4; }

        /* 敏感检查 */
        var isSensitive = false;
        for(var si=0; si<SENSITIVE_PAT.length; si++){
          if(SENSITIVE_PAT[si].test(newMem.text)){ isSensitive = true; break; }
        }
        if(isSensitive){
          logAction('migrate_skip_sensitive', newMem.text, '', '旧记忆含敏感信息，不迁移');
          continue;
        }

        /* 过滤废词 */
        if(newMem.text.length < 4){ continue; }

        /* 去重 */
        var dup = false;
        for(var j=0; j<store.savedMemories.length; j++){
          if(textSimilarity(store.savedMemories[j].text, newMem.text) >= 0.6){ dup = true; break; }
        }
        if(dup) continue;

        store.savedMemories.push(newMem);
        count++;
        logAction('migrate', newMem.text, '', '从 v1 迁移');
      }

      /* 迁移候选 */
      var oldCandidates = loadMemoryCandidates();
      var candCount = 0;
      for(var ci=0; ci<oldCandidates.length; ci++){
        var oc = oldCandidates[ci];
        if(!oc || !oc.content) continue;
        /* 废词检查 */
        var isTrash = false;
        for(var ti=0; ti<TRASH_PAT.length; ti++){ if(TRASH_PAT[ti].test(oc.content)){ isTrash=true; break; } }
        if(isTrash) continue;
        if(oc.content.length < 6) continue;

        var nc = newCandidate();
        nc.proposed_text = oc.content.slice(0,300);
        nc.raw_text = (oc.sourceSummary||'').slice(0,200) || oc.content.slice(0,200);
        nc.reason = '从 v1 候选区迁移';
        nc.confidence = (oc.confidence||1) * 0.25;
        if(!store.candidateMemories) store.candidateMemories = [];
        store.candidateMemories.push(nc);
        candCount++;
        logAction('migrate_candidate', oc.content, '', '从 v1 候选区迁移');
      }

      saveStore(store);
      saveJSON(K.migrationV2, { completed:true, migratedAt:nowISO(), memoriesCount:count, candidatesCount:candCount });
      logAction('migration_complete', '', count+' 条记忆 + '+candCount+' 条候选', 'v1→v2 迁移完成');
      return { migrated:count, candidates:candCount };
    }

    /* ==============================================================
       initMemoryV3 — 初始化
       ============================================================== */
    function init(){
      if(window.__MEMORY_V3_INIT__) return;
      window.__MEMORY_V3_INIT__ = true;

      var migrationFlag = readJSON(K.migrationV2, null);
      if(!migrationFlag || !migrationFlag.completed){
        try{ migrate(); }catch(e){ console.warn('[MemoryV3] Migration failed:', e); }
      }

      logAction('init', '', '', 'MemoryEngine v3 初始化');
    }

    /* ==============================================================
       公开 API
       ============================================================== */
    return {
      KEYS: K,
      loadStore: loadStore,
      saveStore: saveStore,
      classify: classifyV3,
      score: scoreV3,
      normalize: normalizeRaw,
      resolveRef: resolveRef,
      extract: extract,
      upsert: upsert,
      addCandidate: addCandidate,
      rejectTrash: rejectTrash,
      buildHistoryRef: buildHistoryRef,
      retrieve: retrieve,
      buildContext: buildContext,
      log: logAction,
      migrate: migrate,
      init: init,
      similarity: textSimilarity,
      // Pattern banks (for testing)
      PATTERNS: {
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

  /* 暴露到 window 供测试脚本使用 */
  window.__MEMORY_V3__ = MEMORY_V3;
