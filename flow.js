(() => {
  const live = window.ondeLive;
  const catalog = window.ONDE_CATEGORIES;
  const byId = Object.fromEntries(catalog.map(category => [category.id, category]));
  const screens = Object.fromEntries(["intro", "game", "kept", "waiting", "summary", "plan"].map(name => [name, document.getElementById(`${name}Screen`)]));
  const $ = id => document.getElementById(id);
  const state = { own: null, other: null, role: "", room: "", ready: false, screen: "intro", busy: false, summarySignature: "", planSignature: "", recorded: false };
  const categoryIds = catalog.map(category => category.id);
  const mysteryCache = new Map();
  const otherRole = () => state.role === "J1" ? "J2" : "J1";
  const ownLabel = () => state.role === "J1" ? "A" : "C";
  const validPick = (category, index) => Number.isInteger(index) && index >= 0 && index < category.cards.length;
  const validDecision = value => ["A", "C", "pass"].includes(value);
  const historyKey = "onde-recent-v1";
  function recentHistory() {
    try {
      const records = JSON.parse(localStorage.getItem(historyKey) || "[]");
      return Array.isArray(records) ? records.filter(item => typeof item.title === "string" && Number.isFinite(item.at) && Date.now() - item.at < 7 * 86400000).slice(-160) : [];
    } catch { return []; }
  }
  const escape = value => String(value).replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));

  function show(name) {
    if (state.screen === name && !screens[name].hidden) return;
    state.screen = name;
    Object.entries(screens).forEach(([key, element]) => { element.hidden = key !== name; });
    window.scrollTo(0, 0);
  }

  function seedFor(value) {
    let result = 2166136261;
    for (const character of value) result = Math.imul(result ^ character.charCodeAt(0), 16777619);
    return result >>> 0;
  }

  function random(seed) {
    let value = seed;
    return () => {
      value = (value + 0x6d2b79f5) | 0;
      let t = Math.imul(value ^ (value >>> 15), 1 | value);
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function sample(indices, count, rng) {
    const source = [...indices];
    for (let i = source.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [source[i], source[j]] = [source[j], source[i]];
    }
    return source.slice(0, count);
  }

  function deckFor(category) {
    const shared = state.role === "J1" ? state.own?.offers : state.other?.offers;
    if (Array.isArray(shared?.[category.id])) return shared[category.id].slice(0, 3);
    return sampleDeck(category);
  }

  function sampleDeck(category, history = []) {
    const rng = random(seedFor(`${state.room}:${category.id}:v2`));
    const recent = new Map(history.map(item => [item.title, item.at]));
    const preferred = indices => {
      const unseen = indices.filter(index => !recent.has(category.cards[index].title));
      const seen = indices.filter(index => recent.has(category.cards[index].title)).sort((a, b) => recent.get(category.cards[a].title) - recent.get(category.cards[b].title));
      return [...sample(unseen, unseen.length, rng), ...seen];
    };
    if (category.id === "jeu") {
      const board = category.cards.flatMap((card, index) => card.subtype === "Jeu de société" ? [index] : []);
      const video = category.cards.flatMap((card, index) => card.subtype === "Jeu vidéo" ? [index] : []);
      return sample([...preferred(board).slice(0, 2), ...preferred(video).slice(0, 1)], 3, rng);
    }
    return preferred(category.cards.map((_, index) => index)).slice(0, 3);
  }

  function prepareOffers() {
    if (state.role !== "J1" || state.own.offers) return;
    const history = [...(state.own.recent || []), ...(state.other?.recent || [])].filter(item => typeof item?.title === "string" && Number.isFinite(item.at) && Date.now() - item.at < 7 * 86400000).sort((a, b) => a.at - b.at);
    state.own.offers = Object.fromEntries(catalog.map(category => {
      const visible = state.own.decks[category.id]?.remaining?.length ? deckFor(category) : sampleDeck(category, history);
      const unseen = category.cards.map((_, index) => index).filter(index => !visible.includes(index));
      const recentTitles = new Set(history.map(item => item.title));
      const fresh = unseen.filter(index => !recentTitles.has(category.cards[index].title));
      const previousMystery = state.own.decks[category.id]?.mystery ?? state.other?.decks?.[category.id]?.mystery;
      const mystery = validPick(category, previousMystery) ? previousMystery : sample(fresh.length ? fresh : unseen, 1, random(seedFor(`${state.room}:${category.id}:mystery:v1`)))[0];
      return [category.id, [...visible, mystery]];
    }));
    mysteryCache.clear();
    save();
  }

  function mysteryFor(category) {
    const shared = state.role === "J1" ? state.own?.offers : state.other?.offers;
    if (Array.isArray(shared?.[category.id])) return shared[category.id][3];
    const key = `${state.room}:${category.id}`;
    if (mysteryCache.has(key)) return mysteryCache.get(key);
    const visible = new Set(deckFor(category));
    const candidates = category.cards.map((_, index) => index).filter(index => !visible.has(index));
    const mystery = sample(candidates, 1, random(seedFor(`${key}:mystery:v1`)))[0];
    mysteryCache.set(key, mystery);
    return mystery;
  }

  function isMystery(category, index) { return index === mysteryFor(category); }
  function titleFor(category, index, reveal = false) {
    return !reveal && isMystery(category, index) ? "Mystère" : category.cards[index].title;
  }

  function freshProgress() {
    return { version: 2, position: 0, decks: {}, picks: {}, votes: {}, skips: {}, decisions: {}, recent: recentHistory(), finished: false };
  }

  function progressFrom(raw) {
    if (raw?.version !== 2 || !raw.picks || !raw.decks) return freshProgress();
    return { ...freshProgress(), ...raw, position: Math.min(categoryIds.length, Math.max(0, Number(raw.position) || 0)) };
  }

  function save() {
    if (state.own) live.push(state.own);
  }

  function currentCategory() { return byId[categoryIds[state.own.position]]; }

  function currentDeck() {
    const category = currentCategory();
    if (!state.own.decks[category.id]) {
      const mystery = mysteryFor(category);
      state.own.decks[category.id] = { remaining: [...deckFor(category), mystery], removed: [], mystery };
      save();
    } else if (!Number.isInteger(state.own.decks[category.id].mystery)) {
      const deck = state.own.decks[category.id];
      deck.mystery = mysteryFor(category);
      if (!deck.remaining.includes(deck.mystery) && !deck.removed.includes(deck.mystery)) deck.remaining.push(deck.mystery);
      save();
    }
    return state.own.decks[category.id];
  }

  function updateTrack() {
    $("categoryTrack").replaceChildren(...catalog.map((category, index) => {
      const segment = document.createElement("span");
      segment.className = `track-segment ${index < state.own.position ? "done" : index === state.own.position ? "active" : ""}`;
      segment.style.setProperty("--track-color", category.color);
      segment.setAttribute("aria-label", `${category.name}, ${index < state.own.position ? "terminée" : index === state.own.position ? "en cours" : "à venir"}`);
      return segment;
    }));
  }

  function renderDeck() {
    if (!state.own || state.own.position >= catalog.length) return;
    const category = currentCategory();
    const deck = currentDeck();
    $("categoryTitle").textContent = category.name;
    $("stepLabel").textContent = `Catégorie ${state.own.position + 1} sur ${catalog.length}`;
    $("playerPill").textContent = `${ownLabel()} choisit`;
    $("undoButton").disabled = !deck.removed.length;
    const holder = $("deck");
    holder.replaceChildren();
    [...deck.remaining].reverse().forEach((index, reverseIndex) => {
      const depth = deck.remaining.length - reverseIndex - 1;
      const item = category.cards[index];
      const hiddenMystery = index === deck.mystery;
      const card = document.createElement("article");
      card.className = `tile-card${hiddenMystery ? " mystery-card" : ""}`;
      card.setAttribute("aria-hidden", String(depth !== 0));
      card.inert = depth !== 0;
      card.dataset.depth = String(depth);
      card.style.setProperty("--card-art", hiddenMystery ? "linear-gradient(145deg, #70506f, #33243f)" : item.art || category.art);
      if (!hiddenMystery && item.visual) {
        const poster = document.createElement("div");
        poster.className = "tile-poster";
        poster.style.backgroundImage = `url("${item.visual}")`;
        poster.setAttribute("aria-hidden", "true");
        card.append(poster);
      }
      const icon = document.createElement("span");
      icon.className = "tile-icon";
      icon.textContent = hiddenMystery ? "?" : category.icon;
      icon.setAttribute("aria-hidden", "true");
      const content = document.createElement("div");
      content.className = "tile-content";
      const subtype = document.createElement("div");
      subtype.className = "tile-category";
      subtype.textContent = hiddenMystery ? "CARTE MYSTÈRE" : item.subtype || category.name;
      const title = document.createElement("h3");
      title.textContent = hiddenMystery ? "Mystère" : item.title;
      title.classList.toggle("long-title", !hiddenMystery && item.title.length > 32);
      const description = document.createElement("p");
      description.textContent = hiddenMystery ? "Tu sauras à la fin. Oui, c’est le principe." : item.description;
      const number = document.createElement("span");
      number.className = "tile-number";
      number.textContent = hiddenMystery ? "? / ONDE" : `${String(deckFor(category).indexOf(index) + 1).padStart(2, "0")} / ONDE`;
      card.dataset.intensity = ["Simple", "Fun", "Hardcore"].includes(item.subtype) && !hiddenMystery ? item.subtype.toLowerCase() : "";
      card.style.setProperty("--category-color", hiddenMystery ? "#74465e" : category.color);
      content.append(subtype, title, description);
      const signal = document.createElement("span");
      signal.className = "swipe-signal";
      signal.setAttribute("aria-hidden", "true");
      card.append(icon, number, content, signal);
      if (depth === 0) bindGesture(card);
      holder.append(card);
    });
    updateTrack();
  }

  function animate(action, mutate) {
    if (state.busy) return;
    state.busy = true;
    const top = $("deck").querySelector('[data-depth="0"]');
    if (top) {
      top.dataset.swipe = action === "keeping" ? "right" : action === "removing" ? "left" : "up";
      top.style.setProperty("--swipe-progress", "1");
      top.classList.add(action);
    }
    setTimeout(() => {
      mutate();
      state.busy = false;
      if (state.screen === "game") renderDeck();
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 230);
  }

  function eliminate() {
    if (!state.ready) return toast("L’autre a décroché. Deux secondes.");
    const deck = currentDeck();
    if (deck.remaining.length <= 1) return toast("Il faut garder une tuile");
    animate("removing", () => {
      deck.removed.push(deck.remaining.shift());
      save();
    });
  }

  function cycle() {
    if (!state.ready) return toast("L’autre a décroché. Deux secondes.");
    const deck = currentDeck();
    if (deck.remaining.length <= 1) return toast("C’est la dernière tuile");
    animate("cycling", () => {
      deck.remaining.push(deck.remaining.shift());
      save();
    });
  }

  function choose() {
    if (!state.ready) return toast("L’autre a décroché. Deux secondes.");
    const deck = currentDeck();
    if (!deck.remaining.length) return;
    animate("keeping", () => {
      const category = currentCategory();
      state.own.picks[category.id] = deck.remaining[0];
      save();
      $("keptCategory").textContent = `${category.name} · ${ownLabel()}`;
      $("keptTitle").textContent = "C’est dans la boîte.";
      $("keptMessage").textContent = state.own.position === catalog.length - 1
        ? "Ton casting est bouclé. Place au duo."
        : `Plus que ${catalog.length - state.own.position - 1}. T’as du goût, assume.`;
      $("nextCategoryButton").textContent = state.own.position === catalog.length - 1 ? "Place au verdict" : "La suite →";
      show("kept");
    });
  }

  function bindGesture(card) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Glisser à gauche pour éliminer, en haut pour voir la suivante, à droite pour valider");
    let drag = null;
    let frame = null;
    const reset = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      drag = null;
      card.classList.remove("dragging");
      card.style.transform = "";
      card.style.setProperty("--swipe-progress", "0");
      delete card.dataset.swipe;
    };
    card.addEventListener("pointerdown", event => {
      if (state.busy || event.button !== 0 || event.isPrimary === false) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
      card.setPointerCapture(event.pointerId);
      card.classList.add("dragging");
    });
    card.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.dx = event.clientX - drag.x;
      drag.dy = event.clientY - drag.y;
      if (frame === null) frame = requestAnimationFrame(() => {
        frame = null;
        if (!drag) return;
        const { dx, dy } = drag;
        card.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${Math.max(-12, Math.min(12, dx / 17))}deg)`;
        const up = dy < -15 && Math.abs(dy) > Math.abs(dx);
        card.dataset.swipe = up ? "up" : dx < 0 ? "left" : "right";
        card.style.setProperty("--swipe-progress", String(Math.min(1, (up ? -dy : Math.abs(dx)) / 85)));
      });
    });
    card.addEventListener("pointerup", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const { dx, dy } = drag;
      reset();
      if (dy < -60 && Math.abs(dy) > Math.abs(dx)) cycle();
      else if (dx < -65) eliminate();
      else if (dx > 65) choose();
    });
    card.addEventListener("pointercancel", reset);
    card.addEventListener("keydown", event => {
      if (["ArrowLeft", "ArrowUp", "ArrowRight", "Enter"].includes(event.key)) event.preventDefault();
      if (event.key === "ArrowLeft") eliminate();
      if (event.key === "ArrowUp") cycle();
      if (event.key === "ArrowRight" || event.key === "Enter") choose();
    });
  }

  function toast(message) {
    const element = $("toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => element.classList.remove("show"), 2200);
  }

  function moveNext() {
    if (state.screen !== "kept" || !state.own || state.own.position >= catalog.length || !validPick(currentCategory(), state.own.picks[currentCategory().id])) return;
    if (!state.ready) return toast("On attend la reconnexion de l’autre.");
    state.own.position += 1;
    if (state.own.position >= catalog.length) {
      state.own.finished = true;
      show("waiting");
      maybeResolve();
    } else {
      show("game");
      renderDeck();
    }
    save();
  }

  function maybeResolve() {
    if (!state.own?.finished) return;
    if (!state.other?.finished || !catalog.every(category => validPick(category, state.other.picks?.[category.id]))) {
      $("waitingStatus").textContent = "T’es prêt. L’autre peaufine son casting.";
      if (state.screen !== "waiting") show("waiting");
      return;
    }
    if (state.screen !== "plan") {
      if (state.screen !== "summary") show("summary");
      renderSummary();
    }
  }

  function picksFor(category) {
    const a = state.role === "J1" ? state.own : state.other;
    const c = state.role === "J2" ? state.own : state.other;
    return [a?.picks?.[category.id], c?.picks?.[category.id]];
  }

  function resultFor(category, revealMystery = false) {
    const [a, c] = picksFor(category);
    if (!validPick(category, a) || !validPick(category, c)) return null;
    if (a === c) return { title: titleFor(category, a, revealMystery), kind: "accord", mystery: isMystery(category, a) };
    const ownDecision = state.own.decisions[category.id];
    const otherDecision = state.other.decisions?.[category.id];
    if (ownDecision === "pass" || otherDecision === "pass") return { title: "Pas aujourd’hui", kind: "reporté" };
    if (!validDecision(ownDecision) || ownDecision !== otherDecision) return null;
    const chosen = ownDecision === "A" ? a : c;
    return { title: titleFor(category, chosen, revealMystery), kind: "choisi", mystery: isMystery(category, chosen) };
  }

  function refreshSummary() {
    for (const duel of $("decisionList").children) {
      const category = byId[duel.dataset.category];
      const ownDecision = state.own.decisions[category.id];
      const otherDecision = state.other.decisions?.[category.id];
      const result = resultFor(category);
      const conflict = validDecision(ownDecision) && validDecision(otherDecision) && ownDecision !== otherDecision && !result;
      duel.classList.toggle("resolved", Boolean(result));
      duel.classList.toggle("discarded", result?.kind === "reporté");
      duel.querySelectorAll("[data-decision]").forEach(button => {
        const selected = button.dataset.decision === ownDecision;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
        button.disabled = !state.ready;
      });
      const nudge = duel.querySelector(".duel-nudge");
      nudge.hidden = !conflict;
      nudge.textContent = category.id === "sexualite"
        ? "Pas le même oui ? Discutez. Un non suffit pour passer."
        : "Parfois, on lâche le morceau. Tu lui laisses la main ?";
      duel.querySelector(".concede-actions").hidden = !conflict;
      const message = result ? result.kind === "reporté" ? "On zappe. Zéro justification."
        : result.mystery ? "Mystère retenu. Suspense jusqu’au bout."
        : "Ça matche. C’est plié."
        : conflict ? "Choisissez la même carte pour trancher."
        : validDecision(ownDecision) ? "Ton vote est posé. À l’autre."
        : "Une carte. Un vote. À toi.";
      const status = duel.querySelector(".duel-status");
      if (status.textContent !== message) status.textContent = message;
    }
    const count = catalog.filter(category => resultFor(category)).length;
    $("showPlanButton").disabled = count !== catalog.length || !state.ready;
    $("summaryStatus").textContent = count === catalog.length
      ? "Bouclé. Sortez le programme."
      : `${count} / ${catalog.length} · Ça se précise.`;
  }

  function renderSummary() {
    const signature = JSON.stringify([state.own?.picks, state.other?.picks]);
    if (state.summarySignature !== signature) {
      state.summarySignature = signature;
      $("matchGrid").replaceChildren();
      $("decisionList").replaceChildren();
      let differences = 0;
      for (const category of catalog) {
        const [a, c] = picksFor(category);
        if (!validPick(category, a) || !validPick(category, c)) continue;
        if (a === c) {
          const item = document.createElement("article");
          item.className = `result-card match-card${isMystery(category, a) ? " mystery-result" : ""}`;
          item.style.setProperty("--item-bg", category.art);
          item.innerHTML = `<small>${escape(category.name)}</small><strong>${escape(titleFor(category, a))}</strong>`;
          $("matchGrid").append(item);
          continue;
        }
        differences++;
        const duel = document.createElement("article");
        duel.className = "decision-card";
        duel.dataset.category = category.id;
        duel.innerHTML = `<div class="decision-category"><span>${escape(category.icon)}</span><strong>${escape(category.name)}</strong></div>
          <div class="duel-options">
            <button type="button" data-decision="A" class="result-card duel-option${isMystery(category, a) ? " mystery-result" : ""}" style="--item-bg:${category.art}"><small>Le choix de A</small><strong>${escape(titleFor(category, a))}</strong><span class="duel-cta">Je vote A <span aria-hidden="true">↗</span></span></button>
            <button type="button" data-decision="C" class="result-card duel-option${isMystery(category, c) ? " mystery-result" : ""}" style="--item-bg:${category.art}"><small>Le choix de C</small><strong>${escape(titleFor(category, c))}</strong><span class="duel-cta">Je vote C <span aria-hidden="true">↗</span></span></button>
          </div>
          <p class="duel-nudge" hidden></p>
          <div class="concede-actions" hidden><button type="button" class="follow-choice">Je te suis ♥</button><button type="button" class="keep-choice">Je garde mon choix</button></div>
          <button type="button" class="pass-choice" data-decision="pass">Pas aujourd’hui · On zappe</button>
          <p class="duel-status" role="status"></p>`;
        const vote = value => {
          if (!state.ready) return toast("On attend la reconnexion de l’autre.");
          state.own.decisions[category.id] = value;
          save();
          refreshSummary();
        };
        duel.querySelectorAll("[data-decision]").forEach(button => button.addEventListener("click", () => vote(button.dataset.decision)));
        duel.querySelector(".follow-choice").addEventListener("click", () => vote(ownLabel() === "A" ? "C" : "A"));
        duel.querySelector(".keep-choice").addEventListener("click", () => vote(ownLabel()));
        $("decisionList").append(duel);
      }
      $("matchSection").hidden = !$("matchGrid").children.length;
      $("decisionSection").hidden = !differences;
    }
    refreshSummary();
  }

  function drawText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 3) {
    const words = String(text).split(/\s+/);
    let line = "", lines = [];
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
    const truncated = lines.length > maxLines;
    lines = lines.slice(0, maxLines);
    if (truncated) lines[maxLines - 1] = `${lines[maxLines - 1].replace(/[\s.…]+$/, "")}…`;
    lines.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight, maxWidth));
    return lines.length;
  }

  function rounded(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + width, y, x + width, y + height, r);
    ctx.arcTo(x + width, y + height, x, y + height, r);
    ctx.arcTo(x, y + height, x, y, r);
    ctx.arcTo(x, y, x + width, y, r);
    ctx.closePath();
  }

  function drawPlan() {
    const oldLink = $("planDownloadLink");
    if (oldLink) { URL.revokeObjectURL(oldLink.href); oldLink.remove(); }
    state.planSignature = JSON.stringify(catalog.map(category => resultFor(category, true)));
    const canvas = $("planCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f6f0e6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#74465e";
    ctx.font = "700 22px system-ui";
    ctx.fillText("TIRAGE À DEUX     /     ÉDITION DU JOUR", 82, 82);
    ctx.fillStyle = "#252222";
    ctx.font = "900 138px system-ui";
    ctx.fillText("ONDE", 72, 220);
    ctx.fillStyle = "#cc6f59";
    ctx.fillText(".", 485, 220);
    ctx.font = "600 24px system-ui";
    ctx.fillStyle = "#746e69";
    ctx.fillText(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date()).toUpperCase(), 82, 277);
    ctx.textAlign = "right";
    ctx.fillText("A + C  /  C’EST PLIÉ.", 1118, 277);
    ctx.textAlign = "left";
    ctx.strokeStyle = "#d7ccbe";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(82, 303); ctx.lineTo(1118, 303); ctx.stroke();
    const today = catalog.filter(category => {
      const kind = resultFor(category)?.kind;
      return kind && kind !== "reporté" && kind !== "écart";
    });
    if (!today.length) {
      ctx.font = "650 42px system-ui";
      ctx.fillText("Rien d’imposé. Juste nous.", 90, 470, 990);
      ctx.font = "500 28px system-ui";
      ctx.fillStyle = "#746e69";
      ctx.fillText("Le meilleur programme, parfois, c’est aucun.", 90, 530, 990);
    }
    today.forEach((category, index) => {
      const result = resultFor(category, true);
      const y = 336 + index * 222;
      ctx.fillStyle = "#fffcf6";
      rounded(ctx, 82, y, 1036, 204, 24);
      ctx.fill();
      ctx.strokeStyle = "#ded4c7";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      const gradient = ctx.createLinearGradient(102, y + 20, 264, y + 184);
      gradient.addColorStop(0, category.color);
      gradient.addColorStop(1, category.id === "sexualite" ? "#8f3745" : "#514c49");
      ctx.fillStyle = gradient;
      rounded(ctx, 102, y + 20, 142, 164, 15);
      ctx.fill();
      ctx.save();
      ctx.beginPath(); rounded(ctx, 102, y + 20, 142, 164, 15); ctx.clip();
      ctx.strokeStyle = "#ffffff25";
      ctx.lineWidth = 17;
      ctx.beginPath(); ctx.arc(218, y + 80, 70, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#fff8ec";
      ctx.font = "750 44px system-ui";
      ctx.fillText(String(index + 1).padStart(2, "0"), 121, y + 145);
      ctx.fillStyle = category.color;
      ctx.font = "750 20px system-ui";
      ctx.fillText(result?.mystery ? `${category.name.toUpperCase()} · SURPRISE !` : category.name.toUpperCase(), 276, y + 42);
      ctx.fillStyle = "#252222";
      const longTitle = result.title.length > 65;
      ctx.font = `750 ${longTitle ? 30 : 39}px system-ui`;
      drawText(ctx, result?.title || "À décider", 276, y + 88, 810, longTitle ? 34 : 42, 3);
      ctx.fillStyle = "#746e69";
      ctx.font = "600 18px system-ui";
      ctx.fillText(result?.kind === "accord" ? "MÊME ENVIE. ÉVIDEMMENT." : "ON EST DEUX À DIRE OUI.", 276, y + 184);
    });
    ctx.fillStyle = "#746e69";
    ctx.font = "700 24px system-ui";
    ctx.fillText(`${today.length} ENVIE${today.length > 1 ? "S" : ""}. ZÉRO OBLIGATION.`, 82, 1510);
    ctx.textAlign = "right";
    ctx.font = "500 22px system-ui";
    ctx.fillText("Maintenant, profitez. Bordel.", 1118, 1510);
    ctx.textAlign = "left";
    const noise = document.createElement("canvas");
    noise.width = noise.height = 180;
    const noiseCtx = noise.getContext("2d");
    const pixels = noiseCtx.createImageData(180, 180);
    const rng = random(197904);
    for (let p = 0; p < pixels.data.length; p += 4) {
      const shade = rng() > .5 ? 255 : 35;
      pixels.data[p] = pixels.data[p + 1] = pixels.data[p + 2] = shade;
      pixels.data[p + 3] = Math.floor(rng() * 30);
    }
    noiseCtx.putImageData(pixels, 0, 0);
    ctx.fillStyle = ctx.createPattern(noise, "repeat");
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function rememberSession() {
    const records = recentHistory();
    const titles = catalog.flatMap(category => [...deckFor(category), mysteryFor(category)].map(index => category.cards[index]?.title).filter(Boolean));
    const remaining = records.filter(item => !titles.includes(item.title));
    try { localStorage.setItem(historyKey, JSON.stringify([...remaining, ...titles.map(title => ({ title, at: Date.now() }))].slice(-160))); } catch {}
  }

  async function savePlan() {
    const canvas = $("planCanvas");
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return toast("Impossible de créer l’image");
    const file = new File([blob], `ONDE-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const oldLink = $("planDownloadLink");
    if (oldLink) { URL.revokeObjectURL(oldLink.href); oldLink.remove(); }
    link.id = "planDownloadLink";
    link.className = "download-link";
    link.href = url;
    link.download = file.name;
    link.textContent = "Image prête · Télécharger ↓";
    $("savePlanButton").after(link);
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "ONDE · notre feuille du jour" }); return; }
      catch (error) { if (error.name === "AbortError") return; }
    }
    link.click();
  }

  document.querySelectorAll(".player-choice-button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".player-choice-button").forEach(item => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    $("welcomeStatus").textContent = `${button.dataset.player === "J1" ? "A" : "C"}. C’est toi. On y va.`;
  }));
  $("undoButton").addEventListener("click", () => {
    if (!state.ready) return toast("On attend la reconnexion de l’autre.");
    const deck = currentDeck();
    if (!deck.removed.length || state.busy) return;
    deck.remaining.unshift(deck.removed.pop());
    save();
    renderDeck();
  });
  const nextButton = $("nextCategoryButton");
  let nextPress = null;
  nextButton.addEventListener("pointerdown", event => {
    if (event.isPrimary !== false) nextPress = { id: event.pointerId, x: event.clientX, y: event.clientY };
  });
  nextButton.addEventListener("pointerup", event => {
    const press = nextPress;
    nextPress = null;
    if (!["touch", "pen"].includes(event.pointerType) || !press || press.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 12) return;
    event.preventDefault();
    moveNext();
  });
  nextButton.addEventListener("pointercancel", () => { nextPress = null; });
  nextButton.addEventListener("click", moveNext);
  $("showPlanButton").addEventListener("click", () => { if (state.ready) { drawPlan(); show("plan"); } });
  $("savePlanButton").addEventListener("click", savePlan);
  $("backToSummaryButton").addEventListener("click", () => { show("summary"); renderSummary(); });
  const restart = () => {
    sessionStorage.removeItem("onde-room");
    sessionStorage.removeItem("onde-role");
    location.href = location.pathname + "?v=" + (document.querySelector('meta[name="onde-version"]')?.content || "42");
  };
  $("restartButton").addEventListener("click", restart);
  $("renewSessionButton").addEventListener("click", restart);

  live.onChange((rows, info) => {
    state.room = info.roomCode;
    state.role = info.role;
    state.ready = info.ready;
    nextButton.disabled = !state.ready;
    $("sessionExpiredBanner").hidden = !info.expired;
    const ownRow = rows[info.role];
    const otherRow = rows[info.role === "J1" ? "J2" : "J1"];
    if (!state.own && ownRow) {
      state.own = progressFrom(ownRow.state);
      if (ownRow.state?.version !== 2) save();
    }
    state.other = otherRow?.state?.version === 2 ? progressFrom(otherRow.state) : null;
    const otherName = ownLabel() === "A" ? "C" : "A";
    $("partnerActivity").textContent = !info.ready ? "L’autre arrive…" : state.other?.finished ? `${otherName} a fini son casting` : `${otherName} choisit à son rythme`;
    if (!info.ready) {
      if (state.screen === "intro") $("welcomeStatus").textContent = "T’es là. Fais venir ta moitié.";
      if (state.screen === "summary") refreshSummary();
      return;
    }
    if (!state.other) return;
    prepareOffers();
    const sharedOffers = state.role === "J1" ? state.own.offers : state.other.offers;
    if (!sharedOffers) { $("welcomeStatus").textContent = "On mélange les envies…"; return; }
    if (!state.recorded) { rememberSession(); state.recorded = true; }
    if (state.screen === "intro") {
      if (!state.own) state.own = freshProgress();
      if (state.own.finished) maybeResolve();
      else if (state.own.picks[categoryIds[state.own.position]] !== undefined) {
        show("kept");
        const category = currentCategory();
        $("keptCategory").textContent = category.name;
        $("keptTitle").textContent = "C’est dans la boîte.";
        $("keptMessage").textContent = "On continue ?";
        $("nextCategoryButton").textContent = state.own.position === catalog.length - 1 ? "Place au verdict" : "La suite →";
      } else { show("game"); renderDeck(); }
    } else if (state.own?.finished) maybeResolve();
    if (state.screen === "summary") renderSummary();
    if (state.screen === "plan" && state.planSignature !== JSON.stringify(catalog.map(category => resultFor(category, true)))) drawPlan();
  });

  const savedRole = sessionStorage.getItem("onde-role");
  const savedRoom = sessionStorage.getItem("onde-room");
  const invitedRoom = new URLSearchParams(location.search).get("room")?.trim().toUpperCase();
  const inviteIsDifferent = invitedRoom && invitedRoom !== savedRoom;
  if (invitedRoom && /^[A-Z0-9]{4,8}$/.test(invitedRoom)) $("roomCodeInput").value = invitedRoom;
  if (savedRole && savedRoom && !inviteIsDifferent) {
    document.querySelector(`.player-choice-button[data-player="${savedRole}"]`)?.click();
    $("roomCodeInput").value = savedRoom;
  }
  show("intro");
  if (savedRole && savedRoom && !inviteIsDifferent) live.connect(savedRoom, savedRole, false);
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
})();
