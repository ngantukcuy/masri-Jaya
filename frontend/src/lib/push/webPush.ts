import { initializeApp, getApps, getApp, type FirebaseOptions } from 'firebase/app';
import { getMessaging, getToken, onMessage, isSupported, type Messaging } from 'firebase/messaging';
import { supabase } from '../supabase';

/**
 * Konfigurasi Firebase untuk WEB — BEDA dari `google-services.json` yang
 * dipakai APK Android (itu config native, ini config buat browser).
 *
 * Cara ambil nilainya:
 *  1. Buka https://console.firebase.google.com -> project `panglong-af0b8`
 *     (project Firebase yang sama dengan yang dipakai APK Android).
 *  2. ⚙️ Project settings -> tab General -> scroll ke "Your apps".
 *  3. Kalau belum ada app Web (ikon "</>"), klik "Add app" -> pilih Web ->
 *     kasih nickname bebas (mis. "Tokku Web") -> JANGAN centang Firebase
 *     Hosting kalau tidak dipakai -> Register app.
 *  4. Firebase akan kasih object `firebaseConfig` persis seperti di bawah
 *     ini — copy semua isinya ke sini.
 *
 * PENTING: nilai-nilai ini BUKAN rahasia (beda dengan service account JSON
 * yang dipakai backend/supabase/functions/send-push) — aman ditaruh di
 * kode client walau repo-nya public sekalipun, karena keamanan sebenarnya
 * dijaga lewat Firebase Security Rules, bukan dengan menyembunyikan config
 * ini. Makanya di-hardcode langsung di sini (bukan lewat frontend/.env)
 * — SAMA seperti nilai ini juga harus di-paste ulang persis di
 * `frontend/public/sw.js` (service worker adalah file statis yang tidak
 * diproses Vite, jadi tidak bisa baca import.meta.env). Kalau ganti nilai
 * di salah satu tempat, INGAT ganti juga di tempat satunya.
 */
const firebaseConfig: FirebaseOptions = {
  apiKey: 'GANTI_DENGAN_APIKEY_FIREBASE_WEB',
  authDomain: 'panglong-af0b8.firebaseapp.com',
  projectId: 'panglong-af0b8',
  storageBucket: 'panglong-af0b8.appspot.com',
  messagingSenderId: 'GANTI_DENGAN_SENDER_ID',
  appId: 'GANTI_DENGAN_APP_ID_WEB',
};

/**
 * VAPID public key ("Web Push certificate"). Ambil dari:
 *   Firebase Console -> ⚙️ Project settings -> tab Cloud Messaging ->
 *   scroll ke bawah ke "Web Push certificates" -> kalau belum ada, klik
 *   "Generate key pair" -> copy "Key pair" yang muncul ke sini.
 * Sama seperti firebaseConfig di atas, ini juga bukan rahasia (public key).
 */
const VAPID_KEY = 'GANTI_DENGAN_VAPID_KEY';

/** True kalau nilai di atas sudah diisi beneran (bukan placeholder). */
function isConfigured(): boolean {
  return (
    !firebaseConfig.apiKey?.startsWith('GANTI_') &&
    !firebaseConfig.appId?.startsWith('GANTI_') &&
    !VAPID_KEY.startsWith('GANTI_')
  );
}

let messagingInstance: Messaging | null | undefined;

/** Lazy-init, dan return `null` kalau browser tidak didukung (mis. Safari lama, in-app browser tertentu). */
async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance !== undefined) return messagingInstance;
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    messagingInstance = null;
    return null;
  }
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  messagingInstance = getMessaging(app);
  return messagingInstance;
}

/**
 * Versi WEB dari `initPushNotifications` (lihat pushNotifications.ts) —
 * dipanggil otomatis lewat dynamic import dari sana kalau app lagi dibuka
 * di browser biasa/PWA, BUKAN di APK Android/iOS.
 *
 * Alurnya:
 *  1. Cek browser support (Notification API + Service Worker + FCM).
 *  2. Minta izin notifikasi ke user.
 *  3. Ambil token FCM lewat Firebase JS SDK, pakai service worker yang
 *     SAMA yang sudah didaftarkan main.tsx (`/sw.js`) — TIDAK register
 *     service worker baru di sini supaya tidak ada 2 SW rebutan scope.
 *  4. Simpan token ke tabel Supabase `push_tokens` — TABEL YANG SAMA
 *     dipakai APK Android (dibedakan lewat `data.platform: 'web'`), jadi
 *     backend/supabase/functions/send-push otomatis juga mengirim ke sini
 *     tanpa perlu diubah sama sekali.
 *  5. Dengar notif yang masuk saat tab lagi fokus (foreground) — background/
 *     tab tertutup ditangani oleh public/sw.js (onBackgroundMessage).
 *
 * @param deviceLabel Nama staff yang login, cuma buat label device.
 * @param role Role staff yang login — WAJIB diisi, sama seperti versi native,
 *   supaya Edge Function `send-push` bisa memfilter notif per role.
 */
export async function initWebPush(deviceLabel?: string, role?: string): Promise<void> {
  if (typeof window === 'undefined') return;

  if (!('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[push:web] Browser ini tidak mendukung notifikasi web.');
    return;
  }

  if (!isConfigured()) {
    console.warn(
      '[push:web] Firebase Web config belum diisi (masih placeholder "GANTI_...") di ' +
        'src/lib/push/webPush.ts — web push dilewati. Lihat komentar di file itu untuk cara isinya.'
    );
    return;
  }

  try {
    let permission = Notification.permission;
    if (permission === 'default') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      console.warn('[push:web] Izin notifikasi browser ditolak/belum diberikan oleh user.');
      return;
    }

    const messaging = await getMessagingInstance();
    if (!messaging) {
      console.warn('[push:web] Firebase Messaging tidak didukung di browser ini.');
      return;
    }

    // main.tsx sudah mendaftarkan '/sw.js' saat window 'load'. Tunggu
    // sampai aktif (bukan register ulang) supaya getToken() memakai
    // service worker yang sama persis yang juga menangani caching PWA.
    const registration = await navigator.serviceWorker.ready;

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });

    if (!token) {
      console.warn('[push:web] Tidak dapat token FCM (kemungkinan izin baru saja dicabut/browser menolak).');
      return;
    }

    const { error } = await supabase.from('push_tokens').upsert({
      key: token,
      data: {
        token,
        platform: 'web',
        deviceLabel: deviceLabel || null,
        // Dibaca oleh backend/supabase/functions/send-push (loadTokens),
        // sama persis seperti token Android/iOS.
        role: role || null,
        updatedAt: new Date().toISOString(),
      },
    });
    if (error) throw error;

    // Notif masuk saat TAB lagi fokus (foreground). Kalau tab tidak
    // fokus/browser ditutup, yang jalan adalah onBackgroundMessage() di
    // public/sw.js. Pakai custom event YANG SAMA dengan versi Android
    // ('tokku:push-received') supaya PushToastListener.tsx yang sudah ada
    // otomatis menampilkan toast yang sama — file itu tidak perlu diubah.
    onMessage(messaging, (payload) => {
      window.dispatchEvent(
        new CustomEvent('tokku:push-received', {
          detail: {
            title: payload.notification?.title,
            body: payload.notification?.body,
            data: payload.data,
          },
        })
      );
    });
  } catch (err) {
    console.error('[push:web] initWebPush gagal:', err);
  }
}
