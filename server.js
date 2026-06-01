import express from 'express';
import cors from 'cors';  
import path from 'path';
import { fileURLToPath } from 'url';
import Groq from "groq-sdk";
import { vectorStore } from './prepare.js';
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port =  process.env.PORT || 3000;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY});

function loadMemory() {
    if (!fs.existsSync("memory.json")) {
        fs.writeFileSync("memory.json", "{}");
        return {};
    }
    const data = fs.readFileSync("memory.json", "utf-8");
    return JSON.parse(data);
}

function saveMemory(memory) {
    fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

let conversationMemories = loadMemory();

// CORS configuration: allow specific origins via ALLOWED_ORIGINS env var (comma-separated)
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,https://genai-1-4oxq.onrender.com').split(',').map(s => s.trim()).filter(Boolean);
app.use(cors({
  origin: function(origin, callback) {
    // allow non-browser or curl requests with no origin
    if (!origin) return callback(null, true);
    if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: 'GET,POST,PUT,DELETE,OPTIONS',
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// simple request logger to help debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.path);
  next();
});

// --- API routes (define before static files) ---

// Helpful GET handler so visiting /chat in a browser doesn't show "Cannot GET /chat".
app.get('/api/chat', (req, res) => {
  res.json({ message: 'This endpoint accepts POST requests with JSON: {threadId, message}. Use the chat UI or POST to /api/chat' });
});

app.post('/api/chat', async(req,res) => {
     const {message,threadId} = req.body;
    
     //todo: validate the field
     if(!message || !threadId){
       res.status(400).json({message:'all fields are required'}); 
      return;
     }
     
     console.log('message',message,"threadId",threadId);

     // Fail fast if API key is missing to avoid downstream HTML/errors
     if (!process.env.GROQ_API_KEY) {
       console.error('Missing GROQ_API_KEY in environment');
       return res.status(500).json({ message: 'Server misconfiguration: missing GROQ_API_KEY' });
     }

     try{
       if (!conversationMemories[threadId]) {
         conversationMemories[threadId] = [];
       }

       const relevantChunks = await vectorStore.similaritySearch(message, 3);
       const context = relevantChunks
         .map(chunk => chunk.pageContent)
         .join('\n\n');

       const SYSTEM_PROMPT = `
You are a helpful assistant.
Use the retrieved context if relevant.

`;

       const userQuery = `
Question: ${message}
Relevant Context: ${context}
Answer:
`;

       conversationMemories[threadId].push({
         role: "user",
         content: userQuery
       });

       const completion = await groq.chat.completions.create({
         model: "openai/gpt-oss-20b",
         messages: [
           { role: "system", content: SYSTEM_PROMPT },
           ...conversationMemories[threadId]
         ],
       });

       const reply = completion.choices[0].message.content;

       conversationMemories[threadId].push({
         role: "assistant",
         content: reply
       });

       saveMemory(conversationMemories);

       res.json({message: reply});
     }catch(err){
       console.error(err);
       // If upstream (Groq) returns auth error, forward a clear JSON message
       if (err && err.status === 401) {
         const upstreamMsg = err.error && err.error.error && err.error.error.message ? err.error.error.message : 'Invalid API Key';
         return res.status(502).json({ message: `Upstream error: ${upstreamMsg}` });
       }
       res.status(500).json({message:'Internal server error'});
     }
     
});

// Serve frontend static assets after API routes
app.use(express.static(path.join(__dirname, 'frontend')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// (duplicate POST /chat removed) - API is now exposed at POST /api/chat

const server = app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`, err);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Global error handler to ensure JSON responses for API routes
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  if (req.path && req.path.startsWith('/api') || req.path === '/chat') {
    return res.status(500).json({ message: 'Internal server error' });
  }
  next(err);
});