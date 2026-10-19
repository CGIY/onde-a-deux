const mediaCatalog = window.ONDE_MEDIA_CATALOG || { film: [], serie: [], spectacle: [] };

const posterByType = {
  film: "https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=500&q=80",
  serie: "https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?auto=format&fit=crop&w=500&q=80",
  spectacle: "https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=500&q=80",
  jeu: "https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=500&q=80"
};

function mediaCards(type, description, subtype) {
  return (mediaCatalog[type] || []).map((title) => ({ title, description, subtype, visual: posterByType[type] }));
}

const categories = [
  {
    id: "media", name: "Médias", icon: "◐", color: "#668aa3",
    art: "linear-gradient(145deg, #668aa3, #335667)",
    cards: [
      ...mediaCards("film", "Un film de votre bibliothèque.", "Film"),
      ...mediaCards("serie", "Une série de votre bibliothèque.", "Série"),
      ...mediaCards("spectacle", "Un spectacle de votre bibliothèque.", "Spectacle")
    ]
  },
  {
    id: "jeu", name: "Jeu", icon: "◆", color: "#7d9a86",
    art: "linear-gradient(145deg, #8baa94, #486d56)",
    cards: [
      ...["Minecraft Dungeon 2", "Minecraft", "Mario Tennis", "Mario Kart", "Baldurs Gate", "Cult of the Lamb", "Mini-jeu Switch"].map((title) => ({ title, description: "Un jeu vidéo à choisir et partager à deux.", subtype: "Jeu vidéo", visual: posterByType.jeu })),
      ...[
        "Jaipur", "Trio", "That's Not a Hat", "District Noir", "Mantis", "Compagnons", "Athlètes de Compète", "CT Words", "Les Aventuriers du Rail", "Fire Tower", "Après-Ski", "Regicide", "Cérébré", "Eternal Decks", "DOS", "Zenith", "Coffee Rush", "Captain Flip", "Ink It", "Hues and Cues", "Red Notice", "The Vale of Eternity", "7 Wonders", "Agent Avenue", "iKnow", "Redac Chef", "Happy Salmon", "Locus", "Gourmands", "Cat in the Box", "Cités Royales", "Splendor Duel", "The Gang", "Sky Team", "e-pense", "Flowers", "Splendor", "Cocoon", "7 Wonders Dice", "Take Time", "Harmonies", "Finspan", "Rebirth", "Bomb Busters", "Art Society", "Kronologic", "Dracula vs Van Helsing", "Mad Trip", "Les Aventuriers du Rail", "Reykholt", "Carnival of Monsters", "Marrakech", "Codenames", "Bunker", "Code Names"
      ].map((title) => ({ title, description: "Un jeu de société de votre collection.", subtype: "Jeu de société", visual: posterByType.jeu }))
    ]
  },
  {
    id: "action", name: "Action", icon: "✦", color: "#d2a95e",
    art: "linear-gradient(145deg, #dda95b, #b36b48)",
    cards: [
      { title: "Balade en ville", description: "Sortir sans itinéraire et choisir la direction à tour de rôle.", subtype: "Action", visual: "https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=500&q=80" },
      { title: "Petit massage partagé", description: "Prendre quelques minutes pour se masser à tour de rôle.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=500&q=80" },
      { title: "Massage cuisse C", description: "Un massage choisi pour C, avec accord et arrêt possible à tout moment.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?auto=format&fit=crop&w=500&q=80" },
      { title: "Massage tête A", description: "Un massage choisi pour A, avec accord et arrêt possible à tout moment.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=500&q=80" },
      { title: "Soin du visage", description: "Préparer un soin doux et prendre soin l’un de l’autre.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=500&q=80" },
      { title: "Café en ville", description: "Sortir prendre un café sans autre programme.", subtype: "Action", visual: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?auto=format&fit=crop&w=500&q=80" },
      { title: "Mot doux caché", description: "Glisser un petit mot tendre dans un endroit où l’autre le trouvera plus tard.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?auto=format&fit=crop&w=500&q=80" },
      { title: "Aquarelle à deux", description: "Peindre ensemble sans chercher à faire parfait.", subtype: "Action", visual: "https://images.unsplash.com/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=500&q=80" },
      { title: "Photos souvenir", description: "Faire quelques photos spontanées du moment, juste pour vous.", subtype: "Mignonnerie", visual: "https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?auto=format&fit=crop&w=500&q=80" }
    ]
  },
  {
    id: "cocooning", name: "Apéro & cocooning", icon: "☕", color: "#c67b52",
    art: "linear-gradient(145deg, #d99a62, #8a4e3b)",
    cards: [
      { title: "Popcorn", description: "Un grand bol au milieu, un film choisi ensemble et le canapé pour nous.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1585647347384-2593bc35786b?auto=format&fit=crop&w=500&q=80" },
      { title: "Apéro dinatoire", description: "Installer plusieurs petites choses à grignoter et prendre son temps.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=500&q=80" },
      { title: "Croque-monsieur", description: "Préparer quelque chose de chaud et croustillant à manger avec les doigts.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?auto=format&fit=crop&w=500&q=80" },
      { title: "Cake", description: "Faire un cake ensemble, même imparfait, puis le goûter encore tiède.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=500&q=80" },
      { title: "Feuillette", description: "Choisir ou préparer une douceur feuilletée à partager.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1555507036-ab1f4038808a?auto=format&fit=crop&w=500&q=80" },
      { title: "Crêpes", description: "Une pâte, des garnitures et chacun compose la prochaine crêpe.", subtype: "Dessert", visual: "https://images.unsplash.com/photo-1519671282429-b44660ead0a7?auto=format&fit=crop&w=500&q=80" },
      { title: "Pizza", description: "Choisir une pizza à partager et manger directement dans la boîte.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1579751626657-72bc17010498?auto=format&fit=crop&w=500&q=80" },
      { title: "BK", description: "Le plaisir régressif assumé, avec la commande que l’on connaît déjà par cœur.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1619881590738-a111d176d906?auto=format&fit=crop&w=500&q=80" },
      ...["KFC", "Kebab/Tacos", "Sushi"].map((title) => ({ title, description: "Une commande à choisir et partager à deux.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1552566626-52f8b828?auto=format&fit=crop&w=500&q=80" })),
      { title: "McDonald’s", description: "Le plaisir régressif assumé, avec la commande que l’on connaît déjà par cœur.", subtype: "Fast-food", visual: "https://images.unsplash.com/photo-1619881590738-a111d176d906?auto=format&fit=crop&w=500&q=80" },
      { title: "Plaid et chocolat", description: "Éteindre les grandes lumières, sortir le plaid et prendre du chocolat.", subtype: "Canapé", visual: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?auto=format&fit=crop&w=500&q=80" }
    ]
  },
  {
    id: "sexualite", name: "Sexualité", icon: "♥", color: "#d88a27",
    art: "linear-gradient(145deg, #85506c, #42263b)",
    cards: [
      ...["Fellation", "Cunni"].map((title) => ({ title, description: "Une idée intime, seulement avec accord clair et retrait possible à tout moment.", subtype: "Simple", art: "linear-gradient(145deg, #f4d35e, #e9a23b)" })),
      ...["Faciale Ahegao", "Session Fessée", "Lovense", "Poste une nude en ligne"].map((title) => ({ title, description: "Une proposition à discuter ensemble avant de commencer, avec retrait possible à tout moment.", subtype: "Fun", art: "linear-gradient(145deg, #f29e4c, #d1495b)" })),
      ...["Gorge profonde", "Anal Time", "Webcam Pussy", "Violent roleplay", "Golden Shower sur A", "Golden Shower sur C"].map((title) => ({ title, description: "Proposition hardcore : accord explicite, limites définies et arrêt immédiat possible.", subtype: "Hardcore", art: "linear-gradient(145deg, #d1495b, #7b2342)" })),
      ...[
        ["Sabre Laser", "La lueur du sabre comme seule source lumineuse : corps dans la fumée, ombres bleues et rouges, ambiance sci-fi torride."],
        ["L’étudiante", "Costume schoolgirl, jupe plissée et posture complice autour d’un bureau."],
        ["Faciale", "Gros plan artistique sur le visage, le regard caméra et les cheveux mouillés."],
        ["Cosplay nonne", "Voile et lingerie noire, clair-obscur à la bougie, contraste sacré-profane."],
        ["Berlin", "Nuit pluvieuse en ville, manteau ouvert sur la lingerie, réverbères et fumée."],
        ["Chemise d’homme", "Une chemise à peine boutonnée, assise au bord du lit, lumière du matin."],
        ["Miroir", "Corps en reflet, regard dans le miroir, buée et traces de doigts sur le verre."],
        ["Cuisine", "Tablier, farine sur la peau et lumière douce sur le plan de travail."],
        ["Douche vapeur", "Chemise blanche mouillée, carrelage et buée sur l’objectif."],
        ["Matin", "Draps froissés, déclencheur à distance et lumière naturelle."],
        ["Après-sport", "Sueur, main dans les cheveux et tee-shirt trempé devant le miroir."],
        ["Sur les rochers", "Drapé au vent sur les rochers battus par les embruns, à la golden hour."],
        ["Sous la pluie", "Robe mouillée, rires et baisers sous l’averse, éclairage urbain."],
        ["Capot de voiture", "Nuit, phares en contre-jour, cuir, chrome et reflets sur la carrosserie."],
        ["Golden hour en silhouette", "Contre-jour au coucher du soleil, silhouettes entrelacées à la limite du montrable."],
        ["Néons underground", "Parking souterrain, enseignes colorées, cuir et poses contre les piliers."]
      ].map(([title, description]) => ({ title, description, subtype: "Fujifilm", art: "linear-gradient(145deg, #f4d35e, #e76f51)" }))
    ]
  }
];

const stateKey = "onde-crossed-decisions-v8";
const welcomeKey = "onde-welcome-v1";
const screens = {
  intro: document.getElementById("introScreen"),
  game: document.getElementById("gameScreen"),
  kept: document.getElementById("keptScreen"),
  summary: document.getElementById("summaryScreen")
};

const els = {
  deck: document.getElementById("deck"),
  categoryTrack: document.getElementById("categoryTrack"),
  categoryTitle: document.getElementById("categoryTitle"),
  stepLabel: document.getElementById("stepLabel"),
  playerPill: document.getElementById("playerPill"),
  undoButton: document.getElementById("undoButton"),
  resumeButton: document.getElementById("resumeButton"),
  keptCategory: document.getElementById("keptCategory"),
  keptTitle: document.getElementById("keptTitle"),
  keptMessage: document.getElementById("keptMessage"),
  nextCategoryButton: document.getElementById("nextCategoryButton"),
  matchGrid: document.getElementById("matchGrid"),
  decisionList: document.getElementById("decisionList"),
  decisionSection: document.getElementById("decisionSection"),
  toast: document.getElementById("toast")
};

let decision = freshDecision();
let drag = null;
let toastTimer = null;

function shuffled(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function buildPlan(assignments) {
  return [
    { round: 1, player: "J1", categories: assignments.J1 },
    { round: 1, player: "J2", categories: assignments.J2 },
    { round: 2, player: "J1", categories: assignments.J2 },
    { round: 2, player: "J2", categories: assignments.J1 }
  ];
}

function freshDecision() {
  const ids = shuffled(categories.map((category) => category.id));
  const split = Math.ceil(ids.length / 2);
  const assignments = { J1: ids.slice(0, split), J2: ids.slice(split) };
  return {
    assignments,
    plan: buildPlan(assignments),
    phase: 0,
    categoryStep: 0,
    categoryDecks: {},
    remaining: {},
    removed: {},
    picks: { J1: {}, J2: {} },
    skipVotes: {},
    intensityVotes: {},
    complete: false
  };
}

function saveDecision() {
  localStorage.setItem(stateKey, JSON.stringify(decision));
}

function loadDecision() {
  try {
    const saved = JSON.parse(localStorage.getItem(stateKey));
    if (!saved || !Array.isArray(saved.plan) || !saved.picks) return false;
    decision = saved;
    decision.categoryDecks ||= {};
    decision.skipVotes ||= {};
    decision.intensityVotes ||= {};
    return true;
  } catch (_) {
    return false;
  }
}

function showScreen(name) {
  Object.entries(screens).forEach(([key, screen]) => { screen.hidden = key !== name; });
  window.scrollTo({ top: 0, behavior: "instant" });
}

function currentPhase() {
  return decision.plan[decision.phase];
}

function currentCategory() {
  const phase = currentPhase();
  const id = phase.categories[decision.categoryStep];
  return categories.find((category) => category.id === id);
}

function currentDeckKey() {
  return `${decision.phase}-${currentCategory().id}`;
}

function gameDeckIndexes(cards) {
  const video = cards.map((card, index) => card.subtype === "Jeu vidéo" ? index : null).filter((index) => index !== null);
  const board = cards.map((card, index) => card.subtype === "Jeu de société" ? index : null).filter((index) => index !== null);
  if (!video.length || board.length < 2) return shuffled(cards.map((_, index) => index)).slice(0, 3);
  const selectedVideo = shuffled(video).slice(0, 1);
  const selectedBoard = shuffled(board).slice(0, 2);
  return shuffled([...selectedVideo, ...selectedBoard]);
}

function initializeDeck(category) {
  const key = currentDeckKey();
  if (!decision.categoryDecks[category.id]) {
    decision.categoryDecks[category.id] = category.id === "jeu"
      ? gameDeckIndexes(category.cards)
      : shuffled(category.cards.map((_, index) => index)).slice(0, 3);
  }
  if (!decision.remaining[key]) {
    decision.remaining[key] = [...decision.categoryDecks[category.id]];
    decision.removed[key] = [];
    saveDecision();
  }
}

function renderTrack() {
  const phase = currentPhase();
  els.categoryTrack.innerHTML = "";
  phase.categories.forEach((categoryId, index) => {
    const category = categories.find((item) => item.id === categoryId);
    const segment = document.createElement("span");
    segment.className = `track-segment${index < decision.categoryStep ? " done" : index === decision.categoryStep ? " active" : ""}`;
    segment.style.setProperty("--track-color", category.color);
    segment.setAttribute("aria-label", `${category.name}${index < decision.categoryStep ? " terminée" : index === decision.categoryStep ? " en cours" : " à venir"}`);
    els.categoryTrack.appendChild(segment);
  });
}

function renderDeck() {
  const phase = currentPhase();
  const category = currentCategory();
  initializeDeck(category);
  const key = currentDeckKey();
  const remaining = decision.remaining[key];

  els.categoryTitle.textContent = category.name;
  els.stepLabel.textContent = `Manche ${phase.round} · ${phase.player} · catégorie imposée ${decision.categoryStep + 1} sur ${phase.categories.length}`;
  els.playerPill.textContent = `${phase.player} choisit dedans`;
  els.undoButton.disabled = decision.removed[key].length === 0;
  els.deck.innerHTML = "";

  remaining.slice(0, 3).reverse().forEach((cardIndex, reverseIndex, visible) => {
    const depth = visible.length - reverseIndex - 1;
    const cardData = category.cards[cardIndex];
    const card = document.createElement("article");
    card.className = "tile-card";
    card.dataset.depth = String(depth);
    card.style.setProperty("--card-art", cardData.art || category.art);
    card.innerHTML = `
      ${cardData.visual ? `<div class="tile-poster" style="background-image:url('${cardData.visual}')" aria-hidden="true"></div>` : ""}
      <span class="tile-icon" aria-hidden="true">${category.icon}</span>
      <div class="tile-content">
        <div class="tile-category">${cardData.subtype || category.name}</div>
        <h3>${cardData.title}</h3>
        <p>${cardData.description}</p>
      </div>`;
    if (depth === 0) {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", `${cardData.title}. Flèche gauche pour éliminer, flèche haute pour la suivante, flèche droite pour valider.`);
      bindDrag(card);
      card.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") removeTopCard();
        if (event.key === "ArrowUp") cycleTopCard();
        if (event.key === "ArrowRight") keepCurrentCard();
      });
    }
    els.deck.appendChild(card);
  });
  renderTrack();
}

function bindDrag(card) {
  card.addEventListener("pointerdown", (event) => {
    drag = { card, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, dx: 0, dy: 0 };
    card.setPointerCapture(event.pointerId);
    card.classList.add("dragging");
  });
  card.addEventListener("pointermove", (event) => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    drag.dx = event.clientX - drag.startX;
    drag.dy = Math.min(24, event.clientY - drag.startY);
    const rotation = Math.max(-7, Math.min(7, drag.dx / 24));
    card.style.transform = `translate(${drag.dx}px, ${drag.dy}px) rotate(${rotation}deg)`;
  });
  card.addEventListener("pointerup", endDrag);
  card.addEventListener("pointercancel", endDrag);
}

