"use client";

import { useCallback, useEffect, useState } from "react";
import type { DiscoverResult, FoundEvent, Tab } from "@/lib/events";
import type { Interval } from "@/lib/freetime";
import { CATEGORY_LABELS, type Category } from "@/lib/prefs";
import { formatDay, formatRange, formatTime, localToUtc } from "@/lib/time";

type Props = {
  city: string;
  tz: string;
  from: string;
  to: string;
  blocks: Interval[];
  interestsKey: string;
};

type Load =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "done"; data: DiscoverResult; fetchedAt: number }
  | { status: "error"; error: string };

const TABS: { id: Tab; label: string }[] = [
  { id: "activities", label: "Things to do" },
  { id: "networking", label: "Networking" },
];

const CACHE_HOURS = 12;
const DEFAULT_LENGTH_MS = 90 * 60_000;

type Placed = FoundEvent & { start: number | null; end: number | null; fit: Interval | null };

function place(e: FoundEvent, tz: string, blocks: Interval[]): Placed {
  if (!e.start_time) return { ...e, start: null, end: null, fit: null };
  const start = localToUtc(e.date, e.start_time, tz);
  let end = e.end_time ? localToUtc(e.date, e.end_time, tz) : start + DEFAULT_LENGTH_MS;
  if (end <= start) end += 24 * 3_600_000;
  const fit = blocks.find((b) => b.start <= start && end <= b.end) ?? null;
  return { ...e, start, end, fit };
}

function calendarLink(e: Placed) {
  const stamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const allDayEnd = new Date(`${e.date}T00:00:00Z`);
  allDayEnd.setUTCDate(allDayEnd.getUTCDate() + 1);
  const dates =
    e.start && e.end
      ? `${stamp(e.start)}/${stamp(e.end)}`
      : `${e.date.replace(/-/g, "")}/${allDayEnd.toISOString().slice(0, 10).replace(/-/g, "")}`;
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates,
    details: `${e.summary}\n\n${e.url}`,
    location: [e.venue, e.address].filter(Boolean).join(", "),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}

function cacheKey(tab: Tab, p: Props) {
  return `concierge:discover:v1:${tab}:${p.city}:${p.from}:${p.to}:${tab === "activities" ? p.interestsKey : ""}`;
}

function readCache(key: string): Load | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const v = JSON.parse(raw) as { data: DiscoverResult; fetchedAt: number };
    if (Date.now() - v.fetchedAt > CACHE_HOURS * 3_600_000) return null;
    return { status: "done", ...v };
  } catch {
    return null;
  }
}

function writeCache(key: string, data: DiscoverResult, fetchedAt: number) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, fetchedAt }));
  } catch {
    // Full or unavailable storage: results just won't be remembered.
  }
}

export function PlanView(props: Props) {
  const [tab, setTab] = useState<Tab>("activities");
  const [loads, setLoads] = useState<Record<Tab, Load>>({
    activities: { status: "idle" },
    networking: { status: "idle" },
  });

  const run = useCallback(
    async (which: Tab, force = false) => {
      const key = cacheKey(which, props);
      const cached = force ? null : readCache(key);
      if (cached) {
        setLoads((l) => ({ ...l, [which]: cached }));
        return;
      }
      setLoads((l) => ({ ...l, [which]: { status: "loading", startedAt: Date.now() } }));
      try {
        const res = await fetch("/api/discover", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tab: which, city: props.city, from: props.from, to: props.to }),
        });
        const body = (await res.json()) as DiscoverResult & { error?: string };
        if (!res.ok) throw new Error(body.error ?? "Search failed.");
        const fetchedAt = Date.now();
        writeCache(key, body, fetchedAt);
        setLoads((l) => ({ ...l, [which]: { status: "done", data: body, fetchedAt } }));
      } catch (e) {
        const error = e instanceof Error ? e.message : "Search failed.";
        setLoads((l) => ({ ...l, [which]: { status: "error", error } }));
      }
    },
    // Props are plain values; re-run only when the search itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.city, props.from, props.to, props.interestsKey],
  );

  // Start the first search once the page is in the browser (results are
  // cached in localStorage, which the server can't read).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void run("activities");
  }, [run]);

  function selectTab(next: Tab) {
    setTab(next);
    if (loads[next].status === "idle") void run(next);
  }

  const load = loads[tab];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex border-b border-line" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => selectTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium ${
              tab === t.id ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {load.status === "loading" && <Searching tab={tab} city={props.city} startedAt={load.startedAt} />}
      {load.status === "error" && (
        <div className="card flex flex-col items-start gap-3 p-5">
          <p className="text-danger">{load.error}</p>
          <button className="btn" onClick={() => run(tab, true)}>
            Try again
          </button>
        </div>
      )}
      {load.status === "done" && (
        <Results
          key={tab}
          tab={tab}
          data={load.data}
          fetchedAt={load.fetchedAt}
          tz={props.tz}
          blocks={props.blocks}
          onRefresh={() => run(tab, true)}
        />
      )}
    </section>
  );
}

