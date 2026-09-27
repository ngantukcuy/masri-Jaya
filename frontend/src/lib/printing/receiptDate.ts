// Short date/time formatting for thermal receipts ("28 Sep 2026, 21:28")
// instead of Indonesian's verbose `toLocaleDateString` long-form ("28
// September 2026 pukul 21.28"), which eats too much of a 32-char thermal
// line. Shared by both the raw ESC/POS builder (escpos.ts) and the PDF/print
// thermal builder (receiptPdf.ts) so a receipt printed from Kasir right
// after checkout and one reprinted later from Riwayat Transaksi always show
// the same format.

const INDO_MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

// Full Indonesian month names -> index, used only as a fallback to parse
// older `date` strings ("31 Juli 2026") for invoices saved before the
// `createdAt` ISO timestamp field existed.
const INDO_MONTHS_FULL: Record<string, number> = {
  januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
  juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
};

function parseFallbackDate(text: string): Date | null {
  const match = text.match(/(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!match) return null;
  const day = parseInt(match[1], 10);
  const month = INDO_MONTHS_FULL[match[2].toLowerCase()];
  const year = parseInt(match[3], 10);
  if (month === undefined || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month, day);
}

function resolveInvoiceDate(invoice: { date: string; createdAt?: string }): { d: Date; hasReliableTime: boolean } | null {
  let d: Date | null = null;
  if (invoice.createdAt) {
    const parsed = new Date(invoice.createdAt);
    if (!isNaN(parsed.getTime())) d = parsed;
  }
  const hasReliableTime = d !== null;
  if (!d) d = parseFallbackDate(invoice.date);
  if (!d) return null;
  return { d, hasReliableTime };
}

/**
 * Renders an invoice's date (and time, when known) as "28 Sep 2026, 21:28".
 * Prefers `createdAt` (ISO timestamp, present on every invoice created going
 * forward) since it's the only reliable source of the actual time-of-day.
 * Falls back to parsing the older long-form `date` text for legacy invoices
 * that predate `createdAt` — those print date-only, since the original time
 * was never captured. If nothing can be parsed, the original text is
 * returned unchanged rather than failing to print.
 */
export function formatReceiptDateTime(invoice: { date: string; createdAt?: string }): string {
  const resolved = resolveInvoiceDate(invoice);
  if (!resolved) return invoice.date;
  const { d, hasReliableTime } = resolved;

  const datePart = `${d.getDate()} ${INDO_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  if (!hasReliableTime) return datePart;

  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${datePart}, ${hh}:${mm}`;
}

/**
 * Same as `formatReceiptDateTime` but always date-only ("28 Sep 2026") — no
 * time, even when a reliable `createdAt` is available. Used on the surat
 * jalan (delivery note), where the clock time isn't relevant.
 */
export function formatReceiptDateOnly(invoice: { date: string; createdAt?: string }): string {
  const resolved = resolveInvoiceDate(invoice);
  if (!resolved) return invoice.date;
  const { d } = resolved;
  return `${d.getDate()} ${INDO_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}