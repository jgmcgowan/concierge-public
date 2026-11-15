# Concierge

A personal planner: type a city and dates, and it finds your open time from your calendar, links you to the right travel site, and finds running, fitness, music, art, cultural, pop-up and networking events that fit.

## Run it

```bash
cp .env.example .env.local   # then fill in the values
pnpm install
pnpm dev
```

First account: set `CONCIERGE_ALLOW_SIGNUP=true` in `.env.local`, open `/login`, create the account, then remove that env var. In the Supabase dashboard (Authentication → Providers → Email), turn **Confirm email** off for local use if you do not want a confirmation link.

## Where it runs

- Website: a VPS at https://concierge.example.com (Docker + Caddy, `/opt/apps/concierge`). Deploy steps are in CLAUDE.md under "Hosting & database".
- Database and sign-in: Supabase project `concierge`.

## Environment

| Variable | What it's for |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable (or legacy anon) key |
| `CONCIERGE_ALLOW_SIGNUP` | Set to `true` only to create the first account |
| `CALENDAR_ICS_URLS` | Secret iCal addresses of your calendars, comma separated. Google Calendar → Settings → your calendar → Integrate calendar → "Secret address in iCal format". |
| `TICKETMASTER_API_KEY` | Free. Concerts, theater and arts. developer.ticketmaster.com → My Apps → Consumer Key. |
| `SERPAPI_API_KEY` | Free plan (about 250 searches a month). Run clubs, fitness, pop-ups, festivals and networking from Google Events. serpapi.com → Dashboard. |
| `ANTHROPIC_API_KEY` | Optional, paid. When set, Claude web research is used instead of the free sources (set `EVENT_SOURCE=free` to keep the free ones). |
