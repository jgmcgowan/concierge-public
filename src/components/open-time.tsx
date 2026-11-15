import type { FreeBlock } from "@/lib/freetime";
import { formatDay, formatHours, formatRange } from "@/lib/time";

export function OpenTime({ blocks, days, tz }: { blocks: FreeBlock[]; days: string[]; tz: string }) {
  const total = blocks.reduce((sum, b) => sum + (b.end - b.start), 0);

  return (
    <section className="card p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-display text-xl">Your open time</h2>
        <span className="text-sm text-muted">{formatHours(total)} free</span>
      </div>
      <ul className="mt-3 flex flex-col divide-y divide-line">
        {days.map((day) => {
          const dayBlocks = blocks.filter((b) => b.day === day);
          return (
            <li key={day} className="flex flex-col gap-1.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
              <span className="w-24 shrink-0 text-sm font-medium">{formatDay(day)}</span>
              <div className="flex flex-wrap gap-1.5">
                {dayBlocks.length ? (
                  dayBlocks.map((b) => (
                    <span key={b.start} className="rounded-lg bg-accent-soft px-2.5 py-1 text-sm text-accent">
                      {formatRange(b.start, b.end, tz)}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted">Booked up</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
