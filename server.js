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

const groq = new Groq({ apiKey: process.env.GOOGLE_API_KEY });

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

app.use(cors());
// additional explicit CORS headers for robustness
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});
app.use(express.json());
app.use(express.static(path.join(__dirname, 'frontend')));

// simple request logger to help debugging
app.use((req, res, next) => {
  console.log(new Date().toISOString(), req.method, req.path);
  next();
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
})

// Helpful GET handler so visiting /chat in a browser doesn't show "Cannot GET /chat".
app.get('/chat', (req, res) => {
  res.send('This endpoint accepts POST requests with JSON: {threadId, message}. Use the chat UI or POST to /chat');
});

app.post('/chat', async(req,res) => {
     const {message,threadId} = req.body;
    
     //todo: validate the field
     if(!message || !threadId){
       res.status(400).json({message:'all fields are required'}); 
      return;
     }
     
     console.log('message',message,"threadId",threadId);

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
       res.status(500).json({message:'Internal server error'});
     }
     
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`)
})