const state = {
  session: null,
  playerId: null,
  code: "",
  viewLevel: 0,
  selectedChallenge: "aiActRisk",
  pollTimer: null,
  toastTimer: null
};

const levelDefs = [
  {
    id: "probleem-en-noodzaak",
    title: "Level 1: Probleem en noodzaak",
    short: "Probleem",
    prompt: "Bepaal of AI echt nodig is voordat de raad middelen inzet."
  },
  {
    id: "mens-assistent-relatie",
    title: "Level 2: Mens-assistent relatie",
    short: "Relatie",
    prompt: "Kies hoe mensen en systeem samenwerken."
  },
  {
    id: "ai-kader-proef",
    title: "Level 3: AI-kader proef",
    short: "Toetsing",
    prompt: "Speel encounters over rechten, data, transparantie en beheersing."
  },
  {
    id: "implementatiepact",
    title: "Level 4: Implementatiepact",
    short: "Pact",
    prompt: "Maak de keuze concreet met acties, eigenaar en evaluatie."
  }
];

const scoreDefs = {
  publicValue: "Publieke waarde",
  lawful: "Rechtmatigheid",
  humanControl: "Menselijke regie",
  transparency: "Transparantie",
  reliability: "Betrouwbaarheid"
};

const promptDefs = {
  problem: {
    title: "Achterliggend probleem",
    text: "Welke pijn, wachttijd, foutkans of publieke opgave proberen we op te lossen?"
  },
  goal: {
    title: "Doel van de oplossing",
    text: "Wat moet voor burger, medewerker of keten meetbaar beter worden?"
  },
  stakeholders: {
    title: "Betrokkenen en geraakt publiek",
    text: "Wie gebruikt, beheert, controleert of ondervindt gevolgen van de toepassing?"
  },
  alternatives: {
    title: "Alternatieven zonder AI",
    text: "Welke proces-, organisatie-, informatie- of fysieke oplossing kan hetzelfde doel halen?"
  }
};

const solutionTypes = {
  physical: "Niet-AI of fysieke oplossing",
  digital: "Digitaal zonder AI",
  ai: "AI-gestuurde toepassing",
  hybrid: "Hybride oplossing"
};

