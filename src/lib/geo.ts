import "server-only";
import tzLookup from "@photostructure/tz-lookup";

export type Place = {
  label: string;
  city: string;
  region: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  tz: string;
};

type PhotonFeature = {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    state?: string;
    country?: string;
    countrycode?: string;
    osm_value?: string;
  };
};

const CITY_TYPES = new Set(["city", "town", "village", "municipality", "borough", "suburb", "hamlet"]);

/** City search via Photon (komoot), which allows type-ahead use. */
export async function searchCities(query: string, limit = 5): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(limit * 3));
  url.searchParams.set("lang", "en");
  url.searchParams.set("osm_tag", "place");

  const res = await fetch(url, {
    headers: { "User-Agent": "Concierge personal planner" },
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { features?: PhotonFeature[] };

  const seen = new Set<string>();
  const places: Place[] = [];
  for (const f of data.features ?? []) {
    const p = f.properties;
    if (!p.name || (p.osm_value && !CITY_TYPES.has(p.osm_value))) continue;
    const [lng, lat] = f.geometry.coordinates;
    const region = p.state ?? null;
    const countryCode = p.countrycode?.toUpperCase() ?? null;
    const label = [p.name, region ?? p.country, countryCode && countryCode !== "US" ? p.country : null]
      .filter((x, i, a) => x && a.indexOf(x) === i)
      .join(", ");
    if (seen.has(label)) continue;
    seen.add(label);
    places.push({ label, city: p.name, region, countryCode, lat, lng, tz: tzLookup(lat, lng) });
    if (places.length >= limit) break;
  }
  return places;
}

export async function findCity(query: string) {
  return (await searchCities(query, 1))[0] ?? null;
}
