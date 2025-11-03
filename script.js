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

  // Check what type of response is needed
  const responseType = determineResponseType(text);

  try {
    removeTypingIndicator();
    let response;

    switch (responseType) {
      case "math":
        response = handleMathQuestion(text);
        break;
      case "factual":
        response = await handleFactualQuestion(text);
        break;
      case "conversation":
      default:
        response = generateConversationResponse(text);
        break;
    }

    addMessage(response, false);
    saveBotMessage(response);
  } catch (error) {
    removeTypingIndicator();
    const response = generateConversationResponse(text);
    addMessage(response, false);
    saveBotMessage(response);
  }
}

// ENHANCED: Determine response type
function determineResponseType(text) {
  const lowerText = text.toLowerCase();

  // Math patterns
  const mathPatterns = [
    /\d+\s*[\+\-\*\/\^]\s*\d+/, // Basic arithmetic
    /calculate|solve|math|equation|formula/i,
    /what is \d+ [\+\-\*\/] \d+/i,
    /square root|sqrt|percentage|percent|%/i,
    /area|volume|perimeter|circumference/i,
    /algebra|geometry|calculus|trigonometry/i,
  ];

  // Factual/search patterns
  const factualPatterns = [
    /^what is .+/i,
    /^who is .+/i,
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
  ];

  if (mathPatterns.some((pattern) => pattern.test(lowerText))) {
    return "math";
  } else if (factualPatterns.some((pattern) => pattern.test(lowerText))) {
    return "factual";
  } else {
    return "conversation";
  }
}

// ENHANCED: Math question handler
function handleMathQuestion(text) {
  const lowerText = text.toLowerCase();

  try {
    // Basic arithmetic
    const arithmeticMatch = text.match(/(\d+)\s*([\+\-\*\/\^])\s*(\d+)/);
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

      return `The answer is: ${num1} ${operator} ${num2} = ${result}`;
    }

    // Square root
    const sqrtMatch = text.match(/square root of (\d+)|sqrt\((\d+)\)/i);
    if (sqrtMatch) {
      const num = parseFloat(sqrtMatch[1] || sqrtMatch[2]);
      return `The square root of ${num} is ${Math.sqrt(num)}`;
    }

    // Percentage
    const percentMatch = text.match(/(\d+)% of (\d+)|what is (\d+)% of (\d+)/i);
    if (percentMatch) {
      const percent = parseFloat(percentMatch[1] || percentMatch[3]);
      const number = parseFloat(percentMatch[2] || percentMatch[4]);
      const result = (percent / 100) * number;
      return `${percent}% of ${number} is ${result}`;
    }

    // Area calculations
    if (lowerText.includes("area")) {
      if (lowerText.includes("circle") && text.match(/radius (\d+)/)) {
        const radius = parseFloat(text.match(/radius (\d+)/)[1]);
        const area = Math.PI * radius * radius;
        return `The area of a circle with radius ${radius} is ${area.toFixed(
          2
        )}`;
      }
      if (lowerText.includes("rectangle") && text.match(/(\d+) by (\d+)/)) {
        const length = parseFloat(text.match(/(\d+) by (\d+)/)[1]);
        const width = parseFloat(text.match(/(\d+) by (\d+)/)[2]);
        return `The area of a rectangle ${length} by ${width} is ${
          length * width
        }`;
      }
    }

    // If no specific pattern matches, try evaluating as math expression
    try {
      // Simple safe evaluation for basic math
      const sanitized = text.replace(/[^0-9\+\-\*\/\(\)\.\s]/g, "");
      if (sanitized.length > 5) {
        // Only if it looks like a math expression
        const result = eval(sanitized);
        if (typeof result === "number" && !isNaN(result)) {
          return `The answer is: ${result}`;
        }
      }
    } catch (e) {
      // Fall through to default response
    }

    return "I can help with basic math! Try asking something like 'What is 15 + 27?' or 'Calculate 45 * 3'";
  } catch (error) {
    return "I had trouble solving that math problem. Could you rephrase it? For example: 'What is 8 * 7?'";
  }
}

// ENHANCED: Factual question handler with better web search
async function handleFactualQuestion(text) {
  try {
    const searchResult = await searchGoogle(text);
    if (searchResult) {
      return `🔍 ${searchResult}`;
    } else {
      // Fallback to conversation response if search fails
      return generateConversationResponse(text);
    }
  } catch (error) {
    return generateConversationResponse(text);
  }
}

