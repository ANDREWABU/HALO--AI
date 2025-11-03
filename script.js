// DOM Elements
const chatWindow = document.getElementById("chatWindow");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const newChatBtn = document.getElementById("newChatBtn");
const chatList = document.getElementById("chatList");
const welcomeMessage = document.querySelector(".welcome-message");

// Google Custom Search API Configuration
const GOOGLE_API_KEY = "AIzaSyBpZRIvAgL7lATHkleEaVTApuF1I6pflX4";
const GOOGLE_SEARCH_ENGINE_ID = "3450ef36f36ae4498";

// State
let currentChatId = null;
let chats = JSON.parse(localStorage.getItem("chats")) || {};

// Enhanced Conversation Memory
let conversationMemory = {
  userName: null,
  userMood: "neutral",
  userInterests: [],
  recentTopics: [],
  conversationDepth: 0,
  personalContext: {
    relationships: {},
    work: {},
    hobbies: [],
    challenges: [],
  },
};

// Initialize the app
function init() {
  const chatIds = Object.keys(chats);
  if (chatIds.length > 0) {
    currentChatId = chatIds[chatIds.length - 1];
    loadChat(currentChatId);
  } else {
    createNewChat();
  }

  renderChatList();

  sendBtn.addEventListener("click", sendMessage);
  userInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendMessage();
  });
  newChatBtn.addEventListener("click", createNewChat);
}

function createNewChat() {
  currentChatId = "chat_" + Date.now();
  chats[currentChatId] = {
    title: "New chat",
    messages: [],
    createdAt: new Date().toISOString(),
  };

  // Reset conversation memory
  conversationMemory = {
    userName: null,
    userMood: "neutral",
    userInterests: [],
    recentTopics: [],
    conversationDepth: 0,
    personalContext: {
      relationships: {},
      work: {},
      hobbies: [],
      challenges: [],
    },
  };

  saveChats();
  loadChat(currentChatId);
  renderChatList();
  userInput.focus();
}

function loadChat(chatId) {
  if (!chats[chatId]) return;
  currentChatId = chatId;
  const chat = chats[chatId];

  chatWindow.innerHTML = "";
  chat.messages.forEach((message) => {
    addMessage(message.text, message.isUser);
  });

  updateWelcomeMessage();
  scrollToBottom();
  updateActiveChat();
}

// Send a message
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  // Add user message
  addMessage(text, true);

  // Save to chat
  if (currentChatId && chats[currentChatId]) {
    chats[currentChatId].messages.push({
      text: text,
      isUser: true,
      timestamp: new Date().toISOString(),
    });

    if (chats[currentChatId].messages.length === 1) {
      chats[currentChatId].title =
        text.length > 20 ? text.substring(0, 20) + "..." : text;
      renderChatList();
    }
    saveChats();
  }

  userInput.value = "";
  updateWelcomeMessage();
  showTypingIndicator();

  // Update conversation memory
  updateConversationMemory(text);

  try {
    let response;

    // Check if it's a math question FIRST
    if (isMathQuestion(text)) {
      response = handleMathQuestion(text);
    }
    // Then check if it's a factual question for API
    else if (shouldUseAPI(text)) {
      response = await handleWithAPI(text);
    }
    // Finally, use conversation
    else {
      response = generateConversationResponse(text);
    }

    // Add realistic typing delay
    const typingTime = Math.max(800, Math.min(response.length * 15, 2000));
    setTimeout(() => {
      removeTypingIndicator();
      addMessage(response, false);
      saveBotMessage(response);
    }, typingTime);
  } catch (error) {
    removeTypingIndicator();
    const response = generateConversationResponse(text);
    addMessage(response, false);
    saveBotMessage(response);
  }
}

// Determine if we should use API for this question
function shouldUseAPI(text) {
  const lowerText = text.toLowerCase();

  const apiPatterns = [
    /^who is .+/i,
    /^what is .+/i,
    /^when was .+/i,
    /^where is .+/i,
    /^how does .+/i,
    /^why does .+/i,
    /^capital of .+/i,
    /^population of .+/i,
    /^president of .+/i,
    /^history of .+/i,
    /^define .+/i,
    /^meaning of .+/i,
    /^what are .+/i,
    /^how to .+/i,
    /^facts about .+/i,
  ];

  return apiPatterns.some((pattern) => pattern.test(lowerText));
}

