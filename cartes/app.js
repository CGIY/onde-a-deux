(() => {
  "use strict";

  const SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
  const SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";
  const api = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  const state = {
    role: null,
    token: null,
    data: null,
    serverOffset: 0,
    view: "today",
    collectionTab: "available",
    selectedBooster: null,
    opening: false,
    polling: null
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

  const escapeHtml = value => String(value ?? "").replace(/[&<>'"]/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);

  const tokenKey = role => `les-cartes-token:${role}`;
  const generateToken = () => [...crypto.getRandomValues(new Uint8Array(24))]
    .map(byte => byte.toString(16).padStart(2, "0")).join("");

  function setBusy(busy) {
    loadingVeil.hidden = !busy;
    $$("button, input, select").forEach(element => {
      if (element.closest(".loading-veil")) return;
      if (busy) {
        element.dataset.wasDisabled = element.disabled ? "1" : "0";
        element.disabled = true;
      }
      else if (element.dataset.wasDisabled !== "1") element.disabled = false;
    });
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
    device_not_authorized: "Ce profil est déjà lié à un autre téléphone.",
    booster_unavailable: "Ce booster n’est plus disponible.",
    card_unavailable: "Cette carte n’est plus disponible.",
    trade_unavailable: "Cet échange n’est plus disponible.",
    no_active_card: "Aucune carte n’est encore publiée.",
    invalid_request: "La demande n’a pas pu être comprise."
  };

  function friendlyError(error) {
    const text = String(error?.message || error || "Erreur inconnue");
    const key = Object.keys(errorMessages).find(candidate => text.includes(candidate));
    return key ? errorMessages[key] : "Connexion impossible pour le moment. Réessaie dans un instant.";
  }

  async function exchange(action = "sync", payload = {}, accessCode = null) {
    if (!state.role || !state.token) throw new Error("pairing_required");
    const { data, error } = await api.rpc("tcg_exchange", {
      p_role: state.role,
      p_token: state.token,
      p_access_code: accessCode,
      p_action: action,
      p_payload: payload
    });
    if (error) throw error;
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

  function cardMarkup(card, options = {}) {
    const finish = card.finish || "standard";
    const wear = Math.abs(Number(card.wear_seed || hashString(card.template_id || card.title))) % 4;
    const timer = options.timer ? `<span class="card-timer" data-until="${escapeHtml(options.timer)}">${duration(options.timer)}</span>` : "";
    return `<article class="game-card palette-${escapeHtml(card.palette || "couple")} finish-${escapeHtml(finish)}${options.compact ? " compact" : ""}${options.muted ? " muted" : ""}" data-wear="${wear}">
      <div class="card-top"><span>${escapeHtml(card.category)}</span><i class="card-rarity"></i><span>${escapeHtml(finishLabel(finish))}</span></div>
      ${timer}<div class="card-symbol" aria-hidden="true">${escapeHtml(card.symbol || "✦")}</div>
      <div class="card-copy"><h4>${escapeHtml(card.title)}</h4><p>${escapeHtml(card.challenge || "Carte déjà découverte.")}</p></div>
    </article>`;
  }

  function hashString(value) {
    return [...String(value || "")].reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0);
  }

  function empty(message) {
    return `<p class="empty-state">${escapeHtml(message)}</p>`;
  }

  function attachFoilMotion(root = document) {
    root.querySelectorAll?.(".finish-foil, .finish-full_art_foil").forEach(card => {
      if (card.dataset.foilReady) return;
      card.dataset.foilReady = "1";
      const move = event => {
        const point = event.touches?.[0] || event;
        const rect = card.getBoundingClientRect();
        const x = Math.max(0, Math.min(100, ((point.clientX - rect.left) / rect.width) * 100));
        const y = Math.max(0, Math.min(100, ((point.clientY - rect.top) / rect.height) * 100));
        card.style.setProperty("--pointer-x", `${x}%`);
        card.style.setProperty("--pointer-y", `${y}%`);
      };
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("touchmove", move, { passive: true });
    });
  }

  function buttonCard(card, options = {}) {
    return `<button class="card-button" type="button" data-card-id="${escapeHtml(card.id || "")}" data-template-id="${escapeHtml(card.template_id || "")}">${cardMarkup(card, options)}</button>`;
  }

  function renderToday() {
    const data = state.data;
    $("#todayDate").textContent = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" }).format(serverNow());
    $("#boosterOwner").textContent = state.role;
    $("#nextBoosterCounter").textContent = nextBoosterDuration();
    $("#collectionCount").textContent = data.my_cards.length;
    $("#knownCount").textContent = data.known_cards.length;
    $("#boosterCount").textContent = data.boosters.length;
    $("#activeCount").textContent = data.active_cards.length;

    $("#boosterList").innerHTML = data.boosters.length ? data.boosters.map(booster => `
      <button class="booster-item" type="button" data-booster-id="${escapeHtml(booster.id)}">
        <span class="booster-copy"><span>BOOSTER DU JOUR</span><strong>Une carte t’attend.</strong><small>Expire dans <b data-until="${escapeHtml(booster.expires_at)}">${duration(booster.expires_at)}</b></small></span>
        <span class="booster-stack" aria-hidden="true"><i></i><i></i><i>✦</i></span>
      </button>`).join("") : `<p class="booster-empty">Ton booster du jour est ouvert.<br>Le prochain arrive à 5 h.</p>`;

    $("#activeCards").innerHTML = data.active_cards.length
      ? data.active_cards.map(card => buttonCard(card, { timer: card.active_until })).join("")
      : empty("Aucun challenge actif. Une carte activée apparaîtra ici pendant 24 h.");
  }

  function renderCollection() {
    const available = state.data.my_cards.filter(card => card.status === "available");
    $("#availableTabCount").textContent = available.length;
    $("#knownTabCount").textContent = state.data.known_cards.length;
    $("#collectionNote").textContent = state.collectionTab === "available"
      ? "Ces cartes sont utilisables pendant 30 jours après leur obtention."
      : "Seules les cartes déjà découvertes sont visibles ici.";

    const cards = state.collectionTab === "available" ? available : state.data.known_cards;
    $("#collectionGrid").innerHTML = cards.length
      ? cards.map(card => state.collectionTab === "available"
        ? buttonCard(card, { timer: card.expires_at })
        : buttonCard({ ...card, id: "", finish: "standard", wear_seed: hashString(card.template_id) }, { muted: Number(card.owned_count) === 0 })
      ).join("")
      : empty(state.collectionTab === "available" ? "Ta collection est vide pour l’instant." : "Ouvre un booster pour découvrir ta première carte.");
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
      <div class="trade-item-head"><strong>${incoming ? `${state.data.partner_role} te propose` : "Tu proposes"}</strong><small>${escapeHtml(status)}${trade.status === "pending" ? ` · ${duration(trade.expires_at)}` : ""}</small></div>
      <div class="trade-pair"><div class="trade-mini"><span>${escapeHtml(trade.offered.category)}</span><b>${escapeHtml(trade.offered.title)}</b></div><span>⇄</span><div class="trade-mini"><span>${escapeHtml(trade.requested.category)}</span><b>${escapeHtml(trade.requested.title)}</b></div></div>${actions}
    </article>`;
  }

  function renderTrades() {
    const mine = state.data.my_cards.filter(card => card.status === "available");
    const partner = state.data.partner_cards.filter(card => card.status === "available");
    $("#offeredCardSelect").innerHTML = `<option value="">Choisir une carte</option>${mine.map(option).join("")}`;
    $("#requestedCardSelect").innerHTML = `<option value="">Choisir une carte de ${state.data.partner_role}</option>${partner.map(option).join("")}`;
    $("#proposeTradeButton").disabled = !mine.length || !partner.length;

    const pending = state.data.trades.filter(trade => trade.status === "pending");
    const history = state.data.trades.filter(trade => trade.status !== "pending");
    $("#pendingTradeCount").textContent = pending.length;
    $("#pendingTrades").innerHTML = pending.length ? pending.map(tradeMarkup).join("") : empty("Aucune proposition en attente.");
    $("#tradeHistory").innerHTML = history.length ? history.map(tradeMarkup).join("") : empty("Les échanges terminés apparaîtront ici.");
  }

  function render() {
    if (!state.data) return;
    $("#currentRole").textContent = state.role;
    $("#presenceDot").classList.toggle("online", Boolean(state.data.partner_online));
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
    if (!state.role) return;
    $("#refreshButton").classList.add("syncing");
    try {
      await exchange("sync");
      render();
    } catch (error) {
      if (!quiet) toast(friendlyError(error));
      if (String(error?.message).includes("device_not_authorized") || String(error?.message).includes("pairing_required")) showLogin();
    } finally {
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
    $("#currentRole").textContent = state.role;
    localStorage.setItem("les-cartes-last-role", state.role);
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
    state.role = role;
    state.token = localStorage.getItem(tokenKey(role));
    $("#loginStatus").textContent = `Connexion ${role}…`;
    if (!state.token) {
      state.token = generateToken();
      $("#pairingRole").textContent = role;
      profilePicker.hidden = true;
      pairingForm.hidden = false;
      $("#accessCode").value = "";
      $("#accessCode").focus();
      $("#loginStatus").textContent = `Première connexion de ${role}.`;
      return;
    }
    setBusy(true);
    try {
      await exchange("sync");
      enterApp();
    } catch (error) {
      localStorage.removeItem(tokenKey(role));
      state.token = generateToken();
      $("#pairingRole").textContent = role;
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
    $$('[data-nav]').forEach(button => button.classList.toggle("selected", button.dataset.nav === view));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function findCard(element) {
    const id = element.closest("[data-card-id]")?.dataset.cardId;
    const templateId = element.closest("[data-template-id]")?.dataset.templateId;
    return [...state.data.my_cards, ...state.data.partner_cards, ...state.data.active_cards, ...state.data.known_cards]
      .find(card => (id && card.id === id) || (!id && templateId && card.template_id === templateId));
  }

  function openCard(card) {
    if (!card) return;
    const canActivate = card.id && card.status === "available" && state.data.my_cards.some(owned => owned.id === card.id);
    const active = card.active_until && new Date(card.active_until) > serverNow();
    const ownership = card.owner_role ? `Carte de ${card.owner_role}` : Number(card.owned_count) ? "Dans ta collection" : "Déjà découverte";
    $("#cardDialogContent").innerHTML = `${cardMarkup(card, { timer: card.active_until || (card.status === "available" ? card.expires_at : null), muted: !card.id })}
      <div class="card-dialog-copy"><span class="eyebrow">${escapeHtml(ownership)} · ${escapeHtml(finishLabel(card.finish || "standard"))}</span><p>${escapeHtml(card.challenge)}</p>
      ${canActivate ? `<button class="primary-button" type="button" data-activate-card="${escapeHtml(card.id)}">Activer ce challenge · 24 h</button>` : active ? `<p>Ce challenge reste actif encore ${duration(card.active_until)}.</p>` : ""}</div>`;
    cardDialog.showModal();
    attachFoilMotion(cardDialog);
  }

  function openBooster(id) {
    state.selectedBooster = id;
    state.opening = false;
    $("#sealedPack").classList.remove("opened");
    $("#sealedPack").style.setProperty("--tear", "0%");
    $("#revealSlot").hidden = true;
    $("#revealSlot").innerHTML = "";
    $("#boosterStatus").textContent = "Fais glisser ton doigt pour déchirer le booster.";
    boosterDialog.showModal();
  }

  async function revealBooster() {
    if (state.opening || !state.selectedBooster) return;
    state.opening = true;
    const previous = new Set(state.data.my_cards.map(card => card.id));
    $("#boosterStatus").textContent = "La carte se révèle…";
    try {
      await exchange("open_booster", { booster_id: state.selectedBooster });
      const card = state.data.my_cards.find(candidate => !previous.has(candidate.id));
      $("#sealedPack").classList.add("opened");
      setTimeout(() => {
        $("#sealedPack").hidden = true;
        $("#revealSlot").innerHTML = card ? cardMarkup(card) : empty("Carte obtenue. Elle est dans ta collection.");
        $("#revealSlot").hidden = false;
        $("#boosterStatus").textContent = card ? `${finishLabel(card.finish)} · ajoutée à ta collection.` : "Ajoutée à ta collection.";
        attachFoilMotion($("#revealSlot"));
      }, 330);
      render();
    } catch (error) {
      state.opening = false;
      $("#boosterStatus").textContent = friendlyError(error);
    }
  }

  function setupBoosterGesture() {
    const pack = $("#sealedPack");
    let startX = null;
    const begin = event => {
      if (state.opening) return;
      startX = event.clientX;
      pack.setPointerCapture?.(event.pointerId);
    };
    const move = event => {
      if (startX === null || state.opening) return;
      const progress = Math.max(0, Math.min(100, ((event.clientX - startX) / Math.max(180, pack.clientWidth * .72)) * 100));
      pack.style.setProperty("--tear", `${progress}%`);
      if (progress >= 92) {
        startX = null;
        revealBooster();
      }
    };
    const end = () => {
      if (startX === null) return;
      startX = null;
      pack.style.setProperty("--tear", "0%");
    };
    pack.addEventListener("pointerdown", begin);
    pack.addEventListener("pointermove", move);
    pack.addEventListener("pointerup", end);
    pack.addEventListener("pointercancel", end);
  }

  $$("[data-role]").forEach(button => button.addEventListener("click", () => selectRole(button.dataset.role)));
  $("#pairingBack").addEventListener("click", () => showLogin());
  pairingForm.addEventListener("submit", async event => {
    event.preventDefault();
    const code = $("#accessCode").value.trim().toUpperCase();
    setBusy(true);
    try {
      await exchange("login", {}, code);
      localStorage.setItem(tokenKey(state.role), state.token);
      enterApp();
    } catch (error) {
      $("#loginStatus").textContent = friendlyError(error);
    } finally {
      setBusy(false);
    }
  });
  $("#profileMenu").addEventListener("click", () => showLogin("Choisis l’autre profil ou reconnecte-toi."));
  $("#refreshButton").addEventListener("click", () => sync());
  $$('[data-nav]').forEach(button => button.addEventListener("click", () => setView(button.dataset.nav)));
  $$('[data-collection-tab]').forEach(button => button.addEventListener("click", () => {
    state.collectionTab = button.dataset.collectionTab;
    $$('[data-collection-tab]').forEach(tab => tab.classList.toggle("selected", tab === button));
    renderCollection();
    attachFoilMotion();
  }));

  document.addEventListener("click", async event => {
    const booster = event.target.closest("[data-booster-id]");
    if (booster) return openBooster(booster.dataset.boosterId);
    const cardButton = event.target.closest(".card-button");
    if (cardButton) return openCard(findCard(cardButton));
    const activate = event.target.closest("[data-activate-card]");
    if (activate) {
      if (!window.confirm("Activer ce challenge ? La carte sera consommée et restera active pendant 24 h.")) return;
      setBusy(true);
      try {
        await exchange("activate_card", { card_id: activate.dataset.activateCard });
        cardDialog.close();
        render();
        setView("today");
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
        toast(action === "accept" ? "Échange accepté." : action === "reject" ? "Échange refusé." : "Proposition annulée.");
      } catch (error) { toast(friendlyError(error)); }
      finally { setBusy(false); }
    }
  });

  $("#proposeTradeButton").addEventListener("click", async () => {
    const offered = $("#offeredCardSelect").value;
    const requested = $("#requestedCardSelect").value;
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
    dialog.close();
  }));
  boosterDialog.addEventListener("close", () => {
    $("#sealedPack").hidden = false;
    state.selectedBooster = null;
    state.opening = false;
  });
  document.addEventListener("visibilitychange", () => document.hidden || sync({ quiet: true }));
  setInterval(updateTimers, 1000);
  setupBoosterGesture();

  if ("serviceWorker" in navigator && location.protocol === "https:") navigator.serviceWorker.register("service-worker.js");
  const lastRole = localStorage.getItem("les-cartes-last-role");
  if (lastRole && localStorage.getItem(tokenKey(lastRole))) selectRole(lastRole);
})();
