/* Short-lived decorative Halloween effects only; no game or account state. */
(() => {
  "use strict";
  const layer = document.querySelector("#halloweenAtmosphere");
  if (!layer) return;

  const {start, end} = window.SeasonDates.halloween;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  let active = false;
  let timer = 0;
  let endTimer = 0;

  function stopDrops() {
    clearTimeout(timer);
    timer = 0;
  }

  function scheduleDrop() {
    stopDrops();
    if (!active || reducedMotion.matches || document.hidden) return;
    timer = setTimeout(() => {
      if (!active || document.hidden || reducedMotion.matches) return scheduleDrop();
      const drop = document.createElement("i");
      drop.className = "halloween-blood-drop";
      drop.style.left = `${4 + Math.random() * 92}%`;
      layer.append(drop);
      setTimeout(() => drop.remove(), 1800);
      scheduleDrop();
    }, 9000 + Math.random() * 19000);
  }

  function refresh(now = Date.now()) {
    const nextActive = now >= start && now < end;
    clearTimeout(endTimer);
    if (nextActive !== active) {
      active = nextActive;
      layer.hidden = !active;
      if (!active) layer.replaceChildren(...[...layer.children].filter(child => child.classList.contains("halloween-atmosphere__bat")));
    }
    if (nextActive) endTimer = setTimeout(() => refresh(), end - now + 20);
    scheduleDrop();
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopDrops();
    else refresh();
  });
  reducedMotion.addEventListener?.("change", scheduleDrop);
  setInterval(() => refresh(), 60000);
  window.HalloweenAtmosphere = Object.freeze({ refresh });
  refresh();
})();
