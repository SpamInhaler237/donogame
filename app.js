const data = window.RPG_DATA;

if (!data || !Array.isArray(data.passes)) {
  throw new Error("RPG_DATA is missing. Run the data fetch first.");
}

const bosses = [
  {
    id: "thorn-king",
    tier: "Tier I",
    name: "Thorn King Varek",
    hp: 280,
    arena: "Arena: The Rooted Choir beneath a dead emerald cathedral.",
    reward: "Weak point: Crownvine heart. Reward: Verdant sigil shards.",
    story:
      "A bramble monarch that punishes weak builds, but collapses quickly once free clicks start stacking or gifts begin landing.",
    emblem: "I",
    primary: "#6cffc4",
    secondary: "#0d6b58",
    glow: "#a8ffe0"
  },
  {
    id: "ember-bishop",
    tier: "Tier II",
    name: "Ember Bishop Sol",
    hp: 3600,
    arena: "Arena: The Ash Basilica lit by falling lantern meteors.",
    reward: "Weak point: Molten halo. Reward: Cinder vows and forge ash.",
    story:
      "This midgame tyrant burns through low damage builds, making the jump from free clicks to a gifted pass feel instantly noticeable.",
    emblem: "II",
    primary: "#ff8d5c",
    secondary: "#6c1806",
    glow: "#ffd0a8"
  },
  {
    id: "glass-colossus",
    tier: "Tier III",
    name: "Glass Colossus Nhal",
    hp: 62000,
    arena: "Arena: The fractured obsidian basin where light bends into blades.",
    reward: "Weak point: Heart prism. Reward: Bloodglass fragments and vault keys.",
    story:
      "A raid-scale giant built to show exactly how donation damage compresses impossible fights into short, brutal bursts.",
    emblem: "III",
    primary: "#86b8ff",
    secondary: "#1a2758",
    glow: "#d7e6ff"
  },
  {
    id: "void-seraph",
    tier: "Tier IV",
    name: "Void Seraph Kael",
    hp: 1000000,
    arena: "Arena: The midnight rift where broken stars orbit a black crown.",
    reward: "Weak point: Rift core. Reward: Ascension marks and thronefire.",
    story:
      "The final apex boss exists to make huge gifts feel legendary. Free clicks still matter, but large donations turn the whole battle into a spectacle.",
    emblem: "IV",
    primary: "#a78bff",
    secondary: "#1d1144",
    glow: "#efe6ff"
  }
];

const formatNumber = (value) => new Intl.NumberFormat("en-US").format(value);
const storageKey = "voidforge-free-clicks-v1";
const site = data.site ?? {};
const creator = data.creator;
const game = data.game;
const donationHubName = site.donationHubName ?? "PLS DONATE";
const donationHubUrl =
  site.donationHubUrl ?? "https://www.roblox.com/games/8737602449/PLS-DONATE";
const clickDamage = data.freeTrack?.clickDamage ?? 1;

const passes = data.passes.slice().sort((left, right) => {
  if (left.damage !== right.damage) {
    return left.damage - right.damage;
  }

  return left.id - right.id;
});

const state = {
  activeTab: "raid",
  freeClicks: Math.max(0, Number(localStorage.getItem(storageKey) || 0) || 0),
  selectedBoss: bosses[1],
  selectedPass: passes.find((pass) => pass.damage >= 100) ?? passes[0]
};

