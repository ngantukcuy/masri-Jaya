// Kode SKU acak yang alfanumerik (bukan cuma angka), supaya lebih mirip
// kode SKU/barang di gudang beneran (mis. "SKU-7K2F9A") dan gak gampang
// ketuker sama nomor HP/nomor invoice yang emang full angka.
//
// Karakter yang gampang ketuker (0/O, 1/I/L) sengaja dibuang dari kumpulan
// karakter di bawah supaya kode tetap gampang dibaca & diketik manual kalau
// suatu saat harus diketik ulang (misalnya scanner-nya lagi rusak).
const SAFE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate kode SKU acak, format: `{prefix}-{kode acak alfanumerik}`.
 * Contoh: generateSkuCode() -> "SKU-7K2F9A"
 */
export function generateSkuCode(prefix = 'SKU', length = 6): string {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += SAFE_CHARS[Math.floor(Math.random() * SAFE_CHARS.length)];
  }
  return `${prefix}-${code}`;
}
