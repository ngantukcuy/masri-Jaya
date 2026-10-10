// Status pengiriman barang per invoice.
//
// Tiga angka per barang:
// - quantity            : jumlah dibeli
// - deliveredQuantity   : jumlah yang SUDAH MASUK surat jalan yang dicetak (di jalan / sudah sampai)
// - receivedQuantity    : jumlah yang sudah DIKONFIRMASI sampai ke pelanggan
//
// "Dalam pengiriman" = sudah di surat jalan tapi belum dikonfirmasi sampai.
// Data lama tidak punya receivedQuantity -> dianggap sudah sampai sebanyak
// deliveredQuantity (perilaku sebelum ada konfirmasi), supaya invoice lama
// tidak tiba-tiba berstatus "dalam pengiriman".

import type { SalesInvoice, SalesInvoiceItem } from '../types/sales';
import { roundQty } from './quantity';

export const printedQty = (item: SalesInvoiceItem): number => item.deliveredQuantity || 0;

export const receivedQty = (item: SalesInvoiceItem): number =>
  roundQty(Math.min(item.quantity, item.receivedQuantity ?? item.deliveredQuantity ?? 0));

export const inTransitQty = (item: SalesInvoiceItem): number =>
  roundQty(Math.max(0, printedQty(item) - receivedQty(item)));

export const notYetSentQty = (item: SalesInvoiceItem): number =>
  roundQty(Math.max(0, item.quantity - printedQty(item)));

export type DeliveryState = 'Belum diantar' | 'Dalam pengiriman' | 'Sebagian terkirim' | 'Terkirim';

export function getDeliveryState(invoice: SalesInvoice): DeliveryState {
  const items = invoice.items;
  const allReceived = items.every((item) => receivedQty(item) >= item.quantity);
  if (allReceived) return 'Terkirim';
  if (items.some((item) => inTransitQty(item) > 0)) return 'Dalam pengiriman';
  if (items.some((item) => receivedQty(item) > 0)) return 'Sebagian terkirim';
  return 'Belum diantar';
}

export const deliveryStateStyle: Record<DeliveryState, string> = {
  'Belum diantar': 'bg-red-50 text-red-700',
  'Dalam pengiriman': 'bg-amber-50 text-amber-700',
  'Sebagian terkirim': 'bg-blue-50 text-blue-700',
  Terkirim: 'bg-emerald-50 text-emerald-700',
};
