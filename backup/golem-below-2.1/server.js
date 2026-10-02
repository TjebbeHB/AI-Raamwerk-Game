const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const os = require("os");
const gameApi = require("./game/local-api.cjs");

const PORT = Number(process.env.PORT || 5173);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const DATA_FILE = path.join(DATA_DIR, "sessions.json");

const MAX_PLAYERS = 15;
const LEVELS = [
  "probleem-en-noodzaak",
  "mens-assistent-relatie",
  "ai-kader-proef",
  "implementatiepact"
];

const SCORE_LABELS = {
  publicValue: "Publieke waarde",
  lawful: "Rechtmatigheid",
  humanControl: "Menselijke regie",
  transparency: "Transparantie",
  reliability: "Betrouwbaarheid"
};

const SOLUTION_TYPES = {
  physical: "Niet-AI of fysieke oplossing",
  digital: "Digitaal zonder AI",
  ai: "AI-gestuurde toepassing",
  hybrid: "Hybride oplossing"
};

const FINAL_DECISIONS = {
  stop: "Stoppen of niet-AI route kiezen",
  research: "Verder onderzoeken",
  pilot: "Beperkte pilot starten",
  procure: "Inkoop of aanbesteding voorbereiden",
  scale: "Opschalen met beheersmaatregelen"
};

const CHALLENGE_LABELS = {
  aiActRisk: "AI Act risicopoort",
  rightsImpact: "Rechten en publieke waarden",
  dataPrivacy: "Data, privacy en kwaliteit",
  transparency: "Uitleg en register",
  humanControl: "Menselijke regie",
  procurementLifecycle: "Inkoop en levenscyclus"
};

const RELATION_LABELS = {
  tools: "Tools",
  chat: "Chat",
  agents: "Agents",
  copilots: "Copilot",
  "dedicated-tools": "Specifieke tool",
  "workflow-tools": "Workflow tool",
  "inline-tools": "Inline tool",
  sculpters: "Sculpter",
  characters: "Character",
  assistants: "Assistent",
  npcs: "NPC",
  "bespoke-uis": "Bespoke UI",
  "intelligent-canvases": "Intelligent canvas",
  taskers: "Tasker",
  alchemists: "Alchemist",
  stewards: "Steward",
  conductors: "Conductor",
  copilot: "Copilot"
};

const SOURCE_LINKS = [
  ["Algoritmekader", "https://minbzk.github.io/Algoritmekader/"],
  ["Digitale Overheid: Algoritmekader", "https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmekader/"],
  ["EU AI Act", "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai"],
  ["Algoritmeregister", "https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmeregister/"]
];

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const defaultScores = () => ({
  publicValue: 1,
  lawful: 1,
  humanControl: 1,
  transparency: 1,
  reliability: 1
});

const challengeSeed = () => ({
  aiActRisk: emptyChallenge("aiActRisk"),
  rightsImpact: emptyChallenge("rightsImpact"),
  dataPrivacy: emptyChallenge("dataPrivacy"),
  transparency: emptyChallenge("transparency"),
  humanControl: emptyChallenge("humanControl"),
  procurementLifecycle: emptyChallenge("procurementLifecycle")
});

function emptyChallenge(id) {
  return {
    id,
    answers: [],
    resolved: null
  };
}

function newSession(code) {
  const now = new Date().toISOString();
  return {
    code,
    createdAt: now,
    updatedAt: now,
    currentLevel: 0,
    unlockedLevel: 0,
    adminId: null,
    players: [],
    votingEnabled: true,
    scores: defaultScores(),
    log: [],
    levels: {
      "probleem-en-noodzaak": {
        prompts: {
          problem: [],
          goal: [],
          stakeholders: [],
          alternatives: []
        },
        selected: {},
        solutionType: null,
        stopReason: ""
      },
      "mens-assistent-relatie": {
        archetype: null,
        role: null,
        answers: []
      },
      "ai-kader-proef": {
        challenges: challengeSeed()
      },
      implementatiepact: {
        actions: [],
        finalDecision: "pilot",
        owner: "",
        reviewDate: ""
      }
    }
  };
}

