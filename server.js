import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─── Database Setup ────────────────────────────────────────────────────────────
const db = new Database(path.join(__dirname, "chat_history.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id   TEXT PRIMARY KEY,
    title TEXT NOT NULL DEFAULT 'New Chat',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT    NOT NULL,
    role       TEXT    NOT NULL CHECK(role IN ('user','assistant')),
    content    TEXT    NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
  );
`);

// ─── Prepared statements ───────────────────────────────────────────────────────
const stmts = {
  allSessions: db.prepare(`
    SELECT s.id, s.title, s.updated_at,
           COUNT(m.id) AS message_count
    FROM sessions s
    LEFT JOIN messages m ON m.session_id = s.id
    GROUP BY s.id
    ORDER BY s.updated_at DESC
  `),
  getSession:   db.prepare("SELECT * FROM sessions WHERE id = ?"),
  insertSession: db.prepare("INSERT INTO sessions (id, title) VALUES (?, ?)"),
  updateTitle:  db.prepare("UPDATE sessions SET title = ? WHERE id = ?"),
  touchSession: db.prepare("UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?"),
  deleteSession: db.prepare("DELETE FROM sessions WHERE id = ?"),
  getMessages:  db.prepare("SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"),
  insertMsg:    db.prepare("INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)"),
  msgCount:     db.prepare("SELECT COUNT(*) AS c FROM messages WHERE session_id = ?"),
};

// ─── Express Setup ─────────────────────────────────────────────────────────────
const app = express();

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });

app.use(cors());
app.use(limiter);
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// ─── Health check ──────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => res.send("🚀 LAW AI Server is running"));

// ══════════════════════════════════════════════════════════════════════════════
//  CHAT HISTORY API
// ══════════════════════════════════════════════════════════════════════════════

// GET  /api/sessions          → list all sessions
app.get("/api/sessions", (_req, res) => {
  res.json(stmts.allSessions.all());
});

// GET  /api/sessions/:id      → session + its messages
app.get("/api/sessions/:id", (req, res) => {
  const session = stmts.getSession.get(req.params.id);
  if (!session) return res.status(404).json({ error: "Session not found" });
  const messages = stmts.getMessages.all(req.params.id);
  res.json({ session, messages });
});

// POST /api/sessions          → create new session
app.post("/api/sessions", (req, res) => {
  const id = randomUUID();
  const title = (req.body.title || "New Chat").slice(0, 80);
  stmts.insertSession.run(id, title);
  res.json({ id, title });
});

// PATCH /api/sessions/:id     → rename session
app.patch("/api/sessions/:id", (req, res) => {
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: "title required" });
  stmts.updateTitle.run(title.slice(0, 80), req.params.id);
  res.json({ success: true });
});

// DELETE /api/sessions/:id    → delete session + messages
app.delete("/api/sessions/:id", (req, res) => {
  stmts.deleteSession.run(req.params.id);
  res.json({ success: true });
});

// POST /api/sessions/:id/messages  → save a message
app.post("/api/sessions/:id/messages", (req, res) => {
  const { role, content } = req.body;
  if (!role || !content) return res.status(400).json({ error: "role and content required" });

  // Auto-create session if missing
  const exists = stmts.getSession.get(req.params.id);
  if (!exists) {
    const title = role === "user" ? content.slice(0, 60) : "New Chat";
    stmts.insertSession.run(req.params.id, title);
  } else {
    // Set title from first user message
    const count = stmts.msgCount.get(req.params.id).c;
    if (count === 0 && role === "user") {
      stmts.updateTitle.run(content.slice(0, 60), req.params.id);
    }
  }

  stmts.insertMsg.run(req.params.id, role, content);
  stmts.touchSession.run(req.params.id);
  res.json({ success: true });
});

// ══════════════════════════════════════════════════════════════════════════════
//  GEMINI AI CHAT
// ══════════════════════════════════════════════════════════════════════════════

app.post("/api/chat", async (req, res) => {
  const { message, sessionId } = req.body;

  if (!message || typeof message !== "string" || message.length > 500) {
    return res.status(400).json({ error: "Invalid input" });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("Missing API Key");
      return res.status(500).json({ reply: "Server configuration error." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `You are an expert Indian Legal AI Assistant. Respond ONLY with valid JSON — no markdown fences, no extra text, just raw JSON.

Return exactly this structure:
{
  "category": ["Legal area name — one-line description"],
  "laws": ["Act/Section number — brief explanation", "another law if relevant"],
  "illegal": ["Yes or No — concise reason under Indian law"],
  "rights": ["Right 1 — one short sentence", "Right 2 — one short sentence"],
  "action": ["Step 1 — short actionable instruction", "Step 2", "Step 3"]
}

Rules:
- Each array item: max 15 words, clear and simple
- laws: cite specific sections (e.g. BNS 318, Art. 21, Sec 134 MV Act)
- rights: what the person is legally entitled to
- action: practical steps in order of priority
- Indian law context only

User Query: ${message}`
                }
              ]
            }
          ]
        })
      }
    );

    const data = await response.json();

    if (!response.ok || !data.candidates) {
      console.error("API Error:", data);
      return res.status(response.status || 500).json({
        reply: data.error?.message || "Failed to generate response"
      });
    }

    const reply = data.candidates[0]?.content?.parts[0]?.text || "No response from AI";

    // ── Auto-save to DB if sessionId provided ──────────────────────────────
    if (sessionId) {
      // Save user message
      const exists = stmts.getSession.get(sessionId);
      if (!exists) {
        stmts.insertSession.run(sessionId, message.slice(0, 60));
      } else {
        const count = stmts.msgCount.get(sessionId).c;
        if (count === 0) stmts.updateTitle.run(message.slice(0, 60), sessionId);
      }
      stmts.insertMsg.run(sessionId, "user", message);
      stmts.insertMsg.run(sessionId, "assistant", reply);
      stmts.touchSession.run(sessionId);
    }

    res.json({ reply });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ reply: "Server error occurred while connecting to AI." });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});