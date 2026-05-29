'use strict';
window.DAOTIAN_TTS_UTILS = window.DAOTIAN_TTS_UTILS || {};
(function(){
  /* 生成 TTS 消息唯一 ID（纯函数） */
  function makeTtsMsgId(chatId, idx){
    return 'tts_' + chatId + '_' + idx;
  }
  window.DAOTIAN_TTS_UTILS.makeTtsMsgId = makeTtsMsgId;
})();
