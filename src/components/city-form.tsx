"use client";

import { useEffect, useId, useMemo, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";

type Recent = { city: string; from: string; to: string; purpose: string };

const RECENTS_KEY = "concierge:recent-plans";

function readRecentsRaw() {
  try {
    return localStorage.getItem(RECENTS_KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

function parseRecents(raw: string): Recent[] {
  try {
    return JSON.parse(raw) as Recent[];
  } catch {
    return [];
  }
}

const noSubscribe = () => () => {};

export function rememberPlan(plan: Recent) {
  try {
    const list = [plan, ...parseRecents(readRecentsRaw()).filter((r) => r.city !== plan.city)].slice(0, 5);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {
    // Storage can be unavailable (private mode); recents are a convenience.
  }
}

function localToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function plusDays(date: string, n: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function planHref(r: Recent) {
  const q = new URLSearchParams({ city: r.city, from: r.from, to: r.to, purpose: r.purpose });
  return `/plan?${q}`;
}

export function CityForm({ defaultCity = "" }: { defaultCity?: string }) {
  const router = useRouter();
  const listId = useId();
  const [city, setCity] = useState(defaultCity);
  const [from, setFrom] = useState(localToday);
  const [to, setTo] = useState(() => plusDays(localToday(), 2));
  const [purpose, setPurpose] = useState<"leisure" | "work">("leisure");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const recentsRaw = useSyncExternalStore(noSubscribe, readRecentsRaw, () => "[]");
  const recents = useMemo(() => parseRecents(recentsRaw), [recentsRaw]);

  useEffect(() => {
    if (city.trim().length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places?q=${encodeURIComponent(city)}`, { signal: ctrl.signal });
        const list = (await res.json()) as { label: string }[];
        setSuggestions(list.map((p) => p.label));
      } catch {
        // Aborted or offline: keep the old suggestions.
      }
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [city]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    const plan = { city: city.trim(), from, to: to < from ? from : to, purpose };
    rememberPlan(plan);
    router.push(planHref(plan));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={submit} className="card flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="city" className="label">
            City
          </label>
          <input
            id="city"
            className="field text-lg"
            placeholder="Austin, Texas"
            list={listId}
            value={city}
            onChange={(e) => setCity(e.target.value)}
            autoComplete="off"
            required
          />
          <datalist id={listId}>
            {suggestions.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="from" className="label">
              Arrive
            </label>
            <input id="from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="to" className="label">
              Leave
            </label>
            <input id="to" type="date" className="field" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl bg-sunken p-1" role="radiogroup" aria-label="Trip type">
            {(["leisure", "work"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={purpose === p}
                onClick={() => setPurpose(p)}
                className={`rounded-lg px-4 py-1.5 text-sm font-medium capitalize ${
                  purpose === p ? "bg-surface text-ink shadow-sm" : "text-muted"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button className="btn-primary">Find things to do</button>
        </div>
      </form>

      {recents.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Recent:</span>
          {recents.map((r) => (
            <a key={r.city + r.from} href={planHref(r)} className="btn">
              {r.city}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
