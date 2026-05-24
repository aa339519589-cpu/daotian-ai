const STORAGE_KEY = "daotian_ai_v3_1_state";

const DEFAULT_PROVIDER = {
  id: "default",
  name: "默认提供方",
  baseUrl: "",
  apiKey: "",
  model: "deepseek-chat",
  enabled: true,
};

const $ = (selector) => document.querySelector(selector);
const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

let state = loadState();
let sending = false;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return normalizeState(parsed);
    }
  } catch {}
  const chat = createChat();
  return normalizeState({
    theme: "light",
    sidebarCollapsed: false,
    currentChatId: chat.id,
    chats: [chat],
    searchEnabled: false,
    providers: [DEFAULT_PROVIDER],
    activeProviderId: "default",
  });
}

function normalizeState(input) {
  const chats = Array.isArray(input.chats) && input.chats.length ? input.chats : [createChat()];
  const providers = Array.isArray(input.providers) && input.providers.length ? input.providers : [DEFAULT_PROVIDER];
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
  return state.providers.find(p => p.id === state.activeProviderId) || state.providers[0] || DEFAULT_PROVIDER;
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
              <button class="chat-item ${c.id === state.currentChatId ? "active" : ""}" data-chat-id="${c.id}" title="${escapeHtml(c.title)}">
                <span class="chat-dot"></span>
                <span class="chat-title">${escapeHtml(c.title || "新对话")}</span>
                <span class="chat-time">${formatTime(c.updatedAt || c.createdAt)}</span>
                <span class="delete-chat" data-delete-chat="${c.id}" title="删除">×</span>
              </button>
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
          <div class="top-title"></div>
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
              <label>模型提供方名称</label>
              <input id="providerName" value="${escapeHtml(provider.name || "")}" />
            </div>
            <div class="field">
              <label>Base URL（留空则使用当前站点 /v1/chat/completions）</label>
              <input id="providerBaseUrl" value="${escapeHtml(provider.baseUrl || "")}" placeholder="https://api.deepseek.com" />
            </div>
            <div class="field">
              <label>API Key（可留空，使用后端已配置的 Key）</label>
              <input id="providerApiKey" value="${escapeHtml(provider.apiKey || "")}" placeholder="sk-..." />
            </div>
            <div class="field">
              <label>默认聊天模型</label>
              <input id="providerModel" value="${escapeHtml(provider.model || "deepseek-chat")}" placeholder="deepseek-chat" />
            </div>
          </div>
          <div class="provider-list">
            ${state.providers.map(p => `
              <div class="provider-card">
                <strong>${escapeHtml(p.name || "未命名")}</strong>
                <span>${escapeHtml(p.baseUrl || "使用当前站点 /v1")}</span>
                <span>${escapeHtml(p.model || "未设置模型")}</span>
              </div>
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
      event.stopPropagation();
      deleteChat(el.dataset.deleteChat);
    });
  });
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
}

function deleteChat(chatId) {
  const index = state.chats.findIndex(c => c.id === chatId);
  if (index < 0) return;
  state.chats.splice(index, 1);
  if (state.chats.length === 0) state.chats.push(createChat());
  if (state.currentChatId === chatId) {
    state.currentChatId = state.chats[Math.min(index, state.chats.length - 1)].id;
  }
  saveState();
  render();
}

function saveSettings() {
  const provider = activeProvider();
  provider.name = $("#providerName")?.value.trim() || "默认提供方";
  provider.baseUrl = $("#providerBaseUrl")?.value.trim() || "";
  provider.apiKey = $("#providerApiKey")?.value.trim() || "";
  provider.model = $("#providerModel")?.value.trim() || "deepseek-chat";
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

async function callChatApi(messages) {
  const provider = activeProvider();
  const base = (provider.baseUrl || "").replace(/\/$/, "");
  const url = base ? `${base}/v1/chat/completions` : "/v1/chat/completions";
  const body = {
    model: provider.model || "deepseek-chat",
    messages: [
      { role: "system", content: state.searchEnabled ? "用户打开了联网搜索。需要时结合可用搜索能力回答。" : "你是稻田 Ai。" },
      ...messages.map(m => ({ role: m.role, content: m.content }))
    ],
    stream: false,
  };
  const headers = { "Content-Type": "application/json" };
  if (provider.apiKey) headers.Authorization = `Bearer ${provider.apiKey}`;
  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`.slice(0, 220));
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || "";
}

function scrollToBottom(smooth = true) {
  const box = $("#messages");
  if (!box) return;
  requestAnimationFrame(() => box.scrollTo({ top: box.scrollHeight, behavior: smooth ? "smooth" : "auto" }));
}

render();
