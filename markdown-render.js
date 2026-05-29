'use strict';
window.DAOTIAN_MARKDOWN_RENDER = window.DAOTIAN_MARKDOWN_RENDER || {};
(function(){
  /* 保护数学公式占位符，避免被 markdown 解析器破坏 */
  function protectMath(text){
    var placeholders = [];
    var idx = 0;
    /* protect $$...$$ and \[...\] */
    text = text.replace(/(\$\$|\\\[)([\s\S]*?)(\$\$|\\\])/g, function(m, open, body, close){
      var ph = '\0MATHBLOCK'+idx+'\0';
      placeholders.push(m);
      idx++;
      return ph;
    });
    /* protect \(...\) and $...$ (inline) */
    text = text.replace(/(\\\(|\$)([^\n$]+?)(\\\)|\$)/g, function(m, open, body, close){
      if(open === '$' && close === '$' && m.indexOf('$$')===0) return m; /* skip display */
      var ph = '\x01MATHINLINE'+idx+'\x01';
      placeholders.push(m);
      idx++;
      return ph;
    });
    return {text:text, placeholders:placeholders};
  }

  /* 还原数学公式占位符 */
  function restoreMath(html, placeholders){
    for(var i=0;i<placeholders.length;i++){
      html = html.replace('\0MATHBLOCK'+i+'\0', placeholders[i]);
      html = html.replace('\x01MATHINLINE'+i+'\x01', placeholders[i]);
    }
    return html;
  }

  /* 检测消息内容是否包含富文本元素（表格、代码块、HTML 等） */
  function hasRichLayoutContent(text){
    text = String(text || '');
    if(/```/.test(text)) return true;
    if(/<table|<iframe|<canvas|<svg|<!doctype html|<html/i.test(text)) return true;
    if(/^\s*\|.+\|\s*$/m.test(text) && /^\s*\|?\s*:?-{3,}:?\s*\|/m.test(text)) return true;
    if(text.split('\n').some(function(line){ return line.length > 60; })) return true;
    return false;
  }

  var DTMR = window.DAOTIAN_MARKDOWN_RENDER;
  DTMR.protectMath = protectMath;
  DTMR.restoreMath = restoreMath;
  DTMR.hasRichLayoutContent = hasRichLayoutContent;
})();
