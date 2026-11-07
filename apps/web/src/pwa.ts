/**
 * Registers the service worker (public/sw.js) so the browser offers to install the interface. Only in the production
 * build: the dev server would serve stale files from a cache. Needs a secure context (HTTPS or localhost).
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) {
    return;
  }
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
      console.warn('Service worker could not be registered', error);
    });
  });
}
