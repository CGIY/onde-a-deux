/* Input only: no storage, network, account or inventory access. */
(() => {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function attach(pack, { isLocked, onProgress, onCommit, onStep = () => {}, onPose = () => {}, onMode = () => {} }) {
    let gesture = null, pose = { x: 3, y: -12, z: -2 };
    const release = id => { if (pack.hasPointerCapture?.(id)) pack.releasePointerCapture(id); };
    const reset = () => {
      const previous = gesture;
      gesture = null;
      pack.classList.remove("dragging", "inspecting");
      if (previous) release(previous.id);
      pose = { x: 3, y: -12, z: -2 };
      onPose(pose); onProgress(0, 0); onMode("rest");
    };
    pack.addEventListener("pointerdown", event => {
      if (isLocked() || gesture || event.isPrimary === false || event.button > 0) return;
      const rect = pack.getBoundingClientRect();
      const direction = event.clientX > rect.left + rect.width * .55 ? -1 : 1;
      const mode = event.clientY - rect.top > (rect.height || rect.width * 1.48) * .29 ? "inspect" : "tear";
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, direction, width: rect.width, height: rect.height || rect.width * 1.48, step: 0, mode, pose: { ...pose }, progress: 0, velocity: 0, lastX: event.clientX, lastAt: event.timeStamp };
      pack.dataset.tearDirection = direction === 1 ? "right" : "left";
      pack.setPointerCapture?.(event.pointerId);
      pack.classList.add("dragging", "was-touched");
      pack.classList.toggle("inspecting", mode === "inspect");
      onMode(mode);
    });
    const commit = () => {
      const id = gesture.id;
      gesture = null;
      pack.classList.remove("dragging", "inspecting");
      release(id);
      onProgress(1, Number(pack.dataset.cutAngle || 0));
      onMode("opening"); onCommit();
    };
    pack.addEventListener("pointermove", event => {
      if (!gesture || gesture.id !== event.pointerId || isLocked()) return;
      const rawX = event.clientX - gesture.x, rawY = event.clientY - gesture.y;
      const dx = rawX * gesture.direction, dy = Math.abs(rawY);
      if (gesture.mode === "inspect") {
        pose = { x: clamp(gesture.pose.x - rawY / gesture.height * 50, -22, 22), y: clamp(gesture.pose.y + rawX / gesture.width * 65, -42, 42), z: clamp(rawX / gesture.width * 5, -5, 5) };
        onPose(pose);
        return;
      }
      if (dy > 28 && dy > Math.abs(dx) * 1.5) return reset();
      const angle = clamp(Math.atan2(rawY, Math.max(1, dx)) * 180 / Math.PI, -32, 32);
      const progress = clamp(dx / (gesture.width * .60), 0, 1);
      const elapsed = event.timeStamp - gesture.lastAt;
      if (elapsed > 0) gesture.velocity = (event.clientX - gesture.lastX) * gesture.direction / elapsed;
      gesture.lastAt = event.timeStamp; gesture.lastX = event.clientX; gesture.progress = progress;
      pack.dataset.cutAngle = String(angle);
      onProgress(progress, angle);
      onPose({ x: pose.x - rawY / gesture.height * 6, y: pose.y + rawX / gesture.width * 7, z: pose.z + angle * .025 });
      const step = Math.floor(progress * 4);
      if (step > gesture.step) { gesture.step = step; onStep(); }
      if (progress >= 1) commit();
    });
    const end = (event, cancelled = false) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      if (!cancelled && gesture.mode === "tear" && gesture.progress >= .62 && gesture.velocity > .55) return commit();
      if (!cancelled && gesture.mode === "inspect") {
        const id = gesture.id; gesture = null;
        pack.classList.remove("dragging", "inspecting"); release(id); onMode("rest");
        return;
      }
      reset();
    };
    pack.addEventListener("pointerup", event => end(event));
    pack.addEventListener("pointercancel", event => end(event, true));
    pack.addEventListener("lostpointercapture", event => end(event, true));
    pack.addEventListener("contextmenu", event => event.preventDefault());
    return { reset };
  }

  function swipe(element, { onMove, onEnd, onSwipe }) {
    let gesture = null;
    const down = event => {
      if (gesture || event.isPrimary === false || event.button > 0 || event.target.closest("button,input,select,a")) return;
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp, width: element.getBoundingClientRect().width };
      element.setPointerCapture?.(event.pointerId);
    };
    const move = event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 4) onMove(dx, dy);
    };
    const end = (event, cancelled = false) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const previous = gesture; gesture = null;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      const elapsed = Math.max(1, event.timeStamp - previous.at);
      const committed = !cancelled && Math.abs(dx) > Math.abs(dy) * 1.15 && (Math.abs(dx) > Math.max(34, previous.width * .14) || (Math.abs(dx) > 18 && Math.abs(dx) / elapsed > .4));
      if (committed) onSwipe(dx < 0 ? 1 : -1, dx);
      onEnd();
      if (element.hasPointerCapture?.(previous.id)) element.releasePointerCapture(previous.id);
    };
    const up = event => end(event), cancel = event => end(event, true);
    const listeners = [["pointerdown",down],["pointermove",move],["pointerup",up],["pointercancel",cancel],["lostpointercapture",cancel]];
    for (const [type, handler] of listeners) element.addEventListener(type, handler);
    return () => {
      for (const [type, handler] of listeners) element.removeEventListener(type, handler);
      const previous = gesture; gesture = null;
      if (previous && element.hasPointerCapture?.(previous.id)) element.releasePointerCapture(previous.id);
    };
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
  window.CardBoosterGesture = { attach, swipe, preventDoubleTapZoom };
})();