const elements = {
  brandTitle: document.querySelector("#brand-title"),
  headerDonateLink: document.querySelector("#header-donate-link"),
  heroDescription: document.querySelector("#hero-description"),
  plsDonateLink: document.querySelector("#pls-donate-link"),
  plsDonateLinkSecondary: document.querySelector("#pls-donate-link-secondary"),
  formulaBanner: document.querySelector("#formula-banner"),
  donationHubName: document.querySelector("#donation-hub-name"),
  donationTarget: document.querySelector("#donation-target"),
  donationTargetSecondary: document.querySelector("#donation-target-secondary"),
  donationTargetTertiary: document.querySelector("#donation-target-tertiary"),
  statTotalPasses: document.querySelector("#stat-total-passes"),
  statHighestGift: document.querySelector("#stat-highest-gift"),
  statStackTotal: document.querySelector("#stat-stack-total"),
  statTarget: document.querySelector("#stat-target"),
  gameIcon: document.querySelector("#game-icon"),
  gameName: document.querySelector("#game-name"),
  gameMeta: document.querySelector("#game-meta"),
  trackedGameNameInline: document.querySelector("#tracked-game-name-inline"),
  realmCreator: document.querySelector("#realm-creator"),
  realmVisits: document.querySelector("#realm-visits"),
  realmPlaying: document.querySelector("#realm-playing"),
  profileLink: document.querySelector("#profile-link"),
  freeTrackCopy: document.querySelector("#free-track-copy"),
  freeClicks: document.querySelector("#free-clicks"),
  freeDamageBank: document.querySelector("#free-damage-bank"),
  freePathNote: document.querySelector("#free-path-note"),
  clickOrb: document.querySelector("#click-orb"),
  resetClicks: document.querySelector("#reset-clicks"),
  bossList: document.querySelector("#boss-list"),
  bossVisual: document.querySelector("#boss-visual"),
  bossEmblem: document.querySelector("#boss-emblem"),
  selectedBossName: document.querySelector("#selected-boss-name"),
  selectedBossTier: document.querySelector("#selected-boss-tier"),
  selectedBossStory: document.querySelector("#selected-boss-story"),
  selectedBossArena: document.querySelector("#selected-boss-arena"),
  selectedBossReward: document.querySelector("#selected-boss-reward"),
  bossMeter: document.querySelector("#boss-meter"),
  metricBossHp: document.querySelector("#metric-boss-hp"),
  metricFreeHits: document.querySelector("#metric-free-hits"),
  metricBoostedHits: document.querySelector("#metric-boosted-hits"),
  metricHitDamage: document.querySelector("#metric-hit-damage"),
  passSelect: document.querySelector("#pass-select"),
  selectedPassName: document.querySelector("#selected-pass-name"),
  selectedPassCopy: document.querySelector("#selected-pass-copy"),
  passGrid: document.querySelector("#pass-grid"),
  donationStatus: document.querySelector("#donation-status"),
  leaderboardList: document.querySelector("#leaderboard-list"),
  activityList: document.querySelector("#activity-list"),
  footerCopy: document.querySelector("#footer-copy"),
  tabButtons: Array.from(document.querySelectorAll("[data-tab-target]")),
  tabPanels: Array.from(document.querySelectorAll("[data-tab-panel]"))
};

function setActiveTab(tabName) {
  state.activeTab = tabName;

  for (const button of elements.tabButtons) {
    button.classList.toggle("active", button.dataset.tabTarget === tabName);
  }

  for (const panel of elements.tabPanels) {
    panel.classList.toggle("active", panel.dataset.tabPanel === tabName);
  }
}

function getFreeDamage() {
  return state.freeClicks * clickDamage;
}

