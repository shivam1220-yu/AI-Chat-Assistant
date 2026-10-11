import "dotenv/config";
import express from "express";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const IS_VERCEL = Boolean(process.env.VERCEL);

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Data directory: use /tmp on Vercel (serverless read-only root) or ./data locally
const DATA_DIR = IS_VERCEL
  ? path.join(os.tmpdir(), "nova-ai-data")
  : path.join(__dirname, "data");
const CONVERSATIONS_FILE = path.join(DATA_DIR, "conversations.json");

try {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  console.warn("Using in-memory fallback for conversation store:", err.message);
}

let memoryConversations = [];

// Supported current Gemini models
const ALLOWED_MODELS = new Set([
  "gemini-3.8-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.1-pro-preview",
  "gemini-3.1-flash-lite",
]);
const DEFAULT_MODEL = "gemini-3.8-flash";

const DEFAULT_SYSTEM_INSTRUCTION =
  "You are Shivam AI, a warm, intelligent, and helpful AI assistant. Reply naturally in the language/style the user uses (English, Hindi, or Hinglish). Keep explanations clear, conversational, and well-structured using Markdown when helpful.";

// Clean, Minimal Starter Prompt Suggestions
const PROMPT_SUGGESTIONS = [
  {
    id: "daily-chat",
    label: "✨ Hinglish mein AI Agents samjhao",
    prompt:
      "Mujhe simple aur interesting Hinglish mein samjhao ki AI Agents kaise kaam karte hain aur normal chatbot se kaise alag hote hain?",
  },
  {
    id: "code-api",
    label: "💻 Clean Node.js + JWT Auth code",
    prompt:
      "Write a clean, minimal Node.js Express authentication middleware using JWT with a practical example.",
  },
  {
    id: "productivity",
    label: "🚀 Solo Developer SaaS Idea & Plan",
    prompt:
      "Suggest 3 practical micro-SaaS ideas I can build in 2 weeks as a full-stack developer, and outline the tech stack.",
  },
  {
    id: "interview",
    label: "🎯 Top React & JS Interview Questions",
    prompt:
      "Give me 5 important JavaScript & React interview questions with short, crisp answers and code snippets.",
  },
  {
    id: "writing",
    label: "✍️ Professional LinkedIn Post",
    prompt:
      "Write an engaging, non-cringe LinkedIn post about building an AI chat assistant with streaming responses.",
  },
];

function loadConversations() {
  try {
    if (!fs.existsSync(CONVERSATIONS_FILE)) {
      return memoryConversations;
    }
    const raw = fs.readFileSync(CONVERSATIONS_FILE, "utf8");
    const parsed = JSON.parse(raw);
    memoryConversations = Array.isArray(parsed) ? parsed : [];
    return memoryConversations;
  } catch {
    return memoryConversations;
  }
}

function saveConversations(conversations) {
  memoryConversations = conversations;
  try {
    fs.writeFileSync(
      CONVERSATIONS_FILE,
      JSON.stringify(conversations, null, 2),
      "utf8"
    );
  } catch {
    // Fallback to memoryConversations on read-only environments
  }
}

function getGenAIClient() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === "your_gemini_api_key_here") {
    return null;
  }
  return new GoogleGenAI({ apiKey });
}

function isApiKeyConfigured() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  return Boolean(apiKey && apiKey !== "your_gemini_api_key_here");
}

// 1. Health & Security Status Endpoint
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    apiKeyConfigured: isApiKeyConfigured(),
    defaultModel: DEFAULT_MODEL,
  });
});

// Write-only endpoint to update backend .env API key
app.post("/api/config/apikey", (req, res) => {
  const { apiKey } = req.body || {};
  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return res.status(400).json({
      error: "Please provide a valid Gemini API key.",
    });
  }

  const cleanKey = apiKey.trim();
  process.env.GEMINI_API_KEY = cleanKey;

  try {
    if (!IS_VERCEL) {
      const envPath = path.join(__dirname, ".env");
      let envContent = "";
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, "utf8");
        if (/^GEMINI_API_KEY=/m.test(envContent)) {
          envContent = envContent.replace(
            /^GEMINI_API_KEY=.*$/m,
            `GEMINI_API_KEY=${cleanKey}`
          );
        } else {
          envContent += `\nGEMINI_API_KEY=${cleanKey}\n`;
        }
      } else {
        envContent = `GEMINI_API_KEY=${cleanKey}\nPORT=${PORT}\n`;
      }
      fs.writeFileSync(envPath, envContent, { encoding: "utf8", mode: 0o600 });
    }
    return res.json({
      success: true,
      apiKeyConfigured: true,
      message: "API key securely saved on backend.",
    });
  } catch {
    return res.json({
      success: true,
      apiKeyConfigured: true,
      message: "API key set in backend memory.",
    });
  }
});

