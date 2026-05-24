const STORAGE_KEY = "daotian_ai_v3_1_state";

const $ = (selector) => document.querySelector(selector);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const PROVIDER_PRESETS = {
  openai: {
    name: "OpenAI",
    type: "openai",
    baseUrl: "https://api.openai.com",
    model: "gpt-5.5",
  },
  deepseek: {
    name: "DeepSeek",
    type: "openai",
    baseUrl: "https://api.deepseek.com",
    model: "deepseek-chat",
  },
  gemini: {
    name: "Gemini",
    type: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com",
    model: "gemini-2.5-flash",
  },
  anthropic: {
    name: "Anthropic",
    type: "anthropic",
    baseUrl: "https://api.anthropic.com",
    model: "claude-sonnet-4-5",
  },
};

const DEFAULT_PROVIDERS = [
  makeProvider("deepseek"),
  makeProvider("openai"),
  makeProvider("gemini"),
  makeProvider("anthropic"),
];

let state = loadState();
let sending = false;

function makeProvider(presetKey = "deepseek") {
  const preset = PROVIDER_PRESETS[presetKey] || PROVIDER_PRESETS.deepseek;
  return {
    id: uid(),
    name: preset.name,
    type: preset.type,
    baseUrl: preset.baseUrl,
    apiKey: "",
    model: preset.model,
    enabled: true,
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState(JSON.parse(raw));
  } catch {}
  const chat = createChat();
  return normalizeState({
    theme: "light",
    sidebarCollapsed: false,
    currentChatId: chat.id,
    chats: [chat],
    searchEnabled: false,
    providers: DEFAULT_PROVIDERS,
    activeProviderId: DEFAULT_PROVIDERS[0].id,
  });
}

function normalizeProvider(p, fallbackIndex = 0) {
  const oldDefault = p?.id === "default" || p?.name === "默认提供方";
  const type = ["openai", "gemini", "anthropic"].includes(p?.type) ? p.type : "openai";
  return {
    id: p?.id && p.id !== "default" ? p.id : `provider-${fallbackIndex}-${uid()}`,
    name: oldDefault ? "DeepSeek" : (p?.name || "自定义提供方"),
    type,
    baseUrl: p?.baseUrl || (oldDefault ? "https://api.deepseek.com" : ""),
    apiKey: p?.apiKey || "",
    model: p?.model || (oldDefault ? "deepseek-chat" : ""),
    enabled: p?.enabled !== false,
  };
}

