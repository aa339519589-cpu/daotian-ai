// fileParser.js — Universal file parsing pipeline for 稻田 AI
// Lazy-loads parsers; each gracefully degrades if library is missing.

import { extname } from "node:path";

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB per file
const MAX_TEXT_OUTPUT = 80000;           // max chars per parsed file
const MAX_ZIP_FILES = 80;
const MAX_ZIP_DEPTH = 4;
const MAX_ZIP_TOTAL_SIZE = 40 * 1024 * 1024; // 40MB uncompressed total

/* ── OCR lazy-load ── */
let _tesseractWorker = null;
async function _getTesseractWorker(){
  if(_tesseractWorker === undefined){
    try{
      const Tesseract = (await import("tesseract.js")).default;
      _tesseractWorker = await Tesseract.createWorker("chi_sim+eng");
      console.log("[fileParser] Tesseract OCR worker ready (chi_sim+eng)");
    }catch(e){
      console.warn("[fileParser] Tesseract OCR unavailable:", e.message);
      _tesseractWorker = null;
    }
  }
  return _tesseractWorker;
}

let _pdf2img = undefined;
async function _getPdf2img(){
  if(_pdf2img === undefined){
    try{
      const mod = await import("pdf-to-img");
      _pdf2img = mod.default || mod;
    }catch(e){
      _pdf2img = null;
    }
  }
  return _pdf2img;
}

async function ocrPdf(buf, fileName){
  const worker = await _getTesseractWorker();
  if(!worker) return { text: "", error: "OCR 引擎未安装，请联系管理员安装 tesseract.js" };
  const pdf2img = await _getPdf2img();
  if(!pdf2img) return { text: "", error: "PDF 转图片引擎未安装" };

  try{
    const results = [];
    const maxPages = 10; // limit OCR to first 10 pages for performance

    // Convert PDF buffer to image pages
    const converter = pdf2img(buf, { scale: 2 }); // 2x scale for better OCR
    let pageNum = 0;

    for await (const page of converter) {
      pageNum++;
      if(pageNum > maxPages) break;

      try{
        const imageBuffer = page.toBuffer ? page.toBuffer() : (Buffer.isBuffer(page) ? page : null);
        if(!imageBuffer) continue;

        const { data } = await worker.recognize(imageBuffer);
        if(data && data.text && data.text.trim()){
          results.push(data.text.trim());
        }
      }catch(e){
        console.warn(`[fileParser] OCR page ${pageNum} failed:`, e.message);
      }
    }

    const text = results.join("\n\n");
    if(text.replace(/\s/g, "").length > 20){
      return { text: textTruncate(text), pages: pageNum, status: "ocr_ok" };
    }
    return { text: "", pages: pageNum, status: "ocr_empty", error: "OCR 未能识别出有效文字，PDF 可能为纯图片、手写体或质量过低" };
  }catch(e){
    return { text: "", error: "OCR 处理失败：" + (e.message || "未知错误").slice(0,100) };
  }
}

// ---- lazy parser loaders ----
let _pdfParse = undefined;
async function _getPdfParse() {
  if (_pdfParse === undefined) {
    try {
      const mod = await import("pdf-parse");
      // v2+: PDFParse class with getText() method
      if (mod.PDFParse) {
        _pdfParse = mod.PDFParse;
      } else if (typeof mod.default === "function") {
        _pdfParse = mod.default; // v1: default export function
      } else {
        _pdfParse = mod; // fallback
      }
    } catch { _pdfParse = null; }
  }
  return _pdfParse;
}

let _mammoth = undefined;
async function _getMammoth() {
  if (_mammoth === undefined) {
    try { _mammoth = (await import("mammoth")).default; } catch { _mammoth = null; }
  }
  return _mammoth;
}

let _xlsx = undefined;
async function _getXlsx() {
  if (_xlsx === undefined) {
    try { _xlsx = (await import("xlsx")); } catch { _xlsx = null; }
  }
  return _xlsx;
}

let _AdmZip = undefined;
async function _getAdmZip() {
  if (_AdmZip === undefined) {
    try { _AdmZip = (await import("adm-zip")).default; } catch { _AdmZip = null; }
  }
  return _AdmZip;
}

// ---- helpers ----
function ext(name) { const p = (name || "").split("."); return p.length > 1 ? p.pop().toLowerCase() : ""; }

function textTruncate(text, maxLen = MAX_TEXT_OUTPUT) {
  if (typeof text !== "string") return "";
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + `\n\n...（文件较大，已截断前 ${maxLen} 字符）`;
}

