/**
 * Public trust feed.
 *
 * Safe-empty by default: until a pilot explicitly sets
 * `publicTrustFeedEnabled: true`, `publish()` is a no-op and `feed()` returns
 * an empty array. This prevents accidental public disclosure of pilot activity.
 *
 * Even when enabled, only sanitized summaries are stored — no actor ids, no
 * amounts, no claim bodies.
 */
import type { DeterministicClock } from "./clock.ts";
import type { HarnessConfig } from "./environment.ts";
import type { TrustFeedEvent } from "./types.ts";

export class TrustFeed {
  private readonly events: TrustFeedEvent[] = [];
  private readonly config: HarnessConfig;
  private readonly clock: DeterministicClock;

  constructor(config: HarnessConfig, clock: DeterministicClock) {
    this.config = config;
    this.clock = clock;
  }

  publish(kind: string, summary: string): TrustFeedEvent | null {
    if (!this.config.publicTrustFeedEnabled) {
      return null; // safe-empty: silently drop until explicitly configured on
    }
    const event: TrustFeedEvent = {
      id: this.clock.id("trust"),
      kind,
      at: this.clock.now(),
      summary,
    };
    this.events.push(event);
    return event;
  }

  feed(): ReadonlyArray<TrustFeedEvent> {
    if (!this.config.publicTrustFeedEnabled) return [];
    return this.events.slice();
  }

  get enabled(): boolean {
    return this.config.publicTrustFeedEnabled;
  }
}
