import "server-only";
import { getBusy } from "./calendar";
import { computeFreeBlocks } from "./freetime";
import type { Prefs } from "./prefs";
import { addDays, localToUtc } from "./time";

/** Calendar busy time → open blocks for the given local days. */
export async function openTimeFor(days: string[], tz: string, prefs: Prefs) {
  const from = localToUtc(days[0], "00:00", tz);
  const to = localToUtc(addDays(days[days.length - 1], 1), "12:00", tz);
  const calendar = await getBusy(from, to, tz);
  const blocks = computeFreeBlocks({
    days,
    tz,
    wake: prefs.wake,
    sleep: prefs.sleep,
    busy: calendar.busy,
    minMinutes: prefs.minGapMinutes,
    workHours: prefs.blockWorkHours ? { start: prefs.workStart, end: prefs.workEnd } : null,
  });
  return { blocks, calendar };
}
