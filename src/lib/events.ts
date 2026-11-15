import type { Category, InterestId } from "./prefs";

export type Tab = "activities" | "networking";

export type FoundEvent = {
  title: string;
  category: Category;
  date: string;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  neighborhood: string | null;
  address: string | null;
  price: string | null;
  url: string;
  source: string;
  summary: string;
  recurring: string | null;
  limited: boolean;
};

export type DiscoverResult = { events: FoundEvent[]; notes: string | null };

export type DiscoverInput = {
  tab: Tab;
  city: string;
  region: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  tz: string;
  from: string;
  to: string;
  interests: InterestId[];
};

export class DiscoverError extends Error {}

/** Drop anything outside the range, malformed or repeated; sort by date and time. */
export function cleanResult(result: DiscoverResult, input: DiscoverInput): DiscoverResult {
  const seen = new Set<string>();
  const events = (result.events ?? [])
    .filter((e) => e.date >= input.from && e.date <= input.to && /^https?:\/\//.test(e.url))
    .map((e) => ({
      ...e,
      start_time: /^\d{2}:\d{2}$/.test(e.start_time ?? "") ? e.start_time : null,
      end_time: /^\d{2}:\d{2}$/.test(e.end_time ?? "") ? e.end_time : null,
    }))
    .filter((e) => {
      const key = `${e.date}|${e.title.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => (a.date + (a.start_time ?? "99")).localeCompare(b.date + (b.start_time ?? "99")));
  return { events, notes: result.notes ?? null };
}
