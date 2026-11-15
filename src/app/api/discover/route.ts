import { NextResponse } from "next/server";
import { DiscoverError, discover } from "@/lib/discover";
import type { Tab } from "@/lib/events";
import { getPrefs } from "@/lib/prefs-server";
import { isDate } from "@/lib/time";
import { findCity } from "@/lib/geo";

// Web research takes a minute or two.
export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    tab?: string;
    city?: string;
    from?: string;
    to?: string;
  };
  const tab: Tab = body.tab === "networking" ? "networking" : "activities";
  if (!body.city || !isDate(body.from) || !isDate(body.to) || body.to < body.from) {
    return NextResponse.json({ error: "Pick a city and dates." }, { status: 400 });
  }

  const place = await findCity(body.city);
  if (!place) return NextResponse.json({ error: "Couldn't find that city." }, { status: 400 });

  const prefs = await getPrefs();
  try {
    const result = await discover({
      tab,
      city: place.city,
      region: place.region,
      countryCode: place.countryCode,
      lat: place.lat,
      lng: place.lng,
      tz: place.tz,
      from: body.from,
      to: body.to,
      interests: prefs.interests,
    });
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof DiscoverError ? e.message : "Search failed. Try again in a minute.";
    if (!(e instanceof DiscoverError)) console.error("discover failed", e);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
