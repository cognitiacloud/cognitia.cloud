/**
 * @cognitia/demandara-gtm-os — local/mock-only Demandara GTM OS chassis.
 *
 * lead intake -> qualification -> consent/source-rights gate -> human approval
 * -> mock connector writeback -> Cognitia proof receipt -> Command Center
 * summary -> monthly proof report input.
 *
 * No live provider, CRM, outreach, deployment, payment, or egress path exists
 * in this package. See the package README for claim-safe status.
 */

export * from './types.js';
export * from './hashing.js';
export * from './actionLedger.js';
export * from './leadIntake.js';
export * from './consentGate.js';
export * from './approvalGate.js';
export * from './qualification.js';
export * from './verticalAdapters.js';
export * from './connectorRegistry.js';
export * from './modelRouter.js';
export * from './proofReceipt.js';
export * from './workflowEngine.js';
export * from './commandCenterSummary.js';
export * from './demandGen.js';
export * from './agentEconomy.js';
