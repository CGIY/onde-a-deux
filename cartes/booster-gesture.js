/* Input only: no storage, network, account or inventory access. */
(() => {
  "use strict";
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  function attach(pack, { surface = pack, isLocked, onProgress, onCommit, onStep = () => {}, onPose = () => {}, onMode = () => {} }) {
    let gesture = null, pose = { x: 3, y: -12, z: -2 };
    const release = id => { if (surface.hasPointerCapture?.(id)) surface.releasePointerCapture(id); };
    const reset = () => {
      const previous = gesture;
      gesture = null;
      pack.classList.remove("dragging", "inspecting");
      if (previous) release(previous.id);
      pose = { x: 3, y: -12, z: -2 };
      onPose(pose); onProgress(0, 0); onMode("rest");
    };
    surface.addEventListener("pointerdown", event => {
      if (isLocked() || gesture || event.isPrimary === false || event.button > 0 || event.target.closest?.("button,input,select,a")) return;
      const rect = pack.getBoundingClientRect();
      const height = rect.height || rect.width * 1.48;
      const inside = event.clientX >= rect.left && event.clientX <= rect.left + rect.width && event.clientY >= rect.top && event.clientY <= rect.top + height;
      // The seam can be approached from either side, well outside the wrapper.
      if (!inside && (event.clientY < rect.top - 110 || event.clientY > rect.top + height * .43)) return;
      const direction = event.clientX > rect.left + rect.width * .55 ? -1 : 1;
      const mode = inside && event.clientY - rect.top > height * .29 ? "inspect" : "tear";
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, entry: clamp(event.clientX, rect.left + rect.width * .04, rect.left + rect.width * .96), direction, width: rect.width, height, step: 0, mode, pose: { ...pose }, progress: 0, velocity: 0, lastX: event.clientX, lastAt: event.timeStamp };
      pack.dataset.tearDirection = direction === 1 ? "right" : "left";
      surface.setPointerCapture?.(event.pointerId);
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
    surface.addEventListener("pointermove", event => {
      if (!gesture || gesture.id !== event.pointerId || isLocked()) return;
      const rawX = event.clientX - gesture.x, rawY = event.clientY - gesture.y;
      const dx = rawX * gesture.direction, dy = Math.abs(rawY);
      if (gesture.mode === "inspect") {
        pose = { x: clamp(gesture.pose.x - rawY / gesture.height * 50, -22, 22), y: clamp(gesture.pose.y + rawX / gesture.width * 65, -42, 42), z: clamp(rawX / gesture.width * 5, -5, 5) };
        onPose(pose);
        return;
      }
      if (dy > 110 && dy > Math.abs(dx) * 2) return reset();
      const angle = clamp(Math.atan2(rawY, Math.max(1, dx)) * 180 / Math.PI, -48, 48) * gesture.direction;
      // Crossing empty space never opens the pack: progress starts at its edge.
      const crossed = (event.clientX - gesture.entry) * gesture.direction;
      const progress = clamp(crossed / (gesture.width * .68), 0, 1);
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
    surface.addEventListener("pointerup", event => end(event));
    surface.addEventListener("pointercancel", event => end(event, true));
    // Touch starts with implicit capture on the child under the finger. Moving
    // capture to the modal emits a bubbling loss on that child, not a cancel.
    surface.addEventListener("lostpointercapture", event => { if (event.target === surface) end(event, true); });
    pack.addEventListener("contextmenu", event => event.preventDefault());
    return { reset };
  }

  function swipe(element, { onMove, onEnd, onSwipe, enabled = () => true, axis = "horizontal", includeButtons = false }) {
    let gesture = null, suppressClickUntil = 0;
    const down = event => {
      if (!enabled() || gesture || event.isPrimary === false || event.button > 0 || event.target.closest(includeButtons ? "input,select,a,[data-close-dialog]" : "button,input,select,a")) return;
      suppressClickUntil = 0; // A new intentional tap must never be swallowed.
      gesture = { id: event.pointerId, x: event.clientX, y: event.clientY, at: event.timeStamp, width: element.getBoundingClientRect().width };
    };
    const move = event => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const dx = event.clientX - gesture.x, dy = event.clientY - gesture.y;
      if ((axis === "both" ? Math.hypot(dx, dy) > 5 : Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 5)) {
        element.setPointerCapture?.(event.pointerId);
        onMove(dx, axis === "both" ? dy : 0);
      }
    };
    const end = (event, cancelled = false) => {
      if (!gesture || gesture.id !== event.pointerId) return;
      const previous = gesture; gesture = null;
      const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      const elapsed = Math.max(1, event.timeStamp - previous.at);
      const vertical = axis === "both" && Math.abs(dy) > Math.abs(dx);
      const distance = vertical ? dy : dx;
      const committed = !cancelled && enabled() && (axis === "both" || Math.abs(dx) > Math.abs(dy) * 1.15) && (Math.abs(distance) >= (axis === "both" ? 18 : 30) || (Math.abs(distance) >= 10 && Math.abs(distance) / elapsed > .35));
      if (committed) {
        suppressClickUntil = event.timeStamp + 120;
        onSwipe(distance < 0 ? 1 : -1, dx, axis === "both" ? dy : 0);
      }
      onEnd();
      if (element.hasPointerCapture?.(previous.id)) element.releasePointerCapture(previous.id);
    };
    const up = event => end(event), cancel = event => end(event, true);
    const lost = event => { if (event.target === element) end(event, true); };
    const click = event => { if (event.timeStamp <= suppressClickUntil) { event.preventDefault(); event.stopImmediatePropagation(); } };
    element.addEventListener("click", click, true);
    const listeners = [["pointerdown",down],["pointermove",move],["pointerup",up],["pointercancel",cancel],["lostpointercapture",lost]];
    for (const [type, handler] of listeners) element.addEventListener(type, handler);
    return () => {
      for (const [type, handler] of listeners) element.removeEventListener(type, handler);
      element.removeEventListener("click", click, true);
      const previous = gesture; gesture = null;
      if (previous && element.hasPointerCapture?.(previous.id)) element.releasePointerCapture(previous.id);
    };
  }

  // Clip a stroke against the card. Air cuts and taps do not count.
  function strokeLengthInside(a, b, rect) {
    const dx = b.x-a.x, dy = b.y-a.y;
    let start = 0, end = 1;
    for (const [p,q] of [[-dx,a.x-rect.left],[dx,rect.left+rect.width-a.x],[-dy,a.y-rect.top],[dy,rect.top+rect.height-a.y]]) {
      if (p === 0) { if (q < 0) return 0; continue; }
      const t = q/p;
      if (p < 0) start = Math.max(start,t); else end = Math.min(end,t);
      if (start > end) return 0;
    }
    return Math.hypot(dx,dy) * (end-start);
  }

  function slice(surface, { isLocked, getCardRect, onTrace, onCut }) {
    let gesture = null;
    const down = event => {
      if (isLocked() || gesture || event.isPrimary === false || event.button > 0 || event.target.closest("button,input,select,a")) return;
      gesture = { id:event.pointerId, start:{x:event.clientX,y:event.clientY}, last:{x:event.clientX,y:event.clientY} };
      surface.setPointerCapture?.(event.pointerId);
    };
    const move = event => {
      if (!gesture || event.pointerId !== gesture.id || isLocked()) return;
      const point = {x:event.clientX,y:event.clientY};
      if (Math.hypot(point.x-gesture.last.x,point.y-gesture.last.y) < 8) return;
      onTrace(gesture.last,point); gesture.last = point;
    };
    const end = (event, cancelled = false) => {
      if (!gesture || event.pointerId !== gesture.id) return;
      const previous = gesture; gesture = null;
      if (surface.hasPointerCapture?.(previous.id)) surface.releasePointerCapture(previous.id);
      const point = {x:event.clientX,y:event.clientY}, rect = getCardRect();
      if (!cancelled && !isLocked() && rect && strokeLengthInside(previous.start,point,rect) >= Math.min(30,rect.width*.12)) {
        onTrace(previous.start,point); onCut(previous.start,point,rect);
      }
    };
    const up = event => end(event), cancel = event => end(event,true);
    const lost = event => { if (event.target === surface) end(event,true); };
    const listeners = [["pointerdown",down],["pointermove",move],["pointerup",up],["pointercancel",cancel],["lostpointercapture",lost]];
    for (const [type,handler] of listeners) surface.addEventListener(type,handler);
    const reset = () => { const previous = gesture; gesture = null; if (previous && surface.hasPointerCapture?.(previous.id)) surface.releasePointerCapture(previous.id); };
    const cleanup = () => { for (const [type,handler] of listeners) surface.removeEventListener(type,handler); reset(); };
    cleanup.reset = reset;
    return cleanup;
  }

  // Split the card along the actual strokes, rather than using unrelated particles.
  function fragments(cuts) {
    let pieces = [[{x:0,y:0},{x:100,y:0},{x:100,y:100},{x:0,y:100}]];
    for (const [a,b] of cuts) {
      const side = p => (b.x-a.x)*(p.y-a.y)-(b.y-a.y)*(p.x-a.x);
      const half = (polygon,sign) => {
        const output = [];
        for (let i=0;i<polygon.length;i++) {
          const p=polygon[i], q=polygon[(i+1)%polygon.length], sp=side(p)*sign, sq=side(q)*sign;
          if (sp >= 0) output.push(p);
          if ((sp > 0 && sq < 0) || (sp < 0 && sq > 0)) {
            const t=sp/(sp-sq);output.push({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t});
          }
        }
        return output;
      };
      pieces = pieces.flatMap(piece => [half(piece,1),half(piece,-1)]).filter(piece => {
        const area=Math.abs(piece.reduce((sum,p,i)=>{const q=piece[(i+1)%piece.length];return sum+p.x*q.y-q.x*p.y;},0))/2;
        return area > .1;
      });
    }
    return pieces;
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
  window.CardBoosterGesture = { attach, swipe, slice, fragments, preventDoubleTapZoom };
})();
