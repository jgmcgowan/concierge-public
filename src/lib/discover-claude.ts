import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { CATEGORY_LABELS, INTERESTS } from "./prefs";
import { DiscoverError, cleanResult, type DiscoverInput, type DiscoverResult } from "./events";

const MODEL = "claude-opus-5-5";

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] };

const REPORT_TOOL: Anthropic.Beta.BetaTool = {
  name: "report_events",
  description:
    "Report the final list of verified events found for the city and dates. Call this exactly once, after researching.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["events", "notes"],
    properties: {
      notes: {
        ...nullableString,
        description: "One or two sentences on coverage gaps (e.g. no run clubs found on Wednesday), or null.",
      },
      events: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [
            "title",
            "category",
            "date",
            "start_time",
            "end_time",
            "venue",
            "neighborhood",
            "address",
            "price",
            "url",
            "source",
            "summary",
            "recurring",
            "limited",
          ],
          properties: {
            title: { type: "string" },
            category: { type: "string", enum: Object.keys(CATEGORY_LABELS) },
            date: { type: "string", description: "Local date, YYYY-MM-DD" },
            start_time: { ...nullableString, description: "Local start time HH:MM (24h), null if unknown" },
            end_time: { ...nullableString, description: "Local end time HH:MM (24h), null if unknown" },
            venue: nullableString,
            neighborhood: nullableString,
            address: nullableString,
            price: { ...nullableString, description: 'e.g. "Free", "$25", "$15–40"' },
            url: { type: "string", description: "Most specific page for this event (event page over homepage)" },
            source: { type: "string", description: "Site name, e.g. Eventbrite, Strava, venue name" },
            summary: { type: "string", description: "One sentence: what it is and why it's worth going" },
            recurring: { ...nullableString, description: 'e.g. "Every Tuesday", null if one-off' },
            limited: { type: "boolean", description: "True for pop-ups, one-night-only or limited runs" },
          },
        },
      },
    },
  },
};

const SYSTEM = `You are a personal concierge who researches what's happening in a city so your client can fill free time with things they'd actually enjoy, without searching themselves.

How to research:
- Use web search to find real, dated events. Good sources: venue and museum calendars, city and tourism event calendars, local alt-weekly "things to do" lists, Eventbrite, Meetup, Luma, Strava club pages, running stores (e.g. Fleet Feet) and brewery run clubs, chambers of commerce, coworking spaces' event pages.
- Facebook events can't be read directly; only include one if another page confirms the date.
- Only include events whose date falls inside the requested range and that you confirmed from a page you saw. Never invent events, times, prices or URLs.
- Weekly or recurring things (run clubs, trivia, open studios) are listed once per occurrence inside the range, each with the "recurring" field filled in.
- Prefer variety and quality over volume: up to about 30 events, the best ones first. Skip chains' generic promos and tourist traps.
- Times are local to the city. If a time isn't published, leave it null.

When you have finished researching, call report_events once with everything you found.`;

function brief(input: DiscoverInput) {
  const range = input.from === input.to ? input.from : `${input.from} to ${input.to}`;
  const wants =
    input.tab === "networking"
      ? "- Business networking: chamber of commerce mixers, startup and tech meetups, founder or entrepreneur breakfasts, industry and professional association events, coworking community events, young professionals groups."
      : INTERESTS.filter((i) => input.interests.includes(i.id))
          .map((i) => `- ${i.label} (${i.id}): ${i.hint}`)
          .join("\n");
  const place = [input.city, input.region, input.countryCode].filter(Boolean).join(", ");
  return `City: ${place}
Dates: ${range} (time zone ${input.tz})

Find events in these categories:
${wants || "- Anything notable and local (culture)."}

Use the category ids shown in parentheses${input.tab === "networking" ? ' (use "networking")' : ""}.`;
}

export async function discoverWithClaude(input: DiscoverInput): Promise<DiscoverResult> {
  const client = new Anthropic();

  const tools: Anthropic.Beta.BetaToolUnion[] = [
    {
      type: "web_search_20260209",
      name: "web_search",
      max_uses: 12,
      user_location: {
        type: "approximate",
        city: input.city,
        region: input.region ?? undefined,
        country: input.countryCode ?? undefined,
        timezone: input.tz,
      },
    },
    REPORT_TOOL,
  ];

  try {
    return await research(client, tools, input);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) {
      throw new DiscoverError("The Anthropic API key was rejected. Check ANTHROPIC_API_KEY.");
    }
    if (e instanceof Anthropic.RateLimitError) {
      throw new DiscoverError("Too many searches right now. Try again in a minute.");
    }
    throw e;
  }
}

async function research(
  client: Anthropic,
  tools: Anthropic.Beta.BetaToolUnion[],
  input: DiscoverInput,
): Promise<DiscoverResult> {
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: brief(input) }];
  let nudged = false;

  for (let turn = 0; turn < 8; turn++) {
    // Streamed because a large max_tokens is refused without streaming.
    const response = await client.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: SYSTEM,
        tools,
        messages,
      })
      .finalMessage();

    if (response.stop_reason === "refusal") {
      throw new DiscoverError("The search was declined. Try a different city or dates.");
    }

    const report = response.content.find(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === REPORT_TOOL.name,
    );
    if (report) return cleanResult(report.input as DiscoverResult, input);

    messages.push({ role: "assistant", content: response.content });
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason === "max_tokens" || nudged) break;

    nudged = true;
    messages.push({ role: "user", content: "Now call report_events with what you found." });
  }

  throw new DiscoverError("The search didn't finish. Try again.");
}
