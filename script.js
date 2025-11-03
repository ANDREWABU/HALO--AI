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
  setupEventListeners();
}

function setupEventListeners() {
  // Remove existing listeners to prevent duplicates
  sendBtn.replaceWith(sendBtn.cloneNode(true));
  userInput.replaceWith(userInput.cloneNode(true));

  // Get fresh references
  const freshSendBtn = document.getElementById("send-btn");
  const freshUserInput = document.getElementById("user-input");

  // Add event listeners
  freshSendBtn.addEventListener("click", sendMessage);
  freshUserInput.addEventListener("keypress", (e) => {
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

  // Focus input after a short delay to ensure it's rendered
  setTimeout(() => {
    const input = document.getElementById("user-input");
    if (input) input.focus();
  }, 100);
}

function loadChat(chatId) {
  if (!chats[chatId]) return;
  currentChatId = chatId;
  const chat = chats[chatId];

  chatWindow.innerHTML = "";

  if (chat.messages.length === 0) {
    // Show welcome message for empty chat
    const welcomeDiv = document.createElement("div");
    welcomeDiv.className = "welcome-message";
    welcomeDiv.textContent =
      "Hello, welcome to HALO AI! How may I help you today?";
    chatWindow.appendChild(welcomeDiv);
  } else {
    // Show existing messages
    chat.messages.forEach((message) => {
      addMessage(message.text, message.isUser);
    });
  }

  updateWelcomeMessage();
  scrollToBottom();
  updateActiveChat();

  // Re-setup event listeners after loading chat
  setTimeout(setupEventListeners, 0);
}

// Send a message
async function sendMessage() {
  console.log("Send button clicked"); // Debug log

  let inputField;
  // Try to get input from main input area first, then from centered area
  if (document.getElementById("user-input")) {
    inputField = document.getElementById("user-input");
  }

  if (!inputField) {
    console.error("Input field not found");
    return;
  }

  const text = inputField.value.trim();
  console.log("Input text:", text); // Debug log

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

  // Clear input field
  inputField.value = "";
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
      response = await generateConversationResponse(text);
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
      return searchResult;
    } else {
      // Fallback to common knowledge or conversation
      return handleCommonQuestions(text) || generateConversationResponse(text);
    }
  } catch (error) {
    return handleCommonQuestions(text) || generateConversationResponse(text);
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

// ENHANCED: Better Google search function
async function searchGoogle(query) {
  try {
    // Don't search for simple math questions
    if (isMathQuestion(query)) {
      return null;
    }

    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=${encodeURIComponent(
        query
      )}`
    );

    if (!response.ok) throw new Error("Search failed");

    const data = await response.json();
    if (data.items && data.items.length > 0) {
      const firstResult = data.items[0];

      // Clean up the response
      let cleanSnippet = firstResult.snippet
        .replace(/Wikipedia/g, "")
        .replace(/\[\d+\]/g, "")
        .replace(/\.\.\./g, ".")
        .replace(/\s+/g, " ")
        .trim();

      const cleanTitle = firstResult.title
        .replace(/ - Wikipedia$/, "")
        .replace(/\(Wikipedia\)/, "")
        .trim();

      // Only return if we have meaningful content
      if (cleanSnippet.length > 20) {
        return `${cleanTitle}: ${cleanSnippet}`;
      }
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

// === ADVANCED CONVERSATION ENGINE WITH FOLLOW-UP, ALTERNATIVES, AND LIVE NEWS ===
async function generateConversationResponse(userMessage) {
  const lowerMessage = userMessage.toLowerCase().trim();
  conversationMemory.conversationDepth++;
  updateConversationMemory(userMessage);

  // Extract name
  if (!conversationMemory.userName) {
    const nameMatch = userMessage.match(/(?:my name is|i'm|i am|call me) ([a-zA-Z]{2,})/i);
    if (nameMatch) {
      conversationMemory.userName = nameMatch[1];
      return `Nice to meet you, ${conversationMemory.userName}! 😊 What would you like to talk about today?`;
    }
  }

  // Intent & entity extraction
  const intents = [
    { pattern: /(who are you|what are you|are you real|what can you do)/, response: () => `I'm HALO AI, your personal assistant. I can answer questions, help with research, chat, and more. What would you like to do?` },
    { pattern: /(how are you|how's it going|how do you feel)/, response: () => `I'm just code, but I'm always ready to help! How are you feeling today?` },
    { pattern: /(thank|thanks|appreciate)/, response: () => `You're welcome! 😊 If you have more questions, just ask!` },
    { pattern: /(bye|goodbye|see you|talk later)/, response: () => conversationMemory.userName ? `Goodbye ${conversationMemory.userName}! 👋 Have a great day!` : `Goodbye! 👋 Take care!` },
    { pattern: /(help|assist|support)/, response: () => `Of course! What do you need help with?` },
    { pattern: /(joke|funny|make me laugh)/, response: () => `Why did the computer show up at work late? It had a hard drive! 😄 Want to hear another joke?` },
    { pattern: /(news|current events|what's happening|headlines|latest news|world news)/, response: async () => {
        const news = await getLiveNews();
        return news || "Sorry, I couldn't fetch the latest news right now. Try again later or ask about a specific topic.";
      }
    },
    { pattern: /(weather|temperature|forecast)/, response: () => `I can check the weather for you. Which city or location are you interested in?` },
    { pattern: /(music|song|play|listen)/, response: () => `I can recommend music or find songs for you. What genre or artist do you like?` },
    { pattern: /(movie|film|watch|recommend)/, response: () => `Looking for a movie recommendation? Tell me what genre or mood you're in!` },
    { pattern: /(stress|sad|depressed|down|upset|unhappy|miserable|heartbroken)/, response: () => `I'm really sorry you're feeling this way. 💙 Want to talk about what's bothering you? Or would you like some tips to feel better?` },
    { pattern: /(happy|excited|great|awesome|amazing|wonderful|thrilled)/, response: () => `That's wonderful! 😄 What's making you feel so good?` },
    { pattern: /(bored|nothing to do)/, response: () => `Let's find something fun! Want a joke, a fun fact, or a music/movie suggestion?` },
  ];
  for (const intent of intents) {
    if (intent.pattern.test(lowerMessage)) {
      const result = await intent.response();
      // Suggest a follow-up or alternative
      let followUp = '';
      if (/news|current events|latest news|headlines/.test(lowerMessage)) {
        followUp = "\n\nWould you like news about a specific topic or location?";
      } else if (/joke/.test(lowerMessage)) {
        followUp = "\n\nOr I can share a fun fact if you prefer!";
      } else if (/weather/.test(lowerMessage)) {
        followUp = "\n\nLet me know your city for a local forecast.";
      } else if (/music|song/.test(lowerMessage)) {
        followUp = "\n\nOr I can suggest a playlist!";
      } else if (/movie|film/.test(lowerMessage)) {
        followUp = "\n\nOr would you like a TV show suggestion?";
      }
      return result + followUp;
    }
  }

  // Contextual follow-up: If user asked a vague question, ask for more details
  if (/^(why|how|what|where|who|when)\b/.test(lowerMessage) && lowerMessage.split(' ').length < 5) {
    return `Could you tell me a bit more so I can help you better? Or ask about something else!`;
  }

  // If user mentions a topic, remember it
  const interestMatch = userMessage.match(/i (like|love|enjoy|am interested in) ([a-zA-Z\s]+)/i);
  if (interestMatch) {
    const interest = interestMatch[2].trim();
    if (!conversationMemory.userInterests.includes(interest)) {
      conversationMemory.userInterests.push(interest);
    }
    return `That's awesome! I'll remember that you like ${interest}. Want to talk more about it, or something else?`;
  }

  // If user asks for advice
  if (/advice|suggest|recommend|should i/i.test(lowerMessage)) {
    return `I'm happy to give advice! Can you tell me a bit more about your situation, or would you like a general tip?`;
  }

  // If user asks a follow-up, try to use recent topics
  if (conversationMemory.recentTopics.length > 0 && /tell me more|more info|explain|details/i.test(lowerMessage)) {
    const lastTopic = conversationMemory.recentTopics[conversationMemory.recentTopics.length - 1];
    return `Sure! Here's more about: ${lastTopic}. Would you like to ask something else?`;
  }

  // If user says something unclear, ask for clarification
  if (lowerMessage.length < 5 || /^(yes|no|maybe|ok|okay|sure)$/i.test(lowerMessage)) {
    return `Could you clarify or tell me more? Or ask about something else!`;
  }

  // Default: friendly, open-ended response with alternative
  const defaultResponses = [
    `I'd be happy to help with that! Could you tell me more, or ask about something else?`,
    `That's interesting! What would you like to know about this, or is there another topic?`,
    `I can help answer questions, solve problems, or just chat. Want a news update or a fun fact?`,
    `Let's talk! Ask me anything or tell me what's on your mind. Or I can suggest a topic!`
  ];
  return defaultResponses[Math.floor(Math.random() * defaultResponses.length)];
}

// LIVE NEWS FETCHER (Google News via Custom Search)
async function getLiveNews() {
  try {
    const response = await fetch(
      `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_SEARCH_ENGINE_ID}&q=latest+news+2025`
    );
    if (!response.ok) throw new Error("News fetch failed");
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items.slice(0, 3).map((item, idx) => {
        let cleanSnippet = item.snippet.replace(/\s+/g, ' ').trim();
        return `${idx + 1}. ${item.title}: ${cleanSnippet}`;
      }).join('\n\n');
    }
    return null;
  } catch (e) {
    return null;
  }
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
  const welcomeMsg = document.querySelector(".welcome-message");
  if (chatWindow.children.length > 1) {
    if (welcomeMsg) welcomeMsg.style.display = "none";
  } else {
    if (welcomeMsg) welcomeMsg.style.display = "block";
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
