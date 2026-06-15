/**
 * Notifier — simulation-only SMS/notification sink.
 *
 * NO REAL SMS. Messages are appended to an in-memory outbox. The `sms` channel
 * guard is asserted on every send so the harness can never reach a real gateway.
 */
import type { DeterministicClock } from "./clock.ts";
import { assertSimulationOnly, type HarnessConfig } from "./environment.ts";

export interface SimulatedMessage {
  readonly id: string;
  readonly to: string;
  readonly body: string;
  readonly at: string;
  readonly channel: "sms";
  readonly delivered: "simulated";
}

export class Notifier {
  private readonly outbox: SimulatedMessage[] = [];
  private readonly config: HarnessConfig;
  private readonly clock: DeterministicClock;

  constructor(config: HarnessConfig, clock: DeterministicClock) {
    this.config = config;
    this.clock = clock;
  }

  sendSms(to: string, body: string): SimulatedMessage {
    assertSimulationOnly(this.config, "sms");
    const message: SimulatedMessage = {
      id: this.clock.id("msg"),
      to,
      body,
      at: this.clock.now(),
      channel: "sms",
      delivered: "simulated",
    };
    this.outbox.push(message);
    return message;
  }

  messages(): ReadonlyArray<SimulatedMessage> {
    return this.outbox.slice();
  }
}
