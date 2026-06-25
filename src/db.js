const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "data", "db.json");

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ matches: {}, players: {}, meta: {} }, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function writeDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function matchKey(team1, team2) {
  return `${team1}__${team2}`;
}

function resolveWinner(team1, team2, g1, g2) {
  if (g1 > g2) return team1;
  if (g2 > g1) return team2;
  return "Nul";
}

function parseKickoff(str) {
  const m = str.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (!m) return null;
  const iso = `${m[1]}T${m[2]}:00+02:00`;
  const ts = Date.parse(iso);
  return isNaN(ts) ? null : ts;
}

function hasBet(team1, team2, userId) {
  const db = readDb();
  const key = matchKey(team1, team2);
  const match = db.matches[key];
  if (!match) return false;
  return match.bets.some((b) => b.userId === userId);
}

function isBettingClosed(team1, team2) {
  const db = readDb();
  const key = matchKey(team1, team2);
  const match = db.matches[key];
  if (!match) return false;
  if (match.forceClosed) return true;
  if (!match.kickoff) return false;
  return Date.now() >= match.kickoff;
}

function closeBetting(team1, team2) {
  const db = readDb();
  const key = matchKey(team1, team2);
  if (!db.matches[key]) throw new Error(`Match introuvable : ${team1} vs ${team2}`);
  db.matches[key].forceClosed = true;
  writeDb(db);
}

function createMatch({ team1, team2, emoji1, emoji2, kickoff }) {
  const db = readDb();
  const key = matchKey(team1, team2);
  if (!db.matches[key]) {
    db.matches[key] = {
      team1, team2,
      emoji1: emoji1 || "",
      emoji2: emoji2 || "",
      kickoff: kickoff || null,
      forceClosed: false,
      result: null,
      bets: [],
    };
    writeDb(db);
  }
}

function appendBet({ team1, team2, username, userId, goals1, goals2 }) {
  const g1 = parseInt(goals1);
  const g2 = parseInt(goals2);
  const db = readDb();
  const key = matchKey(team1, team2);
  if (!db.matches[key]) {
    db.matches[key] = { team1, team2, emoji1: "", emoji2: "", kickoff: null, forceClosed: false, result: null, bets: [] };
  }
  db.matches[key].bets.push({
    username,
    userId,
    goals1: g1,
    goals2: g2,
    winner: resolveWinner(team1, team2, g1, g2),
    points: null,
    date: new Date().toISOString(),
  });
  writeDb(db);
}

function setResult(team1, team2, realGoals1, realGoals2) {
  const g1 = parseInt(realGoals1);
  const g2 = parseInt(realGoals2);
  if (isNaN(g1) || isNaN(g2)) throw new Error("Scores invalides.");
  const db = readDb();
  const key = matchKey(team1, team2);
  if (!db.matches[key]) throw new Error(`Aucun match trouve pour **${team1} vs ${team2}**. Verifie les noms (sensible a la casse).`);
  if (db.matches[key].result) throw new Error(`Le resultat de ce match a deja ete enregistre.`);
  const realWinner = resolveWinner(team1, team2, g1, g2);
  db.matches[key].result = { g1, g2, winner: realWinner };
  const results = [];
  for (const bet of db.matches[key].bets) {
    let points = 0;
    if (bet.winner === realWinner) points += 5;
    if (bet.goals1 === g1 && bet.goals2 === g2) points += 10;
    bet.points = points;
    if (!db.players[bet.userId]) {
      db.players[bet.userId] = { username: bet.username, total: 0 };
    }
    db.players[bet.userId].username = bet.username;
    db.players[bet.userId].total += points;
    results.push({ username: bet.username, userId: bet.userId, points });
  }
  writeDb(db);
  return { results, realWinner, g1, g2 };
}

function getClassement() {
  const db = readDb();
  return Object.entries(db.players)
    .map(([userId, { username, total }]) => ({ userId, username, total }))
    .sort((a, b) => b.total - a.total)
    .map((p, i) => ({ rank: i + 1, ...p }));
}

function getRankingMessageId() {
  return readDb().meta.rankingMessageId || null;
}

function setRankingMessageId(id) {
  const db = readDb();
  db.meta.rankingMessageId = id;
  writeDb(db);
}

function getMatchMeta(team1, team2) {
  const db = readDb();
  const key = matchKey(team1, team2);
  return db.matches[key] || null;
}

module.exports = {
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
};
