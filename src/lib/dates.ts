// Local-calendar date helpers. Dates are stored as 'YYYY-MM-DD' keys in the user's local time zone.

export type DateKey = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(now: Date = new Date()): DateKey {
  return toKey(now);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Whole days from `a` to `b` (b - a), ignoring DST shifts. */
export function daysBetween(a: DateKey, b: DateKey): number {
  const ms = Date.UTC(...ymd(b)) - Date.UTC(...ymd(a));
  return Math.round(ms / 86_400_000);
}

function ymd(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split('-').map(Number);
  return [y, m - 1, d];
}

/** Monday of the week containing `key`. */
export function weekStart(key: DateKey): DateKey {
  const day = fromKey(key).getDay(); // 0 = Sunday
  return addDays(key, day === 0 ? -6 : 1 - day);
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

export function dayOfWeek(key: DateKey): number {
  return fromKey(key).getDay();
}

export function rangeKeys(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

export function formatKey(
  key: DateKey,
  opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' },
) {
  return fromKey(key).toLocaleDateString('en-IN', opts);
}