function fillStaticContent() {
  document.title = `${site.title ?? "Voidforge Shrine"} | Gift @${creator.username}`;
  elements.brandTitle.textContent = site.title ?? "Voidforge Shrine";

  elements.headerDonateLink.href = donationHubUrl;
  elements.plsDonateLink.href = donationHubUrl;
  elements.plsDonateLinkSecondary.href = donationHubUrl;

  elements.heroDescription.textContent = `${
    site.tagline ??
    "Forge free damage with clicks, then gift @1_xLow for permanent boss power."
  } The tracked game is ${game.name}, but the main donor route is ${donationHubName}.`;
  elements.formulaBanner.textContent = data.formula;
  elements.donationHubName.textContent = donationHubName;
  elements.donationTarget.textContent = `@${creator.username}`;
  elements.donationTargetSecondary.textContent = `@${creator.username}`;
  elements.donationTargetTertiary.textContent = `@${creator.username}`;

  elements.statTotalPasses.textContent = formatNumber(data.summary.totalPasses);
  elements.statHighestGift.textContent = `+${formatNumber(data.summary.highestDamage)}`;
  elements.statStackTotal.textContent = `+${formatNumber(
    data.summary.totalDamageIfAllPassesOwned
  )}`;
  elements.statTarget.textContent = `@${creator.username}`;

  elements.gameName.textContent = game.name;
  elements.gameMeta.textContent = `${formatNumber(game.visits)} visits in the tracked realm`;
  elements.trackedGameNameInline.textContent = game.name;
  elements.realmCreator.textContent = `@${creator.username}`;
  elements.realmVisits.textContent = formatNumber(game.visits);
  elements.realmPlaying.textContent = formatNumber(game.playing);
  elements.profileLink.href = creator.profileUrl;
  elements.profileLink.textContent = `View @${creator.username}`;

  if (game.iconUrl) {
    elements.gameIcon.src = game.iconUrl;
    elements.gameIcon.alt = `${game.name} icon`;
  }

  elements.freeTrackCopy.textContent = data.freeTrack.perks.join(" ");
  elements.footerCopy.textContent = `Live data refreshed ${new Date(
    data.generatedAt
  ).toLocaleString()} for ${creator.username}, ${game.name}, and the ${donationHubName} gift route.`;
}

function updateFreeClickStats() {
  const freeDamage = getFreeDamage();
  elements.freeClicks.textContent = formatNumber(state.freeClicks);
  elements.freeDamageBank.textContent = `+${formatNumber(freeDamage)}`;

  if (freeDamage === 0) {
    elements.freePathNote.textContent =
      "Tap the forge once to start your free path. Every click adds 1 damage.";
  } else {
    elements.freePathNote.textContent = `You have banked ${formatNumber(
      freeDamage
    )} free damage. Keep clicking, or jump to the donation tab to add permanent gift damage.`;
  }
}

function renderBosses() {
  elements.bossList.innerHTML = "";

  for (const boss of bosses) {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "boss-card";
    card.dataset.bossId = boss.id;
    card.innerHTML = `
      <span class="boss-card-tier">${boss.tier}</span>
      <strong>${boss.name}</strong>
      <span>${formatNumber(boss.hp)} HP</span>
      <span>${boss.arena.replace("Arena: ", "")}</span>
    `;

    card.classList.toggle("active", boss.id === state.selectedBoss.id);
    card.addEventListener("click", () => {
      state.selectedBoss = boss;
      renderBosses();
      updateBossPreview();
    });

    elements.bossList.appendChild(card);
  }
}

function renderPassSelect() {
  elements.passSelect.innerHTML = "";

  for (const pass of passes) {
    const option = document.createElement("option");
    option.value = String(pass.id);
    option.selected = pass.id === state.selectedPass.id;
    option.textContent = `${formatNumber(pass.priceInRobux)} Robux -> +${formatNumber(
      pass.damage
    )} damage`;
    elements.passSelect.appendChild(option);
  }

  elements.passSelect.addEventListener("change", () => {
    const nextPass = passes.find((pass) => pass.id === Number(elements.passSelect.value));

    if (!nextPass) {
      return;
    }

    state.selectedPass = nextPass;
    updateBossPreview();
    syncActivePassCards();
  });
}

