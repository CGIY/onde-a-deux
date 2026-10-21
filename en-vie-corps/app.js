const SUPABASE_URL = "https://tgkhgafkqvritsgdapcz.supabase.co";
const SUPABASE_KEY = "sb_publishable_GhmpioVNsGFgHtJsaGXqsg__P3DRtpA";
const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY);
const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const detail = document.getElementById("detail");
const closeDetail = document.getElementById("closeDetail");
const detailTitle = document.getElementById("detailTitle");
const detailSub = document.getElementById("detailSub");
const doneBtn = document.getElementById("doneBtn");
const scoreEl = document.getElementById("score");
const gaugeFill = document.getElementById("gaugeFill");
const countLabel = document.getElementById("countLabel");
const toast = document.getElementById("toast");
const pairButton = document.getElementById("pairButton");
const pairLabel = document.getElementById("pairLabel");
const syncPanel = document.getElementById("syncPanel");
const closeSync = document.getElementById("closeSync");
const createPair = document.getElementById("createPair");
const joinPair = document.getElementById("joinPair");
const codeInput = document.getElementById("pairCodeInput");
const sharedCode = document.getElementById("sharedCode");
const sharedCodeValue = document.getElementById("sharedCodeValue");
const copyPairLink = document.getElementById("copyPairLink");
const syncStatus = document.getElementById("syncStatus");

function mondayKey(date = new Date()) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function emptyProgress() {
  return { week: mondayKey(), completed: [], wishlist: [] };
}

function validProgress(value) {
  return value && value.week === mondayKey() && Array.isArray(value.completed) && Array.isArray(value.wishlist);
}

let progress = emptyProgress();
try {
  const local = JSON.parse(localStorage.getItem("envie-corps-progress"));
  if (validProgress(local)) progress = local;
} catch (_) {}

let sync = { code: "", role: "A", token: "", version: 0, paired: false, timer: null, busy: false };
try {
  const saved = JSON.parse(localStorage.getItem("envie-session"));
  if (saved?.code && saved?.role) {
    sync.code = saved.code;
    sync.role = saved.role;
  }
} catch (_) {}

function unique(items) {
  return [...new Set(items.filter(item => typeof item === "string").slice(0, 100))];
}

function normalizeProgress(value) {
  if (!validProgress(value)) return emptyProgress();
  return { week: mondayKey(), completed: unique(value.completed), wishlist: unique(value.wishlist) };
}

function mergeProgress(a, b) {
  if (a.week !== mondayKey() && b.week !== mondayKey()) return emptyProgress();
  const left = a.week === mondayKey() ? a : emptyProgress();
  const right = b.week === mondayKey() ? b : emptyProgress();
  return {
    week: mondayKey(),
    completed: unique([...left.completed, ...right.completed]),
    wishlist: unique([...left.wishlist, ...right.wishlist])
  };
}

function saveLocal() {
  localStorage.setItem("envie-corps-progress", JSON.stringify(progress));
}

function paintProgress() {
  const score = Math.min(5, progress.completed.length);
  scoreEl.textContent = score;
  gaugeFill.style.width = `${score / 5 * 100}%`;
  countLabel.textContent = score === 0 ? "Aucun élan retrouvé" : score === 1 ? "Un élan retrouvé" : `${score} élans retrouvés`;
}

function showToast(message = "Un pas de plus vers vous deux.") {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2200);
}

function newToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), value => value.toString(16).padStart(2, "0")).join("");
}

function newCode() {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), value => alphabet[value % alphabet.length]).join("");
}

function tokenKey(code, role) {
  return `envie-token:${code}:${role}`;
}

function rememberSession() {
  localStorage.setItem(tokenKey(sync.code, sync.role), sync.token);
  localStorage.setItem("envie-session", JSON.stringify({ code: sync.code, role: sync.role }));
}

function setSyncStatus(message, status = "local") {
  syncStatus.textContent = message;
  pairButton.dataset.status = status;
  pairLabel.textContent = sync.code ? `${sync.role} · ${sync.paired ? "liés" : sync.code}` : "A + C";
}

async function exchange({ create = false, state = null, expectedVersion = null } = {}) {
  if (!client) throw new Error("client_missing");
  const { data, error } = await client.rpc("envie_exchange", {
    p_code: sync.code,
    p_role: sync.role,
    p_token: sync.token,
    p_create: create,
    p_expected_version: expectedVersion,
    p_state: state
  });
  if (error) throw error;
  sync.version = Number(data.version || 0);
  sync.paired = Boolean(data.paired);
  return data;
}

function adoptRemote(remoteState) {
  const merged = mergeProgress(progress, normalizeProgress(remoteState));
  const changed = JSON.stringify(merged) !== JSON.stringify(progress);
  progress = merged;
  if (changed) {
    saveLocal();
    paintProgress();
  }
  return JSON.stringify(merged) !== JSON.stringify(normalizeProgress(remoteState));
}

