// Minimal ESC/POS command encoder for thermal receipt printers. ESC/POS is
// the de-facto standard command set almost all 58mm/80mm thermal printers
// understand, regardless of whether they're connected over Bluetooth or USB
// — see printerConnection.ts for the two transports this app supports.
//
// This only implements the handful of commands an ERP receipt actually
// needs (init, plain text, bold, alignment, line feed, partial cut). It's
// intentionally small rather than a full ESC/POS library.

import type { SalesInvoice } from '../../types';

const ESC = 0x1b;
const GS = 0x1d;

export type EscPosAlign = 'left' | 'center' | 'right';

export class EscPosBuilder {
  private parts: Uint8Array[] = [];

  private push(bytes: number[] | Uint8Array) {
    this.parts.push(bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes));
    return this;
  }

  /** Resets the printer to its default state. Always call this first. */
  init() {
    return this.push([ESC, 0x40]);
  }

  text(str: string) {
    return this.push(new TextEncoder().encode(str));
  }

  line(str: string = '') {
    this.text(str);
    return this.push([0x0a]);
  }

  newline(count: number = 1) {
    for (let i = 0; i < count; i++) this.push([0x0a]);
    return this;
  }

  bold(on: boolean) {
    return this.push([ESC, 0x45, on ? 1 : 0]);
  }

  align(mode: EscPosAlign) {
    const value = mode === 'left' ? 0 : mode === 'center' ? 1 : 2;
    return this.push([ESC, 0x61, value]);
  }

  /** A full-width dashed divider — handy between receipt sections. */
  divider(char: string = '-', width: number = 32) {
    return this.line(char.repeat(width));
  }

  /** Feeds a few lines then does a partial cut. Most (not all) thermal printers support GS V. */
  feedAndCut(feedLines: number = 3) {
    this.newline(feedLines);
    return this.push([GS, 0x56, 0x01]);
  }

  build(): Uint8Array {
    const total = this.parts.reduce((sum, p) => sum + p.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const p of this.parts) {
      out.set(p, offset);
      offset += p.length;
    }
    return out;
  }
}

/** A short receipt used by the "Cetak Test Roll" button in Pengaturan > Printer. */
export function buildTestPrint(printerName: string, storeName?: string): Uint8Array {
  const now = new Date();
  return new EscPosBuilder()
    .init()
    .align('center')
    .bold(true)
    .line(storeName || 'Masri Jaya')
    .bold(false)
    .line('TEST PRINT')
    .divider()
    .align('left')
    .line(`Printer : ${printerName}`)
    .line(`Waktu   : ${now.toLocaleString('id-ID')}`)
    .divider()
    .align('center')
    .line('Jika teks ini tercetak dengan')
    .line('rapi, koneksi printer sukses.')
    .feedAndCut(4)
    .build();
}

interface ReceiptStoreProfile {
  storeName: string;
  address?: string;
  phone?: string;
  receiptNote?: string;
}

// A 58mm roll fits ~32 monospace characters per line, 80mm fits ~42. 32 is
// the safer default since it's still readable on an 80mm roll (just with
// extra margin), while a receipt built for 42 chars would wrap badly on the
// far more common 58mm printers.
const RECEIPT_WIDTH = 32;

