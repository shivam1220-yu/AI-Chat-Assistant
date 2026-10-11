const state = {
  conversations: [],
  activeConversationId: null,
  activeConversation: null,
  promptSuggestions: [],
  selectedModel: "gemini-3.8-flash",
  systemInstruction:
    "You are Nova, a warm, intelligent, and helpful AI assistant. Reply naturally in the language/style the user uses (English, Hindi, or Hinglish). Keep explanations clear, conversational, and well-structured using Markdown when helpful.",
  isStreaming: false,
  abortController: null,
  apiKeyConfigured: false,
  searchQuery: "",
};

const els = {
  sidebar: document.getElementById("sidebar"),
  sidebarBackdrop: document.getElementById("sidebarBackdrop"),
  toggleSidebarBtn: document.getElementById("toggleSidebarBtn"),
  newChatBtn: document.getElementById("newChatBtn"),
  historySearchInput: document.getElementById("historySearchInput"),
  conversationList: document.getElementById("conversationList"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),

  apiKeyDot: document.getElementById("apiKeyDot"),
  apiKeyStatusTitle: document.getElementById("apiKeyStatusTitle"),
  openKeyModalBtn: document.getElementById("openKeyModalBtn"),
  apiKeyModal: document.getElementById("apiKeyModal"),
  closeKeyModalBtn: document.getElementById("closeKeyModalBtn"),
  cancelKeyModalBtn: document.getElementById("cancelKeyModalBtn"),
  apiKeyForm: document.getElementById("apiKeyForm"),
  backendApiKeyInput: document.getElementById("backendApiKeyInput"),

  openPersonaModalBtn: document.getElementById("openPersonaModalBtn"),
  personaModal: document.getElementById("personaModal"),
  closePersonaModalBtn: document.getElementById("closePersonaModalBtn"),
  cancelPersonaModalBtn: document.getElementById("cancelPersonaModalBtn"),
  personaForm: document.getElementById("personaForm"),
  systemInstructionInput: document.getElementById("systemInstructionInput"),

  activeChatTitle: document.getElementById("activeChatTitle"),
  modelSelector: document.getElementById("modelSelector"),
  exportChatBtn: document.getElementById("exportChatBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),

  chatViewport: document.getElementById("chatViewport"),
  welcomeScreen: document.getElementById("welcomeScreen"),
  promptGrid: document.getElementById("promptGrid"),
  messagesContainer: document.getElementById("messagesContainer"),

  chatForm: document.getElementById("chatForm"),
  messageInput: document.getElementById("messageInput"),
  sendBtn: document.getElementById("sendBtn"),
  stopStreamBtn: document.getElementById("stopStreamBtn"),
  toast: document.getElementById("toast"),
};

async function init() {
  initTheme();
  bindEvents();
  await Promise.all([
    checkBackendHealth(),
    fetchPromptSuggestions(),
    fetchConversations(),
  ]);
}

function initTheme() {
  const savedTheme = localStorage.getItem("nova_theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
}

function toggleTheme() {
  const current =
    document.documentElement.getAttribute("data-theme") || "light";
  const next = current === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("nova_theme", next);
  showToast(`${next === "dark" ? "Dark" : "Light"} theme active`);
}

async function checkBackendHealth() {
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    state.apiKeyConfigured = Boolean(data.apiKeyConfigured);
    updateSecurityBadge();
  } catch {
    els.apiKeyDot.className = "status-dot missing";
    els.apiKeyStatusTitle.textContent = "Server offline";
  }
}

function updateSecurityBadge() {
  if (state.apiKeyConfigured) {
    els.apiKeyDot.className = "status-dot ok";
    els.apiKeyStatusTitle.textContent = "Backend Key Active";
  } else {
    els.apiKeyDot.className = "status-dot missing";
    els.apiKeyStatusTitle.textContent = "Set Backend Key";
  }
}

async function fetchPromptSuggestions() {
  try {
    const res = await fetch("/api/prompts");
    const data = await res.json();
    state.promptSuggestions = data.suggestions || [];
    renderPromptSuggestions();
  } catch (err) {
    console.error("Failed to load prompt suggestions:", err);
  }
}

function renderPromptSuggestions() {
  els.promptGrid.innerHTML = state.promptSuggestions
    .map(
      (item) => `
      <button type="button" class="prompt-pill" data-prompt="${escapeAttr(
        item.prompt
      )}">
        ${escapeHtml(item.label || item.title)}
      </button>
    `
    )
    .join("");

  els.promptGrid.querySelectorAll(".prompt-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const promptText = pill.getAttribute("data-prompt");
      if (promptText) {
        els.messageInput.value = promptText;
        autoResizeTextarea();
        handleSendMessage(promptText);
      }
    });
  });
}

