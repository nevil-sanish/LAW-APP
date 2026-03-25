import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import rateLimit from "express-rate-limit";

dotenv.config();

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

app.use(cors());
app.use(limiter);
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Health check (important for Render)
app.get("/", (req, res) => {
  res.send("🚀 LAW AI Server is running");
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

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
        headers: {
          "Content-Type": "application/json"
        },
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

    const reply =
      data.candidates[0]?.content?.parts[0]?.text ||
      "No response from AI";

    res.json({ reply });

  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({
      reply: "Server error occurred while connecting to AI."
    });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});