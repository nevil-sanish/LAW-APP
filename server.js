import express from "express";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const PORT = process.env.PORT || 3000;

// Health check (important for Render)
app.get("/", (req, res) => {
  res.send("🚀 LAW AI Server is running");
});

app.post("/api/chat", async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ reply: "Please provide a message." });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error("Missing API Key");
      return res.status(500).json({ reply: "Server configuration error." });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
                  text: `You are a friendly Indian Legal AI Assistant. Explain legal matters in simple language.

Give SHORT bullet points:

📁 Legal Category:
📜 Applicable Laws:
❓ Is this illegal?:
🛡️ Your Rights:
✅ What you should do:

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