const archetypes = [
  {
    id: "tools",
    label: "Tools",
    tint: "blue",
    summary: "Mensen gebruiken hulpmiddelen voor controle en precisie.",
    roles: [
      {
        id: "dedicated-tools",
        label: "Specifieke tool",
        summary: "Een zelfstandig hulpmiddel voor een duidelijke taak.",
        questions: [
          "Wat is de ene taak die de tool aantoonbaar beter maakt?",
          "Welke handeling blijft altijd expliciet bij de gebruiker?",
          "Welke input en output moeten vast en controleerbaar zijn?"
        ]
      },
      {
        id: "workflow-tools",
        label: "Workflow tool",
        summary: "Verbindt gespecialiseerde stappen tot een groter proces.",
        questions: [
          "Hoe sluit de tool aan op de stappen ervoor en erna?",
          "Welke context uit het bredere systeem mag de tool raadplegen?",
          "Hoe blijven overdrachten tussen werkfasen soepel en uitlegbaar?"
        ]
      },
      {
        id: "inline-tools",
        label: "Inline tool",
        summary: "Biedt directe ondersteuning in de interface waar iemand al werkt.",
        questions: [
          "Op welk moment in het werk verschijnt de hulp?",
          "Hoe voorkomt de tool dat de gebruiker context verliest?",
          "Welke knop, menuactie of gebaar activeert de ondersteuning?"
        ]
      },
      {
        id: "sculpters",
        label: "Sculpter",
        summary: "Verfijnt materiaal iteratief samen met de gebruiker.",
        questions: [
          "Wat wordt stap voor stap verfijnd?",
          "Hoe bewaakt de gebruiker richting en kwaliteit?",
          "Wanneer is het resultaat klaar genoeg voor formeel gebruik?"
        ]
      }
    ]
  },
  {
    id: "chat",
    label: "Chat",
    tint: "coral",
    summary: "Mensen praten met een systeem voor open verkenning of gerichte hulp.",
    roles: [
      {
        id: "characters",
        label: "Character",
        summary: "Een conversationele rolspeler voor simulatie, leren of ideevorming.",
        questions: [
          "Waar kan open, creatieve verkenning tot inzichten leiden?",
          "Hoe is duidelijk dat het personage performer is en geen autoriteit?",
          "Wanneer moet het personage meewerken, tegenspreken of stoppen?"
        ]
      },
      {
        id: "assistants",
        label: "Assistent",
        summary: "Een taakgerichte gesprekshelper met kennis, context of hulpmiddelen.",
        questions: [
          "Welke taak voert de assistent samen met de gebruiker uit?",
          "Welke bronnen mag de assistent gebruiken en tonen?",
          "Wanneer moet de assistent onzekerheid of beperking melden?"
        ]
      },
      {
        id: "npcs",
        label: "NPC",
        summary: "Een geautomatiseerde fictieve gesprekspartner binnen een spel of simulatie.",
        questions: [
          "Welke sociale regel of leersituatie draagt deze rol?",
          "Hoe blijft de rol herkenbaar fictief?",
          "Wanneer mag het systeem humor gebruiken en wanneer niet?"
        ]
      },
      {
        id: "bespoke-uis",
        label: "Bespoke UI",
        summary: "Een interface die zich realtime aanpast aan context en gebruiker.",
        questions: [
          "Welke context verandert de interface?",
          "Welke vaste controles blijven altijd vindbaar?",
          "Hoe kan een gebruiker uitleg krijgen over de aanpassing?"
        ]
      },
      {
        id: "intelligent-canvases",
        label: "Intelligent canvas",
        summary: "Een generatief oppervlak dat ideeen omzet in documenten of interfaces.",
        questions: [
          "Wat ontstaat op het canvas en wie keurt het goed?",
          "Welke versiegeschiedenis is nodig?",
          "Hoe blijven bron, prompt en resultaat bij elkaar?"
        ]
      }
    ]
  },
  {
    id: "agents",
    label: "Agents",
    tint: "amber",
    summary: "Mensen delegeren werk over systemen heen.",
    roles: [
      {
        id: "taskers",
        label: "Tasker",
        summary: "Een agent met een afgebakende taak binnen of tussen systemen.",
        questions: [
          "Welke taak mag de tasker zelfstandig uitvoeren?",
          "Welke grenzen, uitzonderingen en stopregels gelden?",
          "Welke logging bewijst wat er is gedaan?"
        ]
      },
      {
        id: "alchemists",
        label: "Alchemist",
        summary: "Transformeert data of documenten tot een nieuwe ervaring.",
        questions: [
          "Welke bron wordt naar welk nieuw format vertaald?",
          "Hoe controleert iemand of de transformatie klopt?",
          "Welke informatie mag niet meegetransformeerd worden?"
        ]
      },
      {
        id: "stewards",
        label: "Steward",
        summary: "Beheert een doorlopend digitaal domein met vaste verantwoordelijkheden.",
        questions: [
          "Welk domein bewaakt de steward continu?",
          "Wie krijgt meldingen bij afwijkingen?",
          "Hoe wordt drift, veroudering of misbruik gedetecteerd?"
        ]
      },
      {
        id: "conductors",
        label: "Conductor",
        summary: "Coordineert meerdere agents om een gezamenlijk doel te halen.",
        questions: [
          "Welke agents werken samen en in welke volgorde?",
          "Waar ligt de eindverantwoordelijkheid?",
          "Welke tussenstappen moeten door een mens worden bevestigd?"
        ]
      }
    ]
  },
  {
    id: "copilots",
    label: "Copilot",
    tint: "green",
    summary: "Mensen krijgen stille, contextuele ondersteuning tijdens hun werk.",
    roles: [
      {
        id: "copilot",
        label: "Copilot",
        summary: "Combineert aanvulling, dialoog en taakuitvoering in de werkcontext.",
        questions: [
          "Tijdens welke activiteit denkt de copilot mee?",
          "Welke suggesties zijn vrijblijvend en welke starten een actie?",
          "Hoe kan de gebruiker hulp negeren, pauzeren of terugdraaien?"
        ]
      }
    ]
  }
];

const challengeDefs = {
  aiActRisk: {
    title: "AI Act risicopoort",
    stat: "lawful",
    dc: 16,
    prompt: "Bepaal of de toepassing verboden, hoog risico, transparantierisico of minimaal risico lijkt. Leg twijfel vast.",
    stakes: "Een verkeerde classificatie kan de raad later duur komen te staan."
  },
  rightsImpact: {
    title: "Rechten en publieke waarden",
    stat: "lawful",
    dc: 15,
    prompt: "Onderzoek discriminatie, bezwaar, gelijke behandeling, menselijke waardigheid en proportionaliteit.",
    stakes: "De toepassing mag geen sluiproute rond grondrechten worden."
  },
  dataPrivacy: {
    title: "Data, privacy en kwaliteit",
    stat: "reliability",
    dc: 14,
    prompt: "Toets grondslag, dataminimalisatie, bronkwaliteit, bewaartermijnen en hergebruik van gegevens.",
    stakes: "Een model is maar zo bestuurbaar als zijn datahuishouding."
  },
  transparency: {
    title: "Uitleg en register",
    stat: "transparency",
    dc: 13,
    prompt: "Maak duidelijk wanneer iemand met AI te maken heeft, wat het systeem doet en wat in het algoritmeregister hoort.",
    stakes: "Zonder uitleg verliest de toepassing vertrouwen, ook als de techniek werkt."
  },
  humanControl: {
    title: "Menselijke regie",
    stat: "humanControl",
    dc: 15,
    prompt: "Bepaal wie kan overrulen, pauzeren, escaleren, herstellen en verantwoorden.",
    stakes: "De organisatie moet de beslissing dragen, niet het systeem."
  },
  procurementLifecycle: {
    title: "Inkoop en levenscyclus",
    stat: "publicValue",
    dc: 14,
    prompt: "Leg eisen vast voor leverancier, logging, monitoring, evaluatie, incidenten en uitfasering.",
    stakes: "Een goede start is weinig waard zonder beheer na ingebruikname."
  }
};

