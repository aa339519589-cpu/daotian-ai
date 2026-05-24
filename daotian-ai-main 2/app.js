const STORAGE_KEY = "daotianAiState";

const state = {
  token: localStorage.getItem("relayAdminToken") || "",
  config: { chatModel: "deepseek-chat", apiKeys: [], upstreams: [], logs: [] },
  chatModel: "deepseek-chat",
  conversations: [],
  activeConversationId: "",
  sidebarOpen: window.matchMedia("(min-width: 769px)").matches,
  apiKeyVisible: new Set(),
  isSending: false,
  webSearchEnabled: false,
  webSearchConfigured: false
};

let activeAbortController = null;
let pendingStreamBuffer = "";
let typewriterTimer = null;
let activeAssistantMessageId = "";
let streamFinished = false;
let drainResolve = null;
let lastAutoScrollAt = 0;

function makeId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const $ = (id) => document.getElementById(id);

function adminHeaders() {
  return {
    "content-type": "application/json",
    "x-admin-token": state.token
  };
}

async function requestJson(path, options = {}, useAdmin = false) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(useAdmin ? adminHeaders() : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || "请求失败");
  }
  return data;
}

function saveLocalState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      chatModel: state.chatModel,
      conversations: state.conversations,
      activeConversationId: state.activeConversationId,
      sidebarOpen: state.sidebarOpen,
      webSearchEnabled: state.webSearchEnabled
    })
  );
}

function loadLocalState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved.chatModel) state.chatModel = saved.chatModel;
    if (Array.isArray(saved.conversations)) state.conversations = saved.conversations;
    if (saved.activeConversationId) state.activeConversationId = saved.activeConversationId;
    if (typeof saved.sidebarOpen === "boolean" && window.matchMedia("(min-width: 769px)").matches) {
      state.sidebarOpen = saved.sidebarOpen;
    }
    if (typeof saved.webSearchEnabled === "boolean") state.webSearchEnabled = saved.webSearchEnabled;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }

  if (state.conversations.length === 0) {
    createConversation(false);
  } else if (!activeConversation()) {
    state.activeConversationId = state.conversations[0].id;
  }
}

function createConversation(shouldRender = true) {
  const conversation = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    title: "新对话",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  state.conversations.unshift(conversation);
  state.activeConversationId = conversation.id;
  saveLocalState();
  if (shouldRender) render();
}

function activeConversation() {
  return state.conversations.find((item) => item.id === state.activeConversationId);
}

async function loadPublicConfig() {
  try {
    const data = await requestJson("/public/config");
    if (data.chatModel) {
      state.chatModel = data.chatModel;
      state.config.chatModel = data.chatModel;
      $("chatModel").value = data.chatModel;
    }
    state.webSearchConfigured = Boolean(data.webSearchConfigured);
    updateWebSearchButton();
  } catch {
    $("chatModel").value = state.chatModel;
  }
}

async function refreshAdminConfig() {
  state.config = await requestJson("/admin/config", {}, true);
  state.chatModel = state.config.chatModel || state.chatModel;
  $("chatModel").value = state.chatModel;
  $("connectionState").textContent = "已连接";
  $("connectionState").classList.add("ok");
  renderAdminPanel();
  saveLocalState();
}

function render() {
  renderShell();
  renderHistory();
  renderChat();
  renderAdminPanel();
}

function renderShell() {
  $("appShell").classList.toggle("sidebar-open", state.sidebarOpen);
  $("appShell").classList.toggle("sidebar-closed", !state.sidebarOpen);
  $("sidebar").classList.toggle("open", state.sidebarOpen);
  const mobile = window.matchMedia("(max-width: 768px)").matches;
  $("sidebarBackdrop").classList.toggle("hidden", !(mobile && state.sidebarOpen));
  const conversation = activeConversation();
  $("conversationTitle").textContent = conversation?.title || "新对话";
  $("providerLabel").textContent = "模型提供方";
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = state.conversations
    .map((conversation) => {
      const active = conversation.id === state.activeConversationId ? "active" : "";
      const time = conversation.updatedAt ? formatShortTime(conversation.updatedAt) : "";
      return `
        <button class="history-item ${active}" type="button" data-conversation="${conversation.id}">
          <span class="history-dot"></span>
          <span class="history-title">${escapeHtml(conversation.title)}</span>
          <time>${escapeHtml(time)}</time>
        </button>
      `;
    })
    .join("");
}

