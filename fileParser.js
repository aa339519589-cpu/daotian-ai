import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TEXT_OUTPUT = 120000;
const MAX_ZIP_FILES = 80;
const MAX_ZIP_DEPTH = 4;
const MAX_ZIP_TOTAL_SIZE = 40 * 1024 * 1024;
const PDF_OCR_MAX_PAGES = Math.max(1, Math.min(80, Number(process.env.PDF_OCR_MAX_PAGES || 40)));
const PDF_OCR_SCALE = Math.max(1.5, Math.min(4, Number(process.env.PDF_OCR_SCALE || 3)));

let _pdfParse;
let _pdfToImg;
let _ocrWorker;
let _mammoth;
let _xlsx;
let _AdmZip;

function ext(name){
  const p = String(name || "").split(".");
  return p.length > 1 ? p.pop().toLowerCase() : "";
}
function visibleLen(text){ return String(text || "").replace(/\s/g, "").length; }
function textTruncate(text, maxLen = MAX_TEXT_OUTPUT){
  text = String(text || "");
  return text.length <= maxLen ? text : text.slice(0, maxLen) + `\n\n...（文件较大，已截断前 ${maxLen} 字符）`;
}
function pageText(pages){
  return (pages || []).filter(p => visibleLen(p.text) > 0).map(p => `[PDF第${p.page}页]\n${String(p.text || "").trim()}`).join("\n\n");
}