async function pullRemote() {
  if (!sync.code || !sync.token || sync.busy) return;
  sync.busy = true;
  try {
    const data = await exchange();
    const needsPush = adoptRemote(data.state);
    rememberSession();
    setSyncStatus(sync.paired ? "Vos deux téléphones partagent maintenant la même progression." : `Code ${sync.code} · En attente de l’autre téléphone.`, sync.paired ? "online" : "syncing");
    sharedCode.hidden = false;
    sharedCodeValue.textContent = sync.code;
    if (needsPush) await pushRemote(false);
  } catch (error) {
    setSyncStatus(messageForError(error), "local");
  } finally {
    sync.busy = false;
  }
}

async function pushRemote(retry = true) {
  if (!sync.code || !sync.token || !client) return;
  try {
    pairButton.dataset.status = "syncing";
    const data = await exchange({ state: progress, expectedVersion: sync.version });
    adoptRemote(data.state);
    setSyncStatus(sync.paired ? "Progression synchronisée sur les deux téléphones." : `Code ${sync.code} · En attente de l’autre téléphone.`, sync.paired ? "online" : "syncing");
  } catch (error) {
    if (retry && String(error.message).includes("stale_version")) {
      const fresh = await exchange();
      adoptRemote(fresh.state);
      await pushRemote(false);
    } else {
      setSyncStatus("Progression conservée ici. La synchronisation reprendra automatiquement.", "local");
    }
  }
}

function messageForError(error) {
  const message = String(error?.message || "");
  if (message.includes("room_missing")) return "Code introuvable. L’autre téléphone doit d’abord créer l’espace.";
  if (message.includes("role_taken")) return "Cette lettre est déjà liée à un autre téléphone.";
  if (message.includes("room_expired")) return "Cet espace a expiré après 180 jours sans activité.";
  if (message.includes("invalid_session")) return "Le code ou la lettre n’est pas valide.";
  return "Connexion impossible pour le moment. La progression reste sur ce téléphone.";
}

async function connectPair(code, role, create = false) {
  if (sync.busy) return;
  const normalized = String(code).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(normalized)) {
    setSyncStatus("Entre le code complet à 8 caractères.");
    return false;
  }
  sync.busy = true;
  sync.code = normalized;
  sync.role = role;
  sync.token = (!create && localStorage.getItem(tokenKey(sync.code, sync.role))) || newToken();
  setSyncStatus("Connexion…", "syncing");
  try {
    const data = await exchange({ create, state: create ? progress : null });
    adoptRemote(data.state);
    rememberSession();
    sharedCode.hidden = false;
    sharedCodeValue.textContent = sync.code;
    codeInput.value = sync.code;
    setSyncStatus(sync.paired ? "Vos deux téléphones sont liés." : `Code ${sync.code} · En attente de l’autre téléphone.`, sync.paired ? "online" : "syncing");
    clearInterval(sync.timer);
    sync.timer = setInterval(pullRemote, 4000);
    return true;
  } catch (error) {
    setSyncStatus(messageForError(error), "local");
    if (create) sync.code = "";
    return false;
  } finally {
    sync.busy = false;
  }
}

const detailData = {
  "Biffle": {
    id: "biffle",
    sub: "Une provocation complice, seulement quand elle est clairement désirée par vous deux.",
    center: "L’envie<br>partagée",
    nodes: ["<strong>Le +</strong>Jeu, surprise et lâcher-prise", "<strong>Attention</strong>Peut surprendre ou blesser", "<strong>Avant</strong>Accord clair et intensité choisie", "<strong>Après</strong>Vérifier le ressenti, sans jugement"],
    advice: ["Un oui explicite, commencer doucement et rester attentif aux réactions.", "Un accord peut changer. On ralentit ou on arrête dès que l’un de vous le souhaite."]
  },
  "Massage lent": {
    id: "massage-lent",
    sub: "Un moment sans objectif, où l’attention donnée compte autant que le geste.",
    center: "Être<br>présents",
    nodes: ["<strong>Le +</strong>Détente et proximité", "<strong>Attention</strong>Ne pas imposer un rythme", "<strong>Avant</strong>Demander les zones préférées", "<strong>Après</strong>Partager ce qui a plu"],
    advice: ["Prévoir dix minutes tranquilles, des mains chaudes et une pression légère au départ.", "La personne massée guide toujours l’intensité et peut arrêter à tout moment."]
  },
  "Sortie surprise": {
    id: "sortie-surprise",
    sub: "Une petite rupture avec l’habitude pour recréer de la curiosité à deux.",
    center: "Un nouvel<br>élan",
    nodes: ["<strong>Le +</strong>Curiosité et souvenirs", "<strong>Attention</strong>Respecter l’énergie du jour", "<strong>Avant</strong>Fixer budget et disponibilité", "<strong>Après</strong>Garder une trace commune"],
    advice: ["Surprendre sur le lieu, pas sur les contraintes : horaire, budget et tenue restent connus.", "Prévoir une porte de sortie simple si l’un de vous n’a finalement pas l’énergie."]
  }
};

