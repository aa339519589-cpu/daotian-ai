import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import originalParser, { buildFileContext as originalBuildFileContext } from "./fileParser.js";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const MAX_TEXT_OUTPUT = 120000;
const PDF_OCR_MAX_PAGES = Math.max(1, Math.min(80, Number(process.env.PDF_OCR_MAX_PAGES || 40)));
const PDF_OCR_SCALE = Math.max(1.5, Math.min(4, Number(process.env.PDF_OCR_SCALE || 3)));
let _pdfParse;
let _pdfToImg;
let _worker;

function ext(name){ const p = String(name || "").split("."); return p.length > 1 ? p.pop().toLowerCase() : ""; }
function visibleLen(s){ return String(s || "").replace(/\s/g, "").length; }
function trunc(s, n = MAX_TEXT_OUTPUT){ s = String(s || ""); return s.length <= n ? s : s.slice(0, n) + `\n\n...（PDF 内容较长，已截断前 ${n} 字符）`; }
function isPdf(buf, name, mime){ return ext(name) === "pdf" || String(mime || "").toLowerCase().includes("pdf") || (Buffer.isBuffer(buf) && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46); }
function pagedText(pages){ return (pages || []).filter(p => visibleLen(p.text) > 0).map(p => `[PDF第${p.page}页]\n${String(p.text || "").trim()}`).join("\n\n"); }

async function getPdfParse(){
  if(_pdfParse !== undefined) return _pdfParse;
  try{ const m = await import("pdf-parse"); _pdfParse = m.PDFParse || (typeof m.default === "function" ? m.default : m); }
  catch(e){ console.warn("[slide-pdf] pdf-parse unavailable:", e.message); _pdfParse = null; }
  return _pdfParse;
}
async function getPdfToImg(){
  if(_pdfToImg !== undefined) return _pdfToImg;
  try{ const m = await import("pdf-to-img"); _pdfToImg = m.pdf || (m.default && m.default.pdf) || m.default || m; if(typeof _pdfToImg !== "function") _pdfToImg = null; }
  catch(e){ console.warn("[slide-pdf] pdf-to-img unavailable:", e.message); _pdfToImg = null; }
  return _pdfToImg;
}
async function getWorker(){
  if(_worker !== undefined) return _worker;
  try{ const Tesseract = (await import("tesseract.js")).default; _worker = await Tesseract.createWorker("chi_sim+eng"); console.log("[slide-pdf] OCR worker ready"); }
  catch(e){ console.warn("[slide-pdf] OCR unavailable:", e.message); _worker = null; }
  return _worker;
}

async function extractTextLayer(buf){
  const PdfMod = await getPdfParse();
  if(!PdfMod) return { pages:[], pageCount:0, error:"PDF 文本解析库不可用" };
  try{
    let pages = [], pageCount = 0, info = {};
    if(typeof PdfMod === "function" && PdfMod.prototype && PdfMod.prototype.getText){
      const parser = new PdfMod({ data:buf });
      const r = await parser.getText();
      if(r && Array.isArray(r.pages)){ pageCount = r.pages.length; pages = r.pages.map((p, i) => ({ page:i + 1, text:String(p && p.text || "").trim() })); }
      try{ const inf = await parser.getInfo(); if(inf) info = inf; }catch{}
      try{ await parser.destroy(); }catch{}
    }else if(typeof PdfMod === "function"){
      const d = await PdfMod(buf);
      const t = String(d && d.text || "").trim();
      pageCount = Number(d && d.numpages || 0); info = d && d.info || {};
      const split = t.split(/\f+/).map(x => x.trim()).filter(Boolean);
      pages = split.length ? split.map((t, i) => ({ page:i + 1, text:t })) : (t ? [{ page:1, text:t }] : []);
    }else if(PdfMod && typeof PdfMod.parse === "function"){
      const d = await PdfMod.parse(buf);
      const t = String(d && d.text || "").trim();
      pageCount = Number(d && d.numpages || 0);
      const split = t.split(/\f+/).map(x => x.trim()).filter(Boolean);
      pages = split.length ? split.map((t, i) => ({ page:i + 1, text:t })) : (t ? [{ page:1, text:t }] : []);
    }
    return { pages, pageCount, info };
  }catch(e){ return { pages:[], pageCount:0, error:"PDF 文本层解析失败：" + (e.message || "未知错误") }; }
}

async function pageBuffer(page){
  if(Buffer.isBuffer(page)) return page;
  if(page && typeof page.toBuffer === "function") return page.toBuffer();
  if(page && Buffer.isBuffer(page.buffer)) return page.buffer;
  return null;
}