function readStore() {
  try {
    const text = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(text);
  } catch (error) {
    return { sessions: {} };
  }
}

function writeStore(store) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = `${DATA_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

const store = readStore();

function save() {
  writeStore(store);
}

function getSession(code) {
  const normalized = normalizeCode(code);
  if (!store.sessions[normalized]) {
    store.sessions[normalized] = newSession(normalized);
    save();
  }
  return store.sessions[normalized];
}

function normalizeCode(code) {
  return String(code || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 18) || randomCode();
}

function randomCode() {
  return crypto.randomBytes(3).toString("hex").toUpperCase();
}

function publicSession(session, viewerId = null) {
  return {
    ...session,
    isAdmin: viewerId ? session.adminId === viewerId : false
  };
}

function addLog(session, actorId, text) {
  const actor = session.players.find((player) => player.id === actorId);
  session.log.unshift({
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    actor: actor ? actor.name : "Systeem",
    text
  });
  session.log = session.log.slice(0, 60);
}

function assertAdmin(session, playerId) {
  if (session.adminId !== playerId) {
    const error = new Error("Alleen de facilitator kan deze stap uitvoeren.");
    error.status = 403;
    throw error;
  }
}

function touch(session) {
  session.updatedAt = new Date().toISOString();
}

function sanitizeText(value, max = 900) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function findNote(session, levelId, promptId, noteId) {
  const prompt = session.levels[levelId]?.prompts?.[promptId];
  if (!prompt) return null;
  return prompt.find((note) => note.id === noteId);
}

function findChallenge(session, challengeId) {
  return session.levels["ai-kader-proef"].challenges[challengeId] || null;
}

function scoreKeyForChallenge(challengeId) {
  return {
    aiActRisk: "lawful",
    rightsImpact: "lawful",
    dataPrivacy: "reliability",
    transparency: "transparency",
    humanControl: "humanControl",
    procurementLifecycle: "publicValue"
  }[challengeId] || "publicValue";
}

function applyAction(session, body) {
  const type = body.type;
  const playerId = body.playerId;

  if (type === "join") {
    if (session.players.length >= MAX_PLAYERS) {
      const error = new Error("Deze sessie zit vol. Maximaal 15 spelers.");
      error.status = 409;
      throw error;
    }

    const requestedId = sanitizeText(body.playerId, 80);
    let existing = requestedId
      ? session.players.find((player) => player.id === requestedId)
      : null;

    if (existing) {
      existing.name = sanitizeText(body.name, 42) || existing.name;
      existing.role = sanitizeText(body.role, 48) || existing.role;
      existing.lastSeen = new Date().toISOString();
      touch(session);
      save();
      return { playerId: existing.id, session };
    }

    const player = {
      id: crypto.randomUUID(),
      name: sanitizeText(body.name, 42) || `Anoniem ${session.players.length + 1}`,
      role: sanitizeText(body.role, 48) || "Teamlid",
      joinedAt: new Date().toISOString(),
      lastSeen: new Date().toISOString()
    };

    session.players.push(player);
    if (!session.adminId || body.wantsAdmin) {
      session.adminId = player.id;
    }
    addLog(session, player.id, "nam plaats aan de raadstafel.");
    touch(session);
    save();
    return { playerId: player.id, session };
  }

  const player = session.players.find((candidate) => candidate.id === playerId);
  if (!player) {
    const error = new Error("Speler niet gevonden. Log opnieuw in.");
    error.status = 401;
    throw error;
  }
  player.lastSeen = new Date().toISOString();

  if (type === "heartbeat") {
    touch(session);
    save();
    return { session };
  }

  if (type === "setPlayerRole") {
    player.role = sanitizeText(body.role, 48) || "Teamlid";
    addLog(session, player.id, `koos de rol ${player.role}.`);
  }

  if (type === "claimAdmin") {
    if (!session.adminId || session.adminId === player.id) {
      session.adminId = player.id;
      addLog(session, player.id, "is facilitator geworden.");
    } else {
      assertAdmin(session, player.id);
    }
  }

  if (type === "setVoting") {
    assertAdmin(session, player.id);
    session.votingEnabled = Boolean(body.enabled);
    addLog(session, player.id, session.votingEnabled ? "opende de stemronde." : "sloot de stemronde.");
  }

  if (type === "addNote") {
    const levelId = sanitizeText(body.levelId, 80);
    const promptId = sanitizeText(body.promptId, 80);
    const text = sanitizeText(body.text);
    const prompt = session.levels[levelId]?.prompts?.[promptId];
    if (!prompt || !text) {
      const error = new Error("Deze notitie kon niet worden geplaatst.");
      error.status = 400;
      throw error;
    }
    prompt.push({
      id: crypto.randomUUID(),
      text,
      authorId: player.id,
      author: player.name,
      votes: [],
      createdAt: new Date().toISOString()
    });
    addLog(session, player.id, "plaatste een kaart op het bord.");
  }

  if (type === "voteNote") {
    if (!session.votingEnabled) {
      const error = new Error("De stemronde is gesloten.");
      error.status = 409;
      throw error;
    }
    const note = findNote(session, sanitizeText(body.levelId, 80), sanitizeText(body.promptId, 80), sanitizeText(body.noteId, 80));
    if (!note) {
      const error = new Error("Notitie niet gevonden.");
      error.status = 404;
      throw error;
    }
    const index = note.votes.indexOf(player.id);
    if (index >= 0) {
      note.votes.splice(index, 1);
    } else {
      note.votes.push(player.id);
    }
  }

  if (type === "selectNote") {
    assertAdmin(session, player.id);
    const levelId = sanitizeText(body.levelId, 80);
    const promptId = sanitizeText(body.promptId, 80);
    const note = findNote(session, levelId, promptId, sanitizeText(body.noteId, 80));
    if (!note) {
      const error = new Error("Notitie niet gevonden.");
      error.status = 404;
      throw error;
    }
    session.levels[levelId].selected[promptId] = note.id;
    addLog(session, player.id, "koos een richting uit de kaarten.");
  }

  if (type === "setSolutionType") {
    assertAdmin(session, player.id);
    const value = ["physical", "digital", "ai", "hybrid"].includes(body.value) ? body.value : null;
    session.levels["probleem-en-noodzaak"].solutionType = value;
    if (value === "physical") {
      session.levels["probleem-en-noodzaak"].stopReason = sanitizeText(body.stopReason, 500) || "Het team kiest voor een niet-AI oplossing.";
    }
    addLog(session, player.id, "legde de oplossingsroute vast.");
  }

  if (type === "selectArchetype") {
    const value = sanitizeText(body.value, 40);
    session.levels["mens-assistent-relatie"].archetype = value;
    session.levels["mens-assistent-relatie"].role = null;
    addLog(session, player.id, "plaatste de toepassing in een relatie-archetype.");
  }

  if (type === "selectInteractionRole") {
    const value = sanitizeText(body.value, 60);
    session.levels["mens-assistent-relatie"].role = value;
    addLog(session, player.id, "koos een specifieke assistentrol.");
  }

  if (type === "addRelationAnswer") {
    const text = sanitizeText(body.text);
    if (text) {
      session.levels["mens-assistent-relatie"].answers.push({
        id: crypto.randomUUID(),
        text,
        authorId: player.id,
        author: player.name,
        createdAt: new Date().toISOString()
      });
      addLog(session, player.id, "beantwoordde een relatievraag.");
    }
  }

  if (type === "addChallengeAnswer") {
    const challenge = findChallenge(session, sanitizeText(body.challengeId, 80));
    const text = sanitizeText(body.text);
    if (!challenge || !text) {
      const error = new Error("Deze encounter bestaat niet.");
      error.status = 400;
      throw error;
    }
    challenge.answers.push({
      id: crypto.randomUUID(),
      text,
      authorId: player.id,
      author: player.name,
      createdAt: new Date().toISOString()
    });
    addLog(session, player.id, "bracht een aanpak in voor een AI-kader encounter.");
  }

  if (type === "resolveChallenge") {
    assertAdmin(session, player.id);
    const challengeId = sanitizeText(body.challengeId, 80);
    const challenge = findChallenge(session, challengeId);
    if (!challenge) {
      const error = new Error("Encounter niet gevonden.");
      error.status = 404;
      throw error;
    }
    const scoreKey = scoreKeyForChallenge(challengeId);
    const baseBonus = session.scores[scoreKey] || 0;
    const collaborationBonus = Math.min(3, challenge.answers.length);
    const die = crypto.randomInt(1, 21);
    const total = die + baseBonus + collaborationBonus;
    const outcome = total >= 16 ? "success" : total >= 11 ? "partial" : "risk";
    const gain = outcome === "success" ? 2 : outcome === "partial" ? 1 : 0;
    session.scores[scoreKey] = clamp((session.scores[scoreKey] || 0) + gain, 0, 6);
    challenge.resolved = {
      at: new Date().toISOString(),
      by: player.name,
      die,
      baseBonus,
      collaborationBonus,
      total,
      outcome
    };
    addLog(session, player.id, `rolde ${die} en sloot een encounter af.`);
  }

  if (type === "addAction") {
    const text = sanitizeText(body.text);
    const owner = sanitizeText(body.owner, 80);
    if (text) {
      session.levels.implementatiepact.actions.push({
        id: crypto.randomUUID(),
        text,
        owner,
        done: false,
        createdAt: new Date().toISOString()
      });
      addLog(session, player.id, "voegde een implementatieactie toe.");
    }
  }

  if (type === "toggleAction") {
    const action = session.levels.implementatiepact.actions.find((item) => item.id === body.actionId);
    if (action) {
      action.done = !action.done;
    }
  }

  if (type === "setFinalDecision") {
    assertAdmin(session, player.id);
    const value = ["stop", "research", "pilot", "procure", "scale"].includes(body.value) ? body.value : "pilot";
    session.levels.implementatiepact.finalDecision = value;
    session.levels.implementatiepact.owner = sanitizeText(body.owner, 80);
    session.levels.implementatiepact.reviewDate = sanitizeText(body.reviewDate, 40);
    addLog(session, player.id, "legde het implementatiepact vast.");
  }

  if (type === "goToLevel") {
    assertAdmin(session, player.id);
    const index = clamp(Number(body.levelIndex), 0, LEVELS.length - 1);
    if (index <= session.unlockedLevel) {
      session.currentLevel = index;
      addLog(session, player.id, "verplaatste de raad naar een eerder level.");
    }
  }

  if (type === "nextLevel") {
    assertAdmin(session, player.id);
    const current = session.currentLevel;
    const solutionType = session.levels["probleem-en-noodzaak"].solutionType;
    if (current === 0 && solutionType === "physical") {
      session.currentLevel = 3;
      session.unlockedLevel = Math.max(session.unlockedLevel, 3);
    } else {
      session.currentLevel = clamp(current + 1, 0, LEVELS.length - 1);
      session.unlockedLevel = Math.max(session.unlockedLevel, session.currentLevel);
    }
    addLog(session, player.id, "opende het volgende level.");
  }

  if (type === "resetSession") {
    assertAdmin(session, player.id);
    const code = session.code;
    const players = session.players;
    const adminId = session.adminId;
    const fresh = newSession(code);
    fresh.players = players;
    fresh.adminId = adminId;
    store.sessions[code] = fresh;
    addLog(fresh, player.id, "startte de quest opnieuw.");
    touch(fresh);
    save();
    return { session: fresh };
  }

  touch(session);
  save();
  return { session };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendMarkdown(res, filename, text) {
  const body = Buffer.from(text, "utf8");
  res.writeHead(200, {
    "Content-Type": "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "no-store",
    "Content-Length": body.length
  });
  res.end(body);
}

function buildMarkdownReport(session) {
  const problemLevel = session.levels["probleem-en-noodzaak"];
  const relationLevel = session.levels["mens-assistent-relatie"];
  const pact = session.levels.implementatiepact;
  const selected = (promptId) => selectedNoteText(session, promptId) || "-";
  const relation = [
    RELATION_LABELS[relationLevel.archetype],
    RELATION_LABELS[relationLevel.role]
  ].filter(Boolean).join(" - ") || "-";

  const challengeLines = Object.entries(CHALLENGE_LABELS).map(([id, label]) => {
    const resolved = session.levels["ai-kader-proef"].challenges[id]?.resolved;
    return `- ${label}: ${resolved ? `${outcomeLabel(resolved.outcome)} (${resolved.total})` : "Niet gerold"}`;
  });

  return [
    `# AI-kader Quest verslag - ${session.code}`,
    "",
    `Datum: ${new Date().toLocaleString("nl-NL")}`,
    `Besluit: ${FINAL_DECISIONS[pact.finalDecision] || "-"}`,
    `Eigenaar: ${pact.owner || "-"}`,
    `Evaluatiemoment: ${pact.reviewDate || "-"}`,
    "",
    "## Probleem en doel",
    `- Probleem: ${selected("problem")}`,
    `- Doel: ${selected("goal")}`,
    `- Betrokkenen: ${selected("stakeholders")}`,
    `- Alternatieven: ${selected("alternatives")}`,
    `- Oplossingsroute: ${SOLUTION_TYPES[problemLevel.solutionType] || "-"}`,
    "",
    "## Mens-assistent relatie",
    `- Archetype en rol: ${relation}`,
    ...relationLevel.answers.map((answer) => `- ${answer.text}`),
    "",
    "## AI-kader encounters",
    ...challengeLines,
    "",
    "## Readiness",
    ...Object.entries(SCORE_LABELS).map(([key, label]) => `- ${label}: ${session.scores[key]}/6`),
    "",
    "## Implementatieacties",
    ...(pact.actions.length ? pact.actions.map((action) => `- [${action.done ? "x" : " "}] ${action.text}${action.owner ? ` (${action.owner})` : ""}`) : ["- Geen acties vastgelegd."]),
    "",
    "## Bronnen",
    ...SOURCE_LINKS.map(([label, url]) => `- ${label}: ${url}`),
    "",
    "Bronnen verwerkt op 1 juli 2026. Dit verslag vervangt geen juridisch advies."
  ].join("\n");
}