function endDrag(event) {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const { dx, dy } = drag;
  drag.card.classList.remove("dragging");
  drag.card.style.transform = "";
  drag = null;
  if (dy < -78 && Math.abs(dy) > Math.abs(dx)) cycleTopCard();
  else if (dx < -78) removeTopCard();
  else if (dx > 78) keepCurrentCard();
}

function removeTopCard() {
  const key = currentDeckKey();
  const remaining = decision.remaining[key];
  if (remaining.length <= 1) {
    showToast("Il faut garder une tuile");
    return;
  }
  const top = els.deck.querySelector('.tile-card[data-depth="0"]');
  if (top) top.classList.add("removing");
  decision.removed[key].push(remaining.shift());
  saveDecision();
  if (navigator.vibrate) navigator.vibrate(12);
  window.setTimeout(renderDeck, 240);
}

function cycleTopCard() {
  const key = currentDeckKey();
  const remaining = decision.remaining[key];
  if (remaining.length <= 1) {
    showToast("C’est la dernière tuile");
    return;
  }
  const top = els.deck.querySelector('.tile-card[data-depth="0"]');
  if (top) top.classList.add("cycling");
  remaining.push(remaining.shift());
  saveDecision();
  if (navigator.vibrate) navigator.vibrate(8);
  window.setTimeout(renderDeck, 240);
}

