import "server-only";
import { discoverWithClaude } from "./discover-claude";
import { discoverFree, freeSourcesConfigured } from "./discover-free";
import { DiscoverError, type DiscoverInput, type DiscoverResult } from "./events";

export { DiscoverError };

/**
 * Claude web research when ANTHROPIC_API_KEY is set; otherwise the free
 * Ticketmaster / SerpApi sources. EVENT_SOURCE=free forces the free ones.
 */
export async function discover(input: DiscoverInput): Promise<DiscoverResult> {
  const useClaude = !!process.env.ANTHROPIC_API_KEY && process.env.EVENT_SOURCE !== "free";
  if (useClaude) return discoverWithClaude(input);
  if (freeSourcesConfigured()) return discoverFree(input);
  throw new DiscoverError(
    "Add TICKETMASTER_API_KEY or SERPAPI_API_KEY (free) or ANTHROPIC_API_KEY to search for events.",
  );
}
