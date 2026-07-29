import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { DialogProvider } from './components/shared/DialogProvider.tsx';
import { ThemeProvider } from './lib/ThemeContext.tsx';
import './index.css';

// After a new deploy, the hashed chunk filenames (DashboardView-xxxx.js etc.)
// change. A browser that already had the app open, or that has the old
// index.html cached, will try to fetch a lazy-loaded page's OLD filename,
// which 404s — Vite reports this as a 'vite:preloadError' on window. A
// single reload fetches the current index.html (with matching hashes) and
// resolves it. Guarded with sessionStorage so a genuine offline/network
// failure doesn't reload in a loop.
const RELOAD_FLAG = 'vite-reload-on-preload-error';
window.addEventListener('vite:preloadError', () => {
  if (!sessionStorage.getItem(RELOAD_FLAG)) {
    sessionStorage.setItem(RELOAD_FLAG, '1');
    window.location.reload();
  }
});
// Reaching this line means the current load succeeded, so clear the flag —
// otherwise a real preload error on some future deploy would only be
// allowed to auto-reload once, ever, per browser.
sessionStorage.removeItem(RELOAD_FLAG);

// Register the service worker so the browser recognizes this app as an
// installable PWA (Add to Home Screen / Install app). Registered after
// load so it never competes with the initial page render for bandwidth.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works fine without an active service worker,
      // it just won't be installable/offline-capable in that case.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ThemeProvider>
  </StrictMode>,
);
