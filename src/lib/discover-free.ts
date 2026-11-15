import "server-only";
import { addDays, localToUtc, todayIn } from "./time";
import type { Category, InterestId } from "./prefs";
import { DiscoverError, cleanResult, type DiscoverInput, type DiscoverResult, type FoundEvent } from "./events";

// Event search without AI: Ticketmaster Discovery (free key, 5,000 calls/day)
// for concerts, theater and arts, and SerpApi's Google Events (free plan,
// ~250 searches/month) for run clubs, fitness, pop-ups and networking.

export function freeSourcesConfigured() {
  return !!(process.env.TICKETMASTER_API_KEY || process.env.SERPAPI_API_KEY);
}

export async function discoverFree(input: DiscoverInput): Promise<DiscoverResult> {
  const tm = process.env.TICKETMASTER_API_KEY;
  const serp = process.env.SERPAPI_API_KEY;
  const place = [input.city, input.region].filter(Boolean).join(", ");

  const jobs: Promise<FoundEvent[]>[] = [];
  if (input.tab === "networking") {
    if (serp) {
      jobs.push(googleEvents(serp, `networking events in ${place}`, "networking", input));
      jobs.push(googleEvents(serp, `business mixer meetup in ${place}`, "networking", input));
    }
  } else {
    const wants = new Set<InterestId>(input.interests);
    if (tm && (wants.has("music") || wants.has("art") || wants.has("culture"))) {
      jobs.push(ticketmaster(tm, input, wants));
    }
    if (serp) {
      for (const [interest, query] of SERP_QUERIES) {
        if (!wants.has(interest)) continue;
        // Ticketmaster already covers concerts and arts when it's set up.
        if (tm && (interest === "music" || interest === "art")) continue;
        jobs.push(googleEvents(serp, `${query} in ${place}`, interest, input));
      }
    }
  }

  if (jobs.length === 0) {
    throw new DiscoverError(
      input.tab === "networking"
        ? "Networking search needs SERPAPI_API_KEY (free plan at serpapi.com)."
        : "Add TICKETMASTER_API_KEY or SERPAPI_API_KEY (both have free plans) to search for events.",
    );
  }

  const settled = await Promise.allSettled(jobs);
  const events = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  const failures = settled.filter((r) => r.status === "rejected");
  for (const f of failures) console.error("free source failed", (f as PromiseRejectedResult).reason);
  if (failures.length === settled.length) throw new DiscoverError("The event sources didn't answer. Try again.");

  const notes = failures.length ? "Some sources didn't answer, so this list may be incomplete." : null;
  return cleanResult({ events, notes }, input);
}

const SERP_QUERIES: [InterestId, string][] = [
  ["running", "run club"],
  ["fitness", "fitness class workout events"],
  ["popup", "pop up market events"],
  ["culture", "festivals and cultural events"],
  ["music", "live music concerts"],
  ["art", "art gallery events"],
];

// ---------- Ticketmaster ----------

type TmEvent = {
  name: string;
  url: string;
  info?: string;
  dates?: { start?: { localDate?: string; localTime?: string } };
  classifications?: { segment?: { name?: string }; genre?: { name?: string } }[];
  priceRanges?: { min?: number; max?: number; currency?: string }[];
  _embedded?: { venues?: { name?: string; address?: { line1?: string }; city?: { name?: string } }[] };
};

