import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import Groq from "groq-sdk";
import { initVectorStore } from "./prepare.js";

const app = express();
const port = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// =====================
// CONFIG
// =====================

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// 🔥 IMPORTANT: change this to your FRONTEND URL
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://genai-1-4oxq.onrender.com"
];

// =====================
// MIDDLEWARE
// =====================

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true
}));

app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// =====================
// MEMORY SYSTEM
// =====================

function loadMemory() {
  if (!fs.existsSync("memory.json")) {
    fs.writeFileSync("memory.json", "{}");
    return {};
  }
  return JSON.parse(fs.readFileSync("memory.json", "utf-8"));
}

function saveMemory(memory) {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

let conversationMemories = loadMemory();

// =====================
// ROUTES
// =====================

// Health check
app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

// API info
app.get("/api/chat", (req, res) => {
  res.json({
    message: "Use POST /api/chat with { message, threadId }"
  });
});

// CHAT API
app.post("/api/chat", async (req, res) => {
  const { message, threadId } = req.body;

  if (!message || !threadId) {
    return res.status(400).json({
      message: "message and threadId are required"
    });
  }

  if (!process.env.GROQ_API_KEY) {
    return res.status(500).json({
      message: "Missing GROQ_API_KEY"
    });
  }

  try {
    // init memory
    if (!conversationMemories[threadId]) {
      conversationMemories[threadId] = [];
    }

    // vector search
    const vectorStore = await initVectorStore();
    const relevantChunks = await vectorStore.similaritySearch(message, 3);

    const context = relevantChunks
      .map(c => c.pageContent)
      .join("\n\n");

    const SYSTEM_PROMPT = `
You are a helpful AI assistant.
Use context if relevant.
Keep answers clear and short.
`;

    const userQuery = `
Question: ${message}
Context:
${context}
Answer:
`;

    // store user message
    conversationMemories[threadId].push({
      role: "user",
      content: userQuery
    });

    // call Groq
    const completion = await groq.chat.completions.create({
      model: "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        ...conversationMemories[threadId]
      ],
    });

    const reply = completion.choices[0].message.content;

    // store assistant reply
    conversationMemories[threadId].push({
      role: "assistant",
      content: reply
    });

    saveMemory(conversationMemories);

    return res.json({ message: reply });

  } catch (err) {
    console.error("Chat error:", err);

    return res.status(500).json({
      message: "Internal server error"
    });
  }
});

// =====================
// STATIC FRONTEND
// =====================

app.use(express.static(path.join(__dirname, "frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});



app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});