// 2. Prompt Suggestions Endpoint
app.get("/api/prompts", (_req, res) => {
  res.json({ suggestions: PROMPT_SUGGESTIONS });
});

// 3. Conversation History Endpoints
app.get("/api/conversations", (_req, res) => {
  const conversations = loadConversations();
  const summaries = conversations
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map((conv) => ({
      id: conv.id,
      title: conv.title,
      model: conv.model || DEFAULT_MODEL,
      createdAt: conv.createdAt,
      updatedAt: conv.updatedAt,
      messageCount: conv.messages?.length || 0,
      lastPreview:
        conv.messages?.length > 0
          ? conv.messages[conv.messages.length - 1].content.slice(0, 90)
          : "",
    }));
  res.json({ conversations: summaries });
});

app.get("/api/conversations/:id", (req, res) => {
  const conversations = loadConversations();
  const conv = conversations.find((c) => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found." });
  }
  res.json({ conversation: conv });
});

app.patch("/api/conversations/:id", (req, res) => {
  const { title, model, systemInstruction } = req.body || {};
  const conversations = loadConversations();
  const conv = conversations.find((c) => c.id === req.params.id);
  if (!conv) {
    return res.status(404).json({ error: "Conversation not found." });
  }

  if (typeof title === "string" && title.trim()) {
    conv.title = title.trim().slice(0, 80);
  }
  if (model && ALLOWED_MODELS.has(model)) {
    conv.model = model;
  }
  if (typeof systemInstruction === "string") {
    conv.systemInstruction =
      systemInstruction.trim() || DEFAULT_SYSTEM_INSTRUCTION;
  }
  conv.updatedAt = new Date().toISOString();
  saveConversations(conversations);
  res.json({ conversation: conv });
});

app.delete("/api/conversations/:id", (req, res) => {
  const conversations = loadConversations();
  const filtered = conversations.filter((c) => c.id !== req.params.id);
  saveConversations(filtered);
  res.json({ success: true });
});

app.delete("/api/conversations", (_req, res) => {
  saveConversations([]);
  res.json({ success: true });
});

