// Builds adaptive time buckets for a given [from, to] date range, used by
// the Dashboard and Reports revenue trend charts so a cashier/owner can
// pick any custom date range and still get a readable chart instead of a
// hardcoded "last 6 weeks" / "last 12 months" window.
//
// Granularity adapts to the span so the chart never renders 1 bar or 400
// bars: <=31 days -> daily buckets, <=182 days -> weekly buckets,
// otherwise -> monthly buckets.

export interface DateBucket {
  label: string;
  start: Date;
  endExclusive: Date;
}

const pad = (n: number) => String(n).padStart(2, '0');
const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

/**
 * @param fromStr 'YYYY-MM-DD' (inclusive)
 * @param toStr 'YYYY-MM-DD' (inclusive)
 */
export function buildDateBuckets(fromStr: string, toStr: string): DateBucket[] {
  const from = new Date(`${fromStr}T00:00:00`);
  const toEnd = new Date(`${toStr}T23:59:59.999`);
  if (isNaN(from.getTime()) || isNaN(toEnd.getTime()) || from > toEnd) return [];

  const totalDays = Math.max(1, Math.round((toEnd.getTime() - from.getTime()) / 86400000) + 1);

  // Daily buckets for short ranges (up to ~1 month)
  if (totalDays <= 31) {
    const buckets: DateBucket[] = [];
    for (let i = 0; i < totalDays; i++) {
      const start = new Date(from);
      start.setDate(start.getDate() + i);
      const endExclusive = new Date(start);
      endExclusive.setDate(endExclusive.getDate() + 1);
      buckets.push({ label: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`, start, endExclusive });
    }
    return buckets;
  }

  // Weekly buckets for medium ranges (up to ~6 months)
  if (totalDays <= 182) {
    const buckets: DateBucket[] = [];
    let cursor = new Date(from);
    while (cursor <= toEnd) {
      const start = new Date(cursor);
      let endExclusive = new Date(cursor);
      endExclusive.setDate(endExclusive.getDate() + 7);
      const cappedEnd = endExclusive.getTime() > toEnd.getTime() + 1 ? new Date(toEnd.getTime() + 1) : endExclusive;
      buckets.push({ label: `${pad(start.getDate())}/${pad(start.getMonth() + 1)}`, start, endExclusive: cappedEnd });
      cursor = endExclusive;
    }
    return buckets;
  }

  // Monthly buckets for long ranges
  const buckets: DateBucket[] = [];
  let cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= toEnd) {
    const start = new Date(cursor);
    const endExclusive = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    buckets.push({ label: `${MONTH_LABELS_SHORT[start.getMonth()]} ${String(start.getFullYear()).slice(2)}`, start, endExclusive });
    cursor = endExclusive;
  }
  return buckets;
}

/** 'YYYY-MM-DD' for `date`, in local time (not UTC, so it matches <input type="date"> semantics). */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