async function fetchConversations() {
  try {
    const res = await fetch("/api/conversations");
    const data = await res.json();
    state.conversations = data.conversations || [];
    renderConversationList();
  } catch (err) {
    console.error("Failed to load conversations:", err);
  }
}

function renderConversationList() {
  const query = state.searchQuery.trim().toLowerCase();
  const filtered = query
    ? state.conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(query) ||
          (c.lastPreview && c.lastPreview.toLowerCase().includes(query))
      )
    : state.conversations;

  if (filtered.length === 0) {
    els.conversationList.innerHTML = `
      <div class="empty-history">
        ${query ? "No matching chats" : "Your conversations will appear here"}
      </div>
    `;
    return;
  }

  els.conversationList.innerHTML = filtered
    .map((conv) => {
      const isActive = conv.id === state.activeConversationId;
      return `
        <div class="conv-item ${isActive ? "active" : ""}" data-id="${escapeAttr(
        conv.id
      )}">
          <div class="conv-title">${escapeHtml(conv.title)}</div>
          <div class="conv-actions">
            <button type="button" class="conv-action-btn rename" data-id="${escapeAttr(
              conv.id
            )}" title="Rename">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </button>
            <button type="button" class="conv-action-btn delete" data-id="${escapeAttr(
              conv.id
            )}" title="Delete">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      `;
    })
    .join("");

  els.conversationList.querySelectorAll(".conv-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      if (e.target.closest(".conv-action-btn")) return;
      const id = item.getAttribute("data-id");
      selectConversation(id);
      closeMobileSidebar();
    });
  });

  els.conversationList
    .querySelectorAll(".conv-action-btn.rename")
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        const target = state.conversations.find((c) => c.id === id);
        const nextTitle = window.prompt("Rename chat:", target?.title || "");
        if (nextTitle && nextTitle.trim()) {
          await fetch(`/api/conversations/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: nextTitle.trim() }),
          });
          if (state.activeConversationId === id) {
            els.activeChatTitle.textContent = nextTitle.trim();
          }
          await fetchConversations();
        }
      });
    });

  els.conversationList
    .querySelectorAll(".conv-action-btn.delete")
    .forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = btn.getAttribute("data-id");
        await fetch(`/api/conversations/${id}`, { method: "DELETE" });
        if (state.activeConversationId === id) {
          startNewChat();
        }
        await fetchConversations();
      });
    });
}

async function selectConversation(id) {
  if (state.isStreaming) return;
  try {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const { conversation } = await res.json();
    state.activeConversationId = conversation.id;
    state.activeConversation = conversation;
    if (conversation.model) {
      state.selectedModel = conversation.model;
      els.modelSelector.value = conversation.model;
    }
    if (conversation.systemInstruction) {
      state.systemInstruction = conversation.systemInstruction;
    }

    els.activeChatTitle.textContent = conversation.title || "";
    renderConversationList();
    renderMessages(conversation.messages || []);
  } catch (err) {
    console.error("Error loading conversation:", err);
  }
}

function startNewChat() {
  if (state.isStreaming) {
    state.abortController?.abort();
  }
  state.activeConversationId = null;
  state.activeConversation = null;
  els.activeChatTitle.textContent = "";
  els.messagesContainer.innerHTML = "";
  els.messagesContainer.classList.add("hidden");
  els.welcomeScreen.classList.remove("hidden");
  renderConversationList();
  els.messageInput.focus();
}

function renderMessages(messages) {
  if (!messages || messages.length === 0) {
    els.messagesContainer.innerHTML = "";
    els.messagesContainer.classList.add("hidden");
    els.welcomeScreen.classList.remove("hidden");
    return;
  }

  els.welcomeScreen.classList.add("hidden");
  els.messagesContainer.classList.remove("hidden");
  els.messagesContainer.innerHTML = messages
    .map((msg) => buildMessageHTML(msg, false))
    .join("");

  bindMessageActions();
  scrollToBottom();
}

function buildMessageHTML(msg, isStreaming = false) {
  if (msg.role === "user") {
    return `
      <div class="msg-turn user" data-msg-id="${escapeAttr(msg.id || "")}">
        <div class="user-pill">${escapeHtml(msg.content).replace(
          /\n/g,
          "<br/>"
        )}</div>
      </div>
    `;
  }

  const thoughtHTML = msg.thoughtSummary
    ? `
      <details class="thought-details">
        <summary>Thought process</summary>
        <div class="thought-body">${escapeHtml(msg.thoughtSummary)}</div>
      </details>
    `
    : "";

  const innerBody =
    isStreaming && !msg.content
      ? `<div class="typing-dots"><span></span><span></span><span></span></div>`
      : `<div class="prose ${
          isStreaming ? "streaming-cursor" : ""
        }">${renderMarkdown(msg.content || "")}</div>`;

  const tokenText = msg.usage?.total_tokens
    ? `<span class="token-note">${msg.usage.total_tokens} tokens</span>`
    : "";

  const metaBar = !isStreaming
    ? `
      <div class="assistant-meta-bar">
        <button type="button" class="meta-icon-btn copy-msg-btn" data-content="${escapeAttr(
          msg.content || ""
        )}">
          Copy
        </button>
        <button type="button" class="meta-icon-btn regen-msg-btn">
          Regenerate
        </button>
        ${tokenText}
      </div>
    `
    : "";

  return `
    <div class="msg-turn assistant" data-msg-id="${escapeAttr(msg.id || "")}">
      <div class="assistant-layout">
        <div class="ai-orb" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
            <path d="M12 2L14.8 9.2L22 12L14.8 14.8L12 22L9.2 14.8L2 12L9.2 9.2L12 2Z" />
          </svg>
        </div>
        <div class="assistant-content-wrap">
          ${thoughtHTML}
          <div class="msg-body-slot">${innerBody}</div>
          ${metaBar}
        </div>
      </div>
    </div>
  `;
}