const finalDecisions = {
  stop: "Stoppen of niet-AI route kiezen",
  research: "Verder onderzoeken",
  pilot: "Beperkte pilot starten",
  procure: "Inkoop of aanbesteding voorbereiden",
  scale: "Opschalen met beheersmaatregelen"
};

const sources = [
  {
    label: "Algoritmekader",
    url: "https://minbzk.github.io/Algoritmekader/",
    note: "Wetten, regels, hulpmiddelen en levenscyclus voor overheidsalgoritmes."
  },
  {
    label: "Digitale Overheid: Algoritmekader",
    url: "https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmekader/",
    note: "Achtergrond over verantwoord gebruik van algoritmes en AI door overheden."
  },
  {
    label: "EU AI Act",
    url: "https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai",
    note: "Risicogebaseerde regels, transparantieplichten en implementatietijdlijn."
  },
  {
    label: "Algoritmeregister",
    url: "https://www.digitaleoverheid.nl/overzicht-van-alle-onderwerpen/algoritmes/algoritmeregister/",
    note: "Centrale plek waar overheden informatie over algoritmes publiceren."
  }
];

const $ = (selector) => document.querySelector(selector);

document.addEventListener("DOMContentLoaded", () => {
  const rawUrlCode = new URLSearchParams(location.search).get("session");
  const urlCode = rawUrlCode ? normalizeCode(rawUrlCode) : "";
  const lastCode = localStorage.getItem("aiKaderQuest:lastCode") || randomCode();
  const initialCode = urlCode || lastCode;
  $("#sessionCode").value = initialCode;
  $("#loginForm").addEventListener("submit", joinSession);
  $("#copyLinkButton").addEventListener("click", copySessionLink);
  $("#downloadButton").addEventListener("click", downloadReport);
  document.addEventListener("click", handleClick);
  document.addEventListener("change", handleChange);
  document.addEventListener("submit", handleSubmit);

  const storedPlayer = localStorage.getItem(`aiKaderQuest:player:${initialCode}`);
  if (urlCode && storedPlayer) {
    resumeSession(initialCode, storedPlayer);
  }
});

function randomCode() {
  return `KADER-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

async function joinSession(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = normalizeCode(form.get("code") || randomCode());
  const storedId = localStorage.getItem(`aiKaderQuest:player:${code}`);

  const payload = {
    type: "join",
    playerId: storedId,
    name: form.get("name"),
    role: form.get("role"),
    wantsAdmin: $("#wantsAdmin").checked
  };

  try {
    const result = await postAction(code, payload, false);
    state.code = code;
    state.playerId = result.playerId;
    state.session = result.session;
    state.viewLevel = result.session.currentLevel;
    localStorage.setItem("aiKaderQuest:lastCode", code);
    localStorage.setItem(`aiKaderQuest:player:${code}`, result.playerId);
    history.replaceState(null, "", `?session=${encodeURIComponent(code)}`);
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    render();
    startPolling();
  } catch (error) {
    showToast(error.message);
  }
}

async function resumeSession(code, playerId) {
  state.code = code;
  state.playerId = playerId;
  try {
    await refreshSession();
    state.viewLevel = state.session.currentLevel;
    $("#loginView").classList.add("hidden");
    $("#appView").classList.remove("hidden");
    render();
    startPolling();
  } catch (error) {
    $("#loginView").classList.remove("hidden");
    $("#appView").classList.add("hidden");
  }
}

function normalizeCode(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 18) || randomCode();
}

function startPolling() {
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(() => {
    if (!document.hidden && !isEditing()) {
      refreshSession(true);
    }
  }, 1500);
}

function isEditing() {
  const active = document.activeElement;
  return active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName);
}

async function refreshSession(silent = false) {
  if (!state.code || !state.playerId) return;
  try {
    const res = await fetch(`/api/sessions/${encodeURIComponent(state.code)}?playerId=${encodeURIComponent(state.playerId)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Sessie kon niet worden geladen.");
    state.session = data.session;
    if (state.viewLevel > data.session.unlockedLevel) {
      state.viewLevel = data.session.currentLevel;
    }
    render();
  } catch (error) {
    if (!silent) showToast(error.message);
  }
}

