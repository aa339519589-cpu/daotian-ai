'use strict';
window.DAOTIAN_TTS = window.DAOTIAN_TTS || {};
(function(){
  function createTtsApi(deps){
    deps = deps || {};
    const readJSON = deps.readJSON;
    const saveJSON = deps.saveJSON;
    const getAuthUser = deps.getAuthUser || function(){ return null; };
    const KEYS = deps.KEYS;
    const config = window.DAOTIAN_CONFIG || {};
    const defaultVoiceSettings = config.defaultVoiceSettings;

    function loadVoiceSettings(){
      var raw = readJSON(KEYS.voiceSettings, null);
      var out = Object.assign({}, defaultVoiceSettings, raw && typeof raw === 'object' ? raw : {});
      if(out.provider !== 'edge' && out.provider !== 'fish'){ out.provider = 'edge'; }
      var isGuest = !getAuthUser() || !getAuthUser().id;
      if(isGuest && out.provider === 'fish' && (!out.fishAudioApiKey || !out.fishAudioReferenceId)){
        out.provider = 'edge';
        out.edgeVoice = out.edgeVoice || 'zh-CN-XiaoxiaoNeural';
        out.edgeVoiceLabel = out.edgeVoiceLabel || '小小';
      }
      if(!out.edgeVoice) out.edgeVoice = 'zh-CN-XiaoxiaoNeural';
      if(!out.edgeVoiceLabel) out.edgeVoiceLabel = '小小';
      if(!out.rate) out.rate = '+25%';
      if(typeof out.enabled === 'undefined') out.enabled = true;
      if(out.voiceSpeedVersion !== 2){
        var speedMap = {'+0%':'+10%', '+10%':'+25%', '+25%':'+40%'};
        out.rate = speedMap[out.rate] || '+25%';
        out.voiceSpeedVersion = 2;
      }
      return out;
    }

    function saveVoiceSettings(v){ saveJSON(KEYS.voiceSettings, v); }

    function getSafeVoiceSettingsForTts(){
      var vs = loadVoiceSettings();
      if(!vs || typeof vs !== 'object') vs = {};
      vs = Object.assign({}, defaultVoiceSettings, vs);
      if(vs.provider !== 'edge' && vs.provider !== 'fish'){ vs.provider = 'edge'; }
      var _isGuest = !getAuthUser() || !getAuthUser().id;
      if((_isGuest || vs.provider === 'fish') && (!vs.fishAudioApiKey || !vs.fishAudioReferenceId)){ vs.provider = 'edge'; }
      if(!vs.edgeVoice) vs.edgeVoice = 'zh-CN-XiaoxiaoNeural';
      if(!vs.edgeVoiceLabel) vs.edgeVoiceLabel = '小小';
      if(!vs.rate) vs.rate = '+25%';
      if(typeof vs.enabled === 'undefined') vs.enabled = true;
      return vs;
    }

    function makeTtsMsgId(chatId, idx){ return 'tts_' + chatId + '_' + idx; }

    return {
      loadVoiceSettings: loadVoiceSettings,
      saveVoiceSettings: saveVoiceSettings,
      getSafeVoiceSettingsForTts: getSafeVoiceSettingsForTts,
      makeTtsMsgId: makeTtsMsgId
    };
  }

  window.DAOTIAN_TTS.createTtsApi = createTtsApi;
})();