async function handleSendMessage(overrideText) {
  if (state.isStreaming) return;

  const text = (
    typeof overrideText === "string" ? overrideText : els.messageInput.value
  ).trim();
  if (!text) return;

  if (!state.apiKeyConfigured) {
    openApiKeyModal();
    showToast("Please configure your backend GEMINI_API_KEY first");
    return;
  }

  els.messageInput.value = "";
  autoResizeTextarea();
  els.welcomeScreen.classList.add("hidden");
  els.messagesContainer.classList.remove("hidden");

  const userMsg = {
    id: "user-" + Date.now(),
    role: "user",
    content: text,
    timestamp: new Date().toISOString(),
  };
  els.messagesContainer.insertAdjacentHTML(
    "beforeend",
    buildMessageHTML(userMsg, false)
  );

  const streamMsgId = "ai-" + Date.now();
  const assistantPlaceholder = {
    id: streamMsgId,
    role: "assistant",
    content: "",
    thoughtSummary: "",
    model: state.selectedModel,
    timestamp: new Date().toISOString(),
  };
  els.messagesContainer.insertAdjacentHTML(
    "beforeend",
    buildMessageHTML(assistantPlaceholder, true)
  );
  scrollToBottom();

  const streamRow = els.messagesContainer.querySelector(
    `[data-msg-id="${streamMsgId}"]`
  );
  const bodySlot = streamRow?.querySelector(".msg-body-slot");

  setStreamingUIState(true);
  state.abortController = new AbortController();

  let liveText = "";
  let liveThought = "";
  let finalUsage = null;

  try {
    const response = await fetch("/api/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversationId: state.activeConversationId,
        message: text,
        model: state.selectedModel,
        systemInstruction: state.systemInstruction,
      }),
      signal: state.abortController.signal,
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      if (errJson.code === "MISSING_API_KEY") {
        state.apiKeyConfigured = false;
        updateSecurityBadge();
        openApiKeyModal();
      }
      throw new Error(errJson.error || `Server error (${response.status})`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    const processBlock = (block) => {
      const parsed = parseSSEBlock(block);
      if (!parsed) return;
      const { event, data } = parsed;

      if (event === "conversation.meta") {
        state.activeConversationId = data.conversationId;
        els.activeChatTitle.textContent = data.title || "";
      } else if (event === "step.delta") {
        if (data.deltaType === "text" && data.text) {
          liveText += data.text;
          if (bodySlot) {
            bodySlot.innerHTML = `<div class="prose streaming-cursor">${renderMarkdown(
              liveText
            )}</div>`;
          }
          scrollToBottom();
        } else if (data.deltaType === "thought_summary" && data.text) {
          liveThought += data.text;
        }
      } else if (event === "interaction.completed") {
        finalUsage = data.usage || null;
        state.activeConversationId = data.conversationId;
      } else if (event === "error") {
        throw new Error(data.message || "Streaming error.");
      }
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const blocks = buffer.split("\n\n");
      buffer = blocks.pop() || "";

      for (const block of blocks) {
        processBlock(block);
      }
    }

    if (buffer.trim()) {
      processBlock(buffer);
    }

    if (streamRow) {
      const completedMsg = {
        id: streamMsgId,
        role: "assistant",
        content: liveText || "I couldn't generate a response. Please try again.",
        thoughtSummary: liveThought || null,
        usage: finalUsage,
        model: state.selectedModel,
        timestamp: new Date().toISOString(),
      };
      streamRow.outerHTML = buildMessageHTML(completedMsg, false);
      bindMessageActions();
    }

    await fetchConversations();
    if (state.activeConversationId) {
      const res = await fetch(
        `/api/conversations/${state.activeConversationId}`
      );
      if (res.ok) {
        const { conversation } = await res.json();
        state.activeConversation = conversation;
      }
    }
  } catch (err) {
    if (err.name === "AbortError") {
      if (bodySlot) {
        bodySlot.innerHTML = `<div class="prose">${renderMarkdown(
          (liveText || "") + "\n\n*(Stopped)*"
        )}</div>`;
      }
    } else {
      if (bodySlot) {
        bodySlot.innerHTML = `<div class="prose"><p style="color: var(--danger);">⚠️ ${escapeHtml(
          err.message
        )}</p></div>`;
      }
      showToast(err.message);
    }
  } finally {
    setStreamingUIState(false);
    scrollToBottom();
  }
}