function renderPassGrid() {
  elements.passGrid.innerHTML = "";

  for (const pass of passes) {
    const card = document.createElement("article");
    card.className = "pass-card";
    card.dataset.passId = String(pass.id);
    card.innerHTML = `
      <img src="${pass.imageUrl}" alt="${pass.name} gamepass icon" />
      <div class="pass-card-top">
        <span class="damage-pill">+${formatNumber(pass.damage)} damage</span>
        ${
          pass.duplicateTotal > 1
            ? `<span class="duplicate-pill">${pass.duplicateIndex}/${pass.duplicateTotal}</span>`
            : ""
        }
      </div>
      <h3>${formatNumber(pass.priceInRobux)} Robux</h3>
      <p class="pass-meta">
        Gift this amount to match +${formatNumber(pass.damage)} boss damage.<br />
        Pass ID: ${pass.id}<br />
        Sales: ${formatNumber(pass.sales)}
      </p>
      <div class="pass-actions">
        <button class="ghost-button" type="button">Preview in game tab</button>
        <a class="link-button" href="${pass.url}" target="_blank" rel="noreferrer">Open direct pass</a>
      </div>
    `;

    const previewButton = card.querySelector("button");
    previewButton.addEventListener("click", () => {
      state.selectedPass = pass;
      elements.passSelect.value = String(pass.id);
      setActiveTab("raid");
      updateBossPreview();
      syncActivePassCards();
      window.scrollTo({
        top: document.querySelector("#experience-shell").offsetTop - 96,
        behavior: "smooth"
      });
    });

    elements.passGrid.appendChild(card);
  }

  syncActivePassCards();
}

function syncActivePassCards() {
  for (const card of elements.passGrid.querySelectorAll(".pass-card")) {
    card.classList.toggle("active", Number(card.dataset.passId) === state.selectedPass.id);
  }
}

function updateBossPreview() {
  const boss = state.selectedBoss;
  const pass = state.selectedPass;
  const freeDamage = getFreeDamage();
  const boostedDamage = freeDamage + pass.damage;
  const freeHits = freeDamage > 0 ? Math.ceil(boss.hp / freeDamage) : null;
  const boostedHits = boostedDamage > 0 ? Math.ceil(boss.hp / boostedDamage) : null;
  const bossMeterPercent = Math.max(4, Math.min(100, (boostedDamage / boss.hp) * 100));

  elements.selectedBossName.textContent = boss.name;
  elements.selectedBossTier.textContent = boss.tier;
  elements.selectedBossStory.textContent = boss.story;
  elements.selectedBossArena.textContent = boss.arena;
  elements.selectedBossReward.textContent = boss.reward;
  elements.bossEmblem.textContent = boss.emblem;
  elements.metricBossHp.textContent = formatNumber(boss.hp);
  elements.metricFreeHits.textContent = freeHits ? formatNumber(freeHits) : "Tap to start";
  elements.metricBoostedHits.textContent = boostedHits ? formatNumber(boostedHits) : "--";
  elements.metricHitDamage.textContent = formatNumber(boostedDamage);
  elements.bossMeter.style.width = `${bossMeterPercent}%`;

  elements.bossVisual.style.setProperty("--boss-primary", boss.primary);
  elements.bossVisual.style.setProperty("--boss-secondary", boss.secondary);
  elements.bossVisual.style.setProperty("--boss-glow", boss.glow);

  elements.selectedPassName.textContent = `${formatNumber(pass.priceInRobux)} Robux gift`;
  elements.selectedPassCopy.textContent = `Gifting ${formatNumber(
    pass.priceInRobux
  )} Robux to @${creator.username} in ${donationHubName}, or opening the direct pass, adds +${formatNumber(
    pass.damage
  )} damage. With your free clicks banked, that becomes ${formatNumber(
    boostedDamage
  )} damage every strike.`;
}

function renderEmptyBoard(message) {
  elements.donationStatus.textContent = message;
  elements.leaderboardList.innerHTML = `<article class="empty-state">No gifts are on the board yet.</article>`;
  elements.activityList.innerHTML = `<article class="empty-state">Recent gifts will appear here once the webhook starts receiving Roblox purchase events.</article>`;
}

