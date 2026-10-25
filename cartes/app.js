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
  const finishSymbol = finish => ({ standard: "●", full_art: "◇", foil: "✦", full_art_foil: "✺" })[finish] || "●";

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
    trade_unavailable: "Cet échange n’est plus disponible.",
    no_active_card: "Aucune carte n’est encore publiée.",
    invalid_request: "La demande n’a pas pu être comprise.",
    network_error: "Connexion interrompue. Vérifie ton réseau puis réessaie.",
    timeout: "La connexion prend trop de temps. Réessaie.",
    invalid_trade_decision: "Choisis d’accepter ou de refuser cet échange."
  };

  function friendlyError(error) {
    const text = String(error?.message || error || "Erreur inconnue");
    const key = Object.keys(errorMessages).find(candidate => text.includes(candidate));
    return key ? errorMessages[key] : "Connexion impossible pour le moment. Réessaie dans un instant.";
  }

  async function exchange(action = "sync", payload = {}, accessCode = null) {
    if (!state.role || !state.token) throw new Error("pairing_required");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let data;
    try {
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/tcg_exchange`, {
        method: "POST", signal: controller.signal,
        headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ p_role: state.role, p_token: state.token, p_access_code: accessCode, p_action: action, p_payload: payload })
      });
      data = await response.json();
      if (!response.ok) throw new Error(data.message || `HTTP ${response.status}`);
    } catch (error) {
      if (error.name === "AbortError") throw new Error("timeout");
      if (error instanceof TypeError) throw new Error("network_error");
      throw error;
    } finally { clearTimeout(timeout); }
    if (data?.server_now) state.serverOffset = new Date(data.server_now).getTime() - Date.now();
    if (!data?.released) state.data = data;
    return data;
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

  function finishLabel(finish) {
    return ({
      standard: "Commune", full_art: "Full art", foil: "Foil", full_art_foil: "Full art · Foil"
    })[finish] || "Commune";
  }

  const isHalloween = card => card.edition === "halloween_2026";
  const editionLabel = edition => edition === "halloween_2026" ? "Halloween 2026" : "Édition 01";
  function halloweenActive() {
    const now = serverNow().getTime();
    return now >= Date.parse("2026-10-29T00:00:00+01:00") && now < Date.parse("2026-11-02T00:00:00+01:00");
  }

  function cardMarkup(card, options = {}) {
    const finish = card.finish || card.finish_tier || "standard";
    const seed = Number(card.wear_seed ?? hashString(card.template_id || card.title));
    const wear = Math.abs(seed) % 5;
    const timer = options.timer ? `<span class="card-timer" data-until="${escapeHtml(options.timer)}">${duration(options.timer)}</span>` : "";
    return `<article class="game-card palette-${escapeHtml(card.palette || "couple")} finish-${escapeHtml(finish)}${isHalloween(card) ? " edition-halloween" : ""}${options.compact ? " compact" : ""}${options.muted ? " muted" : ""}" data-wear="${wear}">
      <div class="card-art" aria-hidden="true"></div><div class="card-engraving" aria-hidden="true"></div><div class="card-shine" aria-hidden="true"></div>
      <div class="card-top"><span>${escapeHtml(card.category)}</span><i>✦</i></div>
      ${timer}<div class="card-copy${card.title.length > 34 ? " long-title" : ""}"><h4>${escapeHtml(card.title)}</h4><span class="card-divider" aria-hidden="true">◆</span><p>${escapeHtml(card.challenge || "Carte déjà découverte.")}</p></div>
      <div class="card-footer"><span>${escapeHtml(finishLabel(finish))}</span><i title="${escapeHtml(finishLabel(finish))}" aria-label="${escapeHtml(finishLabel(finish))}">${finishSymbol(finish)}</i><span>${isHalloween(card) ? "Halloween" : "Éd. 01"}</span></div>
    </article>`;
  }

  function hashString(value) {
    return [...String(value || "")].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
  }

  function empty(message) {
    return `<p class="empty-state">${escapeHtml(message).replace(/&lt;br&gt;/g, "<br>")}</p>`;
  }

  function attachFoilMotion(root = document) {
    root.querySelectorAll?.(".game-card").forEach(card => {
      if (card.dataset.foilReady) return;
      card.dataset.foilReady = "1";
      let rect, frame, started;
      const tile = card.closest(".card-button");
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
    return `<button class="card-button${count > 1 ? " stacked-card" : ""}" type="button" aria-label="Voir ${escapeHtml(card.title)}${count > 1 ? `, ${count} exemplaires` : ""}" data-card-id="${escapeHtml(card.id || "")}" data-template-id="${escapeHtml(card.template_id || "")}" style="--stack-depth:${Math.min(3, count-1)}">${cardMarkup(card, { ...options, timer: null })}${count > 1 ? `<span class="stack-count">×${count}</span>` : ""}${fresh ? '<span class="new-card-badge">✧ Nouvelle</span>' : ""}${options.timer ? `<span class="tile-timer" data-until="${escapeHtml(options.timer)}">${duration(options.timer)}</span>` : ""}</button>`;
  }

  function groupCards(cards) {
    const groups = new Map();
    for (const card of [...cards].sort((a,b) => new Date(a.expires_at) - new Date(b.expires_at))) {
      const key = `${card.template_id || card.id}:${card.finish || card.finish_tier || "standard"}`;
      if (groups.has(key)) groups.get(key).stack_count++;
      else groups.set(key, { ...card, stack_count: 1 });
    }
    return [...groups.values()];
  }

  function renderToday() {
    const data = state.data;
    $("#heroEdition").textContent = halloweenActive() ? "Spéciale Halloween × Édition 01" : "Édition 01 — Nous deux";
    $("#heroContents").textContent = "3 cartes";
    $("#todayView").classList.toggle("has-booster", Boolean(data.boosters.length));
    $("#dailyHero").classList.toggle("no-pack", !data.boosters.length);
    $("#navBoosterBadge").hidden = !data.boosters.length;
    $("#navBoosterBadge").textContent = data.boosters.length;
    $("#todayDate").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(serverNow());
    $("#nextBoosterCounter").textContent = nextBoosterDuration();
    $("#collectionCount").textContent = data.my_cards.length;
    $("#knownCount").textContent = data.known_cards.length;
    $("#boosterCount").textContent = data.boosters.length;
    $("#activeCount").textContent = data.active_cards.length;

    putMarkup("#boosterList", data.boosters.length ? data.boosters.map(booster => `
      <button class="booster-item" type="button" data-booster-id="${escapeHtml(booster.id)}">
        <span class="mini-pack${isHalloween(booster) ? " pack-halloween" : ""}" aria-hidden="true"><i>${isHalloween(booster) ? "☾" : "✦"}</i><strong>Les Cartes</strong><em>à deux.</em><small>${isHalloween(booster) ? "HALLOWEEN" : "ÉDITION 01"} · 3 CARTES</small></span>
        <span class="booster-copy"><span>POUR ${escapeHtml(name(state.role))}</span><strong>Ouvrir ce booster <b>↗</b></strong><small>3 cartes · expire dans <b data-until="${escapeHtml(booster.expires_at)}">${duration(booster.expires_at)}</b></small></span>
      </button>`).join("") : `<button class="text-button" type="button" data-go-collection>Ma collection →</button>`);

    putMarkup("#activeCards", data.active_cards.length
      ? data.active_cards.map(card => buttonCard(card, { timer: card.active_until })).join("")
      : `<div class="table-empty"><span aria-hidden="true">✧</span><p>Une carte à vivre ?</p><button class="text-button" type="button" data-go-collection>Choisir dans ma collection →</button></div>`);
  }

  function renderCollection() {
    const available = state.data.my_cards.filter(card => card.status === "available");
    $("#availableTabCount").textContent = available.length;
    const catalogueTotal = Number(state.data.catalogue_total || 80);
    $("#knownTabCount").textContent = `${state.data.known_cards.length}/${catalogueTotal}`;
    $("#collectionNote").textContent = state.collectionTab === "available"
      ? "7 jours pour les nouveaux tirages · échéance sous chaque carte."
      : "Les inconnues gardent leur secret.";

    const cards = collectionCards();
    const edition = $("#editionFilter").value;
    const detailFilter = state.category !== "all" || $("#cardSearch").value.trim() || $("#finishFilter").value !== "all";
    const filterCount = Number(state.category !== "all") + Number(Boolean($("#cardSearch").value.trim())) + Number($("#finishFilter").value !== "all") + Number(edition !== "all");
    $("#filterCount").textContent = filterCount;
    $("#filterCount").hidden = !filterCount;
    if (state.collectionTab === "known" && state.data.catalogue_slots && !detailFilter) {
      const known = new Map(cards.map(card => [card.template_id, card]));
      putMarkup("#collectionGrid", (state.data.editions || []).filter(item => edition === "all" || item.id === edition).map(item => `
        <section class="album-edition" aria-label="${editionLabel(item.id)}">
          <header><div><span class="eyebrow">${item.id === "halloween_2026" ? "Du 29 octobre au 1er novembre" : "La collection originale"}</span><h3>${editionLabel(item.id)}</h3></div><b>${item.discovered}/${item.total}</b></header>
          <div class="album-slots">${state.data.catalogue_slots.filter(slot => slot.edition === item.id).map(slot => {
            const card = known.get(slot.template_id);
            return card ? buttonCard({ ...card, id: "", finish: card.finish_tier || "standard", wear_seed: hashString(card.template_id) }, { muted: Number(card.owned_count) === 0 })
              : `<div class="empty-card-slot${item.id === "halloween_2026" ? " seasonal-slot" : ""}" role="img" aria-label="Emplacement ${slot.number} : carte inconnue"><span>✧</span><strong>À découvrir</strong><small>${String(slot.number).padStart(2, "0")}</small></div>`;
          }).join("")}</div>
        </section>`).join(""));
      $("#collectionOwner").textContent = `L’album de ${name(state.role)}`;
      return;
    }
    putMarkup("#collectionGrid", cards.length
      ? cards.map(card => state.collectionTab === "available"
        ? buttonCard(card, { timer: card.expires_at })
        : buttonCard({ ...card, id: "", finish: card.finish_tier || "standard", wear_seed: hashString(card.template_id) }, { muted: Number(card.owned_count) === 0 })
      ).join("")
      : empty((detailFilter || edition !== "all") ? "Aucune carte ne correspond à ces filtres." : state.collectionTab === "available" ? "Ouvre un booster pour commencer." : "À découvrir au fil des boosters."));
    $("#collectionOwner").textContent = `${state.collectionTab === "known" ? "L’album" : "La réserve"} de ${name(state.role)}`;
  }

  function collectionCards() {
    const source = state.collectionTab === "available" ? groupCards(state.data.my_cards.filter(card => card.status === "available")) : state.data.known_cards;
    const query = $("#cardSearch").value.trim().toLocaleLowerCase("fr");
    const finish = $("#finishFilter").value;
    const edition = $("#editionFilter").value;
    return source.filter(card => (state.category === "all" || card.palette === state.category)
      && (edition === "all" || (card.edition || "edition_01") === edition)
      && (finish === "all" || (card.finish || card.finish_tier) === finish)
      && (!query || `${card.title} ${card.category}`.toLocaleLowerCase("fr").includes(query)));
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
      <div class="trade-pair"><div class="trade-mini"><span>${escapeHtml(trade.offered.category)}</span><b>${escapeHtml(trade.offered.title)}</b></div><span>⇄</span><div class="trade-mini"><span>${escapeHtml(trade.requested.category)}</span><b>${escapeHtml(trade.requested.title)}</b></div></div>${actions}
    </article>`;
  }

  function renderTrades() {
    const mine = state.data.my_cards.filter(card => card.status === "available");
    const partner = state.data.partner_cards.filter(card => card.status === "available");
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
    $("#pendingTrades").innerHTML = pending.length ? pending.map(tradeMarkup).join("") : empty("Aucune proposition en attente.");
    $("#tradeHistory").innerHTML = history.length ? history.map(tradeMarkup).join("") : empty("Les échanges terminés apparaîtront ici.");
  }

  function renderTradeSelection() {
    const mine = state.data.my_cards.filter(card => card.status === "available");
    const partner = state.data.partner_cards.filter(card => card.status === "available");
    for (const [select, preview, cards] of [["offeredCardSelect","offeredPreview",mine],["requestedCardSelect","requestedPreview",partner]]) {
      const selected = cards.find(card => card.id === $("#"+select).value);
      putMarkup("#"+preview, selected ? cardMarkup(selected) : `<div class="trade-empty-card"><span>＋</span><b>${cards.length ? "Choisir" : "Aucune carte"}</b></div>`);
      $("#"+select).disabled = !cards.length;
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

  function render() {
    if (!state.data) return;
    $("#currentRole").textContent = name(state.role);
    $("#presenceDot").classList.toggle("online", Boolean(state.data.partner_online));
    $("#seasonBanner").hidden = serverNow().getTime() >= new Date("2026-11-02T00:00:00+01:00").getTime();
    $("#seasonHeading").textContent = halloweenActive() ? "Halloween" : "Halloween bientôt";
    $("#seasonCopy").textContent = "29 oct.–1 nov. · 10 exclusives";
    $("#seasonBanner").setAttribute("aria-label", halloweenActive() ? "Saison Halloween en cours" : "Saison Halloween à venir");
    renderToday();
    renderCollection();
    renderTrades();
    attachFoilMotion();
    updateTimers();
  }

  function updateTimers() {
    $("#nextBoosterCounter").textContent = nextBoosterDuration();
    $$('[data-until]').forEach(element => element.textContent = duration(element.dataset.until));
  }

  async function sync({ quiet = false } = {}) {
    if (!state.role || !state.data || state.syncing || state.busy || state.opening) return;
    state.syncing = true;
    $("#refreshButton").classList.add("syncing");
    try {
      await exchange("sync");
      render();
    } catch (error) {
      if (!quiet) toast(friendlyError(error));
      if (String(error?.message).includes("device_not_authorized") || String(error?.message).includes("pairing_required")) showLogin();
    } finally {
      state.syncing = false;
      $("#refreshButton").classList.remove("syncing");
    }
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
    if (state.role !== role) state.newTemplates.clear();
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findCard(element) {
    const id = element.closest("[data-card-id]")?.dataset.cardId;
    const templateId = element.closest("[data-template-id]")?.dataset.templateId;
    return [...state.data.my_cards, ...state.data.partner_cards, ...state.data.active_cards, ...state.data.known_cards]
      .find(card => (id && card.id === id) || (!id && templateId && card.template_id === templateId));
  }

  function openCard(card, keepList = false) {
    if (!card) return;
    if (!keepList) {
      state.viewerSession++;
      state.viewerCards = state.view === "collection" ? collectionCards() : state.data.active_cards;
      state.viewerIndex = state.viewerCards.findIndex(item => card.id ? item.id === card.id : item.template_id === card.template_id);
      if (state.viewerIndex < 0) { state.viewerCards = [card]; state.viewerIndex = 0; }
    }
    const isMine = card.id && state.data.my_cards.some(owned => owned.id === card.id);
    const isJoker = card.card_type === "joker";
    const canActivate = isMine && card.status === "available" && !isJoker;
    const active = card.active_until && new Date(card.active_until) > serverNow();
    const ownership = isMine ? "Dans ta main" : card.owner_role ? `Carte de ${name(card.owner_role)}` : Number(card.owned_count) ? "Dans ta collection" : "Déjà découverte";
    const jokerTargets = isJoker && isMine
      ? state.data.active_cards.filter(target => target.owner_role === state.data.partner_role)
      : [];
    const jokerAction = isJoker && isMine && card.status === "available"
      ? jokerTargets.length
        ? `<label class="joker-target">Carte active à annuler<select id="jokerTargetSelect">${jokerTargets.map(target => `<option value="${escapeHtml(target.id)}">${escapeHtml(target.title)}</option>`).join("")}</select></label><button class="primary-button" type="button" data-use-joker="${escapeHtml(card.id)}">Utiliser ce Joker</button>`
        : `<p>Aucune carte active de ${escapeHtml(name(state.data.partner_role))} ne peut être annulée pour l’instant.</p>`
      : "";
    $("#cardDialogContent").innerHTML = `<div class="viewer-card" id="viewerCard">${cardMarkup(card, { timer: card.active_until || (card.status === "available" ? card.expires_at : null), muted: !card.id })}</div>
      <div class="viewer-nav"><button class="round-button" data-viewer-prev aria-label="Carte précédente" ${state.viewerIndex === 0 ? "disabled" : ""}>←</button><span>${state.viewerIndex + 1} / ${state.viewerCards.length}<small>Glisse pour feuilleter</small></span><button class="round-button" data-viewer-next aria-label="Carte suivante" ${state.viewerIndex >= state.viewerCards.length - 1 ? "disabled" : ""}>→</button></div>
      <div class="card-dialog-copy"><span class="eyebrow">${escapeHtml(ownership)} · ${escapeHtml(finishLabel(card.finish || card.finish_tier || "standard"))}</span><h2>${escapeHtml(card.title)}</h2><p>${escapeHtml(card.challenge)}</p>
      ${jokerAction}${canActivate ? `<button class="primary-button" type="button" data-activate-card="${escapeHtml(card.id)}">Activer cette carte · 24 h</button>` : active ? `<p>Cette carte reste active encore ${duration(card.active_until)}.</p>` : ""}
      ${isMine && card.status === "available" ? `<div class="card-options" aria-label="Gérer cet exemplaire"><button type="button" data-exchange-card="${escapeHtml(card.id)}"><span aria-hidden="true">⇄</span>Échanger</button><button type="button" data-give-card="${escapeHtml(card.id)}"><span aria-hidden="true">↗</span>Donner</button><button type="button" class="destroy-option" data-destroy-card="${escapeHtml(card.id)}"><span aria-hidden="true">×</span>Détruire</button></div>` : ""}</div>`;
    if (!cardDialog.open) cardDialog.showModal();
    attachFoilMotion(cardDialog);
    setupSwipe($("#cardDialogContent"), (direction, dx) => moveViewer(direction, dx), $("#viewerCard"));
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

  function captureCardGhost() {
    if (reducedMotion.matches) return null;
    const source = $("#viewerCard .game-card");
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
    setBusy(true);
    try {
      await exchange("give_card", { card_id: id });
      cardDialog.close(); render();
      toast(`Carte donnée à ${partner}.`);
    } catch (error) { toast(friendlyError(error)); }
    finally { setBusy(false); }
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
    session.committing = true; setBusy(true);
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
    } finally { setBusy(false); }
  }

  function openBooster(id) {
    clearTimeout(openingTimer);
    state.selectedBooster = id;
    state.opening = false;
    state.revealedCards = [];
    state.revealIndex = 0;
    state.revealMoving = false;
    state.revealQueue = [];
    boosterDialog._swipeCleanup?.();
    setupSwipe(boosterDialog, (direction, dx, dy) => advanceReveal(dx, direction, dy), () => $("#revealFront"), {
      axis: "both", includeButtons: true,
      enabled: () => boosterDialog.open && !$("#revealSlot").hidden && state.revealedCards.length > 0
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
    $("#revealSlot").innerHTML = `<div class="reveal-stack" id="revealStack">${Array.from({length: depth}, (_, i) => `<div class="card-back" style="--depth:${depth-i}" aria-hidden="true"></div>`).join("")}<div class="reveal-front" id="revealFront">${cardMarkup(card)}${state.newTemplates.has(card.template_id) ? '<span class="reveal-new">✧ Nouvelle découverte</span>' : ""}</div></div><div class="reveal-controls"><div class="reveal-dots" aria-label="Carte ${state.revealIndex + 1} sur ${state.revealedCards.length}">${state.revealedCards.map((_, i) => `<i class="${i === state.revealIndex ? "selected" : ""}"></i>`).join("")}</div><button class="primary-button" type="button" ${last ? "data-reveal-finish" : "data-reveal-next"}>${last ? "Ranger mes 3 cartes →" : "Carte suivante →"}</button></div>`;
    $("#boosterStatus").textContent = `${state.revealIndex + 1} / 3 · ${finishLabel(card.finish)} · Glisse dans un sens ou l’autre`;
    $("#revealSlot").classList.toggle("rare-reveal", card.finish !== "standard");
    if (card.finish !== "standard") feedback("rare");
    attachFoilMotion($("#revealSlot"));
  }

  async function advanceReveal(dx = -1, direction = 1, dy = 0) {
    if ($("#revealSlot").hidden || !boosterDialog.open) return;
    if (state.revealMoving) { if (state.revealQueue.length < 6) state.revealQueue.push([dx, direction, dy]); return; }
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

  function finishReveal() {
    boosterDialog.close();
    setView("collection");
    toast("Tes 3 cartes sont dans ta collection.");
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
      state.revealedCards = state.data.my_cards
        .filter(candidate => candidate.booster_id === boosterId)
        .sort((a, b) => ({ energy: 0, challenge: 1, joker: 2 }[a.card_type] ?? 1) - ({ energy: 0, challenge: 1, joker: 2 }[b.card_type] ?? 1));
      state.revealIndex = 0;
      for (const card of state.revealedCards) if (!previouslyKnown.has(card.template_id)) state.newTemplates.add(card.template_id);
      if (state.revealedCards.length !== 3) throw new Error("Les cartes sont enregistrées. Actualise ta collection.");
      $("#openPackButton").hidden = true;
      $("#boosterStatus").textContent = "✦";
      feedback("rare");
      openingTimer = setTimeout(() => {
        if (!boosterDialog.open) return;
        $("#sealedPack").hidden = true;
        $("#boosterStage").classList.remove("unsealing", "awaiting");
        $("#boosterStage").classList.add("revealed");
        $("#revealSlot").hidden = false;
        renderRevealedCard();
      }, reducedMotion.matches ? 0 : Math.max(0, 760 - (performance.now() - motionStarted)));
      render();
    } catch (error) {
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
  for (const id of ["cardSearch", "finishFilter", "editionFilter"]) $("#" + id).addEventListener(id === "cardSearch" ? "input" : "change", () => { renderCollection(); attachFoilMotion(); });
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
  $("#refreshButton").addEventListener("click", () => sync());
  $$('[data-nav]').forEach(button => button.addEventListener("click", () => setView(button.dataset.nav)));
  $$('[data-collection-tab]').forEach(button => button.addEventListener("click", () => {
    state.collectionTab = button.dataset.collectionTab;
    $$('[data-collection-tab]').forEach(tab => { tab.classList.toggle("selected", tab === button); tab.setAttribute("aria-selected", String(tab === button)); });
    renderCollection();
    attachFoilMotion();
  }));

  document.addEventListener("click", async event => {
    if (state.busy) return;
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
    const useJoker = event.target.closest("[data-use-joker]");
    if (useJoker) {
      const target = $("#jokerTargetSelect")?.value;
      if (!target) return toast("Aucune carte active à annuler.");
      if (!await confirmAction("Un petit contre-sort ?", "Ce Joker annule la carte active choisie. Les deux cartes quittent le jeu.")) return;
      setBusy(true);
      try {
        await exchange("use_joker", { joker_card_id: useJoker.dataset.useJoker, target_card_id: target });
        cardDialog.close();
        render();
        setView("today");
        toast("La carte active a été annulée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { setBusy(false); }
      return;
    }
    const activate = event.target.closest("[data-activate-card]");
    if (activate) {
      if (!await confirmAction("On la joue ?", "Cette carte rejoint votre table pour 24 heures.")) return;
      const ghost = captureCardGhost();
      setBusy(true);
      try {
        await exchange("activate_card", { card_id: activate.dataset.activateCard });
        cardDialog.close();
        render();
        setView("today");
        flyToTable(ghost, activate.dataset.activateCard);
        toast("Challenge activé pour 24 h.");
      } catch (error) { toast(friendlyError(error)); }
      finally { setBusy(false); }
      return;
    }
    const tradeAction = event.target.closest("[data-trade-action]");
    if (tradeAction) {
      setBusy(true);
      try {
        const action = tradeAction.dataset.tradeAction;
        if (action === "cancel") await exchange("trade_cancel", { trade_id: tradeAction.dataset.tradeId });
        else await exchange("trade_respond", { trade_id: tradeAction.dataset.tradeId, decision: action });
        render();
        if (action === "accept") celebrateTrade();
        toast(action === "accept" ? "Échange accepté." : action === "reject" ? "Échange refusé." : "Proposition annulée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { setBusy(false); }
    }
  });

  $("#proposeTradeButton").addEventListener("click", async () => {
    const offered = $("#offeredCardSelect").value;
    const requested = $("#requestedCardSelect").value;
    if (state.managementMode !== "trade") return performCardManagement(state.managementMode === "give", offered);
    if (!offered || !requested) return toast("Choisis les deux cartes de l’échange.");
    setBusy(true);
    try {
      await exchange("trade_propose", { offered_card_id: offered, requested_card_id: requested });
      render();
      toast("Proposition envoyée.");
    } catch (error) { toast(friendlyError(error)); }
    finally { setBusy(false); }
  });

  $$('[data-close-dialog]').forEach(button => button.addEventListener("click", () => {
    const dialog = document.getElementById(button.dataset.closeDialog);
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
  });
  boosterDialog.addEventListener("cancel", event => {
    if (state.opening && !state.revealedCards.length) event.preventDefault();
  });
  cardDialog.addEventListener("close", () => { state.viewerSession++; state.viewerMoving = false; $("#cardDialogContent").inert = false; $("#cardDialogContent")._swipeCleanup?.(); });
  destroyDialog.addEventListener("cancel", event => { if (destruction?.committing) event.preventDefault(); });
  destroyDialog.addEventListener("close", () => { destruction = null; cutGesture?.reset(); $$(".blade-trail").forEach(trail=>trail.remove()); });
  document.addEventListener("keydown", event => {
    if ($("#confirmDialog").open || destroyDialog.open || state.busy) return;
    if (cardDialog.open && ["ArrowLeft", "ArrowRight"].includes(event.key)) { event.preventDefault(); moveViewer(event.key === "ArrowRight" ? 1 : -1); }
    if (boosterDialog.open && state.revealedCards.length && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(event.key)) { event.preventDefault(); advanceReveal(0, ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1 : 1); }
  });
  document.addEventListener("visibilitychange", () => document.hidden || sync({ quiet: true }));
  setInterval(updateTimers, 1000);
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

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("service-worker.js");
  const lastRole = storage.get("les-cartes-last-role");
  if (names[lastRole] && storage.get(tokenKey(lastRole))) selectRole(lastRole);
})();