function padRight(str: string, width: number): string {
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

/** Right-aligns `right` on the same line as `left`, truncating `left` if there isn't room. */
function twoColumns(left: string, right: string, width: number = RECEIPT_WIDTH): string {
  const space = Math.max(1, width - right.length);
  const leftTrimmed = left.length > space ? left.slice(0, Math.max(0, space - 1)) : left;
  return padRight(leftTrimmed, space) + right;
}

function formatRupiah(value: number): string {
  return `Rp ${Math.round(value).toLocaleString('id-ID')}`;
}

/**
 * The real receipt sent to a connected Bluetooth/USB thermal printer for an
 * actual sale — used both right after checkout in Kasir and when
 * re-printing "Cetak Thermal" from Riwayat Transaksi. This is what
 * `handle.send()` (see printerConnection.ts) should be given; it is
 * intentionally separate from buildTestPrint above, which only proves the
 * connection itself works and carries no real transaction data.
 */
export function buildInvoiceReceipt(
  invoice: SalesInvoice,
  storeProfile: ReceiptStoreProfile | undefined,
  cashierName: string | undefined,
  isReprint: boolean = false
): Uint8Array {
  const storeName = storeProfile?.storeName || 'Toko Saya';
  const b = new EscPosBuilder().init().align('center').bold(true).line(storeName).bold(false);

  if (storeProfile?.address) b.line(storeProfile.address);
  if (storeProfile?.phone) b.line(`Tel: ${storeProfile.phone}`);

  b.line('STRUK PEMBELIAN').divider('-', RECEIPT_WIDTH).align('left');
  b.line(`Invoice : ${invoice.invoiceNumber}`);
  b.line(`Tanggal : ${invoice.date}`);
  b.line(`Kasir   : ${cashierName || 'Staff Aktif'}`);
  b.line(`Pelanggan: ${invoice.customerName}`);
  b.line(`Metode  : ${invoice.paymentMethod === 'Cash' ? 'TUNAI' : invoice.paymentMethod}`);

  if (invoice.paymentMethod === 'Transfer' && invoice.paymentAccountName) {
    b.line(`Rekening: ${invoice.paymentAccountName}`);
    b.line(`No.Rek  : ${invoice.paymentAccountNumber || '-'}`);
  }
  if (invoice.fulfillmentMethod) {
    b.line(`Ambil   : ${invoice.fulfillmentMethod === 'Delivery' ? 'DIANTAR' : 'AMBIL SENDIRI'}`);
  }
  if (invoice.fulfillmentMethod === 'Delivery' && invoice.deliveryAddress) {
    b.line(`Alamat  : ${invoice.deliveryAddress}`);
  }

  b.divider('-', RECEIPT_WIDTH);
  for (const item of invoice.items) {
    b.line(item.name);
    const qtyUnit = `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
    const lineTotal = item.bonus ? 0 : item.price * item.quantity;
    b.line(twoColumns(`  ${qtyUnit} x ${formatRupiah(item.bonus ? 0 : item.price)}`, formatRupiah(lineTotal)));
  }
  b.divider('-', RECEIPT_WIDTH);

  const subtotal = invoice.subtotal ?? invoice.items.reduce((acc, it) => acc + it.price * it.quantity, 0);
  b.line(twoColumns('Subtotal', formatRupiah(subtotal)));

  const additionalFee = invoice.additionalFees?.reduce((acc, fee) => acc + fee.amount, 0) ?? invoice.additionalFee ?? 0;
  if (additionalFee) b.line(twoColumns('Biaya Tambahan', formatRupiah(additionalFee)));

  if (invoice.discountAmount) {
    const label = invoice.discountType === 'fixed' ? 'Diskon' : `Diskon (${invoice.discountValue || 0}%)`;
    b.line(twoColumns(label, `-${formatRupiah(invoice.discountAmount)}`));
  }

  b.bold(true).line(twoColumns('TOTAL', formatRupiah(invoice.total))).bold(false);

  if (invoice.paymentMethod === 'Cash' && typeof invoice.cashReceived === 'number') {
    b.line(twoColumns('Tunai', formatRupiah(invoice.cashReceived)));
    b.line(twoColumns('Kembali', formatRupiah(invoice.changeAmount || 0)));
  }
  if (invoice.paymentMethod === 'Split' && typeof invoice.splitPaidAmount === 'number') {
    b.line(twoColumns('Dibayar', formatRupiah(invoice.splitPaidAmount)));
  }
  if (invoice.paymentMethod === 'Split' || invoice.paymentMethod === 'Piutang') {
    b.line(twoColumns('Sisa (Piutang)', formatRupiah(invoice.splitRemainingDebt || 0)));
    if (invoice.splitDueDate) {
      b.line(`Jatuh Tempo: ${new Date(`${invoice.splitDueDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    }
  }

  b.divider('-', RECEIPT_WIDTH).align('center');
  b.line(storeProfile?.receiptNote || `Terima kasih telah berbelanja di ${storeName}!`);
  if (isReprint) b.line('(Cetak ulang dari Riwayat Transaksi)');
  b.feedAndCut(4);

  return b.build();
}
