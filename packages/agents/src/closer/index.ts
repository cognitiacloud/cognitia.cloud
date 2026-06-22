/**
 * Sales Closer workflow core (W1) — a minimal, mock-safe, offline state machine
 * over canonical `@cognitia/core` GTM contracts. No live outreach, no network,
 * no DB; compliance/approval/CRM/proof are integration boundaries (see ports.ts).
 */
export * from './ports.js';
export * from './salesCloserWorkflow.js';
export * from './mockPorts.js';
export * from './automationKillSwitch.js';
