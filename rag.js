/**
 * Implementation plan
 * Stage 1: Indexing
 * 1. load the document - pdf,txt - completed in prepare.js
 * 2. chunk the document- completed in prepare.js
 * 3. vector embeddings for each chunk-
 * 4. store the embeddings in a vector database
 * 
 * Stage 2: using the chatbot
 * 1. Setup LLM
 * 2. Add retrival step
 * 3. Pass input + relevant information to LLM
 * 4. congratulations you have built a chatbot
 */

import { indexTheDocument } from "./prepare.js";

const filePath = "./Company_chatbot.pdf";

async function run() {
  try {
    await indexTheDocument(filePath);
    console.log("Indexing completed");
  } catch (err) {
    console.error("Indexing failed:", err.message);
  }
}

// Run only when explicitly called
run();