function undoRemove() {
  const key = currentDeckKey();
  const removed = decision.removed[key];
  if (!removed.length) return;
  const restoredIndex = removed[removed.length - 1];
  decision.removed[key] = removed.slice(0, -1);
  decision.remaining[key] = [restoredIndex, ...decision.remaining[key]];
  saveDecision();
  renderDeck();
  showToast("Tuile récupérée");
}

function keepCurrentCard() {
  const phase = currentPhase();
  const category = currentCategory();
  const remaining = decision.remaining[currentDeckKey()];
  if (!remaining.length) return;
  const top = els.deck.querySelector('.tile-card[data-depth="0"]');
  if (top) top.classList.add("keeping");
  decision.picks[phase.player][category.id] = remaining[0];
  saveDecision();
  if (navigator.vibrate) navigator.vibrate([18, 35, 18]);
  window.setTimeout(showTransition, 240);
}

function showTransition() {
  const phase = currentPhase();
  const category = currentCategory();
  const phaseFinished = decision.categoryStep === phase.categories.length - 1;
  const allFinished = phaseFinished && decision.phase === decision.plan.length - 1;

  els.keptCategory.textContent = `${category.name} · ${phase.player}`;
  if (!phaseFinished) {
    const categoriesLeft = phase.categories.length - decision.categoryStep - 1;
    els.keptTitle.textContent = "Choix enregistré";
    els.keptMessage.textContent = `Il reste ${categoriesLeft} catégorie${categoriesLeft > 1 ? "s" : ""} attribuée${categoriesLeft > 1 ? "s" : ""} avant de passer la main.`;
    els.nextCategoryButton.textContent = "Catégorie suivante";
  } else if (allFinished) {
    els.keptTitle.textContent = "Choix croisés terminés";
    els.keptMessage.textContent = "On révèle maintenant vos accords et les décisions à rapprocher.";
    els.nextCategoryButton.textContent = "Voir les accords";
  } else {
    const next = decision.plan[decision.phase + 1];
    els.keptTitle.textContent = `Manche ${phase.round} · ${phase.player} terminé`;
    els.keptMessage.textContent = next.round === phase.round
      ? `Passez à ${next.player} : ${next.categories.length} autres catégories lui sont attribuées.`
      : `Manche ${next.round} : ${next.player} choisit maintenant dans les catégories de l’autre.`;
    els.nextCategoryButton.textContent = `Continuer avec ${next.player}`;
  }
  showScreen("kept");
}

