# ⚠️ WAJIB DIBACA DULU

## 1. KREDENSIAL FIREBASE KAMU BOCOR — ROTATE SEKARANG

Di dalam project yang kamu upload, private key service account Firebase
(`panglong-af0b8`) ada dalam bentuk mentah/plaintext di **3 tempat**:

1. `frontend/panglong-af0b8-firebase-adminsdk-fbsvc-8ab5b390e7.json` (file JSON-nya sendiri)
2. `frontend/.gitignore` (private key-nya ke-paste utuh sebagai salah satu baris — kemungkinan besar dari copy-paste yang salah)
3. `backend/supabase/.env` (sebagai isi `FCM_SERVICE_ACCOUNT_JSON`)

Kalau file-file ini pernah ke-push ke Git (GitHub/GitLab dsb), key ini
harus dianggap **sudah bocor ke publik**, walau repo-nya private sekalipun
(history git, CI logs, dsb).

**Langkah wajib, sekarang juga:**
1. Buka [Firebase Console](https://console.firebase.google.com) → project
   `panglong-af0b8` → ⚙️ Project Settings → tab **Service accounts**.
2. Cari key dengan ID `8ab5b390e73d96f5a003e5a9e8ec5e64f227dfd9` → **hapus/revoke**.
3. Generate key baru (**Generate new private key**).
4. Set key baru itu sebagai Supabase secret (BUKAN file/commit):
   ```
   supabase secrets set FCM_SERVICE_ACCOUNT_JSON='<isi json key baru>' --project-ref <PROJECT_REF>
   ```
5. Deploy ulang function `send-push` (lihat bagian 3 di bawah).
6. Kalau project ini pernah di-`git push`, sebaiknya juga cek riwayat commit
   (`git log --all --full-history -- "*firebase-adminsdk*"`) dan pertimbangkan
   membersihkan history (`git filter-repo` / BFG) — bukan cuma hapus file di
   commit terbaru, karena versi lama tetap ada di history.

File `frontend/panglong-af0b8-firebase-adminsdk-fbsvc-8ab5b390e7.json` dan
isi `backend/supabase/.env` **tidak saya sertakan ulang** di paket file
perbaikan ini — hapus manual dari foldermu, lalu ganti dengan key yang baru.

---

## 2. Fitur push notifikasi — apa yang rusak & sudah diperbaiki

Saya cek `backend/supabase/functions/send-push/` dan `frontend/src/lib/push/`.
Ada 3 bug yang membuat notif **tidak pernah terkirim sama sekali**:

| # | Bug | File | Dampak |
|---|-----|------|--------|
| 1 | **Tidak ada `Deno.serve(...)`** — seluruh file `index.ts` cuma berisi definisi fungsi, tidak pernah dijalankan sebagai HTTP handler | `backend/supabase/functions/send-push/index.ts` | Function ter-deploy tapi diam total setiap dipanggil Database Webhook |
| 2 | Query token pakai kolom `role` & `branch_id` yang **tidak ada** di tabel `push_tokens` (tabel itu cuma punya `key` + `data` jsonb, sama seperti tabel lain di schema ini) | sama | Query akan gagal/error setiap saat |
| 3 | Role yang dicek (`owner`, `admin`, `warehouse`) tidak cocok dengan role asli staff (`Owner`, `Admin`, `Kasir`, `Stoker` — lihat `permissions.ts`), dan client tidak pernah menyimpan role staff ke token sama sekali | `index.ts` + `pushNotifications.ts` | Bahkan kalau bug #1–2 tidak ada, filter role tidak akan pernah cocok |

**Yang sudah saya perbaiki** (ada di paket file ini):
- `backend/supabase/functions/send-push/index.ts` — tambah `Deno.serve()`, perbaiki query token supaya baca dari `data` (jsonb) bukan kolom yang tidak ada, dan samakan nama role dengan `StaffRole` yang asli.
- `frontend/src/lib/push/pushNotifications.ts` — sekarang menyimpan `role` staff yang login ke dalam token, jadi Edge Function bisa memfilter dengan benar.
- `frontend/src/App.tsx` — kirim `currentUser.role` ke `initPushNotifications`.

**Langkah setelah menimpa file-file ini ke project kamu:**
```bash
cd backend
supabase functions deploy send-push --project-ref <PROJECT_REF> --no-verify-jwt
```
Lalu build ulang APK Android (`npm run android:sync` di folder `frontend`)
supaya token push yang baru terdaftar membawa `role` yang benar. Token lama
yang sudah tersimpan sebelum perbaikan ini **tidak punya `role`** dan tidak
akan dapat notif — otomatis akan terganti begitu staff login ulang di app
versi baru (device register ulang tiap app dibuka & login).

Catatan: filter `branchId` di edge function saya biarkan opsional/tidak
memfilter apa pun kalau kosong — di frontend saat ini belum ada konsep staff
terikat ke satu cabang tertentu, jadi saya tidak menambah fitur baru di luar
permintaan perbaikan bug ini.

---

## 3. Pembersihan file/folder yang tidak perlu

Zip yang kamu upload (381MB) berisi banyak hal yang **seharusnya tidak ada**
di project source / tidak perlu dikirim ulang-ulang:

| Folder/File | Ukuran | Kenapa harus dibuang |
|---|---|---|
| `frontend/node_modules/` | 280MB | Hasil `npm install`, generate ulang kapan saja |
| `frontend/dist/` | 13MB | Hasil build (`npm run build`), bukan source |
| `frontend/android/app/build/` | — | Build artifact Android/Gradle |
| `supabase/.temp/`, `backend/supabase/.temp/`, `frontend/supabase/.temp/`, `backend/supabase/supabase/` | — | Cache lokal Supabase CLI (link project), bukan source code — dan ada 4 salinan berbeda karena kebiasaan run `supabase link` dari folder yang salah |
| `frontend/panglong-af0b8-firebase-adminsdk-fbsvc-8ab5b390e7.json` | — | Kredensial rahasia, lihat bagian 1 |
| `backend/supabase/.env` | — | Berisi kredensial rahasia (isinya sama, key FCM) — harusnya cuma ada di local machine kamu, tidak ikut di-zip/commit |

**Saya sudah tambahkan `.gitignore` yang tadinya tidak ada sama sekali**
(sebelumnya hanya `frontend/.gitignore` yang ada, itu pun berisi private key
yang bocor — sudah saya bersihkan):
- `.gitignore` (root, baru — sebelumnya tidak ada)
- `backend/.gitignore` (baru — sebelumnya tidak ada)
- `frontend/.gitignore` (dibersihkan dari private key yang ke-paste)

Jalankan ini sekali di root project kamu untuk membuang semua folder/file
di atas dari working directory (aman, semuanya bisa di-generate ulang
kecuali 2 file kredensial yang memang harus dihapus manual selamanya):

```bash
# jalankan dari root project (folder yang ada package.json paling luar)
rm -rf frontend/node_modules frontend/dist
rm -rf frontend/android/app/build frontend/android/build frontend/android/.gradle
rm -rf supabase/.temp backend/supabase/.temp frontend/supabase/.temp backend/supabase/supabase
rm -f frontend/panglong-af0b8-firebase-adminsdk-fbsvc-8ab5b390e7.json
rm -f backend/supabase/.env

# generate ulang saat butuh:
cd frontend && npm install && npm run build
```

Setelah ini, ukuran project harusnya turun dari ~381MB jadi cuma beberapa MB
(source code murni).
