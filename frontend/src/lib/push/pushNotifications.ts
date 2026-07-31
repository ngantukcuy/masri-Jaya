import { Capacitor } from '@capacitor/core';
import {
  PushNotifications,
  Token,
  PushNotificationSchema,
  ActionPerformed,
} from '@capacitor/push-notifications';
import { supabase } from '../supabase';

let initialized = false;

/**
 * Menyiapkan push notification — di app Android/iOS asli (Capacitor + FCM
 * native) MAUPUN di browser biasa/PWA (Firebase JS SDK + service worker,
 * lihat webPush.ts). Keduanya menyimpan token ke tabel Supabase
 * `push_tokens` YANG SAMA (dibedakan lewat `data.platform`:
 * 'android' | 'ios' | 'web'), jadi backend/supabase/functions/send-push
 * TIDAK PERLU tahu/berubah sama sekali soal platform mana yang dipakai —
 * dia kirim ke semua token yang cocok role-nya, apa pun platform-nya.
 *
 * Alurnya (native — Android/iOS, lewat Capacitor):
 *  1. Minta izin notifikasi ke user (wajib mulai Android 13 / API 33).
 *  2. Daftarkan device ini ke FCM lewat plugin Capacitor.
 *  3. Begitu dapat token FCM dari Google, simpan ke tabel Supabase
 *     `push_tokens` — inilah yang dibaca Edge Function `send-push` untuk
 *     tahu ke device mana notif harus dikirim saat ada transaksi baru,
 *     stok menipis, dll (lihat backend/supabase/functions/send-push).
 *
 * Alurnya (web — browser/PWA): didelegasikan ke `initWebPush()` di
 * `./webPush.ts` lewat dynamic import (supaya Firebase JS SDK-nya tidak
 * ikut ke-bundle di APK Android/iOS, yang tidak pernah lewat jalur ini).
 * Logic-nya beda (Firebase JS SDK + service worker, bukan plugin
 * Capacitor), tapi hasil akhirnya sama: token ke Supabase, event yang sama
 * ('tokku:push-received') buat menampilkan toast lewat PushToastListener.
 *
 * PENTING (native): butuh `google-services.json` (dari Firebase Console,
 * project Firebase Anda sendiri) diletakkan di `frontend/android/app/`.
 * Tanpa file itu, `PushNotifications.register()` akan gagal diam-diam.
 * PENTING (web): butuh Firebase Web config + VAPID key diisi di
 * `webPush.ts` (dan `public/sw.js`) — lihat komentar di file itu.
 * Lihat backend/supabase/functions/send-push/README.md untuk instruksi
 * setup lengkap keduanya.
 *
 * @param deviceLabel Nama yang ditampilkan untuk device ini (biasanya nama
 *   staff yang login), cuma buat label — tidak dipakai untuk filter.
 * @param role Role staff yang login ('Owner' | 'Admin' | 'Kasir' | 'Stoker',
 *   lihat src/lib/permissions.ts). WAJIB diisi supaya Edge Function
 *   `send-push` tahu device mana yang berhak menerima notif jenis
 *   tertentu (mis. cuma Owner/Admin yang dapat notif transaksi baru).
 *   Tanpa ini token tersimpan tapi tidak akan pernah menerima notif apa pun.
 */
export async function initPushNotifications(deviceLabel?: string, role?: string): Promise<void> {
  if (initialized) return;
  initialized = true;

  if (!Capacitor.isNativePlatform()) {
    // Browser (desktop/HP) atau PWA — logic-nya beda total dari Capacitor,
    // lihat webPush.ts.
    const { initWebPush } = await import('./webPush');
    await initWebPush(deviceLabel, role);
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }
    if (permStatus.receive !== 'granted') {
      console.warn('[push] Izin notifikasi ditolak oleh user, push notification tidak akan aktif.');
      return;
    }

    await PushNotifications.register();

    PushNotifications.addListener('registration', async (token: Token) => {
      try {
        const { error } = await supabase.from('push_tokens').upsert({
          key: token.value,
          data: {
            token: token.value,
            platform: Capacitor.getPlatform(),
            deviceLabel: deviceLabel || null,
            // Dibaca oleh backend/supabase/functions/send-push (loadTokens)
            // untuk menentukan siapa yang berhak dapat notif jenis ini.
            role: role || null,
            updatedAt: new Date().toISOString(),
          },
        });
        if (error) throw error;
      } catch (err) {
        console.error('[push] Gagal menyimpan token FCM ke Supabase:', err);
      }
    });

    PushNotifications.addListener('registrationError', (err) => {
      console.error('[push] Registrasi ke FCM gagal:', err);
    });

    // Notifikasi masuk saat app lagi dibuka (foreground). Di Android,
    // sistem otomatis menampilkan notif di status bar kalau app lagi di
    // background/ditutup — tapi kalau lagi dibuka, kita perlu tampilkan
    // sendiri (lihat PushToastListener.tsx yang mendengarkan event ini).
    PushNotifications.addListener('pushNotificationReceived', (notification: PushNotificationSchema) => {
      window.dispatchEvent(new CustomEvent('tokku:push-received', { detail: notification }));
    });

    // User ngetap notifnya (dari tray notifikasi, app lagi background/closed).
    PushNotifications.addListener('pushNotificationActionPerformed', (action: ActionPerformed) => {
      window.dispatchEvent(new CustomEvent('tokku:push-opened', { detail: action.notification }));
    });
  } catch (err) {
    console.error('[push] initPushNotifications gagal:', err);
  }
}

/** Hapus token device ini dari Supabase, misalnya dipanggil saat logout. */
export async function unregisterPushToken(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await PushNotifications.removeAllListeners();
  } catch (err) {
    console.error('[push] Gagal melepas listener push notification:', err);
  }
}