async function postAction(code, payload, includePlayer = true) {
  const body = {
    ...payload,
    playerId: includePlayer ? state.playerId : payload.playerId
  };
  const res = await fetch(`/api/sessions/${encodeURIComponent(code)}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Actie mislukt.");
  return data;
}

async function send(payload) {
  try {
    const result = await postAction(state.code, payload);
    state.session = result.session;
    if (payload.type === "nextLevel") {
      state.viewLevel = result.session.currentLevel;
    }
    render();
  } catch (error) {
    showToast(error.message);
  }
}

function render() {
  const session = state.session;
  if (!session) return;

  const activeDef = levelDefs[session.currentLevel];
  $("#sessionTitle").textContent = `Sessie ${session.code}`;
  $("#currentQuest").textContent = activeDef.title;
  $("#playerBadge").textContent = `${currentPlayer()?.name || "Speler"}${session.isAdmin ? " - facilitator" : ""}`;
  $("#playerCount").textContent = `${session.players.length}/15`;
  $("#readinessTotal").textContent = `${totalReadiness()}/30`;

  renderParty();
  renderScores();
  renderAdmin();
  renderLevelNav();
  renderLevelContent();
  renderLog();
}

function currentPlayer() {
  return state.session?.players.find((player) => player.id === state.playerId);
}

function totalReadiness() {
  return Object.values(state.session?.scores || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}

function renderParty() {
  const adminId = state.session.adminId;
  $("#partyList").innerHTML = state.session.players.map((player) => `
    <div class="party-member">
      <strong>${escapeHtml(player.name)}${player.id === adminId ? " - facilitator" : ""}</strong>
      <span class="meta">${escapeHtml(player.role || "Teamlid")}</span>
    </div>
  `).join("");
}

function renderScores() {
  $("#scoreMeters").innerHTML = Object.entries(scoreDefs).map(([key, label]) => {
    const value = Number(state.session.scores[key] || 0);
    return `
      <div class="meter">
        <div class="meter-top"><span>${label}</span><span>${value}/6</span></div>
        <div class="meter-track"><div class="meter-fill" style="width: ${(value / 6) * 100}%"></div></div>
      </div>
    `;
  }).join("");
}

function renderAdmin() {
  const panel = $("#adminPanel");
  const session = state.session;
  if (!session.isAdmin) {
    panel.innerHTML = `
      <div class="panel-heading"><h2>Facilitator</h2><span>gesloten</span></div>
      <p>Alleen de facilitator opent het volgende level en legt groepskeuzes vast.</p>
    `;
    return;
  }

  const nextLabel = session.currentLevel >= levelDefs.length - 1 ? "Laatste level" : "Open volgend level";
  panel.innerHTML = `
    <div class="panel-heading"><h2>Facilitator</h2><span>actief</span></div>
    <div class="stack">
      <button class="solid-button" data-action="next-level" ${session.currentLevel >= levelDefs.length - 1 ? "disabled" : ""}>${nextLabel}</button>
      <button class="small-button" data-action="toggle-voting">${session.votingEnabled ? "Sluit stemmen" : "Open stemmen"}</button>
      <button class="danger-button" data-action="reset-session">Reset quest</button>
    </div>
  `;
}

function renderLevelNav() {
  const session = state.session;
  $("#levelNav").innerHTML = levelDefs.map((level, index) => {
    const unlocked = index <= session.unlockedLevel;
    return `
      <button
        class="level-tab ${state.viewLevel === index ? "is-active" : ""} ${session.currentLevel === index ? "is-current" : ""}"
        data-action="view-level"
        data-level-index="${index}"
        ${unlocked ? "" : "disabled"}
      >
        ${index + 1}. ${level.short}
      </button>
    `;
  }).join("");
}

function renderLevelContent() {
  const level = levelDefs[state.viewLevel];
  const renderers = {
    "probleem-en-noodzaak": renderProblemLevel,
    "mens-assistent-relatie": renderRelationLevel,
    "ai-kader-proef": renderAIkaderLevel,
    implementatiepact: renderPactLevel
  };
  $("#levelContent").innerHTML = renderers[level.id]();
}

function renderLevelIntro(level, extra = "") {
  return `
    <div class="level-hero">
      <div>
        <p class="eyebrow">${level.short}</p>
        <h2>${level.title}</h2>
        <p>${level.prompt}</p>
      </div>
      <div class="quest-card">
        ${extra}
      </div>
    </div>
  `;
}

function renderProblemLevel() {
  const level = state.session.levels["probleem-en-noodzaak"];
  const intro = renderLevelIntro(levelDefs[0], `
    <strong>Questregel</strong>
    <p>De raad wint tijd door eerst het probleem scherp te maken. Als een niet-AI oplossing beter past, mag de quest juist daar eindigen.</p>
    <span class="tag">${state.session.votingEnabled ? "Stemronde open" : "Stemronde gesloten"}</span>
  `);

  const boards = Object.entries(promptDefs).map(([promptId, def]) => {
    const notes = level.prompts[promptId] || [];
    return `
      <section class="board-column">
        <div>
          <h3>${def.title}</h3>
          <p class="source-note">${def.text}</p>
        </div>
        <form data-form="note" data-level-id="probleem-en-noodzaak" data-prompt-id="${promptId}">
          <textarea name="text" maxlength="900" placeholder="Plaats een kaart..."></textarea>
          <button class="small-button" type="submit">Plaats kaart</button>
        </form>
        <div class="note-list">
          ${notes.length ? notes.map((note) => renderNote(note, "probleem-en-noodzaak", promptId, level.selected[promptId])).join("") : `<div class="empty-state">Nog geen kaarten.</div>`}
        </div>
      </section>
    `;
  }).join("");

  return `
    ${intro}
    <div class="board-grid">${boards}</div>
    <section class="report-block" style="margin-top:16px">
      <div class="card-heading">
        <h3>Oplossingsroute</h3>
        <span class="meta">facilitator legt vast</span>
      </div>
      <div class="choice-grid" style="margin-top:12px">
        ${Object.entries(solutionTypes).map(([value, label]) => `
          <button class="choice-card ${level.solutionType === value ? "is-selected" : ""}" data-action="set-solution" data-value="${value}">
            <h3>${label}</h3>
            <p>${solutionCopy(value)}</p>
          </button>
        `).join("")}
      </div>
      ${level.solutionType === "physical" ? `<p class="source-note" style="margin-top:12px">Deze route springt naar het implementatiepact, zodat de raad alsnog acties en verslag vastlegt.</p>` : ""}
    </section>
  `;
}

function renderNote(note, levelId, promptId, selectedId) {
  const voted = note.votes.includes(state.playerId);
  const selected = selectedId === note.id;
  return `
    <article class="note-card ${selected ? "is-selected" : ""}">
      <p>${escapeHtml(note.text)}</p>
      <div class="inline-row">
        <span class="meta">${escapeHtml(note.author)} - ${note.votes.length} stem${note.votes.length === 1 ? "" : "men"}</span>
      </div>
      <div class="note-actions">
        <button class="small-button" data-action="vote-note" data-level-id="${levelId}" data-prompt-id="${promptId}" data-note-id="${note.id}">
          ${voted ? "Stem terugnemen" : "Stem"}
        </button>
        ${state.session.isAdmin ? `<button class="small-button" data-action="select-note" data-level-id="${levelId}" data-prompt-id="${promptId}" data-note-id="${note.id}">Kies kaart</button>` : ""}
      </div>
    </article>
  `;
}

function solutionCopy(value) {
  return {
    physical: "Het probleem vraagt vooral om beleid, proces, training of dienstverlening zonder AI.",
    digital: "Een eenvoudige digitale voorziening lijkt voldoende en houdt de risico's lager.",
    ai: "De raad ziet een taak waarbij AI aantoonbaar waarde kan toevoegen.",
    hybrid: "AI kan helpen, maar de kern blijft menselijk of procesmatig verankerd."
  }[value];
}

function renderRelationLevel() {
  const level = state.session.levels["mens-assistent-relatie"];
  const selectedArchetype = archetypes.find((item) => item.id === level.archetype) || archetypes[0];
  const selectedRole = selectedArchetype.roles.find((role) => role.id === level.role);

  const intro = renderLevelIntro(levelDefs[1], `
    <strong>Mens en systeem</strong>
    <p>Kies eerst de relatie. Daarna kiest de raad de specifieke assistentrol die het beste past bij de taak.</p>
    <span class="tag">${selectedRole ? selectedRole.label : "Nog geen rol gekozen"}</span>
  `);

  const archetypeCards = archetypes.map((item) => `
    <button class="choice-card ${level.archetype === item.id ? "is-selected" : ""}" data-action="select-archetype" data-value="${item.id}" title="${escapeHtml(item.summary)}">
      <h3>${item.label}</h3>
      <p>${item.summary}</p>
    </button>
  `).join("");

  const roleCards = selectedArchetype.roles.map((role) => `
    <button class="choice-card ${level.role === role.id ? "is-selected" : ""}" data-action="select-role" data-value="${role.id}">
      <h3>${role.label}</h3>
      <p>${role.summary}</p>
    </button>
  `).join("");

  const questionList = selectedRole ? selectedRole.questions.map((question) => `<li>${question}</li>`).join("") : "";

  return `
    ${intro}
    <div class="relation-layout">
      <section>
        <h3>Archetype</h3>
        <div class="choice-grid">${archetypeCards}</div>
        <h3 style="margin-top:18px">Specifieke rol</h3>
        <div class="choice-grid">${roleCards}</div>
      </section>
      <section class="report-block">
        <div class="card-heading">
          <h3>${selectedRole ? selectedRole.label : "Kies een rol"}</h3>
          <span class="meta">${selectedArchetype.label}</span>
        </div>
        ${selectedRole ? `
          <p>${selectedRole.summary}</p>
          <ul class="report-list">${questionList}</ul>
          <form data-form="relation-answer" style="margin-top:14px">
            <textarea name="text" maxlength="900" placeholder="Antwoord, dilemma of ontwerpkeuze..."></textarea>
            <button class="small-button" type="submit">Leg vast</button>
          </form>
        ` : `<div class="empty-state">Selecteer een kaart om de ontwerpvragen te openen.</div>`}
        <div class="note-list" style="margin-top:14px">
          ${level.answers.length ? level.answers.map((answer) => `
            <article class="note-card">
              <p>${escapeHtml(answer.text)}</p>
              <span class="meta">${escapeHtml(answer.author)}</span>
            </article>
          `).join("") : `<div class="empty-state">Nog geen ontwerpkeuzes vastgelegd.</div>`}
        </div>
      </section>
    </div>
  `;
}

function renderAIkaderLevel() {
  const level = state.session.levels["ai-kader-proef"];
  const selected = challengeDefs[state.selectedChallenge] || challengeDefs.aiActRisk;
  const challenge = level.challenges[state.selectedChallenge] || { answers: [] };
  const intro = renderLevelIntro(levelDefs[2], `
    <strong>D20 regel</strong>
    <p>Elke ingebrachte aanpak geeft samenwerkingbonus tot +3. De relevante readiness score telt mee. 16 of hoger is sterk, 11 tot 15 vraagt extra maatregel.</p>
    <span class="tag">Geselecteerd: ${selected.title}</span>
  `);

  const challengeCards = Object.entries(challengeDefs).map(([id, def]) => {
    const resolved = level.challenges[id]?.resolved;
    return `
      <button class="challenge-card ${state.selectedChallenge === id ? "is-selected" : ""} ${resolved ? "is-resolved" : ""}" data-action="select-challenge" data-value="${id}">
        <div class="card-heading">
          <h3>${def.title}</h3>
          <span class="meta">${scoreDefs[def.stat]}</span>
        </div>
        <p>${def.prompt}</p>
        ${resolved ? `<span class="tag">${outcomeLabel(resolved.outcome)} - totaal ${resolved.total}</span>` : `<span class="tag">DC ${def.dc}</span>`}
      </button>
    `;
  }).join("");

  return `
    ${intro}
    <div class="encounter-layout">
      <section class="challenge-list">${challengeCards}</section>
      <section class="report-block">
        <div class="card-heading">
          <h3>${selected.title}</h3>
          <span class="meta">DC ${selected.dc} - ${scoreDefs[selected.stat]}</span>
        </div>
        <p>${selected.prompt}</p>
        <p class="source-note">${selected.stakes}</p>
        ${challenge.resolved ? renderRoll(challenge.resolved) : ""}
        <form data-form="challenge-answer" data-challenge-id="${state.selectedChallenge}" style="margin-top:14px">
          <textarea name="text" maxlength="900" placeholder="Aanpak, bewijs, randvoorwaarde of open risico..."></textarea>
          <button class="small-button" type="submit">Breng aanpak in</button>
        </form>
        <div class="note-list" style="margin-top:14px">
          ${challenge.answers.length ? challenge.answers.map((answer) => `
            <article class="note-card">
              <p>${escapeHtml(answer.text)}</p>
              <span class="meta">${escapeHtml(answer.author)}</span>
            </article>
          `).join("") : `<div class="empty-state">Nog geen aanpak ingebracht.</div>`}
        </div>
        ${state.session.isAdmin ? `<button class="solid-button" data-action="resolve-challenge" data-challenge-id="${state.selectedChallenge}" style="margin-top:14px">Rol D20 voor deze encounter</button>` : ""}
      </section>
    </div>
  `;
}

function renderRoll(roll) {
  return `
    <div class="roll-box">
      <span class="meta">D20 ${roll.die} + readiness ${roll.baseBonus} + samenwerking ${roll.collaborationBonus}</span>
      <strong class="roll-total ${outcomeClass(roll.outcome)}">${roll.total}</strong>
      <span class="${outcomeClass(roll.outcome)}">${outcomeLabel(roll.outcome)}</span>
    </div>
  `;
}

function outcomeLabel(value) {
  return {
    success: "Sterke basis",
    partial: "Extra maatregel nodig",
    risk: "Open risico"
  }[value] || "Onbekend";
}

function outcomeClass(value) {
  return {
    success: "outcome-success",
    partial: "outcome-partial",
    risk: "outcome-risk"
  }[value] || "";
}

function renderPactLevel() {
  const level = state.session.levels.implementatiepact;
  const problem = selectedNoteText("probleem-en-noodzaak", "problem") || "Nog niet gekozen";
  const relation = relationSummary();
  const intro = renderLevelIntro(levelDefs[3], `
    <strong>Raadsbesluit</strong>
    <p>${finalDecisions[level.finalDecision] || finalDecisions.pilot}</p>
    <span class="tag">Readiness ${totalReadiness()}/30</span>
  `);

  const actionList = level.actions.length ? level.actions.map((action) => `
    <li>
      <label class="check-row">
        <input type="checkbox" data-action="toggle-pact-action" data-action-id="${action.id}" ${action.done ? "checked" : ""}>
        <span>${escapeHtml(action.text)}${action.owner ? ` - ${escapeHtml(action.owner)}` : ""}</span>
      </label>
    </li>
  `).join("") : `<li>Nog geen acties.</li>`;

  return `
    ${intro}
    <div class="report-layout">
      <section class="stack">
        <div class="report-block">
          <h3>Samenvatting</h3>
          <p><strong>Probleem:</strong> ${escapeHtml(problem)}</p>
          <p><strong>Route:</strong> ${escapeHtml(solutionTypes[state.session.levels["probleem-en-noodzaak"].solutionType] || "Nog niet gekozen")}</p>
          <p><strong>Relatie:</strong> ${escapeHtml(relation)}</p>
        </div>
        <div class="report-block">
          <h3>Bronnen</h3>
          <div class="source-grid">
            ${sources.map((source) => `
              <a href="${source.url}" target="_blank" rel="noreferrer">
                ${source.label}
                <span>${source.note}</span>
              </a>
            `).join("")}
          </div>
          <p class="source-note" style="margin-top:10px">Bronnen laatst verwerkt op 1 juli 2026. Dit spel vervangt geen juridisch advies.</p>
        </div>
      </section>
      <section class="stack">
        <div class="report-block">
          <h3>Implementatieacties</h3>
          <form data-form="pact-action">
            <textarea name="text" maxlength="900" placeholder="Actie of voorwaarde..."></textarea>
            <input name="owner" maxlength="80" placeholder="Eigenaar">
            <button class="small-button" type="submit">Voeg actie toe</button>
          </form>
          <ul class="report-list" style="margin-top:14px">${actionList}</ul>
        </div>
        <div class="report-block">
          <h3>Besluit</h3>
          <form data-form="final-decision">
            <label>Route
              <select name="value">
                ${Object.entries(finalDecisions).map(([value, label]) => `<option value="${value}" ${level.finalDecision === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
            </label>
            <label>Eigenaar
              <input name="owner" value="${escapeAttr(level.owner)}" placeholder="Naam of team">
            </label>
            <label>Evaluatiemoment
              <input name="reviewDate" value="${escapeAttr(level.reviewDate)}" placeholder="Bijvoorbeeld Q4 2026">
            </label>
            <button class="solid-button" type="submit">Leg besluit vast</button>
          </form>
        </div>
      </section>
    </div>
  `;
}

function relationSummary() {
  const level = state.session.levels["mens-assistent-relatie"];
  const archetype = archetypes.find((item) => item.id === level.archetype);
  const role = archetype?.roles.find((item) => item.id === level.role);
  if (!archetype && !role) return "Nog niet gekozen";
  return `${archetype?.label || "Onbekend"}${role ? ` - ${role.label}` : ""}`;
}

function selectedNoteText(levelId, promptId) {
  const level = state.session.levels[levelId];
  const noteId = level.selected?.[promptId];
  const note = level.prompts?.[promptId]?.find((item) => item.id === noteId);
  return note?.text || "";
}

function renderLog() {
  const log = state.session.log || [];
  $("#eventLog").innerHTML = log.length ? log.map((item) => `
    <div class="log-item">
      <strong>${escapeHtml(item.actor)}</strong>
      <span class="meta">${formatTime(item.at)}</span>
      <span>${escapeHtml(item.text)}</span>
    </div>
  `).join("") : `<div class="empty-state">Nog geen gebeurtenissen.</div>`;
}

function handleClick(event) {
  const button = event.target.closest("button[data-action]");
  if (!button || !state.session) return;
  const action = button.dataset.action;

  if (action === "view-level") {
    state.viewLevel = Number(button.dataset.levelIndex);
    render();
  }

  if (action === "next-level") send({ type: "nextLevel" });
  if (action === "toggle-voting") send({ type: "setVoting", enabled: !state.session.votingEnabled });
  if (action === "reset-session" && confirm("Quest opnieuw starten voor deze sessie?")) send({ type: "resetSession" });
  if (action === "vote-note") send({
    type: "voteNote",
    levelId: button.dataset.levelId,
    promptId: button.dataset.promptId,
    noteId: button.dataset.noteId
  });
  if (action === "select-note") send({
    type: "selectNote",
    levelId: button.dataset.levelId,
    promptId: button.dataset.promptId,
    noteId: button.dataset.noteId
  });
  if (action === "set-solution") send({
    type: "setSolutionType",
    value: button.dataset.value
  });
  if (action === "select-archetype") send({
    type: "selectArchetype",
    value: button.dataset.value
  });
  if (action === "select-role") send({
    type: "selectInteractionRole",
    value: button.dataset.value
  });
  if (action === "select-challenge") {
    state.selectedChallenge = button.dataset.value;
    render();
  }
  if (action === "resolve-challenge") send({
    type: "resolveChallenge",
    challengeId: button.dataset.challengeId
  });
}

function handleChange(event) {
  const target = event.target;
  if (target.matches("[data-action='toggle-pact-action']")) {
    send({ type: "toggleAction", actionId: target.dataset.actionId });
  }
}

function handleSubmit(event) {
  const form = event.target;
  const kind = form.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const data = new FormData(form);

  if (kind === "note") {
    send({
      type: "addNote",
      levelId: form.dataset.levelId,
      promptId: form.dataset.promptId,
      text: data.get("text")
    });
  }

  if (kind === "relation-answer") {
    send({
      type: "addRelationAnswer",
      text: data.get("text")
    });
  }

  if (kind === "challenge-answer") {
    send({
      type: "addChallengeAnswer",
      challengeId: form.dataset.challengeId,
      text: data.get("text")
    });
  }

  if (kind === "pact-action") {
    send({
      type: "addAction",
      text: data.get("text"),
      owner: data.get("owner")
    });
  }

  if (kind === "final-decision") {
    send({
      type: "setFinalDecision",
      value: data.get("value"),
      owner: data.get("owner"),
      reviewDate: data.get("reviewDate")
    });
  }

  form.reset();
}

async function copySessionLink() {
  const url = `${location.origin}${location.pathname}?session=${encodeURIComponent(state.code)}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast("Sessielink gekopieerd.");
  } catch {
    showToast(url);
  }
}

function downloadReport() {
  if (!state.session) return;
  const link = document.createElement("a");
  link.href = `/api/sessions/${encodeURIComponent(state.code)}/report.md`;
  link.download = `ai-kader-quest-${state.session.code}.md`;
  link.click();
}

function buildMarkdownReport() {
  const session = state.session;
  const problemLevel = session.levels["probleem-en-noodzaak"];
  const relationLevel = session.levels["mens-assistent-relatie"];
  const pact = session.levels.implementatiepact;
  const selected = (promptId) => selectedNoteText("probleem-en-noodzaak", promptId) || "-";
  const challengeLines = Object.entries(challengeDefs).map(([id, def]) => {
    const challenge = session.levels["ai-kader-proef"].challenges[id];
    const result = challenge.resolved ? `${outcomeLabel(challenge.resolved.outcome)} (${challenge.resolved.total})` : "Niet gerold";
    return `- ${def.title}: ${result}`;
  });

  return [
    `# AI-kader Quest verslag - ${session.code}`,
    "",
    `Datum: ${new Date().toLocaleString("nl-NL")}`,
    `Besluit: ${finalDecisions[pact.finalDecision] || "-"}`,
    `Eigenaar: ${pact.owner || "-"}`,
    `Evaluatiemoment: ${pact.reviewDate || "-"}`,
    "",
    "## Probleem en doel",
    `- Probleem: ${selected("problem")}`,
    `- Doel: ${selected("goal")}`,
    `- Betrokkenen: ${selected("stakeholders")}`,
    `- Alternatieven: ${selected("alternatives")}`,
    `- Oplossingsroute: ${solutionTypes[problemLevel.solutionType] || "-"}`,
    "",
    "## Mens-assistent relatie",
    `- Archetype en rol: ${relationSummary()}`,
    ...relationLevel.answers.map((answer) => `- ${answer.text}`),
    "",
    "## AI-kader encounters",
    ...challengeLines,
    "",
    "## Readiness",
    ...Object.entries(scoreDefs).map(([key, label]) => `- ${label}: ${session.scores[key]}/6`),
    "",
    "## Implementatieacties",
    ...(pact.actions.length ? pact.actions.map((action) => `- [${action.done ? "x" : " "}] ${action.text}${action.owner ? ` (${action.owner})` : ""}`) : ["- Geen acties vastgelegd."]),
    "",
    "## Bronnen",
    ...sources.map((source) => `- ${source.label}: ${source.url}`),
    "",
    "Bronnen verwerkt op 1 juli 2026. Dit verslag vervangt geen juridisch advies."
  ].join("\n");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
