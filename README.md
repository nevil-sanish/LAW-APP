# ⚖️ LexAI – Indian Legal Assistant

> AI-powered legal assistant that simplifies Indian law into clear, actionable insights.

---

## 🚀 Overview

LexAI is a lightweight AI-powered legal assistant designed to help users understand Indian laws in a simple and structured way.

Users can ask legal questions in natural language and receive:
- Applicable laws 📜
- Legal category 📁
- Rights 🛡️
- Suggested actions ✅

---

## ✨ Features

- 🤖 **AI Legal Chatbot** — Natural language queries with context-aware responses
- 🇮🇳 **Indian Law Focus** — Tailored responses based on the Indian legal system
- 📌 **Structured Output** — Category, Laws, Legality, Rights, Recommended Actions
- 💾 **Chat History** — All conversations saved locally with SQLite; browse, search & reload past chats
- ⚡ **Fast & Lightweight** — No heavy frontend frameworks; vanilla JS + Express

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| Backend | Node.js, Express.js |
| AI | Gemini 2.5 Flash (Google Generative AI) |
| Database | SQLite (`better-sqlite3`) |
| Frontend | HTML, CSS, Vanilla JavaScript |
| Other | dotenv, CORS, express-rate-limit |

---

## 📁 Project Structure

```
LAW-APP/
├── server.js          ← Express server + Gemini API + Chat History API
├── package.json
├── .env               ← Add your GEMINI_API_KEY here (not committed)
├── .gitignore
├── chat_history.db    ← Auto-created SQLite database (not committed)
└── public/
    └── index.html     ← Full frontend (sidebar + chat UI)
```

---

## ⚡ Quick Start

```bash
# 1. Clone & install
git clone https://github.com/your-fork/LAW-APP.git
cd LAW-APP
npm install

# 2. Add your Gemini API key
echo "GEMINI_API_KEY=your_key_here" > .env

# 3. Start the server
npm start
# → http://localhost:3000
```

---

## 🛢️ Database Schema

```sql
sessions (
  id          TEXT PRIMARY KEY,   -- UUID
  title       TEXT,               -- Auto-set from first message
  created_at  DATETIME,
  updated_at  DATETIME
)

messages (
  id          INTEGER PRIMARY KEY,
  session_id  TEXT,               -- FK → sessions.id
  role        TEXT,               -- 'user' | 'assistant'
  content     TEXT,
  created_at  DATETIME
)
```

---

## 🔌 Chat History API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sessions` | All sessions |
| GET | `/api/sessions/:id` | Session + messages |
| POST | `/api/sessions` | Create session |
| POST | `/api/sessions/:id/messages` | Add message |
| PATCH | `/api/sessions/:id` | Rename session |
| DELETE | `/api/sessions/:id` | Delete session |

---

## 📸 Chat History Features

- 📅 Groups chats by Today / Yesterday / This Week / Older
- 🔍 Search/filter past conversations
- ✏️ Rename any conversation inline
- 🗑️ Delete conversations
- 🔄 Click any past chat to reload it
- ⚡ Auto-titles sessions from the first message
- 💡 Suggestion chips on the beginning screen

---

## ⚠️ Disclaimer

LexAI provides **general legal information only**, not professional legal advice. For specific legal matters, consult a qualified lawyer.