function ensureMessageIds(messages) {
  for (const message of messages) {
    if (!message.id) message.id = makeId();
  }
}

function renderChat() {
  const conversation = activeConversation();
  const messages = conversation?.messages || [];
  ensureMessageIds(messages);
  const box = $("chatMessages");

  if (messages.length === 0) {
    box.innerHTML = `
      <div class="welcome">
        <div class="welcome-mark" aria-hidden="true"><span></span><span></span><span></span></div>
        <h2>稻田 Ai</h2>
        <p>把模型和接口藏在身后，只留下安静的对话。</p>
      </div>
    `;
  } else {
    box.innerHTML = messages
      .map((message) => {
        const roleLabel = message.role === "user" ? "你" : message.role === "assistant" ? "稻田 Ai" : "系统";
        const pending = message.pending ? " pending" : "";
        const streaming = message.streaming ? " streaming" : "";
        let body = "";
        if (message.role === "assistant") {
          if (!message.content && message.pending) body = `<span class="typing-dots"><i></i><i></i><i></i></span>`;
          else if (message.streaming) body = escapeHtml(message.content || "").replace(/\n/g, "<br>");
          else body = renderMarkdown(message.content || "");
        } else {
          body = escapeHtml(message.content || "").replace(/\n/g, "<br>");
        }
        const sources = message.role === "assistant" ? renderSources(message.sources || []) : "";
        return `
          <article class="message ${message.role}${pending}${streaming}" data-message-id="${escapeAttr(message.id)}">
            <div class="message-meta">${roleLabel}</div>
            <div class="message-content assistant-message">${body}</div>
            ${sources}
          </article>
        `;
      })
      .join("");
  }

  updateSendButton();
  queueAutoScroll(true);
}


function renderAdminPanel() {
  $("chatModel").value = state.chatModel || "";
  renderUpstreams();
  renderKeys();
  renderLogs();
}

function renderUpstreams() {
  const upstreams = state.config.upstreams || [];
  $("upstreams").innerHTML =
    upstreams.length === 0
      ? `<div class="empty-card">输入后台口令并连接后，可以在这里添加模型提供方。</div>`
      : upstreams
          .map((upstream) => {
            const keyVisible = state.apiKeyVisible.has(upstream.id);
            return `
              <section class="provider-card" data-provider-card="${upstream.id}">
                <div class="provider-card-head">
                  <div>
                    <h4>${escapeHtml(upstream.name || "未命名提供方")}</h4>
                    <p>${escapeHtml(upstream.baseUrl || "未配置 API 地址")}</p>
                  </div>
                  <label class="switch">
                    <input type="checkbox" ${upstream.enabled ? "checked" : ""} data-upstream-field="${upstream.id}:enabled" />
                    <span>启用</span>
                  </label>
                </div>
                <div class="form-grid">
                  <label>
                    <span>提供方名称</span>
                    <input value="${escapeAttr(upstream.name || "")}" data-upstream-field="${upstream.id}:name" />
                  </label>
                  <label>
                    <span>API 地址 / Base URL</span>
                    <input value="${escapeAttr(upstream.baseUrl || "")}" placeholder="https://api.example.com" data-upstream-field="${upstream.id}:baseUrl" />
                  </label>
                  <label class="span-2">
                    <span>API Key</span>
                    <div class="secret-input">
                      <input type="${keyVisible ? "text" : "password"}" value="${escapeAttr(upstream.apiKey || "")}" placeholder="sk-..." data-upstream-field="${upstream.id}:apiKey" />
                      <button type="button" class="ghost-button" data-key-visibility="${upstream.id}">${keyVisible ? "隐藏" : "显示"}</button>
                    </div>
                  </label>
                  <label>
                    <span>请求路径（可选）</span>
                    <input value="${escapeAttr(upstream.requestPath || "/v1/chat/completions")}" data-upstream-field="${upstream.id}:requestPath" />
                  </label>
                  <label>
                    <span>模型匹配规则</span>
                    <input value="${escapeAttr((upstream.modelPrefixes || []).join(","))}" placeholder="gpt-,deepseek-,qwen-,*" data-upstream-field="${upstream.id}:modelPrefixes" />
                  </label>
                </div>
                <div class="card-actions">
                  <button type="button" class="soft-button" data-upstream-save="${upstream.id}">保存配置</button>
                </div>
              </section>
            `;
          })
          .join("");
}

