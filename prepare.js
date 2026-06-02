import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";
import { PineconeStore } from "@langchain/pinecone";
import { Pinecone as PineconeClient } from "@pinecone-database/pinecone";
import dotenv from "dotenv";

dotenv.config();


if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
  throw new Error("Missing Pinecone environment variables");
}

// Embeddings
const embeddings = new GoogleGenerativeAIEmbeddings({
  model: "gemini-embedding-001",
  dimensions: 3072,
});

// Optional test (safe wrapped)
async function testEmbedding() {
  try {
    const test = await embeddings.embedQuery("Hello world");
    console.log("Embedding length:", test.length);
  } catch (err) {
    console.error("Embedding test failed:", err.message);
  }
}
testEmbedding();

// Pinecone setup
const pinecone = new PineconeClient({
  apiKey: process.env.PINECONE_API_KEY,
});

const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME);

// ❌ FIX 2: avoid top-level await crash in some deployments
let vectorStore;

export async function initVectorStore() {
  if (!vectorStore) {
    vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
      maxConcurrency: 5,
    });
    console.log("Vector store initialized");
  }
  return vectorStore;
}

// Main indexing function
export async function indexTheDocument(filePath) {
  try {
    const loader = new PDFLoader(filePath, { splitPages: false });
    const doc = await loader.load();

    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 300,
      chunkOverlap: 100,
    });

    const texts = await textSplitter.splitText(doc[0].pageContent);
    console.log("Number of chunks:", texts.length);

    const documents = texts.map((chunk) => ({
      pageContent: chunk,
      metadata: doc[0].metadata,
    }));

    const store = await initVectorStore();
    await store.addDocuments(documents);

    console.log("Document indexed successfully");
  } catch (err) {
    console.error("Indexing error:", err.message);
  }
}