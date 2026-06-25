const { EmbedBuilder } = require("discord.js");
const MEDALS = ["🥇", "🥈", "🥉"];

function buildLeaderboardEmbed(players) {
  const embed = new EmbedBuilder()
    .setTitle("🏆 Classement Mondial 2026")
    .setColor(0x004170);

  if (players.length === 0) {
    embed.setDescription("Aucun point attribue pour l'instant.\nLes pronos sont ouverts !");
    return embed;
  }

  const TOP_N = 20;
  const top = players.slice(0, TOP_N);
  const rest = players.slice(TOP_N);

  const lines = top.map(({ rank, username, total }) => {
    const medal = rank <= 3 ? MEDALS[rank - 1] : `**${rank}.**`;
    const pts = `${total} pt${total > 1 ? "s" : ""}`;
    return `${medal} **${username}** - ${pts}`;
  });

  embed.setDescription(lines.join("\n"));

  if (rest.length > 0) {
    embed.addFields({
      name: `+ ${rest.length} autre${rest.length > 1 ? "s" : ""} participant${rest.length > 1 ? "s" : ""}`,
      value: `Du rang **${rest[0].rank}** au rang **${rest[rest.length - 1].rank}** (${rest[rest.length - 1].total} a ${rest[0].total} pts)`,
    });
  }

  return embed;
}

module.exports = { buildLeaderboardEmbed };
