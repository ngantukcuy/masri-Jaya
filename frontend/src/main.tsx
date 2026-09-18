import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {Capacitor} from '@capacitor/core';
import App from './App.tsx';
import { DialogProvider } from './components/shared/DialogProvider.tsx';
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
//
// SKIP THIS ENTIRELY when running inside the native Android/iOS app
// (Capacitor). Terbukti dari debugging: fetch() yang dipanggil DARI DALAM
// service worker selalu gagal total di WebView Capacitor (walau fetch
// yang sama dari halaman utama berhasil normal) — begitu SW ini aktif
// dan mulai meng-intercept request, JS/CSS yang tadinya sudah termuat
// benar jadi gagal di-refetch, browser dapat balasan error, dan hasilnya
// layar putih total. Di dalam APK ini juga sama sekali tidak dibutuhkan:
// semua file sudah ikut ter-bundle langsung di dalam aplikasi, jadi tidak
// perlu caching lewat service worker supaya bisa jalan offline.
if (Capacitor.isNativePlatform()) {
  // PENTING: tidak cukup cuma "skip" pendaftaran SW baru di sini — kalau
  // HP ini sebelumnya pernah pakai APK versi LAMA (sebelum guard ini
  // ditambahkan), SW dari versi lama itu bisa saja masih terdaftar dan
  // aktif, karena storage WebView Capacitor tidak ikut terhapus waktu
  // APK di-update ke versi baru. SW lama yang masih nyangkut itu tetap
  // akan mulai meng-intercept request begitu app dibuka, dan hasilnya
  // tetap layar putih walau kode versi ini sudah tidak mendaftarkannya
  // lagi. Jadi begitu jalan di native, aktif bersihkan registrasi SW +
  // cache lama itu supaya app kembali normal secara otomatis, tanpa user
  // harus uninstall/install ulang manual.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => registrations.forEach((reg) => reg.unregister()))
      .catch(() => {});
  }
  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
} else if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Non-fatal: the app works fine without an active service worker,
      // it just won't be installable/offline-capable in that case.
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </StrictMode>,
);