function renderDonationBoard(snapshot) {
  const leaderboard = Array.isArray(snapshot?.leaderboard) ? snapshot.leaderboard : [];
  const recent = Array.isArray(snapshot?.recent) ? snapshot.recent : [];

  elements.donationStatus.textContent =
    recent.length > 0
      ? `${formatNumber(snapshot.totalRaised ?? 0)} Robux tracked`
      : "Waiting for first gift";

  if (!leaderboard.length) {
    elements.leaderboardList.innerHTML = `<article class="empty-state">The first donor will appear here as soon as Roblox posts a purchase event.</article>`;
  } else {
    elements.leaderboardList.innerHTML = leaderboard
      .slice(0, 10)
      .map(
        (entry, index) => `
          <article class="leaderboard-item">
            <div class="leaderboard-rank">#${index + 1}</div>
            <div class="leaderboard-meta">
              <strong>${entry.displayName || entry.username}</strong>
              <span>@${entry.username} • ${formatNumber(entry.donationCount)} gift${
                entry.donationCount === 1 ? "" : "s"
              }</span>
            </div>
            <div class="leaderboard-total">${formatNumber(entry.totalAmount)} Robux</div>
          </article>
        `
      )
      .join("");
  }

  if (!recent.length) {
    elements.activityList.innerHTML = `<article class="empty-state">The live feed wakes up when the webhook receives its first Roblox event.</article>`;
  } else {
    elements.activityList.innerHTML = recent
      .slice(0, 14)
      .map(
        (entry) => `
          <article class="activity-item">
            <strong>${entry.displayName || entry.username}</strong>
            <span>@${entry.username} gifted ${formatNumber(entry.amount)} Robux via ${
              entry.productType
            }</span>
            <span>${new Date(entry.createdAt).toLocaleString()}</span>
          </article>
        `
      )
      .join("");
  }
}

async function loadDonationBoard() {
  if (window.location.protocol === "file:") {
    renderEmptyBoard("Run the Node server for the live board");
    return;
  }

  try {
    const response = await fetch("./api/donations");

    if (!response.ok) {
      throw new Error(`Request failed with ${response.status}`);
    }

    renderDonationBoard(await response.json());
    connectDonationStream();
  } catch (error) {
    renderEmptyBoard("Start the WispByte or local server to enable live gifts");
  }
}

function connectDonationStream() {
  if (!("EventSource" in window)) {
    return;
  }

  const stream = new EventSource("./api/donations/stream");

  stream.addEventListener("snapshot", (event) => {
    renderDonationBoard(JSON.parse(event.data));
  });

  stream.addEventListener("donation", (event) => {
    const payload = JSON.parse(event.data);
    renderDonationBoard(payload.snapshot ?? {});
  });

  stream.onerror = () => {
    elements.donationStatus.textContent = "Reconnecting to live board";
  };
}

function setupTabs() {
  for (const button of elements.tabButtons) {
    button.addEventListener("click", () => {
      setActiveTab(button.dataset.tabTarget);
    });
  }
}

function setupClicker() {
  elements.clickOrb.addEventListener("click", () => {
    state.freeClicks += 1;
    localStorage.setItem(storageKey, String(state.freeClicks));
    elements.clickOrb.classList.remove("burst");
    void elements.clickOrb.offsetWidth;
    elements.clickOrb.classList.add("burst");
    updateFreeClickStats();
    updateBossPreview();
  });

  elements.resetClicks.addEventListener("click", () => {
    state.freeClicks = 0;
    localStorage.setItem(storageKey, "0");
    updateFreeClickStats();
    updateBossPreview();
  });
}

function setupReveal() {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      }
    },
    {
      threshold: 0.12
    }
  );

  for (const target of document.querySelectorAll(".glass-panel, .boss-card, .pass-card")) {
    observer.observe(target);
  }
}

fillStaticContent();
setupTabs();
setupClicker();
updateFreeClickStats();
renderBosses();
renderPassSelect();
renderPassGrid();
updateBossPreview();
loadDonationBoard();
setupReveal();
