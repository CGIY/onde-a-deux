const ONDE_SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
const ONDE_SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";

window.ondeLive = (() => {
  const client = window.supabase?.createClient(ONDE_SUPABASE_URL, ONDE_SUPABASE_KEY);
  const input = document.getElementById("roomCodeInput");
  const controls = document.querySelector(".room-controls");
  const createButton = document.getElementById("createRoomButton");
  const joinButton = document.getElementById("joinRoomButton");
  const codeBox = document.getElementById("sessionCodeBox");
  const codeValue = document.getElementById("sessionCodeValue");
  const copyButton = document.getElementById("copyInviteButton");
  const status = document.getElementById("roomStatus");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let roomCode = "";
  let role = "";
  let token = "";
  let rows = {};
  let pollTimer = null;
  let writeQueue = Promise.resolve();
  let listener = () => {};
  let networkOK = false;
  let pendingPayload = null;
  let generation = 0;
  const badge = document.getElementById("syncLabel");

  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), value => alphabet[value % alphabet.length]).join("");
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, "0")).join("");
  const fresh = row => row && Date.now() - new Date(row.last_seen).getTime() < 15000;
  const ready = () => networkOK && Boolean(fresh(rows.J1) && fresh(rows.J2));

  function setStatus(message, good = false) {
    status.textContent = message;
    status.classList.toggle("connected", good);
  }

  function announce() {
    if (!roomCode) return;
    controls.hidden = true;
    codeBox.hidden = false;
    codeValue.textContent = roomCode;
    setStatus(!networkOK ? "Ça capte mal. On retente…" : ready() ? `${roomCode} · Duo connecté.` : `${roomCode} · L’autre arrive…`, ready());
    if (badge) {
      badge.textContent = !networkOK ? "Reconnexion…" : pendingPayload ? "Sauvegarde…" : ready() ? "Synchronisé" : "L’autre arrive…";
      badge.parentElement.dataset.status = !networkOK ? "offline" : pendingPayload ? "saving" : ready() ? "online" : "waiting";
    }
    listener({ ...rows }, { roomCode, role, ready: ready() });
  }

  async function exchange(state = null, create = false) {
    const { data, error } = await client.rpc("onde_exchange", {
      p_room_code: roomCode,
      p_role: role,
      p_token: token,
      p_create: create,
      p_state: state
    });
    if (error) throw error;
    networkOK = true;
    rows = Object.fromEntries((data || []).map(row => [row.role, row]));
  }

  function enqueue(payload = null, create = false) {
    const current = generation;
    const run = writeQueue.catch(() => {}).then(async () => {
      if (current !== generation) return;
      await exchange(payload, create);
      if (payload && pendingPayload === payload) pendingPayload = null;
      announce();
    }).catch(error => {
      if (current === generation) { networkOK = false; announce(); }
      throw error;
    });
    writeQueue = run;
    return run;
  }

  async function connect(code, selectedRole, create) {
    if (!client) { setStatus("Connexion indisponible. Recharge la page."); return false; }
    const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{6,8}$/.test(normalized) || !["J1", "J2"].includes(selectedRole)) {
      setStatus("Choisis ta diode et saisis un code de 6 à 8 caractères.");
      return false;
    }
    createButton.disabled = true;
    joinButton.disabled = true;
    setStatus("Connexion en cours…");
    clearInterval(pollTimer);
    generation++;
    rows = {};
    pendingPayload = null;
    roomCode = normalized;
    role = selectedRole;
    const tokenKey = `onde-token:${roomCode}:${role}`;
    token = sessionStorage.getItem(tokenKey) || newToken();
    try {
      await enqueue(null, create);
      sessionStorage.setItem(tokenKey, token);
      sessionStorage.setItem("onde-room", roomCode);
      sessionStorage.setItem("onde-role", role);
      input.value = roomCode;
      clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        enqueue(pendingPayload).catch(() => {});
      }, 3000);
      return true;
    } catch (error) {
      roomCode = "";
      role = "";
      token = "";
      controls.hidden = false;
      codeBox.hidden = true;
      if (error.message?.includes("role_taken")) setStatus("Cette diode est déjà active sur l’autre téléphone.");
      else if (error.message?.includes("room_missing")) setStatus("Session introuvable. Sur le premier téléphone, appuie sur « Créer une session », puis utilise le code affiché.");
      else setStatus("Connexion impossible. Réessaie dans un instant.");
      return false;
    } finally {
      createButton.disabled = false;
      joinButton.disabled = false;
    }
  }

  function selectedRole() {
    const selected = document.querySelector(".player-choice-button.selected");
    if (!selected) setStatus("Choisis A ou C sur ce téléphone.");
    return selected?.dataset.player;
  }

  createButton.addEventListener("click", async () => {
    const selected = selectedRole();
    if (selected) await connect(newCode(), selected, true);
  });

  joinButton.addEventListener("click", async () => {
    const selected = selectedRole();
    if (selected) await connect(input.value, selected, false);
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Enter") joinButton.click();
  });

  copyButton.addEventListener("click", async () => {
    const invite = new URL(location.href);
    invite.search = "";
    invite.searchParams.set("v", "36");
    invite.searchParams.set("room", roomCode);
    try {
      await navigator.clipboard.writeText(invite.href);
      copyButton.textContent = "Lien copié ✓";
    } catch {
      setStatus(`Copie indisponible. Transmets le code ${roomCode} à l’autre téléphone.`);
    }
  });

  return {
    get roomCode() { return roomCode; },
    get role() { return role; },
    get ready() { return ready(); },
    onChange(callback) { listener = callback; },
    async push(state) {
      if (!roomCode || !role) return false;
      const payload = JSON.parse(JSON.stringify(state));
      pendingPayload = payload;
      if (badge) { badge.textContent = "Sauvegarde…"; badge.parentElement.dataset.status = "saving"; }
      try { await enqueue(payload); return true; }
      catch { return false; }
    },
    setStatus,
    connect
  };
})();
