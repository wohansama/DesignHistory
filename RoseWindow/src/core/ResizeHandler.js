export function setupResize(camera, renderer, postProcessing) {
  function onResize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    // Keep the post-processing buffers in sync with the new canvas size.
    if (postProcessing) postProcessing.setSize(w, h);
  }
  window.addEventListener('resize', onResize);
  // Return dispose function for cleanup
  return () => window.removeEventListener('resize', onResize);
}
