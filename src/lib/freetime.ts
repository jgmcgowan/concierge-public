import { addDays, localToUtc, weekday } from "./time";

export type Interval = { start: number; end: number };
export type FreeBlock = Interval & { day: string };

type Options = {
  days: string[];
  tz: string;
  wake: string;
  sleep: string;
  busy: Interval[];
  minMinutes: number;
  /** Weekday hours to treat as blocked (e.g. a normal work day). */
  workHours?: { start: string; end: string } | null;
  now?: number;
};

/**
 * Open time per day: the awake window (wake → sleep, where a sleep time
 * before the wake time means after midnight), minus calendar busy time and
 * optional weekday work hours, minus anything already past.
 */
export function computeFreeBlocks(opts: Options): FreeBlock[] {
  // Round "now" up to the next quarter hour so today's first block reads cleanly.
  const quarter = 15 * 60_000;
  const now = Math.ceil((opts.now ?? Date.now()) / quarter) * quarter;
  const minMs = opts.minMinutes * 60_000;
  const blocks: FreeBlock[] = [];

  for (const day of opts.days) {
    const start = localToUtc(day, opts.wake, opts.tz);
    const end =
      opts.sleep > opts.wake
        ? localToUtc(day, opts.sleep, opts.tz)
        : localToUtc(addDays(day, 1), opts.sleep, opts.tz);

    const blocked = [...opts.busy];
    const dow = weekday(day);
    if (opts.workHours && dow >= 1 && dow <= 5) {
      blocked.push({
        start: localToUtc(day, opts.workHours.start, opts.tz),
        end: localToUtc(day, opts.workHours.end, opts.tz),
      });
    }

    let free: Interval[] = [{ start: Math.max(start, now), end }];
    for (const b of blocked) {
      free = free.flatMap((f) => {
        if (b.end <= f.start || b.start >= f.end) return [f];
        const parts: Interval[] = [];
        if (b.start > f.start) parts.push({ start: f.start, end: b.start });
        if (b.end < f.end) parts.push({ start: b.end, end: f.end });
        return parts;
      });
    }

    for (const f of free) {
      if (f.end - f.start >= minMs) blocks.push({ ...f, day });
    }
  }

  return blocks.sort((a, b) => a.start - b.start);
}