function renderKeys() {
  const keys = state.config.apiKeys || [];
  $("keys").innerHTML =
    keys.length === 0
      ? `<div class="empty-card small">还没有 Relay Key。</div>`
      : keys
          .map(
            (key) => `
              <div class="mini-row">
                <div>
                  <strong>${escapeHtml(key.name)}</strong>
                  <small>${escapeHtml(key.prefix)} · ${new Date(key.createdAt).toLocaleString()}</small>
                </div>
                <button class="soft-button" type="button" data-key-toggle="${key.id}">${key.enabled ? "停用" : "启用"}</button>
              </div>
            `
          )
          .join("");
}

function renderLogs() {
  const logs = state.config.logs || [];
  $("logs").innerHTML =
    logs.length === 0
      ? `<tr><td colspan="5">暂无调用记录</td></tr>`
      : logs
          .slice(0, 30)
          .map(
            (log) => `
              <tr>
                <td>${new Date(log.createdAt).toLocaleString()}</td>
                <td>${escapeHtml(log.apiKeyName || "-")}</td>
                <td>${escapeHtml(log.model || "-")}</td>
                <td>${log.status}</td>
                <td>${log.latencyMs} ms</td>
              </tr>
            `
          )
          .join("");
}

function openProviderModal() {
  $("providerModal").classList.remove("hidden");
  $("adminToken").value = state.token;
  $("chatModel").value = state.chatModel;
  if (state.token) refreshAdminConfig().catch(() => showToast("后台口令无效或服务未连接"));
}

function closeProviderModal() {
  $("providerModal").classList.add("hidden");
}

function updateStreamingMessageDom(message, final = false) {
  if (!message?.id) return;
  const article = document.querySelector(`[data-message-id="${CSS.escape(message.id)}"]`);
  if (!article) {
    renderChat();
    return;
  }
  const content = article.querySelector(".message-content");
  if (!content) return;

  // Streaming 时只更新文本节点，不反复重建整段 HTML，避免 Safari 抽搐/发白。
  if (final) {
    content.innerHTML = renderMarkdown(message.content || "");
  } else if (message.pending && !message.content) {
    content.innerHTML = `<span class="typing-dots"><i></i><i></i><i></i></span>`;
  } else {
    content.textContent = message.content || "";
  }

  article.classList.toggle("pending", Boolean(message.pending));
  article.classList.toggle("streaming", Boolean(message.streaming));
}

function queueAutoScroll(force = false) {
  const now = Date.now();
  if (!force && now - lastAutoScrollAt < 140) return;
  lastAutoScrollAt = now;
  requestAnimationFrame(() => {
    const box = $("chatMessages");
    if (!box) return;
    const distanceFromBottom = box.scrollHeight - box.scrollTop - box.clientHeight;
    if (force || distanceFromBottom < 260) box.scrollTop = box.scrollHeight;
  });
}

function takeTypewriterSlice(text) {
  if (!text) return "";
  const first = text[0];
  const isAscii = /^[\x00-\x7F]$/.test(first);
  const size = isAscii ? 4 : 2;
  return text.slice(0, Math.min(size, text.length));
}

function startTypewriter(messageId) {
  if (typewriterTimer) return;
  typewriterTimer = setInterval(() => {
    const conversation = activeConversation();
    const message = conversation?.messages.find((item) => item.id === messageId);
    if (!message) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      return;
    }

    if (!pendingStreamBuffer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
      if (streamFinished && drainResolve) {
        const resolve = drainResolve;
        drainResolve = null;
        resolve();
      }
      return;
    }

    const next = takeTypewriterSlice(pendingStreamBuffer);
    pendingStreamBuffer = pendingStreamBuffer.slice(next.length);
    message.content = `${message.content || ""}${next}`;
    message.pending = false;
    updateStreamingMessageDom(message, false);
    queueAutoScroll(false);
  }, 28);
}

function waitForTypewriterDrain() {
  if (!pendingStreamBuffer && !typewriterTimer) return Promise.resolve();
  return new Promise((resolve) => {
    drainResolve = resolve;
  });
}

