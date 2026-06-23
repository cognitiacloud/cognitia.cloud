/**
 * Cognitia Brain Harness — local CLI runner provider (DISABLED in V1).
 *
 * STATUS: DISABLED / SCAFFOLD. No child process is spawned, no binary is
 * invoked, no secret is read. `generate()` throws {@link ProviderDisabledError};
 * descriptor `enabled: false`.
 *
 * The CLI runner models shelling out to a LOCAL model binary. It is DISABLED BY
 * DEFAULT and must never invoke any hosted assistant CLI or browser automation
 * (hard rule). To enable later:
 *  1. Rename this file to `cliProvider.ts`.
 *  2. Implement `generate()` to spawn an explicitly-configured LOCAL binary via
 *     `node:child_process`, with the command allow-listed in config (never a
 *     hosted/web assistant).
 *  3. Flip the registry entry `cli.enabled` to `true` and enable via a
 *     `local-only` workspace policy.
 */

import { PROVIDER_REGISTRY } from '../brainPolicy.js';
import {
  ProviderDisabledError,
  type BrainProvider,
  type BrainRequest,
  type BrainResponse,
  type ProviderDescriptor,
} from './brainProvider.js';

const DESCRIPTOR: ProviderDescriptor = PROVIDER_REGISTRY.cli!;

export class CliBrainProvider implements BrainProvider {
  readonly id = 'cli';
  readonly descriptor = DESCRIPTOR;

  async generate(_request: BrainRequest): Promise<BrainResponse> {
    throw new ProviderDisabledError(this.id, 'CLI runner is disabled by default in V1');
  }
}

export const cliBrainProvider = new CliBrainProvider();
