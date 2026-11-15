import { isTime } from "./time";

export const INTERESTS = [
  { id: "running", label: "Running", hint: "run clubs, group runs, races" },
  { id: "fitness", label: "Fitness", hint: "drop-in classes, outdoor workouts, yoga" },
  { id: "music", label: "Music", hint: "concerts, live music, jazz nights" },
  { id: "art", label: "Art", hint: "gallery openings, art walks, exhibitions" },
  { id: "culture", label: "Cultural", hint: "festivals, museums, theater, markets" },
  { id: "popup", label: "Pop-ups", hint: "limited-time pop-ups and one-night events" },
] as const;

export type InterestId = (typeof INTERESTS)[number]["id"];
export type Category = InterestId | "networking" | "other";

export const CATEGORY_LABELS: Record<Category, string> = {
  running: "Running",
  fitness: "Fitness",
  music: "Music",
  art: "Art",
  culture: "Cultural",
  popup: "Pop-up",
  networking: "Networking",
  other: "Other",
};

export type Prefs = {
  wake: string;
  sleep: string;
  minGapMinutes: number;
  interests: InterestId[];
  homeCity: string;
  homeAirport: string;
  blockWorkHours: boolean;
  workStart: string;
  workEnd: string;
};

export const DEFAULT_PREFS: Prefs = {
  wake: "07:00",
  sleep: "23:00",
  minGapMinutes: 60,
  interests: INTERESTS.map((i) => i.id),
  homeCity: "",
  homeAirport: "",
  blockWorkHours: false,
  workStart: "09:00",
  workEnd: "17:00",
};

export const PREFS_COOKIE = "concierge_prefs";

const interestIds = new Set<string>(INTERESTS.map((i) => i.id));

export function parsePrefs(raw: string | undefined): Prefs {
  if (!raw) return DEFAULT_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Prefs>;
    return {
      wake: isTime(v.wake) ? v.wake : DEFAULT_PREFS.wake,
      sleep: isTime(v.sleep) ? v.sleep : DEFAULT_PREFS.sleep,
      minGapMinutes: [30, 60, 90, 120].includes(Number(v.minGapMinutes))
        ? Number(v.minGapMinutes)
        : DEFAULT_PREFS.minGapMinutes,
      interests: Array.isArray(v.interests)
        ? (v.interests.filter((i) => interestIds.has(i)) as InterestId[])
        : DEFAULT_PREFS.interests,
      homeCity: typeof v.homeCity === "string" ? v.homeCity.slice(0, 120) : "",
      homeAirport: typeof v.homeAirport === "string" ? v.homeAirport.slice(0, 60) : "",
      blockWorkHours: v.blockWorkHours === true,
      workStart: isTime(v.workStart) ? v.workStart : DEFAULT_PREFS.workStart,
      workEnd: isTime(v.workEnd) ? v.workEnd : DEFAULT_PREFS.workEnd,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}
