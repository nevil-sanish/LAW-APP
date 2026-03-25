import express from "express"
import dotenv from "dotenv"
import cors from "cors"
import rateLimit from "express-rate-limit"
import sqlite3 from "sqlite3"
import { randomUUID } from "crypto"
import { fileURLToPath } from "url"
import path from "path"

dotenv.config()

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const db = new sqlite3.Database(path.join(__dirname, "chat_history.db"))

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    title TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)

  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT,
    role TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`)
})

const app = express()

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })

app.use(cors())
app.use(limiter)
app.use(express.json())
app.use(express.static("public"))

const PORT = process.env.PORT || 3000

app.get("/health", (_req, res) => {
  res.send("🚀 LAW AI Server is running")
})

app.get("/api/sessions", (_req, res) => {
  db.all(`SELECT * FROM sessions ORDER BY updated_at DESC`, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json(rows)
  })
})

app.get("/api/sessions/:id", (req, res) => {
  db.get(`SELECT * FROM sessions WHERE id = ?`, [req.params.id], (err, session) => {
    if (err) return res.status(500).json({ error: err.message })
    if (!session) return res.status(404).json({ error: "Session not found" })

    db.all(`SELECT * FROM messages WHERE session_id = ?`, [req.params.id], (err, messages) => {
      if (err) return res.status(500).json({ error: err.message })
      res.json({ session, messages })
    })
  })
})

app.post("/api/sessions", (req, res) => {
  const id = randomUUID()
  const title = (req.body.title || "New Chat").slice(0, 80)

  db.run(`INSERT INTO sessions (id, title) VALUES (?, ?)`, [id, title], (err) => {
    if (err) return res.status(500).json({ error: err.message })
    res.json({ id, title })
  })
})

app.post("/api/sessions/:id/messages", (req, res) => {
  const { role, content } = req.body

  db.run(
    `INSERT INTO messages (session_id, role, content) VALUES (?, ?, ?)`,
    [req.params.id, role, content],
    (err) => {
      if (err) return res.status(500).json({ error: err.message })

      db.run(
        `UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [req.params.id]
      )

      res.json({ success: true })
    }
  )
})

app.post("/api/chat", async (req, res) => {
  const { message } = req.body

  try {
    const apiKey = process.env.GEMINI_API_KEY

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: message }]
            }
          ]
        })
      }
    )

    const data = await response.json()
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response"

    res.json({ reply })

  } catch (err) {
    res.status(500).json({ error: "Server error" })
  }
})

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`)
})