function parseSSEBlock(block) {
  const lines = block.split("\n");
  let eventName = "message";
  let dataStr = "";

  for (const line of lines) {
    if (line.startsWith("event:")) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataStr += line.slice(5).trim();
    }
  }
  if (!dataStr) return null;
  try {
    return { event: eventName, data: JSON.parse(dataStr) };
  } catch {
    return null;
  }
}

function setStreamingUIState(streaming) {
  state.isStreaming = streaming;
  els.sendBtn.classList.toggle("hidden", streaming);
  els.stopStreamBtn.classList.toggle("hidden", !streaming);
}

function renderMarkdown(raw) {
  if (!raw) return "";

  const codeBlocks = [];
  let text = raw.replace(
    /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g,
    (_, lang, code) => {
      const idx = codeBlocks.length;
      const language = lang.trim() || "code";
      codeBlocks.push({ language, code: code.replace(/\n$/, "") });
      return `@@CODE_BLOCK_${idx}@@`;
    }
  );

  text = escapeHtml(text);
  text = text.replace(/`([^`\n]+)`/g, '<code class="inline-code">$1</code>');

  text = text.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  text = text.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  text = text.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  text = text.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  text = text.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");

  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");

  text = text.replace(/^(?:[-*]) (.*)$/gm, "<li>$1</li>");
  text = text.replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`);

  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (
        trimmed.startsWith("<h") ||
        trimmed.startsWith("<ul") ||
        trimmed.startsWith("<blockquote") ||
        trimmed.startsWith("@@CODE_BLOCK_")
      ) {
        return trimmed;
      }
      return `<p>${trimmed.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return paragraphs.replace(/@@CODE_BLOCK_(\d+)@@/g, (_, idxStr) => {
    const { language, code } = codeBlocks[Number(idxStr)];
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${escapeHtml(language)}</span>
          <button type="button" class="copy-code-btn" data-code="${escapeAttr(
            code
          )}">Copy</button>
        </div>
        <pre><code>${escapeHtml(code)}</code></pre>
      </div>
    `;
  });
}

function bindMessageActions() {
  els.messagesContainer.querySelectorAll(".copy-code-btn").forEach((btn) => {
    btn.onclick = () => {
      const code = btn.getAttribute("data-code") || "";
      navigator.clipboard.writeText(code);
      btn.textContent = "Copied";
      setTimeout(() => {
        btn.textContent = "Copy";
      }, 1500);
    };
  });

  els.messagesContainer.querySelectorAll(".copy-msg-btn").forEach((btn) => {
    btn.onclick = () => {
      const content = btn.getAttribute("data-content") || "";
      navigator.clipboard.writeText(content);
      showToast("Copied to clipboard");
    };
  });

  els.messagesContainer.querySelectorAll(".regen-msg-btn").forEach((btn) => {
    btn.onclick = () => {
      if (state.isStreaming) return;
      const userPills = els.messagesContainer.querySelectorAll(".user-pill");
      if (userPills.length === 0) return;
      const lastUserText = userPills[userPills.length - 1].innerText;
      if (lastUserText) {
        handleSendMessage(lastUserText);
      }
    };
  });
}

