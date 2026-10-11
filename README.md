# ✨ Shivam AI — Personal Chat Assistant

![License: MIT](https://img.shields.io/badge/License-MIT-0d9488.svg)
![Node.js](https://img.shields.io/badge/Node.js-v20%2B-10b981.svg)
![Gemini API](https://img.shields.io/badge/Gemini_3.8-Interactions_API-6366f1.svg)

A minimal, fluid, full-stack **AI Chat Assistant** built with **Node.js + Express** and the official **Google GenAI SDK (`@google/genai`)**.

---

## 🌟 Features

- **Minimal, Non-Boxy UI**: Clean Warm Alabaster (Light) & Velvet Slate (Dark) themes, open canvas typography, Markdown & code block copy buttons, and responsive mobile drawer.
- **Real-Time Streaming Responses**: Server-Sent Events (`POST /api/chat/stream`) streaming live `step.delta` tokens with a typing indicator and Stop control.
- **Persistent Conversation History**: Multi-turn context chained via `previous_interaction_id` on the server plus local JSON persistence (`data/conversations.json`), search, rename, delete, and `.md` export.
- **Smart Prompt Suggestions**: One-click starter pills on the welcome screen for Hinglish learning, coding, SaaS strategy, and interview prep.
- **Backend API Key Security**: Your `GEMINI_API_KEY` stays strictly on the backend (`.env`) and is never exposed to the browser or committed to Git.

---

## 🚀 Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure your Backend API Key:**
   ```bash
   cp .env.example .env
   ```
   Add your `GEMINI_API_KEY` inside `.env` (or use the **Backend Key** button in the bottom-left sidebar of the app).

3. **Run the server:**
   ```bash
   npm start
   ```
   Open **http://localhost:3000** in your browser.

---

## 📄 License

Distributed under the **MIT License**. See [`LICENSE`](./LICENSE) for full details.
Copyright © 2026 **Shivam (`shivam1220-yu`)**.
