import Link from "next/link";
import { OpenTime } from "@/components/open-time";
import { PlanView } from "@/components/plan-view";
import { findCity } from "@/lib/geo";
import { getPrefs } from "@/lib/prefs-server";
import { openTimeFor } from "@/lib/schedule";
import { addDays, dateRange, formatDay, isDate, todayIn } from "@/lib/time";
import { flightLink, stayLinks, type Purpose } from "@/lib/travel";

export default async function PlanPage({ searchParams }: PageProps<"/plan">) {
  const sp = await searchParams;
  const query = typeof sp.city === "string" ? sp.city : "";
  const place = query ? await findCity(query).catch(() => null) : null;

  if (!place) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-3xl">Couldn&apos;t find {query ? `“${query}”` : "that city"}</h1>
        <Link href="/" className="btn self-start">
          Try another city
        </Link>
      </div>
    );
  }

  const prefs = await getPrefs();
  const tz = place.tz;
  const today = todayIn(tz);
  const rawFrom = typeof sp.from === "string" && isDate(sp.from) ? sp.from : today;
  const from = rawFrom < today ? today : rawFrom;
  const rawTo = typeof sp.to === "string" && isDate(sp.to) && sp.to >= from ? sp.to : addDays(from, 2);
  const days = dateRange(from, rawTo);
  const to = days[days.length - 1];
  const purpose: Purpose = sp.purpose === "work" ? "work" : "leisure";

  const { blocks, calendar } = await openTimeFor(days, tz, prefs);
  const stay = stayLinks(place.label, from, to, purpose);
  const flights = flightLink(prefs.homeAirport, place.label, from, to);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          ← New search
        </Link>
        <h1 className="mt-2 font-display text-3xl sm:text-4xl">{place.label}</h1>
        <p className="mt-1 text-muted">
          {formatDay(from)}
          {to !== from && ` – ${formatDay(to)}`} · {purpose === "work" ? "Work trip" : "Leisure"}
        </p>
      </div>

      <section className="card p-4 sm:p-5">
        <h2 className="font-display text-xl">Where to stay</h2>
        <p className="mt-1 text-sm text-muted">{stay.why}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href={stay.best.url} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Search {stay.best.name} ↗
          </a>
          {stay.others.map((s) => (
            <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer" className="btn" title={s.note}>
              {s.name} ↗
            </a>
          ))}
          {flights && (
            <a href={flights} target="_blank" rel="noopener noreferrer" className="btn">
              Flights from {prefs.homeAirport} ↗
            </a>
          )}
        </div>
      </section>

      {calendar.configured ? (
        <OpenTime blocks={blocks} days={days} tz={tz} />
      ) : (
        <p className="text-sm text-muted">
          No calendar connected, so every waking hour counts as open.{" "}
          <Link href="/settings" className="underline">
            Connect it
          </Link>
          .
        </p>
      )}
      {calendar.errors.map((e) => (
        <p key={e} className="text-sm text-danger">
          {e}
        </p>
      ))}

      <PlanView
        city={place.label}
        tz={tz}
        from={from}
        to={to}
        blocks={blocks.map(({ start, end }) => ({ start, end }))}
        interestsKey={prefs.interests.join(",")}
      />
    </div>
  );
}
