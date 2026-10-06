# Backend

Backend app ini adalah Supabase (Postgres) — tidak ada server/API custom yang
perlu di-hosting sendiri; frontend bicara langsung ke Supabase pakai
`@supabase/supabase-js`.

## Database: tabel per kolom

Setiap data bisnis = tabel sungguhan dengan kolom sungguhan (bukan JSON
`key/data`). Item bersarang (item invoice, item PO, mutasi kas, dst.) = tabel
anak sendiri. Definisi tabel ada di **satu file**:
`../frontend/src/lib/db/spec.json` — dipakai frontend (mapping baris ⇄ objek)
sekaligus generator SQL.

Urutan menjalankan di Supabase Dashboard → SQL Editor:

0. (Urutan lengkap ada di bawah — file baru: `security_notifications.sql`.)
1. `supabase/schema.sql` — buat tabel, RLS, realtime, storage bucket, fungsi
   `replace_children`. Aman diulang. Kalau ada tabel skema lama (key/data),
   otomatis diganti nama jadi `legacy_<nama>` (tidak dihapus).
2. `supabase/migrate_from_legacy.sql` — (opsional) pindahkan data dari tabel
   `legacy_*` ke tabel baru. Aman diulang.
3. `supabase/security_notifications.sql` — **login aman + notifikasi** (lihat bagian di bawah).
4. `supabase/audit_log.sql` — jejak perubahan.
5. Deploy ulang edge function: `supabase functions deploy send-push`.

Jika penyimpanan keranjang POS gagal dengan constraint
`pos_cart_drafts_id_check`, jalankan `supabase/migrate_pos_cart_draft_id_constraint.sql`
di SQL Editor. Migrasi ini menghapus batasan ID lama yang hanya mengizinkan
draft tunggal; data keranjang tidak dihapus.

Mau nambah/ubah kolom? Edit `frontend/src/lib/db/spec.json`, lalu:

```
node backend/supabase/generate-schema.mjs   # tulis ulang schema.sql & migrate_from_legacy.sql
```

dan jalankan `schema.sql` lagi (menambah kolom yang belum ada, tidak menghapus data).

## Login PIN aman (kunci 5x salah + lupa PIN)

- PIN **tidak lagi disimpan di tabel yang bisa dibaca aplikasi**. Disimpan sebagai
  hash bcrypt di `staff_credentials`; login diperiksa lewat fungsi database
  `verify_login()`. PIN lama otomatis dipindah (di-hash) oleh `security_notifications.sql`.
- **5x PIN salah berturut-turut → akun terkunci permanen** (tanpa hitungan mundur).
  Layar login menampilkan "Akun terkunci" + email Owner yang disamarkan.
- Akun staf yang terkunci dibuka Owner di **Pengaturan → Staf → Buka Kunci** (wajib PIN Owner).
- Akun **Owner** yang terkunci / lupa PIN: tombol **"Lupa PIN? Kirim link reset ke email Owner"**
  di layar login. Link membawa Owner kembali ke aplikasi untuk membuat PIN baru
  (sekaligus membuka kunci). Yang bisa reset hanya pemilik email toko.
- Setiap ganti PIN wajib konfirmasi PIN Owner.

### Setting Supabase yang dibutuhkan untuk "Lupa PIN"
1. Dashboard → **Authentication → URL Configuration**: isi *Site URL* dengan alamat aplikasi
   dan tambahkan alamat yang sama (mis. `https://tokomu.com/**`, `http://localhost:5173/**`)
   ke *Redirect URLs*.
2. **Authentication → Sign In / Providers**: pastikan **Email** aktif (Anonymous tetap aktif).
3. Email bawaan Supabase dibatasi beberapa email per jam. Untuk pemakaian nyata, pasang
   SMTP sendiri di **Authentication → SMTP Settings**.
4. Link dibuka di browser. Kalau kamu memakai app Android, buka link emailnya di browser
   HP/komputer — PIN barunya langsung berlaku di semua perangkat (database yang sama).

## Notifikasi push

Trigger di database menulis satu baris ke tabel `notification_events` untuk tiap kejadian;
edge function `send-push` mengirimnya ke perangkat yang role-nya sesuai.

| Kejadian | Dikirim ke |
|---|---|
| Stok menipis / stok habis (saat melewati batas) | Owner, Admin, Stoker |
| Transaksi baru | Owner, Admin |
| Percobaan login gagal (tiap salah) | Owner |
| Akun terkunci (5x salah) / akun dibuka / PIN diubah / PIN direset email | Owner (+Admin untuk terkunci) |
| Retur baru / retur menunggu persetujuan | Owner, Admin |
| Persetujuan barang masuk/keluar (stok opname) | Owner, Admin |
| Pengeluaran menunggu persetujuan | Owner, Admin |
| Permintaan hapus transaksi | Owner, Admin |
| PO baru / PO diterima | Owner, Admin, Stoker |
| Pengajuan pembayaran bon supplier menunggu persetujuan | Owner, Admin |
| Pembayaran hutang supplier | Owner, Admin |
| Top up deposit / tarik deposit / pelunasan piutang pelanggan | Owner, Admin |
| Kas harian dibuka / ditutup (dengan **selisih** kalau ada) | Owner |

### Pasang webhook (cukup SATU)
Dashboard → **Database → Webhooks → Create**: tabel `notification_events`, event **Insert**,
tipe *Supabase Edge Functions* → `send-push`. **Hapus webhook lama** yang menempel di
tabel-tabel lain (kalau ada), supaya notifikasi tidak dobel.

Mau ubah siapa menerima apa atau menambah kejadian baru? Edit fungsi `trg_notify_*` di
`security_notifications.sql` (pemanggilan `_notify(kind, judul, isi, array[role...])`).
