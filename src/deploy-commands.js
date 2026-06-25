const { REST, Routes, SlashCommandBuilder } = require("discord.js");
require("dotenv").config();

const commands = [
  new SlashCommandBuilder()
    .setName("create-match")
    .setDescription("[Admin] Creer un match et poster l'embed de pronos")
    .addStringOption((o) => o.setName("equipe1").setDescription("Nom equipe 1").setRequired(true))
    .addStringOption((o) => o.setName("equipe2").setDescription("Nom equipe 2").setRequired(true))
    .addStringOption((o) => o.setName("emoji1").setDescription("Emoji equipe 1").setRequired(true))
    .addStringOption((o) => o.setName("emoji2").setDescription("Emoji equipe 2").setRequired(true))
    .addStringOption((o) => o.setName("kickoff").setDescription("Heure coup d'envoi : 2026-06-20 21:00").setRequired(true))
    .addStringOption((o) => o.setName("image").setDescription("URL image thumbnail (optionnel)").setRequired(false))
    .setDefaultMemberPermissions(0x8)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("set-result")
    .setDescription("[Admin] Enregistrer le score reel et distribuer les points")
    .addStringOption((o) => o.setName("equipe1").setDescription("Nom exact equipe 1").setRequired(true))
    .addStringOption((o) => o.setName("equipe2").setDescription("Nom exact equipe 2").setRequired(true))
    .addIntegerOption((o) => o.setName("buts1").setDescription("Buts equipe 1").setRequired(true).setMinValue(0))
    .addIntegerOption((o) => o.setName("buts2").setDescription("Buts equipe 2").setRequired(true).setMinValue(0))
    .setDefaultMemberPermissions(0x8)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("classement")
    .setDescription("Affiche le classement general")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("close-match")
    .setDescription("[Admin] Fermer manuellement les pronos d'un match")
    .addStringOption((o) => o.setName("equipe1").setDescription("Nom exact equipe 1").setRequired(true))
    .addStringOption((o) => o.setName("equipe2").setDescription("Nom exact equipe 2").setRequired(true))
    .setDefaultMemberPermissions(0x8)
    .toJSON(),

  new SlashCommandBuilder()
    .setName("reset")
    .setDescription("[Admin] Reinitialiser toutes les donnees")
    .setDefaultMemberPermissions(0x8)
    .toJSON(),
];

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("Deploiement des commandes...");
    await rest.put(
      Routes.applicationGuildCommands(
        process.env.DISCORD_CLIENT_ID,
        process.env.DISCORD_GUILD_ID
      ),
      { body: commands }
    );
    console.log("5 commandes deployees : /create-match /set-result /classement /close-match /reset");
  } catch (err) {
    console.error(err);
  }
})();
