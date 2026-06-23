/**
 * Brain Core Contracts — public barrel.
 *
 * Exposes the model-agnostic contracts, the registry, and the deterministic
 * mock provider. The disabled vendor/local/CLI scaffolds are intentionally NOT
 * re-exported here — they are wired only inside `createDefaultBrainRegistry`,
 * keeping disabled providers out of the package's public surface.
 */

export * from './modelProvider.js';
export * from './modelRegistry.js';
export * from './providers/mockProvider.js';
export * from './brainRunLedger.js';
