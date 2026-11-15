import Link from "next/link";
import { CityForm } from "@/components/city-form";
import { OpenTime } from "@/components/open-time";
import { calendarConfigured } from "@/lib/calendar";
import { findCity } from "@/lib/geo";
import { getPrefs } from "@/lib/prefs-server";
import { openTimeFor } from "@/lib/schedule";
import { dateRange, addDays, todayIn } from "@/lib/time";

export default async function Home() {
  const prefs = await getPrefs();
  const home = prefs.homeCity ? await findCity(prefs.homeCity).catch(() => null) : null;
  // The server runs in UTC, so fall back to Central time until a home city is set.
  const tz = home?.tz ?? "America/Chicago";
  const today = todayIn(tz);
  const days = dateRange(today, addDays(today, 2));
  const open = calendarConfigured() ? await openTimeFor(days, tz, prefs) : null;

  const setup = [
    { done: calendarConfigured(), text: "Connect your calendar feed (CALENDAR_ICS_URLS)" },
    {
      done: !!(process.env.ANTHROPIC_API_KEY || process.env.TICKETMASTER_API_KEY || process.env.SERPAPI_API_KEY),
      text: "Add an event source: Ticketmaster and SerpApi (free) or Anthropic",
    },
    { done: !!prefs.homeCity, text: "Set your home city in Settings" },
  ];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl">Where to?</h1>
        <p className="mt-2 text-muted">
          Type a city and I&apos;ll find where to stay and what&apos;s on while you&apos;re free.
        </p>
      </div>

      <CityForm defaultCity={home?.label ?? ""} />

      {open && <OpenTime blocks={open.blocks} days={days} tz={tz} />}
      {open?.calendar.errors.map((e) => (
        <p key={e} className="text-sm text-danger">
          {e}
        </p>
      ))}

      {setup.some((s) => !s.done) && (
        <section className="card p-4 sm:p-5">
          <h2 className="font-display text-xl">Finish setting up</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {setup.map((s) => (
              <li key={s.text} className={s.done ? "text-muted line-through" : ""}>
                {s.done ? "✓" : "○"} {s.text}
              </li>
            ))}
          </ul>
          <Link href="/settings" className="btn mt-4">
            Open settings
          </Link>
        </section>
      )}
    </div>
  );
}