const brandWords = [...document.querySelectorAll(".brand-suffix")];
let brandIndex = 0;
setInterval(() => {
  const current = brandWords[brandIndex];
  current.classList.remove("active");
  current.classList.add("exit");
  brandIndex = (brandIndex + 1) % brandWords.length;
  const next = brandWords[brandIndex];
  next.classList.remove("exit");
  next.classList.add("active");
  setTimeout(() => current.classList.remove("exit"), 850);
}, 2700);

document.querySelectorAll(".action-card").forEach(card => {
  card.addEventListener("click", () => {
    const title = card.dataset.title;
    const data = detailData[title];
    detailTitle.textContent = title;
    detailSub.textContent = data.sub;
    document.querySelector(".mind-center").innerHTML = data.center;
    document.querySelectorAll(".node span").forEach((node, index) => node.innerHTML = data.nodes[index]);
    document.querySelectorAll(".advice p").forEach((node, index) => node.textContent = data.advice[index]);
    doneBtn.dataset.item = data.id;
    doneBtn.textContent = progress.completed.includes(data.id) ? "Déjà retrouvé ✓" : "On l’a refait !";
    doneBtn.classList.toggle("done", progress.completed.includes(data.id));
    detail.classList.add("open");
    document.body.style.overflow = "hidden";
  });
});

function closeDetailSheet() {
  detail.classList.remove("open");
  document.body.style.overflow = "";
}
closeDetail.addEventListener("click", closeDetailSheet);
detail.addEventListener("click", event => { if (event.target === detail) closeDetailSheet(); });

doneBtn.addEventListener("click", async () => {
  const item = doneBtn.dataset.item;
  if (!progress.completed.includes(item)) {
    progress.completed.push(item);
    progress.completed = unique(progress.completed);
    saveLocal();
    paintProgress();
    await pushRemote();
  }
  doneBtn.textContent = "Déjà retrouvé ✓";
  doneBtn.classList.add("done");
  showToast();
});

const chips = [...document.querySelectorAll(".chip")];
const cards = [...document.querySelectorAll(".action-card")];
chips.forEach(chip => chip.addEventListener("click", () => {
  chips.forEach(item => item.classList.remove("active"));
  chip.classList.add("active");
  const filter = chip.dataset.filter;
  cards.forEach(card => card.hidden = filter !== "all" && card.dataset.category !== filter);
}));

document.getElementById("search").addEventListener("input", event => {
  const query = event.target.value.trim().toLowerCase();
  cards.forEach(card => card.hidden = Boolean(query) && !card.dataset.title.toLowerCase().includes(query));
});

document.querySelectorAll(".nav-btn").forEach(btn => btn.addEventListener("click", () => {
  document.querySelectorAll(".nav-btn").forEach(item => item.classList.remove("active"));
  btn.classList.add("active");
}));

function openSyncPanel() {
  syncPanel.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeSyncPanel() {
  syncPanel.classList.remove("open");
  document.body.style.overflow = "";
}
pairButton.addEventListener("click", openSyncPanel);
closeSync.addEventListener("click", closeSyncPanel);
syncPanel.addEventListener("click", event => { if (event.target === syncPanel) closeSyncPanel(); });
document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeDetailSheet();
    closeSyncPanel();
  }
});

document.querySelectorAll(".role-btn").forEach(button => button.addEventListener("click", () => {
  document.querySelectorAll(".role-btn").forEach(item => item.classList.remove("active"));
  button.classList.add("active");
  sync.role = button.dataset.role;
}));

createPair.addEventListener("click", async () => {
  for (let attempt = 0; attempt < 12; attempt++) {
    if (await connectPair(newCode(), sync.role, true)) return;
    if (!syncStatus.textContent.includes("pris")) return;
  }
  setSyncStatus("Impossible de générer un code. Réessaie dans un instant.");
});

joinPair.addEventListener("click", () => connectPair(codeInput.value, sync.role, false));
codeInput.addEventListener("keydown", event => { if (event.key === "Enter") joinPair.click(); });
codeInput.addEventListener("input", () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });

copyPairLink.addEventListener("click", async () => {
  const link = new URL(location.href);
  link.search = "";
  link.searchParams.set("code", sync.code);
  try {
    await navigator.clipboard.writeText(link.href);
    copyPairLink.textContent = "Lien copié ✓";
  } catch (_) {
    setSyncStatus(`Copie indisponible. Transmets simplement le code ${sync.code}.`);
  }
});

paintProgress();

const invitationCode = new URLSearchParams(location.search).get("code");
if (invitationCode) {
  codeInput.value = invitationCode.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  openSyncPanel();
}

if (sync.code && sync.role) {
  sync.token = localStorage.getItem(tokenKey(sync.code, sync.role)) || "";
  document.querySelectorAll(".role-btn").forEach(button => button.classList.toggle("active", button.dataset.role === sync.role));
  if (sync.token) connectPair(sync.code, sync.role, false);
}

setInterval(() => {
  if (progress.week !== mondayKey()) {
    progress = emptyProgress();
    saveLocal();
    paintProgress();
    pushRemote();
  }
}, 60000);

if ("serviceWorker" in navigator) {
  addEventListener("load", () => navigator.serviceWorker.register("service-worker.js").catch(() => {}));
}
