const { ApplicationCommandOptionType, ChannelType, EmbedBuilder } = require("discord.js");
const { EMBED_COLORS } = require("@root/config");

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
    usage: "set [channel ID] or chatbot delete",
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
        ],
      },
      {
        name: "delete",
        description: "Delete chatbot channel",
        type: ApplicationCommandOptionType.Subcommand,
      },
    ],
  },

  async messageRun(message, args, data) {
    const input = args[0].toLowerCase();
    const response = await chatbot(message, input, data);
    await message.safeReply(response);
  },
    
  async interactionRun(interaction, data) {
    const subcommand = interaction.options.getSubcommand();
    const response = await chatbot(interaction, subcommand, data);
    await interaction.followUp(response);
  },
};

/**
 * @param {import("discord.js").CommandInteraction|import("discord.js").Message} arg0
 * @param {string} input
 */
async function chatbot({ client, guildId, options, channel }, input, data) {
  if (input !== "set" && input !== "delete") {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription("Invalid option. Please use `set` or `delete`.");

    return { embeds: [embed] };
  }

  const sub = input;

  try {
    if (sub === "set") {
      let targetChannel = options?.getChannel("channel") || channel;

      if (!data.settings.chatbotId) {
        data.settings.chatbotId = targetChannel.id;
        await data.settings.save();

        const embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.SUCCESS)
          .setDescription(`Chatbot channel set to ${targetChannel}.`);
        
        return { embeds: [embed] };
      } else {
        const embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.ERROR)
          .setDescription(`Chatbot is already set in this guild. Current channel: <#${data.settings.chatbotId}>`);
        
        return { embeds: [embed] };
      }
    } else if (sub === "delete") {
      if (!data.settings.chatbotId) {
        const embed = new EmbedBuilder()
          .setColor(EMBED_COLORS.ERROR)
          .setDescription("No chatbot setup found in this guild.");
        
        return { embeds: [embed] };
      }

      data.settings.chatbotId = undefined;
      await data.settings.save();

      const embed = new EmbedBuilder()
        .setColor(EMBED_COLORS.SUCCESS)
        .setDescription("Chatbot channel deleted successfully.");

      return { embeds: [embed] };
    }
  } catch (error) {
    const embed = new EmbedBuilder()
      .setColor(EMBED_COLORS.ERROR)
      .setDescription(`Failed to perform the operation. Error: ${error.message}`);

    return { embeds: [embed] };
  }
}
