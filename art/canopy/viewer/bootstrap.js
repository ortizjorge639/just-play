window.canopyTest = { ready: false, error: null, warnings: [] };
window.canopyFail = error => {
  const message = error?.message ?? String(error);
  window.canopyTest.error = message;
  window.canopyTest.ready = false;
  const show = () => {
    const panel = document.querySelector('#message');
    if (!panel) return;
    panel.hidden = false;
    panel.querySelector('strong').textContent = 'Local scene could not load';
    panel.querySelector('span').textContent = `${message}\nCheck the six core GLBs in the selected archive (approval-v003 by default). See the viewer README for CANOPY_ASSETS and WebGL support. Art approval is still pending.`;
    document.querySelector('#status').textContent = 'Not verified · load error';
    document.querySelector('fieldset').disabled = true;
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show, { once: true });
  else show();
};
window.addEventListener('error', event => {
  if (event.target instanceof HTMLScriptElement) window.canopyFail(`Could not load ${event.target.src || 'viewer module'}. Run npm install in web/.`);
  else if (event.message) window.canopyFail(event.message);
}, true);
window.addEventListener('unhandledrejection', event => window.canopyFail(event.reason));
