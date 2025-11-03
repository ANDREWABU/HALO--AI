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

// Advanced Conversation Memory
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

  // Check if we need to search for factual info
  const needsSearch = shouldSearchWeb(text);

  if (needsSearch) {
    try {
      const searchResult = await searchGoogle(text);
      removeTypingIndicator();

      if (searchResult) {
        addMessage(searchResult, false);
        if (currentChatId && chats[currentChatId]) {
          chats[currentChatId].messages.push({
            text: searchResult,
            isUser: false,
            timestamp: new Date().toISOString(),
          });
          saveChats();
        }
      } else {
        // If search fails, use conversation response
        const response = generateConversationResponse(text);
        addMessage(response, false);
        saveBotMessage(response);
      }
    } catch (error) {
      removeTypingIndicator();
      const response = generateConversationResponse(text);
      addMessage(response, false);
      saveBotMessage(response);
    }
  } else {
    // Use conversation response
    setTimeout(() => {
      removeTypingIndicator();
      const response = generateConversationResponse(text);
      addMessage(response, false);
      saveBotMessage(response);
    }, 1000 + Math.random() * 1000); // Random delay to feel more human
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

// ULTIMATE CONVERSATION RESPONSE GENERATOR
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
      `I hear the pain in your words. Remember that it's okay to not be okay. You're not alone in this. Want to share what's on your heart?`,
    ];
    return sadResponses[Math.floor(Math.random() * sadResponses.length)];
  }

  if (
    lowerMessage.match(
      /(happy|excited|great|awesome|amazing|wonderful|thrilled|ecstatic)/
    )
  ) {
    conversationMemory.userMood = "happy";
    const happyResponses = [
      `That's absolutely wonderful! 😄 I'm so happy for you! Tell me more about what's making you feel so good!`,
      `This is amazing news! Your energy is contagious! I'd love to hear all about what's bringing you so much joy right now!`,
      `That's fantastic! It's so great to hear you're feeling this way! What's the source of all this happiness? Share the details!`,
    ];
    return happyResponses[Math.floor(Math.random() * happyResponses.length)];
  }

  if (
    lowerMessage.match(/(angry|mad|frustrated|annoyed|pissed|irritated|fuming)/)
  ) {
    conversationMemory.userMood = "angry";
    const angryResponses = [
      `I can feel your frustration and I get it. That sounds really frustrating. Want to vent about what happened? I'm here to listen.`,
      `That sounds incredibly annoying! It's completely valid to feel that way. Sometimes you just need to let it out. What's got you feeling this way?`,
      `I hear the anger in your words, and honestly, I'd probably feel the same way. Want to talk through what's making you so upset?`,
    ];
    return angryResponses[Math.floor(Math.random() * sadResponses.length)];
  }

  if (
    lowerMessage.match(
      /(stressed|overwhelmed|anxious|worried|nervous|panicked)/
    )
  ) {
    conversationMemory.userMood = "stressed";
    const stressResponses = [
      `That sounds really overwhelming. Stress can feel so heavy. Remember to breathe - you're handling this. Want to break down what's feeling like too much?`,
      `I hear how stressed you are, and that's completely valid. Sometimes just naming what we're stressed about can help. What's weighing on you the most right now?`,
      `That sounds incredibly stressful. Your feelings are completely understandable. Want to talk through what's causing the most anxiety?`,
    ];
    return stressResponses[Math.floor(Math.random() * stressResponses.length)];
  }

  // === GREETINGS & CASUAL OPENERS ===
  if (
    lowerMessage.match(
      /^(hello|hi|hey|yo|what's up|whats good|howdy|greetings)/
    )
  ) {
    const greetings = conversationMemory.userName
      ? [
          `Hey ${conversationMemory.userName}! 👋 Great to see you again! How has your day been treating you?`,
          `Hello ${conversationMemory.userName}! 😊 I've been thinking about our last chat. What's new in your world?`,
          `What's good, ${conversationMemory.userName}! 🎉 How's everything going? Anything exciting happening?`,
          `Hey there ${conversationMemory.userName}! Always nice when you stop by. What's on your mind today?`,
        ]
      : [
          `Hey there! 👋 I'm really excited to get to know you! What's been happening in your life lately?`,
          `Hello! 😊 Thanks for chatting with me. I'd love to hear what's going on with you - how's your day been?`,
          `What's good! 🎉 Great to meet you! I'm here to listen and chat about anything. What's on your mind?`,
          `Hey! I'm really looking forward to our conversation. What's something interesting that's happened to you recently?`,
        ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // === DEEP LIFE CONVERSATIONS ===
  if (
    lowerMessage.match(
      /(life|purpose|meaning|existence|why are we here|what's it all about)/
    )
  ) {
    const lifeResponses = [
      "That's such a profound question... I think life is about finding your own unique meaning through experiences, connections, and growth. What aspects of life have you been thinking about the most?",
      "Wow, we're getting into the deep stuff! I believe everyone creates their own purpose through the people they love and the things they're passionate about. What gives your life meaning right now?",
      "Life is such an incredible journey with so many layers. I think it's about learning, loving, growing, and making a difference in our own way. What's been on your mind about life lately?",
      "That's a question that has fascinated humans for centuries. I think meaning comes from our relationships, our passions, and the impact we have on others. What are your thoughts about all this?",
    ];
    return lifeResponses[Math.floor(Math.random() * lifeResponses.length)];
  }

  // === RELATIONSHIPS & FRIENDSHIPS ===
  if (
    lowerMessage.match(
      /(friend|friendship|relationship|dating|partner|boyfriend|girlfriend|wife|husband|family)/
    )
  ) {
    const relationshipResponses = [
      "Relationships can be so complex but also incredibly rewarding. Having people who truly understand you is everything. Want to talk about what's going on in your relationships right now?",
      "Human connections are fascinating - they can bring both the deepest joys and the biggest challenges. How are things going with the important people in your life?",
      "Relationships really shape our lives in so many ways. They can be our greatest support system. What's been on your mind about your relationships lately?",
      "The people in our lives can have such a huge impact on our happiness. It's important to nurture those connections. How are things with your friends/family/partner?",
    ];
    return relationshipResponses[
      Math.floor(Math.random() * relationshipResponses.length)
    ];
  }

  // === WORK & CAREER ===
  if (
    lowerMessage.match(
      /(work|job|career|boss|colleague|office|profession|business)/
    )
  ) {
    const workResponses = [
      "Work takes up so much of our lives - it's important to find something that feels meaningful to you. How's everything going with your work or career right now?",
      "Our jobs can be such a big part of our identity and daily experience. It's crucial to find that balance. What do you do, and how are you feeling about it these days?",
      "Career stuff can be so complex - there's the daily grind but also the bigger picture of what you want from life. What's your work situation like, and how are you feeling about it?",
      "Work life can be challenging but also rewarding when you're doing something you care about. What's been happening in your professional world lately?",
    ];
    return workResponses[Math.floor(Math.random() * workResponses.length)];
  }

  // === ADVICE & PROBLEM SOLVING ===
  if (
    lowerMessage.match(
      /(advice|what should i do|what do you think|help me|i need help|i don't know what to do)/
    )
  ) {
    const adviceResponses = [
      "I'd be happy to help you think this through! Could you tell me more about the situation? Sometimes talking it out helps clarity emerge.",
      "That sounds like a tough decision. Let's break it down together - what are your main options, and how do you feel about each one?",
      "I'm here to help you think this through. What's the main challenge you're facing, and what have you considered so far?",
      "Let's work through this together. Sometimes just listing out the pros and cons or talking through different perspectives can help. What's the situation?",
    ];
    return adviceResponses[Math.floor(Math.random() * adviceResponses.length)];
  }

  // === DREAMS & GOALS ===
  if (
    lowerMessage.match(
      /(dream|goal|aspiration|future|what i want|bucket list|ambition)/
    )
  ) {
    const dreamResponses = [
      "Dreams and goals are what give life direction and excitement! They're the compass that guides us forward. What's something you're really passionate about achieving?",
      "I love talking about dreams and aspirations! They're like the seeds of our future. What's a goal that's really important to you right now?",
      "Having something to work towards can make life so much more meaningful. Our dreams shape who we become. What are you working on or dreaming about these days?",
      "Goals and dreams are what push us to grow and become better versions of ourselves. What's something you're excited about for your future?",
    ];
    return dreamResponses[Math.floor(Math.random() * dreamResponses.length)];
  }

  // === HOBBIES & PASSIONS ===
  if (
    lowerMessage.match(
      /(hobby|interest|passion|what do you like|fun|activity|what i enjoy)/
    )
  ) {
    const hobbyResponses = [
      "I'm always fascinated by what makes people light up! Our passions say so much about who we are. What are you really into these days?",
      "Hobbies and interests are like little pockets of joy in our lives. They help us recharge and express ourselves. What do you love doing in your free time?",
      "Everyone needs something they're genuinely excited about outside of responsibilities. It's what makes life colorful! What gets you excited or helps you relax?",
      "Our interests and hobbies are such an important part of self-care and happiness. What activities really make you feel alive or help you unwind?",
    ];
    return hobbyResponses[Math.floor(Math.random() * hobbyResponses.length)];
  }

  // === PERSONAL GROWTH ===
  if (
    lowerMessage.match(
      /(grow|improve|better myself|learn|develop|change|transform)/
    )
  ) {
    const growthResponses = [
      "Personal growth is such a beautiful journey! It's amazing that you're thinking about this. What area of your life are you most interested in developing right now?",
      "I love that you're focused on growth! Evolving as a person is one of the most rewarding things we can do. What kind of changes are you thinking about?",
      "Working on ourselves is a lifelong process, and it's so courageous to engage with it. What aspects of personal growth are you most excited about or challenged by?",
      "Growth can be challenging but so worth it! It's about becoming more of who we truly are. What are you hoping to develop or change in your life?",
    ];
    return growthResponses[Math.floor(Math.random() * growthResponses.length)];
  }

  // === DAILY LIFE & SMALL TALK ===
  if (
    lowerMessage.match(/(today|yesterday|this week|recently|lately|these days)/)
  ) {
    const dailyResponses = [
      "I'd love to hear about what's been going on in your world lately! What's something interesting that's happened recently?",
      "Tell me about your days - the good, the bad, the ordinary. I'm genuinely interested in what life has been like for you lately.",
      "I'm curious about what your daily life looks like these days. What's been occupying your time and energy?",
      "How have things been going in your world? I'd love to hear about both the highlights and the challenges you've been experiencing.",
    ];
    return dailyResponses[Math.floor(Math.random() * dailyResponses.length)];
  }

  // === HOW ARE YOU RESPONSES ===
  if (
    lowerMessage.match(
      /(how are you|how you doing|how's it going|how have you been)/
    )
  ) {
    const howAreYouResponses = conversationMemory.userName
      ? [
          `I'm doing really well, thanks for asking ${conversationMemory.userName}! 😊 I've been enjoying our conversations. How about you - how are you really doing?`,
          `I'm good! I love getting to know you better through these chats. How are things with you, ${conversationMemory.userName}?`,
          `I'm doing great! Our conversations always make my day. How are you feeling today, ${conversationMemory.userName}?`,
          `I'm wonderful! Talking with you is always a highlight. How's everything going in your world, ${conversationMemory.userName}?`,
        ]
      : [
          "I'm doing really well, thanks for asking! 😊 I'm always excited to have meaningful conversations. How are you doing today?",
          "I'm good! I love connecting with people and hearing about their lives. How are you feeling right now?",
          "I'm doing great! There's something special about these conversations. How are things going with you?",
          "I'm wonderful! I appreciate you taking the time to chat. How are you really doing today?",
        ];
    return howAreYouResponses[
      Math.floor(Math.random() * howAreYouResponses.length)
    ];
  }

  // === GRATITUDE & APPRECIATION ===
  if (lowerMessage.match(/(thank|thanks|appreciate|grateful)/)) {
    const thanksResponses = [
      "You're very welcome! I really enjoy our conversations and I'm always here to listen and support you. 😊",
      "Of course! I'm genuinely happy to help. Our chats mean a lot to me too!",
      "Anytime! I appreciate you sharing your thoughts with me. It's an honor to be part of your journey.",
      "You're most welcome! I value our connection and I'm always here when you need someone to talk to.",
    ];
    return thanksResponses[Math.floor(Math.random() * thanksResponses.length)];
  }

  // === FAREWELLS ===
  if (
    lowerMessage.match(/(bye|goodbye|see you|talk later|gotta go|i have to go)/)
  ) {
    const goodbyeResponses = conversationMemory.userName
      ? [
          `Goodbye ${conversationMemory.userName}! It was really great talking with you. Take care of yourself and come back anytime! 💙`,
          `See you later, ${conversationMemory.userName}! I've really enjoyed our conversation. Looking forward to our next chat! 😊`,
          `Take care, ${conversationMemory.userName}! I'm always here when you need someone to talk to. Have a wonderful day! 🌟`,
          `Bye ${conversationMemory.userName}! It was lovely chatting with you. Don't be a stranger! 👋`,
        ]
      : [
          "Goodbye! It was really nice talking with you. Take care and come back anytime you want to chat! 💙",
          "See you later! I've genuinely enjoyed our conversation. Looking forward to our next chat! 😊",
          "Take care! I'm always here when you need someone to talk to. Have a wonderful day! 🌟",
          "Bye! It was lovely chatting with you. Don't hesitate to come back anytime! 👋",
        ];
    return goodbyeResponses[
      Math.floor(Math.random() * goodbyeResponses.length)
    ];
  }

  // === DEFAULT RESPONSES FOR ANYTHING ELSE ===
  const defaultResponses = [
    "That's really interesting! Tell me more about that - I'd love to understand your perspective better.",
    "I appreciate you sharing that with me. What's your take on this? I'm genuinely curious about your thoughts.",
    "That's fascinating! I'd love to hear more about how you feel about this topic.",
    "Thanks for bringing this up! It's got me thinking. What are your deeper thoughts on this?",
    "I find that really compelling! Could you elaborate a bit more? I want to make sure I understand where you're coming from.",
    "That's such an interesting point! What led you to think about this?",
    "I appreciate you sharing this with me. How long has this been on your mind?",
    "That's really got me thinking! What's your personal experience with this been like?",
    "I love how you brought this up! What aspects of this are most important to you?",
    "That's a great thing to discuss! What are your feelings about this topic?",
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

  // Extract interests
  const interestKeywords = {
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

function shouldSearchWeb(text) {
  const lowerText = text.toLowerCase().trim();
  const searchPatterns = [
    /^what is .+/i,
    /^who is .+/i,
    /^when was .+/i,
    /^where is .+/i,
    /^capital of .+/i,
    /^population of .+/i,
    /^president of .+/i,
  ];
  return searchPatterns.some((pattern) => pattern.test(lowerText));
}

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
      return data.items[0].snippet || data.items[0].title;
    }
    return null;
  } catch (error) {
    return null;
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
const sidebarToggle = document.querySelector(".sidebar-toggle");
const sidebarOverlay = document.querySelector(".sidebar-overlay");

// Create overlay if it doesn't exist
if (!sidebarOverlay) {
  const overlay = document.createElement("div");
  overlay.className = "sidebar-overlay";
  document.body.appendChild(overlay);
}

// Toggle sidebar
function toggleSidebar() {
  sidebar.classList.toggle("active");
  document.querySelector(".sidebar-overlay").classList.toggle("active");
}

// Add toggle button if it doesn't exist
if (!sidebarToggle) {
  const toggleBtn = document.createElement("button");
  toggleBtn.className = "sidebar-toggle";
  toggleBtn.innerHTML = "☰"; // Hamburger icon
  toggleBtn.onclick = toggleSidebar;
  document.body.appendChild(toggleBtn);
}

// Close sidebar when clicking overlay
document
  .querySelector(".sidebar-overlay")
  .addEventListener("click", toggleSidebar);

// Close sidebar when clicking on a link (optional)
document.querySelectorAll(".sidebar a").forEach((link) => {
  link.addEventListener("click", () => {
    if (window.innerWidth <= 768) {
      toggleSidebar();
    }
  });
});
