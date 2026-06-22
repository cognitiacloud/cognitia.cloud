/**
 * Disabled connector port interfaces for the Sales Closer outbound channels.
 *
 * These define the *shape* of every outbound automation boundary the closer
 * could one day drive — email, SMS, WhatsApp, calls, ads, CRM writes, calendar —
 * WITHOUT wiring a single real vendor. They are siblings to the workflow
 * boundaries in `ports.ts`: where those describe the internal state-machine
 * dependencies, these describe the (currently inert) outbound surface.
 *
 * The contract is deliberately fail-closed:
 *
 *   - A dry-run PREVIEW is always allowed. It describes what *would* be sent,
 *     performs no IO, and reports `sent: false`.
 *   - A LIVE execution is refused by the default/mock implementation. It either
 *     returns a `blocked` result or throws — it never sends — because there is
 *     no backend and no `controlled-live` authorization in the default path.
 *   - `provider` is pinned to `none` or `sandbox_simulated`. A real vendor name
 *     can never appear here without a deliberate, audited code change; the
 *     options type makes `controlled-live` unreachable through the mock factory.
 *
 * NOTHING in this module imports a vendor SDK (SendGrid, Twilio, WhatsApp, Meta,
 * Google Ads, HubSpot, Salesforce, …). It is type-only contracts plus an inert,
 * offline mock. No network, no raw PII, no live outreach.
 */

/** Every outbound automation channel the closer can model. */
export const CONNECTOR_CHANNELS = [
  'email',
  'sms',
  'whatsapp',
  'calls',
  'ads',
  'crm',
  'calendar',
] as const;

export type ConnectorChannel = (typeof CONNECTOR_CHANNELS)[number];

/**
 * The only provider identities this layer permits. A vendor is never named here.
 *
 *   - `none`              — no backend at all (the safest default).
 *   - `sandbox_simulated` — an in-memory simulation that performs no real IO.
 *   - `controlled-live`   — reserved for a future, explicitly authorized path.
 *     It is NOT reachable through the default mock factory.
 */
export type ConnectorProvider = 'none' | 'sandbox_simulated' | 'controlled-live';

/** Non-live providers — the only values the disabled mock may report. */
export type NonLiveConnectorProvider = Exclude<ConnectorProvider, 'controlled-live'>;

/**
 * Explicit authorization to attempt a controlled-live action. Absent from every
 * default/mock path. Its presence on a request is necessary-but-not-sufficient:
 * the inert mock still refuses, because it has no real backend to dispatch to.
 */
export interface ControlledLiveAuthorization {
  mode: 'controlled-live';
  /** Audit reference for the governance/human approval that granted live access. */
  approvalRef: string;
}

/** A dry-run preview request. Carries only an opaque ref and a summary — no PII. */
export interface ConnectorPreviewRequest {
  channel: ConnectorChannel;
  /** Opaque, non-PII reference (e.g. a prospect id) — never a raw address/number. */
  targetRef: string;
  /** Short description of the intended action, for preview/audit only. */
  summary: string;
}

/** Result of a dry-run preview. A preview never sends. */
export interface ConnectorPreviewResult {
  channel: ConnectorChannel;
  provider: ConnectorProvider;
  /** Always `false`: a preview never dispatches. */
  sent: false;
  /** Always `true`: previews are dry-run by definition. */
  dryRun: true;
  /** Human-readable description of what *would* happen. */
  preview: string;
}

/** A live execution request. The default mock refuses these. */
export interface ConnectorExecuteRequest {
  channel: ConnectorChannel;
  targetRef: string;
  summary: string;
  /**
   * Explicit controlled-live authorization. Even when provided, the default
   * mock does not perform IO and still returns/throws blocked (fail-closed).
   */
  authorization?: ControlledLiveAuthorization;
}

/** Result of a live execution attempt. */
export interface ConnectorExecuteResult {
  channel: ConnectorChannel;
  provider: ConnectorProvider;
  /** `blocked` in every default/mock path; `dispatched` is reserved for a real, authorized backend. */
  status: 'blocked' | 'dispatched';
  /** `false` in every default/mock path. */
  sent: boolean;
  /** Why the live path was refused; expected when `status === 'blocked'`. */
  reason?: string;
}

/**
 * A single outbound automation boundary. The workflow depends only on this
 * interface, never on a concrete vendor, so it stays offline and mock-safe.
 */
