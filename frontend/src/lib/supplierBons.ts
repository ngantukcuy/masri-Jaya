import { PO } from '../types';

/** Bon Cash/Transfer dianggap lunas saat barang diterima; bon Tempo (atau bon
 * lama tanpa metode bayar) baru lunas setelah dibayar penuh (bisa dicicil).
 * Aturan yang sama dengan halaman Pembayaran > Pembayaran ke Supplier. */
export const isPOPaid = (po: PO) => !!po.paidAt || po.paymentMethod === 'Cash' || po.paymentMethod === 'Transfer';

export const poRemaining = (po: PO) => Math.max(0, po.total - (po.paidAmount || 0));

/** Bon yang sudah benar-benar jadi belanja/utang: sudah diterima atau sedang
 * dalam perjalanan (Draft/Disetujui/Dipesan belum dihitung). */
export const isSupplierBon = (po: PO) => po.status === 'Received' || po.status === 'In Transit' || !!po.receivedAt;

export const normalizeSupplierName = (name: string) => name.trim().toLowerCase();

export interface SupplierStats {
  bons: PO[];
  totalBelanja: number;
  totalUtang: number;
  unpaidCount: number;
}

/** Ringkasan per supplier (kunci: nama supplier yang sudah dinormalisasi). */
export function buildSupplierStats(pos: PO[]): Map<string, SupplierStats> {
  const map = new Map<string, SupplierStats>();
  pos
    .filter(isSupplierBon)
    .sort((a, b) => (b.receivedAt || b.createdDate).localeCompare(a.receivedAt || a.createdDate))
    .forEach((po) => {
      const key = normalizeSupplierName(po.supplier || '');
      const stats = map.get(key) ?? { bons: [], totalBelanja: 0, totalUtang: 0, unpaidCount: 0 };
      stats.bons.push(po);
      stats.totalBelanja += po.total;
      if (!isPOPaid(po)) {
        stats.totalUtang += poRemaining(po);
        stats.unpaidCount += 1;
      }
      map.set(key, stats);
    });
  return map;
}
