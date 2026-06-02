import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
import { initVectorStore } from "./prepare.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

if (!process.env.GOOGLE_API_KEY) {
  console.warn(
    "Warning: GOOGLE_API_KEY is not set. Google Generative AI calls will fail."
  );
}

const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://genai-1-4oxq.onrender.com",
  "https://genai-tsy7.onrender.com",
  ...(process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS
        .split(",")
        .map((u) => u.trim())
        .filter(Boolean)
    : []),
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

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

// ======================
// ROUTES
// ======================

app.get("/", (req, res) => {
  res.send("Backend is running 🚀");
});

app.get("/api/chat", (req, res) => {
  res.json({
    message: "Use POST /api/chat with { message, threadId }",
  });
});

app.post("/api/chat", async (req, res) => {
  const { message, threadId } = req.body;

  if (!message || !threadId) {
    return res.status(400).json({
      message: "message and threadId are required",
    });
  }

  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({
      message: "Missing GOOGLE_API_KEY",
    });
  }

  try {
    if (!conversationMemories[threadId]) {
      conversationMemories[threadId] = [];
    }

    let vectorStore;

    try {
      vectorStore = await initVectorStore();
    } catch (err) {
      console.error(
        "Vector store initialization failed:",
        err?.message || err
      );

      return res.status(500).json({
        message: "Vector store initialization failed",
      });
    }

    const relevantChunks = await vectorStore.similaritySearch(message, 3);

    const context = relevantChunks
      .map((chunk) => chunk.pageContent)
      .join("\n\n");

    const SYSTEM_PROMPT = `
You are a helpful AI assistant.
Use the provided context if relevant.
Keep answers clear, accurate, and concise.
`;

    const userQuery = `
Question:
${message}

Relevant Context:
${context}

Answer:
`;

    conversationMemories[threadId].push({
      role: "user",
      content: userQuery,
    });

    const prompt = `
${SYSTEM_PROMPT}

${conversationMemories[threadId]
  .map((msg) => `${msg.role}: ${msg.content}`)
  .join("\n\n")}
`;

    let reply = "";

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      reply = response.text || "";
    } catch (err) {
      console.error(
        "Gemini completion error:",
        err?.message || err
      );

      return res.status(502).json({
        message: "AI completion failed",
      });
    }

    conversationMemories[threadId].push({
      role: "assistant",
      content: reply,
    });

    saveMemory(conversationMemories);

    return res.json({
      message: reply,
    });
  } catch (err) {
    console.error("Chat error:", err);

    return res.status(500).json({
      message: "Internal server error",
    });
  }
});

// ======================
// STATIC FRONTEND
// ======================

app.use(express.static(path.join(__dirname, "frontend")));

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "frontend", "index.html"));
});



app.use((err, req, res, next) => {
  if (err?.message?.includes("CORS")) {
    return res.status(403).json({
      message: "CORS origin denied",
    });
  }

  next(err);
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);

  res.status(err?.status || 500).json({
    message: err?.message || "Internal server error",
  });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});