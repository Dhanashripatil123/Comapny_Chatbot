// Frontend script for Company Chatbot
// Handles user input, sends messages to backend, and displays responses dynamically

const input = document.querySelector("#input");
const chatContainer = document.querySelector("#chatcontainer");
const askBtn = document.querySelector("#ask");

// Generate a unique thread ID for this conversation session
const threadId = Date.now().toString(36) + Math.random().toString(36).substr(2);

let isGenerating = false;

// Event listeners
input.addEventListener("keyup", handleEnter);
askBtn.addEventListener("click", handleAsk);

// Scroll to bottom of chat container
function scrollBottom() {
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

// Create and append user message to chat
function createUserMessage(text) {
  const div = document.createElement("div");
  div.className = "text-right mb-4";
  div.innerHTML = `<span class="bg-blue-600 px-4 py-2 rounded-lg inline-block max-w-xs break-words">${text}</span>`;
  chatContainer.appendChild(div);
}

// Create and append bot message to chat (with markdown support)
function createBotMessage(text) {
  const div = document.createElement("div");
  div.className = "text-left mb-4";
  div.innerHTML = `<span class="bg-gray-700 px-4 py-2 rounded-lg inline-block max-w-2xl break-words">${marked.parse(text)}</span>`;
  chatContainer.appendChild(div);
}

// Show loading animation
function showLoader() {
  const div = document.createElement("div");
  div.id = "loader";
  div.className = "text-left mb-4";
  div.innerHTML = `<span class="bg-gray-700 px-4 py-2 rounded-lg inline-block"> Thinking...</span>`;
  chatContainer.appendChild(div);
}

// Remove loading animation
function removeLoader() {
  const loader = document.getElementById("loader");
  if (loader) loader.remove();
}

// Send message to server
async function callServer(message) {
  const response = await fetch("https://genai-tsy7.onrender.com", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadId, message })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || "Server error");
  }

  const data = await response.json();
  return data.message;
}

// Handle message generation
async function generate(text) {
  createUserMessage(text);
  input.value = "";
  showLoader();
  scrollBottom();

  try {
    const reply = await callServer(text);
    removeLoader();
    createBotMessage(reply);
  } catch (err) {
    removeLoader();
    createBotMessage("❌ Error: " + err.message);
  }

  scrollBottom();
}

// Handle send button click
async function handleAsk() {
  if (isGenerating) return;

  const text = input.value.trim();
  if (!text) return;

  isGenerating = true;
  await generate(text);
  isGenerating = false;
}

// Handle Enter key press
async function handleEnter(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    await handleAsk();
  }
}