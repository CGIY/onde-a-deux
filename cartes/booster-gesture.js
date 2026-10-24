/* Input only: no storage, network, account or inventory access. */
(() => {
  "use strict";
  function attach(pack, { isLocked, onProgress, onCommit, onStep = () => {} }) {
    let gesture = null;
    const release = id => {
      if (pack.hasPointerCapture?.(id)) pack.releasePointerCapture(id);
    };
    const reset = () => {
      const previous = gesture;
      gesture = null;
      pack.classList.remove("dragging");
      if (previous) release(previous.id);
      onProgress(0);
    };
    pack.addEventListener("pointerdown", event => {
      if (isLocked() || gesture || event.isPrimary === false || event.button > 0) return;
      const rect = pack.getBoundingClientRect();
      const direction = event.clientX > rect.left + rect.width * .55 ? -1 : 1;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, direction, width: rect.width, step: 0 };
      pack.dataset.tearDirection = direction === 1 ? "right" : "left";
      pack.setPointerCapture?.(event.pointerId);
      pack.classList.add("dragging", "was-touched");
      onProgress(0);
    });
    pack.addEventListener("pointermove", event => {
      if (!gesture || gesture.id !== event.pointerId || isLocked()) return;
      const dx = (event.clientX - gesture.x) * gesture.direction;
      const dy = Math.abs(event.clientY - gesture.y);
      // A vertical gesture is never an accidental booster opening.
      if (dy > 24 && dy > Math.abs(dx) * 1.2) return reset();
      const progress = Math.max(0, Math.min(1, dx / (gesture.width * .72)));
      onProgress(progress);
      const step = Math.floor(progress * 4);
      if (step > gesture.step) { gesture.step = step; onStep(); }
      if (progress >= 1) {
        const id = gesture.id;
        gesture = null;
        pack.classList.remove("dragging");
        release(id);
        onCommit();
      }
    });
    const end = event => {
      if (gesture?.id === event.pointerId) reset();
    };
    pack.addEventListener("pointerup", end);
    pack.addEventListener("pointercancel", end);
    pack.addEventListener("lostpointercapture", end);
    pack.addEventListener("contextmenu", event => event.preventDefault());
    return { reset };
  }

  function preventDoubleTapZoom(root) {
    // Keep pinch-to-zoom available. Only the browser's double-tap shortcut is blocked.
    let lastTap = null;
    root.addEventListener("touchend", event => {
      if (event.touches.length || event.changedTouches.length !== 1) { lastTap = null; return; }
      const target = event.target;
      if (target.closest?.("input,textarea,select,[contenteditable]")) { lastTap = null; return; }
      const point = event.changedTouches[0], now = event.timeStamp;
      const doubleTap = lastTap && now - lastTap.at < 320
        && Math.hypot(point.clientX - lastTap.x, point.clientY - lastTap.y) < 28;
      if (doubleTap && event.cancelable) event.preventDefault();
      lastTap = doubleTap ? null : { at: now, x: point.clientX, y: point.clientY };
    }, { passive: false });
    root.addEventListener("dblclick", event => {
      if (!event.target.closest?.("input,textarea,select,[contenteditable]")) event.preventDefault();
    });
  }
  window.CardBoosterGesture = { attach, preventDoubleTapZoom };
})();
