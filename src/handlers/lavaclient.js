const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, GatewayDispatchEvents } = require("discord.js");
const { Cluster } = require("lavaclient");
const prettyMs = require("pretty-ms");
require("@lavaclient/plugin-queue/register");

/**
 * @param {import("@structures/BotClient")} client
 */
module.exports = (client) => {
  const lavaclient = new Cluster({
    nodes: client.config.MUSIC.LAVALINK_NODES.map(node => ({
      ...node,
      info: {
        host: node.host,
        port: node.port,
        auth: node.auth,
      },
      ws: {
        clientName: "Strange",
        resuming: true,
        reconnecting: {
          tries: Infinity,
          delay: (attempt) => attempt * 1000
        }
      }
    })),
    discord: {
      sendGatewayCommand: (id, payload) => client.guilds.cache.get(id)?.shard?.send(payload),
    },
  });

  client.ws.on(GatewayDispatchEvents.VoiceStateUpdate, (data) => lavaclient.players.handleVoiceUpdate(data));
  client.ws.on(GatewayDispatchEvents.VoiceServerUpdate, (data) => lavaclient.players.handleVoiceUpdate(data));
    
  // Creating Buttons
  const bPause = new ButtonBuilder()
    .setCustomId("Button_Pause")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("▶️");
  const bSkip = new ButtonBuilder()
    .setCustomId("Button_Skip")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("⏭️");
  const bStop = new ButtonBuilder()
    .setCustomId("Button_Stop")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("⏹");
  const bLoop = new ButtonBuilder()
    .setCustomId("Button_Loop")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("🔃");
  const bShuffle = new ButtonBuilder()
    .setCustomId("Button_Shuffle")
    .setStyle(ButtonStyle.Secondary)
    .setEmoji("🔀");

  const buttonRow = new ActionRowBuilder()
    .addComponents(bLoop, bPause, bStop, bSkip, bShuffle);
    
  lavaclient.on("nodeConnected", (node, event) => {
    client.logger.log(`Node "${node.identifier}" connected`);
  });

  lavaclient.on("nodeDisconnected", (node, event) => {
    client.logger.log(`Node "${node.identifier}" disconnected`);
  });

  lavaclient.on("nodeError", (node, error) => {
    client.logger.error(`Node "${node.identifier}" encountered an error: ${error.message}.`, error);
  });

  lavaclient.on("nodeTrackStart", async (_node, queue, track) => {
    const fields = [];
    const embed = new EmbedBuilder()
      .setAuthor({ name: "Now Playing" })
      .setColor(client.config.EMBED_COLORS.BOT_EMBED)
      .setDescription(`[${track.info.title}](${track.info.uri})`)
      .setFooter({ text: `Requested By: ${track.requesterId}` })
      .setThumbnail(track.info.artworkUrl);

    fields.push({
      name: "Song Duration",
      value: "`" + prettyMs(track.info.length, { colonNotation: true }) + "`",
      inline: true,
    });

    if (queue.tracks.length > 0) {
      fields.push({
        name: "Position in Queue",
        value: (queue.tracks.length + 1).toString(),
        inline: true,
      });
    }

    embed.setFields(fields);
    queue.data.channel.safeSend({ embeds: [embed], components: [buttonRow] }).then(message => {
      queue.data.messageIds = message;
    });
  });

  lavaclient.on("nodeQueueFinish", async (_node, queue) => {
    const message = queue.data.messageIds;
    if (message) {
      await message.delete().catch(() => {});
    }

    const guildId = queue.data.channel.guildId;
    const player = lavaclient.players.resolve(guildId);

    if (!player.autoplay) {
      const embed = new EmbedBuilder()
        .setColor(client.config.EMBED_COLORS.BOT_EMBED)
        .setTitle("Queue Concluded")
        .setDescription("Enjoying music with me? Consider [**Inviting**](https://aarubot.xyz/invite) me");
      
      const conclude = await queue.data.channel.send({ embeds: [embed] });
      
      setTimeout(() => conclude.delete(), 20000).catch(() => {});

      await client.musicManager.players.destroy(guildId).then(() => queue.player.voice.disconnect());
    } else {
      // Call autoplay if it is enabled
      await autoplay(client, guildId);
    }
  });

  // Function to handle autoplay
  async function autoplay(client, guildId) {
    const player = lavaclient.players.resolve(guildId);
    let identifier;
    if (player.queue.current) {
      identifier = player.queue.current.info.identifier;
    } else {
      identifier = "lpeuIu-ZYJY"; // fallback identifier
    }

    const url = `https://youtube.com/watch?v=${identifier}&list=RD${identifier}`;
    const res = await lavaclient.api.loadTracks(url);
    const metadata = res?.data?.tracks;

    if (!metadata || metadata.length === 0) {
      return lavaclient.players.destroy(guildId);
    }

    const randomIndex = Math.floor(Math.random() * metadata.length);
    const choose = metadata[randomIndex];
    player.queue.add(choose, { requester: client.user.displayName, next: false });

    const started = player.playing || player.paused;
    if (!started) {
      await player.queue.start();
    }
  }

  client.autoplay = autoplay;

  return lavaclient;
};
