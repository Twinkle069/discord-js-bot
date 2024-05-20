const { botKnowledge, safetySettings } = require("@helpers/botKnowledge");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const aaruTranslator = require("aaru-translator");
const axios = require('axios');

const genAIKey = process.env.GEMINI_API_KEY;

const TRANSLATOR = true; // Flag to enable, disable translation
const LINK_DETECTION = true; // Flag to enable, disable link detection
const COOLDOWN = 5000; // Time to wait before the bot can respond again
/*... Not for you; that's why I removed ...*/
const MAX_HISTORY = 3; // Maximum number of message history to store idk it's working or not 

// Initializing variables for models
let genAI, textModels = {}, imageModels = {};

// Configuration for text generation
const textConfig = {
  stopSequences: ["red"], // Halt content generation. Avoid common characters
  maxOutputTokens: 2048, // Limit on content generation. 100 tokens ≈ 60-80 words.
  temperature: 0.8, // Lower temps = deterministic, higher temps = creative
  top_p: 1,
  top_k: 1,
};

// Configuration for image generation
const imageConfig = {
  stopSequences: ["red"], // Halt content generation. Avoid common characters
  temperature: 0.4, // Lower temps = deterministic, higher temps = creative
  topP: 1,
  topK: 32,
  maxOutputTokens: 2048, // Limit on content generation. 100 tokens ≈ 60-80 words.
};

if (genAIKey) {
  genAI = new GoogleGenerativeAI(genAIKey);
}

const history = {}; // Store user chat history
// Store cooldown time in map
const cooldown = new Map();
/*... Not for you; that's why I removed it ...*/

// Update user chat history
function updateHistory(userId, messageData) {
  // Initialize chat history if not present
  if (!history[userId]) {
    history[userId] = [];
  }

  if (history[userId].length >= MAX_HISTORY) {
    // Overwrite the oldest message with the new chat idk it's working or not
    history[userId][0] = messageData;
  } else {
    history[userId].push(messageData);
  }
}

async function translate(text, language) {
  if (TRANSLATOR) {
    return aaruTranslator.translate("auto", language || "en", text);
  } else {
    return text;
  }
}

// Update cooldown time for a user
async function updateCooldown(userId) {
  cooldown.set(userId, Date.now() + COOLDOWN);
}

// Check if user is still under cooldown
async function checkCooldown(userId) {
  const now = Date.now();
  if (cooldown.has(userId) && now < cooldown.get(userId)) {
    const clTime = Math.ceil((cooldown.get(userId) - now) / 1000);
    return `Oh no! You need to wait ${clTime} more seconds before chatting with me again!`;
  }
  return null;
}

/*... Not for you; that's why I removed ...*/

// Generate text response based on user input
async function TextResponse(message, prompt, userId, settings) {
  const clSend = await checkCooldown(userId);
  if (clSend) return clSend;
  updateCooldown(userId);

  // Extracting user chats from history
  const userMessages = history[userId] ? history[userId].filter(msg => msg.role === "user") : [];
  const chatHistory = userMessages.slice(-MAX_HISTORY).map(msg => ({ role: "user", parts: [{ text: msg.text }] }));

  /*.................... Not for you; that's why I removed it ...................*/

  // Initialize Gemini text model
  if (!textModels[userId]) {
    textModels[userId] = genAI.getGenerativeModel({
      model: "gemini-1.5-pro-latest", // latest version of Gemini Ai
      apiVersion: 'v1beta',
      configuration: { ...textConfig, safetySettings }
    });
  }

  // Starting chat with user history 
  const chat = textModels[userId].startChat({
    history: [
      ...chatHistory,
      ...botKnowledge
    ],
    generationConfig: textConfig,
    safetySettings,
  });

  await message.channel.sendTyping();

  try {
    const genAIResponse = await (await chat.sendMessage(prompt)).response;
    let text = genAIResponse.text();

    // Checking for link detection
    if (LINK_DETECTION && /\b(?:https?|ftp):\/\/\S+/gi.test(text)) {
      return "Sorry, I can't assist you with links";
    }

    return text.length > 2000 ? text.slice(0, 1997) + '...' : text;
  } catch (error) { //Handle errors (⁠ ⁠╹⁠▽⁠╹⁠ ⁠)
    message.client.logger.error(error);
    return "Oops! Something went wrong while processing your request.";
  }
}

