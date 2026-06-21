/**
 * Client Zero Sales Closer workflow core (mock-only). Public surface:
 *   - types: states, events, intake DTO, compliance/appointment/CRM/proof shapes;
 *   - stateMachine: pure `transition` reducer + introspection;
 *   - compliance: consent/compliance gate (reuses @cognitia/core GTM guardrails);
 *   - crm: in-memory idempotent mock CRM;
 *   - runner: `runCloserWorkflow` mock runner;
 *   - fixtures: synthetic, PII-free lead intakes.
 */

export * from './types.js';
export * from './stateMachine.js';
export * from './compliance.js';
export * from './crm.js';
export * from './runner.js';
export * from './fixtures.js';
