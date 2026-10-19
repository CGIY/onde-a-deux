(() => {
  const live = window.ondeLive;
  const catalog = window.ONDE_CATEGORIES;
  const byId = Object.fromEntries(catalog.map(category => [category.id, category]));
  const screens = Object.fromEntries(["intro", "game", "kept", "waiting", "summary", "plan"].map(name => [name, document.getElementById(`${name}Screen`)]));
  const $ = id => document.getElementById(id);
  const state = { own: null, other: null, role: "", room: "", screen: "intro", busy: false, summarySignature: "" };
  const categoryIds = catalog.map(category => category.id);
  const mysteryCache = new Map();
  const otherRole = () => state.role === "J1" ? "J2" : "J1";
  const ownLabel = () => state.role === "J1" ? "A" : "C";
  const validPick = (category, index) => Number.isInteger(index) && index >= 0 && index < category.cards.length;
  const validVote = value => Number.isInteger(value) && value >= 0 && value <= 100;
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
    const rng = random(seedFor(`${state.room}:${category.id}:v2`));
    if (category.id === "jeu") {
      const board = category.cards.flatMap((card, index) => card.subtype === "Jeu de société" ? [index] : []);
      const video = category.cards.flatMap((card, index) => card.subtype === "Jeu vidéo" ? [index] : []);
      return sample([...sample(board, 2, rng), ...sample(video, 1, rng)], 3, rng);
    }
    return sample(category.cards.map((_, index) => index), 3, rng);
  }

  function mysteryFor(category) {
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
    return { version: 2, position: 0, decks: {}, picks: {}, votes: {}, skips: {}, finished: false };
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
      description.textContent = hiddenMystery ? "Son contenu sera révélé sur l’image finale." : item.description;
      content.append(subtype, title, description);
      card.append(icon, content);
      if (depth === 0) bindGesture(card);
      holder.append(card);
    });
    updateTrack();
  }

  function animate(action, mutate) {
    if (state.busy) return;
    state.busy = true;
    $("deck").querySelector('[data-depth="0"]')?.classList.add(action);
    setTimeout(() => {
      mutate();
      state.busy = false;
      if (state.screen === "game") renderDeck();
    }, matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 190);
  }

  function eliminate() {
    const deck = currentDeck();
    if (deck.remaining.length <= 1) return toast("Il faut garder une tuile");
    animate("removing", () => {
      deck.removed.push(deck.remaining.shift());
      save();
    });
  }

  function cycle() {
    const deck = currentDeck();
    if (deck.remaining.length <= 1) return toast("C’est la dernière tuile");
    animate("cycling", () => {
      deck.remaining.push(deck.remaining.shift());
      save();
    });
  }

  function choose() {
    const deck = currentDeck();
    if (!deck.remaining.length) return;
    animate("keeping", () => {
      const category = currentCategory();
      state.own.picks[category.id] = deck.remaining[0];
      save();
      $("keptCategory").textContent = `${category.name} · ${ownLabel()}`;
      $("keptTitle").textContent = "Choix enregistré";
      $("keptMessage").textContent = state.own.position === catalog.length - 1
        ? "Tu as terminé tes catégories. On attend maintenant l’autre téléphone."
        : `Encore ${catalog.length - state.own.position - 1} catégorie${catalog.length - state.own.position - 1 > 1 ? "s" : ""} à découvrir.`;
      $("nextCategoryButton").textContent = state.own.position === catalog.length - 1 ? "Terminer mes choix" : "Catégorie suivante";
      show("kept");
    });
  }

  function bindGesture(card) {
    card.tabIndex = 0;
    card.setAttribute("role", "button");
    card.setAttribute("aria-label", "Glisser à gauche pour éliminer, en haut pour voir la suivante, à droite pour valider");
    let drag = null;
    card.addEventListener("pointerdown", event => {
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, dx: 0, dy: 0 };
      card.setPointerCapture(event.pointerId);
      card.classList.add("dragging");
    });
    card.addEventListener("pointermove", event => {
      if (!drag || drag.id !== event.pointerId) return;
      drag.dx = event.clientX - drag.x;
      drag.dy = event.clientY - drag.y;
      card.style.transform = `translate3d(${drag.dx}px, ${drag.dy}px, 0) rotate(${Math.max(-9, Math.min(9, drag.dx / 20))}deg)`;
    });
    card.addEventListener("pointerup", event => {
      if (!drag || drag.id !== event.pointerId) return;
      const { dx, dy } = drag;
      drag = null;
      card.classList.remove("dragging");
      card.style.transform = "";
      if (dy < -60 && Math.abs(dy) > Math.abs(dx)) cycle();
      else if (dx < -65) eliminate();
      else if (dx > 65) choose();
    });
    card.addEventListener("pointercancel", () => { drag = null; card.classList.remove("dragging"); card.style.transform = ""; });
    card.addEventListener("keydown", event => {
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
    state.own.position += 1;
    if (state.own.position >= catalog.length) {
      state.own.finished = true;
      save();
      show("waiting");
      maybeResolve();
    } else {
      save();
      show("game");
      renderDeck();
    }
  }

  function maybeResolve() {
    if (!state.own?.finished) return;
    if (!state.other?.finished || !catalog.every(category => validPick(category, state.other.picks?.[category.id]))) {
      $("waitingStatus").textContent = `Tes ${catalog.length} choix sont prêts. L’autre avance à son rythme.`;
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
    if (state.own.skips[category.id] && state.other.skips?.[category.id]) return { title: "Pas aujourd’hui", kind: "reporté" };
    const ownVote = state.own.votes[category.id];
    const otherVote = state.other.votes?.[category.id];
    if (!validVote(ownVote) || !validVote(otherVote)) return null;
    const voteA = state.role === "J1" ? ownVote : otherVote;
    const voteC = state.role === "J2" ? ownVote : otherVote;
    if (Math.max(voteA, voteC) * 10 <= (voteA + voteC) * 7) return { title: "Écart insuffisant", kind: "écart" };
    const chosen = voteA > voteC ? a : c;
    return { title: titleFor(category, chosen, revealMystery), kind: "choisi", mystery: isMystery(category, chosen) };
  }

  function refreshSummary() {
    for (const duel of $("decisionList").children) {
      const category = byId[duel.dataset.category];
      const ownVote = state.own.votes[category.id];
      const otherVote = state.other.votes?.[category.id];
      const bothVoted = validVote(ownVote) && validVote(otherVote);
      const ownSkipped = Boolean(state.own.skips[category.id]);
      const otherSkipped = Boolean(state.other.skips?.[category.id]);
      const result = resultFor(category);
      const skipButton = duel.querySelector(".skip-own");
      skipButton.classList.toggle("pressed", ownSkipped);
      skipButton.setAttribute("aria-pressed", String(ownSkipped));
      skipButton.textContent = `${ownSkipped ? "✓ " : ""}Pas aujourd’hui · ${ownLabel()}`;
      duel.querySelector(".skip-note").textContent = otherSkipped
        ? "L’autre a aussi choisi « pas aujourd’hui »."
        : "Mis de côté si vous le choisissez tous les deux.";
      duel.querySelector(".vote-confirm").textContent = validVote(ownVote) ? "Modifier ma jauge" : "Valider ma jauge";
      if (bothVoted) {
        const voteA = state.role === "J1" ? ownVote : otherVote;
        const voteC = state.role === "J2" ? ownVote : otherVote;
        const share = voteA + voteC ? Math.round(voteA / (voteA + voteC) * 100) : 50;
        duel.querySelector(".gauge-j1").style.width = `${share}%`;
        duel.querySelector(".gauge-marker").style.left = `${share}%`;
        duel.querySelector(".gauge-score").textContent = `${voteA} / ${voteC}`;
      } else {
        duel.querySelector(".gauge-score").textContent = "En attente des deux jauges";
      }
      duel.querySelector(".gauge-result").textContent = result
        ? result.kind === "reporté" ? "Mis de côté aujourd’hui"
          : result.kind === "écart" ? "Écart de 70 % ou moins · absent de l’image finale"
          : result.mystery ? "Mystère retenu · révélation sur l’image finale"
          : `${result.title} est retenu`
        : validVote(ownVote) ? "En attente de la jauge de l’autre"
          : "Chacun valide sa propre jauge";
    }
    const count = catalog.filter(category => resultFor(category)).length;
    $("showPlanButton").disabled = count !== catalog.length;
    $("summaryStatus").textContent = count === catalog.length
      ? "Tout est décidé. Votre feuille du jour est prête."
      : `${count} décision${count > 1 ? "s" : ""} sur ${catalog.length} finalisée${count > 1 ? "s" : ""}.`;
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
        const ownVote = state.own.votes[category.id];
        const duel = document.createElement("article");
        duel.className = "decision-card";
        duel.dataset.category = category.id;
        duel.innerHTML = `<div class="decision-category"><span>${escape(category.icon)}</span><strong>${escape(category.name)}</strong></div>
          <div class="duel-options">
            <div class="result-card duel-option${isMystery(category, a) ? " mystery-result" : ""}" style="--item-bg:${category.art}"><small>Choix de A</small><strong>${escape(titleFor(category, a))}</strong></div>
            <div class="result-card duel-option${isMystery(category, c) ? " mystery-result" : ""}" style="--item-bg:${category.art}"><small>Choix de C</small><strong>${escape(titleFor(category, c))}</strong></div>
          </div>
          <div class="own-vote"><label for="vote-${category.id}">Ta jauge · ${ownLabel()} <output>${validVote(ownVote) ? ownVote : 50}</output></label>
            <input id="vote-${category.id}" type="range" min="0" max="100" value="${validVote(ownVote) ? ownVote : 50}">
            <button type="button" class="vote-confirm">Valider ma jauge</button>
          </div>
          <div class="combined-gauge"><div class="gauge-track"><span class="gauge-j1"></span><i class="gauge-marker"></i></div>
            <div class="gauge-labels"><span>A</span><strong class="gauge-score">En attente des deux jauges</strong><span>C</span></div>
            <p class="gauge-result">Chacun valide sa propre jauge</p></div>
          <button type="button" class="skip-own">Pas aujourd’hui · ${ownLabel()}</button>
          <p class="skip-note">Mis de côté si vous le choisissez tous les deux.</p>`;
        const slider = duel.querySelector("input");
        const output = duel.querySelector("output");
        slider.addEventListener("input", () => { output.value = slider.value; });
        duel.querySelector(".vote-confirm").addEventListener("click", () => {
          state.own.votes[category.id] = Number(slider.value);
          save();
          refreshSummary();
        });
        duel.querySelector(".skip-own").addEventListener("click", () => {
          state.own.skips[category.id] = !state.own.skips[category.id];
          save();
          refreshSummary();
        });
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
    const canvas = $("planCanvas");
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#f7f0e8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#74465e";
    ctx.font = "700 30px system-ui";
    ctx.fillText("ON DÉCIDE · À DEUX", 90, 100);
    ctx.fillStyle = "#252222";
    ctx.font = "800 100px system-ui";
    ctx.fillText("ONDE.", 82, 215);
    ctx.font = "500 30px system-ui";
    ctx.fillStyle = "#746e69";
    ctx.fillText(new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date()), 90, 270);
    const today = catalog.filter(category => {
      const kind = resultFor(category)?.kind;
      return kind && kind !== "reporté" && kind !== "écart";
    });
    if (!today.length) {
      ctx.font = "650 42px system-ui";
      ctx.fillText("Rien à prévoir aujourd’hui.", 90, 420, 990);
    }
    today.forEach((category, index) => {
      const result = resultFor(category, true);
      const y = 330 + index * 228;
      ctx.fillStyle = "#ffffff";
      rounded(ctx, 82, y, 1036, 200, 30);
      ctx.fill();
      ctx.fillStyle = category.color;
      rounded(ctx, 82, y, 12, 200, 6);
      ctx.fill();
      ctx.fillStyle = "#74465e";
      ctx.font = "700 25px system-ui";
      ctx.fillText(result?.mystery ? `${category.name.toUpperCase()} · MYSTÈRE RÉVÉLÉ` : category.name.toUpperCase(), 122, y + 50);
      ctx.fillStyle = "#252222";
      ctx.font = "700 42px system-ui";
      drawText(ctx, result?.title || "À décider", 122, y + 112, 930, 48, 2);
      ctx.fillStyle = "#746e69";
      ctx.font = "500 22px system-ui";
      ctx.fillText(result?.kind === "reporté" ? "D’un commun accord" : result?.kind === "accord" ? "Choisi ensemble" : "Décidé à deux", 122, y + 171);
    });
    ctx.fillStyle = "#746e69";
    ctx.font = "500 26px system-ui";
    ctx.fillText(`${today.length} idée${today.length > 1 ? "s" : ""} à vivre · une chose à la fois, ensemble.`, 90, 1550);
  }

  async function savePlan() {
    const canvas = $("planCanvas");
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return toast("Impossible de créer l’image");
    const file = new File([blob], `ONDE-${new Date().toISOString().slice(0, 10)}.png`, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "ONDE · notre feuille du jour" }); return; }
      catch (error) { if (error.name === "AbortError") return; }
    }
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  document.querySelectorAll(".player-choice-button").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll(".player-choice-button").forEach(item => {
      item.classList.toggle("selected", item === button);
      item.setAttribute("aria-pressed", String(item === button));
    });
    $("welcomeStatus").textContent = `${button.dataset.player === "J1" ? "A" : "C"} sélectionné sur ce téléphone.`;
  }));
  $("undoButton").addEventListener("click", () => {
    const deck = currentDeck();
    if (!deck.removed.length || state.busy) return;
    deck.remaining.unshift(deck.removed.pop());
    save();
    renderDeck();
  });
  $("nextCategoryButton").addEventListener("click", moveNext);
  $("showPlanButton").addEventListener("click", () => { drawPlan(); show("plan"); });
  $("savePlanButton").addEventListener("click", savePlan);
  $("backToSummaryButton").addEventListener("click", () => { show("summary"); renderSummary(); });
  $("restartButton").addEventListener("click", () => {
    sessionStorage.removeItem("onde-room");
    sessionStorage.removeItem("onde-role");
    location.href = location.pathname + "?v=33";
  });

  live.onChange((rows, info) => {
    state.room = info.roomCode;
    state.role = info.role;
    const ownRow = rows[info.role];
    const otherRow = rows[info.role === "J1" ? "J2" : "J1"];
    if (!state.own && ownRow) state.own = progressFrom(ownRow.state);
    state.other = otherRow?.state?.version === 2 ? progressFrom(otherRow.state) : null;
    if (!info.ready) {
      if (state.screen === "intro") $("welcomeStatus").textContent = "Ta diode est prête. L’autre téléphone peut rejoindre.";
      return;
    }
    if (state.screen === "intro") {
      if (!state.own) state.own = freshProgress();
      if (state.own.finished) maybeResolve();
      else if (state.own.picks[categoryIds[state.own.position]] !== undefined) {
        show("kept");
        const category = currentCategory();
        $("keptCategory").textContent = category.name;
        $("keptTitle").textContent = "Choix enregistré";
        $("keptMessage").textContent = "Tu peux passer à la catégorie suivante.";
        $("nextCategoryButton").textContent = state.own.position === catalog.length - 1 ? "Terminer mes choix" : "Catégorie suivante";
      } else { show("game"); renderDeck(); }
    } else if (state.own?.finished) maybeResolve();
    if (state.screen === "summary") renderSummary();
    if (state.screen === "plan") drawPlan();
  });

  const savedRole = sessionStorage.getItem("onde-role");
  const savedRoom = sessionStorage.getItem("onde-room");
  const invitedRoom = new URLSearchParams(location.search).get("room")?.trim().toUpperCase();
  const inviteIsDifferent = invitedRoom && invitedRoom !== savedRoom;
  if (invitedRoom && /^[A-Z0-9]{6,8}$/.test(invitedRoom)) $("roomCodeInput").value = invitedRoom;
  if (savedRole && savedRoom && !inviteIsDifferent) {
    document.querySelector(`.player-choice-button[data-player="${savedRole}"]`)?.click();
    $("roomCodeInput").value = savedRoom;
  }
  show("intro");
  if (savedRole && savedRoom && !inviteIsDifferent) live.connect(savedRoom, savedRole, false);
  if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
})();
