const { ApplicationCommandOptionType, ChannelType, EmbedBuilder } = require("discord.js");
const { EMBED_COLORS } = require("@root/config");

const languages = [
  { name: "Korean", value: "ko" },
  { name: "English", value: "en" },
  { name: "Japanese", value: "ja" },
  { name: "Spanish", value: "es" },
  { name: "French", value: "fr" },
  { name: "German", value: "de" },
  { name: "Italian", value: "it" },
  { name: "Portuguese", value: "pt" },
  { name: "Russian", value: "ru" },
  { name: "Chinese (Simplified)", value: "zh-cn" },
  { name: "Chinese (Traditional)", value: "zh-tw" },
  { name: "Hindi", value: "hi" },
  { name: "Arabic", value: "ar" },
  { name: "Dutch", value: "nl" },
  { name: "Greek", value: "el" },
  { name: "Polish", value: "pl" },
  { name: "Swedish", value: "sv" },
  { name: "Turkish", value: "tr" },
  { name: "Vietnamese", value: "vi" },
  { name: "Finnish", value: "fi" },
  { name: "Danish", value: "da" },
  { name: "Norwegian", value: "no" },
  { name: "Indonesian", value: "id" },
  { name: "Malay", value: "ms" },
  { name: "Bengali", value: "bn" },
];

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "chatbot",
  description: "Setup chatbot channel",
  category: "UTILITY",
  userPermissions: ["ManageGuild"],
  command: {
    enabled: true,
    usage: "<set | delete> <language>",
    minArgsCount: 1,
  },
  slashCommand: {
    enabled: true,
    ephemeral: true,
    options: [
      {
        name: "set",
        description: "Setup the chatbot",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "channel",
            description: "Channels to send mod logs",
            required: false,
            type: ApplicationCommandOptionType.Channel,
            channelTypes: [ChannelType.GuildText],
          },
          {
            name: "language",
            description: "Choose language",
            required: false,
            type: ApplicationCommandOptionType.String,
            choices: languages.map(lang => ({ name: lang.name, value: lang.value })),
          },
        ],
      },
      {
        name: "delete",
        description: "Delete chatbot channel",
        type: ApplicationCommandOptionType.Subcommand,
      },
      {
        name: "language",
        description: "Update chatbot language",
        type: ApplicationCommandOptionType.Subcommand,
        options: [
          {
            name: "select_lang",
            description: "Choose language",
            required: true,
            type: ApplicationCommandOptionType.String,
            choices: languages.map(lang => ({ name: lang.name, value: lang.value })),
          },
        ],
      },
    ],
  },

  async messageRun(message, args) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription("This command is only available as a slash command </chatbot set:1231487088768192596>");

    await message.safeReply({ embeds: [embed] });
  },

  async interactionRun(interaction, data) {
    const response = await chatbot(data, interaction);
    await interaction.followUp(response);
  }
};

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} data
 */
async function chatbot(data, interaction) {
  const subcommand = interaction.options.getSubcommand();
  const settings = data.settings;

  if (subcommand === "set") {
    let Chatchannel = interaction.options.getChannel("channel") || interaction.channel;
    let language = interaction.options.getString("language") ?? "en";

    if (!settings.chatbotId) {
      settings.chatbotId = Chatchannel.id;
      settings.chatbotLang = language;
      await settings.save();

      const langName = getLangName(language);
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription(`Chatbot channel set to ${Chatchannel} with language ${langName}.`);
      
      return { embeds: [embed] };
    } else {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(`Chatbot is already set in this guild. Current channel: <#${settings.chatbotId}>`);
      
      return { embeds: [embed] };
    }
  } else if (subcommand === "delete") {
    if (!data.settings.chatbotId) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription("No chatbot setup found in this guild.");
      
      return { embeds: [embed] };
    }

    settings.chatbotId = undefined;
    settings.chatbotLang = undefined;
    await settings.save();

    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.SUCCESS)
      .setDescription("Chatbot channel deleted successfully.");

    return { embeds: [embed] };
  } else if (subcommand === "language") {
    let language = interaction.options.getString("select_lang") ?? "en";

    if (!settings.chatbotId) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription("No chatbot setup found in this guild.");
      
      return { embeds: [embed] };
    }

    if (language === settings.chatbotLang) {
      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.ERROR)
        .setDescription(`Chatbot language is already set to ${getLangName(language)}.`);
      
      return { embeds: [embed] };
    }

    settings.chatbotLang = language;
    await settings.save();

    const langName = getLangName(language);
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.SUCCESS)
      .setDescription(`Chatbot language updated to ${langName}.`);
    
    return { embeds: [embed] };
  }
}

/**
 * Function to get the language name from the language code
 * @param {string} code - Language code
 * @returns {string} - Language name
 */
function getLangName(code) {
  const language = languages.find(lang => lang.value === code);
  return language ? language.name : "English";
   }
  
