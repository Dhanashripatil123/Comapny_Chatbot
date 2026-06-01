document.addEventListener("DOMContentLoaded", () => {
  const input = document.querySelector("#input");
  const chatContainer = document.querySelector("#chatcontainer");
  const askBtn = document.querySelector("#ask");

  const threadId =
    Date.now().toString(36) + Math.random().toString(36).substr(2);

  let isGenerating = false;

  askBtn.addEventListener("click", handleAsk);
  input.addEventListener("keyup", handleEnter);

  function scrollBottom() {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  function createUserMessage(text) {
    chatContainer.innerHTML += `
      <div class="text-right mb-4">
        <span class="bg-blue-600 px-4 py-2 rounded-lg inline-block">${text}</span>
      </div>`;
  }

  function createBotMessage(text) {
    chatContainer.innerHTML += `
      <div class="text-left mb-4">
        <span class="bg-gray-700 px-4 py-2 rounded-lg inline-block">
          ${marked.parse(text)}
        </span>
      </div>`;
  }

  function showLoader() {
    chatContainer.innerHTML += `
      <div id="loader" class="text-left mb-4">
        <span class="bg-gray-700 px-4 py-2 rounded-lg">Thinking...</span>
      </div>`;
  }

  function removeLoader() {
    document.getElementById("loader")?.remove();
  }

  async function callServer(message) {
    if (!window.API_URL) {
      throw new Error("API_URL not defined");
    }

    const response = await fetch("https://genai-tsy7.onrender.com/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Server error");
    }

    return data.message;
  }

  async function generate(text) {
    if (isGenerating) return;

    isGenerating = true;

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
      createBotMessage("❌ " + err.message);
    }

    scrollBottom();
    isGenerating = false;
  }

  async function handleAsk() {
    const text = input.value.trim();
    if (!text) return;
    await generate(text);
  }

  function handleEnter(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  }
});