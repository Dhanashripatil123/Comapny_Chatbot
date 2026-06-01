import readline from 'node:readline/promises';
import Groq from "groq-sdk";
import { vectorStore } from './prepare.js';
import fs from "fs";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
 
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

    while (true) {

        const questions = await rl.question('You: ');

        if (questions === '/bye') {
            break;
        }

        const relevantChunks = await vectorStore.similaritySearch(questions, 3);

        const context = relevantChunks
            .map(chunk => chunk.pageContent)
            .join('\n\n');

        const SYSTEM_PROMPT = `
You are a helpful assistant.


`;

        const userQuery = `
Question: ${questions}
Relevant Context: ${context}
Answer:
`;

        conversationHistory.push({
            role: "user",
            content: userQuery
        });

        const completion = await groq.chat.completions.create({
            model: "openai/gpt-oss-20b",
            messages: [
                { role: "system", content: SYSTEM_PROMPT },
                ...conversationHistory
            ],
        });

        const reply = completion.choices[0].message.content;

        console.log(`Assistant: ${reply}`);

        conversationHistory.push({
            role: "assistant",
            content: reply
        });

        saveMemory(conversationHistory);
    }

    rl.close();
}

chat();