function detectMime(buf, fileName) {
  const e = ext(fileName);
  const head = buf.slice(0, 8);
  // PDF header
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return "application/pdf";
  // ZIP-based (DOCX/XLSX/PPTX/ZIP)
  if (head[0] === 0x50 && head[1] === 0x4b) {
    if (e === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (e === "xlsx") return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    if (e === "pptx") return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    if (e === "zip") return "application/zip";
    return "application/zip";
  }
  // PNG
  if (head[0] === 0x89 && head[1] === 0x50) return "image/png";
  // JPEG
  if (head[0] === 0xff && head[1] === 0xd8) return "image/jpeg";
  // GIF
  if (head[0] === 0x47 && head[1] === 0x49) return "image/gif";
  // WebP
  if (head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) return "image/webp";
  // text
  if (e === "txt" || e === "md" || e === "csv" || e === "json" || e === "log") return "text/plain";
  return "application/octet-stream";
}

function isUtf8(buf) {
  for (let i = 0; i < Math.min(buf.length, 4096); i++) {
    if (buf[i] === 0) return false;
    if (buf[i] >= 0xfe && buf[i] <= 0xff) continue;
  }
  return true;
}

function safeText(buf) {
  if (isUtf8(buf)) return buf.toString("utf8");
  try { return buf.toString("utf8"); } catch { return buf.toString("latin1"); }
}

// ---- individual parsers ----

async function parsePdf(buf, fileName) {
  const PdfMod = await _getPdfParse();
  if (!PdfMod) return { fileType: "pdf", parseStatus: "error", error: "PDF 解析库未安装，请联系管理员安装 pdf-parse" };

  try {
    let text = "";
    let numpages = 0;
    let info = {};

    // v2+ API: PDFParse class
    if (typeof PdfMod === "function" && PdfMod.prototype && PdfMod.prototype.getText) {
      const parser = new PdfMod({ data: buf });
      const result = await parser.getText();
      if (result && result.pages) {
        numpages = result.pages.length;
        text = result.pages.map(p => p.text || "").join("\n\n");
      }
      try { const infoResult = await parser.getInfo(); if (infoResult) info = infoResult; } catch {}
      await parser.destroy();
    }
    // v1 API: function(buf)
    else if (typeof PdfMod === "function") {
      const data = await PdfMod(buf);
      text = data.text || "";
      numpages = data.numpages || 0;
      info = data.info || {};
    }
    // Object with parse method
    else if (PdfMod && typeof PdfMod.parse === "function") {
      const data = await PdfMod.parse(buf);
      text = data.text || "";
      numpages = data.numpages || 0;
    }

    const hasText = text.replace(/\s/g, "").length > 20;

    if (!hasText) {
      /* 尝试 OCR 兜底 */
      console.log(`[fileParser] PDF "${fileName}" has no extractable text, attempting OCR...`);
      const ocrResult = await ocrPdf(buf, fileName);
      if(ocrResult.text && ocrResult.text.replace(/\s/g,"").length > 20){
        console.log(`[fileParser] OCR success for "${fileName}": ${ocrResult.text.length} chars, ${ocrResult.pages} pages`);
        return {
          fileType: "pdf",
          parseStatus: "ok",
          text: textTruncate(ocrResult.text, MAX_TEXT_OUTPUT),
          metadata: {
            pages: ocrResult.pages || numpages || 0,
            textLength: ocrResult.text.length,
            ocr: true,
            info: info && info.Title ? { title: info.Title, author: info.Author } : {}
          },
          warnings: ["该 PDF 为扫描件，已通过 OCR 识别文字"]
        };
      }
      console.log(`[fileParser] OCR failed for "${fileName}": ${ocrResult.error || "no text"}`);
      return {
        fileType: "pdf",
        parseStatus: "empty",
        text: "",
        metadata: { pages: numpages || 0, hasText: false },
        warnings: ["该 PDF 是扫描版，OCR 识别失败。请换清晰版本或上传图片页。原因：" + (ocrResult.error || "无法提取文字")]
      };
    }

    const pages = text.split(/\f/).filter(Boolean);
    return {
      fileType: "pdf",
      parseStatus: "ok",
      text: textTruncate(text),
      metadata: {
        pages: numpages || pages.length || 1,
        textLength: text.length,
        info: info && info.Title ? { title: info.Title, author: info.Author } : {}
      },
      chunks: (pages.length ? pages : [text]).slice(0, 30).map((p, i) => ({ page: i + 1, text: p.slice(0, 3000) }))
    };
  } catch (err) {
    return { fileType: "pdf", parseStatus: "error", error: `PDF 解析失败：${err.message}` };
  }
}

async function parseDocx(buf, fileName) {
  const mammoth = await _getMammoth();
  if (!mammoth) return { error: "DOCX 解析库未安装，请联系管理员安装 mammoth" };

  try {
    const result = await mammoth.extractRawText({ buffer: buf });
    const text = (result.value || "").trim();
    const warnings = [...(result.messages || [])].map(m => m.message);

    if (!text) {
      return {
        fileType: "docx",
        parseStatus: "empty",
        text: "",
        metadata: { hasText: false },
        warnings: ["DOCX 文件中未提取到文本内容"]
      };
    }

    return {
      fileType: "docx",
      parseStatus: "ok",
      text: textTruncate(text),
      metadata: { textLength: text.length },
      warnings: warnings.length ? warnings : undefined
    };
  } catch (err) {
    return { fileType: "docx", parseStatus: "error", error: `DOCX 解析失败：${err.message}` };
  }
}

async function parsePptx(buf, fileName) {
  const AdmZip = await _getAdmZip();
  if (!AdmZip) return { error: "PPTX 解析库未安装，请联系管理员安装 adm-zip" };

  try {
    const zip = new AdmZip(buf);
    const entries = zip.getEntries();
    const slides = [];

    for (const entry of entries) {
      const en = entry.entryName;
      // pptx slides are at ppt/slides/slideN.xml
      const m = en.match(/^ppt\/slides\/slide(\d+)\.xml$/i);
      if (m && !entry.isDirectory) {
        const xml = entry.getData().toString("utf8");
        // extract text from <a:t> tags
        const texts = [];
        const re = /<a:t[^>]*>([^<]*)<\/a:t>/g;
        let match;
        while ((match = re.exec(xml)) !== null) {
          if (match[1]) texts.push(match[1]);
        }
        if (texts.length) {
          slides.push({ slide: parseInt(m[1]), text: texts.join(" ").replace(/\s+/g, " ").trim() });
        }
      }
    }

    slides.sort((a, b) => a.slide - b.slide);
    const fullText = slides.map(s => `[幻灯片 ${s.slide}]\n${s.text}`).join("\n\n");

    if (!fullText) {
      return {
        fileType: "pptx",
        parseStatus: "empty",
        text: "",
        metadata: { slides: slides.length, hasText: false },
        warnings: ["PPTX 文件中未提取到文本内容"]
      };
    }

    return {
      fileType: "pptx",
      parseStatus: "ok",
      text: textTruncate(fullText),
      metadata: { slides: slides.length, textLength: fullText.length },
      chunks: slides.slice(0, 40).map(s => ({ slide: s.slide, text: s.text.slice(0, 2000) }))
    };
  } catch (err) {
    return { fileType: "pptx", parseStatus: "error", error: `PPTX 解析失败：${err.message}` };
  }
}

async function parseXlsx(buf, fileName) {
  const XLSX = await _getXlsx();
  if (!XLSX) return { error: "Excel 解析库未安装，请联系管理员安装 xlsx" };

  try {
    const workbook = XLSX.read(buf, { type: "buffer" });
    const sheets = [];
    let totalRows = 0;

    for (const name of workbook.SheetNames) {
      const sheet = workbook.Sheets[name];
      const json = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      const rows = json.length;
      const cols = json.length > 0 ? json[0].length : 0;
      totalRows += rows;

      // extract first 100 rows as sample
      const sample = json.slice(0, 100).map(row =>
        row.map(cell => String(cell || "").slice(0, 200)).join("\t")
      ).join("\n");

      // extract headers
      const headers = json.length > 0
        ? json[0].map(c => String(c || "").trim()).filter(Boolean)
        : [];

      sheets.push({
        name,
        rows,
        cols,
        headers: headers.slice(0, 50),
        sample: sample.slice(0, 5000)
      });
    }

    const summary = sheets.map(s => {
      return `工作表「${s.name}」：${s.rows} 行 × ${s.cols} 列` +
        (s.headers.length ? ` | 列名：${s.headers.join("、")}` : "");
    }).join("\n");

    const allText = sheets.map(s => {
      return `=== 工作表：${s.name} ===\n列名：${s.headers.join("、")}\n行数：${s.rows}\n\n前若干行数据：\n${s.sample}`;
    }).join("\n\n");

    return {
      fileType: "xlsx",
      parseStatus: "ok",
      text: textTruncate(allText, MAX_TEXT_OUTPUT),
      metadata: {
        sheets: sheets.length,
        sheetNames: workbook.SheetNames,
        totalRows,
        summary
      },
      chunks: sheets.map(s => ({
        sheet: s.name,
        rows: s.rows,
        cols: s.cols,
        headers: s.headers,
        sample: s.sample
      }))
    };
  } catch (err) {
    return { fileType: "xlsx", parseStatus: "error", error: `Excel 解析失败：${err.message}` };
  }
}

async function parseCsv(buf, fileName) {
  try {
    const text = safeText(buf).replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = text.split("\n").filter(l => l.trim());
    const headers = lines[0] ? lines[0].split(",").map(h => h.trim()) : [];
    const rows = lines.length - 1;

    return {
      fileType: "csv",
      parseStatus: "ok",
      text: textTruncate(text),
      metadata: {
        headers: headers.slice(0, 30),
        rows,
        cols: headers.length,
        summary: `CSV 文件：${rows} 行 × ${headers.length} 列 | 列名：${headers.join("、")}`
      },
      chunks: [{
        headers: headers.slice(0, 30),
        sample: lines.slice(0, 50).join("\n")
      }]
    };
  } catch (err) {
    return { fileType: "csv", parseStatus: "error", error: `CSV 解析失败：${err.message}` };
  }
}

async function parseZip(buf, fileName, depth = 0) {
  if (depth >= MAX_ZIP_DEPTH) return { error: "压缩包嵌套层级过深" };

  const AdmZip = await _getAdmZip();
  if (!AdmZip) return { error: "ZIP 解析库未安装，请联系管理员安装 adm-zip" };

  let zip;
  try {
    zip = new AdmZip(buf);
  } catch (err) {
    return { fileType: "zip", parseStatus: "error", error: `ZIP 文件损坏或无法打开：${err.message}` };
  }

  const entries = zip.getEntries();
  if (entries.length > MAX_ZIP_FILES) {
    return { error: `压缩包内文件过多（${entries.length}），最多支持 ${MAX_ZIP_FILES} 个文件` };
  }

  let totalSize = 0;
  const fileTree = [];
  const parsedFiles = [];

  for (const entry of entries) {
    if (entry.isDirectory) continue;
    const eSize = entry.getData().length;
    totalSize += eSize;
    if (totalSize > MAX_ZIP_TOTAL_SIZE) {
      fileTree.push({ name: entry.entryName, size: eSize, skipped: true, reason: "超出解压总大小限制" });
      continue;
    }

    const ebuf = entry.getData();
    const en = entry.entryName.split("/").pop() || entry.entryName;

    fileTree.push({ name: entry.entryName, size: eSize });

    // Parse inner files
    const innerExt = ext(en);
    try {
      let innerResult = null;
      if (["txt", "md", "json", "csv", "log", "xml", "html", "css", "js", "ts", "py", "java", "cpp", "c", "h", "go", "rs", "sh", "yaml", "yml", "toml", "ini", "conf", "env", "sql"].includes(innerExt)) {
        innerResult = {
          fileType: "text",
          parseStatus: "ok",
          text: textTruncate(safeText(ebuf), 10000)
        };
      } else if (innerExt === "pdf") {
        innerResult = await parsePdf(ebuf, en);
      } else if (innerExt === "docx") {
        innerResult = await parseDocx(ebuf, en);
      } else if (innerExt === "xlsx" || innerExt === "xls") {
        innerResult = await parseXlsx(ebuf, en);
      } else if (innerExt === "csv") {
        innerResult = await parseCsv(ebuf, en);
      } else if (innerExt === "zip") {
        innerResult = await parseZip(ebuf, en, depth + 1);
      }

      if (innerResult && innerResult.parseStatus === "ok") {
        parsedFiles.push({ fileName: en, ...innerResult });
      }
    } catch { /* skip individual file errors */ }
  }

  const treeText = fileTree.map(f => {
    const sizeKB = (f.size / 1024).toFixed(1);
    return `  ${f.name} (${sizeKB} KB)${f.skipped ? " [已跳过]" : ""}`;
  }).join("\n");

  const summary = `压缩包「${fileName}」包含 ${fileTree.length} 个文件：\n${treeText}` +
    (parsedFiles.length ? `\n\n已解析 ${parsedFiles.length} 个可读文件的内容` : "");

  const allContent = parsedFiles.map(f => {
    return `--- ${f.fileName} ---\n${f.text || ""}`;
  }).join("\n\n");

  return {
    fileType: "zip",
    parseStatus: "ok",
    text: textTruncate(summary + "\n\n" + allContent),
    metadata: {
      fileCount: fileTree.length,
      parsedCount: parsedFiles.length,
      totalSize,
      tree: fileTree
    },
    chunks: parsedFiles.map(f => ({
      fileName: f.fileName,
      fileType: f.fileType,
      text: (f.text || "").slice(0, 4000)
    }))
  };
}

async function parseTextFile(buf, fileName) {
  const e = ext(fileName);
  const text = safeText(buf);

  if (!text.trim()) {
    return {
      fileType: "text",
      parseStatus: "empty",
      text: "",
      metadata: { extension: e, hasText: false },
      warnings: ["文件中未检测到文本内容"]
    };
  }

  const lines = text.split("\n");
  const langMap = {
    js: "JavaScript", ts: "TypeScript", jsx: "React JSX", tsx: "React TSX",
    py: "Python", java: "Java", cpp: "C++", c: "C", h: "C Header",
    go: "Go", rs: "Rust", php: "PHP", rb: "Ruby", sh: "Shell",
    sql: "SQL", html: "HTML", css: "CSS", json: "JSON", xml: "XML",
    yaml: "YAML", yml: "YAML", toml: "TOML", md: "Markdown", csv: "CSV"
  };

  return {
    fileType: "text",
    parseStatus: "ok",
    text: textTruncate(text),
    metadata: {
      extension: e,
      language: langMap[e] || "纯文本",
      lines: lines.length,
      size: buf.length,
      isCode: ["js","ts","jsx","tsx","py","java","cpp","c","h","go","rs","php","rb","sh","sql"].includes(e)
    }
  };
}

// ---- main parse entry ----

/**
 * Parse any uploaded file and return unified result.
 * @param {Buffer} buf - file buffer
 * @param {string} fileName - original filename
 * @param {string} [mimeType] - MIME type hint
 * @returns {Promise<Object>} unified parse result
 */
export async function parseUploadedFile(buf, fileName, mimeType = "") {
  if (!Buffer.isBuffer(buf) || buf.length === 0) {
    return { fileName: fileName || "unknown", parseStatus: "error", error: "文件为空或损坏" };
  }
  if (buf.length > MAX_FILE_SIZE) {
    return { fileName, parseStatus: "error", error: `文件过大（${(buf.length/1024/1024).toFixed(1)}MB），最大支持 ${MAX_FILE_SIZE/1024/1024}MB` };
  }

  const e = ext(fileName);
  const detectedMime = detectMime(buf, fileName);
  const effectiveMime = mimeType || detectedMime;

  let result = { fileName, mimeType: effectiveMime, fileType: e, size: buf.length };

  try {
    // PDF
    if (effectiveMime === "application/pdf" || e === "pdf") {
      result = { ...result, ...(await parsePdf(buf, fileName)) };
    }
    // DOCX
    else if (effectiveMime.includes("wordprocessingml") || e === "docx") {
      result = { ...result, ...(await parseDocx(buf, fileName)) };
    }
    // XLSX
    else if (effectiveMime.includes("spreadsheetml") || e === "xlsx" || e === "xls") {
      if (e === "xls") {
        result = { ...result, parseStatus: "error", error: "旧版 .xls 格式暂不支持，请转换为 .xlsx 后上传" };
      } else {
        result = { ...result, ...(await parseXlsx(buf, fileName)) };
      }
    }
    // PPTX
    else if (effectiveMime.includes("presentationml") || e === "pptx") {
      result = { ...result, ...(await parsePptx(buf, fileName)) };
    }
    // ZIP
    else if (effectiveMime === "application/zip" || e === "zip") {
      result = { ...result, ...(await parseZip(buf, fileName)) };
    }
    // CSV (explicit)
    else if (e === "csv" || e === "tsv") {
      result = { ...result, ...(await parseCsv(buf, fileName)) };
    }
    // Images
    else if (/^image\//.test(effectiveMime) || ["png","jpg","jpeg","webp","gif","bmp"].includes(e)) {
      result = {
        ...result,
        fileType: "image",
        parseStatus: "not_supported",
        text: "",
        metadata: { type: effectiveMime },
        warnings: ["图片文件需要视觉模型或 OCR 才能识别内容，当前系统暂不支持自动图片识别"]
      };
    }
    // Audio/Video
    else if (/^(audio|video)\//.test(effectiveMime) || ["mp3","wav","ogg","mp4","avi","mov","mkv"].includes(e)) {
      result = {
        ...result,
        fileType: "media",
        parseStatus: "not_supported",
        text: "",
        metadata: { type: effectiveMime },
        warnings: ["音视频文件暂不支持解析，需要语音转文字服务"]
      };
    }
    // Old Office formats
    else if (e === "doc") {
      result = { ...result, parseStatus: "error", error: "旧版 .doc 格式暂不支持，请转换为 .docx 后上传" };
    } else if (e === "ppt") {
      result = { ...result, parseStatus: "error", error: "旧版 .ppt 格式暂不支持，请转换为 .pptx 后上传" };
    }
    // RAR/7Z
    else if (e === "rar" || e === "7z") {
      result = { ...result, parseStatus: "error", error: `${e.toUpperCase()} 格式暂不支持，请使用 ZIP 格式压缩后上传` };
    }
    // Text / code / config files
    else {
      const textExts = ["txt","md","markdown","log","ini","conf","env","yaml","yml","toml",
        "xml","html","htm","css","js","ts","tsx","jsx","json","sql",
        "py","java","cpp","c","h","go","rs","php","rb","sh","bat","ps1",
        "r","m","swift","kt","scala","lua","pl","cfg","dockerfile","gitignore","makefile"];
      if (textExts.includes(e) || effectiveMime.startsWith("text/")) {
        result = { ...result, ...(await parseTextFile(buf, fileName)) };
      } else {
        result = {
          ...result,
          parseStatus: "not_supported",
          text: "",
          metadata: { extension: e },
          warnings: [`暂不支持解析 .${e} 文件类型`]
        };
      }
    }
  } catch (err) {
    console.error(`[fileParser] ${fileName} parse error:`, err.message);
    result = { ...result, parseStatus: "error", error: `文件解析异常：${err.message}` };
  }

  // Attach fileType if not set
  if (!result.fileType) result.fileType = e;
  if (!result.parseStatus) result.parseStatus = "ok";

  return result;
}

/**
 * Build context string from parsed files for injection into chat messages.
 */
export function buildFileContext(parsedFiles, strategy = "standard") {
  if (!parsedFiles || !parsedFiles.length) return "";

  const parts = [];
  const successFiles = parsedFiles.filter(f => f.parseStatus === "ok");
  const failedFiles = parsedFiles.filter(f => f.parseStatus !== "ok");

  // File overview
  parts.push(`[用户上传了 ${parsedFiles.length} 个文件]`);

  // Failed files
  if (failedFiles.length) {
    const failList = failedFiles.map(f => {
      const reason = f.error || (f.warnings && f.warnings[0]) || "未知原因";
      return `- ${f.fileName}：${reason}`;
    }).join("\n");
    parts.push(`以下文件未能解析：\n${failList}`);
  }

  // Successfully parsed files
  for (const f of successFiles) {
    const meta = f.metadata || {};

    let header = `--- 文件：${f.fileName} ---`;
    if (f.fileType === "pdf") {
      header = `--- PDF：${f.fileName}（${meta.pages || "?"} 页，${meta.textLength || 0} 字符）---`;
    } else if (f.fileType === "docx") {
      header = `--- Word 文档：${f.fileName}（${meta.textLength || 0} 字符）---`;
    } else if (f.fileType === "xlsx") {
      header = `--- Excel 表格：${f.fileName}（${meta.summary || ""}）---`;
    } else if (f.fileType === "pptx") {
      header = `--- PPT 演示：${f.fileName}（${meta.slides || 0} 张幻灯片）---`;
    } else if (f.fileType === "csv") {
      header = `--- CSV 表格：${f.fileName}（${meta.summary || ""}）---`;
    } else if (f.fileType === "zip") {
      header = `--- 压缩包：${f.fileName}（${meta.fileCount || 0} 个文件）---`;
    } else if (meta.language) {
      header = `--- ${meta.language} 代码：${f.fileName}（${meta.lines || 0} 行）---`;
    }

    parts.push(header);

    // Content injection based on strategy
    if (strategy === "minimal") {
      // Just metadata + first 500 chars
      parts.push((f.text || "").slice(0, 500));
    } else if (strategy === "extreme") {
      // Full content (already truncated by parser)
      parts.push(f.text || "");
    } else {
      // standard: metadata + full content (parser already truncated)
      parts.push(f.text || "");
    }
  }

  return parts.join("\n\n");
}

export default { parseUploadedFile, buildFileContext };
