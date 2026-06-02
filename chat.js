import readline from 'node:readline/promises';
import { GoogleGenAI } from "@google/genai";
import { vectorStore } from './prepare.js';
import fs from "fs";

const ai = new GoogleGenAI({
  apiKey: process.env.GOOGLE_API_KEY,
});

console.log("Loaded:", process.env.GOOGLE_API_KEY?.slice(0, 4));

function loadMemory() {
  if (!fs.existsSync("memory.json")) {
    fs.writeFileSync("memory.json", "[]");
    return [];
  }

  const data = fs.readFileSync("memory.json", "utf-8");
  return JSON.parse(data);
}

function saveMemory(memory) {
  fs.writeFileSync("memory.json", JSON.stringify(memory, null, 2));
}

export async function chat() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  let conversationHistory = loadMemory();

  if (!process.env.GOOGLE_API_KEY) {
    throw new Error("GOOGLE_API_KEY is missing in environment variables");
  }

  while (true) {
    const question = await rl.question("You: ");

    if (question === "/bye") {
      break;
    }

    const relevantChunks = await vectorStore.similaritySearch(question, 3);

    const context = relevantChunks
      .map(chunk => chunk.pageContent)
      .join("\n\n");

    const SYSTEM_PROMPT = `
You are a helpful assistant.
Use the provided context when relevant.
If the answer is not in the context, answer using your general knowledge.
`;

    const userQuery = `
Question: ${question}

Relevant Context:
${context}

Answer:
`;

    conversationHistory.push({
      role: "user",
      content: userQuery
    });

    const conversationText = conversationHistory
      .map(msg => `${msg.role}: ${msg.content}`)
      .join("\n\n");

    const prompt = `
${SYSTEM_PROMPT}

${conversationText}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const reply = response.text;

      console.log(`Assistant: ${reply}`);

      conversationHistory.push({
        role: "assistant",
        content: reply
      });

      saveMemory(conversationHistory);

    } catch (error) {
      console.error("Gemini Error:", error);
    }
  }

  rl.close();
}

chat();