function normalizeState(input = {}) {
  const chats = Array.isArray(input.chats) && input.chats.length ? input.chats : [createChat()];
  let providers = Array.isArray(input.providers) && input.providers.length
    ? input.providers.map(normalizeProvider)
    : DEFAULT_PROVIDERS.map(p => ({ ...p, id: uid() }));

  const hasOpenAI = providers.some(p => p.type === "openai" && /openai/i.test(p.name));
  const hasGemini = providers.some(p => p.type === "gemini");
  const hasAnthropic = providers.some(p => p.type === "anthropic");
  if (!hasOpenAI) providers.push(makeProvider("openai"));
  if (!hasGemini) providers.push(makeProvider("gemini"));
  if (!hasAnthropic) providers.push(makeProvider("anthropic"));

  const currentChatId = chats.some(c => c.id === input.currentChatId) ? input.currentChatId : chats[0].id;
  const activeProviderId = providers.some(p => p.id === input.activeProviderId) ? input.activeProviderId : providers[0].id;
  return {
    theme: input.theme === "dark" ? "dark" : "light",
    sidebarCollapsed: Boolean(input.sidebarCollapsed),
    currentChatId,
    chats,
    searchEnabled: Boolean(input.searchEnabled),
    providers,
    activeProviderId,
  };
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function createChat(title = "新对话") {
  return { id: uid(), title, createdAt: Date.now(), updatedAt: Date.now(), messages: [] };
}

function currentChat() {
  return state.chats.find(c => c.id === state.currentChatId) || state.chats[0];
}

function activeProvider() {
  return state.providers.find(p => p.id === state.activeProviderId) || state.providers[0] || makeProvider("deepseek");
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inferTitle(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.length > 18 ? compact.slice(0, 18) + "…" : compact || "新对话";
}

function providerTypeLabel(type) {
  if (type === "gemini") return "Gemini";
  if (type === "anthropic") return "Anthropic";
  return "OpenAI 兼容";
}

function providerEndpointHint(provider) {
  if (provider.type === "gemini") return "/v1beta/models/{model}:generateContent";
  if (provider.type === "anthropic") return "/v1/messages";
  return "/v1/chat/completions";
}

function render() {
  document.documentElement.dataset.theme = state.theme;
  const chat = currentChat();
  const shellClass = `app-shell${state.sidebarCollapsed ? " sidebar-collapsed" : ""}`;
  document.querySelector("#app").innerHTML = `
    <div class="${shellClass}">
      <aside class="sidebar">
        <div class="sidebar-inner">
          <div class="sidebar-top">
            <button class="icon-btn" data-action="toggle-sidebar" title="收起侧边栏">☰</button>
            <div class="app-title">稻田 Ai</div>
          </div>
          <button class="new-chat-btn" data-action="new-chat" title="新建对话">＋</button>
          <div class="chat-list">
            ${state.chats.map(c => `
              <div class="chat-item ${c.id === state.currentChatId ? "active" : ""}" data-chat-id="${c.id}" title="${escapeHtml(c.title)}">
                <span class="chat-dot"></span>
                <span class="chat-title">${escapeHtml(c.title || "新对话")}</span>
                <span class="chat-time">${formatTime(c.updatedAt || c.createdAt)}</span>
                <button class="delete-chat" data-delete-chat="${c.id}" title="删除对话">×</button>
              </div>
            `).join("")}
          </div>
          <div class="sidebar-bottom">
            <button class="bottom-btn" data-action="open-settings">⚙ 设置 / 模型提供方</button>
            <div class="user-pill">稻田用户</div>
          </div>
        </div>
      </aside>

      <main class="main">
        <div class="main-top">
          <button class="icon-btn collapsed-menu-btn" data-action="toggle-sidebar" title="展开侧边栏">☰</button>
          <div class="top-actions">
            <button class="icon-btn" data-action="toggle-theme" title="切换主题">${state.theme === "dark" ? "☾" : "☀"}</button>
          </div>
        </div>

        <div class="messages" id="messages">
          ${renderMessages(chat)}
        </div>

        <div class="composer-wrap">
          <div class="composer">
            <div class="search-row">
              <button class="search-toggle ${state.searchEnabled ? "active" : ""}" data-action="toggle-search">○ 联网搜索</button>
            </div>
            <div class="input-box">
              <textarea id="messageInput" rows="1" placeholder="输入消息…（Enter 发送，Shift + Enter 换行）"></textarea>
              <button class="send-btn" data-action="send" ${sending ? "disabled" : ""}>›</button>
            </div>
          </div>
        </div>
      </main>
    </div>

    ${renderSettingsModal()}
  `;
  bindEvents();
  scrollToBottom(false);
}

function renderMessages(chat) {
  if (!chat || !chat.messages || chat.messages.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-logo">≋</div>
        <div class="empty-title">稻田 Ai</div>
        <div class="empty-subtitle">开始一段新的对话。</div>
      </div>
    `;
  }
  return chat.messages.map(m => `
    <div class="message ${m.role === "user" ? "user" : "assistant"}">
      <div class="bubble">${escapeHtml(m.content || "")}</div>
    </div>
  `).join("");
}

function renderSettingsModal() {
  const provider = activeProvider();
  return `
    <div class="modal-backdrop" id="settingsModal">
      <div class="modal">
        <div class="modal-header">
          <div class="modal-title">设置 / 模型提供方</div>
          <button class="icon-btn" data-action="close-settings">×</button>
        </div>
        <div class="modal-body">
          <div class="form-grid">
            <div class="field">
              <label>当前默认提供方</label>
              <select id="activeProviderSelect">
                ${state.providers.map(p => `<option value="${p.id}" ${p.id === state.activeProviderId ? "selected" : ""}>${escapeHtml(p.name || "未命名")} · ${providerTypeLabel(p.type)}</option>`).join("")}
              </select>
            </div>
            <div class="provider-actions">
              <button class="ghost-btn small" data-action="add-openai-provider">＋ OpenAI兼容</button>
              <button class="ghost-btn small" data-action="add-gemini-provider">＋ Gemini</button>
              <button class="ghost-btn small" data-action="add-anthropic-provider">＋ Anthropic</button>
              <button class="ghost-btn small danger" data-action="delete-provider">删除当前</button>
            </div>
            <div class="field">
              <label>接口类型</label>
              <select id="providerType">
                <option value="openai" ${provider.type === "openai" ? "selected" : ""}>OpenAI 兼容接口</option>
                <option value="gemini" ${provider.type === "gemini" ? "selected" : ""}>Gemini 接口</option>
                <option value="anthropic" ${provider.type === "anthropic" ? "selected" : ""}>Anthropic 接口</option>
              </select>
            </div>
            <div class="field">
              <label>模型提供方名称</label>
              <input id="providerName" value="${escapeHtml(provider.name || "")}" placeholder="例如 OpenAI / Gemini / Anthropic / DeepSeek" />
            </div>
            <div class="field">
              <label>Base URL</label>
              <input id="providerBaseUrl" value="${escapeHtml(provider.baseUrl || "")}" placeholder="https://api.openai.com" />
            </div>
            <div class="endpoint-hint">当前类型默认请求路径：${escapeHtml(providerEndpointHint(provider))}</div>
            <div class="field">
              <label>API Key</label>
              <input id="providerApiKey" value="${escapeHtml(provider.apiKey || "")}" placeholder="sk-... / AIza... / anthro..." autocomplete="off" />
            </div>
            <div class="field">
              <label>默认聊天模型</label>
              <input id="providerModel" value="${escapeHtml(provider.model || "")}" placeholder="例如 deepseek-chat / gpt-5.5 / gemini-2.5-flash / claude-sonnet-4-5" />
            </div>
          </div>
          <div class="provider-list">
            ${state.providers.map(p => `
              <button class="provider-card ${p.id === state.activeProviderId ? "active" : ""}" data-provider-id="${p.id}">
                <strong>${escapeHtml(p.name || "未命名")}</strong>
                <span>${providerTypeLabel(p.type)}</span>
                <span>${escapeHtml(p.baseUrl || "使用当前站点")}</span>
                <span>${escapeHtml(p.model || "未设置模型")}</span>
              </button>
            `).join("")}
          </div>
        </div>
        <div class="modal-footer">
          <button class="ghost-btn" data-action="close-settings">取消</button>
          <button class="primary-btn" data-action="save-settings">保存</button>
        </div>
      </div>
    </div>
  `;
}

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach(el => {
    el.addEventListener("click", (event) => handleAction(event, el.dataset.action));
  });
  document.querySelectorAll("[data-chat-id]").forEach(el => {
    el.addEventListener("click", (event) => {
      if (event.target.closest("[data-delete-chat]")) return;
      state.currentChatId = el.dataset.chatId;
      saveState();
      render();
    });
  });
  document.querySelectorAll("[data-delete-chat]").forEach(el => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      deleteChat(el.dataset.deleteChat);
    });
  });
  document.querySelectorAll("[data-provider-id]").forEach(el => {
    el.addEventListener("click", () => {
      state.activeProviderId = el.dataset.providerId;
      saveState();
      render();
      $("#settingsModal")?.classList.add("show");
    });
  });
  const activeProviderSelect = $("#activeProviderSelect");
  if (activeProviderSelect) {
    activeProviderSelect.addEventListener("change", () => {
      state.activeProviderId = activeProviderSelect.value;
      saveState();
      render();
      $("#settingsModal")?.classList.add("show");
    });
  }
  const input = $("#messageInput");
  if (input) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    });
    input.addEventListener("input", () => {
      input.style.height = "auto";
      input.style.height = `${Math.min(input.scrollHeight, 160)}px`;
    });
    input.focus();
  }
}

function handleAction(event, action) {
  if (action === "toggle-sidebar") {
    state.sidebarCollapsed = !state.sidebarCollapsed;
    saveState(); render(); return;
  }
  if (action === "new-chat") {
    const chat = createChat();
    state.chats.unshift(chat);
    state.currentChatId = chat.id;
    saveState(); render(); return;
  }
  if (action === "toggle-theme") {
    state.theme = state.theme === "dark" ? "light" : "dark";
    saveState(); render(); return;
  }
  if (action === "toggle-search") {
    state.searchEnabled = !state.searchEnabled;
    saveState(); render(); return;
  }
  if (action === "send") sendMessage();
  if (action === "open-settings") $("#settingsModal")?.classList.add("show");
  if (action === "close-settings") $("#settingsModal")?.classList.remove("show");
  if (action === "save-settings") saveSettings();
  if (action === "add-openai-provider") addProvider("openai");
  if (action === "add-gemini-provider") addProvider("gemini");
  if (action === "add-anthropic-provider") addProvider("anthropic");
  if (action === "delete-provider") deleteActiveProvider();
}

function deleteChat(chatId) {
  const index = state.chats.findIndex(c => c.id === chatId);
  if (index < 0) return;
  state.chats = state.chats.filter(c => c.id !== chatId);
  if (state.chats.length === 0) state.chats.push(createChat());
  if (state.currentChatId === chatId) {
    state.currentChatId = state.chats[Math.min(index, state.chats.length - 1)].id;
  }
  saveState();
  render();
}

function addProvider(kind) {
  const map = { openai: "openai", gemini: "gemini", anthropic: "anthropic" };
  const p = makeProvider(map[kind] || "openai");
  if (kind === "openai") p.name = "自定义 OpenAI 兼容";
  state.providers.push(p);
  state.activeProviderId = p.id;
  saveState();
  render();
  $("#settingsModal")?.classList.add("show");
}

function deleteActiveProvider() {
  if (state.providers.length <= 1) return;
  state.providers = state.providers.filter(p => p.id !== state.activeProviderId);
  state.activeProviderId = state.providers[0].id;
  saveState();
  render();
  $("#settingsModal")?.classList.add("show");
}

function saveSettings() {
  const provider = activeProvider();
  provider.type = $("#providerType")?.value || "openai";
  provider.name = $("#providerName")?.value.trim() || providerTypeLabel(provider.type);
  provider.baseUrl = $("#providerBaseUrl")?.value.trim() || "";
  provider.apiKey = $("#providerApiKey")?.value.trim() || "";
  provider.model = $("#providerModel")?.value.trim() || "";
  saveState();
  $("#settingsModal")?.classList.remove("show");
  render();
}

async function sendMessage() {
  if (sending) return;
  const input = $("#messageInput");
  const text = input?.value.trim();
  if (!text) return;
  const chat = currentChat();
  chat.messages.push({ role: "user", content: text });
  if (!chat.title || chat.title === "新对话") chat.title = inferTitle(text);
  chat.updatedAt = Date.now();
  input.value = "";
  sending = true;
  saveState();
  render();

  try {
    const reply = await callChatApi(chat.messages);
    chat.messages.push({ role: "assistant", content: reply || "没有返回内容。" });
  } catch (err) {
    chat.messages.push({ role: "assistant", content: `请求失败：${err.message || err}` });
  } finally {
    chat.updatedAt = Date.now();
    sending = false;
    saveState();
    render();
  }
}

function endpointFromBase(baseUrl, defaultPath) {
  const base = (baseUrl || "").trim().replace(/\/$/, "");
  if (!base) return defaultPath;
  if (/\/chat\/completions$|\/messages$|:generateContent$/i.test(base)) return base;
  return `${base}${defaultPath}`;
}

function systemPrompt() {
  return state.searchEnabled ? "用户打开了联网搜索。需要时结合可用搜索能力回答。" : "你是稻田 Ai。";
}

async function callChatApi(messages) {
  const provider = activeProvider();
  if (provider.type === "gemini") return callGemini(provider, messages);
  if (provider.type === "anthropic") return callAnthropic(provider, messages);
  return callOpenAICompatible(provider, messages);
}

async function callOpenAICompatible(provider, messages) {
  const url = endpointFromBase(provider.baseUrl, "/v1/chat/completions");
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const body = {
    model: provider.model || "deepseek-chat",
    messages: [
      { role: "system", content: systemPrompt() },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ],
    stream: false,
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 260));
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
}

async function callGemini(provider, messages) {
  const base = (provider.baseUrl || "https://generativelanguage.googleapis.com").replace(/\/$/, "");
  const model = provider.model || "gemini-2.5-flash";
  const url = /:generateContent$/i.test(base)
    ? base
    : `${base}/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) headers["x-goog-api-key"] = provider.apiKey;
  const body = {
    systemInstruction: { parts: [{ text: systemPrompt() }] },
    contents: messages.map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content || "" }]
    }))
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 260));
  const data = await res.json();
  return data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
}

async function callAnthropic(provider, messages) {
  const url = endpointFromBase(provider.baseUrl || "https://api.anthropic.com", "/v1/messages");
  const headers = {
    "Content-Type": "application/json",
    "anthropic-version": "2023-06-01",
    "anthropic-dangerous-direct-browser-access": "true",
  };
  if (provider.apiKey) headers["x-api-key"] = provider.apiKey;
  const body = {
    model: provider.model || "claude-sonnet-4-5",
    max_tokens: 2048,
    system: systemPrompt(),
    messages: messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: m.content || ""
    }))
  };
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 260));
  const data = await res.json();
  return Array.isArray(data?.content) ? data.content.map(p => p.text || "").join("") : "";
}

function scrollToBottom(smooth = true) {
  const box = $("#messages");
  if (!box) return;
  requestAnimationFrame(() => box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
}

render();
