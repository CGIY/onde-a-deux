const ONDE_SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
const ONDE_SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";

const ondeLive = (() => {
  const client = window.supabase.createClient(ONDE_SUPABASE_URL, ONDE_SUPABASE_KEY);
  const roomCodeInput = document.getElementById("roomCodeInput");
  const roomButton = document.getElementById("roomButton");
  const roomStatus = document.getElementById("roomStatus");
  let roomCode = (new URLSearchParams(location.search).get("room") || localStorage.getItem("onde-room") || "").toUpperCase();
  let role = new URLSearchParams(location.search).get("role") || localStorage.getItem("onde-role") || "";
  let channel = null;
  let row = null;
  let listener = null;

  function setStatus(message, good = false) {
    roomStatus.textContent = message;
    roomStatus.style.color = good ? "#4c855d" : "";
  }

  function code() { return Array.from(crypto.getRandomValues(new Uint8Array(6)), (n) => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[n % 32]).join(""); }

  async function connect(nextCode, nextRole) {
    roomCode = nextCode.toUpperCase();
    role = nextRole;
    if (!roomCode || !role) return;
    localStorage.setItem("onde-room", roomCode);
    localStorage.setItem("onde-role", role);
    roomCodeInput.value = roomCode;
    const patch = { room_code: roomCode, [`${role.toLowerCase()}_online`]: true, updated_at: new Date().toISOString() };
    const { data, error } = await client.from("onde_sessions").upsert(patch, { onConflict: "room_code" }).select().single();
    if (error) { setStatus("Impossible de joindre cette session."); return; }
    row = data;
    setStatus(`${roomCode} · ${role} connecté. En attente de l’autre téléphone.`, true);
    channel?.unsubscribe();
    channel = client.channel(`onde:${roomCode}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "onde_sessions", filter: `room_code=eq.${roomCode}` }, (payload) => {
      row = payload.new;
      setStatus(row.j1_online && row.j2_online ? `${roomCode} · J1 et J2 sont connectés.` : `${roomCode} · En attente de l’autre téléphone.`, row.j1_online && row.j2_online);
      listener?.(row.state || null, row);
    }).subscribe();
    return row;
  }

  roomButton.addEventListener("click", async () => {
    const selected = document.querySelector(".player-choice-button.selected");
    if (!selected) { setStatus("Choisis d’abord A ou C."); return; }
    const entered = roomCodeInput.value.trim() || code();
    await connect(entered, selected.dataset.player);
    if (!roomCodeInput.value) roomCodeInput.value = entered;
  });

  return {
    get roomCode() { return roomCode; },
    get role() { return role; },
    get ready() { return Boolean(row?.j1_online && row?.j2_online); },
    async push(state) {
      if (!roomCode || !role) return;
      await client.from("onde_sessions").update({ state, updated_at: new Date().toISOString() }).eq("room_code", roomCode);
    },
    onChange(callback) { listener = callback; },
    connect,
    setStatus
  };
})();

window.ondeLive = ondeLive;
