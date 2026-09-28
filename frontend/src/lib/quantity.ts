/**
 * Helper jumlah pecahan (½ kg, ¼ kg, 1 ons, ½ batang, 3,5 meter, dst).
 *
 * Kenapa perlu: angka desimal di JavaScript suka "berisik" (0,1 × 3 =
 * 0,30000000000000004) dan total rupiah bisa jadi pecahan. Semua tempat yang
 * menampilkan jumlah / menghitung total baris sebaiknya lewat helper ini.
 */

/** Bulatkan jumlah ke 3 angka di belakang koma (cukup untuk gram / mm). */
export const roundQty = (n: number): number => Math.round((Number(n) || 0) * 1000) / 1000;

/** Tampilkan jumlah gaya Indonesia: 0,5 • 2,25 • 1.200 */
export const formatQty = (n: number): string =>
  roundQty(n).toLocaleString('id-ID', { maximumFractionDigits: 3 });

/** Total satu baris (harga per satuan × jumlah), dibulatkan ke rupiah utuh. */
export const lineAmount = (price: number, qty: number): number =>
  Math.round((Number(price) || 0) * (Number(qty) || 0));

/** Label pendek untuk tombol cepat: 0,25 → ¼, 0,5 → ½, 0,75 → ¾, selain itu angka biasa. */
export const fractionLabel = (n: number): string => {
  const r = roundQty(n);
  if (r === 0.25) return '¼';
  if (r === 0.5) return '½';
  if (r === 0.75) return '¾';
  return formatQty(r);
};
