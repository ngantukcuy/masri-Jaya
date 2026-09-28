# Perubahan: Bayar Setelah Diantar + Stok Pasir/Kerikil/Tanah/Batu per Kubik

Timpa file dengan nama yang sama di project (struktur folder sama).

## 1. Bayar setelah barang diantar
- POS > Bayar > "Piutang / Bayar Setelah Diantar" > centang "Bayar setelah barang diantar"
  (otomatis tercentang kalau transaksi diantar / Delivery).
- Tercatat sebagai piutang jatuh tempo HARI INI, muncul di Utang & Piutang.
- Saat uang diterima dari pelanggan: Utang & Piutang > Bayar Cicilan > Bayar Lunas.

## 2. Stok pasir / kerikil / tanah timbun / batu mangga
1. Buat 1 produk sumber per material, satuan "Kubik", stok dalam kubik. Colt diesel masuk 9,6 kubik -> tambah 9,6.
2. Buat produk jual per takaran: "Pasir Pickup Besar" (Rp200.000), "Pasir Pickup Kecil" (Rp90.000).
3. Edit Produk pada tiap takaran > "Varian Takaran":
   - Stok Diambil Dari = Pasir
   - Pemakaian per 1 Unit = 1,2 (besar) / 0,5 (kecil)
4. Setiap terjual, stok Pasir berkurang otomatis; besar & kecil berbagi satu tumpukan stok.
Paku: tetap produk biasa (satuan kg / dus), tidak perlu varian.