async function ticketmaster(key: string, input: DiscoverInput, wants: Set<InterestId>): Promise<FoundEvent[]> {
  const url = new URL("https://app.ticketmaster.com/discovery/v2/events.json");
  url.searchParams.set("apikey", key);
  url.searchParams.set("geoPoint", geohash(input.lat, input.lng, 7));
  url.searchParams.set("radius", "25");
  url.searchParams.set("unit", "miles");
  url.searchParams.set("startDateTime", isoNoMillis(localToUtc(input.from, "00:00", input.tz)));
  url.searchParams.set("endDateTime", isoNoMillis(localToUtc(addDays(input.to, 1), "00:00", input.tz)));
  url.searchParams.set("sort", "date,asc");
  url.searchParams.set("size", "100");
  url.searchParams.set("classificationName", "-Sports");

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Ticketmaster HTTP ${res.status}`);
  const data = (await res.json()) as { _embedded?: { events?: TmEvent[] } };

  const out: FoundEvent[] = [];
  for (const e of data._embedded?.events ?? []) {
    const date = e.dates?.start?.localDate;
    if (!date) continue;
    const category = tmCategory(e);
    if (!category || !wants.has(category)) continue;
    const venue = e._embedded?.venues?.[0];
    const genre = e.classifications?.[0]?.genre?.name;
    const price = e.priceRanges?.[0];
    out.push({
      title: e.name,
      category,
      date,
      start_time: e.dates?.start?.localTime?.slice(0, 5) ?? null,
      end_time: null,
      venue: venue?.name ?? null,
      neighborhood: null,
      address: [venue?.address?.line1, venue?.city?.name].filter(Boolean).join(", ") || null,
      price: price?.min != null ? formatPrice(price.min, price.max, price.currency) : null,
      url: e.url,
      source: "Ticketmaster",
      summary: e.info?.slice(0, 200) ?? (genre && genre !== "Undefined" ? genre : ""),
      recurring: null,
      limited: false,
    });
  }
  return out;
}

function tmCategory(e: TmEvent): InterestId | null {
  const segment = e.classifications?.[0]?.segment?.name ?? "";
  const genre = e.classifications?.[0]?.genre?.name ?? "";
  if (segment === "Music") return "music";
  if (segment === "Arts & Theatre") return /fine art|visual/i.test(genre) ? "art" : "culture";
  if (segment === "Film" || segment === "Miscellaneous") return "culture";
  return null;
}

function formatPrice(min: number, max?: number, currency = "USD") {
  const sym = currency === "USD" ? "$" : `${currency} `;
  const lo = Math.round(min);
  const hi = max != null ? Math.round(max) : lo;
  return lo === hi ? `${sym}${lo}` : `${sym}${lo}–${hi}`;
}

function isoNoMillis(ms: number) {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
}

const GEOHASH = "0123456789bcdefghjkmnpqrstuvwxyz";

export function geohash(lat: number, lng: number, precision: number) {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let hash = "";
  let bits = 0;
  let ch = 0;
  let even = true;
  while (hash.length < precision) {
    const range = even ? lngR : latR;
    const value = even ? lng : lat;
    const mid = (range[0] + range[1]) / 2;
    if (value >= mid) {
      ch = (ch << 1) | 1;
      range[0] = mid;
    } else {
      ch <<= 1;
      range[1] = mid;
    }
    if (even) lngR = range;
    else latR = range;
    even = !even;
    if (++bits === 5) {
      hash += GEOHASH[ch];
      bits = 0;
      ch = 0;
    }
  }
  return hash;
}

// ---------- SerpApi Google Events ----------

type SerpEvent = {
  title?: string;
  link?: string;
  description?: string;
  date?: { start_date?: string; when?: string };
  address?: string[];
  venue?: { name?: string; link?: string };
  ticket_info?: { source?: string; link?: string }[];
};

async function googleEvents(key: string, q: string, category: Category, input: DiscoverInput): Promise<FoundEvent[]> {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_events");
  url.searchParams.set("q", q);
  url.searchParams.set("hl", "en");
  if (input.countryCode) url.searchParams.set("gl", input.countryCode.toLowerCase());
  url.searchParams.set("api_key", key);

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`SerpApi HTTP ${res.status}`);
  const data = (await res.json()) as { events_results?: SerpEvent[]; error?: string };
  if (data.error && !data.events_results) {
    // "no results" comes back as an error string; anything else is a real failure.
    if (/hasn't returned any results/i.test(data.error)) return [];
    throw new Error(`SerpApi: ${data.error}`);
  }

  const out: FoundEvent[] = [];
  for (const e of data.events_results ?? []) {
    const date = parseMonthDay(e.date?.start_date ?? e.date?.when ?? "", input.from, input.tz);
    if (!e.title || !date) continue;
    // Many run clubs and classes have no link; Google's own event card is the fallback.
    const link =
      e.link ??
      e.ticket_info?.find((t) => t.link)?.link ??
      e.venue?.link ??
      `https://www.google.com/search?q=${encodeURIComponent([e.title, e.venue?.name, input.city].filter(Boolean).join(" "))}`;
    const [start, end] = parseTimes(e.date?.when ?? "");
    out.push({
      title: e.title,
      category,
      date,
      start_time: start,
      end_time: end,
      venue: e.venue?.name ?? e.address?.[0] ?? null,
      neighborhood: null,
      address: e.address?.join(", ") ?? null,
      price: null,
      url: link,
      source: sourceName(link),
      summary: e.description?.slice(0, 200) ?? "",
      recurring: null,
      limited: category === "popup",
    });
  }
  return out;
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** "Oct 21" → a YYYY-MM-DD on or after the start of the trip (rolls into next year). */
export function parseMonthDay(text: string, from: string, tz: string) {
  if (/^\s*today\b/i.test(text)) return todayIn(tz);
  if (/^\s*tomorrow\b/i.test(text)) return addDays(todayIn(tz), 1);
  const m = text.match(/([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2})/);
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month < 0) return null;
  let year = Number(from.slice(0, 4));
  const pad = (n: number) => String(n).padStart(2, "0");
  let date = `${year}-${pad(month + 1)}-${pad(Number(m[2]))}`;
  if (date < addDays(from, -31)) date = `${++year}-${pad(month + 1)}-${pad(Number(m[2]))}`;
  return date;
}