// 4. Streaming Chat Endpoint using Gemini Interactions API (SSE)
app.post("/api/chat/stream", async (req, res) => {
  const {
    conversationId,
    message,
    model: requestedModel,
    systemInstruction: customSystemInstruction,
  } = req.body || {};

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message is required." });
  }

  const ai = getGenAIClient();
  if (!ai) {
    return res.status(401).json({
      error: "GEMINI_API_KEY is not configured on the backend.",
      code: "MISSING_API_KEY",
    });
  }

  // SSE Headers
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const sendSSE = (event, data) => {
    if (!res.writableEnded) {
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    }
  };

  const conversations = loadConversations();
  let conv = conversations.find((c) => c.id === conversationId);
  const now = new Date().toISOString();

  const selectedModel = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : conv?.model || DEFAULT_MODEL;

  if (!conv) {
    conv = {
      id: conversationId || crypto.randomUUID(),
      title: generateTitleFromMessage(message),
      model: selectedModel,
      systemInstruction:
        customSystemInstruction?.trim() || DEFAULT_SYSTEM_INSTRUCTION,
      lastInteractionId: null,
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
    conversations.unshift(conv);
  } else {
    conv.model = selectedModel;
    if (customSystemInstruction?.trim()) {
      conv.systemInstruction = customSystemInstruction.trim();
    }
    if (
      conv.messages.length === 0 &&
      (conv.title === "New Conversation" || !conv.title)
    ) {
      conv.title = generateTitleFromMessage(message);
    }
  }

  const userMsg = {
    id: crypto.randomUUID(),
    role: "user",
    content: message.trim(),
    timestamp: now,
  };
  conv.messages.push(userMsg);
  conv.updatedAt = now;
  saveConversations(conversations);

  sendSSE("conversation.meta", {
    conversationId: conv.id,
    title: conv.title,
    model: selectedModel,
    userMessageId: userMsg.id,
  });

  let clientAborted = false;
  res.on("close", () => {
    if (!res.writableEnded) {
      clientAborted = true;
    }
  });

  let accumulatedText = "";
  let accumulatedThought = "";
  let latestInteractionId = conv.lastInteractionId;
  let tokenUsage = null;

  try {
    const createStream = async (usePreviousId) => {
      const params = {
        model: selectedModel,
        input: message.trim(),
        system_instruction:
          conv.systemInstruction || DEFAULT_SYSTEM_INSTRUCTION,
        stream: true,
      };
      if (usePreviousId && conv.lastInteractionId) {
        params.previous_interaction_id = conv.lastInteractionId;
      }
      return ai.interactions.create(params);
    };

    let stream;
    try {
      stream = await createStream(true);
    } catch (firstErr) {
      if (conv.lastInteractionId) {
        stream = await createStream(false);
      } else {
        throw firstErr;
      }
    }

    for await (const event of stream) {
      if (clientAborted) {
        break;
      }

      if (event.event_type === "interaction.created") {
        if (event.interaction?.id) {
          latestInteractionId = event.interaction.id;
        }
        sendSSE("interaction.created", {
          interactionId: latestInteractionId,
          model: selectedModel,
        });
      } else if (event.event_type === "step.delta") {
        const delta = event.delta;
        if (delta?.type === "text" && delta.text) {
          accumulatedText += delta.text;
          sendSSE("step.delta", {
            deltaType: "text",
            text: delta.text,
          });
        } else if (delta?.type === "thought_summary") {
          const thoughtChunk = delta.content?.text || delta.text || "";
          if (thoughtChunk) {
            accumulatedThought += thoughtChunk;
            sendSSE("step.delta", {
              deltaType: "thought_summary",
              text: thoughtChunk,
            });
          }
        }
      } else if (event.event_type === "interaction.completed") {
        if (event.interaction?.id) {
          latestInteractionId = event.interaction.id;
        }
        if (event.interaction?.usage) {
          tokenUsage = event.interaction.usage;
        }
      } else if (event.event_type === "error") {
        throw new Error(
          event.error?.message || "Stream error occurred from Gemini API."
        );
      }
    }

    if (accumulatedText.trim() || !clientAborted) {
      const assistantMsg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content:
          accumulatedText ||
          "I couldn't generate a response. Please try again.",
        thoughtSummary: accumulatedThought || null,
        interactionId: latestInteractionId,
        usage: tokenUsage,
        model: selectedModel,
        timestamp: new Date().toISOString(),
      };

      const freshConversations = loadConversations();
      const targetConv = freshConversations.find((c) => c.id === conv.id);
      if (targetConv) {
        targetConv.messages.push(assistantMsg);
        if (latestInteractionId) {
          targetConv.lastInteractionId = latestInteractionId;
        }
        targetConv.updatedAt = new Date().toISOString();
        saveConversations(freshConversations);
      }

      sendSSE("interaction.completed", {
        conversationId: conv.id,
        title: conv.title,
        messageId: assistantMsg.id,
        interactionId: latestInteractionId,
        usage: tokenUsage,
      });
    }
  } catch (err) {
    console.error("Gemini Interactions stream error:", err);
    sendSSE("error", {
      message:
        err.message ||
        "Failed to generate response from Gemini API. Check your backend API key.",
    });
  } finally {
    if (!res.writableEnded) {
      res.end();
    }
  }
});

function generateTitleFromMessage(text) {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 38) return cleaned;
  return cleaned.slice(0, 38).trim() + "…";
}

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log(`\n✨ Shivam AI Assistant running at http://localhost:${PORT}`);
    console.log(
      `🔒 Backend GEMINI_API_KEY configured: ${isApiKeyConfigured() ? "YES ✅" : "NO ⚠️"}`
    );
  });
}

export default app;