// ENHANCED: Better Google search function
async function searchGoogle(query) {
  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(
        query
      )}`
    );

    if (!response.ok) throw new Error("Search failed");

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const firstResult = data.items[0];
      // Return a more informative response
      return `${firstResult.title}: ${firstResult.snippet}`;
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

// ULTIMATE CONVERSATION RESPONSE GENERATOR (Enhanced)
function generateConversationResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase().trim();
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
      return `Nice to meet you, ${conversationMemory.userName}! 😊 I'm really excited to get to know you better. What's been on your mind lately?`;
    }
  }

  // === MATH OFFER ===
  if (lowerMessage.match(/(math|calculate|numbers|arithmetic)/)) {
    return "I can help with math problems! Try asking me things like:\n• 'What is 15 × 27?'\n• 'Calculate 45 + 89'\n• 'Square root of 64'\n• '25% of 200'\nWhat would you like me to calculate?";
  }

  // === EMOTION DETECTION & RESPONSE ===
  if (
    lowerMessage.match(
      /(sad|depressed|down|upset|unhappy|miserable|heartbroken)/
    )
  ) {
    conversationMemory.userMood = "sad";
    const sadResponses = [
      `I'm really sorry you're feeling this way ${
        conversationMemory.userName ? conversationMemory.userName : ""
      } 💙. It takes courage to share these feelings. Want to talk more about what's going on?`,
      `That sounds really heavy. I'm here to listen without judgment. Sometimes just talking about it can help lighten the load. What's been bothering you?`,
    ];
    return sadResponses[Math.floor(Math.random() * sadResponses.length)];
  }

  // ... (keep all your existing emotion responses, they're great!)

  // === FACTUAL QUESTIONS FALLBACK ===
  if (
    lowerMessage.match(
      /(what is |who is |when was |where is |how does |why does )/
    )
  ) {
    return "I tried searching for that information but couldn't find a clear answer. Could you rephrase your question or ask me something else? I'm great with math problems and personal conversations!";
  }

  // === GREETINGS & CASUAL OPENERS ===
  if (
    lowerMessage.match(
      /^(hello|hi|hey|yo|what's up|whats good|howdy|greetings)/
    )
  ) {
    const greetings = conversationMemory.userName
      ? [
          `Hey ${conversationMemory.userName}! 👋 I can help with math problems, search for information, or just chat! What would you like to do?`,
          `Hello ${conversationMemory.userName}! 😊 Need help with calculations or want to talk about something?`,
        ]
      : [
          `Hey there! 👋 I'm your smart assistant! I can:\n• Solve math problems\n• Search for information\n• Have meaningful conversations\nWhat would you like to try first?`,
          `Hello! 😊 I'm here to help with math, facts, or just to chat! What's on your mind?`,
        ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // ... (keep all your existing conversation responses)

  // === DEFAULT RESPONSES FOR ANYTHING ELSE ===
  const defaultResponses = [
    "That's interesting! I can help you with math problems, search for information, or just chat. What would you like to do?",
    "Thanks for sharing! I'm here to help with calculations, answer questions, or have a conversation. What would you like to explore?",
    "I appreciate you sharing that! I can assist with math, search the web, or just listen. What would you prefer?",
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

  // Extract interests (enhanced with math interest)
  const interestKeywords = {
    math: ["math", "calculate", "numbers", "equation", "algebra", "geometry"],
    music: ["music", "song", "band", "artist", "concert"],
    sports: ["sports", "game", "team", "player", "exercise"],
    books: ["book", "read", "novel", "author"],
    movies: ["movie", "film", "netflix", "cinema"],
    travel: ["travel", "vacation", "trip", "destination"],
    food: ["food", "cook", "recipe", "restaurant"],
    tech: ["tech", "computer", "phone", "app", "software"],
  };

  for (const [interest, keywords] of Object.entries(interestKeywords)) {
    if (
      keywords.some((keyword) => lowerMessage.includes(keyword)) &&
      !conversationMemory.userInterests.includes(interest)
    ) {
      conversationMemory.userInterests.push(interest);
    }
  }
}

// UI Functions (keep these the same)
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
  if (chatWindow.children.length > 0) {
    welcomeMessage.style.opacity = "0";
  } else {
    welcomeMessage.style.opacity = "1";
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
  toggleBtn.innerHTML = "☰"; // Hamburger icon
  toggleBtn.onclick = toggleSidebar;
  document.body.appendChild(toggleBtn);
  sidebarToggle = toggleBtn;
}

// Close sidebar when clicking overlay
sidebarOverlay.addEventListener("click", toggleSidebar);

// Close sidebar when clicking on a chat item on mobile
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 768 && e.target.closest(".chat-item")) {
    toggleSidebar();
  }
});
