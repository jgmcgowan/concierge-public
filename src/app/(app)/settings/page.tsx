import { calendarConfigured } from "@/lib/calendar";
import { INTERESTS } from "@/lib/prefs";
import { getPrefs } from "@/lib/prefs-server";
import { saveSettings } from "./actions";

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { saved } = await searchParams;
  const prefs = await getPrefs();

  const status = [
    { ok: calendarConfigured(), label: "Calendar feed", env: "CALENDAR_ICS_URLS" },
    { ok: !!process.env.TICKETMASTER_API_KEY, label: "Ticketmaster (concerts, theater, arts)", env: "TICKETMASTER_API_KEY" },
    { ok: !!process.env.SERPAPI_API_KEY, label: "SerpApi Google Events (run clubs, pop-ups, networking)", env: "SERPAPI_API_KEY" },
    { ok: !!process.env.ANTHROPIC_API_KEY, label: "Claude web research (optional, paid)", env: "ANTHROPIC_API_KEY" },
    {
      ok: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      label: "Supabase auth",
      env: "NEXT_PUBLIC_SUPABASE_URL",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-3xl">Settings</h1>
      {saved && <p className="rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent">Saved.</p>}

      <form action={saveSettings} className="flex flex-col gap-6">
        <section className="card flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl">Open time</h2>
            <p className="text-sm text-muted">
              I look for gaps in your calendar between waking up and going to sleep.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Wake up">
              <input type="time" name="wake" defaultValue={prefs.wake} className="field" />
            </Field>
            <Field label="Sleep">
              <input type="time" name="sleep" defaultValue={prefs.sleep} className="field" />
            </Field>
            <Field label="Shortest gap">
              <select name="minGapMinutes" defaultValue={prefs.minGapMinutes} className="field">
                <option value={30}>30 min</option>
                <option value={60}>1 hour</option>
                <option value={90}>1.5 hours</option>
                <option value={120}>2 hours</option>
              </select>
            </Field>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="blockWorkHours" defaultChecked={prefs.blockWorkHours} />
            Treat weekday work hours as busy, even if they&apos;re not on my calendar
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Field label="Work starts">
              <input type="time" name="workStart" defaultValue={prefs.workStart} className="field" />
            </Field>
            <Field label="Work ends">
              <input type="time" name="workEnd" defaultValue={prefs.workEnd} className="field" />
            </Field>
          </div>
        </section>

        <section className="card flex flex-col gap-4 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-xl">Interests</h2>
            <p className="text-sm text-muted">What to look for under Things to do. Networking has its own tab.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {INTERESTS.map((i) => (
              <label key={i.id} className="flex items-start gap-2.5 rounded-xl border border-line p-3">
                <input
                  type="checkbox"
                  name="interests"
                  value={i.id}
                  defaultChecked={prefs.interests.includes(i.id)}
                  className="mt-1"
                />
                <span>
                  <span className="font-medium">{i.label}</span>
                  <span className="block text-sm text-muted">{i.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </section>

        <section className="card flex flex-col gap-4 p-4 sm:p-5">
          <h2 className="font-display text-xl">Home</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Home city">
              <input name="homeCity" defaultValue={prefs.homeCity} placeholder="Springfield, Illinois" className="field" />
            </Field>
            <Field label="Home airport (for flight links)">
              <input name="homeAirport" defaultValue={prefs.homeAirport} placeholder="BNA" className="field" />
            </Field>
          </div>
        </section>

        <button className="btn-primary self-start">Save settings</button>
      </form>

      <section className="card flex flex-col gap-3 p-4 sm:p-5">
        <h2 className="font-display text-xl">Connections</h2>
        <ul className="flex flex-col gap-1.5 text-sm">
          {status.map((s) => (
            <li key={s.env}>
              {s.ok ? "✓" : "○"} {s.label}{" "}
              <span className="text-muted">
                {s.ok ? "connected" : (
                  <>
                    — set <code>{s.env}</code>
                  </>
                )}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted">
          Calendar feed: in Google Calendar, open Settings → your calendar → Integrate calendar and copy the
          “Secret address in iCal format”. Several feeds can be separated with commas.
        </p>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}
