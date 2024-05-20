const { botKnowledge, safetySettings } = require("@helpers/botKnowledge");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const aaruTranslator = require("aaru-translator");
const axios = require('axios');

const genAIKey = process.env.GEMINI_API_KEY;

// Set up translation flag  "true" or "false"
const Translator = true;
let genAI, textModel, imageModel;

// Configuration for text generation
const textConfig = {
  maxOutputTokens: 2048,
  temperature: 0.8,
  top_p: 1,
  top_k: 1,
};

// Configuration for image generation
const imageConfig = {
  temperature: 0.4,
  topP: 1,
  topK: 32,
  maxOutputTokens: 4096,
};

// Initialize Google Generative AI models if API key is provided
if (genAIKey) {
  genAI = new GoogleGenerativeAI(genAIKey);
  textModel = genAI.getGenerativeModel({ model: "gemini-pro", textConfig, safetySettings });
  imageModel = genAI.getGenerativeModel({ model: "gemini-pro-vision", imageConfig, safetySettings });
}

// Define cooldown period for chatbot interactions
const COOLDOWN = 10000;

// Store message history and cooldown information
const messageHistory = {};
const cooldown = {};

// Function to translate chatbot response
async function translateResponse(text) {
  return Translator ? aaruTranslator.translate("auto", "en", text) : text;
}

// Function to update cooldown timer for a user
async function updateCooldown(userId) {
  cooldown[userId] = Date.now() + COOLDOWN;
}

// Function to check if user is still under cooldown period
async function checkCooldown(userId) {
  const now = Date.now();
  if (cooldown[userId] && now < cooldown[userId]) {
    const remainingCooldown = Math.ceil((cooldown[userId] - now) / 1000);
    return `You need to wait ${remainingCooldown} more seconds before chatting with me again!`;
  }
  return null;
}

// Function to generate text response based on user input
async function TextResponse(message, prompt, userId) {
  // Check if user is under cooldown
  const cooldownMessage = await checkCooldown(userId);
  if (cooldownMessage) return cooldownMessage;
  updateCooldown(userId);

  // Start a chat session or continue existing session
  const chat = messageHistory[userId] || (messageHistory[userId] = textModel.startChat({
    history: [...(Object.keys(messageHistory[userId] || {}).map(role => ({ role, parts: messageHistory[userId][role] }))), ...botKnowledge],
    generationConfig: textConfig,
    safetySettings,
  }));
    
  await message.channel.sendTyping();
  
  // Generate response from Gemini model
  const genAIResponse = await (await chat.sendMessage(prompt)).response;
  let text = genAIResponse.text();
  
  if (/\https?:\/\/\S+/gi.test(text)) {
    return "Sorry, I can't assist you with links";
  }

  return text.length > 2000 ? text.slice(0, 1997) + '...' : text;
}

// Function to generate image response based on user input
async function ImageResponse(message, imageUrl, prompt, userId) {
  // Check if user is under cooldown
  const cooldownMessage = await checkCooldown(userId);
  if (cooldownMessage) return cooldownMessage;
  updateCooldown(userId);

  try {
    // Converting image to base64 format
    const imageData = Buffer.from((await axios.get(imageUrl, { responseType: 'arraybuffer' })).data, 'binary').toString('base64');
    const promptConfig = [{ text: prompt || "Tell me about this image" }, { inlineData: { mimeType: "image/jpeg", data: imageData } }];
    await message.channel.sendTyping();
    
    // Generate response from Gemini model
    const genAIResponse = await (await imageModel.generateContent({ contents: [{ role: "user", parts: promptConfig }] })).response;
    let text = genAIResponse.text();
    
    if (/\https?:\/\/\S+/gi.test(text)) {
      return "Sorry, I can't assist you with links";
    }
      
    return text;
  } catch (error) {
    console.log(error);
    return "Oops! Something went wrong while processing the image.";
  }
}

// Function to get text response
async function getTextResponse(message, messageContent, user) {
  const response = await TextResponse(message, messageContent, user.id);
  return translateResponse(response);
}

// Function to get image response
async function getImageResponse(message, imageUrl, prompt, userId) {
  const response = await ImageResponse(message, imageUrl, prompt, userId);
  return translateResponse(response);
}

// Main chatbot function to handle incoming messages
async function chatbot(client, message, settings) {
  try {
    if (!message.guild || message.author.bot) return;

    // Check if message contains bot mention
    const MentionRegex = new RegExp(`^<@!?${message.client.user.id}>`);
    if (message.content.match(MentionRegex)) {
      const messageContent = message.content.replace(MentionRegex, '').trim();
      if (messageContent) {
        const imageUrl = message.attachments.first()?.url;
        return message.safeReply(await (imageUrl && message.attachments.first().height ? getImageResponse(message, imageUrl, messageContent, message.author.id) : getTextResponse(message, messageContent, message.author)));
      }
    }

    // Check if message is in chatbot channel
    if (message.channel.id === settings.chatbotId) {
      const imageUrl = message.attachments.first()?.url;
      return message.safeReply(await (imageUrl && message.attachments.first().height ? getImageResponse(message, imageUrl, message.content, message.author.id) : getTextResponse(message, message.content, message.author)));
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = { chatbot };
