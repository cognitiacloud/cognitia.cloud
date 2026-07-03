import { randomUUID } from 'node:crypto';
import { hashValue } from './hashing.js';
import type { ActionLedger } from './actionLedger.js';
import { blockedReason } from './types.js';
import type { BlockedReason, Clock, EvidenceLabel, IdFactory } from './types.js';

/**
 * Model-router brain harness (11_MODEL_ROUTER_BRAIN_HARNESS_CONTEXT.md).
 *
 * Selects, mocks, or replays AI tasks with fail-closed governance:
 *   - no live provider call exists in this build — 'live_approved' fails
 *     closed with LIVE_PROVIDER_NOT_AUTHORIZED;
 *   - 'disabled' fails closed;
 *   - 'replay' without a registered fixture fails closed;
 *   - secret-looking inputs are rejected before any routing;
 *   - every decision (allowed or blocked) is logged to the action ledger;
 *   - router output is evidence, never authority: the workflow engine never
 *     reads approval or gate state from it.
 */

export type ProviderMode = 'mock' | 'replay' | 'disabled' | 'live_approved';

export interface ModelRouteRequest {
  taskKind: string;
  providerMode: ProviderMode;
  /** Free-text task input. Scanned for secret-looking content. */
  input: string;
  replayFixtureId?: string;
}

export interface ReplayFixture {
  fixtureId: string;
  /** Canned output; replay is deterministic by construction. */
  output: Record<string, unknown>;
  recordedAt: string;
  sourceLabel: string;
}

export interface ModelRouteDecision {
  routeId: string;
  taskKind: string;
  providerMode: ProviderMode;
  decidedAt: string;
  ledgerEventId: string;
}

export type ModelRouteResult =
  | {
      status: 'completed';
      decision: ModelRouteDecision;
      /** Output is wrapped as evidence with source and risk labels. */
      output: { data: Record<string, unknown>; sourceLabel: string; riskLabel: string };
      evidenceLabel: EvidenceLabel;
    }
  | {
      status: 'blocked';
      decision: ModelRouteDecision;
      reason: BlockedReason;
      evidenceLabel: EvidenceLabel;
    };

/**
 * Conservative secret detectors. False positives are acceptable (fail closed);
 * false negatives are the failure mode to avoid.
 */
const SECRET_PATTERNS: readonly RegExp[] = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9_-]{8,}/,
  /\bBearer\s+[A-Za-z0-9._-]{10,}/i,
  /\b(api[_-]?key|secret|token|password|credential)\s*[=:]\s*['"]?[^\s'"]{6,}/i,
  /\bAKIA[0-9A-Z]{16}\b/,
];

export function looksLikeSecret(input: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(input));
}

export interface ModelRouterHarnessOptions {
  clock?: Clock;
  idFactory?: IdFactory;
  replayFixtures?: readonly ReplayFixture[];
}

export class ModelRouterHarness {
  private readonly fixtures = new Map<string, ReplayFixture>();
  private readonly clock: Clock;
  private readonly idFactory: IdFactory;

  constructor(options: ModelRouterHarnessOptions = {}) {
    this.clock = options.clock ?? (() => new Date());
    this.idFactory = options.idFactory ?? randomUUID;
    for (const fixture of options.replayFixtures ?? []) {
      this.fixtures.set(fixture.fixtureId, fixture);
    }
  }

  route(request: ModelRouteRequest, ledger: ActionLedger): ModelRouteResult {
    const routeId = this.idFactory();
    const decidedAt = this.clock().toISOString();

    const block = (reason: BlockedReason): ModelRouteResult => {
      const event = ledger.append('model_route_blocked', {
        routeId,
        taskKind: request.taskKind,
        providerMode: request.providerMode,
        reasonCode: reason.code,
        detail: reason.detail,
      });
      return {
        status: 'blocked',
        decision: {
          routeId,
          taskKind: request.taskKind,
          providerMode: request.providerMode,
          decidedAt,
          ledgerEventId: event.id,
        },
        reason,
        evidenceLabel: 'IMPLEMENTED_LOCAL_MOCK',
      };
    };

    if (looksLikeSecret(request.input)) {
      return block(blockedReason('SECRET_LIKE_INPUT_REJECTED'));
    }

    switch (request.providerMode) {
      case 'live_approved':
        // There is no live execution path in this build at all; the mode name
        // exists so a future authorized lane has a place to land, but here it
        // always fails closed.
        return block(blockedReason('LIVE_PROVIDER_NOT_AUTHORIZED'));
      case 'disabled':
        return block(blockedReason('PROVIDER_DISABLED'));
      case 'replay': {
        const fixture = request.replayFixtureId
          ? this.fixtures.get(request.replayFixtureId)
          : undefined;
        if (!fixture) {
          return block(
            blockedReason(
              'REPLAY_FIXTURE_MISSING',
              `Fixture: ${request.replayFixtureId ?? '(none)'}.`,
            ),
          );
        }
        return this.complete(
          request,
          routeId,
          decidedAt,
          fixture.output,
          fixture.sourceLabel,
          ledger,
        );
      }
      case 'mock': {
        // Deterministic canned output derived from the request only — no IO.
        const data = {
          taskKind: request.taskKind,
          mock: true,
          summary: `mock output for ${request.taskKind}`,
          inputDigest: hashValue(request.input),
        };
        return this.complete(request, routeId, decidedAt, data, 'local_mock_generator', ledger);
      }
    }
  }

  private complete(
    request: ModelRouteRequest,
    routeId: string,
    decidedAt: string,
    data: Record<string, unknown>,
    sourceLabel: string,
    ledger: ActionLedger,
  ): ModelRouteResult {
    const event = ledger.append('model_route_decided', {
      routeId,
      taskKind: request.taskKind,
      providerMode: request.providerMode,
      sourceLabel,
      outputDigest: hashValue(data),
    });
    return {
      status: 'completed',
      decision: {
        routeId,
        taskKind: request.taskKind,
        providerMode: request.providerMode,
        decidedAt,
        ledgerEventId: event.id,
      },
      output: { data, sourceLabel, riskLabel: 'mock_or_replay_no_live_provider' },
      evidenceLabel: 'IMPLEMENTED_LOCAL_MOCK',
    };
  }
}
