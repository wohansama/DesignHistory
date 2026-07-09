export function createRenderLoop({ scene, camera, renderer, renderFn, onUpdate }) {
  let rafId = null;
  let running = false;
  const clock = { last: performance.now() };

  function frame() {
    const now = performance.now();
    const dt = (now - clock.last) / 1000; // seconds
    clock.last = now;
    if (onUpdate) onUpdate(dt);

    // If a custom render function is provided (e.g. selective bloom post-processing),
    // use it. Otherwise fall back to a direct renderer.render call.
    if (renderFn) {
      renderFn();
    } else {
      renderer.render(scene, camera);
    }

    if (running) rafId = requestAnimationFrame(frame);
  }

  return {
    start() {
      if (!running) {
        running = true;
        clock.last = performance.now();
        rafId = requestAnimationFrame(frame);
      }
    },
    stop() {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
    },
  };
}
