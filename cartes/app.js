(() => {
  "use strict";

  const SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";
  const names = { AG: "Mamamouth", CL: "Papapouf" };
  const name = role => names[role] || role || "vous";
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const storage = {
    get: key => { try { return localStorage.getItem(key); } catch { return null; } },
    set: (key, value) => { try { localStorage.setItem(key, value); } catch { toast("Autorise le stockage du navigateur pour rester connecté."); } },
    remove: key => { try { localStorage.removeItem(key); } catch {} }
  };

  const state = {
    role: null,
    token: null,
    data: null,
    serverOffset: 0,
    view: "today",
    collectionTab: "available",
    selectedBooster: null,
    opening: false,
    revealedCards: [],
    revealIndex: 0,
    polling: null,
    busy: false,
    syncing: false,
    category: "all",
    viewerCards: [],
    viewerIndex: 0,
    revealMoving: false,
    revealQueue: [],
    managementMode: "trade",
    viewerMoving: false,
    viewerSession: 0,
    newTemplates: new Set()
  };
  state.collapsedEditions = new Set();
  state.stackSelection = null;
  state.finishingOpening = false;

  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];
  const loginScreen = $("#loginScreen");
  const appShell = $("#appShell");
  const pairingForm = $("#pairingForm");
  const profilePicker = $("#profilePicker");
  const loadingVeil = $("#loadingVeil");
  const boosterDialog = $("#boosterDialog");
  const cardDialog = $("#cardDialog");
  const destroyDialog = $("#destroyDialog");
  const stackDialog = $("#stackDialog");
  const selectionDialog = $("#selectionDialog");
  state.selectionSide = null;
  let destruction = null;
  let cutGesture;
  let packGesture;
  let openingTimer;
  const markupCache = new Map();
  function putMarkup(selector, html) {
    const signature = html.replace(/(data-until="[^"]*">)[^<]*/g, "$1");
    if (markupCache.get(selector) === signature) return;
    $(selector).innerHTML = html;
    markupCache.set(selector, signature);
  }
  const finishSymbol = finish => ({ standard: "●", full_art: "◇", foil: "✦", full_art_foil: "✺", legendary: "✵" })[finish] || "●";

  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);

  const tokenKey = role => `les-cartes-token:${role}`;
  const generateToken = () => [...crypto.getRandomValues(new Uint8Array(24))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");

  function setBusy(busy) {
    state.busy = busy;
    loadingVeil.hidden = !busy;
    loginScreen.inert = busy;
    appShell.inert = busy;
    cardDialog.inert = busy;
    destroyDialog.inert = busy;
  }

  function contextualBusy(button, label) {
    state.busy = true;
    const previous = button?.innerHTML;
    if (button) { button.disabled = true; button.setAttribute("aria-busy","true"); button.classList.add("action-pending"); if (label && !button.matches(".complete-quick")) button.textContent = label; }
    $("#profileMenu").disabled = true;
    return () => {
      state.busy = false; $("#profileMenu").disabled = false;
      if (button) { button.disabled = false; button.removeAttribute("aria-busy"); button.classList.remove("action-pending"); button.innerHTML = previous; }
    };
  }

  let toastTimer;
  function toast(message) {
    const element = $("#toast");
    element.textContent = message;
    element.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2800);
  }

  const errorMessages = {
    pairing_required: "Ce téléphone doit d’abord être appairé.",
    invalid_access_code: "Ce code d’appairage n’est pas le bon.",
    device_not_authorized: "Entre de nouveau ton code personnel pour connecter cet appareil.",
    booster_unavailable: "Ce booster n’est plus disponible.",
    card_unavailable: "Cette carte n’est plus disponible.",
    joker_requires_target: "Choisis une carte active de l’autre joueur à annuler.",
    joker_unavailable: "Ce Joker ou sa cible n’est plus disponible.",
    invalid_legendary_choice: "Choisis un défi de cette légendaire avant de l’activer.",
    spell_requires_target: "Choisis une cible pour ce sortilège.",
    spell_unavailable: "Ce sortilège ou sa cible n’est plus disponible.",
    effect_already_modified: "L’effet de cette carte a déjà été modifié.",
    time_already_modified: "La durée de cette carte a déjà été modifiée.",
    trade_unavailable: "Cet échange n’est plus disponible.",
    no_active_card: "Aucune carte n’est encore publiée.",
    invalid_card: "Cet exemplaire n’est plus disponible.",
    invalid_booster: "Ce booster n’est plus disponible.",
    invalid_trade: "Cette proposition n’est plus disponible.",
    invalid_request: "La demande n’a pas pu être comprise.",
    network_error: "Connexion interrompue. Vérifie ton réseau puis réessaie.",
    profile_changed: "Le profil a changé. Réessaie depuis ce profil.",
    timeout: "La connexion prend trop de temps. Réessaie.",
    invalid_trade_decision: "Choisis d’accepter ou de refuser cet échange."
  };

  function friendlyError(error) {
    const text = String(error?.message || error || "Erreur inconnue");
    const key = Object.keys(errorMessages).find(candidate => text.includes(candidate));
    return key ? errorMessages[key] : "Connexion impossible pour le moment. Réessaie dans un instant.";
  }

  const transport = window.CardTransport.create({state,url:SUPABASE_URL,key:SUPABASE_KEY});
  async function exchange(action = "sync", payload = {}, accessCode = null) {
    const role=state.role,token=state.token;
    try {return await transport(action,payload,accessCode);}
    catch(error){
      if(role!==state.role || token!==state.token || !/network_error|timeout/.test(String(error.message)) || ["sync","login","open_booster","opening_progress","finish_opening","release_device"].includes(action)) throw error;
      try {const snapshot=await transport("sync");if(window.CardTransport.matchesMutation(snapshot,action,payload,role))return snapshot;render();}catch{}
      throw error;
    }
  }

  function serverNow() {
    return new Date(Date.now() + state.serverOffset);
  }

  function duration(until, expiredLabel = "Terminé") {
    const remaining = new Date(until).getTime() - serverNow().getTime();
    if (remaining <= 0) return expiredLabel;
    const totalMinutes = Math.ceil(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days) return `${days}j ${hours}h`;
    if (hours) return `${hours}h ${String(minutes).padStart(2, "0")}`;
    return `${minutes} min`;
  }

  function cardCountdown(until, active = false) {
    if (new Date(until) <= serverNow()) return active ? "Terminé" : "Expirée";
    return `${active ? "Se termine dans" : "Expire dans"} ${duration(until)}`;
  }

  function nextBoosterDuration() {
    if (state.data?.next_booster_at) return duration(state.data.next_booster_at, "Bientôt");
    const formatter = new Intl.DateTimeFormat("fr-FR", {
      timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    });
    const values = Object.fromEntries(formatter.formatToParts(serverNow()).map(part => [part.type, part.value]));
    const elapsed = Number(values.hour) * 3600 + Number(values.minute) * 60 + Number(values.second);
    const release = 5 * 3600;
    const seconds = elapsed < release ? release - elapsed : 86400 - elapsed + release;
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${String(minutes).padStart(2, "0")}`;
  }

  function isAvailable(card) {
    return card?.status === "available" && new Date(card.expires_at) > serverNow();
  }

  function expireLocalData() {
    if (!state.data) return false;
    const now = serverNow();
    let changed = false;
    for (const [key, field] of [["my_cards","expires_at"],["partner_cards","expires_at"],["active_cards","active_until"],["boosters","expires_at"]]) {
      const previous = state.data[key] || [];
      const next = previous.filter(card => !card[field] || new Date(card[field]) > now);
      if (next.length !== previous.length) { state.data[key] = next; changed = true; }
    }
    if (changed) state.data.known_cards = state.data.known_cards.map(card=>({...card,owned_count:state.data.my_cards.filter(copy=>copy.template_id===card.template_id).length}));
    return changed;
  }

  function finishLabel(finish) {
    return ({
      standard: "Commune", full_art: "Full art", foil: "Foil", full_art_foil: "Full art · Foil", legendary: "Légendaire"
    })[finish] || "Commune";
  }

  function icon(kind) {
    return `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><use href="#ui-${escapeHtml(kind)}"/></svg>`;
  }

  function normalizeSearch(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("fr");
  }

  const isHalloween = card => card.edition === "halloween_2026";
  const editionLabel = edition => edition === "halloween_2026" ? "Halloween 2026" : "Édition 01";
  function expiryHint(until) {
    const date = new Date(until), now = serverNow();
    if (!Number.isFinite(date.getTime())) return "";
    if (date <= now) return "Expirée";
    const formatter=expiryHint.formatter ||= new Intl.DateTimeFormat("en-CA", {timeZone:"Europe/Paris",year:"numeric",month:"2-digit",day:"2-digit"});
    const day = value => formatter.format(value);
    return day(date) === day(now) ? "Expire aujourd’hui" : "";
  }
  function halloweenActive() {
    const now = serverNow().getTime();
    return now >= Date.parse("2026-10-29T00:00:00+01:00") && now < Date.parse("2026-11-02T00:00:00+01:00");
  }

  function cardMarkup(card, options = {}) {
    const finish = card.finish || card.finish_tier || "standard";
    const choices = finish === "legendary" && !card.selected_template_id ? (card.legendary_options || []) : [];
    const initial = choices[0];
    const cycle = choices.length > 1 ? ` data-legend-cycle="${escapeHtml(JSON.stringify(choices.map(choice=>choice.title)))}"` : "";
    const title = initial?.title || card.title;
    const challenge = initial ? "Choisis ton défi à l’activation." : card.challenge;
    const slot = state.data?.catalogue_slots?.find(slot=>slot.template_id && slot.template_id === card.template_id);
    const number = slot ? ` · ${String(slot.number).padStart(3,"0")}` : "";
    const seed = Number(card.wear_seed ?? hashString(card.template_id || card.title));
    const wear = Math.abs(seed) % 5;
    const timer = options.timer ? `<span class="card-timer" data-until="${escapeHtml(options.timer)}" data-timer-kind="${card.active_until ? "active" : "available"}">${duration(options.timer, card.active_until ? "Terminé" : "Expirée")}</span>` : "";
    const modifier = card.effect_modifier === "reducto" ? "REDUCTO · Effet ÷2" : card.effect_modifier === "augmento" ? "AUGMENTO · Effet ×2" : "";
    const timeModifier = card.time_modifier === "presto" ? "PRESTO · Temps ÷2" : card.time_modifier === "adagio" ? "ADAGIO · Temps ×2" : "";
    return `<article class="game-card palette-${escapeHtml(card.palette || "couple")} finish-${escapeHtml(finish)}${isHalloween(card) ? " edition-halloween" : ""}${options.compact ? " compact" : ""}${options.muted ? " muted" : ""}" data-wear="${wear}">
      <div class="card-art" aria-hidden="true"></div><div class="card-engraving" aria-hidden="true"></div><div class="card-shine" aria-hidden="true"></div>
      <div class="card-top"><span>${escapeHtml(card.category)}</span></div>
      ${finish === "legendary" ? `<div class="legend-orbit" aria-hidden="true"></div><div class="legend-motes" aria-hidden="true">${[0,1,2,3,4].map(i=>`<i style="--i:${i}"></i>`).join("")}</div>` : ""}${timer}${modifier ? `<div class="ritual-effect ${escapeHtml(card.effect_modifier)}">${modifier}</div>` : ""}${timeModifier ? `<div class="ritual-time">${timeModifier}</div>` : ""}<div class="card-copy${title.length > 34 ? " long-title" : ""}"><h4${cycle}>${escapeHtml(title)}</h4><p>${escapeHtml(challenge || "Carte déjà découverte.")}</p></div>
      <div class="card-footer"><span>${escapeHtml(finishLabel(finish))}</span><i title="${escapeHtml(finishLabel(finish))}" aria-label="${escapeHtml(finishLabel(finish))}">${finishSymbol(finish)}</i><span>${isHalloween(card) ? "Halloween" : "Éd. 01"}${number}</span></div>
    </article>`;
  }

  function startLegendaryCycle() { setInterval(()=>{
    if (document.hidden || reducedMotion.matches) return;
    $$("[data-legend-cycle]").forEach(title=>{
      if (!title.getClientRects().length || title.closest(".motion-paused")) return;
      let choices; try { choices=JSON.parse(title.dataset.legendCycle); } catch { return; }
      if (choices.length<2) return;
      const index=((Number(title.dataset.legendIndex)||0)+1)%choices.length;
      title.classList.add("legend-changing");
      setTimeout(()=>{if(!title.isConnected || !title.dataset.legendCycle)return;title.textContent=choices[index];title.dataset.legendIndex=index;title.classList.remove("legend-changing");},170);
    });
  },2400); }

  function hashString(value) {
    return [...String(value || "")].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
  }

  function empty(message) {
    return `<p class="empty-state">${escapeHtml(message).replace(/&lt;br&gt;/g, "<br>")}</p>`;
  }

  function attachFoilMotion(root = document) {
    if (typeof IntersectionObserver === "function" && !state.motionObserver) {
      state.motionCards = new Set();
      state.motionObserver = new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle("motion-paused",!entry.isIntersecting)),{rootMargin:"60px"});
      state.motionObserver.observe($("#seasonBanner"));
    }
    if (state.motionCards) for (const old of state.motionCards) if (!old.isConnected) {state.motionObserver.unobserve(old);state.motionCards.delete(old);}

    root.querySelectorAll?.(".game-card").forEach(card => {
      if (card.dataset.foilReady) return;
      card.dataset.foilReady = "1";
      if (state.motionObserver) { card.classList.add("motion-paused"); state.motionCards.add(card); state.motionObserver.observe(card); }
      let rect, frame, started;
      const tile = card.closest(".card-button,.stack-copy,.selection-card");
      const move = event => {
        const point = event.touches?.[0] || event;
        if (tile && started && Math.hypot(point.clientX-started.x,point.clientY-started.y) > 12) tile.dataset.preventClick = "1";
        if (reducedMotion.matches) return;
        rect ||= card.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((point.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((point.clientY - rect.top) / rect.height) * 100));
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          card.style.setProperty("--pointer-x", `${x}%`);
          card.style.setProperty("--pointer-y", `${y}%`);
          card.style.setProperty("--card-rx", `${(50-y)*.11}deg`);
          card.style.setProperty("--card-ry", `${(x-50)*.14}deg`);
          card.classList.add("is-touching");
        });
      };
      const rest = () => {
        cancelAnimationFrame(frame); rect = null;
        started = null;
        if (tile) setTimeout(() => delete tile.dataset.preventClick, 80);
        card.classList.remove("is-touching");
        for (const property of ["--card-rx", "--card-ry"]) card.style.setProperty(property, "0deg");
        card.style.setProperty("--pointer-x", "50%"); card.style.setProperty("--pointer-y", "50%");
      };
      card.addEventListener("pointerdown", event => { rect = card.getBoundingClientRect(); started = { x:event.clientX, y:event.clientY }; if (tile) delete tile.dataset.preventClick; move(event); }, { passive: true });
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("touchmove", move, { passive: true });
      for (const type of ["pointerleave", "pointerup", "pointercancel"]) card.addEventListener(type, rest, { passive: true });
    });
  }

  function buttonCard(card, options = {}) {
    const count = Number(card.stack_count || card.owned_count || 1);
    const fresh = state.newTemplates?.has(card.template_id);
    return `<button class="card-button${count > 1 ? " stacked-card" : ""}" type="button" aria-label="Voir ${escapeHtml(card.title)}${count > 1 ? `, ${count} exemplaires` : ""}" data-card-id="${escapeHtml(card.id || "")}" data-template-id="${escapeHtml(card.template_id || "")}" style="--stack-depth:${Math.min(3, count-1)}">${cardMarkup(card, { ...options, timer: null })}${count > 1 && !options.hideStackCount ? `<span class="stack-count">×${count}</span>` : ""}${fresh ? '<span class="new-card-badge">Nouvelle</span>' : ""}${options.timer ? `<span class="tile-timer" data-until="${escapeHtml(options.timer)}">${cardCountdown(options.timer, options.activated)}</span>` : ""}</button>`;
  }

  function groupCards(cards) {
    const groups = new Map();
    for (const card of [...cards].sort((a,b) => new Date(a.expires_at) - new Date(b.expires_at))) {
      const key = `${card.template_id || card.id}:${card.finish || card.finish_tier || "standard"}`;
      if (groups.has(key)) {
        const group = groups.get(key); group.stack_count++;
      }
      else groups.set(key, { ...card, stack_count: 1 });
    }
    return [...groups.values()];
  }

  function collectionTile(card) {
    return `<div class="collection-tile">${buttonCard(card,{timer:card.expires_at,hideStackCount:true})}${card.stack_count > 1 ? `<div class="tile-controls"><button class="stack-count stack-trigger" type="button" data-stack-template="${escapeHtml(card.template_id)}" data-stack-finish="${escapeHtml(card.finish)}" aria-label="Voir les ${card.stack_count} exemplaires de ${escapeHtml(card.title)}"><span>×${card.stack_count}</span></button></div>` : ""}<small class="expiry-label" data-expiry="${escapeHtml(card.expires_at)}">${expiryHint(card.expires_at)}</small></div>`;
  }

  function stackCopies(template, finish) {
    return state.data.my_cards.filter(card=>card.template_id===template && card.finish===finish && isAvailable(card)).sort((a,b)=>new Date(a.expires_at)-new Date(b.expires_at));
  }

  function openStack(template, finish) {
    state.stackSelection = {template,finish}; renderStack();
    if (state.stackSelection) stackDialog.showModal();
  }

  function renderStack() {
    if (!state.stackSelection) return;
    const cards = stackCopies(state.stackSelection.template,state.stackSelection.finish);
    if (!cards.length) { state.stackSelection = null; stackDialog.close(); return; }
    $("#stackTitle").textContent = cards[0].title;
    $("#stackCount").textContent = `${cards.length} exemplaire${cards.length > 1 ? "s" : ""} · choisis le tien`;
    putMarkup("#stackCopies",cards.map((card,i)=>`<button class="stack-copy" type="button" data-copy-id="${escapeHtml(card.id)}" aria-label="Choisir l’exemplaire ${i+1}">${cardMarkup(card)}<b>Exemplaire ${i+1}</b><span data-until="${escapeHtml(card.expires_at)}">${duration(card.expires_at)}</span></button>`).join(""));
    attachFoilMotion(stackDialog);
  }

  function renderToday() {
    const data = state.data;
    const pending = data.pending_openings || [];
    const hasPack = Boolean(data.boosters.length || pending.length);
    $("#heroEdition").textContent = halloweenActive() ? "Spéciale Halloween × Édition 01" : "Édition 01 — Nous deux";
    $("#heroContents").textContent = "3 cartes";
    $("#todayView").classList.toggle("has-booster", hasPack);
    $("#dailyHero").classList.toggle("no-pack", !hasPack);
    $("#navBoosterBadge").hidden = !data.boosters.length;
    $("#navBoosterBadge").textContent = data.boosters.length;
    $("#todayDate").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(serverNow());
    $("#nextBoosterCounter").textContent = nextBoosterDuration();
    $("#collectionCount").textContent = data.my_cards.length;
    $("#knownCount").textContent = data.known_cards.length;
    $("#boosterCount").textContent = data.boosters.length;
    $("#activeCount").textContent = data.active_cards.length;

    putMarkup("#boosterList", pending.map(receipt=>`<button class="resume-opening" type="button" data-resume-opening="${escapeHtml(receipt.booster_id)}"><span aria-hidden="true">${icon("cards")}</span><strong>Reprendre<small>Carte ${Number(receipt.index)+1} / 3</small></strong><b>→</b></button>`).join("") + (data.boosters.length ? data.boosters.map(booster => `
      <button class="booster-item" type="button" data-booster-id="${escapeHtml(booster.id)}">
        <span class="mini-pack${isHalloween(booster) ? " pack-halloween" : ""}" aria-hidden="true"><strong>Les Cartes</strong><em>à deux.</em><small>${isHalloween(booster) ? "HALLOWEEN" : "ÉDITION 01"} · 3 CARTES</small></span>
        <span class="booster-copy"><span class="pack-owner">${booster.is_birthday ? `<b class="gift-badge">Anniversaire · offert</b>` : booster.is_test ? `<b class="gift-badge">Offert</b>` : `Pour ${escapeHtml(name(state.role))}`}</span><strong>Ouvrir mon booster ${icon("arrow")}</strong><small>3 cartes · expire dans <b data-until="${escapeHtml(booster.expires_at)}">${duration(booster.expires_at)}</b></small></span>
      </button>`).join("") : pending.length ? "" : `<button class="text-button" type="button" data-go-collection>Ma collection →</button>`));

    putMarkup("#activeCards", data.active_cards.length
      ? data.active_cards.map(card => `<div class="active-tile">${buttonCard(card, { timer: card.active_until, activated: true })}${card.owner_role === state.role ? `<button class="complete-quick" type="button" data-complete-card="${escapeHtml(card.id)}" aria-label="Défi réalisé : ${escapeHtml(card.title)}" title="Défi réalisé">${icon("handshake")}</button>` : ""}</div>`).join("")
      : `<div class="table-empty"><p>Une carte à vivre ?</p><button class="text-button" type="button" data-go-collection>Choisir dans ma collection →</button></div>`);
  }

  function renderCollection() {
    const available = state.data.my_cards.filter(card => isAvailable(card));
    const reserved=state.data.my_cards.filter(card=>card.status==="trading");
    $("#availableTabCount").textContent = available.length;
    const catalogueTotal = Number(state.data.catalogue_total || 100);
    $("#knownTabCount").textContent = `${state.data.known_cards.length}/${catalogueTotal}`;
    $("#collectionNote").textContent = state.collectionTab === "available"
      ? `7 jours pour jouer tes nouvelles cartes.${reserved.length ? ` ${reserved.length} réservée${reserved.length>1 ? "s" : ""} en échange.` : ""}`
      : "Les cartes découvertes restent dans ton album.";

    const cards = collectionCards();
    const edition = $("#editionFilter").value;
    const detailFilter = state.category !== "all" || $("#cardSearch").value.trim() || $("#finishFilter").value !== "all";
    const filterCount = Number(state.category !== "all") + Number(Boolean($("#cardSearch").value.trim())) + Number($("#finishFilter").value !== "all") + Number(edition !== "all");
    $("#filterCount").textContent = filterCount;
    $("#filterCount").hidden = !filterCount;
    if ($("#resetFilters")) $("#resetFilters").hidden = !filterCount;
    if (state.collectionTab === "known" && state.data.catalogue_slots && !detailFilter) {
      const known = new Map(cards.map(card => [card.template_id, card]));
      putMarkup("#collectionGrid", (state.data.editions || []).filter(item => edition === "all" || item.id === edition).map(item => `
        <details class="album-edition" style="--album-progress:${Math.min(100,item.discovered/item.total*100)}%" data-album-edition="${escapeHtml(item.id)}" ${state.collapsedEditions?.has(item.id) ? "" : "open"}>
          <summary><div><span class="eyebrow">${item.id === "halloween_2026" ? "Du 29 octobre au 1er novembre" : "La collection originale"}</span><h3>${editionLabel(item.id)}</h3></div><b>${item.discovered}/${item.total}</b><i aria-hidden="true">⌄</i></summary>
          <div class="album-slots">${state.data.catalogue_slots.filter(slot => slot.edition === item.id).map(slot => {
            const card = known.get(slot.template_id);
            return card ? buttonCard({ ...card, id: "", finish: card.finish_tier || "standard", wear_seed: hashString(card.template_id) }, { muted: Number(card.owned_count) === 0 })
              : `<div class="empty-card-slot${item.id === "halloween_2026" ? " seasonal-slot" : ""}" role="img" aria-label="Emplacement ${slot.number} : carte inconnue"><span aria-hidden="true">${icon("cards")}</span><strong>À découvrir</strong><small>${String(slot.number).padStart(2, "0")}</small></div>`;
          }).join("")}</div>
        </details>`).join(""));
      $("#collectionOwner").textContent = `L’album de ${name(state.role)}`;
      return;
    }
    putMarkup("#collectionGrid", cards.length
      ? cards.map(card => state.collectionTab === "available"
        ? collectionTile(card)
        : buttonCard({ ...card, id: "", finish: card.finish_tier || "standard", wear_seed: hashString(card.template_id) }, { muted: Number(card.owned_count) === 0 })
      ).join("")
      : empty((detailFilter || edition !== "all") ? "Aucune carte ne correspond à ces filtres." : state.collectionTab === "available" ? "Ouvre un booster pour commencer." : "À découvrir au fil des boosters."));
    $("#collectionOwner").textContent = `${state.collectionTab === "known" ? "L’album" : "La réserve"} de ${name(state.role)}`;
  }

  function collectionCards() {
    const source = state.collectionTab === "available" ? groupCards(state.data.my_cards.filter(card => isAvailable(card))) : state.data.known_cards;
    const query = normalizeSearch($("#cardSearch").value.trim());
    const finish = $("#finishFilter").value;
    const edition = $("#editionFilter").value;
    const sort = $("#sortFilter")?.value || "expiry";
    const ranks = {standard:0,full_art:1,foil:2,full_art_foil:3,legendary:4};
    const filtered = source.filter(card => (state.category === "all" || card.palette === state.category || (state.category === "spells" && ["joker","spell"].includes(card.card_type)))
      && (edition === "all" || (card.edition || "edition_01") === edition)
      && (finish === "all" || (card.finish || card.finish_tier) === finish)
      && (!query || normalizeSearch(`${card.title} ${card.category}`).includes(query)));
    return filtered.sort((a,b)=>sort === "recent" ? new Date(b.acquired_at || b.first_seen_at || 0)-new Date(a.acquired_at || a.first_seen_at || 0) : sort === "rarity" ? (ranks[b.finish || b.finish_tier] || 0)-(ranks[a.finish || a.finish_tier] || 0) : new Date(a.expires_at || 0)-new Date(b.expires_at || 0));
  }

  function option(card) {
    return `<option value="${escapeHtml(card.id)}">${escapeHtml(card.title)} · ${escapeHtml(finishLabel(card.finish))}</option>`;
  }

  function tradeMarkup(trade) {
    const incoming = trade.proposed_by !== state.role;
    const status = ({ pending: "En attente", accepted: "Accepté", rejected: "Refusé", cancelled: "Annulé", expired: "Expiré" })[trade.status] || trade.status;
    let actions = "";
    if (trade.status === "pending" && incoming) {
      actions = `<div class="trade-actions"><button type="button" data-trade-action="reject" data-trade-id="${trade.id}">Refuser</button><button class="accept" type="button" data-trade-action="accept" data-trade-id="${trade.id}">Accepter</button></div>`;
    } else if (trade.status === "pending") {
      actions = `<div class="trade-actions"><button type="button" data-trade-action="cancel" data-trade-id="${trade.id}">Annuler la proposition</button></div>`;
    }
    return `<article class="trade-item">
      <div class="trade-item-head"><strong>${incoming ? `${name(state.data.partner_role)} te propose` : "Tu proposes"}</strong><small>${escapeHtml(status)}${trade.status === "pending" ? ` · ${duration(trade.expires_at)}` : ""}</small></div>
      <div class="trade-pair"><div class="trade-mini">${cardMarkup(trade.offered)}<b>${escapeHtml(trade.offered.title)}</b><small>${escapeHtml(finishLabel(trade.offered.finish))}</small></div><span aria-hidden="true">${icon("exchange")}</span><div class="trade-mini">${cardMarkup(trade.requested)}<b>${escapeHtml(trade.requested.title)}</b><small>${escapeHtml(finishLabel(trade.requested.finish))}</small></div></div>${actions}
    </article>`;
  }

  function renderTrades() {
    const mine = state.data.my_cards.filter(card => isAvailable(card));
    const partner = state.data.partner_cards.filter(card => isAvailable(card));
    const selectedOffer = $("#offeredCardSelect").value;
    const selectedRequest = $("#requestedCardSelect").value;
    putMarkup("#offeredCardSelect", `<option value="">Une de mes cartes</option>${mine.map(option).join("")}`);
    putMarkup("#requestedCardSelect", `<option value="">Une carte de ${name(state.data.partner_role)}</option>${partner.map(option).join("")}`);
    if (mine.some(card => card.id === selectedOffer)) $("#offeredCardSelect").value = selectedOffer;
    if (partner.some(card => card.id === selectedRequest)) $("#requestedCardSelect").value = selectedRequest;
    renderTradeSelection();

    const pending = state.data.trades.filter(trade => trade.status === "pending");
    const history = state.data.trades.filter(trade => trade.status !== "pending");
    $("#pendingTradeCount").textContent = pending.length;
    const incoming = pending.filter(trade => trade.proposed_by !== state.role).length;
    $("#navTradeBadge").hidden = !incoming;
    $("#navTradeBadge").textContent = incoming;
    putMarkup("#pendingTrades",pending.length ? pending.map(tradeMarkup).join("") : empty("Aucune proposition en attente."));
    const timeline = [...history.map(trade=>({at:trade.responded_at || trade.created_at,id:trade.id,html:tradeMarkup(trade)})), ...(state.data.card_events || []).map(event=>({at:event.created_at,id:event.id,html:cardEventMarkup(event)}))].sort((a,b)=>new Date(b.at)-new Date(a.at) || String(b.id).localeCompare(String(a.id))).slice(0,state.historyLimit || 20);
    if ($("#moreHistory")) $("#moreHistory").hidden = timeline.length < (state.historyLimit || 20);
    putMarkup("#tradeHistory",timeline.length ? timeline.map(entry=>entry.html).join("") : empty("Dons, destructions, défis réalisés et échanges apparaîtront ici."));
  }

  function cardEventMarkup(event) {
    const own = event.actor_role === state.role;
    const label = event.event_type === "spell_cast" ? own ? "Sortilège lancé" : "Sortilège reçu" : event.event_type === "give_card" ? own ? `Donné à ${name(event.recipient_role)}` : `Reçu de ${name(event.actor_role)}` : event.event_type === "complete_card" ? "Défi réalisé" : "Exemplaire détruit";
    const eventIcon = event.event_type === "spell_cast" ? "wand" : event.event_type === "give_card" ? "gift" : event.event_type === "complete_card" ? "handshake" : "scissors";
    const date = new Intl.DateTimeFormat("fr-FR",{timeZone:"Europe/Paris",day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"}).format(new Date(event.created_at));
    return `<article class="card-event"><span aria-hidden="true">${icon(eventIcon)}</span><div><small>${escapeHtml(label)}</small><strong>${escapeHtml(event.title)}${event.target_title ? ` → ${escapeHtml(event.target_title)}` : ""}</strong><time datetime="${escapeHtml(event.created_at)}">${escapeHtml(date)} · ${escapeHtml(finishLabel(event.finish))}</time></div></article>`;
  }

  function renderTradeSelection() {
    const mine = state.data.my_cards.filter(card => isAvailable(card));
    const partner = state.data.partner_cards.filter(card => isAvailable(card));
    for (const [select, preview, cards] of [["offeredCardSelect","offeredPreview",mine],["requestedCardSelect","requestedPreview",partner]]) {
      const selected = cards.find(card => card.id === $("#"+select).value);
      putMarkup("#"+preview, selected ? cardMarkup(selected) : `<div class="trade-empty-card"><span>${icon("plus")}</span><b>${cards.length ? "Choisir" : "Aucune carte"}</b></div>`);
      $("#"+select).disabled = !cards.length;
      const picker = $("#"+select.replace("Select","Picker"));
      picker.disabled = !cards.length;
      picker.setAttribute("aria-label", selected ? `Changer ${selected.title}` : select === "offeredCardSelect" ? "Choisir ma carte" : `Choisir une carte de ${name(state.data.partner_role)}`);
    }
    const trading = state.managementMode === "trade";
    $("#tradeSelection").classList.toggle("single-card-selection", !trading);
    $("#requestedCardPick").hidden = !trading;
    $("#tradeArrow").hidden = !trading;
    $("#offeredCardLabel").textContent = trading ? "Je donne" : state.managementMode === "give" ? "À offrir" : "À détruire";
    $("#proposeTradeButton").textContent = trading ? "Proposer →" : state.managementMode === "give" ? `Donner à ${name(state.data.partner_role)} →` : "Détruire cet exemplaire";
    $("#proposeTradeButton").classList.toggle("danger-button", state.managementMode === "destroy");
    $("#proposeTradeButton").disabled = !$("#offeredCardSelect").value || !mine.length || (trading && (!$("#requestedCardSelect").value || !partner.length));
    $("#tradeHint").textContent = !mine.length ? "Aucune carte disponible dans ta main." : trading ? !partner.length ? `Aucune carte échangeable de ${name(state.data.partner_role)} déjà découverte.` : "" : state.managementMode === "give" ? "Même carte, même compteur. Découverte conservée." : "Un exemplaire en moins. Toujours dans « Déjà vues ».";
    $$("[data-management-mode]").forEach(button => { const selected = button.dataset.managementMode === state.managementMode; button.classList.toggle("selected", selected); button.setAttribute("aria-pressed", String(selected)); });
    attachFoilMotion($("#tradeView"));
  }

  function selectionCards(side = state.selectionSide) {
    if (side === "target") {
      const card=state.data.my_cards.find(card=>card.id===state.targetCardId);
      if (!card) return [];
      if (state.targetKind === "legendary") return (card.legendary_options || []).map(choice=>({...card,...choice,template_id:choice.id,finish:"full_art_foil"}));
      return card.card_type === "spell" ? spellTargets(card) : state.data.active_cards.filter(target=>target.owner_role===state.data.partner_role && new Date(target.active_until)>serverNow());
    }
    const source = side === "requested" ? state.data.partner_cards : state.data.my_cards;
    const known = new Set(state.data.known_cards.map(card=>card.template_id));
    return source.filter(card=>isAvailable(card) && new Date(card.expires_at)>serverNow() && (side !== "requested" || known.has(card.template_id)));
  }

  function renderSelectionGallery() {
    const all = selectionCards();
    const query = normalizeSearch($("#selectionSearch").value.trim());
    const cards = all.filter(card=>normalizeSearch(`${card.title} ${card.category}`).includes(query));
    const selected = state.selectionSide === "target" ? $("#"+(state.targetKind === "legendary" ? "legendaryChoiceSelect" : state.targetKind+"TargetSelect")).value : $("#"+state.selectionSide+"CardSelect").value;
    $("#selectionCount").textContent = `${cards.length} exemplaire${cards.length === 1 ? "" : "s"}`;
    putMarkup("#selectionGrid",cards.length ? cards.map(card=>`<button class="selection-card" type="button" data-select-copy="${escapeHtml(card.id)}" aria-pressed="${card.id === selected}" aria-label="Choisir ${escapeHtml(card.title)}, ${card.active_until ? "se termine" : "expire"} dans ${duration(card.active_until || card.expires_at)}">${cardMarkup(card)}<span class="selection-name">${escapeHtml(card.title)}</span><span class="selection-meta">${escapeHtml(finishLabel(card.finish))} · ${duration(card.active_until || card.expires_at)}</span>${card.id === selected ? `<span class="selection-check">${icon("check")}</span>` : ""}</button>`).join("") : empty("Aucune carte correspondante."));
    attachFoilMotion(selectionDialog);
  }

  function openSelectionGallery(side) {
    if (!["offered","requested"].includes(side)) return;
    state.selectionSide = side;
    $("#selectionTitle").textContent = side === "offered" ? "Choisir ma carte" : `La main de ${name(state.data.partner_role)}`;
    $("#selectionSearch").value = "";
    renderSelectionGallery();
    selectionDialog.showModal();
  }

  function render() {
    if (!state.data) return;
    expireLocalData();
    $("#currentRole").textContent = name(state.role);
    $("#presenceDot").classList.toggle("online", Boolean(state.data.partner_online));
    $("#profileMenu").title = `${name(state.data.partner_role)} ${state.data.partner_online ? "est en ligne" : "est hors ligne"}`;
    window.SeasonAnnouncements?.refresh(serverNow());
    $("#seasonHeading").textContent = halloweenActive() ? "Halloween" : "Halloween bientôt";
    $("#seasonCopy").textContent = "29 oct.–1 nov. · 10 exclusives";

    renderToday();
    renderCollection();
    renderTrades();
    renderStack();
    if (selectionDialog.open) renderSelectionGallery();
    attachFoilMotion();
    refreshOpenCard();
    updateTimers();
  }

  function updateTimers() {
    if (expireLocalData()) { render(); return; }
    const assign=(element,text)=>{if(element && element.textContent!==text)element.textContent=text;};
    assign($("#nextBoosterCounter"),nextBoosterDuration());
    $$('[data-until]').forEach(element => assign(element,element.matches(".tile-timer") ? cardCountdown(element.dataset.until,Boolean(element.closest("#activeCards"))) : duration(element.dataset.until,element.dataset.timerKind === "available" ? "Expirée" : "Terminé")));
    $$('[data-expiry]').forEach(element => assign(element,expiryHint(element.dataset.expiry)));
  }

  async function sync({ quiet = false } = {}) {
    if (!state.role || !state.data || state.syncing || state.busy || state.opening) return;
    state.syncing = true;
    $("#refreshButton").classList.add("syncing");
    try {
      await exchange("sync");
      render();
      setConnectionStatus("");
    } catch (error) {
      setConnectionStatus(navigator.onLine === false ? "Hors connexion" : "Actualisation interrompue");
      if (!quiet) toast(friendlyError(error));
      if (String(error?.message).includes("device_not_authorized") || String(error?.message).includes("pairing_required")) showLogin();
    } finally {
      state.syncing = false;
      $("#refreshButton").classList.remove("syncing");
    }
  }

  function setConnectionStatus(message) {
    const badge = $("#connectionStatus");
    if (badge) {badge.textContent=message;badge.hidden=!message;}
  }

  function startPolling() {
    clearInterval(state.polling);
    state.polling = setInterval(() => document.hidden || sync({ quiet: true }), 15000);
  }

  function enterApp() {
    loginScreen.hidden = true;
    appShell.hidden = false;
    $("#currentRole").textContent = name(state.role);
    storage.set("les-cartes-last-role", state.role);
    render();
    startPolling();
  }

  function showLogin(message = "Choisis ton profil.") {
    clearInterval(state.polling);
    state.data = null;
    appShell.hidden = true;
    loginScreen.hidden = false;
    pairingForm.hidden = true;
    profilePicker.hidden = false;
    $("#loginStatus").textContent = message;
  }

  async function selectRole(role) {
    if (state.busy) return;
    if (state.role !== role) { state.newTemplates.clear(); }
    state.role = role;
    state.token = storage.get(tokenKey(role));
    $("#loginStatus").textContent = `Connexion de ${name(role)}…`;
    if (!state.token) {
      state.token = generateToken();
      $("#pairingRole").textContent = name(role);
      profilePicker.hidden = true;
      pairingForm.hidden = false;
      $("#accessCode").value = "";
      $("#accessCode").focus();
      $("#loginStatus").textContent = `Ton code personnel suffit, ${name(role)}.`;
      return;
    }
    setBusy(true);
    try {
      await exchange("sync");
      enterApp();
    } catch (error) {
      const authError = /pairing_required|device_not_authorized/.test(String(error.message));
      if (!authError) { showLogin(friendlyError(error)); return; }
      storage.remove(tokenKey(role));
      state.token = generateToken();
      $("#pairingRole").textContent = name(role);
      profilePicker.hidden = true;
      pairingForm.hidden = false;
      $("#loginStatus").textContent = friendlyError(error);
    } finally {
      setBusy(false);
    }
  }

  function setView(view) {
    state.scrollPositions ||= {};
    state.scrollPositions[state.view] = window.scrollY;
    state.view = view;
    $$(".view").forEach(section => {
      const active = section.dataset.view === view;
      section.hidden = !active;
      section.classList.toggle("active", active);
    });
    $$('[data-nav]').forEach(button => {
      button.classList.toggle("selected", button.dataset.nav === view);
      if (button.dataset.nav === view) button.setAttribute("aria-current", "page"); else button.removeAttribute("aria-current");
    });
    window.scrollTo({ top: state.scrollPositions?.[view] || 0, behavior: "instant" });
    if (view === "today") renderToday();
    else if (view === "collection") renderCollection();
    else renderTrades();
    attachFoilMotion();
  }

  function findCard(element) {
    const id = element.closest("[data-card-id]")?.dataset.cardId;
    const templateId = element.closest("[data-template-id]")?.dataset.templateId;
    return [...state.data.my_cards, ...state.data.partner_cards, ...state.data.active_cards, ...state.data.known_cards]
      .find(card => (id && card.id === id) || (!id && templateId && card.template_id === templateId));
  }

  function spellTargets(card) {
    if (card.spell_code === "destructo") {
      const known = new Set(state.data.known_cards.map(item=>item.template_id));
      return state.data.partner_cards.filter(target=>target.status === "available" && new Date(target.expires_at)>serverNow() && known.has(target.template_id));
    }
    const effect = ["reducto","augmento"].includes(card.spell_code);
    return state.data.active_cards.filter(target=>target.owner_role === state.data.partner_role && new Date(target.active_until)>serverNow() && (effect ? !target.effect_modifier : !target.time_modifier));
  }

  function openCard(card, keepList = false) {
    if (!card) return;
    if (!keepList) {
      state.viewerSession++;
      state.viewerCards = state.view === "collection" ? collectionCards() : state.data.active_cards;
      state.viewerIndex = state.viewerCards.findIndex(item => card.id ? item.id === card.id : item.template_id === card.template_id);
      if (state.viewerIndex < 0) { state.viewerCards = [card]; state.viewerIndex = 0; }
    }
    card = state.data.my_cards.find(owned => owned.id === card.id) || card;
    const isMine = card.id && state.data.my_cards.some(owned => owned.id === card.id);
    const isJoker = card.card_type === "joker";
    const isSpell = card.card_type === "spell";
    const isLegendary = (card.finish || card.finish_tier) === "legendary";
    const legendaryChoices = isLegendary ? (card.legendary_options || []) : [];
    const canActivate = isMine && isAvailable(card) && !isJoker && !isSpell;
    state.viewerCardId = card.id || null;
    state.viewerTemplateId = card.template_id;
    const active = card.active_until && new Date(card.active_until) > serverNow();
    const canComplete = active && card.owner_role === state.role && state.data.active_cards.some(item=>item.id===card.id);
    const ownership = isMine ? card.status === "trading" ? "Réservée pour un échange" : "Dans ta main" : card.owner_role ? `Carte de ${name(card.owner_role)}` : Number(card.owned_count) ? "Dans ta collection" : "Déjà découverte";
    const jokerTargets = isJoker && isMine
      ? state.data.active_cards.filter(target => target.owner_role === state.data.partner_role && new Date(target.active_until)>serverNow())
      : [];
    const jokerAction = isJoker && isMine && isAvailable(card)
      ? jokerTargets.length
        ? `<label class="joker-target">Carte active à annuler<select id="jokerTargetSelect">${jokerTargets.map(target => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.title)}</option>`).join("")}</select></label><button class="primary-button" type="button" data-use-joker="${escapeHtml(card.id)}">Utiliser ce Joker</button>`
        : `<p>Aucune carte active de ${escapeHtml(name(state.data.partner_role))} ne peut être annulée pour l’instant.</p>`
      : "";
    const legendaryAction = isLegendary && canActivate ? `<label class="joker-target">Ton défi au choix<select id="legendaryChoiceSelect">${legendaryChoices.map(choice=>`<option value="${escapeHtml(choice.id)}">${escapeHtml(choice.title)}</option>`).join("")}</select></label>` : "";
    const targets = isSpell && isMine ? spellTargets(card) : [];
    const spellAction = isSpell && isMine && isAvailable(card)
      ? targets.length ? `<label class="joker-target">${card.spell_code === "destructo" ? "Carte connue dans la main adverse" : "Rituel adverse à cibler"}<select id="spellTargetSelect">${targets.map(target=>`<option value="${escapeHtml(target.id)}">${escapeHtml(target.title)} · ${duration(target.active_until || target.expires_at)}</option>`).join("")}</select></label><button class="primary-button" type="button" data-use-spell="${escapeHtml(card.id)}">Lancer ${escapeHtml(card.title)}</button>`
        : `<p>${card.spell_code === "destructo" ? "Aucune carte connue disponible dans la main adverse." : "Aucun rituel adverse ne peut recevoir ce changement pour l’instant."}</p>`
      : "";
    $("#cardDialogContent").innerHTML = `<div class="viewer-card" id="viewerCard">${cardMarkup(card, { timer: card.active_until || (isAvailable(card) ? card.expires_at : null), muted: !card.id })}</div>
      <div class="viewer-nav"><button class="round-button" data-viewer-prev aria-label="Carte précédente" ${state.viewerIndex === 0 ? "disabled" : ""}>${icon("back")}</button><span>${state.viewerIndex + 1} / ${state.viewerCards.length}<small>Glisse pour feuilleter</small></span><button class="round-button" data-viewer-next aria-label="Carte suivante" ${state.viewerIndex >= state.viewerCards.length - 1 ? "disabled" : ""}>${icon("arrow")}</button></div>
      <div class="card-dialog-copy"><span class="eyebrow">${escapeHtml(ownership)} · ${escapeHtml(finishLabel(card.finish || card.finish_tier || "standard"))}</span><h2>${escapeHtml(card.title)}</h2><p class="detail-challenge">${escapeHtml(card.challenge)}</p>
      ${jokerAction}${spellAction}${legendaryAction}${canActivate ? `<button class="primary-button" type="button" data-activate-card="${escapeHtml(card.id)}">Activer cette carte · 24 h</button>` : active ? `<p>Se termine dans ${duration(card.active_until)}.</p>` : ""}
      ${canComplete ? `<button class="primary-button complete-button" type="button" data-complete-card="${escapeHtml(card.id)}">${icon("handshake")} Défi réalisé</button>` : ""}
      ${isMine && isAvailable(card) ? `<div class="card-options" aria-label="Gérer cet exemplaire"><button type="button" data-exchange-card="${escapeHtml(card.id)}">${icon("exchange")}Échanger</button><button type="button" data-give-card="${escapeHtml(card.id)}">${icon("gift")}Donner</button><button type="button" class="destroy-option" data-destroy-card="${escapeHtml(card.id)}">${icon("scissors")}Détruire</button></div>` : ""}</div>`;
    if (!cardDialog.open) cardDialog.showModal();
    for (const [kind,id] of [["joker","jokerTargetSelect"],["spell","spellTargetSelect"],["legendary","legendaryChoiceSelect"]]) {
      const select=$("#"+id);if(!select)continue;
      select.hidden=true;select.tabIndex=-1;
      const picker=document.createElement("button");picker.type="button";picker.className="target-picker";picker.dataset.targetPicker=kind;picker.dataset.targetCard=card.id;
      const update=()=>{const option=select.selectedOptions[0];picker.innerHTML=`<span>${escapeHtml(option?.textContent || "Choisir")}</span>${icon("cards")}`;updateSpellPreview(card,select.value);};
      select.after(picker);select.addEventListener("change",update);update();
    }
    attachFoilMotion(cardDialog);
    const choiceSelect = $("#legendaryChoiceSelect");
    if (isLegendary && choiceSelect) choiceSelect.addEventListener("change",()=>{
      const choice = legendaryChoices.find(item=>item.id===choiceSelect.value);
      const title = $("#viewerCard h4");
      if (!choice || !title) return;
      delete title.dataset.legendCycle; title.classList.remove("legend-changing"); title.textContent=choice.title;
    });
    state.viewerSignature = JSON.stringify(card);
    setupSwipe($("#cardDialogContent"), (direction, dx) => moveViewer(direction, dx), $("#viewerCard"));
  }

  function updateSpellPreview(card,targetId) {
    $("#spellPreview")?.remove();
    if(card.card_type!=="spell")return;
    const target=spellTargets(card).find(card=>card.id===targetId);if(!target)return;
    const preview=document.createElement("p");preview.id="spellPreview";preview.className="spell-preview";
    const factor=card.spell_code==="presto"?.5:card.spell_code==="adagio"?2:null;
    preview.textContent=factor ? `${duration(target.active_until)} → ${duration(new Date(serverNow().getTime()+(new Date(target.active_until)-serverNow())*factor))}` : card.spell_code==="reducto" ? "Effet normal → effet ÷2" : card.spell_code==="augmento" ? "Effet normal → effet ×2" : "Cet exemplaire quittera sa main.";
    $("[data-use-spell]")?.before(preview);
  }

  function refreshOpenCard() {
    if (!cardDialog.open || state.viewerMoving || state.busy || $("#confirmDialog").open) return;
    const oldId = state.viewerCardId;
    const card = oldId ? [...state.data.my_cards,...state.data.active_cards].find(card=>card.id===oldId) : state.data.known_cards.find(card=>card.template_id===state.viewerTemplateId);
    if (!card) { cardDialog.close(); toast("Cette carte n’est plus disponible."); return; }
    if (JSON.stringify(card) === state.viewerSignature) return;
    const chosen = $("#legendaryChoiceSelect")?.value;
    const focus = document.activeElement?.id;
    const top = cardDialog.scrollTop;
    openCard(card,true);
    if (chosen && $("#legendaryChoiceSelect")) {$("#legendaryChoiceSelect").value=chosen;$("#legendaryChoiceSelect").dispatchEvent(new Event("change"));}
    cardDialog.scrollTop=top;
    if (focus) document.getElementById(focus)?.focus({preventScroll:true});
  }

  async function moveViewer(direction, dx = 0) {
    if (state.viewerMoving) return;
    const index = state.viewerIndex + direction;
    if (index < 0 || index >= state.viewerCards.length) return;
    state.viewerMoving = true;
    const session = state.viewerSession;
    $("#cardDialogContent").inert = true;
    const element = $("#viewerCard");
    await element.animate([{ transform: `translateX(${dx}px)` }, { transform: `translateX(${-direction*65}%) rotate(${-direction*7}deg)`, opacity: 0 }], { duration: reducedMotion.matches ? 0 : 160, easing: "cubic-bezier(.2,.7,.2,1)" }).finished.catch(() => {});
    state.viewerMoving = false;
    $("#cardDialogContent").inert = false;
    if (!cardDialog.open || session !== state.viewerSession) return;
    state.viewerIndex = index;
    openCard(state.viewerCards[index], true);
    feedback("card");
  }

  function feedback(kind) {
    navigator.vibrate?.(kind === "rare" ? [15, 25, 25] : 10);
  }

  function captureCardGhost(selector = "#viewerCard .game-card") {
    if (reducedMotion.matches) return null;
    const source = $(selector);
    if (!source) return null;
    const rect = source.getBoundingClientRect();
    const ghost = document.createElement("div");
    ghost.className = "journey-ghost";
    ghost.setAttribute("aria-hidden", "true");
    Object.assign(ghost.style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px` });
    ghost.append(source.cloneNode(true));
    ghost._origin = rect;
    return ghost;
  }

  function acknowledgeCard(ghost, kind, label) {
    if (reducedMotion.matches) return;
    const badge = document.createElement("div");
    badge.className = "action-acknowledgment"; badge.setAttribute("aria-hidden","true");
    badge.innerHTML = `<i>${icon(kind === "give" ? "gift" : kind === "spell" ? "wand" : "handshake")}</i><span>${escapeHtml(label)}</span>`;
    document.body.append(badge); setTimeout(()=>badge.remove(),750);
    if (!ghost) return;
    document.body.append(ghost);
    ghost.animate([{transform:"none",opacity:1},{transform:kind === "give" ? "translate(180px,-160px) rotate(14deg) scale(.35)" : "translateY(-45px) scale(.85)",opacity:0}],{duration:480,easing:"cubic-bezier(.2,.75,.2,1)",fill:"forwards"}).finished.catch(()=>{}).finally(()=>ghost.remove());
  }

  function flyToTable(ghost, cardId) {
    if (!ghost) return;
    document.body.append(ghost);
    requestAnimationFrame(() => {
      const target = $(`#activeCards [data-card-id="${cardId}"] .game-card`);
      if (!target) { ghost.remove(); return; }
      const rect = target.getBoundingClientRect(), origin = ghost._origin;
      ghost.animate([{ transform: "translate(0,0) scale(1)", opacity: 1 }, { transform: `translate(${rect.left-origin.left}px,${rect.top-origin.top}px) scale(${rect.width/origin.width})`, opacity: .1 }], { duration: 520, easing: "cubic-bezier(.2,.75,.2,1)", fill: "forwards" }).finished.catch(() => {}).finally(() => ghost.remove());
      feedback("card");
    });
  }

  function celebrateTrade() {
    if (reducedMotion.matches) return;
    const effect = document.createElement("div");
    effect.className = "trade-celebration"; effect.setAttribute("aria-hidden", "true");
    effect.innerHTML = "<i></i><i></i><b>Échange accepté</b>";
    document.body.append(effect);
    setTimeout(() => effect.remove(), 850);
  }

  function setupSwipe(element, onSwipe, visual = element, options = {}) {
    // The dialog content survives card replacement: do not accumulate listeners.
    element._swipeCleanup?.();
    element._swipeCleanup = window.CardBoosterGesture.swipe(element, {
      ...options,
      onMove: (dx, dy) => {
        if (element === boosterDialog && state.revealMoving) return;
        const card = typeof visual === "function" ? visual() : visual;
        if (!card) return;
        card.classList.add("dragging");
        card.style.setProperty("--drag-x", `${dx}px`);
        card.style.setProperty("--drag-y", `${dy}px`);
        card.style.setProperty("--drag-rotate", `${dx*.025}deg`);
      },
      onEnd: () => {
        const card = typeof visual === "function" ? visual() : visual;
        if (!card) return;
        card.classList.remove("dragging");
        card.style.removeProperty("--drag-x"); card.style.removeProperty("--drag-rotate");
        card.style.removeProperty("--drag-y");
      },
      onSwipe
    });
  }

  async function confirmAction(title, copy) {
    const dialog = $("#confirmDialog");
    $("#confirmTitle").textContent = title;
    $("#confirmCopy").textContent = copy;
    dialog.returnValue = "cancel";
    dialog.showModal();
    return new Promise(resolve => {
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "accept"), { once: true });
    });
  }

  async function performCardManagement(giving, id) {
    const card = state.data.my_cards.find(item => item.id === id);
    if (!card || card.status !== "available") return toast(errorMessages.card_unavailable);
    if (!giving) return openDestruction(card);
    const partner = name(state.data.partner_role);
    if (!await confirmAction(`Donner à ${partner} ?`, `« ${card.title} » rejoint sa main avec le même compteur. Elle reste dans tes cartes déjà vues.`)) return;
    const ghost = captureCardGhost(cardDialog.open ? "#viewerCard .game-card" : "#offeredPreview .game-card");
    const done = contextualBusy(cardDialog.open ? $("[data-give-card]") : $("#proposeTradeButton"),"Envoi…");
    try {
      await exchange("give_card", { card_id: id });
      cardDialog.close(); render();
      acknowledgeCard(ghost,"give",`Pour ${partner}`);
      toast(`Carte donnée à ${partner}.`);
    } catch (error) { toast(friendlyError(error)); }
    finally { done(); }
  }

  function bladeTrace(a, b) {
    if (reducedMotion.matches) return;
    const trail = document.createElement("i");
    trail.className = "blade-trail"; trail.setAttribute("aria-hidden", "true");
    Object.assign(trail.style, {left:`${a.x}px`,top:`${a.y}px`,width:`${Math.hypot(b.x-a.x,b.y-a.y)}px`,transform:`rotate(${Math.atan2(b.y-a.y,b.x-a.x)}rad)`});
    destroyDialog.append(trail);
    setTimeout(() => trail.remove(),300);
  }

  function openDestruction(card) {
    destruction = {card,cuts:[],committing:false};
    $("#shredPreview").innerHTML = cardMarkup(card);
    $("#shredPreview").classList.remove("shredded");
    $("#destroyStatus").textContent = "0 / 3 · Sa découverte reste dans « Déjà vues ».";
    $$("#cutMeter i").forEach(dot => dot.classList.remove("cut"));
    destroyDialog.showModal();
  }

  async function commitDestruction() {
    if (!destruction || destruction.committing) return;
    const session = destruction;
    session.committing = true;
    const done = contextualBusy($("#destroyWithoutGesture"),"Découpe…");
    $("#destroyStatus").textContent = "La découpe se termine…";
    try {
      await exchange("destroy_card", {card_id:session.card.id});
      const pieces = window.CardBoosterGesture.fragments(session.cuts);
      $("#shredPreview").insertAdjacentHTML("beforeend", `<div class="card-fragments" aria-hidden="true">${pieces.map((piece,i) => {
        const x = piece.reduce((sum,p)=>sum+p.x,0)/piece.length;
        return `<div class="card-fragment" style="clip-path:polygon(${piece.map(p=>`${p.x}% ${p.y}%`).join(",")});--piece-x:${(x-50)*3}px;--piece-y:${100+(i%3)*45}px;--piece-rotate:${(i%2?1:-1)*(15+i*4)}deg">${cardMarkup(session.card)}</div>`;
      }).join("")}</div>`);
      $("#shredPreview").classList.add("shredded");
      $("#destroyStatus").textContent = "Exemplaire détruit · découverte conservée.";
      render(); cardDialog.close(); feedback("card");
      await new Promise(resolve => setTimeout(resolve,reducedMotion.matches ? 0 : 480));
      if (destruction === session) destroyDialog.close();
      toast("Exemplaire détruit · découverte conservée.");
    } catch (error) {
      let refreshed = false;
      try { await exchange("sync"); render(); refreshed = true; } catch {}
      if (refreshed && !state.data.my_cards.some(card => card.id === session.card.id)) {
        destroyDialog.close();
        toast("Cet exemplaire n’est plus disponible. Collection actualisée.");
        return;
      }
      session.committing = false; session.cuts = [];
      $$("#shredPreview .cut-scar").forEach(scar=>scar.remove());
      $$("#cutMeter i").forEach(dot => dot.classList.remove("cut"));
      $("#destroyStatus").textContent = friendlyError(error);
    } finally { done(); }
  }

  const revealPositionKey = id => `les-cartes-reveal:${state.role}:${id}`;
  const pendingProgress = new Map();
  let progressWriting = false;
  async function flushRevealProgress() {
    if (progressWriting) return;
    progressWriting = true;
    try {
      while (pendingProgress.size) {
        const [key,entry] = pendingProgress.entries().next().value;
        pendingProgress.delete(key);
        if (entry.role !== state.role || entry.token !== state.token) continue;
        try { await exchange("opening_progress",{booster_id:entry.id,index:entry.index}); } catch {}
      }
    } finally { progressWriting = false; }
  }

  function rememberRevealPosition() {
    const id = state.selectedBooster;
    if (!id) return;
    storage.set(revealPositionKey(id),JSON.stringify({index:state.revealIndex,at:serverNow().getTime()}));
    const receipt = state.data.pending_openings?.find(item=>item.booster_id===id);
    if (receipt) receipt.index = state.revealIndex;
    pendingProgress.set(`${state.role}:${id}`,{id,index:state.revealIndex,role:state.role,token:state.token});
    flushRevealProgress();
  }

  function showOpeningReceipt(receipt) {
    state.opening = true;
    state.revealedCards = receipt.cards;
    state.revealIndex = Number(receipt.index) || 0;
    try {
      const local = JSON.parse(storage.get(revealPositionKey(receipt.booster_id)) || "null");
      if (local && Number.isInteger(local.index) && local.index >= 0 && local.index <= 2 && local.at > new Date(receipt.progress_at || receipt.opened_at).getTime()) state.revealIndex = local.index;
    } catch {}
    $("#sealedPack").hidden = true; $("#openPackButton").hidden = true;
    $("#boosterStage").classList.remove("unsealing","awaiting");
    $("#boosterStage").classList.add("revealed");
    $("#revealSlot").hidden = false; renderRevealedCard();
  }

  function resumeOpening(id) {
    const receipt = state.data.pending_openings?.find(item=>item.booster_id===id);
    if (!receipt || receipt.cards.length !== 3) return;
    openBooster(id); showOpeningReceipt(receipt);
  }

  function openBooster(id) {
    clearTimeout(openingTimer);
    boosterDialog.removeAttribute("data-revealing");
    state.selectedBooster = id;
    state.opening = false;
    state.revealedCards = [];
    state.revealIndex = 0;
    state.revealMoving = false;
    state.revealQueue = [];
    state.finishingOpening = false;
    boosterDialog._swipeCleanup?.();
    setupSwipe(boosterDialog, (direction, dx, dy) => advanceReveal(dx, direction, dy), () => $("#revealFront"), {
      axis: "both", includeButtons: true,
      enabled: () => boosterDialog.open && !state.finishingOpening && !$("#revealSlot").hidden && state.revealedCards.length > 0
    });
    $("#sealedPack").classList.remove("opened", "was-touched");
    $("#boosterStage").classList.remove("awaiting", "unsealing", "revealed");
    packGesture?.reset();
    const seasonal = isHalloween(state.data.boosters.find(booster => booster.id === id) || {});
    $("#sealedPack").classList.toggle("pack-halloween", seasonal);
    $("#packEdition").textContent = seasonal ? "HALLOWEEN × ÉDITION 01" : "ÉDITION 01 · NOUS DEUX";
    $("#sealedPack").hidden = false;
    $("#openPackButton").hidden = false;
    $("#openPackButton").disabled = false;
    $("#sealedPack").style.setProperty("--tear", "0%");
    $("#revealSlot").hidden = true;
    $("#revealSlot").innerHTML = "";
    $("#boosterStatus").textContent = "Tourne le paquet. Glisse sur le haut pour ouvrir.";
    boosterDialog.showModal();
  }

  function renderRevealedCard() {
    const card = state.revealedCards[state.revealIndex];
    if (!card) {
      $("#revealSlot").innerHTML = empty("Les cartes ont été ajoutées à ta collection.");
      return;
    }
    const last = state.revealIndex === state.revealedCards.length - 1;
    state.revealMoving = false;
    const depth = state.revealedCards.length - 1;
    $("#revealSlot").innerHTML = `<div class="reveal-stack" id="revealStack">${Array.from({length: depth}, (_, i) => `<div class="card-back" style="--depth:${depth-i}" aria-hidden="true"></div>`).join("")}<div class="reveal-front" id="revealFront">${cardMarkup(card)}${state.newTemplates.has(card.template_id) ? '<span class="reveal-new">Nouvelle découverte</span>' : ""}</div></div><div class="reveal-controls"><div class="reveal-dots" aria-label="Carte ${state.revealIndex + 1} sur ${state.revealedCards.length}">${state.revealedCards.map((_, i) => `<i class="${i === state.revealIndex ? "selected" : ""}"></i>`).join("")}</div><button class="primary-button" type="button" ${last ? "data-reveal-finish" : "data-reveal-next"}>${last ? "Ranger mes 3 cartes →" : "Suivante →"}</button></div>`;
    $("#boosterStatus").textContent = `${state.revealIndex + 1} / 3 · ${finishLabel(card.finish)} · Glisse pour feuilleter`;
    boosterDialog.setAttribute("data-revealing","true");
    $("#revealSlot").classList.toggle("rare-reveal", card.finish !== "standard");
    if (card.finish !== "standard") feedback("rare");
    attachFoilMotion($("#revealSlot"));
    rememberRevealPosition();
  }

  async function advanceReveal(dx = -1, direction = 1, dy = 0) {
    if (state.finishingOpening || $("#revealSlot").hidden || !boosterDialog.open) return;
    if (state.revealMoving) { if (state.revealQueue.length < 1) state.revealQueue.push([dx, direction, dy]); return; }
    if (!state.revealedCards.length) return;
    state.revealMoving = true;
    const front = $("#revealFront");
    const vertical = Math.abs(dy) > Math.abs(dx);
    const exit = vertical ? `translateY(${-direction * 100}%) rotate(${direction * 5}deg)` : `translateX(${-direction * 100}%) rotate(${-direction * 12}deg)`;
    const animation = front.animate([
      { transform: `translate(${Math.abs(dx) > 1 ? dx : 0}px,${dy}px) rotate(${dx * .025}deg)`, opacity: 1 },
      { transform: exit, opacity: 0 }
    ], { duration: reducedMotion.matches ? 0 : 145, easing: "cubic-bezier(.2,.7,.2,1)", fill: "forwards" });
    const session = state.selectedBooster;
    await animation.finished.catch(() => {});
    if (!boosterDialog.open || session !== state.selectedBooster) return;
    state.revealIndex = (state.revealIndex + direction + state.revealedCards.length) % state.revealedCards.length;
    renderRevealedCard();
    feedback("card");
    const queued = state.revealQueue.shift();
    if (queued) advanceReveal(...queued);
  }

  async function finishReveal() {
    if (state.finishingOpening || !state.selectedBooster) return;
    state.finishingOpening = true;
    const id = state.selectedBooster;
    const done = contextualBusy($("[data-reveal-finish]"),"Rangement…");
    try {
      await exchange("finish_opening",{booster_id:id});
      storage.remove(revealPositionKey(id));
      state.data.pending_openings = (state.data.pending_openings || []).filter(item=>item.booster_id!==id);
      if (state.selectedBooster === id) boosterDialog.close();
      render(); setView("collection"); toast("Découverte terminée.");
    } catch (error) { toast(friendlyError(error)); }
    finally { state.finishingOpening = false; done(); }
  }

  async function revealBooster() {
    if (state.opening || !state.selectedBooster) return;
    state.opening = true;
    const boosterId = state.selectedBooster;
    const previouslyKnown = new Set(state.data.known_cards.map(card => card.template_id));
    const motionStarted = performance.now();
    $("#openPackButton").disabled = true;
    $("#sealedPack").style.setProperty("--tear", "100%");
    $("#sealedPack").style.setProperty("--pull", "1");
    $("#boosterStage").classList.add("awaiting", "unsealing");
    $("#sealedPack").classList.add("opened");
    $("#boosterStatus").textContent = "Le sceau cède… Tes cartes arrivent.";
    try {
      await exchange("open_booster", { booster_id: state.selectedBooster });
      const receipt = state.data.pending_openings?.find(item=>item.booster_id===boosterId);
      state.revealedCards = receipt?.cards || state.data.my_cards
        .filter(candidate => candidate.booster_id === boosterId)
        .sort((a, b) => ({ energy: 0, challenge: 1, joker: 2 }[a.card_type] ?? 1) - ({ energy: 0, challenge: 1, joker: 2 }[b.card_type] ?? 1));
      state.revealIndex = 0;
      for (const card of state.revealedCards) if (!previouslyKnown.has(card.template_id)) state.newTemplates.add(card.template_id);
      if (state.revealedCards.length !== 3) throw new Error("Les cartes sont enregistrées. Actualise ta collection.");
      $("#openPackButton").hidden = true;
      $("#boosterStatus").textContent = "Tes cartes arrivent…";
      feedback("rare");
      openingTimer = setTimeout(() => {
        if (!boosterDialog.open) return;
        showOpeningReceipt(receipt || {booster_id:boosterId,cards:state.revealedCards,index:0});
      }, reducedMotion.matches ? 0 : Math.max(0, 760 - (performance.now() - motionStarted)));
      render();
    } catch (error) {
      try {
        await exchange("sync");
        const recovered = state.data.pending_openings?.find(item=>item.booster_id===boosterId);
        if (recovered) { showOpeningReceipt(recovered); render(); return; }
      } catch {}
      state.opening = false;
      $("#boosterStage").classList.remove("awaiting", "unsealing");
      $("#sealedPack").classList.remove("opened");
      packGesture?.reset();
      $("#openPackButton").disabled = false;
      $("#boosterStatus").textContent = friendlyError(error);
      if (String(error.message).includes("booster_unavailable")) { await sync({ quiet: true }); $("#openPackButton").hidden = true; }
    }
  }

  function setupBoosterGesture() {
    const pack = $("#sealedPack");
    packGesture = window.CardBoosterGesture.attach(pack, {
      surface: boosterDialog,
      isLocked: () => state.opening || !boosterDialog.open,
      onProgress: (progress, angle = 0) => {
        pack.style.setProperty("--tear", `${progress * 100}%`);
        pack.style.setProperty("--pull", String(progress));
        pack.style.setProperty("--cut-angle", `${angle}deg`);
        $("#tearPercent").textContent = progress ? "Déchire…" : "Glisse pour ouvrir";
      },
      onPose: pose => {
        pack.style.setProperty("--pack-rx", `${pose.x}deg`); pack.style.setProperty("--pack-ry", `${pose.y}deg`); pack.style.setProperty("--pack-rz", `${pose.z}deg`);
      },
      onMode: mode => { pack.dataset.gestureMode = mode; },
      onStep: () => { if (!reducedMotion.matches) navigator.vibrate?.(5); },
      onCommit: revealBooster
    });
  }

  $$("[data-role]").forEach(button => button.addEventListener("click", () => selectRole(button.dataset.role)));
  $("#pairingBack").addEventListener("click", () => showLogin());
  $("#openPackButton").addEventListener("click", revealBooster);
  $("#confirmAccept").addEventListener("click", () => $("#confirmDialog").close("accept"));
  $("#confirmCancel").addEventListener("click", () => $("#confirmDialog").close("cancel"));
  $("#destroyWithoutGesture").addEventListener("click", async () => {
    if (!destruction || destruction.committing) return;
    if (await confirmAction("Détruire cet exemplaire ?", "Il quitte ta main et reste dans « Déjà vues ».")) commitDestruction();
  });
  for (const id of ["cardSearch", "finishFilter", "editionFilter", "sortFilter"]) $("#" + id).addEventListener(id === "cardSearch" ? "input" : "change", () => { renderCollection(); attachFoilMotion(); });
  $$('[data-category]').forEach(button => button.addEventListener("click", () => {
    state.category = button.dataset.category;
    $$('[data-category]').forEach(item => { item.classList.toggle("selected", item === button); item.setAttribute("aria-pressed", String(item === button)); });
    renderCollection(); attachFoilMotion();
  }));
  pairingForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (state.busy) return;
    const code = $("#accessCode").value.replace(/\s|-/g, "").toUpperCase();
    setBusy(true);
    try {
      await exchange("login", {}, code);
      storage.set(tokenKey(state.role), state.token);
      $("#accessCode").value = "";
      enterApp();
    } catch (error) {
      $("#loginStatus").textContent = friendlyError(error);
    } finally {
      setBusy(false);
    }
  });

  document.querySelectorAll("[data-open-info]").forEach(button => button.addEventListener("click", () => $("#infoDialog").showModal()));
  for (const id of ["offeredCardSelect", "requestedCardSelect"]) $("#"+id).addEventListener("change", renderTradeSelection);
  $("#profileMenu").addEventListener("click", () => showLogin("Choisis l’autre profil ou reconnecte-toi."));
  $("#logoutDevice").addEventListener("click",async()=>{
    if(!await confirmAction("Déconnecter cet appareil ?","Ta collection reste sauvegardée. Ton code personnel permettra de revenir."))return;
    const done=contextualBusy($("#logoutDevice"),"Déconnexion…");
    try{await exchange("release_device");storage.remove(tokenKey(state.role));storage.remove("les-cartes-last-role");$("#infoDialog").close();showLogin("Appareil déconnecté.");state.token=null;}catch(error){toast(friendlyError(error));}finally{done();}
  });
  $("#refreshButton").addEventListener("click", () => sync());
  $$('[data-nav]').forEach(button => button.addEventListener("click", () => setView(button.dataset.nav)));
  $$('[data-collection-tab]').forEach(button => button.addEventListener("click", () => {
    state.collectionTab = button.dataset.collectionTab;
    $("#collectionGrid").setAttribute("aria-labelledby",button.id);
    $$('[data-collection-tab]').forEach(tab => { tab.classList.toggle("selected", tab === button); tab.setAttribute("aria-selected", String(tab === button)); tab.tabIndex = tab === button ? 0 : -1; });
    renderCollection();
    attachFoilMotion();
  }));

  $("#resetFilters").addEventListener("click",()=>{
    $("#cardSearch").value=""; $("#finishFilter").value="all"; $("#editionFilter").value="all"; state.category="all";
    $$("[data-category]").forEach(button=>{const active=button.dataset.category==="all";button.classList.toggle("selected",active);button.setAttribute("aria-pressed",String(active));});
    renderCollection();attachFoilMotion();
  });
  $("#moreHistory").addEventListener("click",async()=>{
    state.historyLimit = (state.historyLimit || 20)+20;
    const done=contextualBusy($("#moreHistory"),"Chargement…");
    try {await exchange("sync",{history_limit:state.historyLimit});renderTrades();}catch(error){toast(friendlyError(error));}finally{done();}
  });
  $$("[data-collection-tab]").forEach(tab=>tab.addEventListener("keydown",event=>{
    if (!["ArrowLeft","ArrowRight","Home","End"].includes(event.key)) return;
    event.preventDefault();const tabs=$$("[data-collection-tab]");const target=event.key==="Home"?tabs[0]:event.key==="End"?tabs.at(-1):tabs[(tabs.indexOf(tab)+1)%tabs.length];target.click();target.focus();
  }));

  document.addEventListener("click", async event => {
    if (state.busy) return;
    const targetPicker=event.target.closest("[data-target-picker]");
    if(targetPicker){state.targetKind=targetPicker.dataset.targetPicker;state.targetCardId=targetPicker.dataset.targetCard;state.selectionSide="target";$("#selectionTitle").textContent=state.targetKind==="legendary"?"Choisir mon défi":"Choisir une cible";$("#selectionSearch").value="";renderSelectionGallery();selectionDialog.showModal();return;}
    const pick = event.target.closest("[data-pick-card]");
    if (pick) return openSelectionGallery(pick.dataset.pickCard);
    const selectedCopy = event.target.closest("[data-select-copy]");
    if (selectedCopy && state.selectionSide) {
      if (selectedCopy.dataset.preventClick) { delete selectedCopy.dataset.preventClick; return; }
      if (!selectionCards().some(card=>card.id===selectedCopy.dataset.selectCopy)) {renderSelectionGallery();toast("Cette carte n’est plus disponible.");return;}
      if(state.selectionSide==="target"){
        const select=$("#"+(state.targetKind==="legendary"?"legendaryChoiceSelect":state.targetKind+"TargetSelect"));select.value=selectedCopy.dataset.selectCopy;select.dispatchEvent(new Event("change"));selectionDialog.close();return;
      }
      $("#"+state.selectionSide+"CardSelect").value = selectedCopy.dataset.selectCopy;
      renderTradeSelection(); selectionDialog.close(); return;
    }
    const resume = event.target.closest("[data-resume-opening]");
    if (resume) return resumeOpening(resume.dataset.resumeOpening);
    const stack = event.target.closest("[data-stack-template]");
    if (stack) return openStack(stack.dataset.stackTemplate,stack.dataset.stackFinish);
    const copy = event.target.closest("[data-copy-id]");
    if (copy && state.stackSelection) {
      if (copy.dataset.preventClick) { delete copy.dataset.preventClick; return; }
      const copies = stackCopies(state.stackSelection.template,state.stackSelection.finish);
      const index = copies.findIndex(card=>card.id===copy.dataset.copyId);
      if (index < 0) return;
      stackDialog.close(); state.viewerSession++; state.viewerCards = copies; state.viewerIndex = index;
      return openCard(copies[index],true);
    }
    const complete = event.target.closest("[data-complete-card]");
    if (complete) {
      if (!await confirmAction("Défi réalisé ?", "Vous l’avez fait ? La carte quitte la table et reste dans « Déjà vues ».")) return;
      const ghost = captureCardGhost(cardDialog.open ? "#viewerCard .game-card" : `#activeCards [data-card-id="${complete.dataset.completeCard}"] .game-card`);
      const done = contextualBusy(complete,"Validation…");
      try {
        await exchange("complete_card", {card_id:complete.dataset.completeCard});
        cardDialog.close(); render(); feedback("card");
        acknowledgeCard(ghost,"complete","Défi réalisé");
        toast("Défi réalisé · découverte conservée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { done(); }
      return;
    }
    if (event.target.closest("[data-go-collection]")) return setView("collection");
    if (event.target.closest("[data-viewer-prev]")) return moveViewer(-1);
    if (event.target.closest("[data-viewer-next]")) return moveViewer(1);
    const booster = event.target.closest("[data-booster-id]");
    if (booster) return openBooster(booster.dataset.boosterId);
    const cardButton = event.target.closest(".card-button");
    if (cardButton) {
      if (cardButton.dataset.preventClick) { delete cardButton.dataset.preventClick; return; }
      return openCard(findCard(cardButton));
    }
    const nextReveal = event.target.closest("[data-reveal-next]");
    if (nextReveal) {
      return advanceReveal();
    }
    const finishButton = event.target.closest("[data-reveal-finish]");
    if (finishButton) {
      return finishReveal();
    }
    const managementMode = event.target.closest("[data-management-mode]");
    if (managementMode) { state.managementMode = managementMode.dataset.managementMode; renderTradeSelection(); return; }
    const exchangeCard = event.target.closest("[data-exchange-card]");
    if (exchangeCard) {
      state.managementMode = "trade"; cardDialog.close(); setView("trade");
      $("#offeredCardSelect").value = exchangeCard.dataset.exchangeCard;
      renderTradeSelection();
      return;
    }
    const manageCard = event.target.closest("[data-give-card],[data-destroy-card]");
    if (manageCard) {
      const giving = Boolean(manageCard.dataset.giveCard);
      const id = manageCard.dataset.giveCard || manageCard.dataset.destroyCard;
      await performCardManagement(giving, id);
      return;
    }
    const useSpell = event.target.closest("[data-use-spell]");
    if (useSpell) {
      const card = state.data.my_cards.find(item=>item.id===useSpell.dataset.useSpell);
      const targetId = $("#spellTargetSelect")?.value;
      const target = card && spellTargets(card).find(item=>item.id===targetId);
      if (!card || !target) return toast(errorMessages.spell_unavailable);
      if (!await confirmAction(`Lancer ${card.title} ?`, `${card.challenge} Cible : ${target.title}. Le sortilège sera consommé.`)) return;
      const ghost = captureCardGhost();
      const done = contextualBusy(useSpell,"Lancement…");
      try {
        await exchange("use_spell",{spell_card_id:card.id,target_card_id:target.id});
        cardDialog.close(); render();
        if (card.spell_code !== "destructo") setView("today");
        acknowledgeCard(ghost,"spell",`${card.title} appliqué`); feedback("card");
        toast(card.spell_code === "destructo" ? "Exemplaire adverse détruit · découverte conservée." : `${card.title} appliqué au rituel.`);
      } catch (error) { toast(friendlyError(error)); }
      finally { done(); }
      return;
    }
    const useJoker = event.target.closest("[data-use-joker]");
    if (useJoker) {
      const target = $("#jokerTargetSelect")?.value;
      if (!target) return toast("Aucune carte active à annuler.");
      if (!await confirmAction("Un petit contre-sort ?", "Ce Joker annule la carte active choisie. Les deux cartes quittent le jeu.")) return;
      const done = contextualBusy(useJoker,"Annulation…");
      try {
        await exchange("use_joker", { joker_card_id: useJoker.dataset.useJoker, target_card_id: target });
        cardDialog.close();
        render();
        setView("today");
        toast("La carte active a été annulée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { done(); }
      return;
    }
    const activate = event.target.closest("[data-activate-card]");
    if (activate) {
      if (!await confirmAction("On la joue ?", "Cette carte rejoint votre table pour 24 heures.")) return;
      const ghost = captureCardGhost();
      const done = contextualBusy(activate,"Activation…");
      try {
        await exchange("activate_card", { card_id: activate.dataset.activateCard, ...($("#legendaryChoiceSelect") ? {choice_template_id:$("#legendaryChoiceSelect").value} : {}) });
        cardDialog.close();
        render();
        setView("today");
        flyToTable(ghost, activate.dataset.activateCard);
        toast("Challenge activé pour 24 h.");
      } catch (error) { toast(friendlyError(error)); }
      finally { done(); }
      return;
    }
    const tradeAction = event.target.closest("[data-trade-action]");
    if (tradeAction) {
      const done = contextualBusy(tradeAction,"Validation…");
      try {
        const action = tradeAction.dataset.tradeAction;
        if (action === "cancel") await exchange("trade_cancel", { trade_id: tradeAction.dataset.tradeId });
        else await exchange("trade_respond", { trade_id: tradeAction.dataset.tradeId, decision: action });
        render();
        if (action === "accept") celebrateTrade();
        toast(action === "accept" ? "Échange accepté." : action === "reject" ? "Échange refusé." : "Proposition annulée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { done(); }
    }
  });

  $("#proposeTradeButton").addEventListener("click", async () => {
    if (state.busy) return;
    const offered = $("#offeredCardSelect").value;
    const requested = $("#requestedCardSelect").value;
    if (state.managementMode !== "trade") return performCardManagement(state.managementMode === "give", offered);
    if (!offered || !requested) return toast("Choisis les deux cartes de l’échange.");
    const done = contextualBusy($("#proposeTradeButton"),"Envoi…");
    try {
      await exchange("trade_propose", { offered_card_id: offered, requested_card_id: requested });
      render();
      toast("Proposition envoyée.");
    } catch (error) { toast(friendlyError(error)); }
    finally { done(); }
  });

  $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.closeDialog);
    if (dialog === destroyDialog && destruction?.committing) return;
    if (dialog === boosterDialog && state.opening && !state.revealedCards.length) return toast("Tes cartes arrivent…");
    dialog.close();
  }));
  boosterDialog.addEventListener("close", () => {
    boosterDialog._swipeCleanup?.();
    state.revealQueue = [];
    clearTimeout(openingTimer);
    $("#boosterStage").classList.remove("awaiting", "unsealing", "revealed");
    packGesture?.reset();
    $("#sealedPack").hidden = false;
    state.selectedBooster = null;
    state.opening = false;
    if (state.data) renderToday();
  });
  boosterDialog.addEventListener("cancel", event => {
    if (state.opening && !state.revealedCards.length) event.preventDefault();
  });
  cardDialog.addEventListener("close", () => { state.viewerSession++; state.viewerMoving = false; $("#cardDialogContent").inert = false; $("#cardDialogContent")._swipeCleanup?.(); });
  $("#selectionSearch").addEventListener("input",renderSelectionGallery);
  selectionDialog.addEventListener("close",()=>{const side=state.selectionSide;state.selectionSide=null;(side==="target"?$("[data-target-picker=\""+state.targetKind+"\"]"):$("#"+side+"CardPicker"))?.focus();});
  stackDialog.addEventListener("close", () => { state.stackSelection = null; });
  document.addEventListener("toggle", event => {
    const section = event.target;
    if (!section.matches?.("details[data-album-edition]")) return;
    if (section.open) state.collapsedEditions.delete(section.dataset.albumEdition); else state.collapsedEditions.add(section.dataset.albumEdition);
  },true);
  destroyDialog.addEventListener("cancel", event => { if (destruction?.committing) event.preventDefault(); });
  destroyDialog.addEventListener("close", () => { destruction = null; cutGesture?.reset(); $$(".blade-trail").forEach(trail=>trail.remove()); });
  document.addEventListener("keydown", event => {
    if ($("#confirmDialog").open || destroyDialog.open || state.busy || event.target.closest?.("input,select,textarea,[contenteditable]")) return;
    if (cardDialog.open && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); moveViewer(event.key === "ArrowRight" ? 1 : -1); }
    if (boosterDialog.open && state.revealedCards.length && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) { event.preventDefault(); advanceReveal(0, ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1); }
  });
  document.addEventListener("visibilitychange", () => { document.body.classList.toggle("motion-paused",document.hidden); if (!document.hidden) sync({ quiet: true }); });
  window.addEventListener("offline",()=>setConnectionStatus("Hors connexion"));
  window.addEventListener("online",()=>sync());
  setInterval(updateTimers, 1000);
  startLegendaryCycle();
  setupBoosterGesture();
  cutGesture = window.CardBoosterGesture.slice(destroyDialog, {
    isLocked: () => !destroyDialog.open || !destruction || destruction.committing,
    getCardRect: () => $("#shredPreview").getBoundingClientRect(),
    onTrace: bladeTrace,
    onCut: (a,b,rect) => {
      const point = p => ({x:(p.x-rect.left)/rect.width*100,y:(p.y-rect.top)/rect.height*100});
      const first=point(a),last=point(b);
      destruction.cuts.push([first,last]);
      $("#shredPreview").insertAdjacentHTML("beforeend", `<svg class="cut-scar" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="${first.x}" y1="${first.y}" x2="${last.x}" y2="${last.y}"/></svg>`);
      $$("#cutMeter i").forEach((dot,i)=>dot.classList.toggle("cut",i<destruction.cuts.length));
      $("#destroyStatus").textContent = `${destruction.cuts.length} / 3 · Sa découverte reste dans « Déjà vues ».`;
      if (!reducedMotion.matches) $("#shredPreview").animate([{transform:"rotate(-1deg)"},{transform:"rotate(1deg)"},{transform:"none"}],{duration:120});
      feedback("card");
      if (destruction.cuts.length >= 3) commitDestruction();
    }
  });
  window.CardBoosterGesture.preventDoubleTapZoom(document);

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("service-worker.js").then(registration=>{
    const activate = () => {if (registration.waiting && !state.opening && !state.busy && !boosterDialog.open && !destroyDialog.open) registration.waiting.postMessage({type:"ACTIVATE"});};
    registration.addEventListener("updatefound",()=>registration.installing?.addEventListener("statechange",activate));
    document.addEventListener("visibilitychange",activate);for(const dialog of document.querySelectorAll("dialog"))dialog.addEventListener("close",activate);activate();
  }).catch(()=>{});
  const lastRole = storage.get("les-cartes-last-role");
  if (names[lastRole] && storage.get(tokenKey(lastRole))) selectRole(lastRole);
})();