/** "Tue, Oct 21, 7 – 10 PM" → ["19:00", "22:00"]; an hour without AM/PM borrows the next one. */
export function parseTimes(when: string): [string | null, string | null] {
  const timeText = when
    .replace(/\b(today|tomorrow|tonight)\b,?/gi, "")
    .replace(/\b(mon|tue|wed|thu|fri|sat|sun)[a-z]*\.?,?/gi, "")
    .replace(/\b[a-z]{3,9}\.?\s+\d{1,2}\b,?/gi, "");
  const tokens = [...timeText.matchAll(/(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi)].map((m) => ({
    h: Number(m[1]),
    min: m[2] ?? "00",
    ampm: (m[3]?.toUpperCase() ?? null) as "AM" | "PM" | null,
  }));
  if (!tokens.some((t) => t.ampm)) return [null, null];
  const [first, second] = tokens;
  const to24 = (t: (typeof tokens)[number], ampm: "AM" | "PM" | null) => {
    if (!ampm || t.h < 1 || t.h > 12) return null;
    return `${String((t.h % 12) + (ampm === "PM" ? 12 : 0)).padStart(2, "0")}:${t.min}`;
  };
  let firstAmPm = first.ampm;
  if (!firstAmPm && second?.ampm) {
    // "11 – 2 PM" starts in the morning; "7 – 10 PM" starts in the evening.
    firstAmPm = second.ampm === "PM" && first.h !== 12 && first.h > second.h ? "AM" : second.ampm;
  }
  return [to24(first, firstAmPm), second ? to24(second, second.ampm) : null];
}

function sourceName(link: string) {
  try {
    const host = new URL(link).hostname.replace(/^www\./, "");
    const known: Record<string, string> = {
      "eventbrite.com": "Eventbrite",
      "meetup.com": "Meetup",
      "facebook.com": "Facebook",
      "allevents.in": "AllEvents",
      "lu.ma": "Luma",
      "strava.com": "Strava",
      "google.com": "Google",
    };
    return known[host] ?? host;
  } catch {
    return "Web";
  }
}
