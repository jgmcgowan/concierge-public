import "server-only";
import ICAL from "ical.js";
import type { Interval } from "./freetime";
import { localToUtc } from "./time";

export type CalendarResult = {
  configured: boolean;
  busy: Interval[];
  errors: string[];
};

/** Calendar feed URLs (secret iCal addresses), comma or space separated. */
function feedUrls() {
  return (process.env.CALENDAR_ICS_URLS ?? "")
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((u) => u.replace(/^webcal:/i, "https:"));
}

export function calendarConfigured() {
  return feedUrls().length > 0;
}

/** Busy intervals from every feed that overlap [from, to). */
export async function getBusy(from: number, to: number, tz: string): Promise<CalendarResult> {
  const urls = feedUrls();
  const busy: Interval[] = [];
  const errors: string[] = [];

  await Promise.all(
    urls.map(async (url, i) => {
      try {
        // Feed URLs are secret, so errors never echo them.
        if (!/^https?:\/\//i.test(url)) {
          errors.push(`Calendar ${i + 1}: that isn't a web address. Use the "Secret address in iCal format".`);
          return;
        }
        const res = await fetch(url, { next: { revalidate: 300 } });
        if (!res.ok) throw new Error(`the feed returned HTTP ${res.status}`);
        busy.push(...parseBusy(await res.text(), from, to, tz));
      } catch (e) {
        const reason = e instanceof Error && e.message.startsWith("the feed") ? e.message : "couldn't load or read the feed";
        errors.push(`Calendar ${i + 1}: ${reason}.`);
      }
    }),
  );

  return { configured: urls.length > 0, busy: busy.sort((a, b) => a.start - b.start), errors };
}

const MAX_OCCURRENCES = 10_000;

export function parseBusy(text: string, from: number, to: number, tz: string): Interval[] {
  const root = new ICAL.Component(ICAL.parse(text));
  for (const vtz of root.getAllSubcomponents("vtimezone")) {
    ICAL.TimezoneService.register(vtz);
  }

  const masters = new Map<string, ICAL.Event>();
  const exceptions: ICAL.Event[] = [];
  for (const vevent of root.getAllSubcomponents("vevent")) {
    const event = new ICAL.Event(vevent);
    if (event.isRecurrenceException()) exceptions.push(event);
    else masters.set(event.uid, event);
  }
  for (const ex of exceptions) {
    const master = masters.get(ex.uid);
    if (master) master.relateException(ex);
    else masters.set(`${ex.uid}:${ex.recurrenceId}`, ex);
  }

  const out: Interval[] = [];
  const add = (item: ICAL.Event, start: ICAL.Time, end: ICAL.Time) => {
    if (!blocksTime(item.component)) return;
    const s = toMs(start, tz);
    const e = toMs(end, tz);
    if (e > from && s < to) out.push({ start: s, end: e });
  };

  for (const event of masters.values()) {
    if (!event.isRecurring()) {
      add(event, event.startDate, event.endDate);
      continue;
    }
    const it = event.iterator();
    for (let i = 0, next = it.next(); next && i < MAX_OCCURRENCES; i++, next = it.next()) {
      const details = event.getOccurrenceDetails(next);
      if (toMs(details.startDate, tz) >= to) break;
      add(details.item, details.startDate, details.endDate);
    }
  }
  return out;
}

/** Free (transparent) and cancelled events don't block time. */
function blocksTime(component: ICAL.Component) {
  const transp = String(component.getFirstPropertyValue("transp") ?? "").toUpperCase();
  const status = String(component.getFirstPropertyValue("status") ?? "").toUpperCase();
  return transp !== "TRANSPARENT" && status !== "CANCELLED";
}

/** All-day and floating times are read as wall-clock time where you are. */
function toMs(time: ICAL.Time, tz: string) {
  if (time.isDate) return localToUtc(time.toString().slice(0, 10), "00:00", tz);
  if (time.zone === ICAL.Timezone.localTimezone) {
    const s = time.toString();
    return localToUtc(s.slice(0, 10), s.slice(11, 16), tz);
  }
  return time.toJSDate().getTime();
}