function detectMime(buf, fileName){
  const e = ext(fileName);
  const head = Buffer.isBuffer(buf) ? buf.slice(0, 12) : Buffer.alloc(0);
  if(head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
  if(head[0] === 0x50 && head[1] === 0x4b){
    if(e === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if(e === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if(e === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    return "application/zip";
  }
  if(head[0] === 0x89 && head[1] === 0x50) return "image/png";
  if(head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  if(head[0] === 0x47 && head[1] === 0x49) return "image/gif";
  if(head[0] === 0x52 && head[1] === 0x49 && head[8] === 0x57 && head[9] === 0x45) return "image/webp";
  if(["txt","md","markdown","csv","json","log","xml","html","css","js","ts","py"].includes(e)) return "text/plain";
  return "application/octet-stream";
}
function safeText(buf){
  try{ return buf.toString("utf8"); }catch{ return buf.toString("latin1"); }
}

async function getPdfParse(){
  if(_pdfParse !== undefined) return _pdfParse;
  try{
    const mod = await import("pdf-parse");
    _pdfParse = mod.PDFParse || (typeof mod.default === "function" ? mod.default : mod);
  }catch(e){
    console.warn("[fileParser] pdf-parse unavailable:", e.message);
    _pdfParse = null;
  }
  return _pdfParse;
}
async function getPdfToImg(){
  if(_pdfToImg !== undefined) return _pdfToImg;
  try{
    const mod = await import("pdf-to-img");
    _pdfToImg = mod.pdf || (mod.default && mod.default.pdf) || mod.default || mod;
    if(typeof _pdfToImg !== "function") _pdfToImg = null;
  }catch(e){
    console.warn("[fileParser] pdf-to-img unavailable:", e.message);
    _pdfToImg = null;
  }
  return _pdfToImg;
}
async function getOcrWorker(){
  if(_ocrWorker !== undefined) return _ocrWorker;
  try{
    const Tesseract = (await import("tesseract.js")).default;
    _ocrWorker = await Tesseract.createWorker("chi_sim+eng");
    console.log("[fileParser] OCR worker ready: chi_sim+eng");
  }catch(e){
    console.warn("[fileParser] OCR unavailable:", e.message);
    _ocrWorker = null;
  }
  return _ocrWorker;
}
async function getMammoth(){
  if(_mammoth !== undefined) return _mammoth;
  try{ _mammoth = (await import("mammoth")).default; }catch{ _mammoth = null; }
  return _mammoth;
}
async function getXlsx(){
  if(_xlsx !== undefined) return _xlsx;
  try{ _xlsx = await import("xlsx"); }catch{ _xlsx = null; }
  return _xlsx;
}
async function getAdmZip(){
  if(_AdmZip !== undefined) return _AdmZip;
  try{ _AdmZip = (await import("adm-zip")).default; }catch{ _AdmZip = null; }
  return _AdmZip;
}

async function extractPdfTextLayer(buf){
  const PdfMod = await getPdfParse();
  if(!PdfMod) return { pages:[], pageCount:0, error:"PDF 文本解析库不可用" };
  try{
    let pages = [];
    let pageCount = 0;
    let info = {};
    if(typeof PdfMod === "function" && PdfMod.prototype && PdfMod.prototype.getText){
      const parser = new PdfMod({ data:buf });
      const result = await parser.getText();
      if(result && Array.isArray(result.pages)){
        pageCount = result.pages.length;
        pages = result.pages.map((p, i) => ({ page:i + 1, text:String(p && p.text || "").trim() }));
      }
      try{ const inf = await parser.getInfo(); if(inf) info = inf; }catch{}
      try{ await parser.destroy(); }catch{}
    }else if(typeof PdfMod === "function"){
      const data = await PdfMod(buf);
      const text = String(data && data.text || "").trim();
      pageCount = Number(data && data.numpages || 0);
      info = data && data.info || {};
      const split = text.split(/\f+/).map(x => x.trim()).filter(Boolean);
      pages = split.length ? split.map((t, i) => ({ page:i + 1, text:t })) : (text ? [{ page:1, text }] : []);
    }else if(PdfMod && typeof PdfMod.parse === "function"){
      const data = await PdfMod.parse(buf);
      const text = String(data && data.text || "").trim();
      pageCount = Number(data && data.numpages || 0);
      const split = text.split(/\f+/).map(x => x.trim()).filter(Boolean);
      pages = split.length ? split.map((t, i) => ({ page:i + 1, text:t })) : (text ? [{ page:1, text }] : []);
    }
    return { pages, pageCount, info };
  }catch(e){
    return { pages:[], pageCount:0, error:"PDF 文本层解析失败：" + (e.message || "未知错误") };
  }
}
async function pageToBuffer(page){
  if(Buffer.isBuffer(page)) return page;
  if(page && typeof page.toBuffer === "function") return page.toBuffer();
  if(page && Buffer.isBuffer(page.buffer)) return page.buffer;
  return null;
}
async function ocrSlidePdf(buf, fileName){
  const pdf = await getPdfToImg();
  if(!pdf) return { pages:[], pageCount:0, error:"PDF 转图片解析器不可用" };
  const worker = await getOcrWorker();
  if(!worker) return { pages:[], pageCount:0, error:"OCR 解析器不可用" };

  const root = await mkdtemp(join(tmpdir(), "daotian-pdf-"));
  const pdfPath = join(root, "input.pdf");
  try{
    await writeFile(pdfPath, buf);
    const doc = await pdf(pdfPath, { scale:PDF_OCR_SCALE });
    const pages = [];
    let pageNo = 0;
    let truncated = false;
    for await (const page of doc){
      pageNo++;
      if(pageNo > PDF_OCR_MAX_PAGES){ truncated = true; break; }
      try{
        const img = await pageToBuffer(page);
        if(!img){ pages.push({ page:pageNo, text:"", error:"该页转图片失败" }); continue; }
        const { data } = await worker.recognize(img);
        pages.push({ page:pageNo, text:String(data && data.text || "").trim(), confidence:Number(data && data.confidence || 0) });
      }catch(e){
        pages.push({ page:pageNo, text:"", error:"该页 OCR 失败：" + (e.message || "未知错误") });
      }
    }
    return { pages, pageCount:pageNo, truncated };
  }catch(e){
    return { pages:[], pageCount:0, error:"幻灯片式 PDF 解析失败：" + (e.message || "未知错误") };
  }
}
async function parsePdf(buf, fileName, mimeType){
  const textLayer = await extractPdfTextLayer(buf);
  const textLayerText = pageText(textLayer.pages);
  if(visibleLen(textLayerText) > 20){
    const clean = textLayer.pages.filter(p => visibleLen(p.text) > 0);
    return {
      fileType:"pdf", parseStatus:"ok", text:textTruncate(textLayerText),
      metadata:{ pages:textLayer.pageCount || clean.length || 1, textLength:textLayerText.length, textLayer:true, slideMode:false, info:textLayer.info || {} },
      chunks:clean.slice(0,80).map(p => ({ page:p.page, text:String(p.text || "").slice(0,4000) }))
    };
  }

  console.log(`[fileParser] PDF "${fileName}" has no text layer, start slide/scanned PDF OCR`);
  const ocr = await ocrSlidePdf(buf, fileName);
  const ocrText = pageText(ocr.pages);
  if(visibleLen(ocrText) > 20){
    const clean = ocr.pages.filter(p => visibleLen(p.text) > 0);
    const warnings = ["该 PDF 为幻灯片式/扫描版，已转成图片并逐页 OCR 识别"];
    if(ocr.truncated) warnings.push(`PDF 页数较多，本次 OCR 先读取前 ${PDF_OCR_MAX_PAGES} 页`);
    return {
      fileType:"pdf", parseStatus:"ok", text:textTruncate(ocrText),
      metadata:{ pages:ocr.pageCount || clean.length || 0, textLength:ocrText.length, textLayer:false, slideMode:true, ocr:true, ocrMaxPages:PDF_OCR_MAX_PAGES, scale:PDF_OCR_SCALE },
      warnings,
      chunks:clean.slice(0,80).map(p => ({ page:p.page, text:String(p.text || "").slice(0,4000), confidence:p.confidence || 0 }))
    };
  }
  return {
    fileType:"pdf", parseStatus:"empty", text:"",
    metadata:{ pages:ocr.pageCount || textLayer.pageCount || 0, textLayer:false, slideMode:true, ocr:true, hasText:false },
    warnings:["该 PDF 没有可读文字层，已尝试幻灯片式逐页 OCR，但未识别出有效文字", textLayer.error ? "文本层错误：" + textLayer.error : "", ocr.error ? "OCR 错误：" + ocr.error : ""].filter(Boolean)
  };
}

async function parseDocx(buf){
  const mammoth = await getMammoth();
  if(!mammoth) return { fileType:"docx", parseStatus:"error", error:"DOCX 解析库未安装" };
  try{
    const result = await mammoth.extractRawText({ buffer:buf });
    const text = String(result.value || "").trim();
    if(!text) return { fileType:"docx", parseStatus:"empty", text:"", warnings:["DOCX 文件中未提取到文本内容"] };
    return { fileType:"docx", parseStatus:"ok", text:textTruncate(text), metadata:{ textLength:text.length } };
  }catch(e){ return { fileType:"docx", parseStatus:"error", error:"DOCX 解析失败：" + e.message }; }
}
async function parsePptx(buf){
  const AdmZip = await getAdmZip();
  if(!AdmZip) return { fileType:"pptx", parseStatus:"error", error:"PPTX 解析库未安装" };
  try{
    const zip = new AdmZip(buf);
    const slides = [];
    for(const entry of zip.getEntries()){
      const m = entry.entryName.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if(!m || entry.isDirectory) continue;
      const xml = entry.getData().toString("utf8");
      const texts = [];
      const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
      let match;
      while((match = re.exec(xml)) !== null){ if(match[1]) texts.push(match[1]); }
      if(texts.length) slides.push({ slide:Number(m[1]), text:texts.join(" ").replace(/\s+/g," ").trim() });
    }
    slides.sort((a,b)=>a.slide-b.slide);
    const fullText = slides.map(s => `[幻灯片 ${s.slide}]\n${s.text}`).join("\n\n");
    if(!fullText) return { fileType:"pptx", parseStatus:"empty", text:"", warnings:["PPTX 文件中未提取到文本内容"] };
    return { fileType:"pptx", parseStatus:"ok", text:textTruncate(fullText), metadata:{ slides:slides.length, textLength:fullText.length }, chunks:slides.slice(0,80).map(s=>({ slide:s.slide, text:s.text.slice(0,3000) })) };
  }catch(e){ return { fileType:"pptx", parseStatus:"error", error:"PPTX 解析失败：" + e.message }; }
}
async function parseXlsx(buf){
  const XLSX = await getXlsx();
  if(!XLSX) return { fileType:"xlsx", parseStatus:"error", error:"Excel 解析库未安装" };
  try{
    const workbook = XLSX.read(buf, { type:"buffer" });
    const sheets = [];
    for(const name of workbook.SheetNames){
      const sheet = workbook.Sheets[name];
      const rows = XLSX.utils.sheet_to_json(sheet, { header:1, defval:"" });
      const sample = rows.slice(0,100).map(row => row.map(cell => String(cell || "").slice(0,200)).join("\t")).join("\n");
      sheets.push({ name, rows:rows.length, cols:rows[0] ? rows[0].length : 0, sample });
    }
    const text = sheets.map(s => `=== 工作表：${s.name} ===\n${s.rows} 行 × ${s.cols} 列\n\n${s.sample}`).join("\n\n");
    return { fileType:"xlsx", parseStatus:"ok", text:textTruncate(text), metadata:{ sheets:sheets.length, sheetNames:workbook.SheetNames }, chunks:sheets };
  }catch(e){ return { fileType:"xlsx", parseStatus:"error", error:"Excel 解析失败：" + e.message }; }
}
async function parseCsv(buf){
  const text = safeText(buf).replace(/\r\n/g,"\n").replace(/\r/g,"\n");
  return { fileType:"csv", parseStatus:visibleLen(text) ? "ok" : "empty", text:textTruncate(text), metadata:{ lines:text.split("\n").length } };
}
async function parseTextFile(buf, fileName){
  const text = safeText(buf);
  if(!text.trim()) return { fileType:"text", parseStatus:"empty", text:"", warnings:["文件中未检测到文本内容"] };
  return { fileType:"text", parseStatus:"ok", text:textTruncate(text), metadata:{ extension:ext(fileName), lines:text.split("\n").length, size:buf.length } };
}
async function parseZip(buf, fileName, depth = 0){
  if(depth >= MAX_ZIP_DEPTH) return { fileType:"zip", parseStatus:"error", error:"压缩包嵌套层级过深" };
  const AdmZip = await getAdmZip();
  if(!AdmZip) return { fileType:"zip", parseStatus:"error", error:"ZIP 解析库未安装" };
  try{
    const zip = new AdmZip(buf);
    const entries = zip.getEntries().filter(e => !e.isDirectory);
    if(entries.length > MAX_ZIP_FILES) return { fileType:"zip", parseStatus:"error", error:`压缩包内文件过多（${entries.length}），最多支持 ${MAX_ZIP_FILES} 个文件` };
    let total = 0;
    const tree = [];
    const parsed = [];
    for(const entry of entries){
      const ebuf = entry.getData();
      total += ebuf.length;
      tree.push({ name:entry.entryName, size:ebuf.length });
      if(total > MAX_ZIP_TOTAL_SIZE) continue;
      const name = entry.entryName.split("/").pop() || entry.entryName;
      const e = ext(name);
      if(["txt","md","json","csv","log","xml","html","css","js","ts","py"].includes(e)) parsed.push({ fileName:name, text:safeText(ebuf).slice(0,10000) });
      else if(e === "pdf"){
        const r = await parsePdf(ebuf, name, "application/pdf");
        if(r.parseStatus === "ok") parsed.push({ fileName:name, text:r.text || "" });
      }
    }
    const treeText = tree.map(f => `  ${f.name} (${(f.size/1024).toFixed(1)} KB)`).join("\n");
    const content = parsed.map(f => `--- ${f.fileName} ---\n${f.text}`).join("\n\n");
    return { fileType:"zip", parseStatus:"ok", text:textTruncate(`压缩包「${fileName}」包含 ${tree.length} 个文件：\n${treeText}\n\n${content}`), metadata:{ fileCount:tree.length, parsedCount:parsed.length, totalSize:total, tree } };
  }catch(e){ return { fileType:"zip", parseStatus:"error", error:"ZIP 解析失败：" + e.message }; }
}

export async function parseUploadedFile(buf, fileName, mimeType = ""){
  if(!Buffer.isBuffer(buf) || buf.length === 0) return { fileName:fileName || "unknown", parseStatus:"error", error:"文件为空或损坏" };
  if(buf.length > MAX_FILE_SIZE) return { fileName, parseStatus:"error", error:`文件过大（${(buf.length/1024/1024).toFixed(1)}MB），最大支持 ${MAX_FILE_SIZE/1024/1024}MB` };

  const e = ext(fileName);
  const detectedMime = detectMime(buf, fileName);
  const effectiveMime = mimeType || detectedMime;
  let result;

  try{
    if(effectiveMime === "application/pdf" || e === "pdf") result = await parsePdf(buf, fileName, effectiveMime);
    else if(effectiveMime.includes("wordprocessingml") || e === "docx") result = await parseDocx(buf, fileName);
    else if(effectiveMime.includes("spreadsheetml") || e === "xlsx") result = await parseXlsx(buf, fileName);
    else if(e === "xls") result = { fileType:"xls", parseStatus:"error", error:"旧版 .xls 格式暂不支持，请转换为 .xlsx 后上传" };
    else if(effectiveMime.includes("presentationml") || e === "pptx") result = await parsePptx(buf, fileName);
    else if(effectiveMime === "application/zip" || e === "zip") result = await parseZip(buf, fileName);
    else if(e === "csv" || e === "tsv") result = await parseCsv(buf, fileName);
    else if(/^image\//.test(effectiveMime) || ["png","jpg","jpeg","webp","gif","bmp"].includes(e)) result = { fileType:"image", parseStatus:"not_supported", text:"", metadata:{ type:effectiveMime }, warnings:["图片文件需要视觉模型或 OCR 才能识别内容，当前系统暂不支持自动图片识别"] };
    else if(["doc","ppt"].includes(e)) result = { fileType:e, parseStatus:"error", error:`旧版 .${e} 格式暂不支持，请转换为 .${e}x 后上传` };
    else if(["rar","7z"].includes(e)) result = { fileType:e, parseStatus:"error", error:`${e.toUpperCase()} 格式暂不支持，请使用 ZIP 格式压缩后上传` };
    else{
      const textExts = ["txt","md","markdown","log","ini","conf","env","yaml","yml","toml","xml","html","htm","css","js","ts","tsx","jsx","json","sql","py","java","cpp","c","h","go","rs","php","rb","sh","bat","ps1","r","m","swift","kt","scala","lua","pl","cfg","dockerfile","gitignore","makefile"];
      result = (textExts.includes(e) || effectiveMime.startsWith("text/")) ? await parseTextFile(buf, fileName) : { fileType:e, parseStatus:"not_supported", text:"", metadata:{ extension:e }, warnings:[`暂不支持解析 .${e} 文件类型`] };
    }
  }catch(err){
    result = { fileType:e, parseStatus:"error", error:"文件解析异常：" + (err.message || "未知错误") };
  }

  return { fileName, mimeType:effectiveMime, size:buf.length, fileType:e, ...result };
}

export function buildFileContext(parsedFiles, strategy = "standard"){
  if(!parsedFiles || !parsedFiles.length) return "";
  const parts = [`[用户上传了 ${parsedFiles.length} 个文件]`];
  const failed = parsedFiles.filter(f => f.parseStatus !== "ok");
  const ok = parsedFiles.filter(f => f.parseStatus === "ok");
  if(failed.length){
    parts.push("以下文件未能解析：\n" + failed.map(f => `- ${f.fileName}：${f.error || (f.warnings && f.warnings[0]) || "未知原因"}`).join("\n"));
  }
  for(const f of ok){
    const meta = f.metadata || {};
    let header = `--- 文件：${f.fileName} ---`;
    if(f.fileType === "pdf") header = `--- PDF：${f.fileName}（${meta.pages || "?"} 页，${meta.textLength || 0} 字符${meta.slideMode ? "，幻灯片OCR" : ""}）---`;
    else if(f.fileType === "docx") header = `--- Word 文档：${f.fileName}（${meta.textLength || 0} 字符）---`;
    else if(f.fileType === "xlsx") header = `--- Excel 表格：${f.fileName} ---`;
    else if(f.fileType === "pptx") header = `--- PPT 演示：${f.fileName}（${meta.slides || 0} 张幻灯片）---`;
    else if(f.fileType === "zip") header = `--- 压缩包：${f.fileName}（${meta.fileCount || 0} 个文件）---`;
    parts.push(header);
    if(f.warnings && f.warnings.length) parts.push("解析提示：" + f.warnings.join("；"));
    parts.push((f.text || "").slice(0, strategy === "minimal" ? 500 : MAX_TEXT_OUTPUT));
  }
  return parts.join("\n\n");
}

export default { parseUploadedFile, buildFileContext };