async function ocrPages(buf){
  const pdf = await getPdfToImg();
  if(!pdf) return { pages:[], pageCount:0, error:"PDF 转图片解析器不可用" };
  const worker = await getWorker();
  if(!worker) return { pages:[], pageCount:0, error:"OCR 解析器不可用" };
  const root = await mkdtemp(join(tmpdir(), "daotian-pdf-"));
  const pdfPath = join(root, "input.pdf");
  try{
    await writeFile(pdfPath, buf);
    const doc = await pdf(pdfPath, { scale: PDF_OCR_SCALE });
    const pages = [];
    let pageNo = 0, truncated = false;
    for await (const page of doc){
      pageNo++;
      if(pageNo > PDF_OCR_MAX_PAGES){ truncated = true; break; }
      try{
        const img = await pageBuffer(page);
        if(!img){ pages.push({ page:pageNo, text:"", error:"该页转图片失败" }); continue; }
        const { data } = await worker.recognize(img);
        pages.push({ page:pageNo, text:String(data && data.text || "").trim(), confidence:Number(data && data.confidence || 0) });
      }catch(e){ pages.push({ page:pageNo, text:"", error:"该页 OCR 失败：" + (e.message || "未知错误") }); }
    }
    return { pages, pageCount:pageNo, truncated };
  }catch(e){ return { pages:[], pageCount:0, error:"幻灯片式 PDF 解析失败：" + (e.message || "未知错误") }; }
}

async function parseSlidePdf(buf, fileName, mimeType){
  if(!Buffer.isBuffer(buf) || !buf.length) return { fileName, fileType:"pdf", mimeType:mimeType || "application/pdf", parseStatus:"error", error:"PDF 文件为空或损坏" };
  if(buf.length > MAX_FILE_SIZE) return { fileName, fileType:"pdf", mimeType:mimeType || "application/pdf", parseStatus:"error", error:`PDF 文件过大（${(buf.length/1024/1024).toFixed(1)}MB），最大支持 ${MAX_FILE_SIZE/1024/1024}MB` };

  const layer = await extractTextLayer(buf);
  const layerText = pagedText(layer.pages);
  if(visibleLen(layerText) > 20){
    const clean = layer.pages.filter(p => visibleLen(p.text) > 0);
    return { fileName, fileType:"pdf", mimeType:mimeType || "application/pdf", parseStatus:"ok", text:trunc(layerText), metadata:{ pages:layer.pageCount || clean.length || 1, textLength:layerText.length, textLayer:true, slideMode:false, info:layer.info || {} }, chunks:clean.slice(0, 80).map(p => ({ page:p.page, text:String(p.text || "").slice(0, 4000) })) };
  }

  console.log(`[slide-pdf] ${fileName}: no text layer, start page OCR`);
  const ocr = await ocrPages(buf);
  const ocrText = pagedText(ocr.pages);
  if(visibleLen(ocrText) > 20){
    const clean = ocr.pages.filter(p => visibleLen(p.text) > 0);
    const warnings = ["该 PDF 为幻灯片式/扫描版，已转成图片并逐页 OCR 识别"];
    if(ocr.truncated) warnings.push(`PDF 页数较多，本次 OCR 先读取前 ${PDF_OCR_MAX_PAGES} 页`);
    return { fileName, fileType:"pdf", mimeType:mimeType || "application/pdf", parseStatus:"ok", text:trunc(ocrText), metadata:{ pages:ocr.pageCount || clean.length || 0, textLength:ocrText.length, textLayer:false, slideMode:true, ocr:true, ocrMaxPages:PDF_OCR_MAX_PAGES, scale:PDF_OCR_SCALE }, warnings, chunks:clean.slice(0, 80).map(p => ({ page:p.page, text:String(p.text || "").slice(0, 4000), confidence:p.confidence || 0 })) };
  }

  return { fileName, fileType:"pdf", mimeType:mimeType || "application/pdf", parseStatus:"empty", text:"", metadata:{ pages:ocr.pageCount || layer.pageCount || 0, textLayer:false, slideMode:true, ocr:true, hasText:false }, warnings:["该 PDF 没有可读文字层，已尝试幻灯片式逐页 OCR，但未识别出有效文字", layer.error ? "文本层错误：" + layer.error : "", ocr.error ? "OCR 错误：" + ocr.error : ""].filter(Boolean) };
}

export async function parseUploadedFile(buf, fileName, mimeType = ""){
  if(isPdf(buf, fileName, mimeType)) return parseSlidePdf(buf, fileName, mimeType);
  return originalParser.parseUploadedFile(buf, fileName, mimeType);
}
export function buildFileContext(parsedFiles, strategy = "standard"){ return originalBuildFileContext(parsedFiles, strategy); }
export default { parseUploadedFile, buildFileContext };
