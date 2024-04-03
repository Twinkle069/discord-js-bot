const { botKnowledge, safetySettings } = require("@helpers/botKnowledge");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const aaruTranslator = require("aaru-translator");
const axios = require('axios');

const genAIKey = process.env.GEMINI_API_KEY;
const Translator = true;

let genAI, textModel, imageModel;

const textConfig = {
  maxOutputTokens: 2048,
  temperature: 0.8,
  top_p: 1,
  top_k: 1,
};

const imageConfig = {
  temperature: 0.4,
  topP: 1,
  topK: 32,
  maxOutputTokens: 4096,
};

if (genAIKey) {
  genAI = new GoogleGenerativeAI(genAIKey);
  textModel = genAI.getGenerativeModel({ model: "gemini-pro", textConfig, safetySettings });
  imageModel = genAI.getGenerativeModel({ model: "gemini-pro-vision", imageConfig, safetySettings });
}

const COOLDOWN = 10000;
const messageHistory = {};
const cooldown = {};

async function translateResponse(text) {
  return Translator ? aaruTranslator.translate("auto", "en", text) : text;
}

async function updateCooldown(userId) {
  cooldown[userId] = Date.now() + COOLDOWN;
}

async function checkCooldown(userId) {
  const now = Date.now();
  if (cooldown[userId] && now < cooldown[userId]) {
    const remainingCooldown = Math.ceil((cooldown[userId] - now) / 1000);
    return `Oh no! You need to wait ${remainingCooldown} more seconds before chatting with me again!`;
  }
  return null;
}

async function TextResponse(message, prompt, userId) {
  const cooldownMessage = await checkCooldown(userId);
  if (cooldownMessage) return cooldownMessage;
  updateCooldown(userId);

  const chat = messageHistory[userId] || (messageHistory[userId] = textModel.startChat({
    history: [...(Object.keys(messageHistory[userId] || {}).map(role => ({ role, parts: messageHistory[userId][role] }))), ...botKnowledge],
    generationConfig: textConfig,
    safetySettings,
  }));

  await message.channel.sendTyping();
  const genAIResponse = await (await chat.sendMessage(prompt)).response;
  let text = genAIResponse.text().replace(/\bhttps?:\/\/\S+/gi, '(Sorry, I can\'t assist you with links)');
  return text.length > 2000 ? text.slice(0, 1997) + '...' : text;
}

async function ImageResponse(message, imageUrl, prompt, userId) {
  const cooldownMessage = await checkCooldown(userId);
  if (cooldownMessage) return cooldownMessage;
  updateCooldown(userId);

  try {
    const imageData = Buffer.from((await axios.get(imageUrl, { responseType: 'arraybuffer' })).data, 'binary').toString('base64');
    const promptConfig = [{ text: prompt || "Tell me about this image" }, { inlineData: { mimeType: "image/jpeg", data: imageData } }];
    await message.channel.sendTyping();
    const genAIResponse = await (await imageModel.generateContent({ contents: [{ role: "user", parts: promptConfig }] })).response;
    let text = genAIResponse.text().replace(/\bhttps?:\/\/\S+/gi, '(Sorry, I can\'t assist you with links)');
    return text;
  } catch (error) {
    console.log(error);
    return "Oops! Something went wrong while processing the image.";
  }
}

async function getTextResponse(message, messageContent, user) {
  return TextResponse(message, await translateResponse(messageContent), user.id);
}

async function getImageResponse(message, imageUrl, prompt, userId) {
  return ImageResponse(message, imageUrl, prompt, userId);
}

async function chatbot(client, message, settings) {
  try {
    if (!message.guild || message.author.bot) return;

    const MentionRegex = new RegExp(`^<@!?${message.client.user.id}>`);
    if (message.content.match(MentionRegex)) {
      const messageContent = message.content.replace(MentionRegex, '').trim();
      if (messageContent) {
        const imageUrl = message.attachments.first()?.url;
        return message.safeReply(await (imageUrl && message.attachments.first().height ? getImageResponse(message, imageUrl, messageContent, message.author.id) : getTextResponse(message, messageContent, message.author)));
      }
    }

    if (message.channel.id === settings.chatbotId) {
      const imageUrl = message.attachments.first()?.url;
      return message.safeReply(await (imageUrl && message.attachments.first().height ? getImageResponse(message, imageUrl, message.content, message.author.id) : getTextResponse(message, message.content, message.author)));
    }
  } catch (error) {
    console.log(error);
  }
}

module.exports = { chatbot };
  
