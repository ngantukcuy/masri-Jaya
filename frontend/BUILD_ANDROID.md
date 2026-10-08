# Build APK Android — Masri Jaya POS

Project ini sudah dibungkus pakai **Capacitor**, jadi source code Android
native-nya (folder `android/`) sudah lengkap dan siap dibuka di Android
Studio. Yang belum bisa saya lakukan otomatis: **compile jadi file
`.apk` sungguhan**, karena proses itu butuh Android SDK + akses ke Google
Maven yang tidak tersedia di environment saya.

Ada 2 cara untuk lanjut — pilih salah satu.

---

## Cara A — Android Studio (paling standar, gratis, di laptop kamu)

**Yang dibutuhkan:** laptop Windows/Mac/Linux + [Android Studio](https://developer.android.com/studio) (gratis, sudah termasuk Android SDK).

1. Install Android Studio, buka sekali biar SDK-nya ke-download otomatis.
2. Extract folder project ini, buka terminal di folder `frontend/`.
3. Install dependency:
   ```
   npm install
   ```
4. Build web app + sync ke project Android:
   ```
   npm run android:sync
   ```
5. Buka project Android-nya:
   ```
   npm run android:open
   ```
   (ini akan membuka folder `android/` di Android Studio — pastikan Android Studio sudah ke-install duluan)
6. Di Android Studio, tunggu proses "Gradle Sync" selesai (auto jalan pertama kali, butuh internet).
7. Build APK: menu **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
8. Setelah selesai, klik notifikasi "locate" atau cari file di:
   `android/app/build/outputs/apk/debug/app-debug.apk`
9. File `.apk` itu tinggal di-transfer ke HP Android (lewat USB/link download/WhatsApp), lalu tinggal tap untuk install (aktifkan dulu "Izinkan install dari sumber tidak dikenal" di HP kalau diminta).

> Catatan: `app-debug.apk` cukup buat dites sendiri / dibagikan ke tim.
> Kalau mau disebar lebih luas / upload ke Play Store, perlu **signed
> release APK/AAB** — ada wizard-nya juga di Android Studio: **Build →
> Generate Signed Bundle / APK**, tinggal ikuti langkahnya (bikin
> keystore sendiri, simpan baik-baik file keystore-nya, itu kunci
> update aplikasi kamu selamanya).

---

## Cara B — PWABuilder.com (tanpa install apa-apa, tapi website-nya harus sudah live)

Kalau kamu tidak mau install Android Studio, ini jalan pintas:

1. Deploy dulu website ini ke hosting dengan **HTTPS** (mis. Vercel, Netlify, atau server kamu sendiri).
2. Buka **https://www.pwabuilder.com**
3. Masukkan URL website kamu yang sudah live.
4. PWABuilder otomatis membaca `manifest.webmanifest` & service worker yang sudah saya siapkan di project ini.
5. Pilih **Android**, generate paket → download file `.apk`/`.aab` langsung dari browser, tanpa perlu Android Studio sama sekali.

---

## Perlu diketahui

- App ID: `com.masrijaya.pos` — ini identitas unik app kamu, jangan diubah-ubah setelah publish (kalau nanti daftar ke Play Store, ID ini permanen).
- Nama app & ikon sudah saya set otomatis (logo "MJ" biru, sama seperti ikon PWA).
- Setiap kali kamu update kode web-nya, ulangi langkah `npm run android:sync` supaya APK ikut ter-update sebelum di-build ulang.

---

## Printer thermal (Bluetooth) di APK

WebView di dalam APK tidak mendukung Web Bluetooth/WebUSB, jadi APK memakai
plugin native sendiri: `android/app/src/main/java/com/masrijaya/pos/BluetoothPrinterPlugin.java`
(Bluetooth Classic / SPP — jenis yang dipakai hampir semua printer thermal 58mm).
Tidak ada dependency npm tambahan; cukup `npm run android:sync` lalu build ulang di Android Studio.

Cara pakai di HP:
1. Nyalakan printer, buka **Pengaturan > Bluetooth** HP, pasangkan (pair) printer (PIN biasanya `0000` atau `1234`).
2. Buka app > **Pengaturan > Printer** > tambah printer (jenis **Bluetooth**) > **Sambungkan** > pilih printer dari daftar.
3. Android 12+ akan meminta izin "Perangkat di sekitar" — pilih **Izinkan**.
4. Setelah itu app mengingat printer di HP ini dan mencoba menyambung ulang otomatis saat mencetak.

Di browser (web): tetap pakai Web Bluetooth (printer BLE) / WebUSB di Chrome atau Edge lewat HTTPS.
Kalau tidak ada printer yang tersambung, cetak otomatis jatuh ke PDF 58mm seperti sebelumnya.
