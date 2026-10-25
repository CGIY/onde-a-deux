(() => {
  "use strict";
  // Announcements only: this module never touches cards, rewards or saved progress.
  const region = document.querySelector("#seasonBanner");
  if (!region) return;
  const prism = document.querySelector("#seasonPrism");
  const pause = document.querySelector("#seasonPause");
  const live = document.querySelector("#seasonAnnouncement");
  const faces = [...region.querySelectorAll("[data-season-event]")];
  const ends = ["2026-11-02T00:00:00+01:00", "2026-11-09T00:00:00+01:00", "2026-12-26T00:00:00+01:00"].map(Date.parse);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = [0, 1, 2], index = 0, turn = 0, paused = false, hovering = false, offset = 0;

  function updatePause() {
    pause.hidden = reduce.matches || enabled.length < 2;
    pause.setAttribute("aria-pressed", String(paused));
    pause.setAttribute("aria-label", paused ? "Reprendre les annonces" : "Mettre les annonces en pause");
    pause.innerHTML = `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${paused ? "m9 5 10 7-10 7Z" : "M9 6v12m6-12v12"}"/></svg>`;
  }

  function show(next, manual = false) {
    if (!enabled.includes(next)) return;
    if (next !== index) turn -= ((next - index + 3) % 3) * 120;
    index = next;
    prism.style.setProperty("--prism-turn", `${turn}deg`);
    for (let i = 0; i < faces.length; i++) {
      const active = i === index;
      faces[i].inert = !active;
      faces[i].tabIndex = active ? 0 : -1;
      faces[i].setAttribute("aria-hidden", String(!active));
      const label = faces[i].querySelector("strong").textContent;
      const dates = faces[i].querySelector(".season-copy").textContent;
      faces[i].setAttribute("aria-label", `${label}. ${dates}.${enabled.length > 1 ? " Afficher l’annonce suivante." : ""}`);
    }
    if (manual) live.textContent = `${faces[index].querySelector("strong").textContent}. ${faces[index].querySelector(".season-copy").textContent}.`;
  }

  function refresh(now) {
    const time = new Date(now).getTime();
    if (!Number.isFinite(time)) return;
    offset = time - Date.now();
    enabled = ends.flatMap((end, i) => time < end ? [i] : []);
    region.hidden = !enabled.length;
    if (enabled.length) show(enabled.includes(index) ? index : enabled[0]);
    updatePause();
  }

  function next(manual = false) {
    if (enabled.length < 2) return;
    const focusWasOnFace = faces.includes(document.activeElement);
    show(enabled[(enabled.indexOf(index) + 1) % enabled.length], manual);
    if (manual && focusWasOnFace) faces[index].focus({ preventScroll: true });
  }

  for (const face of faces) face.addEventListener("click", () => next(true));
  pause.addEventListener("click", () => { paused = !paused; updatePause(); });
  region.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") hovering = true; });
  region.addEventListener("pointerleave", () => { hovering = false; });
  reduce.addEventListener("change", updatePause);
  setInterval(() => {
    refresh(new Date(Date.now() + offset));
    if (paused || hovering || reduce.matches || document.hidden || region.hidden || region.classList.contains("motion-paused") || region.contains(document.activeElement) || !region.getClientRects().length) return;
    next();
  }, 7000);
  window.SeasonAnnouncements = Object.freeze({ refresh });
  refresh(new Date());
})();
