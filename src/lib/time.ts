// Time zone helpers built on Intl, so they work on the server and in the browser.
// Dates are "YYYY-MM-DD" and times "HH:MM" in a named IANA zone.

const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsIn(utcMs: number, tz: string) {
  let dtf = partsFormatters.get(tz);
  if (!dtf) {
    dtf = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFormatters.set(tz, dtf);
  }
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(new Date(utcMs))) p[part.type] = part.value;
  return p;
}

/** Offset of `tz` from UTC at an instant, in ms (local minus UTC). */
export function tzOffsetMs(utcMs: number, tz: string) {
  const p = partsIn(utcMs, tz);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock date + time in `tz` to a UTC timestamp. */
export function localToUtc(date: string, time: string, tz: string) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs(guess, tz);
  const first = guess - offset;
  const offset2 = tzOffsetMs(first, tz);
  return offset2 === offset ? first : guess - offset2;
}

export function dateIn(utcMs: number, tz: string) {
  const p = partsIn(utcMs, tz);
  return `${p.year}-${p.month}-${p.day}`;
}

export function todayIn(tz: string) {
  return dateIn(Date.now(), tz);
}

export function addDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Inclusive list of dates from `from` to `to`, capped at `max` days. */
export function dateRange(from: string, to: string, max = 14) {
  const days: string[] = [];
  for (let d = from; d <= to && days.length < max; d = addDays(d, 1)) days.push(d);
  return days;
}

export function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isDate(value: string | null | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function isTime(value: string | null | undefined): value is string {
  return !!value && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function formatDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(utcMs: number, tz: string) {
  return new Date(utcMs)
    .toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" })
    .replace(":00", "")
    .replace(" AM", "am")
    .replace(" PM", "pm");
}

export function formatRange(start: number, end: number, tz: string) {
  return `${formatTime(start, tz)} – ${formatTime(end, tz)}`;
}

export function formatHours(ms: number) {
  const hours = ms / 3_600_000;
  return hours >= 10 ? `${Math.round(hours)}h` : `${Math.round(hours * 2) / 2}h`;
}