// Determine if it's a math question - IMPROVED
function isMathQuestion(text) {
  const lowerText = text.toLowerCase().trim();

  // More specific math patterns to avoid false positives
  const mathPatterns = [
    /^\d+\s*[\+\-\*\/\^]\s*\d+$/, // Only numbers and operators
    /^calculate\s+\d+/i,
    /^solve\s+\d+/i,
    /^what is \d+\s*[\+\-\*\/]\s*\d+\??$/i, // Specific "what is X + Y" format
    /^square root of \d+/i,
    /^sqrt\(\d+\)$/i,
    /^\d+% of \d+$/i,
    /^area of/i,
    /^volume of/i,
    /^perimeter of/i,
    /^\d+\s*(?:\^|to the power of|raised to)\s*\d+$/i,
  ];

  // Also check if it's a simple arithmetic expression
  const simpleMath =
    /^[\d\s\+\-\*\/\^\.\(\)]+$/.test(text) &&
    /\d/.test(text) &&
    /[\+\-\*\/\^]/.test(text);

  return mathPatterns.some((pattern) => pattern.test(lowerText)) || simpleMath;
}

// Handle question with API
async function handleWithAPI(text) {
  try {
    const searchResult = await searchGoogle(text);
    if (searchResult && searchResult.length > 20) {
      const followUps = getFollowUpSuggestions(text);
      return searchResult + "\n\n" + "💡 " + followUps[0];
    } else {
      // Fallback to common knowledge or conversation
      return handleCommonQuestions(text) || smartFallback(text);
    }
  } catch (error) {
    return handleCommonQuestions(text) || smartFallback(text);
  }
}

// Handle common questions without API calls
function handleCommonQuestions(text) {
  const lowerText = text.toLowerCase();

  // Current facts (as of 2024)
  const commonKnowledge = {
    // Presidents
    "president of america":
      "Joe Biden is the 46th and current president of the United States (as of 2024).",
    "president of usa":
      "Joe Biden is the 46th and current president of the United States (as of 2024).",
    "president of united states":
      "Joe Biden is the 46th and current president of the United States (as of 2024).",
    "current president":
      "Joe Biden is the 46th and current president of the United States (as of 2024).",

    // Capitals
    "capital of usa": "Washington, D.C. is the capital of the United States.",
    "capital of america":
      "Washington, D.C. is the capital of the United States.",
    "capital of united states":
      "Washington, D.C. is the capital of the United States.",
    "capital of france": "Paris is the capital of France.",
    "capital of england":
      "London is the capital of England and the United Kingdom.",
    "capital of germany": "Berlin is the capital of Germany.",
    "capital of china": "Beijing is the capital of China.",
    "capital of japan": "Tokyo is the capital of Japan.",

    // Basic facts
    "population of earth":
      "The current world population is approximately 8.1 billion people (2024 estimates).",
    "largest country": "Russia is the largest country by land area.",
    "largest ocean": "The Pacific Ocean is the largest and deepest ocean.",
    "tallest mountain":
      "Mount Everest is the tallest mountain above sea level.",

    // Science
    "speed of light":
      "The speed of light in a vacuum is 299,792,458 meters per second.",
    "gravity on earth":
      "The acceleration due to gravity on Earth is approximately 9.8 m/s².",
    "planets in solar system":
      "There are 8 planets in our solar system: Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune.",

    // Math constants
    "value of pi": "Pi (π) is approximately 3.14159.",
    "value of e": "Euler's number (e) is approximately 2.71828.",
  };

  for (const [question, answer] of Object.entries(commonKnowledge)) {
    if (lowerText.includes(question)) {
      return answer;
    }
  }

  return null;
}

