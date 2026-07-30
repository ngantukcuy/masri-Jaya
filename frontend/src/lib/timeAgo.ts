/**
 * Renders a real, live relative-time label ("Baru saja", "5 menit lalu",
 * "3 jam lalu", "2 hari lalu") from an ISO timestamp. Falls back to the
 * given label (e.g. an old record's frozen `time` string) when no
 * timestamp is available at all.
 */
export function timeAgo(iso?: string, fallback = '—'): string {
  if (!iso) return fallback;
  const then = new Date(iso).getTime();
  if (isNaN(then)) return fallback;

  const diffMs = Date.now() - then;
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 10) return 'Baru saja';
  if (diffSec < 60) return `${diffSec} detik lalu`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} menit lalu`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} jam lalu`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 7) return `${diffDay} hari lalu`;

  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}
