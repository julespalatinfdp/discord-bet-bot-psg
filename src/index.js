require("dotenv").config();
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
} = require("discord.js");

const {
  appendBet,
  hasBet,
  isBettingClosed,
  closeBetting,
  createMatch,
  setResult,
  getClassement,
  getRankingMessageId,
  setRankingMessageId,
  getMatchMeta,
  parseKickoff,
} = require("./db");
const { buildLeaderboardEmbed } = require("./leaderboard");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once("ready", () => {
  console.log(`Bot connecte : ${client.user.tag}`);

  setInterval(() => {
    const fs = require("fs");
    const path = require("path");
    const dbPath = path.join(__dirname, "..", "data", "db.json");
    try {
      const data = JSON.parse(fs.readFileSync(dbPath, "utf8"));
      let changed = false;
      for (const match of Object.values(data.matches)) {
        if (!match.forceClosed && match.kickoff && Date.now() >= match.kickoff) {
          match.forceClosed = true;
          changed = true;
          console.log(`Pronos fermes automatiquement : ${match.team1} vs ${match.team2}`);
        }
      }
      if (changed) fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("[scheduler]", err.message);
    }
  }, 30_000);
});

async function refreshRankingChannel(players) {
  const channelId = process.env.DISCORD_RANKING_CHANNEL_ID;
  if (!channelId) return;
  try {
    const channel = await client.channels.fetch(channelId);
    const embed = buildLeaderboardEmbed(players);
    const storedId = getRankingMessageId();
    if (storedId) {
      try {
        const msg = await channel.messages.fetch(storedId);
        await msg.edit({ embeds: [embed] });
        return;
      } catch { }
    }
    const newMsg = await channel.send({ embeds: [embed] });
    setRankingMessageId(newMsg.id);
  } catch (err) {
    console.error("[refreshRankingChannel]", err.message);
  }
}

function formatKickoff(tsMs) {
  if (!tsMs) return null;
  const secs = Math.floor(tsMs / 1000);
  return `<t:${secs}:F> (<t:${secs}:R>)`;
}