function stopGeneration() {
  if (!state.isSending) return;
  try {
    activeAbortController?.abort();
  } catch {}
  activeAbortController = null;
  pendingStreamBuffer = "";
  streamFinished = true;
  if (typewriterTimer) {
    clearInterval(typewriterTimer);
    typewriterTimer = null;
  }
  if (drainResolve) {
    const resolve = drainResolve;
    drainResolve = null;
    resolve();
  }

  const conversation = activeConversation();
  const message = conversation?.messages.find((item) => item.id === activeAssistantMessageId);
  if (message) {
    message.pending = false;
    message.streaming = false;
    if (message.content) message.content = `${message.content}\n\n已停止生成`;
    else message.content = "已停止生成";
  }
  state.isSending = false;
  activeAssistantMessageId = "";
  saveLocalState();
  renderChat();
}

function parseSseBlock(block) {
  let event = "message";
  const dataLines = [];
  for (const line of block.split(/\r?\n/)) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return null;
  let data = dataLines.join("\n");
  try { data = JSON.parse(data); } catch {}
  return { event, data };
}

async function sendChat() {
  if (state.isSending) {
    stopGeneration();
    return;
  }

  const input = $("chatInput");
  const text = input.value.trim();
  if (!text) return;

  const conversation = activeConversation();
  const userMessage = { id: makeId(), role: "user", content: text };
  const assistantMessage = { id: makeId(), role: "assistant", content: "", pending: true, streaming: true, sources: [] };
  conversation.messages.push(userMessage, assistantMessage);
  conversation.updatedAt = new Date().toISOString();
  if (conversation.title === "新对话") conversation.title = text.slice(0, 18);

  input.value = "";
  autoResizeTextarea(input);
  state.isSending = true;
  activeAssistantMessageId = assistantMessage.id;
  pendingStreamBuffer = "";
  streamFinished = false;
  saveLocalState();
  render();

  const messages = conversation.messages
    .filter((message) => !message.pending && !message.streaming && ["user", "assistant"].includes(message.role))
    .map(({ role, content }) => ({ role, content }));
  messages.push({ role: "user", content: text });

  activeAbortController = new AbortController();

  try {
    const response = await fetch("/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: activeAbortController.signal,
      body: JSON.stringify({ model: state.chatModel, messages, webSearch: state.webSearchEnabled, stream: true })
    });

    if (!response.ok || !response.body) {
      let errorMessage = "请求失败";
      try {
        const data = await response.json();
        errorMessage = data.message || data.error || errorMessage;
      } catch {}
      throw new Error(errorMessage);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      sseBuffer += decoder.decode(value, { stream: true });
      const blocks = sseBuffer.split(/\n\n/);
      sseBuffer = blocks.pop() || "";

      for (const block of blocks) {
        const parsed = parseSseBlock(block);
        if (!parsed) continue;
        if (parsed.event === "sources") {
          assistantMessage.sources = Array.isArray(parsed.data.sources) ? parsed.data.sources : [];
        } else if (parsed.event === "content") {
          const chunk = parsed.data?.content || "";
          if (chunk) {
            assistantMessage.content = `${assistantMessage.content || ""}${chunk}`;
            assistantMessage.pending = false;
            updateStreamingMessageDom(assistantMessage, false);
            queueAutoScroll(false);
          }
        } else if (parsed.event === "error") {
          throw new Error(parsed.data?.message || "发送失败");
        }
      }
    }

    streamFinished = true;
    assistantMessage.pending = false;
    assistantMessage.streaming = false;
    if (!assistantMessage.content) assistantMessage.content = "模型返回了空内容";
    conversation.updatedAt = new Date().toISOString();
    updateStreamingMessageDom(assistantMessage, true);
    if (state.token) refreshAdminConfig().catch(() => {});
  } catch (error) {
    if (error?.name !== "AbortError") {
      assistantMessage.role = "system";
      assistantMessage.content = `发送失败：${error.message}`;
      assistantMessage.pending = false;
      assistantMessage.streaming = false;
      updateStreamingMessageDom(assistantMessage, false);
    }
  } finally {
    activeAbortController = null;
    pendingStreamBuffer = "";
    streamFinished = true;
    if (typewriterTimer) {
      clearInterval(typewriterTimer);
      typewriterTimer = null;
    }
    state.isSending = false;
    activeAssistantMessageId = "";
    saveLocalState();
    updateSendButton();
    renderHistory();
  }
}


