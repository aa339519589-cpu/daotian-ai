'use strict';
window.DAOTIAN_GLOBALS = window.DAOTIAN_GLOBALS || {};
var DTG = window.DAOTIAN_GLOBALS;

/* DOM 简写 */
DTG.$ = function(sel, root){ return (root || document).querySelector(sel); };

/* ID 生成 */
DTG.uid = function(){ return 'c_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,8); };

/* 时间格式化 */
DTG.nowTime = function(){ return new Date().toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false}); };

/* localStorage Key 常量 */
DTG.KEYS = {
  chats:'daotian.chats.v323', active:'daotian.activeChat.v323', settings:'daotian.settings.v323', theme:'daotian.theme.v323',
  oldChats:'daotian.chats', oldActive:'daotian.activeChat', oldSettings:'daotian.settings',
  v322Chats:'daotian.chats.v322', v322Active:'daotian.activeChat.v322', v322Settings:'daotian.settings.v322',
  modelParams:'daotian.modelParams.v1',
  accessPackages:'daotian.accessPackages.v1',
  accessClaims:'daotian.accessClaims.v1',
  personalization:'daotian.personalization.v1',
  memories:'daotian.memories.v1',
  memoryCandidates:'daotian.memoryCandidates.v1',
  autoExtract:'daotian.autoExtract.v1',
  memoryGlobal:'daotian.memoryGlobal.v1',
  tokenDisplay:'daotian.tokenDisplay.v2',
  autoScroll:'daotian.autoScroll.v1',
  themeMode:'daotian.themeMode.v1',
  fontSize:'daotian.fontSize.v1',
  voiceSettings:'daotian.voiceSettings.v1',
};

/* HTML 转义 */
DTG.escapeHTML = function(s){ return String(s).replace(/[&<>"]/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]); }); };
DTG.escapeAttr = function(s){ return String(s).replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); }); };