// ENHANCED: Math question handler - SIMPLIFIED
function handleMathQuestion(text) {
  const lowerText = text.toLowerCase().trim();

  try {
    // Clean the text for evaluation
    const cleanText = text.replace(/\?/g, "").trim();

    // Basic arithmetic - most common case
    const arithmeticMatch = cleanText.match(
      /^(\d+\.?\d*)\s*([\+\-\*\/\^])\s*(\d+\.?\d*)$/
    );
    if (arithmeticMatch) {
      const num1 = parseFloat(arithmeticMatch[1]);
      const num2 = parseFloat(arithmeticMatch[3]);
      const operator = arithmeticMatch[2];

      let result;
      switch (operator) {
        case "+":
          result = num1 + num2;
          break;
        case "-":
          result = num1 - num2;
          break;
        case "*":
          result = num1 * num2;
          break;
        case "/":
          result = num2 !== 0 ? num1 / num2 : "undefined (division by zero)";
          break;
        case "^":
          result = Math.pow(num1, num2);
          break;
        default:
          throw new Error("Unknown operator");
      }

      return `${num1} ${operator} ${num2} = ${result}`;
    }

    // Handle "what is X + Y" format
    const whatIsMatch = cleanText.match(
      /^what is (\d+\.?\d*)\s*([\+\-\*\/\^])\s*(\d+\.?\d*)$/i
    );
    if (whatIsMatch) {
      const num1 = parseFloat(whatIsMatch[1]);
      const num2 = parseFloat(whatIsMatch[3]);
      const operator = whatIsMatch[2];

      let result;
      switch (operator) {
        case "+":
          result = num1 + num2;
          break;
        case "-":
          result = num1 - num2;
          break;
        case "*":
          result = num1 * num2;
          break;
        case "/":
          result = num2 !== 0 ? num1 / num2 : "undefined (division by zero)";
          break;
        case "^":
          result = Math.pow(num1, num2);
          break;
        default:
          throw new Error("Unknown operator");
      }

      return `${num1} ${operator} ${num2} = ${result}`;
    }

    // Square root
    const sqrtMatch = text.match(
      /square root of (\d+\.?\d*)|sqrt\((\d+\.?\d*)\)/i
    );
    if (sqrtMatch) {
      const num = parseFloat(sqrtMatch[1] || sqrtMatch[2]);
      if (num >= 0) {
        return `√${num} = ${Math.sqrt(num)}`;
      } else {
        return `√${num} is not a real number`;
      }
    }

    // Percentage
    const percentMatch = text.match(
      /(\d+\.?\d*)% of (\d+\.?\d*)|what is (\d+\.?\d*)% of (\d+\.?\d*)/i
    );
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1] || percentMatch[3]);
      const number = parseFloat(percentMatch[2] || percentMatch[4]);
      const result = (percent / 100) * number;
      return `${percent}% of ${number} = ${result}`;
    }

    // If it's a simple math expression, try to evaluate it
    const simpleExpression = cleanText.match(/^[\d\s\+\-\*\/\^\.\(\)]+$/);
    if (
      simpleExpression &&
      /\d/.test(cleanText) &&
      /[\+\-\*\/\^]/.test(cleanText)
    ) {
      try {
        // Safe evaluation for simple math
        const result = eval(cleanText);
        if (typeof result === "number" && !isNaN(result)) {
          return `${cleanText} = ${result}`;
        }
      } catch (e) {
        // If eval fails, fall through
      }
    }

    return "I can help with basic math! Try asking something like:\n• '15 + 27'\n• 'Square root of 64'\n• '25% of 200'";
  } catch (error) {
    return "I had trouble solving that math problem. Could you rephrase it?";
  }
}