// Generate image response based on user input
async function ImageResponse(message, imageUrl, prompt, userId, settings) {
  const clSend = await checkCooldown(userId);
  if (clSend) return clSend;
  updateCooldown(userId);

  // Initialize Gemini image model
  if (!imageModels[userId]) {
    imageModels[userId] = genAI.getGenerativeModel({
      model: "gemini-pro-vision",
      apiVersion: 'v1beta',
      configuration: { ...imageConfig, safetySettings }
    });
  }

  try {
    // Fetching image data from URL
    const imageData = Buffer.from((await axios.get(imageUrl, {
      responseType: 'arraybuffer'
    })).data, 'binary').toString('base64');
    const promptConfig = [{
      text: prompt || "Tell me about this image"
    }, {
      inlineData: {
        mimeType: "image/jpeg",
        data: imageData
      }
    }];
    await message.channel.sendTyping();

    // Generate response from Gemini image model
    const genAIResponse = await (await imageModels[userId].generateContent({
      contents: [{
        role: "user",
        parts: promptConfig
      }]
    })).response;
    let text = genAIResponse.text();

    // Checking for link detection
    if (LINK_DETECTION && /\b(?:https?|ftp):\/\/\S+/gi.test(text)) {
      return "Sorry, I can't assist you with links";
    }

    return text;
  } catch (error) { //Handle errors (⁠ ⁠╹⁠▽⁠╹⁠ ⁠)
    message.client.logger.error(error);
    return "Oops! Something went wrong while processing the image.";
  }
}

// Generating translated responses for text
async function getTextResponse(message, messageContent, userId, settings) {
  const response = await TextResponse(message, messageContent, userId, settings);
  return translate(response, settings.chatbotLang);
}

// Generating translated responses for images
async function getImageResponse(message, imageUrl, prompt, userId, settings) {
  const response = await ImageResponse(message, imageUrl, prompt, userId, settings);
  return translate(response, settings.chatbotLang);
}

async function chatbot(client, message, settings) {
  try {
    // Ignore messages from bots and outside guilds
    if (!message.guild || message.author.bot) return;

    // Get current timestamp
    const now = Date.now();
    const MentionRegex = new RegExp(`^<@!?${message.client.user.id}>`);
    const userId = message.author.id;

    // Check for direct mentions or recent interactions for idle timeout
    if (message.content.match(MentionRegex) /*... Not for you; that's why I removed it ...*/ ) {
      const messageContent = message.content.replace(MentionRegex, '').trim();
      /*... Not for you; that's why I removed it ...*/
      if (messageContent) {
        const imageUrl = message.attachments.first()?.url;
        return message.safeReply(await (
            imageUrl && message.attachments.first().height ? 
            getImageResponse(message, imageUrl, messageContent, userId, settings) : 
            getTextResponse(message, messageContent, userId, settings)));
      }
    }

    // Check if message is in the chatbot channel
    if (message.channel.id === settings.chatbotId) {
      const imageUrl = message.attachments.first()?.url;
      return message.safeReply(await (
          imageUrl && message.attachments.first().height ? 
          getImageResponse(message, imageUrl, message.content, userId, settings) : 
          getTextResponse(message, message.content, userId, settings)));
    }
  } catch (error) { //Handle errors (⁠ ⁠╹⁠▽⁠╹⁠ ⁠)
    client.logger.error(error);
    message.safeReply("Oops! Something went wrong while processing your request. Please try again later.");
  }
}

module.exports = { chatbot };
