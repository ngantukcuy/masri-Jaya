// Minimal service worker: exists mainly so the browser considers this app
// an installable PWA, plus a light app-shell cache so the last-loaded
// screen still renders if the device briefly loses connection.
// It deliberately does NOT try to cache/replay API calls (Supabase) — data
// freshness matters more than offline writes for a POS.

const CACHE_NAME = 'masrijaya-shell-v1';
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET requests for the app shell/static assets.
  // Everything else (Supabase REST/websocket, fonts, etc.) goes straight
  // to the network untouched.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match('/index.html')))
  );
});

// =============================================================================
// Push Notification (Web) lewat Firebase Cloud Messaging.
//
// Ini SATU-SATUNYA service worker di app (didaftarkan di src/main.tsx
// sebagai '/sw.js') — bagian caching PWA di atas dan bagian FCM di bawah
// ini sengaja digabung jadi satu file, supaya tidak ada 2 service worker
// rebutan scope root ('/') yang sama.
//
// notificationclick DITARUH DI ATAS importScripts (bukan bagian Firebase)
// dengan sengaja: kalau importScripts di bawah gagal load (mis. device
// lagi offline pas pertama kali install SW-nya), listener caching di atas
// dan listener klik notif ini tetap aktif — cuma bagian override Firebase
// yang tidak jalan.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});

// PENTING: firebaseConfig di bawah ini HARUS PERSIS SAMA dengan yang ada
// di frontend/src/lib/push/webPush.ts. File itu pakai config yang sama
// tapi service worker ini adalah file statis biasa yang TIDAK diproses
// Vite (tidak bisa baca import.meta.env/.env), jadi nilainya harus ditulis
// ulang manual di sini. Kalau ganti salah satu, ganti juga yang satunya.
// Nilai-nilai ini bukan rahasia (lihat komentar lengkap di webPush.ts).
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.17.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'GANTI_DENGAN_APIKEY_FIREBASE_WEB',
  authDomain: 'panglong-af0b8.firebaseapp.com',
  projectId: 'panglong-af0b8',
  storageBucket: 'panglong-af0b8.appspot.com',
  messagingSenderId: 'GANTI_DENGAN_SENDER_ID',
  appId: 'GANTI_DENGAN_APP_ID_WEB',
});

// Aman dipanggil walau config di atas masih placeholder "GANTI_..." — cuma
// tidak akan pernah menerima push beneran, karena tokennya juga tidak akan
// pernah ke-generate di sisi client (lihat isConfigured() di webPush.ts).
const messaging = firebase.messaging();

// Notifikasi masuk SAAT tab/app TIDAK fokus (background) atau browser lagi
// ditutup total. Kalau tab lagi kebuka & fokus, yang jalan itu onMessage()
// di webPush.ts (lewat custom event 'tokku:push-received' -> ditangkap
// PushToastListener.tsx) — BUKAN listener ini.
messaging.onBackgroundMessage((payload) => {
  const title = (payload && payload.notification && payload.notification.title) || 'Notifikasi Baru';
  self.registration.showNotification(title, {
    body: (payload && payload.notification && payload.notification.body) || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: (payload && payload.data) || {},
  });
});
