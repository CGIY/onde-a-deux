const ONDE_SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
const ONDE_SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";

window.ondeLive = (() => {
  const client = window.supabase?.createClient(ONDE_SUPABASE_URL, ONDE_SUPABASE_KEY);
  const input = document.getElementById("roomCodeInput");
  const button = document.getElementById("roomButton");
  const status = document.getElementById("roomStatus");
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let roomCode = "";
  let role = "";
  let token = "";
  let rows = {};
  let pollTimer = null;
  let writeQueue = Promise.resolve();
  let listener = () => {};

  const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), value => alphabet[value % alphabet.length]).join("");
  const newToken = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, "0")).join("");
  const fresh = row => row && Date.now() - new Date(row.last_seen).getTime() < 45000;
  const ready = () => Boolean(fresh(rows.J1) && fresh(rows.J2));

  function setStatus(message, good = false) {
    status.textContent = message;
    status.classList.toggle("connected", good);
  }

  function announce() {
    if (!roomCode) return;
    setStatus(ready() ? `${roomCode} · A et C sont connectés.` : `${roomCode} · ${role === "J1" ? "A" : "C"} connecté. En attente de l’autre téléphone.`, ready());
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
    rows = Object.fromEntries((data || []).map(row => [row.role, row]));
    announce();
  }

  async function connect(code, selectedRole, create) {
    if (!client) { setStatus("Connexion indisponible. Recharge la page."); return false; }
    const normalized = String(code || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!/^[A-Z0-9]{6,8}$/.test(normalized) || !["J1", "J2"].includes(selectedRole)) {
      setStatus("Choisis ta diode et saisis un code de 6 à 8 caractères.");
      return false;
    }
    button.disabled = true;
    setStatus("Connexion en cours…");
    roomCode = normalized;
    role = selectedRole;
    const tokenKey = `onde-token:${roomCode}:${role}`;
    token = sessionStorage.getItem(tokenKey) || newToken();
    try {
      await exchange(null, create);
      sessionStorage.setItem(tokenKey, token);
      sessionStorage.setItem("onde-room", roomCode);
      sessionStorage.setItem("onde-role", role);
      input.value = roomCode;
      clearInterval(pollTimer);
      pollTimer = setInterval(() => {
        exchange().catch(() => setStatus("Connexion interrompue. Nouvelle tentative en cours…"));
      }, 3000);
      return true;
    } catch (error) {
      roomCode = "";
      role = "";
      token = "";
      if (error.message?.includes("role_taken")) setStatus("Cette diode est déjà active sur l’autre téléphone.");
      else if (error.message?.includes("room_missing")) setStatus("Code inconnu. Vérifie le code affiché sur l’autre téléphone.");
      else setStatus("Connexion impossible. Réessaie dans un instant.");
      return false;
    } finally {
      button.disabled = false;
    }
  }

  button.addEventListener("click", async () => {
    const selected = document.querySelector(".player-choice-button.selected");
    if (!selected) { setStatus("Choisis A ou C sur ce téléphone."); return; }
    const supplied = input.value.trim();
    await connect(supplied || newCode(), selected.dataset.player, !supplied);
  });

  return {
    get roomCode() { return roomCode; },
    get role() { return role; },
    get ready() { return ready(); },
    onChange(callback) { listener = callback; },
    async push(state) {
      if (!roomCode || !role) return false;
      const payload = JSON.parse(JSON.stringify(state));
      writeQueue = writeQueue.catch(() => {}).then(() => exchange(payload));
      try { await writeQueue; return true; }
      catch { setStatus("Sauvegarde interrompue. Vérifie la connexion."); return false; }
    },
    setStatus,
    connect
  };
})();