function moveNext() {
  const phase = currentPhase();
  if (decision.categoryStep < phase.categories.length - 1) {
    decision.categoryStep += 1;
    saveDecision();
    showScreen("game");
    renderDeck();
    return;
  }
  if (decision.phase < decision.plan.length - 1) {
    decision.phase += 1;
    decision.categoryStep = 0;
    saveDecision();
    showScreen("game");
    renderDeck();
    return;
  }
  decision.complete = true;
  saveDecision();
  renderResolution();
  showScreen("summary");
}

function resultCard(category, card, extraClass = "") {
  return `<article class="result-card ${extraClass}" style="--item-bg:${category.art}">
    <span aria-hidden="true">${category.icon}</span>
    <small>${category.name}</small>
    <strong>${card.title}</strong>
  </article>`;
}

function todayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function renderResolution() {
  els.matchGrid.innerHTML = "";
  els.decisionList.innerHTML = "";
  let matches = 0;
  let differences = 0;

  categories.forEach((category) => {
    const pick1 = decision.picks.J1[category.id];
    const pick2 = decision.picks.J2[category.id];
    if (pick1 === pick2) {
      matches += 1;
      els.matchGrid.insertAdjacentHTML("beforeend", resultCard(category, category.cards[pick1], "match-card"));
      return;
    }

    differences += 1;
    const card1 = category.cards[pick1];
    const card2 = category.cards[pick2];
    const duel = document.createElement("article");
    duel.className = "decision-card";
    duel.innerHTML = `
      <div class="decision-category"><span>${category.icon}</span><strong>${category.name}</strong></div>
      <div class="duel-options">
        ${resultCard(category, card1, "duel-option left")}
        ${resultCard(category, card2, "duel-option right")}
      </div>
      <div class="private-votes">
        <label class="intensity-vote">
          <span><strong>J1</strong> · À quel point tu y tiens ?</span>
          <output data-output="J1">50</output>
          <input type="range" min="0" max="100" value="50" data-player="J1" aria-label="Intensité de J1 pour ${card1.title}">
        </label>
        <label class="intensity-vote">
          <span><strong>J2</strong> · À quel point tu y tiens ?</span>
          <output data-output="J2">50</output>
          <input type="range" min="0" max="100" value="50" data-player="J2" aria-label="Intensité de J2 pour ${card2.title}">
        </label>
      </div>
      <div class="combined-gauge" aria-live="polite">
        <div class="gauge-track"><span class="gauge-j1"></span><i class="gauge-marker"></i></div>
        <div class="gauge-labels"><span>J1</span><strong class="gauge-score">50 / 50</strong><span>J2</span></div>
        <p class="gauge-result">Égalité : aucun choix n’est forcé.</p>
      </div>
      <div class="skip-today">
        <div><strong>Pas aujourd’hui</strong><small>Il faut l’accord des deux.</small></div>
        <div class="skip-actions">
          <button type="button" data-player="J1" aria-pressed="false">J1</button>
          <button type="button" data-player="J2" aria-pressed="false">J2</button>
        </div>
      </div>
      <div class="postponed-state"><span aria-hidden="true">✓</span><div><strong>Oublié pour aujourd’hui</strong><small>Ce choix reviendra demain.</small></div></div>`;
    const sliders = duel.querySelectorAll(".intensity-vote input");
    const gaugeFill = duel.querySelector(".gauge-j1");
    const gaugeMarker = duel.querySelector(".gauge-marker");
    const gaugeScore = duel.querySelector(".gauge-score");
    const result = duel.querySelector(".gauge-result");
    const left = duel.querySelector(".duel-option.left");
    const right = duel.querySelector(".duel-option.right");
    decision.intensityVotes[category.id] ||= { J1: 50, J2: 50 };
    const syncGauge = () => {
      const votes = decision.intensityVotes[category.id];
      const total = votes.J1 + votes.J2;
      const shareJ1 = total === 0 ? 50 : Math.round((votes.J1 / total) * 100);
      const shareJ2 = 100 - shareJ1;
      gaugeFill.style.width = `${shareJ1}%`;
      gaugeMarker.style.left = `${shareJ1}%`;
      gaugeScore.textContent = `${shareJ1} / ${shareJ2}`;
      duel.querySelector('[data-output="J1"]').textContent = votes.J1;
      duel.querySelector('[data-output="J2"]').textContent = votes.J2;
      left.classList.toggle("favoured", votes.J1 > votes.J2);
      right.classList.toggle("favoured", votes.J2 > votes.J1);
      result.textContent = votes.J1 > votes.J2
        ? `${card1.title} est validé : ${votes.J1} contre ${votes.J2}.`
        : votes.J2 > votes.J1
          ? `${card2.title} est validé : ${votes.J2} contre ${votes.J1}.`
          : "Égalité : aucun choix n’est forcé.";
    };
    sliders.forEach((slider) => {
      slider.value = decision.intensityVotes[category.id][slider.dataset.player];
      slider.addEventListener("input", () => {
        decision.intensityVotes[category.id][slider.dataset.player] = Number(slider.value);
        saveDecision();
        syncGauge();
      });
    });
    syncGauge();

    const day = todayKey();
    const existingVote = decision.skipVotes[category.id];
    if (!existingVote || existingVote.date !== day) {
      decision.skipVotes[category.id] = { date: day, J1: false, J2: false };
    }
    const skipButtons = duel.querySelectorAll(".skip-actions button");
    const syncSkipState = () => {
      const vote = decision.skipVotes[category.id];
      const postponed = vote.J1 && vote.J2;
      skipButtons.forEach((button) => {
        const pressed = Boolean(vote[button.dataset.player]);
        button.classList.toggle("pressed", pressed);
        button.setAttribute("aria-pressed", String(pressed));
        button.disabled = postponed;
      });
      sliders.forEach((slider) => { slider.disabled = postponed; });
      duel.classList.toggle("postponed", postponed);
    };
    skipButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const vote = decision.skipVotes[category.id];
        vote[button.dataset.player] = !vote[button.dataset.player];
        saveDecision();
        syncSkipState();
        if (vote.J1 && vote.J2) showToast("Oublié pour aujourd’hui");
      });
    });
    syncSkipState();
    els.decisionList.appendChild(duel);
  });

  if (!matches) {
    els.matchGrid.innerHTML = `<div class="empty-match"><span aria-hidden="true">≈</span><p>Aucun choix identique cette fois — vous avez simplement plus de choses à rapprocher.</p></div>`;
  }
  els.decisionSection.hidden = differences === 0;
}

