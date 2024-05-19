const { musicValidations } = require("@helpers/BotUtils");
const { EmbedBuilder, ApplicationCommandOptionType } = require("discord.js");

/**
 * @type {import("@structures/Command")}
 */
module.exports = {
  name: "autoplay",
  description: "Toggle autoplay feature for music player",
  category: "MUSIC",
  validations: musicValidations,
  command: {
    enabled: true,
    usage: "",
  },
  slashCommand: {
    enabled: true,
    options: [],
  },

  async messageRun(message, args) {
    const response = await toggleAutoplay(message.client, message.guild.id);
    await message.safeReply(response);
  },

  async interactionRun(interaction) {
    const response = await toggleAutoplay(interaction.client, interaction.guild.id);
    await interaction.followUp(response);
  },
};

async function toggleAutoplay(client, guildId) {
  const player = client.musicManager.players.resolve(guildId);
  let description;

  if (player.autoplay) {
    player.autoplay = false;
    description = "Autoplay has been disabled.";
  } else {
    player.autoplay = true;
    description = "Autoplay has been enabled.";
  }

  const embed = new EmbedBuilder()
    .setColor(client.config.EMBED_COLORS.BOT_EMBED)
    .setDescription(description);

  return { embeds: [embed] };
}