// ENHANCED: Better Google search function with top 3 results, context, and summary
async function searchGoogle(query) {
  try {
    // Don't search for simple math questions
    if (isMathQuestion(query)) {
      return null;
    }

    // Enrich query with context from conversationMemory
    let enrichedQuery = query;
    if (conversationMemory.userInterests.length > 0) {
      enrichedQuery += " " + conversationMemory.userInterests.join(" ");
    }
    if (
      conversationMemory.locationContext &&
      conversationMemory.locationContext.lastLocation
    ) {
      enrichedQuery += " " + conversationMemory.locationContext.lastLocation;
    }
    if (conversationMemory.recentTopics.length > 0) {
      enrichedQuery +=
        " " + conversationMemory.recentTopics.slice(-2).join(" ");
    }

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(
        enrichedQuery
      )}`
    );

    if (!response.ok) throw new Error("Search failed");

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      // Summarize top 3 results
      let summary = data.items
        .slice(0, 3)
        .map((item, idx) => {
          let cleanSnippet = item.snippet
            .replace(/Wikipedia/g, "")
            .replace(/\[\d+\]/g, "")
            .replace(/\.\.\./g, ".")
            .replace(/\s+/g, " ")
            .trim();
          const cleanTitle = item.title
            .replace(/ - Wikipedia$/, "")
            .replace(/\(Wikipedia\)/, "")
            .trim();
          return `${idx + 1}. ${cleanTitle}: ${cleanSnippet}`;
        })
        .join("\n\n");
      return summary;
    }
    return null;
  } catch (error) {
    console.error("Search error:", error);
    return null;
  }
}

function saveBotMessage(text) {
  if (currentChatId && chats[currentChatId]) {
    chats[currentChatId].messages.push({
      text: text,
      isUser: false,
      timestamp: new Date().toISOString(),
    });
    saveChats();
  }
}

// Add follow-up suggestions after answers
function getFollowUpSuggestions(userMessage) {
  const suggestions = [];
  if (shouldUseAPI(userMessage)) {
    suggestions.push("Would you like to know more details or related facts?");
  }
  if (isMathQuestion(userMessage)) {
    suggestions.push("Try another math problem or ask for an explanation.");
  }
  if (userMessage.toLowerCase().includes("news")) {
    suggestions.push(
      "Ask about a specific topic in the news or request world news."
    );
  }
  if (conversationMemory.userInterests.length > 0) {
    suggestions.push(
      `Want to know more about ${conversationMemory.userInterests[0]}?`
    );
  }
  if (suggestions.length === 0) {
    suggestions.push("Is there anything else you'd like to ask?");
  }
  return suggestions;
}

// Smarter fallback for unknowns
function smartFallback(userMessage) {
  const related = conversationMemory.recentTopics
    .filter((t) => t !== userMessage)
    .slice(-2);
  let msg = "I'm not sure about that. ";
  if (related.length > 0) {
    msg += `Earlier you mentioned: ${related.join(
      ", "
    )}. Want to continue on those topics?`;
  } else {
    msg += "Could you rephrase or ask about something else?";
  }
  return msg;
}

// SIMPLIFIED CONVERSATION RESPONSE GENERATOR
function generateConversationResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase().trim();

  // Don't respond to math questions in conversation mode
  if (isMathQuestion(userMessage)) {
    return handleMathQuestion(userMessage);
  }

  conversationMemory.conversationDepth++;

  // Update conversation memory with new information
  updateConversationMemory(userMessage);

  // === PERSONAL INFORMATION EXTRACTION ===
  if (!conversationMemory.userName) {
    const nameMatch = userMessage.match(
      /(?:my name is|i'm|i am|call me) ([a-zA-Z]{2,})/i
    );
    if (nameMatch) {
      conversationMemory.userName = nameMatch[1];
      return `Nice to meet you, ${conversationMemory.userName}! 😊 What would you like to know or talk about?`;
    }
  }

  // === EMOTION DETECTION & RESPONSE ===
  if (
    lowerMessage.match(
      /(sad|depressed|down|upset|unhappy|miserable|heartbroken)/
    )
  ) {
    conversationMemory.userMood = "sad";
    return `I'm really sorry you're feeling this way. 💙 Want to talk about what's bothering you?`;
  }

  if (
    lowerMessage.match(
      /(happy|excited|great|awesome|amazing|wonderful|thrilled)/
    )
  ) {
    conversationMemory.userMood = "happy";
    return `That's wonderful! 😄 I'm happy for you! What's making you feel so good?`;
  }

  // === GREETINGS ===
  if (lowerMessage.match(/^(hello|hi|hey|what's up|howdy)/)) {
    if (conversationMemory.userName) {
      return `Hey ${conversationMemory.userName}! 👋 What can I help you with today?`;
    } else {
      return `Hello! 👋 I can answer questions, help with math, or just chat. What would you like to know?`;
    }
  }

  // === HOW ARE YOU ===
  if (lowerMessage.match(/(how are you|how you doing|how's it going)/)) {
    return "I'm doing great! Ready to help you with anything. How are you feeling?";
  }

  // === THANKS ===
  if (lowerMessage.match(/(thank|thanks|appreciate)/)) {
    return "You're welcome! 😊 Happy to help!";
  }

  // === GOODBYE ===
  if (lowerMessage.match(/(bye|goodbye|see you|talk later)/)) {
    if (conversationMemory.userName) {
      return `Goodbye ${conversationMemory.userName}! 👋 Have a great day!`;
    } else {
      return "Goodbye! 👋 Take care!";
    }
  }

  // === DEFAULT RESPONSES ===
  const defaultResponses = [
    "I'd be happy to help with that! Could you tell me more?",
    "That's interesting! What would you like to know about this?",
    "I can help answer questions, solve math problems, or just chat. What would you prefer?",
  ];

  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

function updateConversationMemory(message) {
  const lowerMessage = message.toLowerCase();

  // Track recent topics
  if (conversationMemory.recentTopics.length >= 5) {
    conversationMemory.recentTopics.shift();
  }
  conversationMemory.recentTopics.push(message.substring(0, 50));
}

// UI Functions
function addMessage(text, isUser) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${isUser ? "user" : "bot"}`;
  messageDiv.textContent = text;
  chatWindow.appendChild(messageDiv);
  scrollToBottom();
}

function showTypingIndicator() {
  const typingDiv = document.createElement("div");
  typingDiv.className = "typing-indicator";
  typingDiv.id = "typingIndicator";
  for (let i = 0; i < 3; i++) {
    const dot = document.createElement("div");
    dot.className = "typing-dot";
    typingDiv.appendChild(dot);
  }
  chatWindow.appendChild(typingDiv);
  scrollToBottom();
}

function removeTypingIndicator() {
  const typingIndicator = document.getElementById("typingIndicator");
  if (typingIndicator) typingIndicator.remove();
}

function renderChatList() {
  chatList.innerHTML = "";
  const sortedChatIds = Object.keys(chats).sort((a, b) => {
    return new Date(chats[b].createdAt) - new Date(chats[a].createdAt);
  });
  sortedChatIds.forEach((chatId) => {
    const chat = chats[chatId];
    const chatItem = document.createElement("div");
    chatItem.className = `chat-item ${
      chatId === currentChatId ? "active" : ""
    }`;
    chatItem.dataset.chatId = chatId;
    chatItem.innerHTML = `
      <div class="chat-icon"></div>
      <div class="chat-title">${chat.title}</div>
      <div class="chat-date">${formatDate(chat.createdAt)}</div>
    `;
    chatItem.addEventListener("click", () => loadChat(chatId));
    chatList.appendChild(chatItem);
  });
}

function updateActiveChat() {
  document.querySelectorAll(".chat-item").forEach((item) => {
    if (item.dataset.chatId === currentChatId) {
      item.classList.add("active");
    } else {
      item.classList.remove("active");
    }
  });
}

function updateWelcomeMessage() {
  if (chatWindow.children.length > 1) {
    welcomeMessage.style.display = "none";
  } else {
    welcomeMessage.style.display = "block";
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays === 1) return "Today";
  else if (diffDays === 2) return "Yesterday";
  else if (diffDays <= 7) return `${diffDays - 1} days ago`;
  else return date.toLocaleDateString();
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function saveChats() {
  localStorage.setItem("chats", JSON.stringify(chats));
}

document.addEventListener("DOMContentLoaded", init);

// Sidebar toggle functionality
const sidebar = document.querySelector(".sidebar");
let sidebarToggle = document.querySelector(".sidebar-toggle");
let sidebarOverlay = document.querySelector(".sidebar-overlay");

// Create overlay if it doesn't exist
if (!sidebarOverlay) {
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);
  sidebarOverlay = overlay;
}

// Toggle sidebar
function toggleSidebar() {
  sidebar.classList.toggle("active");
  sidebarOverlay.classList.toggle("active");
}

// Add toggle button if it doesn't exist
if (!sidebarToggle) {
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sidebar-toggle";
  toggleBtn.innerHTML = "☰";
  toggleBtn.onclick = toggleSidebar;
  document.body.appendChild(toggleBtn);
  sidebarToggle = toggleBtn;
}

sidebarOverlay.addEventListener("click", toggleSidebar);

// Close sidebar when clicking on a chat item on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 && e.target.closest(".chat-item")) {
    toggleSidebar();
  }
});