function bindEvents() {
  els.chatForm.addEventListener("submit", (e) => {
    e.preventDefault();
    handleSendMessage();
  });

  els.messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  });

  els.messageInput.addEventListener("input", autoResizeTextarea);

  els.stopStreamBtn.addEventListener("click", () => {
    state.abortController?.abort();
  });

  els.newChatBtn.addEventListener("click", () => {
    startNewChat();
    closeMobileSidebar();
  });

  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      startNewChat();
    }
  });

  els.historySearchInput.addEventListener("input", (e) => {
    state.searchQuery = e.target.value || "";
    renderConversationList();
  });

  els.clearHistoryBtn.addEventListener("click", async () => {
    if (state.conversations.length === 0) return;
    if (!window.confirm("Clear all conversation history?")) return;
    await fetch("/api/conversations", { method: "DELETE" });
    startNewChat();
    await fetchConversations();
    showToast("History cleared");
  });

  els.modelSelector.addEventListener("change", async (e) => {
    state.selectedModel = e.target.value;
    if (state.activeConversationId) {
      await fetch(`/api/conversations/${state.activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: state.selectedModel }),
      });
    }
    showToast(`Model: ${state.selectedModel}`);
  });

  els.toggleSidebarBtn.addEventListener("click", () => {
    if (window.innerWidth <= 780) {
      els.sidebar.classList.toggle("mobile-open");
      els.sidebarBackdrop.classList.toggle(
        "hidden",
        !els.sidebar.classList.contains("mobile-open")
      );
    } else {
      els.sidebar.classList.toggle("collapsed");
    }
  });

  els.sidebarBackdrop.addEventListener("click", closeMobileSidebar);
  els.themeToggleBtn.addEventListener("click", toggleTheme);
  els.exportChatBtn.addEventListener("click", exportCurrentConversation);

  els.openKeyModalBtn.addEventListener("click", openApiKeyModal);
  els.closeKeyModalBtn.addEventListener("click", closeApiKeyModal);
  els.cancelKeyModalBtn.addEventListener("click", closeApiKeyModal);

  els.apiKeyForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const key = els.backendApiKeyInput.value.trim();
    if (!key) return;

    const res = await fetch("/api/config/apikey", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: key }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      state.apiKeyConfigured = true;
      updateSecurityBadge();
      els.backendApiKeyInput.value = "";
      closeApiKeyModal();
      showToast("API key saved on backend");
    } else {
      showToast(data.error || "Failed to save key");
    }
  });

  els.openPersonaModalBtn.addEventListener("click", () => {
    els.systemInstructionInput.value = state.systemInstruction;
    els.personaModal.classList.remove("hidden");
  });
  els.closePersonaModalBtn.addEventListener("click", () =>
    els.personaModal.classList.add("hidden")
  );
  els.cancelPersonaModalBtn.addEventListener("click", () =>
    els.personaModal.classList.add("hidden")
  );

  document.querySelectorAll(".preset-tag").forEach((tag) => {
    tag.addEventListener("click", () => {
      els.systemInstructionInput.value =
        tag.getAttribute("data-instruction") || "";
    });
  });

  els.personaForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    state.systemInstruction = els.systemInstructionInput.value.trim();
    if (state.activeConversationId) {
      await fetch(`/api/conversations/${state.activeConversationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ systemInstruction: state.systemInstruction }),
      });
    }
    els.personaModal.classList.add("hidden");
    showToast("Persona updated");
  });
}

function openApiKeyModal() {
  els.apiKeyModal.classList.remove("hidden");
  els.backendApiKeyInput.focus();
}

function closeApiKeyModal() {
  els.apiKeyModal.classList.add("hidden");
}

function closeMobileSidebar() {
  els.sidebar.classList.remove("mobile-open");
  els.sidebarBackdrop.classList.add("hidden");
}

function autoResizeTextarea() {
  const el = els.messageInput;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 160) + "px";
}

function scrollToBottom() {
  els.chatViewport.scrollTop = els.chatViewport.scrollHeight;
}

function exportCurrentConversation() {
  const conv = state.activeConversation;
  if (!conv || !conv.messages || conv.messages.length === 0) {
    showToast("No messages to export");
    return;
  }

  const lines = [
    `# ${conv.title}`,
    `Model: ${conv.model || state.selectedModel}`,
    "",
    "---",
    "",
  ];

  for (const m of conv.messages) {
    const speaker = m.role === "user" ? "### User" : "### Nova AI";
    lines.push(speaker, "", m.content, "", "---", "");
  }

  const blob = new Blob([lines.join("\n")], {
    type: "text/markdown;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(conv.title || "chat")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}.md`;
  a.click();
  URL.revokeObjectURL(url);
  showToast("Exported as Markdown");
}

let toastTimer = null;
function showToast(msg) {
  els.toast.textContent = msg;
  els.toast.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.classList.add("hidden");
  }, 2500);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttr(str) {
  return escapeHtml(str);
}

init();