function selectedNoteText(session, promptId) {
  const level = session.levels["probleem-en-noodzaak"];
  const noteId = level.selected?.[promptId];
  const note = level.prompts?.[promptId]?.find((item) => item.id === noteId);
  return note?.text || "";
}

function outcomeLabel(value) {
  return {
    success: "Sterke basis",
    partial: "Extra maatregel nodig",
    risk: "Open risico"
  }[value] || "Onbekend";
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        req.destroy();
        reject(new Error("Request te groot."));
      }
    });
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(new Error("Ongeldige JSON."));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(requestUrl.pathname);
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": [".html", ".css", ".js"].includes(ext) ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (await gameApi(req, res, url)) return;
    const sessionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)$/);
    const reportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/report\.md$/);
    const actionMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/actions$/);

    if (req.method === "GET" && sessionMatch) {
      const session = getSession(sessionMatch[1]);
      sendJson(res, 200, {
        session: publicSession(session, url.searchParams.get("playerId"))
      });
      return;
    }

    if (req.method === "GET" && reportMatch) {
      const session = getSession(reportMatch[1]);
      sendMarkdown(res, `ai-kader-quest-${session.code}.md`, buildMarkdownReport(session));
      return;
    }

    if (req.method === "POST" && actionMatch) {
      const session = getSession(actionMatch[1]);
      const body = await readBody(req);
      const result = applyAction(session, body);
      sendJson(res, 200, {
        playerId: result.playerId || body.playerId,
        session: publicSession(result.session, result.playerId || body.playerId)
      });
      return;
    }

    if (req.method === "GET") {
      serveStatic(req, res);
      return;
    }

    res.writeHead(405);
    res.end("Method not allowed");
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Er ging iets mis."
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  const addresses = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === "IPv4" && !entry.internal)
    .map((entry) => `http://${entry.address}:${PORT}`);

  console.log(`AI-kader Quest draait op http://localhost:${PORT}`);
  if (addresses.length) {
    console.log(`Lokale netwerkadressen: ${addresses.join(", ")}`);
  }
});