export interface AutomationConnectorPort {
  readonly channel: ConnectorChannel;
  readonly provider: ConnectorProvider;
  /** Whether live execution is enabled. Always `false` in the default mock. */
  readonly liveEnabled: boolean;
  /** Dry-run only: describe what would be sent. Never performs IO, never sends. */
  preview(request: ConnectorPreviewRequest): Promise<ConnectorPreviewResult>;
  /**
   * Attempt a live action. In every default/mock implementation this is
   * fail-closed: it returns a `blocked` result (or throws, for the strict
   * variant) because `liveEnabled` is false and the provider is non-live.
   */
  execute(request: ConnectorExecuteRequest): Promise<ConnectorExecuteResult>;
}

/** The full set of outbound connector boundaries, keyed by channel. */
export interface AutomationConnectorPorts {
  email: AutomationConnectorPort;
  sms: AutomationConnectorPort;
  whatsapp: AutomationConnectorPort;
  calls: AutomationConnectorPort;
  ads: AutomationConnectorPort;
  crm: AutomationConnectorPort;
  calendar: AutomationConnectorPort;
}

/** Raised by `execute()` when the disabled connector is configured to throw. */
export class ConnectorLiveExecutionBlockedError extends Error {
  readonly channel: ConnectorChannel;
  readonly provider: ConnectorProvider;

  constructor(channel: ConnectorChannel, provider: ConnectorProvider) {
    super(
      `Live execution blocked for connector channel "${channel}": ` +
        `provider "${provider}" is non-live and no controlled-live authorization is active.`,
    );
    this.name = 'ConnectorLiveExecutionBlockedError';
    this.channel = channel;
    this.provider = provider;
  }
}

/** Options for the disabled (mock) connector factory. */
export interface DisabledConnectorOptions {
  /**
   * Provider identity to report. Restricted to non-live providers so the mock
   * can never claim `controlled-live`. Defaults to `none`.
   */
  provider?: NonLiveConnectorProvider;
  /**
   * How `execute()` refuses a live attempt:
   *   - `blocked` (default) — resolve with a `{ status: 'blocked', sent: false }` result.
   *   - `throw`             — reject with `ConnectorLiveExecutionBlockedError`.
   * Preview is unaffected — it is always allowed.
   */
  liveBehavior?: 'blocked' | 'throw';
}

const BLOCKED_REASON =
  'live execution disabled: provider is non-live and no controlled-live authorization is present';

function createDisabledConnector(
  channel: ConnectorChannel,
  provider: NonLiveConnectorProvider,
  liveBehavior: 'blocked' | 'throw',
): AutomationConnectorPort {
  return {
    channel,
    provider,
    liveEnabled: false,
    async preview(request: ConnectorPreviewRequest): Promise<ConnectorPreviewResult> {
      return {
        channel,
        provider,
        sent: false,
        dryRun: true,
        preview: `[dry-run:${channel}] ${request.summary} → ${request.targetRef} (provider=${provider}, no IO)`,
      };
    },
    async execute(_request: ConnectorExecuteRequest): Promise<ConnectorExecuteResult> {
      // Fail closed regardless of any authorization on the request: the inert
      // mock has no backend to dispatch to, so it never sends.
      if (liveBehavior === 'throw') {
        throw new ConnectorLiveExecutionBlockedError(channel, provider);
      }
      return { channel, provider, status: 'blocked', sent: false, reason: BLOCKED_REASON };
    },
  };
}

/**
 * Build the full set of DISABLED outbound connector ports.
 *
 * Every channel previews (dry-run) but refuses live execution. The provider is
 * pinned to a non-live value (`none` by default). This is the only connector
 * implementation in the package and it performs zero IO.
 */
export function createDisabledConnectorPorts(
  options: DisabledConnectorOptions = {},
): AutomationConnectorPorts {
  const provider = options.provider ?? 'none';
  const liveBehavior = options.liveBehavior ?? 'blocked';
  const make = (channel: ConnectorChannel) =>
    createDisabledConnector(channel, provider, liveBehavior);
  return {
    email: make('email'),
    sms: make('sms'),
    whatsapp: make('whatsapp'),
    calls: make('calls'),
    ads: make('ads'),
    crm: make('crm'),
    calendar: make('calendar'),
  };
}