function updateSendButton() {
  const button = $("sendChat");
  const input = $("chatInput");
  if (!button || !input) return;
  if (state.isSending) {
    button.disabled = false;
    button.textContent = "停";
    button.classList.add("stop-mode");
    button.setAttribute("aria-label", "停止生成");
  } else {
    button.disabled = !input.value.trim();
    button.textContent = "➤";
    button.classList.remove("stop-mode");
    button.setAttribute("aria-label", "发送消息");
  }
}

function autoResizeTextarea(textarea) {
  textarea.style.height = "auto";
  textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  updateSendButton();
}



function updateWebSearchButton() {
  const button = $("webSearchToggle");
  if (!button) return;
  button.classList.toggle("active", state.webSearchEnabled);
  button.setAttribute("aria-pressed", String(state.webSearchEnabled));
  const dot = state.webSearchEnabled ? "●" : "○";
  button.innerHTML = `<span>${dot}</span> 联网搜索`;
  button.title = state.webSearchConfigured
    ? "本轮消息可使用联网搜索"
    : "需要在 Render 环境变量里添加 TAVILY_API_KEY";
}

function renderSources(sources = []) {
  const items = sources
    .filter((source) => source && source.url)
    .slice(0, 5)
    .map((source) => `<a href="${escapeAttr(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.title || source.url)}</a>`)
    .join("");
  if (!items) return "";
  return `<div class="message-sources"><strong>来源</strong>${items}</div>`;
}