client.on("interactionCreate", async (interaction) => {
  try {

    // /create-match
    if (interaction.isChatInputCommand() && interaction.commandName === "create-match") {
      const team1      = interaction.options.getString("equipe1");
      const team2      = interaction.options.getString("equipe2");
      const emoji1     = interaction.options.getString("emoji1");
      const emoji2     = interaction.options.getString("emoji2");
      const kickoffStr = interaction.options.getString("kickoff");
      const imageUrl   = interaction.options.getString("image") || null;

      const kickoffTs = parseKickoff(kickoffStr);
      if (!kickoffTs) {
        return interaction.reply({
          content: "Format de date invalide. Utilise : `2026-06-20 21:00` (heure de Paris)",
          ephemeral: true,
        });
      }

      createMatch({ team1, team2, emoji1, emoji2, kickoff: kickoffTs });
      const kickoffDisplay = formatKickoff(kickoffTs);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji1} ${team1}  vs  ${team2} ${emoji2}`)
        .setDescription(
          `**Mondial 2026**\n\n` +
          `Qui va remporter ce match ? Quel sera le score ?\n` +
          `Clique sur le bouton pour placer ton prono !\n\n` +
          `> 🎯 **+5 pts** - bon resultat (ou nul)\n` +
          `> 💎 **+10 pts** - score exact en plus\n\n` +
          `⏰ **Coup d'envoi :** ${kickoffDisplay}\n` +
          `🔒 **Les pronos ferment au coup d'envoi**`
        )
        .setColor(0x004170);

      if (imageUrl) embed.setThumbnail(imageUrl);

      const button = new ButtonBuilder()
        .setCustomId(`bet:fr:${team1}:${team2}`)
        .setLabel("🎯 Fais ton prono !")
        .setStyle(ButtonStyle.Primary);

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
      });
    }

    // /create-match-en
    if (interaction.isChatInputCommand() && interaction.commandName === "create-match-en") {
      const team1      = interaction.options.getString("equipe1");
      const team2      = interaction.options.getString("equipe2");
      const emoji1     = interaction.options.getString("emoji1");
      const emoji2     = interaction.options.getString("emoji2");
      const kickoffStr = interaction.options.getString("kickoff");
      const imageUrl   = interaction.options.getString("image") || null;

      const kickoffTs = parseKickoff(kickoffStr);
      if (!kickoffTs) {
        return interaction.reply({
          content: "Invalid date format. Use: `2026-06-20 21:00` (Paris time)",
          ephemeral: true,
        });
      }

      createMatch({ team1, team2, emoji1, emoji2, kickoff: kickoffTs });
      const kickoffDisplay = formatKickoff(kickoffTs);

      const embed = new EmbedBuilder()
        .setTitle(`${emoji1} ${team1}  vs  ${team2} ${emoji2}`)
        .setDescription(
          `**World Cup 2026**\n\n` +
          `Who will win this match? What will the score be?\n` +
          `Click the button to place your prediction!\n\n` +
          `> 🎯 **+5 pts** - correct result (or draw)\n` +
          `> 💎 **+10 pts** - exact score bonus\n\n` +
          `⏰ **Kick-off:** ${kickoffDisplay}\n` +
          `🔒 **Predictions close at kick-off**`
        )
        .setColor(0x004170);

      if (imageUrl) embed.setThumbnail(imageUrl);

      const button = new ButtonBuilder()
        .setCustomId(`bet:en:${team1}:${team2}`)
        .setLabel("🎯 Make your prediction!")
        .setStyle(ButtonStyle.Primary);

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(button)],
      });
    }

    // /set-result
    if (interaction.isChatInputCommand() && interaction.commandName === "set-result") {
      await interaction.deferReply();
      const team1  = interaction.options.getString("equipe1");
      const team2  = interaction.options.getString("equipe2");
      const goals1 = interaction.options.getInteger("buts1");
      const goals2 = interaction.options.getInteger("buts2");

      let data;
      try {
        data = setResult(team1, team2, goals1, goals2);
      } catch (err) {
        return interaction.editReply(`❌ ${err.message}`);
      }

      const { results, realWinner, g1, g2 } = data;
      const meta = getMatchMeta(team1, team2);
      const e1 = meta?.emoji1 || "";
      const e2 = meta?.emoji2 || "";

      const embed = new EmbedBuilder()
        .setTitle(`Resultat : ${e1} ${team1} vs ${team2} ${e2}`)
        .setColor(0x22c55e)
        .addFields({
          name: "Score final",
          value: `**${e1} ${team1} ${g1} - ${g2} ${team2} ${e2}** : Vainqueur : **${realWinner}**`,
        });

      if (results.length === 0) {
        embed.addFields({ name: "Pronos", value: "Aucun prono enregistre sur ce match." });
      } else {
        const lines = [...results]
          .sort((a, b) => b.points - a.points)
          .map(({ username, points }) => {
            const emoji = points === 15 ? "💎" : points === 5 ? "🎯" : "😔";
            return `${emoji} **${username}** : +${points} pt${points !== 1 ? "s" : ""}`;
          });
        embed.addFields({
          name: `Points attribues (${results.length} prono${results.length > 1 ? "s" : ""})`,
          value: lines.join("\n"),
        });
      }

      await interaction.editReply({ embeds: [embed] });
      const players = getClassement();
      await refreshRankingChannel(players);
    }

    // /classement
    if (interaction.isChatInputCommand() && interaction.commandName === "classement") {
      const players = getClassement();
      const embed = buildLeaderboardEmbed(players);
      await interaction.reply({ embeds: [embed] });
    }

    // /close-match
    if (interaction.isChatInputCommand() && interaction.commandName === "close-match") {
      const team1 = interaction.options.getString("equipe1");
      const team2 = interaction.options.getString("equipe2");
      try {
        closeBetting(team1, team2);
        await interaction.reply({
          content: `🔒 Pronos fermes manuellement pour **${team1} vs ${team2}**.`,
          ephemeral: true,
        });
      } catch (err) {
        await interaction.reply({ content: `❌ ${err.message}`, ephemeral: true });
      }
    }

    // /reset
    if (interaction.isChatInputCommand() && interaction.commandName === "reset") {
      const fs = require("fs");
      const path = require("path");
      const dbPath = path.join(__dirname, "..", "data", "db.json");
      fs.writeFileSync(dbPath, JSON.stringify({ matches: {}, players: {}, meta: {} }, null, 2));
      await interaction.reply({ content: "Toutes les donnees ont ete reinitialisees.", ephemeral: true });
    }

    // Bouton FR
    if (interaction.isButton() && interaction.customId.startsWith("bet:fr:")) {
      const parts = interaction.customId.split(":");
      const team1 = parts[2];
      const team2 = parts[3];

      if (isBettingClosed(team1, team2)) {
        const meta = getMatchMeta(team1, team2);
        const e1 = meta?.emoji1 || "";
        const e2 = meta?.emoji2 || "";
        return interaction.reply({
          content: `🔒 Les pronos pour **${e1} ${team1} vs ${team2} ${e2}** sont fermes - le match a commence !`,
          ephemeral: true,
        });
      }

      if (hasBet(team1, team2, interaction.user.id)) {
        return interaction.reply({
          content: "Tu as deja place un prono sur ce match. Un seul prono est autorise !",
          ephemeral: true,
        });
      }

      const meta = getMatchMeta(team1, team2);
      const e1 = meta?.emoji1 || "";
      const e2 = meta?.emoji2 || "";

      const modalTitle = `${e1} ${team1} vs ${team2} ${e2}`.slice(0, 45);
      const modal = new ModalBuilder()
        .setCustomId(`modal:fr:${team1}:${team2}`)
        .setTitle(modalTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("goals1")
            .setLabel(`Buts ${e1} ${team1}`)
            .setPlaceholder("Ex : 2")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("goals2")
            .setLabel(`Buts ${e2} ${team2}`)
            .setPlaceholder("Ex : 1")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2)
        )
      );

      await interaction.showModal(modal);
    }

    // Bouton EN
    if (interaction.isButton() && interaction.customId.startsWith("bet:en:")) {
      const parts = interaction.customId.split(":");
      const team1 = parts[2];
      const team2 = parts[3];

      if (isBettingClosed(team1, team2)) {
        const meta = getMatchMeta(team1, team2);
        const e1 = meta?.emoji1 || "";
        const e2 = meta?.emoji2 || "";
        return interaction.reply({
          content: `🔒 Predictions for **${e1} ${team1} vs ${team2} ${e2}** are closed - the match has started!`,
          ephemeral: true,
        });
      }

      if (hasBet(team1, team2, interaction.user.id)) {
        return interaction.reply({
          content: "You already placed a prediction on this match. Only one prediction allowed!",
          ephemeral: true,
        });
      }

      const meta = getMatchMeta(team1, team2);
      const e1 = meta?.emoji1 || "";
      const e2 = meta?.emoji2 || "";

      const modalTitle = `${e1} ${team1} vs ${team2} ${e2}`.slice(0, 45);
      const modal = new ModalBuilder()
        .setCustomId(`modal:en:${team1}:${team2}`)
        .setTitle(modalTitle);

      modal.addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("goals1")
            .setLabel(`Goals ${e1} ${team1}`)
            .setPlaceholder("e.g. 2")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2)
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId("goals2")
            .setLabel(`Goals ${e2} ${team2}`)
            .setPlaceholder("e.g. 1")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(2)
        )
      );

      await interaction.showModal(modal);
    }

    // Soumission modale FR
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId.startsWith("modal:fr:")
    ) {
      const parts = interaction.customId.split(":");
      const team1 = parts[2];
      const team2 = parts[3];

      if (isBettingClosed(team1, team2)) {
        return interaction.reply({
          content: "🔒 Les pronos sont fermes pour ce match - le coup d'envoi a ete donne !",
          ephemeral: true,
        });
      }

      const goals1Raw = interaction.fields.getTextInputValue("goals1").trim();
      const goals2Raw = interaction.fields.getTextInputValue("goals2").trim();

      if (!/^\d{1,2}$/.test(goals1Raw) || !/^\d{1,2}$/.test(goals2Raw)) {
        return interaction.reply({
          content: "Les scores doivent etre des nombres entiers (ex: `2` et `1`).",
          ephemeral: true,
        });
      }

      const goals1 = parseInt(goals1Raw);
      const goals2 = parseInt(goals2Raw);
      const meta = getMatchMeta(team1, team2);
      const e1 = meta?.emoji1 || "";
      const e2 = meta?.emoji2 || "";

      try {
        appendBet({
          team1, team2,
          username: interaction.user.username,
          userId: interaction.user.id,
          goals1, goals2,
        });
      } catch (err) {
        return interaction.reply({ content: `Erreur : ${err.message}`, ephemeral: true });
      }

      const winner = goals1 > goals2 ? `${e1} ${team1}` : goals1 < goals2 ? `${e2} ${team2}` : "Match nul 🤝";

      const embed = new EmbedBuilder()
        .setTitle("✅ Prono enregistre !")
        .setColor(0x22c55e)
        .addFields(
          { name: "Match", value: `**${e1} ${team1}** vs **${team2} ${e2}**` },
          { name: "Score predit", value: `**${e1} ${team1} ${goals1} - ${goals2} ${team2} ${e2}**`, inline: true },
          { name: "Resultat predit", value: winner, inline: true },
          { name: "Points en jeu", value: `🎯 **+5 pts** si bon resultat\n💎 **+10 pts** si score exact` }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

    // Soumission modale EN
    if (
      interaction.type === InteractionType.ModalSubmit &&
      interaction.customId.startsWith("modal:en:")
    ) {
      const parts = interaction.customId.split(":");
      const team1 = parts[2];
      const team2 = parts[3];

      if (isBettingClosed(team1, team2)) {
        return interaction.reply({
          content: "🔒 Predictions are now closed for this match - kick-off has been given!",
          ephemeral: true,
        });
      }

      const goals1Raw = interaction.fields.getTextInputValue("goals1").trim();
      const goals2Raw = interaction.fields.getTextInputValue("goals2").trim();

      if (!/^\d{1,2}$/.test(goals1Raw) || !/^\d{1,2}$/.test(goals2Raw)) {
        return interaction.reply({
          content: "Scores must be whole numbers (e.g. `2` and `1`).",
          ephemeral: true,
        });
      }

      const goals1 = parseInt(goals1Raw);
      const goals2 = parseInt(goals2Raw);
      const meta = getMatchMeta(team1, team2);
      const e1 = meta?.emoji1 || "";
      const e2 = meta?.emoji2 || "";

      try {
        appendBet({
          team1, team2,
          username: interaction.user.username,
          userId: interaction.user.id,
          goals1, goals2,
        });
      } catch (err) {
        return interaction.reply({ content: `Error: ${err.message}`, ephemeral: true });
      }

      const winner = goals1 > goals2 ? `${e1} ${team1}` : goals1 < goals2 ? `${e2} ${team2}` : "Draw 🤝";

      const embed = new EmbedBuilder()
        .setTitle("✅ Prediction saved!")
        .setColor(0x22c55e)
        .addFields(
          { name: "Match", value: `**${e1} ${team1}** vs **${team2} ${e2}**` },
          { name: "Predicted score", value: `**${e1} ${team1} ${goals1} - ${goals2} ${team2} ${e2}**`, inline: true },
          { name: "Predicted result", value: winner, inline: true },
          { name: "Points at stake", value: `🎯 **+5 pts** correct result\n💎 **+10 pts** exact score` }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }

  } catch (err) {
    console.error("[interactionCreate]", err);
  }
});

client.on("error", (err) => {
  console.error("[client error]", err.message);
});

process.on("unhandledRejection", (err) => {
  console.error("[unhandledRejection]", err);
});

client.login(process.env.DISCORD_TOKEN);