function Searching({ tab, city, startedAt }: { tab: Tab; city: string; startedAt: number }) {
  const [now, setNow] = useState(startedAt);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const seconds = Math.max(0, Math.round((now - startedAt) / 1000));
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="size-5 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" />
      <div>
        <p className="font-medium">
          Searching the web for {tab === "networking" ? "networking events" : "things to do"} in {city}…
        </p>
        <p className="text-sm text-muted">This usually takes a minute or two. {seconds}s</p>
      </div>
    </div>
  );
}

function Results({
  tab,
  data,
  fetchedAt,
  tz,
  blocks,
  onRefresh,
}: {
  tab: Tab;
  data: DiscoverResult;
  fetchedAt: number;
  tz: string;
  blocks: Interval[];
  onRefresh: () => void;
}) {
  const [onlyFits, setOnlyFits] = useState(true);
  const [category, setCategory] = useState<Category | "all">("all");

  const placed = data.events.map((e) => place(e, tz, blocks));
  const categories = [...new Set(placed.map((e) => e.category))];
  const inCategory = placed.filter((e) => category === "all" || e.category === category);
  // Events without a published time can't be checked, so they stay visible.
  const shown = onlyFits ? inCategory.filter((e) => e.fit || e.start === null) : inCategory;
  const hidden = inCategory.length - shown.length;
  const days = [...new Set(shown.map((e) => e.date))];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {tab === "activities" && categories.length > 1 && (
          <>
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </FilterChip>
            {categories.map((c) => (
              <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                {CATEGORY_LABELS[c]}
              </FilterChip>
            ))}
          </>
        )}
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyFits} onChange={(e) => setOnlyFits(e.target.checked)} />
          Fits my open time
        </label>
      </div>

      {days.length === 0 && (
        <p className="card p-5 text-muted">
          {placed.length === 0 ? "Nothing found for these dates." : "Nothing fits your open time."}
        </p>
      )}

      {days.map((day) => (
        <div key={day} className="flex flex-col gap-2">
          <h3 className="label">{formatDay(day)}</h3>
          {shown
            .filter((e) => e.date === day)
            .map((e) => (
              <EventCard key={e.title + e.date + e.start_time} event={e} tz={tz} />
            ))}
        </div>
      ))}

      {hidden > 0 && (
        <button className="btn self-start" onClick={() => setOnlyFits(false)}>
          Show {hidden} more outside your open time
        </button>
      )}

      {data.notes && <p className="text-sm text-muted">{data.notes}</p>}
      <p className="text-xs text-muted">
        Found {new Date(fetchedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}.{" "}
        <button className="underline" onClick={onRefresh}>
          Search again
        </button>
      </p>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-sm ${
        active ? "bg-ink text-ground" : "bg-sunken text-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function EventCard({ event: e, tz }: { event: Placed; tz: string }) {
  const where = [e.venue, e.neighborhood].filter(Boolean).join(" · ");
  return (
    <article className="card flex flex-col gap-1 p-4 sm:flex-row sm:gap-4">
      <div className="shrink-0 text-sm font-medium sm:w-16">
        {e.start ? formatTime(e.start, tz) : <span className="text-muted">Any time</span>}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <a href={e.url} target="_blank" rel="noopener noreferrer" className="font-medium hover:underline">
          {e.title}
        </a>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="chip">{CATEGORY_LABELS[e.category] ?? e.category}</span>
          {e.limited && <span className="chip">Limited</span>}
          {e.recurring && <span className="chip">{e.recurring}</span>}
          {e.price && <span className="chip">{e.price}</span>}
        </div>
        {where && <p className="text-sm text-muted">{where}</p>}
        {e.summary && <p className="text-sm">{e.summary}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {e.fit ? (
            <span className="text-sm text-accent">✓ Fits your {formatRange(e.fit.start, e.fit.end, tz)} opening</span>
          ) : e.start ? (
            <span className="text-sm text-muted">Outside your open time</span>
          ) : null}
          <span className="ml-auto flex gap-2">
            <a href={calendarLink(e)} target="_blank" rel="noopener noreferrer" className="btn whitespace-nowrap">
              Add to calendar
            </a>
            <a href={e.url} target="_blank" rel="noopener noreferrer" className="btn whitespace-nowrap">
              {e.source} ↗
            </a>
          </span>
        </div>
      </div>
    </article>
  );
}