function showToast(message) {
  const toast = $("providerToast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2400);
}

function formatShortTime(value) {
  const date = new Date(value);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "2-digit", day: "2-digit" });
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function escapeAttr(value = "") {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function renderMarkdown(markdown = "") {
  const parts = [];
  const pattern = /```(\w+)?\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(markdown))) {
    if (match.index > lastIndex) parts.push(renderMarkdownBlocks(markdown.slice(lastIndex, match.index)));
    parts.push(`<pre><code>${escapeHtml(match[2].trim())}</code></pre>`);
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < markdown.length) parts.push(renderMarkdownBlocks(markdown.slice(lastIndex)));
  return parts.join("");
}

function renderMarkdownBlocks(source) {
  return source
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${formatInline(line.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${formatInline(line.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
      }
      if (lines.every((line) => /^\s*>\s?/.test(line))) {
        return `<blockquote>${lines.map((line) => formatInline(line.replace(/^\s*>\s?/, ""))).join("<br>")}</blockquote>`;
      }
      if (/^###\s+/.test(block)) return `<h3>${formatInline(block.replace(/^###\s+/, ""))}</h3>`;
      if (/^##\s+/.test(block)) return `<h2>${formatInline(block.replace(/^##\s+/, ""))}</h2>`;
      if (/^#\s+/.test(block)) return `<h1>${formatInline(block.replace(/^#\s+/, ""))}</h1>`;
      return `<p>${formatInline(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}

function formatInline(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>');
}

$("sidebarToggle").addEventListener("click", () => {
  state.sidebarOpen = !state.sidebarOpen;
  saveLocalState();
  renderShell();
});

$("sidebarClose").addEventListener("click", () => {
  state.sidebarOpen = false;
  saveLocalState();
  renderShell();
});

$("sidebarBackdrop").addEventListener("click", () => {
  state.sidebarOpen = false;
  renderShell();
});

$("newChat").addEventListener("click", () => {
  createConversation();
  if (window.matchMedia("(max-width: 768px)").matches) state.sidebarOpen = false;
  render();
});

$("openProvider").addEventListener("click", openProviderModal);
$("openProviderSide").addEventListener("click", openProviderModal);
$("closeProvider").addEventListener("click", closeProviderModal);
$("providerModal").addEventListener("click", (event) => {
  if (event.target.id === "providerModal") closeProviderModal();
});

$("themeToggle").addEventListener("click", () => showToast("主题已保持为稻田暖色"));

$("webSearchToggle").addEventListener("click", () => {
  state.webSearchEnabled = !state.webSearchEnabled;
  saveLocalState();
  updateWebSearchButton();
  if (state.webSearchEnabled && !state.webSearchConfigured) {
    showToast("联网搜索未配置，请先在 Render 添加 TAVILY_API_KEY");
  }
});

$("composerForm").addEventListener("submit", (event) => {
  event.preventDefault();
  sendChat();
});

$("chatInput").addEventListener("input", (event) => autoResizeTextarea(event.target));
$("chatInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    if (!state.isSending) sendChat();
  }
});

$("saveToken").addEventListener("click", async () => {
  state.token = $("adminToken").value.trim();
  localStorage.setItem("relayAdminToken", state.token);
  try {
    await refreshAdminConfig();
    showToast("后台已连接");
  } catch (error) {
    $("connectionState").textContent = "连接失败";
    $("connectionState").classList.remove("ok");
    showToast(error.message);
  }
});

$("saveChatSettings").addEventListener("click", async () => {
  const model = $("chatModel").value.trim();
  if (!model) {
    showToast("请填写默认聊天模型");
    return;
  }
  state.chatModel = model;
  try {
    state.config = await requestJson(
      "/admin/chat-settings",
      { method: "PATCH", body: JSON.stringify({ chatModel: model }) },
      true
    );
    state.chatModel = state.config.chatModel || model;
    showToast("默认模型已保存");
    saveLocalState();
  } catch (error) {
    showToast(error.message);
  }
});

$("createUpstream").addEventListener("click", async () => {
  try {
    state.config = await requestJson(
      "/admin/upstreams",
      {
        method: "POST",
        body: JSON.stringify({
          name: "新的提供方",
          baseUrl: "",
          apiKey: "",
          enabled: false,
          modelPrefixes: ["*"],
          requestPath: "/v1/chat/completions"
        })
      },
      true
    );
    showToast("已添加提供方");
    renderAdminPanel();
  } catch (error) {
    showToast(error.message);
  }
});

$("createKey").addEventListener("click", async () => {
  const name = prompt("Key 名称", "默认 Key");
  if (!name) return;
  try {
    const result = await requestJson("/admin/keys", { method: "POST", body: JSON.stringify({ name }) }, true);
    $("secretBox").classList.remove("hidden");
    $("secretBox").textContent = `请立即保存这个 Key：${result.secret}`;
    await refreshAdminConfig();
  } catch (error) {
    showToast(error.message);
  }
});

$("refresh").addEventListener("click", () => refreshAdminConfig().catch((error) => showToast(error.message)));

document.addEventListener("click", async (event) => {
  const conversationId = event.target.closest("[data-conversation]")?.dataset.conversation;
  if (conversationId) {
    state.activeConversationId = conversationId;
    if (window.matchMedia("(max-width: 768px)").matches) state.sidebarOpen = false;
    saveLocalState();
    render();
    return;
  }

  const keyVisibility = event.target.dataset.keyVisibility;
  if (keyVisibility) {
    if (state.apiKeyVisible.has(keyVisibility)) state.apiKeyVisible.delete(keyVisibility);
    else state.apiKeyVisible.add(keyVisibility);
    renderUpstreams();
    return;
  }

  const upstreamId = event.target.dataset.upstreamSave;
  if (upstreamId) {
    const fields = {};
    document.querySelectorAll(`[data-upstream-field^="${upstreamId}:"]`).forEach((input) => {
      const field = input.dataset.upstreamField.split(":")[1];
      if (field === "enabled") fields[field] = input.checked;
      else if (field === "modelPrefixes") {
        fields[field] = input.value.split(",").map((item) => item.trim()).filter(Boolean);
      } else {
        fields[field] = input.value.trim();
      }
    });
    try {
      state.config = await requestJson(`/admin/upstreams/${upstreamId}`, {
        method: "PATCH",
        body: JSON.stringify(fields)
      }, true);
      showToast("模型提供方已保存");
      renderAdminPanel();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const keyId = event.target.dataset.keyToggle;
  if (keyId) {
    const key = state.config.apiKeys.find((item) => item.id === keyId);
    try {
      state.config = await requestJson(`/admin/keys/${keyId}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled: !key.enabled })
      }, true);
      renderAdminPanel();
    } catch (error) {
      showToast(error.message);
    }
  }
});

window.addEventListener("resize", () => renderShell());

loadLocalState();
loadPublicConfig().then(() => {
  $("chatModel").value = state.chatModel;
  updateWebSearchButton();
  render();
});