function startNewDecision() {
  decision = freshDecision();
  saveDecision();
  showScreen("game");
  renderDeck();
}

function resumeDecision() {
  if (!loadDecision()) return startNewDecision();
  if (decision.complete) {
    renderResolution();
    showScreen("summary");
    return;
  }
  const phase = currentPhase();
  const categoryId = phase.categories[decision.categoryStep];
  if (Object.prototype.hasOwnProperty.call(decision.picks[phase.player], categoryId)) {
    showTransition();
    return;
  }
  showScreen("game");
  renderDeck();
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => els.toast.classList.remove("show"), 1500);
}

const welcomeChoices = { J1: null, J2: null };
const welcomeStatus = document.getElementById("welcomeStatus");
const startButton = document.getElementById("startButton");
document.querySelectorAll(".player-choice-button").forEach((button) => {
  button.addEventListener("click", () => {
    const player = button.dataset.player;
    welcomeChoices[player] = button.querySelector("strong").textContent;
    button.classList.add("selected");
    button.setAttribute("aria-pressed", "true");
    const bothReady = welcomeChoices.J1 && welcomeChoices.J2;
    startButton.disabled = !bothReady;
    welcomeStatus.textContent = bothReady
      ? "Les deux diodes sont allumées. Vous pouvez entrer."
      : `${player} est prêt. Il manque encore le choix de l’autre participant.`;
  });
});

document.getElementById("startButton").addEventListener("click", () => {
  if (!welcomeChoices.J1 || !welcomeChoices.J2) return;
  sessionStorage.setItem(welcomeKey, JSON.stringify(welcomeChoices));
  startNewDecision();
});
els.resumeButton.addEventListener("click", resumeDecision);
els.undoButton.addEventListener("click", undoRemove);
els.nextCategoryButton.addEventListener("click", moveNext);
document.getElementById("restartButton").addEventListener("click", startNewDecision);

const hasSavedDecision = loadDecision();
els.resumeButton.hidden = !hasSavedDecision;
const savedWelcome = JSON.parse(sessionStorage.getItem(welcomeKey) || "null");
if (savedWelcome?.J1 && savedWelcome?.J2) {
  welcomeChoices.J1 = savedWelcome.J1;
  welcomeChoices.J2 = savedWelcome.J2;
  document.querySelectorAll(".player-choice-button").forEach((button) => button.classList.add("selected"));
  startButton.disabled = false;
  welcomeStatus.textContent = "Les deux diodes sont allumées. Vous pouvez entrer.";
  if (hasSavedDecision) resumeDecision();
} else {
  showScreen("intro");
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
