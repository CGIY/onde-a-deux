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
  let creating = false;
  let lastConnectionError = "";
  let expired = false;
  const badge = document.getElementById("syncLabel");

  const codeWords = ["FION", "BITE", "TEUB", "CULS", "FUCK", "SHIT", "PIPE", "RAIE"];
  const newCode = tried => {
    const available = codeWords.filter(word => !tried.has(word));
    if (available.length) return available[crypto.getRandomValues(new Uint8Array(1))[0] % available.length];
    let candidate;
    do { candidate = Array.from(crypto.getRandomValues(new Uint8Array(4)), value => alphabet[value % alphabet.length]).join(""); } while (tried.has(candidate));
    return candidate;
  };
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, "0")).join("");
  const fresh = row => row && Date.now() - new Date(row.last_seen).getTime() < 15000;
  const ready = () => !expired && networkOK && Boolean(fresh(rows.J1) && fresh(rows.J2));

  function setStatus(message, good = false) {
    status.textContent = message;
    status.classList.toggle("connected", good);
  }

  function announce() {
    if (!roomCode) return;
    controls.hidden = true;
    codeBox.hidden = false;
    codeValue.textContent = roomCode;
    setStatus(expired ? "24 h. Session terminée. On remet ça ?" : !networkOK ? "Ça capte mal. On retente…" : ready() ? `${roomCode} · Duo connecté.` : `${roomCode} · L’autre arrive…`, ready());
    if (badge) {
      badge.textContent = expired ? "Session terminée" : !networkOK ? "Reconnexion…" : pendingPayload ? "Sauvegarde…" : ready() ? "Synchronisé" : "L’autre arrive…";
      badge.parentElement.dataset.status = !networkOK ? "offline" : pendingPayload ? "saving" : ready() ? "online" : "waiting";
    }
    listener({ ...rows }, { roomCode, role, ready: ready(), expired });
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
      if (current === generation) {
        networkOK = false;
        if (error.message?.includes("room_expired")) {
          expired = true;
          pendingPayload = null;
          clearInterval(pollTimer);
        }
        announce();
      }
      throw error;
    });
    writeQueue = run;
    return run;
  }

  async function connect(code, selectedRole, create) {
    if (!client) { setStatus("Connexion indisponible. Recharge la page."); return false; }
    const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{4,8}$/.test(normalized) || !["J1", "J2"].includes(selectedRole)) {
      setStatus("Ta diode + le code à 4 caractères. Les anciens codes passent aussi.");
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
    lastConnectionError = "";
    expired = false;
    const tokenKey = `onde-token:${roomCode}:${role}`;
    token = (!create && sessionStorage.getItem(tokenKey)) || newToken();
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
      lastConnectionError = error.message || "";
      roomCode = "";
      role = "";
      token = "";
      controls.hidden = false;
      codeBox.hidden = true;
      if (error.message?.includes("room_expired")) setStatus("Ce code a fait ses 24 h. Lance une nouvelle session.");
      else if (error.message?.includes("room_taken")) setStatus("Ce mot est pris. On en pioche un autre…");
      else if (error.message?.includes("role_taken")) setStatus("Cette diode est déjà active sur l’autre téléphone.");
      else if (error.message?.includes("room_missing")) setStatus("Code introuvable. L’autre doit d’abord lancer sa session.");
      else setStatus("Connexion impossible. Réessaie dans un instant.");
      return false;
    } finally {
      createButton.disabled = creating;
      joinButton.disabled = creating;
    }
  }

  function selectedRole() {
    const selected = document.querySelector(".player-choice-button.selected");
    if (!selected) setStatus("Choisis A ou C sur ce téléphone.");
    return selected?.dataset.player;
  }

  createButton.addEventListener("click", async () => {
    if (creating) return;
    const selected = selectedRole();
    if (!selected) return;
    creating = true;
    const tried = new Set();
    try {
      for (let attempt = 0; attempt < 16; attempt++) {
        const code = newCode(tried);
        tried.add(code);
        if (await connect(code, selected, true)) return;
        if (!lastConnectionError.includes("room_taken")) return;
      }
      setStatus("Ça bouchonne. Relance une session.");
    } finally {
      creating = false;
      createButton.disabled = false;
      joinButton.disabled = false;
    }
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
    invite.searchParams.set("v", "37");
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
      if (!roomCode || !role || expired) return false;
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
